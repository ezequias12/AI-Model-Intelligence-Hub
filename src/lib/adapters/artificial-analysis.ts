/**
 * Artificial Analysis Data API adapter.
 *
 * API-first by policy: never scrape Artificial Analysis to bypass quota. The
 * client is typed, paginates properly, captures rate-limit headers, honours
 * `Retry-After` on 429 and applies exponential backoff for transient failures
 * (all of that lives in HttpClient).
 *
 * Two endpoints are read, and the reason matters:
 *
 *  - `/language/models/free` is the **documented** free-tier endpoint. It carries
 *    the agentic index, the pre-computed cost per Intelligence Index task and the
 *    cache read/write prices. It paginates (200 rows per page).
 *  - `/data/llms/models` is the older, undocumented path this adapter used to call
 *    on its own. It returns the whole catalogue in one response and is the only
 *    source of the math index, but it publishes **no** agentic index, no cost per
 *    task and no cache prices — which is why those metrics sat empty.
 *
 * The documented endpoint is therefore authoritative and the legacy one only
 * fills the gaps it is uniquely able to fill. A null never displaces a value.
 *
 * The raw response schema is intentionally tolerant: vendor payloads evolve and
 * an unknown extra field must not break ingestion. Missing fields map to `null`
 * so the UI renders "—" instead of a fabricated zero.
 */
import { z } from "zod";
import type { Model, ModelSnapshot, ModelMetrics, Provider } from "@/lib/domain/schema";
import { hashPayload } from "@/lib/domain/hash";
import { HttpClient, isDeferralError } from "./http";
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
 * Field map (verified against live responses on 2026-09-23; see
 * docs/04-data/artificial-analysis-field-map.md):
 *
 *   Documented free endpoint (`/language/models/free`):
 *     evaluations.artificial_analysis_intelligence_index            -> metrics.intelligence
 *     evaluations.artificial_analysis_coding_index                  -> metrics.coding
 *     evaluations.artificial_analysis_agentic_index                 -> metrics.agentic
 *     artificial_analysis_intelligence_index_cost
 *       .cost_per_task.total_cost                                   -> metrics.costPerTaskUsd
 *     performance.median_output_tokens_per_second                   -> metrics.outputSpeedTps
 *     performance.median_time_to_first_token_seconds                -> metrics.ttftSeconds
 *     pricing.price_1m_input_tokens                                 -> metrics.inputPricePerMillion
 *     pricing.price_1m_output_tokens                                -> metrics.outputPricePerMillion
 *     pricing.price_1m_cache_hit_tokens                             -> metrics.cacheReadPricePerMillion
 *     pricing.price_1m_cache_write_tokens                           -> metrics.cacheWritePricePerMillion
 *
 *   Legacy catalogue endpoint (`/data/llms/models`):
 *     evaluations.artificial_analysis_math_index                    -> metrics.math
 *     (flat `median_*` performance keys instead of the `performance` object)
 *
 * Fields neither endpoint exposes on the free tier — context window, open-weights
 * flag, deprecation date, and the per-task token split — map to null/false rather
 * than to a guessed value. The token split arrives from the web-dataset adapter.
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
    /** Performance object used by the documented endpoint. */
    performance: z
      .object({
        median_output_tokens_per_second: z.number().optional().nullable(),
        median_time_to_first_token_seconds: z.number().optional().nullable(),
        median_time_to_first_answer_token_seconds: z.number().optional().nullable(),
        median_end_to_end_response_time_seconds: z.number().optional().nullable(),
      })
      .partial()
      .optional()
      .nullable(),
    /** Pre-computed cost of running the Intelligence Index. Free tier: totals only. */
    artificial_analysis_intelligence_index_cost: z
      .object({
        total_cost: z.number().optional().nullable(),
        cost_per_task: z
          .object({ total_cost: z.number().optional().nullable() })
          .partial()
          .optional()
          .nullable(),
      })
      .partial()
      .optional()
      .nullable(),
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

  const metrics: ModelMetrics = {
    intelligence:
      asNumber(raw.intelligence_index) ??
      pickEvaluation(raw.evaluations, [
        "artificial_analysis_intelligence_index",
        "intelligence_index",
      ]),
    coding:
      asNumber(raw.coding_index) ??
      pickEvaluation(raw.evaluations, ["artificial_analysis_coding_index", "coding_index"]),
    // Present on the documented free endpoint; absent on the legacy catalogue
    // endpoint, where it stays null until the merge fills it.
    agentic:
      asNumber(raw.agentic_index) ??
      pickEvaluation(raw.evaluations, ["artificial_analysis_agentic_index", "agentic_index"]),
    math:
      asNumber(raw.math_index) ??
      pickEvaluation(raw.evaluations, ["artificial_analysis_math_index", "math_index"]),
    outputSpeedTps:
      asNumber(raw.median_output_tokens_per_second) ??
      asNumber(raw.performance?.median_output_tokens_per_second),
    ttftSeconds:
      asNumber(raw.median_time_to_first_token_seconds) ??
      asNumber(raw.performance?.median_time_to_first_token_seconds),
    inputPricePerMillion: asNumber(pricing.price_1m_input_tokens),
    outputPricePerMillion: asNumber(pricing.price_1m_output_tokens),
    cacheReadPricePerMillion: asNumber(pricing.price_1m_cache_hit_tokens),
    cacheWritePricePerMillion: asNumber(pricing.price_1m_cache_write_tokens),
    contextWindow: asNumber(raw.context_window),
    // A vendor figure, not a value this product computes.
    costPerTaskUsd: asNumber(
      raw.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost,
    ),
    // The free tier exposes no token counts; these arrive from the web dataset.
    answerTokensPerTask: null,
    reasoningTokensPerTask: null,
    // Popularity is not published by Artificial Analysis; it comes from the
    // Hugging Face source (see merge-models.ts).
    hfDownloads: null,
    hfLikes: null,
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

/** Paths in read order: the documented endpoint first, the legacy one as filler. */
const ENDPOINT_PATHS = ["/language/models/free", "/data/llms/models"] as const;

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

/**
 * Folds the filler rows into the authoritative ones.
 *
 * A null never displaces a number: the documented endpoint wins wherever it
 * published a value, and the legacy endpoint only contributes the fields it is
 * uniquely able to contribute (the math index, and any model the documented
 * endpoint does not list).
 */
function mergeEndpoints(
  authoritative: MappedArtificialAnalysis[],
  filler: MappedArtificialAnalysis[],
): MappedArtificialAnalysis[] {
  const bySlug = new Map(authoritative.map((entry) => [entry.model.slug, entry]));

  for (const entry of filler) {
    const existing = bySlug.get(entry.model.slug);
    if (!existing) {
      bySlug.set(entry.model.slug, entry);
      continue;
    }

    const metrics = { ...existing.model.metrics } as Record<string, number | null>;
    const incoming = entry.model.metrics as Record<string, number | null>;
    for (const key of Object.keys(incoming)) {
      if ((metrics[key] ?? null) === null && incoming[key] !== null) {
        metrics[key] = incoming[key] ?? null;
      }
    }

    bySlug.set(entry.model.slug, {
      ...existing,
      model: { ...existing.model, metrics: metrics as unknown as ModelMetrics },
    });
  }

  return [...bySlug.values()];
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

  const pageSize = options.pageSize ?? 200;
  const maxPages = options.maxPages ?? 10;
  const startedAt = Date.now();
  const capturedAt = (options.now ?? new Date()).toISOString();

  const grouped: MappedArtificialAnalysis[][] = [];
  let skipped = 0;

  try {
    for (const path of ENDPOINT_PATHS) {
      const collected: MappedArtificialAnalysis[] = [];

      for (let page = 1; page <= maxPages; page += 1) {
        const url = `${baseUrl}${path}?page=${page}&page_size=${pageSize}`;
        const payload = await client.request<unknown>(url, {
          headers: { "x-api-key": apiKey },
          minRemaining: options.minRemaining ?? 1,
        });

        const parsed = artificialAnalysisResponseSchema.safeParse(payload);
        if (!parsed.success) {
          return adapterFailure(
            {
              code: "schema",
              message: `Artificial Analysis response from ${path} did not match the expected envelope: ${parsed.error.issues[0]?.message ?? "unknown shape"}`,
              retryable: false,
              retryAfterMs: null,
            },
            {
              items: mergeEndpoints(collected, grouped[1] ?? []),
              skipped,
              rateLimit: client.rateLimit,
              requests: client.requests,
              durationMs: Date.now() - startedAt,
            },
          );
        }

        const rows = parsed.data.data ?? parsed.data.models ?? [];

        for (const row of rows) {
          const model = artificialAnalysisModelSchema.safeParse(row);
          if (!model.success) {
            skipped += 1;
            continue;
          }
          collected.push(mapArtificialAnalysisModel(model.data, capturedAt));
        }

        const pagination = parsed.data.pagination;
        // The legacy endpoint returns the whole set in one response with no
        // pagination block. Paginate only when the vendor says there is more;
        // otherwise the same page would be fetched repeatedly.
        if (!pagination) break;

        const hasMore = pagination.has_more === true;
        const totalPages = pagination.total_pages;
        if (!hasMore && (totalPages === undefined || page >= totalPages)) break;
        if (rows.length < pageSize && !hasMore) break;
      }

      grouped.push(collected);
    }

    const [authoritative, filler] = grouped;
    const merged = mergeEndpoints(authoritative ?? [], filler ?? []);

    if (merged.length === 0) {
      return adapterFailure(
        {
          code: "schema",
          message:
            "Artificial Analysis returned no models from any endpoint. Refusing to write an empty catalogue over the stored one.",
          retryable: true,
          retryAfterMs: null,
        },
        {
          items: [],
          skipped,
          rateLimit: client.rateLimit,
          requests: client.requests,
          durationMs: Date.now() - startedAt,
        },
      );
    }

    return adapterSuccess(merged, {
      skipped,
      rateLimit: client.rateLimit,
      requests: client.requests,
      durationMs: Date.now() - startedAt,
      payloadHash: hashPayload(merged.map((entry) => entry.model.slug)),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    // A quota-guard refusal is a benign deferral, not a transport failure.
    const deferred = isDeferralError(cause);
    return adapterFailure(
      {
        code: deferred ? "rate_limited" : "network",
        message,
        retryable: true,
        retryAfterMs: null,
      },
      {
        items: grouped.flat(),
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
