import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  feedToNewsItems,
  parseFeed,
  parseFeedDate,
  toPlainText,
} from "@/lib/adapters/rss";
import {
  HttpClient,
  QuotaGuardError,
  RateLimitExceededError,
  parseRetryAfter,
} from "@/lib/adapters/http";
import {
  extractHarnessPage,
  extractPlan,
  canonicalPlanKey,
  type HarnessPageConfig,
  type PlanExtractionConfig,
} from "@/lib/adapters/harness-html";
import type { FetchLike } from "@/lib/adapters/types";
import { HARNESS_PAGE_CONFIGS, hasHarnessConfig } from "@/lib/ingestion/harness-configs";

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example feed</title>
    <item>
      <title>OpenAI ships &amp; documents a new model</title>
      <link>https://example.com/a?utm_source=rss</link>
      <pubDate>Thu, 18 Sep 2026 06:00:00 GMT</pubDate>
      <description><![CDATA[<p>An <strong>excerpt</strong> of the announcement.</p>]]></description>
      <guid>https://example.com/a</guid>
    </item>
    <item>
      <title>Item without a link is skipped</title>
      <description>No link here.</description>
    </item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example atom</title>
  <entry>
    <title>Gemini 3 pricing restated</title>
    <link rel="alternate" href="https://blog.example.com/gemini-3"/>
    <published>2026-09-17T09:30:00Z</published>
    <summary>Cache read pricing was restated across the family.</summary>
    <id>tag:example.com,2026:1</id>
  </entry>
</feed>`;

describe("decodeEntities and toPlainText", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &#8212; &#x2014;")).toBe("a & b <c> — —");
  });

  it("strips markup and collapses whitespace", () => {
    expect(toPlainText("<p>Hello   <b>world</b></p>")).toBe("Hello world");
  });

  it("removes script and style content", () => {
    expect(toPlainText("<script>var a = 1;</script><style>.a{}</style>Text")).toBe("Text");
  });

  it("ignores an out-of-range code point instead of throwing", () => {
    expect(decodeEntities("&#1114112;")).toBe("");
  });
});

describe("parseFeedDate", () => {
  it("parses valid dates to ISO", () => {
    expect(parseFeedDate("Thu, 18 Sep 2026 06:00:00 GMT")).toBe("2026-09-18T06:00:00.000Z");
  });

  it("returns null for unusable values", () => {
    expect(parseFeedDate(null)).toBeNull();
    expect(parseFeedDate("")).toBeNull();
    expect(parseFeedDate("not a date")).toBeNull();
  });
});

describe("parseFeed", () => {
  it("parses RSS 2.0", () => {
    const { kind, entries } = parseFeed(RSS_FIXTURE);
    expect(kind).toBe("rss");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe("OpenAI ships & documents a new model");
    expect(entries[0]?.link).toBe("https://example.com/a?utm_source=rss");
  });

  it("parses Atom and prefers the alternate link", () => {
    const { kind, entries } = parseFeed(ATOM_FIXTURE);
    expect(kind).toBe("atom");
    expect(entries[0]?.link).toBe("https://blog.example.com/gemini-3");
    expect(entries[0]?.publishedAt).toBe("2026-09-17T09:30:00.000Z");
  });

  it("reports an unknown payload instead of pretending it parsed", () => {
    expect(parseFeed("<html><body>not a feed</body></html>").kind).toBe("unknown");
  });
});

describe("feedToNewsItems", () => {
  const meta = {
    sourceId: "openai-blog-rss",
    sourceName: "OpenAI Blog",
    domain: "ai_general" as const,
    category: "other" as const,
    trustTier: 1 as const,
    official: true,
    providerSlugs: ["openai"],
  };

  it("produces canonicalized items with a content hash", () => {
    const result = feedToNewsItems(RSS_FIXTURE, meta, new Date("2026-09-18T12:00:00Z"));
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item?.canonicalUrl).toBe("https://example.com/a");
    expect(item?.contentHash).toHaveLength(16);
    expect(item?.providerIds).toEqual(["provider:openai"]);
    expect(item?.official).toBe(true);
    expect(item?.excerpt).toContain("excerpt");
    // Summaries are never fabricated when no model key is configured.
    expect(item?.summary).toBeNull();
  });

  it("skips malformed entries at parse time rather than emitting them", () => {
    // The second RSS item has no link, so parseFeed drops it before mapping.
    expect(parseFeed(RSS_FIXTURE).entries).toHaveLength(1);

    const result = feedToNewsItems(RSS_FIXTURE, meta, new Date());
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it("fails loudly on a non-feed payload", () => {
    const result = feedToNewsItems("<html></html>", meta, new Date());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("parse");
  });
});

/* -------------------------------------------------------------------------- */
/* HTTP client                                                                 */
/* -------------------------------------------------------------------------- */

function sequenceFetch(
  responses: Array<{ status: number; body?: string; headers?: Record<string, string> }>,
): {
  fetchImpl: FetchLike;
  calls: () => number;
} {
  let index = 0;
  const calls = () => index;
  return {
    calls,
    fetchImpl: async () => {
      const response = responses[Math.min(index, responses.length - 1)]!;
      index += 1;
      const headers = new Map(
        Object.entries(response.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
      );
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
        text: async () => response.body ?? "",
        json: async () => JSON.parse(response.body ?? "null"),
      };
    },
  };
}

describe("parseRetryAfter", () => {
  it("parses a seconds value", () => {
    expect(parseRetryAfter("30")).toBe(30_000);
  });

  it("parses an HTTP date", () => {
    const now = new Date("2026-09-18T12:00:00Z");
    expect(parseRetryAfter("Fri, 18 Sep 2026 12:00:30 GMT", now)).toBe(30_000);
  });

  it("returns null for unusable input", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });
});

describe("HttpClient", () => {
  it("captures rate-limit headers", async () => {
    const stub = sequenceFetch([
      {
        status: 200,
        body: '{"ok":true}',
        headers: { "x-ratelimit-remaining": "42", "x-ratelimit-limit": "100" },
      },
    ]);
    const client = new HttpClient({ fetchImpl: stub.fetchImpl, sleep: async () => undefined });

    await client.request("https://example.com/a");
    expect(client.rateLimit.remaining).toBe(42);
    expect(client.rateLimit.limit).toBe(100);
  });

  it("retries a 429 and then succeeds", async () => {
    const stub = sequenceFetch([
      { status: 429, headers: { "retry-after": "0" } },
      { status: 200, body: '{"ok":true}' },
    ]);
    const client = new HttpClient({ fetchImpl: stub.fetchImpl, sleep: async () => undefined });

    const result = await client.request<{ ok: boolean }>("https://example.com/a");
    expect(result.ok).toBe(true);
    expect(stub.calls()).toBe(2);
  });

  it("gives up after the maximum attempts on persistent 429s", async () => {
    const stub = sequenceFetch([{ status: 429, headers: { "retry-after": "0" } }]);
    const client = new HttpClient({
      fetchImpl: stub.fetchImpl,
      sleep: async () => undefined,
      maxAttempts: 3,
    });

    await expect(client.request("https://example.com/a")).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
    expect(stub.calls()).toBe(3);
  });

  it("retries 5xx responses", async () => {
    const stub = sequenceFetch([{ status: 503 }, { status: 200, body: '{"ok":true}' }]);
    const client = new HttpClient({ fetchImpl: stub.fetchImpl, sleep: async () => undefined });
    await expect(client.request("https://example.com/a")).resolves.toEqual({ ok: true });
  });

  it("refuses to issue a request when the reported quota is too low", async () => {
    const stub = sequenceFetch([
      { status: 200, body: "{}", headers: { "x-ratelimit-remaining": "0" } },
    ]);
    const client = new HttpClient({ fetchImpl: stub.fetchImpl, sleep: async () => undefined });

    await client.request("https://example.com/a");
    await expect(client.request("https://example.com/b")).rejects.toBeInstanceOf(QuotaGuardError);
  });

  it("enforces a hard request cap", async () => {
    const stub = sequenceFetch([{ status: 200, body: "{}" }]);
    const client = new HttpClient({
      fetchImpl: stub.fetchImpl,
      sleep: async () => undefined,
      maxRequests: 1,
    });

    await client.request("https://example.com/a");
    await expect(client.request("https://example.com/b")).rejects.toBeInstanceOf(QuotaGuardError);
  });

  it("surfaces a non-retryable HTTP error", async () => {
    const stub = sequenceFetch([{ status: 404, body: "missing" }]);
    const client = new HttpClient({ fetchImpl: stub.fetchImpl, sleep: async () => undefined });
    await expect(client.request("https://example.com/a")).rejects.toThrow(/404/);
  });
});

/* -------------------------------------------------------------------------- */
/* Harness HTML extraction                                                     */
/* -------------------------------------------------------------------------- */

const FIXTURE_HTML = `
<html><body>
  <section>
    <h2>Go</h2>
    <p>$1 / month</p>
    <p>$10 included credits</p>
    <p>Approximately 15,000 requests per month</p>
  </section>
</body></html>`;

describe("extractPlan", () => {
  const config: PlanExtractionConfig = {
    planKey: "command-code-go",
    planName: "Go",
    required: ["monthlyPriceUsd", "includedCreditsUsd"],
    fields: {
      monthlyPriceUsd: { pattern: /go[^$]{0,40}\$(\d+(?:\.\d+)?)\s*\/\s*month/i, kind: "number" },
      includedCreditsUsd: { pattern: /\$(\d+(?:\.\d+)?)\s*included/i, kind: "number" },
      estimatedRequests: { pattern: /(\d{1,3}(?:,\d{3})+|\d+)\s*requests/i, kind: "number" },
      resetPeriod: { pattern: /(monthly|weekly|daily)/i, kind: "text", fallback: "monthly" },
    },
  };

  it("extracts the declared fields", () => {
    const result = extractPlan(FIXTURE_HTML, config, "https://example.com/pricing");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.snapshot.monthlyPriceUsd).toBe(1);
    expect(result.plan.snapshot.includedCreditsUsd).toBe(10);
    expect(result.plan.snapshot.estimatedRequests).toBe(15000);
    expect(result.plan.snapshot.resetPeriod).toBe("monthly");
    expect(result.plan.snapshot.estimatedRequestsSourceUrl).toBe("https://example.com/pricing");
  });

  it("fails loudly and writes nothing when a required field does not resolve", () => {
    const broken: PlanExtractionConfig = {
      ...config,
      required: ["monthlyPriceUsd", "annualPriceUsd"],
    };
    const result = extractPlan(FIXTURE_HTML, broken, "https://example.com/pricing");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("annualPriceUsd");
    expect(result.reason).toContain("nothing was written");
  });

  it("uses the fallback for a non-required field that does not resolve", () => {
    const result = extractPlan(
      "<html><body>Go $1 / month $10 included</body></html>",
      config,
      "https://x",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.snapshot.estimatedRequests).toBeNull();
    expect(result.plan.snapshot.estimatedRequestsSourceUrl).toBeNull();
  });

  it("never coerces a missing number to zero", () => {
    const result = extractPlan("<html><body>No numbers here</body></html>", config, "https://x");
    expect(result.ok).toBe(false);
  });
});

describe("extractHarnessPage", () => {
  it("succeeds when at least one plan resolves and reports the skipped ones", async () => {
    const config: HarnessPageConfig = {
      sourceId: "fixture",
      configVersion: "test",
      sourceUrl: "https://example.com",
      plans: [
        {
          planKey: "good",
          planName: "Good",
          required: ["monthlyPriceUsd"],
          fields: {
            monthlyPriceUsd: { pattern: /\$(\d+)\s*\/\s*month/i, kind: "number" },
          },
        },
        {
          planKey: "broken",
          planName: "Broken",
          required: ["monthlyPriceUsd"],
          fields: {
            monthlyPriceUsd: { pattern: /never-matches-(\d+)/i, kind: "number" },
          },
        },
      ],
    };

    const result = await extractHarnessPage("<p>$9 / month</p>", config);
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("fails the whole run when no plan resolves", async () => {
    const config: HarnessPageConfig = {
      sourceId: "fixture",
      configVersion: "test",
      sourceUrl: "https://example.com",
      plans: [
        {
          planKey: "broken",
          planName: "Broken",
          required: ["monthlyPriceUsd"],
          fields: {
            monthlyPriceUsd: { pattern: /never-(\d+)/i, kind: "number" },
          },
        },
      ],
    };

    const result = await extractHarnessPage("<p>nothing</p>", config);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("parse");
  });
});

describe("harness extraction configuration coverage", () => {
  it("has a config for every harness pricing source in the registry", () => {
    expect(hasHarnessConfig("command-code-pricing")).toBe(true);
    expect(hasHarnessConfig("opencode-go")).toBe(true);
    expect(hasHarnessConfig("kilo-pricing")).toBe(true);
    expect(hasHarnessConfig("claude-pricing")).toBe(true);
    expect(hasHarnessConfig("freebuff")).toBe(true);
    expect(hasHarnessConfig("cursor-pricing")).toBe(true);
    expect(hasHarnessConfig("windsurf-pricing")).toBe(true);
  });

  it("declares at least one required field per plan", () => {
    for (const config of HARNESS_PAGE_CONFIGS) {
      expect(config.configVersion.length).toBeGreaterThan(0);
      for (const plan of config.plans) {
        expect(plan.required.length).toBeGreaterThan(0);
      }
    }
  });

  it("builds a stable canonical plan key", () => {
    expect(canonicalPlanKey("command-code", "GOAT Plan")).toBe("command-code-goat-plan");
  });
});
