/**
 * World & Politics news adapter.
 *
 * Fully isolated from the AI/model/harness pipelines: this module is the only
 * place political content enters the system, and nothing here is ever read by
 * model or harness ranking code.
 *
 * Requirements enforced at this boundary:
 *  - explicit source attribution on every item;
 *  - publication date recorded separately from event date;
 *  - contested stories flagged (`multipleAccounts`) instead of adjudicated;
 *  - no sentiment, no ideology scoring, no party/candidate ranking.
 */
import { z } from "zod";
import type { WorldNewsItem } from "@/lib/domain/schema";
import { canonicalizeUrl, newsContentHash } from "@/lib/domain/hash";
import { isNeutral } from "@/lib/domain/world";
import { HttpClient } from "./http";
import {
  adapterFailure,
  adapterSuccess,
  NOT_CONFIGURED,
  type AdapterResult,
  type FetchLike,
} from "./types";

export const worldWireItemSchema = z.object({
  id: z.string(),
  headline: z.string(),
  summary: z.string().optional().nullable(),
  url: z.string(),
  publisher: z.string().optional().nullable(),
  published_at: z.string().optional().nullable(),
  event_at: z.string().optional().nullable(),
  regions: z.array(z.string()).optional(),
  country_codes: z.array(z.string()).optional(),
  primary_source_url: z.string().optional().nullable(),
  disputed: z.boolean().optional(),
  developing: z.boolean().optional(),
});

export const worldWireResponseSchema = z.object({
  items: z.array(z.unknown()),
  next_cursor: z.string().optional().nullable(),
});

export type WorldWireItem = z.infer<typeof worldWireItemSchema>;

const REGION_VALUES = [
  "argentina",
  "united_states",
  "latin_america",
  "world",
  "economy",
  "regulation",
  "geopolitics",
  "elections",
  "conflict_diplomacy",
] as const;

export interface WorldMappingContext {
  sourceId: string;
  sourceName: string;
  trustTier: WorldNewsItem["trustTier"];
  defaultRegion: WorldNewsItem["region"];
  defaultCategory: WorldNewsItem["category"];
  now: Date;
}

export interface WorldMappingOutcome {
  item: WorldNewsItem | null;
  /** Reason the item was dropped, for the ingestion run ledger. */
  dropped: string | null;
}

export function mapWorldWireItem(
  raw: WorldWireItem,
  context: WorldMappingContext,
): WorldMappingOutcome {
  // Neutrality gate: a summary that advocates, predicts or adjudicates is a
  // defect. We drop the summary (not the item) and keep the attributable link.
  const summary = raw.summary ?? null;
  const neutralSummary = summary !== null && isNeutral(summary) ? summary : null;
  const droppedSummary = summary !== null && neutralSummary === null;

  const canonicalUrl = canonicalizeUrl(raw.url);
  const region =
    (raw.regions ?? []).find((value): value is WorldNewsItem["region"] =>
      (REGION_VALUES as readonly string[]).includes(value),
    ) ?? context.defaultRegion;

  return {
    item: {
      id: `world:${context.sourceId}:${raw.id}`,
      region,
      category: context.defaultCategory,
      headline: raw.headline,
      summary: neutralSummary,
      sourceId: context.sourceId,
      sourceName: raw.publisher ?? context.sourceName,
      trustTier: context.trustTier,
      url: raw.url,
      canonicalUrl,
      primarySourceUrl: raw.primary_source_url ?? null,
      publishedAt: normalizeIso(raw.published_at),
      eventAt: normalizeIso(raw.event_at),
      discoveredAt: context.now.toISOString(),
      countryCodes: (raw.country_codes ?? []).map((code) => code.toUpperCase()),
      multipleAccounts: raw.disputed ?? false,
      developing: raw.developing ?? false,
      contentHash: newsContentHash({
        canonicalUrl,
        title: raw.headline,
        publishedAt: raw.published_at ?? null,
      }),
    },
    dropped: droppedSummary
      ? "Non-neutral summary dropped; item kept with attribution only."
      : null,
  };
}

function normalizeIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export interface WorldAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  client?: HttpClient;
  sourceId?: string;
  sourceName?: string;
  trustTier?: WorldNewsItem["trustTier"];
  region?: WorldNewsItem["region"];
  category?: WorldNewsItem["category"];
  maxPages?: number;
  now?: Date;
}

export async function fetchWorldNews(
  options: WorldAdapterOptions = {},
): Promise<AdapterResult<WorldNewsItem>> {
  const apiKey = options.apiKey ?? process.env.WORLD_NEWS_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.WORLD_NEWS_BASE_URL;

  if (!apiKey || !baseUrl) {
    return adapterFailure(
      NOT_CONFIGURED("World news provider", "WORLD_NEWS_API_KEY / WORLD_NEWS_BASE_URL"),
    );
  }

  const client =
    options.client ??
    new HttpClient({
      fetchImpl: options.fetchImpl,
      userAgent: "AI-Model-Intelligence-Hub/0.1 (+world-news-adapter)",
    });

  const now = options.now ?? new Date();
  const sourceId = options.sourceId ?? "world-primary-wire";
  const sourceName = options.sourceName ?? "Primary Wire";
  const startedAt = Date.now();

  const items: WorldNewsItem[] = [];
  let skipped = 0;
  let cursor: string | null = null;
  const maxPages = options.maxPages ?? 10;

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const url = `${baseUrl.replace(/\/$/, "")}/world?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const payload = await client.request<unknown>(url, {
        headers: { authorization: `Bearer ${apiKey}` },
      });

      const parsed = worldWireResponseSchema.safeParse(payload);
      if (!parsed.success) {
        return adapterFailure(
          {
            code: "schema",
            message: "World news provider response did not match the expected envelope.",
            retryable: false,
            retryAfterMs: null,
          },
          { items, skipped, requests: client.requests, durationMs: Date.now() - startedAt },
        );
      }

      for (const row of parsed.data.items) {
        const wire = worldWireItemSchema.safeParse(row);
        if (!wire.success) {
          skipped += 1;
          continue;
        }
        const mapped = mapWorldWireItem(wire.data, {
          sourceId,
          sourceName,
          trustTier: options.trustTier ?? 2,
          defaultRegion: options.region ?? "world",
          defaultCategory: options.category ?? "other",
          now,
        });
        if (mapped.item) items.push(mapped.item);
        else skipped += 1;
      }

      cursor = parsed.data.next_cursor ?? null;
      if (!cursor) break;
    }

    return adapterSuccess(items, {
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
      { items, skipped, requests: client.requests, durationMs: Date.now() - startedAt },
    );
  }
}
