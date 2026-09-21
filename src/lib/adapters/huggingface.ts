/**
 * Hugging Face Hub popularity adapter.
 *
 * The Hub's public API needs no key. It is used for **popularity only**
 * (`hfDownloads`, `hfLikes`) — never capability. It does not add models: it
 * enriches a model already catalogued by another source, matched on a normalised
 * slug. An unmatched Hub model is counted as skipped rather than inserted, so the
 * catalogue cannot fill with duplicate entries.
 */
import { z } from "zod";
import type { Model } from "@/lib/domain/schema";
import { HttpClient } from "./http";
import { normalizeModelSlug } from "./model-identity";
import { adapterFailure, adapterSuccess, type AdapterResult, type FetchLike } from "./types";

export const huggingFaceModelSchema = z
  .object({
    id: z.string(),
    likes: z.number().optional().nullable(),
    downloads: z.number().optional().nullable(),
    pipeline_tag: z.string().optional().nullable(),
    lastModified: z.string().optional().nullable(),
  })
  .passthrough();

export type HuggingFaceModel = z.infer<typeof huggingFaceModelSchema>;

export interface HuggingFacePopularity {
  rawId: string;
  slug: string;
  downloads: number | null;
  likes: number | null;
}

export function mapHuggingFaceModel(raw: HuggingFaceModel): HuggingFacePopularity | null {
  const slug = normalizeModelSlug(raw.id);
  if (slug.length === 0) return null;
  return { rawId: raw.id, slug, downloads: raw.downloads ?? null, likes: raw.likes ?? null };
}

export interface PopularityMatch {
  /** The matched models with popularity filled in. */
  models: Model[];
  matched: number;
  unmatched: number;
}

/**
 * Fills popularity on the models it can match by normalised slug. A Hub value
 * never clears an existing one, and a model is never fabricated.
 */
export function applyPopularity(
  models: Model[],
  popularity: HuggingFacePopularity[],
): PopularityMatch {
  const bySlug = new Map(models.map((model) => [normalizeModelSlug(model.slug), model]));
  const updated = new Map<string, Model>();
  let matched = 0;

  for (const item of popularity) {
    const model = bySlug.get(item.slug);
    if (!model) continue;
    matched += 1;
    updated.set(model.id, {
      ...model,
      metrics: {
        ...model.metrics,
        hfDownloads: item.downloads ?? model.metrics.hfDownloads,
        hfLikes: item.likes ?? model.metrics.hfLikes,
      },
    });
  }

  return { models: [...updated.values()], matched, unmatched: popularity.length - matched };
}

export interface HuggingFaceOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  client?: HttpClient;
  /** How many models to pull, most-downloaded first. */
  limit?: number;
}

export async function fetchHuggingFaceModels(
  options: HuggingFaceOptions = {},
): Promise<AdapterResult<HuggingFacePopularity>> {
  const baseUrl = (
    options.baseUrl ??
    process.env.HUGGINGFACE_BASE_URL ??
    "https://huggingface.co/api"
  ).replace(/\/$/, "");
  const limit = options.limit ?? 200;
  const client =
    options.client ??
    new HttpClient({
      fetchImpl: options.fetchImpl,
      userAgent: "AI-Model-Intelligence-Hub/0.1 (+huggingface-adapter)",
    });

  const startedAt = Date.now();
  const collected: HuggingFacePopularity[] = [];
  let skipped = 0;

  try {
    const url = `${baseUrl}/models?sort=downloads&direction=-1&limit=${limit}`;
    const payload = await client.request<unknown>(url);
    const parsed = z.array(z.unknown()).safeParse(payload);
    if (!parsed.success) {
      return adapterFailure(
        {
          code: "schema",
          message: "Hugging Face response was not the expected array of models.",
          retryable: false,
          retryAfterMs: null,
        },
        { requests: client.requests, durationMs: Date.now() - startedAt },
      );
    }

    for (const row of parsed.data) {
      const model = huggingFaceModelSchema.safeParse(row);
      if (!model.success) {
        skipped += 1;
        continue;
      }
      const mapped = mapHuggingFaceModel(model.data);
      if (mapped) collected.push(mapped);
      else skipped += 1;
    }

    return adapterSuccess(collected, {
      skipped,
      rateLimit: client.rateLimit,
      requests: client.requests,
      durationMs: Date.now() - startedAt,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return adapterFailure(
      {
        code: /rate limited/i.test(message) ? "rate_limited" : "network",
        message,
        retryable: true,
        retryAfterMs: null,
      },
      { items: collected, skipped, requests: client.requests, durationMs: Date.now() - startedAt },
    );
  }
}
