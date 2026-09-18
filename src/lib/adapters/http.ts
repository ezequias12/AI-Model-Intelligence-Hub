/**
 * HTTP client with exponential backoff, 429 `Retry-After` handling and
 * rate-limit header capture.
 *
 * Adapters never call `fetch` directly: quota discipline lives in one place so
 * a single source cannot accidentally hammer an API.
 */
import { emptyRateLimit, type FetchLike, type RateLimitState } from "./types";

export interface HttpClientOptions {
  fetchImpl?: FetchLike;
  /** Base delay for exponential backoff, in milliseconds. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  /** Injected sleep, so tests do not actually wait. */
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
  /** Hard cap so one adapter can never burn the whole quota. */
  maxRequests?: number;
}

export interface HttpRequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  /** When set, the client refuses to issue the request if fewer than this many
   * requests remain in the reported quota. */
  minRemaining?: number;
}

export class RateLimitExceededError extends Error {
  readonly retryAfterMs: number | null;
  constructor(message: string, retryAfterMs: number | null) {
    super(message);
    this.name = "RateLimitExceededError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class QuotaGuardError extends Error {
  constructor(remaining: number, required: number) {
    super(`Deferred request: ${remaining} quota remaining, ${required} required.`);
    this.name = "QuotaGuardError";
  }
}

/**
 * True when a failure means "come back later", not "this is broken".
 *
 * The quota guard and a persistent 429 are deliberate, benign deferrals: the
 * run did nothing because it should not have, which must be reported as
 * `deferred`/`rate_limited` rather than as a failure (KI-1).
 */
const DEFERRAL_PATTERN = /deferred request|rate limit|quota/i;

export function isDeferralError(cause: unknown): boolean {
  if (cause instanceof QuotaGuardError || cause instanceof RateLimitExceededError) return true;
  const message = cause instanceof Error ? cause.message : String(cause);
  return DEFERRAL_PATTERN.test(message);
}

export class HttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly userAgent: string;
  private readonly maxRequests: number;

  requests = 0;
  rateLimit: RateLimitState = emptyRateLimit();

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.maxAttempts = options.maxAttempts ?? 4;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.userAgent = options.userAgent ?? "AI-Model-Intelligence-Hub/0.1 (+server-side ingestion)";
    this.maxRequests = options.maxRequests ?? 200;
  }

  /** Parses rate-limit state from headers, tolerating several vendor shapes. */
  captureRateLimit(headers: { get(name: string): string | null }): void {
    const remaining = firstNumber(headers, [
      "x-ratelimit-remaining",
      "ratelimit-remaining",
      "x-rate-limit-remaining",
    ]);
    const limit = firstNumber(headers, [
      "x-ratelimit-limit",
      "ratelimit-limit",
      "x-rate-limit-limit",
    ]);
    const resetSeconds = firstNumber(headers, [
      "x-ratelimit-reset",
      "ratelimit-reset",
      "x-rate-limit-reset",
    ]);

    if (remaining !== null || limit !== null || resetSeconds !== null) {
      this.rateLimit = {
        remaining: remaining ?? this.rateLimit.remaining,
        limit: limit ?? this.rateLimit.limit,
        resetAt:
          resetSeconds === null
            ? this.rateLimit.resetAt
            : new Date(Date.now() + resetSeconds * 1000).toISOString(),
      };
    }
  }

  async request<T = unknown>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    if (this.requests >= this.maxRequests) {
      throw new QuotaGuardError(this.maxRequests, this.maxRequests);
    }

    const required = options.minRemaining ?? 1;
    if (this.rateLimit.remaining !== null && this.rateLimit.remaining < required) {
      throw new QuotaGuardError(this.rateLimit.remaining, required);
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      this.requests += 1;
      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await this.fetchImpl(url, {
          method: options.method ?? "GET",
          headers: {
            accept: "application/json, text/plain, */*",
            "user-agent": this.userAgent,
            ...options.headers,
          },
          body: options.body,
        });
      } catch (cause) {
        lastError = cause instanceof Error ? cause : new Error(String(cause));
        await this.sleep(this.backoff(attempt));
        continue;
      }

      this.captureRateLimit(response.headers);

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
        if (attempt === this.maxAttempts) {
          throw new RateLimitExceededError(
            `Rate limited by ${url} after ${attempt} attempts.`,
            retryAfterMs,
          );
        }
        await this.sleep(retryAfterMs ?? this.backoff(attempt));
        continue;
      }

      if (response.status >= 500) {
        lastError = new Error(`Upstream error ${response.status} from ${url}`);
        await this.sleep(this.backoff(attempt));
        continue;
      }

      if (!response.ok) {
        const body = await safeText(response);
        throw new Error(
          `HTTP ${response.status} from ${url}${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }

      return (await response.json()) as T;
    }

    throw lastError ?? new Error(`Request to ${url} failed after ${this.maxAttempts} attempts.`);
  }

  async requestText(url: string, options: HttpRequestOptions = {}): Promise<string> {
    if (this.requests >= this.maxRequests)
      throw new QuotaGuardError(this.maxRequests, this.maxRequests);

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      this.requests += 1;
      try {
        const response = await this.fetchImpl(url, {
          method: options.method ?? "GET",
          headers: {
            accept: "application/rss+xml, application/atom+xml, text/xml, text/html, */*",
            "user-agent": this.userAgent,
            ...options.headers,
          },
          body: options.body,
        });

        this.captureRateLimit(response.headers);

        if (response.status === 429) {
          const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
          if (attempt === this.maxAttempts) {
            throw new RateLimitExceededError(`Rate limited by ${url}.`, retryAfterMs);
          }
          await this.sleep(retryAfterMs ?? this.backoff(attempt));
          continue;
        }
        if (response.status >= 500) {
          lastError = new Error(`Upstream error ${response.status} from ${url}`);
          await this.sleep(this.backoff(attempt));
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);

        return await response.text();
      } catch (cause) {
        if (cause instanceof RateLimitExceededError) throw cause;
        lastError = cause instanceof Error ? cause : new Error(String(cause));
        if (attempt < this.maxAttempts) await this.sleep(this.backoff(attempt));
      }
    }

    throw lastError ?? new Error(`Request to ${url} failed.`);
  }

  private backoff(attempt: number): number {
    const exponential = this.baseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.random() * this.baseDelayMs;
    return Math.min(this.maxDelayMs, exponential + jitter);
  }
}

function firstNumber(
  headers: { get(name: string): string | null },
  names: string[],
): number | null {
  for (const name of names) {
    const raw = headers.get(name);
    if (raw === null) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** `Retry-After` may be seconds or an HTTP date. */
export function parseRetryAfter(raw: string | null, now: Date = new Date()): number | null {
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(raw);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now.getTime());
}

async function safeText(response: { text(): Promise<string> }): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
