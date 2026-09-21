/**
 * GDELT DOC 2.0 adapter.
 *
 * Free, key-less and never scraped. One query feeds either the AI news workspace
 * (`news_items`, domain `ai_general`) or the isolated World & Politics workspace
 * (`world_news_items`), decided by the source domain. It produces headlines and
 * links only; GDELT supplies no summary, so `summary` is null and the neutrality
 * gate has nothing to police.
 */
import { z } from "zod";
import type { NewsItem, WorldNewsItem } from "@/lib/domain/schema";
import { canonicalizeUrl, newsContentHash, stableHash } from "@/lib/domain/hash";
import { HttpClient } from "./http";
import { adapterFailure, adapterSuccess, type AdapterResult, type FetchLike } from "./types";

export const GDELT_BASE_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

/** Query per source id. Kept explicit so a feed's meaning is not buried in code. */
export const GDELT_QUERY_BY_SOURCE: Record<string, string> = {
  "gdelt-ai-news": '"artificial intelligence" OR LLM OR "language model"',
  "gdelt-world-news": "geopolitics OR election OR diplomacy OR sanctions",
};

export const gdeltArticleSchema = z
  .object({
    url: z.string(),
    title: z.string().optional().nullable(),
    domain: z.string().optional().nullable(),
    seendate: z.string().optional().nullable(),
    sourcecountry: z.string().optional().nullable(),
    language: z.string().optional().nullable(),
  })
  .passthrough();

export const gdeltResponseSchema = z.object({
  articles: z.array(z.unknown()).optional(),
});

export type GdeltRawArticle = z.infer<typeof gdeltArticleSchema>;

export interface GdeltArticle {
  id: string;
  title: string;
  url: string;
  canonicalUrl: string;
  publisher: string;
  publisherCountry: string | null;
  publishedAt: string | null;
}

/** GDELT `seendate` is `YYYYMMDDTHHMMSSZ`; anything else is null, never a guess. */
export function parseGdeltDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export function mapGdeltArticle(raw: GdeltRawArticle): GdeltArticle | null {
  const title = raw.title?.trim();
  if (!title || !raw.url) return null;

  const canonicalUrl = canonicalizeUrl(raw.url);
  return {
    id: stableHash(canonicalUrl),
    title,
    url: raw.url,
    canonicalUrl,
    publisher: raw.domain ?? "Unknown publisher",
    publisherCountry: raw.sourcecountry ?? null,
    publishedAt: parseGdeltDate(raw.seendate),
  };
}

export interface GdeltNewsContext {
  sourceId: string;
  sourceName: string;
  trustTier: NewsItem["trustTier"];
  now: Date;
}

export function gdeltToNewsItem(article: GdeltArticle, context: GdeltNewsContext): NewsItem {
  return {
    id: `news:${context.sourceId}:${article.id}`,
    domain: "ai_general",
    category: "other",
    title: article.title,
    url: article.url,
    canonicalUrl: article.canonicalUrl,
    sourceId: context.sourceId,
    sourceName: article.publisher,
    trustTier: context.trustTier,
    publishedAt: article.publishedAt,
    discoveredAt: context.now.toISOString(),
    excerpt: null,
    summary: null,
    entities: [],
    providerIds: [],
    official: false,
    corroborated: false,
    developing: false,
    contentHash: newsContentHash({
      canonicalUrl: article.canonicalUrl,
      title: article.title,
      publishedAt: article.publishedAt,
    }),
    clusterId: null,
  };
}

export interface GdeltWorldContext {
  sourceId: string;
  sourceName: string;
  trustTier: WorldNewsItem["trustTier"];
  now: Date;
}

export function gdeltToWorldItem(article: GdeltArticle, context: GdeltWorldContext): WorldNewsItem {
  return {
    id: `world:${context.sourceId}:${article.id}`,
    region: "world",
    category: "other",
    headline: article.title,
    summary: null,
    sourceId: context.sourceId,
    sourceName: article.publisher,
    trustTier: context.trustTier,
    url: article.url,
    canonicalUrl: article.canonicalUrl,
    primarySourceUrl: null,
    publishedAt: article.publishedAt,
    eventAt: null,
    discoveredAt: context.now.toISOString(),
    countryCodes: [],
    multipleAccounts: false,
    developing: false,
    contentHash: newsContentHash({
      canonicalUrl: article.canonicalUrl,
      title: article.title,
      publishedAt: article.publishedAt,
    }),
  };
}

export interface GdeltOptions {
  query: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  client?: HttpClient;
  maxRecords?: number;
}

export async function fetchGdeltArticles(
  options: GdeltOptions,
): Promise<AdapterResult<GdeltArticle>> {
  const baseUrl = (options.baseUrl ?? process.env.GDELT_BASE_URL ?? GDELT_BASE_URL).replace(
    /\/$/,
    "",
  );
  const client =
    options.client ??
    new HttpClient({
      fetchImpl: options.fetchImpl,
      userAgent: "AI-Model-Intelligence-Hub/0.1 (+gdelt-adapter)",
    });

  const startedAt = Date.now();
  const collected: GdeltArticle[] = [];
  let skipped = 0;

  try {
    const url =
      `${baseUrl}?query=${encodeURIComponent(options.query)}` +
      `&mode=artlist&format=json&sort=datedesc&maxrecords=${options.maxRecords ?? 50}`;
    const payload = await client.request<unknown>(url);

    const parsed = gdeltResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return adapterFailure(
        {
          code: "schema",
          message: "GDELT response did not match the expected envelope.",
          retryable: false,
          retryAfterMs: null,
        },
        { requests: client.requests, durationMs: Date.now() - startedAt },
      );
    }

    for (const row of parsed.data.articles ?? []) {
      const article = gdeltArticleSchema.safeParse(row);
      if (!article.success) {
        skipped += 1;
        continue;
      }
      const mapped = mapGdeltArticle(article.data);
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
