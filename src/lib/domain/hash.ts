/**
 * Stable, dependency-free string hashing and URL canonicalization.
 *
 * The hash is deterministic across processes and platforms so it can be used as
 * a dedupe key and an idempotency component. It is NOT cryptographic and must
 * never be used for security purposes.
 */

/** FNV-1a 32-bit, returned as 8 lowercase hex chars. */
function fnv1a(input: string, seed: number): string {
  let hash = seed;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * 16-character deterministic hash. Two independent FNV passes with different
 * seeds are concatenated to widen the space beyond a single 32-bit value.
 */
export function stableHash(input: string): string {
  const normalized = input.normalize("NFC");
  return fnv1a(normalized, 0x811c9dc5) + fnv1a(normalized, 0x01000193);
}

/** Stable hash of a JSON-serializable value with sorted keys. */
export function hashPayload(payload: unknown): string {
  return stableHash(stableStringify(payload));
}

/** JSON.stringify with object keys sorted, so key order never changes the hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/* -------------------------------------------------------------------------- */
/* URL canonicalization                                                        */
/* -------------------------------------------------------------------------- */

/** Tracking parameters that never change the identity of a story. */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
  "ref_url",
  "source",
  "si",
  "s",
  "spm",
  "trk",
  "_hsenc",
  "_hsmi",
  "at_medium",
  "at_campaign",
]);

/**
 * Canonicalizes a URL: lowercase host, strip tracking params, strip the
 * fragment, drop a trailing slash, sort the remaining params.
 *
 * Returns the original string when it cannot be parsed as a URL, so callers
 * never crash on malformed input from a feed.
 */
export function canonicalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.protocol = url.protocol.toLowerCase();

  const keep: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) keep.push([key, value]);
  });

  keep.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const search = new URLSearchParams();
  for (const [key, value] of keep) search.append(key, value);
  url.search = search.toString();

  let out = url.toString();
  if (out.endsWith("/") && url.pathname !== "/") out = out.slice(0, -1);
  return out;
}

/** Normalized title used for cross-source event clustering. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Content hash for dedupe. Falls back to the canonical URL alone when no title
 * or date is available, which still dedupes exact-URL repeats.
 */
export function newsContentHash(input: {
  canonicalUrl: string;
  title?: string | null;
  publishedAt?: string | null;
}): string {
  const title = normalizeTitle(input.title ?? "");
  const day = input.publishedAt ? input.publishedAt.slice(0, 10) : "";
  return stableHash(`${input.canonicalUrl}|${title}|${day}`);
}

/* -------------------------------------------------------------------------- */
/* Clustering                                                                  */
/* -------------------------------------------------------------------------- */

export interface ClusterableNewsItem {
  id: string;
  canonicalUrl: string;
  title: string;
  trustTier: 1 | 2 | 3;
  publishedAt: string | null;
  domain: string;
}

export interface ClusterResult {
  /** item id -> cluster anchor id (the anchor points to itself). */
  assignments: Map<string, string>;
  clusters: Map<string, string[]>;
}

/**
 * Clusters secondary reports around the same event.
 *
 * Two items join the same cluster when their normalized titles are strongly
 * similar (token Jaccard >= threshold) and they were published within the
 * window. The anchor is the highest-trust item, breaking ties by earliest
 * publication — so the primary source wins.
 */
export function clusterNewsItems(
  items: ClusterableNewsItem[],
  options: { similarityThreshold?: number; windowHours?: number } = {},
): ClusterResult {
  const threshold = options.similarityThreshold ?? 0.6;
  const windowMs = (options.windowHours ?? 72) * 3600 * 1000;

  const clusters = new Map<string, string[]>();
  const assignments = new Map<string, string>();
  const anchors: ClusterableNewsItem[] = [];

  const sorted = [...items].sort((a, b) => {
    if (a.trustTier !== b.trustTier) return a.trustTier - b.trustTier;
    const at = a.publishedAt ? Date.parse(a.publishedAt) : Number.POSITIVE_INFINITY;
    const bt = b.publishedAt ? Date.parse(b.publishedAt) : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  for (const item of sorted) {
    const tokens = tokenSet(item.title);
    const anchor = anchors.find((candidate) => {
      if (candidate.domain !== item.domain && item.domain !== "cross") {
        // Different domains may still report the same event; keep comparing.
      }
      const at = item.publishedAt ? Date.parse(item.publishedAt) : null;
      const bt = candidate.publishedAt ? Date.parse(candidate.publishedAt) : null;
      if (at !== null && bt !== null && Math.abs(at - bt) > windowMs) return false;
      return jaccard(tokens, tokenSet(candidate.title)) >= threshold;
    });

    if (anchor) {
      const list = clusters.get(anchor.id) ?? [anchor.id];
      list.push(item.id);
      clusters.set(anchor.id, list);
      assignments.set(item.id, anchor.id);
    } else {
      anchors.push(item);
      clusters.set(item.id, [item.id]);
      assignments.set(item.id, item.id);
    }
  }

  return { assignments, clusters };
}

export function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeTitle(text)
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
