/**
 * RSS 2.0 / Atom parser.
 *
 * Dependency-free on purpose: the shapes we consume are narrow (title, link,
 * date, summary, id) and a small, well-tested parser is easier to reason about
 * than a general XML engine. It is strict about structure and tolerant about
 * content: a feed that cannot be parsed yields a `parse` error rather than a
 * silent empty success.
 */
import type { NewsItem } from "@/lib/domain/schema";
import { canonicalizeUrl, newsContentHash } from "@/lib/domain/hash";
import { adapterFailure, adapterSuccess, type AdapterResult } from "./types";

export interface FeedSourceMeta {
  sourceId: string;
  sourceName: string;
  domain: NewsItem["domain"];
  category: NewsItem["category"];
  trustTier: NewsItem["trustTier"];
  official: boolean;
  /** Provider slugs to attach to every item from this feed, when unambiguous. */
  providerSlugs?: string[];
}

export interface ParsedFeedEntry {
  title: string;
  link: string;
  publishedAt: string | null;
  summary: string | null;
  guid: string | null;
  author: string | null;
}

/* -------------------------------------------------------------------------- */
/* Low-level helpers                                                           */
/* -------------------------------------------------------------------------- */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => ENTITIES[name] ?? match);
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function stripCdata(value: string): string {
  return value.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
}

/** Removes markup and collapses whitespace, for excerpt fields. */
export function toPlainText(html: string): string {
  return decodeEntities(stripCdata(html))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Finds the first `<tag>...</tag>` block, ignoring namespaced variants. */
function firstTag(block: string, tag: string): string | null {
  const pattern = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${tag}>`,
    "i",
  );
  const match = pattern.exec(block);
  return match?.[1] === undefined ? null : match[1];
}

/** Atom links carry the URL in an attribute rather than the element body. */
function atomLink(block: string): string | null {
  const alternate = /<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i.exec(block);
  if (alternate?.[1]) return decodeEntities(alternate[1]);

  const anyLink = /<link\b[^>]*\bhref=["']([^"']+)["']/i.exec(block);
  if (anyLink?.[1]) return decodeEntities(anyLink[1]);

  return null;
}

function firstTagAll(block: string, tag: string): string[] {
  const pattern = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${tag}>`,
    "gi",
  );
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block)) !== null) {
    if (match[1] !== undefined) out.push(match[1]);
  }
  return out;
}

/** Parses a feed date, returning null when the value is unusable. */
export function parseFeedDate(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = toPlainText(raw);
  if (cleaned.length === 0) return null;
  const timestamp = Date.parse(cleaned);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

/* -------------------------------------------------------------------------- */
/* Feed parsing                                                                */
/* -------------------------------------------------------------------------- */

export function parseFeed(xml: string): {
  kind: "rss" | "atom" | "unknown";
  entries: ParsedFeedEntry[];
} {
  const isAtom =
    /<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml) ||
    /<entry\b/i.test(xml);
  const isRss = /<rss\b/i.test(xml) || /<channel\b/i.test(xml);

  if (!isAtom && !isRss) return { kind: "unknown", entries: [] };

  const entries: ParsedFeedEntry[] = [];

  if (isAtom) {
    for (const block of firstTagAll(xml, "entry")) {
      const title = firstTag(block, "title");
      const link = atomLink(block) ?? firstTag(block, "id");
      if (!title || !link) continue;
      entries.push({
        title: toPlainText(title),
        link: toPlainText(link),
        publishedAt: parseFeedDate(firstTag(block, "published") ?? firstTag(block, "updated")),
        summary: summarize(firstTag(block, "summary") ?? firstTag(block, "content")),
        guid: firstTag(block, "id") ? toPlainText(firstTag(block, "id") as string) : null,
        author: firstTag(block, "name") ? toPlainText(firstTag(block, "name") as string) : null,
      });
    }
    return { kind: "atom", entries };
  }

  for (const block of firstTagAll(xml, "item")) {
    const title = firstTag(block, "title");
    const link = firstTag(block, "link") ?? firstTag(block, "guid");
    if (!title || !link) continue;
    entries.push({
      title: toPlainText(title),
      link: toPlainText(link),
      publishedAt: parseFeedDate(firstTag(block, "pubDate") ?? firstTag(block, "dc:date")),
      summary: summarize(firstTag(block, "description") ?? firstTag(block, "summary")),
      guid: firstTag(block, "guid") ? toPlainText(firstTag(block, "guid") as string) : null,
      author: firstTag(block, "author") ? toPlainText(firstTag(block, "author") as string) : null,
    });
  }

  return { kind: "rss", entries };
}

function summarize(raw: string | null, maxLength = 320): string | null {
  if (!raw) return null;
  const text = toPlainText(raw);
  if (text.length === 0) return null;
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Converts a feed payload into domain news items.
 *
 * Excerpt only — full articles are never mirrored. When a summary is missing we
 * store the excerpt, and when the LLM summariser is unavailable the UI degrades
 * to the excerpt rather than inventing text.
 */
export function feedToNewsItems(
  xml: string,
  meta: FeedSourceMeta,
  now: Date,
): AdapterResult<Omit<NewsItem, "id" | "clusterId">> {
  const startedAt = Date.now();
  const { kind, entries } = parseFeed(xml);

  if (kind === "unknown") {
    return adapterFailure(
      {
        code: "parse",
        message: "Payload is neither an RSS nor an Atom feed.",
        retryable: false,
        retryAfterMs: null,
      },
      { durationMs: Date.now() - startedAt },
    );
  }

  const items: Array<Omit<NewsItem, "id" | "clusterId">> = [];
  let skipped = 0;

  for (const entry of entries) {
    if (entry.link.length === 0 || entry.title.length === 0) {
      skipped += 1;
      continue;
    }

    const canonicalUrl = canonicalizeUrl(entry.link);
    items.push({
      domain: meta.domain,
      category: meta.category,
      title: entry.title,
      url: entry.link,
      canonicalUrl,
      sourceId: meta.sourceId,
      sourceName: meta.sourceName,
      trustTier: meta.trustTier,
      publishedAt: entry.publishedAt,
      discoveredAt: now.toISOString(),
      excerpt: entry.summary,
      summary: null,
      entities: [],
      providerIds: (meta.providerSlugs ?? []).map((slug) => `provider:${slug}`),
      official: meta.official,
      corroborated: false,
      developing: false,
      contentHash: newsContentHash({
        canonicalUrl,
        title: entry.title,
        publishedAt: entry.publishedAt,
      }),
    });
  }

  return adapterSuccess(items, {
    skipped,
    requests: 1,
    durationMs: Date.now() - startedAt,
    payloadHash: newsContentHash({
      canonicalUrl: `${meta.sourceId}:feed`,
      title: `n=${items.length}`,
    }),
  });
}

/** Detects feeds that look identical to a previous payload (no new items). */
export function isUnchangedFeed(previousHash: string | null, currentHash: string | null): boolean {
  return previousHash !== null && currentHash !== null && previousHash === currentHash;
}
