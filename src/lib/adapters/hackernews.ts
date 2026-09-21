/**
 * Hacker News adapter (Algolia search API).
 *
 * Key-less and public. It gives a developer-community signal across AI/LLM
 * discussion without scraping: a story's points and comment count are stored as
 * a social post (points -> likes, comments -> replies, reposts always null).
 */
import { z } from "zod";
import type { MonitoredAccount, SocialPost } from "@/lib/domain/schema";
import { HttpClient } from "./http";
import { adapterFailure, adapterSuccess, type AdapterResult, type FetchLike } from "./types";

export const HACKERNEWS_DEFAULT_BASE = "https://hn.algolia.com/api/v1";

export const hackerNewsHitSchema = z
  .object({
    objectID: z.string(),
    title: z.string().optional().nullable(),
    story_text: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    points: z.number().optional().nullable(),
    num_comments: z.number().optional().nullable(),
    created_at: z.string().optional().nullable(),
    author: z.string().optional().nullable(),
  })
  .passthrough();

export const hackerNewsResponseSchema = z.object({
  hits: z.array(z.unknown()),
});

export type HackerNewsHit = z.infer<typeof hackerNewsHitSchema>;

export function mapHackerNewsHit(raw: HackerNewsHit, account: MonitoredAccount): SocialPost | null {
  const title = raw.title ?? raw.story_text;
  if (!title) return null;

  const publishedAt = raw.created_at;
  const timestamp = publishedAt ? Date.parse(publishedAt) : Number.NaN;
  if (Number.isNaN(timestamp)) return null;

  return {
    id: `social:hackernews:${raw.objectID}`,
    accountId: account.id,
    handle: account.handle,
    displayName: account.displayName,
    platform: "hackernews",
    postId: raw.objectID,
    url: raw.url ?? `https://news.ycombinator.com/item?id=${raw.objectID}`,
    text: title.slice(0, 600),
    publishedAt: new Date(timestamp).toISOString(),
    metrics: {
      likes: raw.points ?? null,
      reposts: null,
      replies: raw.num_comments ?? null,
    },
    entities: [],
    corroborated: false,
  };
}

export interface HackerNewsOptions {
  accounts: MonitoredAccount[];
  query?: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  client?: HttpClient;
  limit?: number;
  now?: Date;
}

export async function fetchHackerNewsPosts(
  options: HackerNewsOptions,
): Promise<AdapterResult<SocialPost>> {
  const account = options.accounts.find(
    (candidate) => candidate.enabled && candidate.platform === "hackernews",
  );
  if (!account) {
    return adapterSuccess<SocialPost>([], { requests: 0 });
  }

  const baseUrl = (options.baseUrl ?? HACKERNEWS_DEFAULT_BASE).replace(/\/$/, "");
  const query = options.query ?? "LLM";
  const limit = options.limit ?? 30;
  const client =
    options.client ??
    new HttpClient({
      fetchImpl: options.fetchImpl,
      userAgent: "AI-Model-Intelligence-Hub/0.1 (+hackernews-adapter)",
    });

  const startedAt = Date.now();
  const posts: SocialPost[] = [];
  let skipped = 0;

  try {
    const url = `${baseUrl}/search_by_date?tags=story&query=${encodeURIComponent(query)}&hitsPerPage=${limit}`;
    const payload = await client.request<unknown>(url);
    const parsed = hackerNewsResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return adapterFailure(
        {
          code: "schema",
          message: "Hacker News response did not match the expected envelope.",
          retryable: false,
          retryAfterMs: null,
        },
        { requests: client.requests, durationMs: Date.now() - startedAt },
      );
    }

    for (const row of parsed.data.hits) {
      const hit = hackerNewsHitSchema.safeParse(row);
      if (!hit.success) {
        skipped += 1;
        continue;
      }
      const mapped = mapHackerNewsHit(hit.data, account);
      if (mapped) posts.push(mapped);
      else skipped += 1;
    }

    return adapterSuccess(posts, {
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
      { items: posts, skipped, requests: client.requests, durationMs: Date.now() - startedAt },
    );
  }
}
