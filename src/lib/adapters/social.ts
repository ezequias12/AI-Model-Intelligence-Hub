/**
 * Social (X) adapter contract.
 *
 * Policy: X HTML is never scraped as the foundation. Until an authorized API
 * token is configured the adapter reports `not_configured` and the UI shows the
 * fixture/mock state explicitly rather than fabricating posts.
 *
 * The adapter is written against the documented v2 endpoints and is fully
 * testable with an injected fetch.
 */
import { z } from "zod";
import type { MonitoredAccount, SocialPost } from "@/lib/domain/schema";
import { HttpClient } from "./http";
import {
  adapterFailure,
  adapterSuccess,
  NOT_CONFIGURED,
  type AdapterResult,
  type FetchLike,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Raw payload schema (X API v2 shape)                                         */
/* -------------------------------------------------------------------------- */

export const xPostSchema = z.object({
  id: z.string(),
  text: z.string(),
  author_id: z.string().optional(),
  created_at: z.string().optional(),
  public_metrics: z
    .object({
      like_count: z.number().optional(),
      retweet_count: z.number().optional(),
      reply_count: z.number().optional(),
      impression_count: z.number().optional(),
    })
    .partial()
    .optional(),
});

export const xUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
});

export const xTimelineResponseSchema = z.object({
  data: z.array(xPostSchema).optional(),
  includes: z
    .object({ users: z.array(xUserSchema).optional() })
    .partial()
    .optional(),
  meta: z.object({ next_token: z.string().optional() }).partial().optional(),
});

export type XPost = z.infer<typeof xPostSchema>;

/* -------------------------------------------------------------------------- */
/* Mapping                                                                     */
/* -------------------------------------------------------------------------- */

export interface SocialMappingContext {
  accounts: MonitoredAccount[];
  /** Entity extraction is intentionally conservative: only exact known terms. */
  knownEntities: string[];
}

/** `@handle` / `#tag` / known model names become entities. Conservative on purpose. */
export function extractEntities(text: string, knownEntities: string[]): string[] {
  const found = new Set<string>();

  for (const match of text.matchAll(/[@#]([A-Za-z0-9_]{2,30})/g)) {
    if (match[1]) found.add(match[0]);
  }
  for (const entity of knownEntities) {
    if (entity.length < 3) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(entity)}\\b`, "i");
    if (pattern.test(text)) found.add(entity);
  }

  return [...found];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mapXPost(
  post: XPost,
  user: { username: string; name: string } | null,
  context: SocialMappingContext,
): SocialPost | null {
  if (!user) return null;

  const account = context.accounts.find(
    (candidate) => candidate.handle.replace("@", "").toLowerCase() === user.username.toLowerCase(),
  );
  if (!account) return null;

  const publishedAt = post.created_at ? new Date(Date.parse(post.created_at)).toISOString() : null;
  if (!publishedAt) return null;

  const metrics = post.public_metrics;

  return {
    id: `social:${post.id}`,
    accountId: account.id,
    handle: `@${user.username}`,
    displayName: user.name,
    platform: "x",
    postId: post.id,
    url: `https://x.com/${user.username}/status/${post.id}`,
    text: post.text.slice(0, 600),
    publishedAt,
    metrics: metrics
      ? {
          likes: metrics.like_count ?? null,
          reposts: metrics.retweet_count ?? null,
          replies: metrics.reply_count ?? null,
        }
      : null,
    entities: extractEntities(post.text, context.knownEntities),
    corroborated: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Adapter                                                                     */
/* -------------------------------------------------------------------------- */

export interface SocialAdapterOptions {
  bearerToken?: string;
  accounts: MonitoredAccount[];
  knownEntities?: string[];
  fetchImpl?: FetchLike;
  client?: HttpClient;
  maxAccounts?: number;
  now?: Date;
}

export async function fetchSocialPosts(
  options: SocialAdapterOptions,
): Promise<AdapterResult<SocialPost>> {
  const token = options.bearerToken ?? process.env.X_BEARER_TOKEN;
  if (!token) {
    return adapterFailure(NOT_CONFIGURED("X / social API", "X_BEARER_TOKEN"));
  }

  const enabled = options.accounts.filter((account) => account.enabled && account.platform === "x");
  const accounts = enabled.slice(0, options.maxAccounts ?? enabled.length);

  if (accounts.length === 0) {
    return adapterSuccess<SocialPost>([], { requests: 0 });
  }

  const client =
    options.client ??
    new HttpClient({
      fetchImpl: options.fetchImpl,
      userAgent: "AI-Model-Intelligence-Hub/0.1 (+social-adapter)",
      maxRequests: 400,
    });

  const startedAt = Date.now();
  const posts: SocialPost[] = [];
  let skipped = 0;

  for (const account of accounts) {
    const username = account.handle.replace("@", "");
    const url =
      `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}` +
      `?user.fields=name,username`;

    try {
      const userPayload = await client.request<unknown>(url, {
        headers: { authorization: `Bearer ${token}` },
      });
      const userParsed = z.object({ data: xUserSchema.optional() }).safeParse(userPayload);
      const user = userParsed.success ? (userParsed.data.data ?? null) : null;
      if (!user) {
        skipped += 1;
        continue;
      }

      const timelineUrl =
        `https://api.x.com/2/users/${user.id}/tweets` +
        `?max_results=25&tweet.fields=created_at,public_metrics,author_id`;

      const timelinePayload = await client.request<unknown>(timelineUrl, {
        headers: { authorization: `Bearer ${token}` },
      });
      const timeline = xTimelineResponseSchema.safeParse(timelinePayload);
      if (!timeline.success) {
        skipped += 1;
        continue;
      }

      for (const post of timeline.data.data ?? []) {
        const mapped = mapXPost(post, user, {
          accounts: options.accounts,
          knownEntities: options.knownEntities ?? [],
        });
        if (mapped) posts.push(mapped);
        else skipped += 1;
      }
    } catch (cause) {
      skipped += 1;
      const message = cause instanceof Error ? cause.message : String(cause);
      if (/rate limited/i.test(message)) {
        return adapterFailure(
          { code: "rate_limited", message, retryable: true, retryAfterMs: null },
          {
            items: posts,
            skipped,
            rateLimit: client.rateLimit,
            requests: client.requests,
            durationMs: Date.now() - startedAt,
          },
        );
      }
    }
  }

  return adapterSuccess(posts, {
    skipped,
    rateLimit: client.rateLimit,
    requests: client.requests,
    durationMs: Date.now() - startedAt,
  });
}
