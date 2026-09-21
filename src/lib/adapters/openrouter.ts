/**
 * OpenRouter model-catalogue adapter.
 *
 * OpenRouter publishes its routed catalogue at a public endpoint that needs no
 * key. It is used for **catalogue breadth and the context window** only: it
 * exposes no capability index, and its pricing is the *routed* price (per
 * provider), not the lab's first-party price. This adapter therefore never
 * writes the price fields over a first-party source (see `merge-models.ts`).
 */
import { z } from "zod";
import type { Model, ModelMetrics, Provider } from "@/lib/domain/schema";
import { HttpClient } from "./http";
import { normalizeAuthorSlug, normalizeModelSlug } from "./model-identity";
import { adapterFailure, adapterSuccess, type AdapterResult, type FetchLike } from "./types";

export const openRouterModelSchema = z
  .object({
    id: z.string(),
    name: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    context_length: z.number().optional().nullable(),
    pricing: z
      .object({
        prompt: z.union([z.string(), z.number()]).optional().nullable(),
        completion: z.union([z.string(), z.number()]).optional().nullable(),
      })
      .partial()
      .optional()
      .nullable(),
  })
  .passthrough();

export const openRouterResponseSchema = z.object({
  data: z.array(z.unknown()),
});

export type OpenRouterModel = z.infer<typeof openRouterModelSchema>;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** OpenRouter quotes USD per token; the domain stores USD per 1M tokens. */
function perMillion(value: unknown): number | null {
  const perToken = toNumber(value);
  return perToken === null ? null : perToken * 1_000_000;
}

export interface MappedOpenRouter {
  provider: Provider;
  model: Omit<Model, "id" | "providerId">;
}

export function mapOpenRouterModel(
  raw: OpenRouterModel,
  capturedAt: string,
): MappedOpenRouter | null {
  const authorSlug = normalizeAuthorSlug(raw.id);
  const slug = normalizeModelSlug(raw.id);
  if (!authorSlug || slug.length === 0) return null;

  const rawAuthor = raw.id.split(":")[0]!.split("/")[0] ?? authorSlug;
  const pricing = raw.pricing ?? {};
  const name = raw.name ?? raw.id;

  const metrics: ModelMetrics = {
    // OpenRouter publishes no capability index; those stay null rather than guessed.
    intelligence: null,
    coding: null,
    agentic: null,
    math: null,
    outputSpeedTps: null,
    ttftSeconds: null,
    inputPricePerMillion: perMillion(pricing.prompt),
    outputPricePerMillion: perMillion(pricing.completion),
    cacheReadPricePerMillion: null,
    cacheWritePricePerMillion: null,
    contextWindow: raw.context_length ?? null,
    hfDownloads: null,
    hfLikes: null,
  };

  return {
    provider: {
      id: `provider:${authorSlug}`,
      slug: authorSlug,
      name: rawAuthor,
      domain: null,
      countryCode: null,
      region: null,
      // Grouping is never inferred from a catalogue payload (ADR-0005).
      group: "other",
      logoUrl: null,
      color: null,
      active: true,
      sourceId: "openrouter-models",
      updatedAt: capturedAt,
    },
    model: {
      slug,
      name,
      shortName: name,
      releaseDate: null,
      deprecatedAt: null,
      // OpenRouter does not state whether weights are open; never guess.
      openWeight: false,
      description: null,
      officialUrl: null,
      metrics,
      sourceId: "openrouter-models",
      sourceVersion: null,
      lastRefreshedAt: capturedAt,
    },
  };
}

/** Turns mapped rows into providers and models with stable ids, de-duplicated. */
export function toPersistenceRows(mapped: MappedOpenRouter[]): {
  providers: Provider[];
  models: Model[];
} {
  const providers = new Map<string, Provider>();
  const models = new Map<string, Model>();

  for (const entry of mapped) {
    if (!providers.has(entry.provider.id)) providers.set(entry.provider.id, entry.provider);
    const id = `model:${entry.model.slug}`;
    if (!models.has(id)) {
      models.set(id, { id, providerId: entry.provider.id, ...entry.model });
    }
  }

  return { providers: [...providers.values()], models: [...models.values()] };
}

export interface OpenRouterOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  client?: HttpClient;
  now?: Date;
}

export async function fetchOpenRouterModels(
  options: OpenRouterOptions = {},
): Promise<AdapterResult<MappedOpenRouter>> {
  const baseUrl = (
    options.baseUrl ??
    process.env.OPENROUTER_BASE_URL ??
    "https://openrouter.ai/api/v1"
  ).replace(/\/$/, "");
  const client =
    options.client ??
    new HttpClient({
      fetchImpl: options.fetchImpl,
      userAgent: "AI-Model-Intelligence-Hub/0.1 (+openrouter-adapter)",
    });

  const capturedAt = (options.now ?? new Date()).toISOString();
  const startedAt = Date.now();
  const collected: MappedOpenRouter[] = [];
  let skipped = 0;

  try {
    const payload = await client.request<unknown>(`${baseUrl}/models`);
    const parsed = openRouterResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return adapterFailure(
        {
          code: "schema",
          message: "OpenRouter response did not match the expected envelope.",
          retryable: false,
          retryAfterMs: null,
        },
        { requests: client.requests, durationMs: Date.now() - startedAt },
      );
    }

    for (const row of parsed.data.data) {
      const model = openRouterModelSchema.safeParse(row);
      if (!model.success) {
        skipped += 1;
        continue;
      }
      const mapped = mapOpenRouterModel(model.data, capturedAt);
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
