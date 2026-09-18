/**
 * Artificial Analysis Data API adapter.
 *
 * API-first by policy: never scrape Artificial Analysis to bypass quota. The
 * client is typed, paginates properly, captures rate-limit headers, honours
 * `Retry-After` on 429 and applies exponential backoff for transient failures
 * (all of that lives in HttpClient).
 *
 * The raw response schema is intentionally tolerant: vendor payloads evolve and
 * an unknown extra field must not break ingestion. Missing fields map to `null`
 * so the UI renders "—" instead of a fabricated zero.
 */
import { z } from "zod";
import type { Model, ModelSnapshot, Provider } from "@/lib/domain/schema";
import { hashPayload } from "@/lib/domain/hash";
import { HttpClient } from "./http";
import {
  adapterFailure,
  adapterSuccess,
  NOT_CONFIGURED,
  type AdapterResult,
  type FetchLike,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Raw payload schema                                                          */
/* -------------------------------------------------------------------------- */

const creatorSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    slug: z.string().optional(),
  })
  .partial();

/**
 * Field map (see docs/04-data/artificial-analysis-field-map.md):
 *   intelligence_index            -> metrics.intelligence
 *   coding_index                  -> metrics.coding
 *   agentic_index / tau_bench     -> metrics.agentic
 *   math_index / aime             -> metrics.math
 *   median_output_tokens_per_second -> metrics.outputSpeedTps
 *   median_time_to_first_token_seconds -> metrics.ttftSeconds
 *   pricing.{price_1m_input_tokens, price_1m_output_tokens,
 *            price_1m_cache_hit_tokens, price_1m_cache_write_tokens}
 *   context_window / max_context_tokens -> metrics.contextWindow
 */
export const artificialAnalysisModelSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    slug: z.string().optional(),
    name: z.string(),
    release_date: z.string().optional().nullable(),
    deprecated: z.boolean().optional(),
    model_creator: creatorSchema.optional(),
    creator: creatorSchema.optional(),
    open_weights: z.boolean().optional(),
    open_weight: z.boolean().optional(),
    intelligence_index: z.number().optional().nullable(),
    coding_index: z.number().optional().nullable(),
    agentic_index: z.number().optional().nullable(),
    math_index: z.number().optional().nullable(),
    median_output_tokens_per_second: z.number().optional().nullable(),
    median_time_to_first_token_seconds: z.number().optional().nullable(),
    context_window: z.number().optional().nullable(),
    pricing: z
      .object({
        price_1m_input_tokens: z.number().optional().nullable(),
        price_1m_output_tokens: z.number().optional().nullable(),
        price_1m_cache_hit_tokens: z.number().optional().nullable(),
        price_1m_cache_write_tokens: z.number().optional().nullable(),
      })
      .partial()
      .optional()
      .nullable(),
    evaluations: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .passthrough();

export type ArtificialAnalysisModel = z.infer<typeof artificialAnalysisModelSchema>;

export const artificialAnalysisResponseSchema = z
  .object({
    status: z.number().optional(),
    data: z.array(z.unknown()).optional(),
    models: z.array(z.unknown()).optional(),
    pagination: z
      .object({
        page: z.number().optional(),
        page_size: z.number().optional(),
        total_pages: z.number().optional(),
        has_more: z.boolean().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

/* -------------------------------------------------------------------------- */
/* Mapping                                                                     */
/* -------------------------------------------------------------------------- */

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickEvaluation(
  evaluations: Record<string, unknown> | null | undefined,
  keys: string[],
): number | null {
  if (!evaluations) return null;
  for (const key of keys) {
    const direct = evaluations[key];
    const value = asNumber(direct);
    if (value !== null) return value;

    const nested = evaluations[key];
    if (nested && typeof nested === "object") {
      const score = asNumber((nested as Record<string, unknown>).score);
      if (score !== null) return score;
    }
  }
  return null;
}

export interface MappedArtificialAnalysis {
  providerSlug: string;
  providerName: string;
  model: Omit<Model, "id" | "providerId">;
  raw: ArtificialAnalysisModel;
}

export function mapArtificialAnalysisModel(
  raw: ArtificialAnalysisModel,
  capturedAt: string,
): MappedArtificialAnalysis {
  const creator = raw.model_creator ?? raw.creator ?? {};
  const creatorName = creator.name ?? "Unknown provider";
  const creatorSlug =
    creator.slug ??
    creatorName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const slug =
    raw.slug ??
    raw.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const pricing = raw.pricing ?? {};

  const metrics = {
    intelligence: asNumber(raw.intelligence_index),
    coding: asNumber(raw.coding_index) ?? pickEvaluation(raw.evaluations, ["coding", "swe_bench"]),
    agentic:
      asNumber(raw.agentic_index) ??
      pickEvaluation(raw.evaluations, ["agentic", "tau_bench", "tool_use"]),
    math: asNumber(raw.math_index) ?? pickEvaluation(raw.evaluations, ["math", "aime", "math_500"]),
    outputSpeedTps: asNumber(raw.median_output_tokens_per_second),
    ttftSeconds: asNumber(raw.median_time_to_first_token_seconds),
    inputPricePerMillion: asNumber(pricing.price_1m_input_tokens),
    outputPricePerMillion: asNumber(pricing.price_1m_output_tokens),
    cacheReadPricePerMillion: asNumber(pricing.price_1m_cache_hit_tokens),
    cacheWritePricePerMillion: asNumber(pricing.price_1m_cache_write_tokens),
    contextWindow: asNumber(raw.context_window),
  };

  return {
    providerSlug: creatorSlug,
    providerName: creatorName,
    model: {
      slug,
      name: raw.name,
      shortName: raw.name,
      releaseDate: raw.release_date ?? null,
      deprecatedAt: raw.deprecated ? capturedAt : null,
      openWeight: Boolean(raw.open_weights ?? raw.open_weight),
      description: null,
      officialUrl: null,
      metrics,
      sourceId: "artificial-analysis-api",
      sourceVersion: null,
      lastRefreshedAt: capturedAt,
    },
    raw,
  };
}

export function providerFromMapped(mapped: MappedArtificialAnalysis, updatedAt: string): Provider {
  return {
    id: `provider:${mapped.providerSlug}`,
    slug: mapped.providerSlug,
    name: mapped.providerName,
    domain: null,
    countryCode: null,
    region: null,
    // Grouping is curated in the internal provider registry, never inferred from
    // the metric payload: region is not a quality signal and must not be guessed.
    group: "other",
    logoUrl: null,
    color: null,
    active: true,
    sourceId: "artificial-analysis-api",
    updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Adapter                                                                     */
/* -------------------------------------------------------------------------- */

export interface ArtificialAnalysisOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  /** Page size requested from the API. */
  pageSize?: number;
  /** Safety cap on pages, so a pagination bug cannot loop forever. */
  maxPages?: number;
  client?: HttpClient;
  now?: Date;
  /** Refuse to run when fewer than this many requests remain in the quota. */
  minRemaining?: number;
}

export interface ArtificialAnalysisPayload {
  models: Model[];
  providers: Provider[];
  snapshots: ModelSnapshot[];
}

export async function fetchArtificialAnalysis(
  options: ArtificialAnalysisOptions = {},
): Promise<AdapterResult<MappedArtificialAnalysis>> {
  const apiKey = options.apiKey ?? process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  if (!apiKey) {
    return adapterFailure(
      NOT_CONFIGURED("Artificial Analysis Data API", "ARTIFICIAL_ANALYSIS_API_KEY"),
    );
  }

  const baseUrl = (
    options.baseUrl ??
    process.env.ARTIFICIAL_ANALYSIS_BASE_URL ??
    "https://artificialanalysis.ai/api/v2"
  ).replace(/\/$/, "");
  const client =
    options.client ??
    new HttpClient({
      fetchImpl: options.fetchImpl,
      userAgent: "AI-Model-Intelligence-Hub/0.1 (+artificial-analysis-adapter)",
    });

  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 20;
  const collected: MappedArtificialAnalysis[] = [];
  const startedAt = Date.now();
  let skipped = 0;

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const url = `${baseUrl}/data/llm/models?page=${page}&page_size=${pageSize}`;
      const payload = await client.request<unknown>(url, {
        headers: { "x-api-key": apiKey },
        minRemaining: options.minRemaining ?? 1,
      });

      const parsed = artificialAnalysisResponseSchema.safeParse(payload);
      if (!parsed.success) {
        return adapterFailure(
          {
            code: "schema",
            message: `Artificial Analysis response did not match the expected envelope: ${parsed.error.issues[0]?.message ?? "unknown shape"}`,
            retryable: false,
            retryAfterMs: null,
          },
          {
            items: collected,
            skipped,
            rateLimit: client.rateLimit,
            requests: client.requests,
            durationMs: Date.now() - startedAt,
          },
        );
      }

      const rows = parsed.data.data ?? parsed.data.models ?? [];
      const capturedAt = (options.now ?? new Date()).toISOString();

      for (const row of rows) {
        const model = artificialAnalysisModelSchema.safeParse(row);
        if (!model.success) {
          skipped += 1;
          continue;
        }
        collected.push(mapArtificialAnalysisModel(model.data, capturedAt));
      }

      const hasMore = parsed.data.pagination?.has_more === true;
      const totalPages = parsed.data.pagination?.total_pages;
      if (!hasMore && (totalPages === undefined || page >= totalPages)) break;
      if (rows.length < pageSize && !hasMore) break;
    }

    return adapterSuccess(collected, {
      skipped,
      rateLimit: client.rateLimit,
      requests: client.requests,
      durationMs: Date.now() - startedAt,
      payloadHash: hashPayload(collected.map((entry) => entry.model.slug)),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const rateLimited = /rate limited/i.test(message);
    return adapterFailure(
      {
        code: rateLimited ? "rate_limited" : "network",
        message,
        retryable: true,
        retryAfterMs: null,
      },
      {
        items: collected,
        skipped,
        rateLimit: client.rateLimit,
        requests: client.requests,
        durationMs: Date.now() - startedAt,
      },
    );
  }
}

/** Turns a mapped payload into domain rows ready for persistence. */
export function toPersistenceRows(
  items: MappedArtificialAnalysis[],
  now: Date,
): ArtificialAnalysisPayload {
  const capturedAt = now.toISOString();
  const providerBySlug = new Map<string, Provider>();

  for (const item of items) {
    if (!providerBySlug.has(item.providerSlug)) {
      providerBySlug.set(item.providerSlug, providerFromMapped(item, capturedAt));
    }
  }

  const providers = [...providerBySlug.values()];
  const providerIdBySlug = new Map(providers.map((provider) => [provider.slug, provider.id]));

  const models: Model[] = items.map((item) => ({
    id: `model:${item.model.slug}`,
    providerId: providerIdBySlug.get(item.providerSlug) ?? `provider:${item.providerSlug}`,
    ...item.model,
  }));

  const snapshots: ModelSnapshot[] = models.map((model, index) => ({
    id: `model-snapshot:${model.slug}:${capturedAt}`,
    modelId: model.id,
    capturedAt,
    metrics: model.metrics,
    sourceId: "artificial-analysis-api",
    sourceVersion: null,
    payloadHash: hashPayload({ index, slug: model.slug, metrics: model.metrics }),
  }));

  return { models, providers, snapshots };
}
