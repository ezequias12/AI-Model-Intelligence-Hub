/**
 * Bluesky adapter (AT Protocol).
 *
 * The X HTML is never scraped; this is the legal, key-less replacement for the
 * community signal. Most `app.bsky.*` GETs are public and can be called against
 * the AppView with no authentication. For a fixed account list, `getAuthorFeed`
 * is deterministic and does not depend on search ranking.
 */
import { z } from "zod";
import type { MonitoredAccount, SocialPost } from "@/lib/domain/schema";
import { HttpClient } from "./http";
import { extractEntities } from "./entities";
import { adapterFailure, adapterSuccess, type AdapterResult, type FetchLike } from "./types";

export const BLUESKY_PUBLIC_BASE = "https://public.api.bsky.app/xrpc";

const blueskyPostSchema = z
  .object({
    uri: z.string(),
    cid: z.string().optional(),
    author: z
      .object({
        handle: z.string(),
        displayName: z.string().optional().nullable(),
      })
      .partial()
      .optional(),
    record: z
      .object({
        text: z.string().optional(),
        createdAt: z.string().optional(),
      })
      .partial()
      .optional(),
    indexedAt: z.string().optional(),
    likeCount: z.number().optional().nullable(),
    repostCount: z.number().optional().nullable(),
    replyCount: z.number().optional().nullable(),
  })
  .passthrough();

export const blueskyFeedSchema = z.object({
  feed: z.array(z.object({ post: blueskyPostSchema }).passthrough()),
});

export type BlueskyPost = z.infer<typeof blueskyPostSchema>;

export interface BlueskyMappingContext {
  accounts: MonitoredAccount[];
  knownEntities: string[];
}

/** `at://did:plc:xxx/app.bsky.feed.post/3k...` -> `3k...` */
function recordKey(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1] ?? uri;
}

export function mapBlueskyPost(
  post: BlueskyPost,
  context: BlueskyMappingContext,
): SocialPost | null {
  const handle = post.author?.handle;
  if (!handle) return null;

  const account = context.accounts.find(
    (candidate) => candidate.handle.replace("@", "").toLowerCase() === handle.toLowerCase(),
  );
  if (!account) return null;

  const publishedAt = post.record?.createdAt ?? post.indexedAt;
  if (!publishedAt) return null;
  const timestamp = Date.parse(publishedAt);
  if (Number.isNaN(timestamp)) return null;

  const rkey = recordKey(post.uri);
  const text = (post.record?.text ?? "").slice(0, 600);

  return {
    id: `social:bluesky:${rkey}`,
    accountId: account.id,
    handle: `@${handle}`,
    displayName: post.author?.displayName ?? handle,
    platform: "bluesky",
    postId: rkey,
    url: `https://bsky.app/profile/${handle}/post/${rkey}`,
    text,
    publishedAt: new Date(timestamp).toISOString(),
    metrics: {
      likes: post.likeCount ?? null,
      reposts: post.repostCount ?? null,
      replies: post.replyCount ?? null,
    },
    entities: extractEntities(text, context.knownEntities),
    corroborated: false,
  };
}

export interface BlueskyOptions {
  accounts: MonitoredAccount[];
  knownEntities?: string[];
  baseUrl?: string;
  fetchImpl?: FetchLike;
  client?: HttpClient;
  limit?: number;
  maxAccounts?: number;
  now?: Date;
}

export async function fetchBlueskyPosts(
  options: BlueskyOptions,
): Promise<AdapterResult<SocialPost>> {
  const baseUrl = (options.baseUrl ?? BLUESKY_PUBLIC_BASE).replace(/\/$/, "");
  const enabled = options.accounts.filter(
    (account) => account.enabled && account.platform === "bluesky",
  );
  const accounts = enabled.slice(0, options.maxAccounts ?? enabled.length);

  if (accounts.length === 0) {
    return adapterSuccess<SocialPost>([], { requests: 0 });
  }

  const client =
    options.client ??
    new HttpClient({
      fetchImpl: options.fetchImpl,
      userAgent: "AI-Model-Intelligence-Hub/0.1 (+bluesky-adapter)",
      maxRequests: 400,
    });

  const startedAt = Date.now();
  const posts: SocialPost[] = [];
  let skipped = 0;

  for (const account of accounts) {
    const actor = account.handle.replace("@", "");
    const url = `${baseUrl}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${options.limit ?? 30}`;

    try {
      const payload = await client.request<unknown>(url);
      const parsed = blueskyFeedSchema.safeParse(payload);
      if (!parsed.success) {
        skipped += 1;
        continue;
      }

      for (const entry of parsed.data.feed) {
        const mapped = mapBlueskyPost(entry.post, {
          accounts: options.accounts,
          knownEntities: options.knownEntities ?? [],
        });
        if (mapped) posts.push(mapped);
        else skipped += 1;
      }
    } catch (cause) {
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
      skipped += 1;
    }
  }

  return adapterSuccess(posts, {
    skipped,
    rateLimit: client.rateLimit,
    requests: client.requests,
    durationMs: Date.now() - startedAt,
  });
}
