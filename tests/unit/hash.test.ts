import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  clusterNewsItems,
  hashPayload,
  jaccard,
  newsContentHash,
  normalizeTitle,
  stableHash,
  stableStringify,
  tokenSet,
} from "@/lib/domain/hash";

describe("stableHash", () => {
  it("is deterministic and 16 characters wide", () => {
    const first = stableHash("hello world");
    expect(first).toBe(stableHash("hello world"));
    expect(first).toHaveLength(16);
  });

  it("separates different inputs", () => {
    expect(stableHash("a")).not.toBe(stableHash("b"));
  });

  it("hashPayload ignores object key order", () => {
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
  });

  it("stableStringify preserves array order", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it("stableStringify drops undefined values", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("canonicalizeUrl", () => {
  it("strips tracking parameters", () => {
    expect(canonicalizeUrl("https://example.com/post?utm_source=x&utm_medium=y&id=42")).toBe(
      "https://example.com/post?id=42",
    );
  });

  it("lowercases the host and removes www", () => {
    expect(canonicalizeUrl("https://WWW.Example.COM/Path")).toBe("https://example.com/Path");
  });

  it("drops the fragment and a trailing slash", () => {
    expect(canonicalizeUrl("https://example.com/a/b/#section")).toBe("https://example.com/a/b");
  });

  it("sorts the remaining query parameters", () => {
    expect(canonicalizeUrl("https://example.com/?b=2&a=1")).toBe("https://example.com/?a=1&b=2");
  });

  it("keeps the root path slash", () => {
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("returns malformed input unchanged instead of throwing", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
  });

  it("collapses two tracking variants of the same story to one canonical URL", () => {
    const a = canonicalizeUrl("https://example.com/news?utm_campaign=launch&fbclid=abc");
    const b = canonicalizeUrl("https://www.example.com/news/?utm_source=newsletter");
    expect(a).toBe(b);
  });
});

describe("normalizeTitle and tokenSet", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeTitle("OpenAI Ships GPT-5.2!  Really?")).toBe("openai ships gpt 5 2 really");
  });

  it("drops very short tokens", () => {
    expect([...tokenSet("a of the model")].sort()).toEqual(["model", "the"]);
  });
});

describe("newsContentHash", () => {
  it("is stable for the same item", () => {
    const input = {
      canonicalUrl: "https://example.com/a",
      title: "Title",
      publishedAt: "2026-09-18T00:00:00.000Z",
    };
    expect(newsContentHash(input)).toBe(newsContentHash(input));
  });

  it("changes when the title changes", () => {
    const base = { canonicalUrl: "https://example.com/a", publishedAt: null };
    expect(newsContentHash({ ...base, title: "One" })).not.toBe(
      newsContentHash({ ...base, title: "Two" }),
    );
  });
});

describe("jaccard", () => {
  it("is 1 for identical sets and 0 for disjoint sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
});

describe("clusterNewsItems", () => {
  const items = [
    {
      id: "official",
      canonicalUrl: "https://openai.com/index/launch",
      title: "OpenAI launches GPT-5.2 model family with lower cached input pricing",
      trustTier: 1 as const,
      publishedAt: "2026-09-18T06:00:00.000Z",
      domain: "news",
    },
    {
      id: "secondary",
      canonicalUrl: "https://example.com/secondary",
      title: "OpenAI launches GPT-5.2 model family with cheaper cached input pricing",
      trustTier: 2 as const,
      publishedAt: "2026-09-18T09:00:00.000Z",
      domain: "news",
    },
    {
      id: "unrelated",
      canonicalUrl: "https://example.com/other",
      title: "Regulator opens a consultation on disclosure duties",
      trustTier: 2 as const,
      publishedAt: "2026-09-18T09:00:00.000Z",
      domain: "news",
    },
  ];

  it("anchors a cluster on the highest-trust item", () => {
    const { assignments } = clusterNewsItems(items);
    expect(assignments.get("official")).toBe("official");
    expect(assignments.get("secondary")).toBe("official");
    expect(assignments.get("unrelated")).toBe("unrelated");
  });

  it("does not cluster items outside the time window", () => {
    const { assignments } = clusterNewsItems(items, { windowHours: 1 });
    expect(assignments.get("secondary")).toBe("secondary");
  });

  it("returns one cluster per anchor and includes the anchor itself", () => {
    const { clusters } = clusterNewsItems(items);
    expect(clusters.get("official")).toEqual(["official", "secondary"]);
  });
});
