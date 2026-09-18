/**
 * Shared adapter contracts.
 *
 * Every adapter returns the same envelope so ingestion can log a run, record
 * rate-limit state and decide whether to write, skip or fail — without knowing
 * anything about the specific source.
 */

export interface RateLimitState {
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
}

export interface AdapterError {
  code:
    | "network"
    | "http"
    | "rate_limited"
    | "parse"
    | "schema"
    | "unauthorized"
    | "not_configured"
    | "unsupported";
  message: string;
  retryable: boolean;
  /** Milliseconds to wait before retrying, when the source tells us. */
  retryAfterMs: number | null;
}

export interface AdapterResult<T> {
  ok: boolean;
  items: T[];
  /** Items the source returned that we intentionally did not map. */
  skipped: number;
  rateLimit: RateLimitState;
  error: AdapterError | null;
  /** Raw payload hash, stored for change detection and debugging. */
  payloadHash: string | null;
  /** Number of HTTP requests issued, for logging and quota accounting. */
  requests: number;
  durationMs: number;
}

export function emptyRateLimit(): RateLimitState {
  return { remaining: null, limit: null, resetAt: null };
}

export function adapterFailure<T>(
  error: AdapterError,
  partial: {
    items?: T[];
    skipped?: number;
    rateLimit?: RateLimitState;
    requests?: number;
    durationMs?: number;
    payloadHash?: string | null;
  } = {},
): AdapterResult<T> {
  return {
    ok: false,
    items: partial.items ?? [],
    skipped: partial.skipped ?? 0,
    rateLimit: partial.rateLimit ?? emptyRateLimit(),
    error,
    payloadHash: partial.payloadHash ?? null,
    requests: partial.requests ?? 0,
    durationMs: partial.durationMs ?? 0,
  };
}

export function adapterSuccess<T>(
  items: T[],
  partial: {
    skipped?: number;
    rateLimit?: RateLimitState;
    requests?: number;
    durationMs?: number;
    payloadHash?: string | null;
  } = {},
): AdapterResult<T> {
  return {
    ok: true,
    items,
    skipped: partial.skipped ?? 0,
    rateLimit: partial.rateLimit ?? emptyRateLimit(),
    error: null,
    payloadHash: partial.payloadHash ?? null,
    requests: partial.requests ?? 0,
    durationMs: partial.durationMs ?? 0,
  };
}

export const NOT_CONFIGURED = (what: string, envVar: string): AdapterError => ({
  code: "not_configured",
  message: `${what} is not configured. Set ${envVar} to enable this adapter.`,
  retryable: false,
  retryAfterMs: null,
});

/** Minimal fetch surface so adapters can be tested with a stub. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;
