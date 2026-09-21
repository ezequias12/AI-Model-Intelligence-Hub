import { describe, expect, it } from "vitest";
import {
  gdeltArticleSchema,
  gdeltToNewsItem,
  gdeltToWorldItem,
  mapGdeltArticle,
  parseGdeltDate,
} from "@/lib/adapters/gdelt";

const NOW = new Date("2026-09-18T12:00:00.000Z");

function article(input: Record<string, unknown>) {
  return gdeltArticleSchema.parse(input);
}

describe("parseGdeltDate", () => {
  it("parses the GDELT seendate format", () => {
    expect(parseGdeltDate("20260918T120000Z")).toBe("2026-09-18T12:00:00.000Z");
  });

  it("returns null for an unusable value rather than inventing a date", () => {
    expect(parseGdeltDate("whenever")).toBeNull();
    expect(parseGdeltDate(null)).toBeNull();
    expect(parseGdeltDate(undefined)).toBeNull();
  });
});

describe("mapGdeltArticle", () => {
  it("canonicalizes the url and reads the publisher and date", () => {
    const mapped = mapGdeltArticle(
      article({
        url: "https://example.com/a?utm_source=wire",
        title: "A headline",
        domain: "example.com",
        seendate: "20260918T120000Z",
      }),
    );

    expect(mapped?.canonicalUrl).toBe("https://example.com/a");
    expect(mapped?.publisher).toBe("example.com");
    expect(mapped?.publishedAt).toBe("2026-09-18T12:00:00.000Z");
  });

  it("drops a row with no title", () => {
    expect(mapGdeltArticle(article({ url: "https://example.com/a" }))).toBeNull();
  });
});

describe("gdelt item builders", () => {
  const mapped = mapGdeltArticle(
    article({
      url: "https://example.com/a",
      title: "Headline",
      domain: "example.com",
      seendate: "20260918T120000Z",
    }),
  )!;

  it("builds an ai_general news item with no fabricated summary", () => {
    const item = gdeltToNewsItem(mapped, {
      sourceId: "gdelt-ai-news",
      sourceName: "GDELT",
      trustTier: 2,
      now: NOW,
    });

    expect(item.domain).toBe("ai_general");
    expect(item.category).toBe("other");
    expect(item.summary).toBeNull();
    expect(item.sourceName).toBe("example.com");
    expect(item.discoveredAt).toBe(NOW.toISOString());
  });

  it("builds an isolated world item with no country guess", () => {
    const item = gdeltToWorldItem(mapped, {
      sourceId: "gdelt-world-news",
      sourceName: "GDELT",
      trustTier: 1,
      now: NOW,
    });

    expect(item.region).toBe("world");
    expect(item.summary).toBeNull();
    expect(item.countryCodes).toEqual([]);
    expect(item.multipleAccounts).toBe(false);
  });
});
