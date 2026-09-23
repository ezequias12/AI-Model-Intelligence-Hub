import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchArtificialAnalysis,
  mapArtificialAnalysisModel,
  toPersistenceRows,
} from "@/lib/adapters/artificial-analysis";
import { fetchBlueskyPosts } from "@/lib/adapters/bluesky";
import { fetchGdeltArticles } from "@/lib/adapters/gdelt";
import { fetchHackerNewsPosts } from "@/lib/adapters/hackernews";
import { fetchWorldNews, mapWorldWireItem } from "@/lib/adapters/world";
import type { FetchLike } from "@/lib/adapters/types";
import { HttpClient } from "@/lib/adapters/http";
import { fetchHuggingFaceModels } from "@/lib/adapters/huggingface";
import {
  fetchOpenRouterModels,
  toPersistenceRows as openRouterRows,
} from "@/lib/adapters/openrouter";
import { runJob } from "@/lib/ingestion/runner";
import { JOBS } from "@/lib/jobs/registry";
import { buildFixtureMonitoredAccounts } from "@/lib/fixtures/social";

const NOW = new Date("2026-09-18T12:00:00.000Z");

function stubFetch(body: unknown, status = 200): FetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.NEXT_PUBLIC_DATA_MODE = "mock";
  delete process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  delete process.env.WORLD_NEWS_API_KEY;
  delete process.env.WORLD_NEWS_BASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Artificial Analysis contract                                                */
/* -------------------------------------------------------------------------- */

// Captured from a live GET /data/llms/models response on 2026-09-18 and trimmed
// to two rows. The field names, the nested `evaluations` object and the absence
// of a `pagination` block are the real shape; the second row is the malformed
// case the mapper must skip.
const AA_PAYLOAD = {
  status: 200,
  prompt_options: { parallel_queries: 1, prompt_length: "medium" },
  data: [
    {
      id: "3e87c73e-a257-495e-9730-367a66229811",
      name: "Claude Fable 5.1",
      slug: "claude-fable-5-1",
      release_date: "2026-09-01",
      model_creator: {
        id: "f0aa413f-e8ae-4fcd-9c48-0e049f4f3128",
        name: "Anthropic",
        slug: "anthropic",
      },
      evaluations: {
        artificial_analysis_intelligence_index: 53.4,
        artificial_analysis_coding_index: 81.6,
        artificial_analysis_math_index: null,
        gpqa: 0.937,
        hle: 0.591,
        scicode: 0.631,
        tau2: null,
        terminalbench_v2_1: 0.913857677902622,
      },
      pricing: {
        price_1m_blended_3_to_1: 20,
        price_1m_input_tokens: 10,
        price_1m_output_tokens: 50,
      },
      median_output_tokens_per_second: 69.394,
      median_time_to_first_token_seconds: 157.639,
      median_time_to_first_answer_token: 157.639,
      unexpected_future_field: "ignored",
    },
    {
      id: "2",
      // A row without a `name` is not a usable model and must be skipped.
    },
  ],
};

/**
 * The documented free endpoint: same model, but it is the only path that
 * carries the agentic index, the cost per task and the cache prices.
 */
const AA_FREE_PAYLOAD = {
  tier: "free",
  intelligence_index_version: 4.3,
  pagination: { page: 1, page_size: 200, total_pages: 1, has_more: false },
  data: [
    {
      id: "3e87c73e-a257-495e-9730-367a66229811",
      name: "Claude Fable 5.1",
      slug: "claude-fable-5-1",
      release_date: "2026-09-01",
      model_creator: { name: "Anthropic", slug: "anthropic" },
      evaluations: {
        artificial_analysis_intelligence_index: 53.4,
        artificial_analysis_coding_index: 81.6,
        artificial_analysis_agentic_index: 79.5,
      },
      artificial_analysis_intelligence_index_cost: {
        total_cost: 20.69,
        cost_per_task: { total_cost: 0.1678 },
      },
      pricing: {
        price_1m_input_tokens: 10,
        price_1m_output_tokens: 50,
        price_1m_cache_hit_tokens: 0.015,
        price_1m_cache_write_tokens: 0.075,
      },
      performance: {
        median_output_tokens_per_second: 69.394,
        median_time_to_first_token_seconds: 157.639,
      },
    },
  ],
};

/** Routes a stubbed response by endpoint so neither path shadows the other. */
function routeByEndpoint(payloads: { free: unknown; legacy: unknown }): FetchLike {
  return async (url) => {
    const payload = String(url).includes("/language/models/free") ? payloads.free : payloads.legacy;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    };
  };
}

describe("Artificial Analysis adapter", () => {
  it("reports not_configured instead of failing when the key is absent", async () => {
    const result = await fetchArtificialAnalysis({ now: NOW });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
    expect(result.error?.retryable).toBe(false);
  });

  it("maps a payload into domain models and skips unknown rows", async () => {
    const result = await fetchArtificialAnalysis({
      apiKey: "test",
      fetchImpl: routeByEndpoint({ free: AA_FREE_PAYLOAD, legacy: AA_PAYLOAD }),
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(1);

    const mapped = result.items[0]!;
    expect(mapped.model.slug).toBe("claude-fable-5-1");
    expect(mapped.providerSlug).toBe("anthropic");
    expect(mapped.model.metrics.intelligence).toBe(53.4);
    expect(mapped.model.metrics.coding).toBe(81.6);
    expect(mapped.model.metrics.math).toBeNull();
    expect(mapped.model.metrics.inputPricePerMillion).toBe(10);
    expect(mapped.model.metrics.outputPricePerMillion).toBe(50);
    expect(mapped.model.metrics.contextWindow).toBeNull();
    expect(mapped.model.openWeight).toBe(false);
    expect(mapped.model.releaseDate).toBe("2026-09-01");
  });

  it("takes the agentic index, the cost per task and the cache prices from the documented endpoint", async () => {
    const result = await fetchArtificialAnalysis({
      apiKey: "test",
      fetchImpl: routeByEndpoint({ free: AA_FREE_PAYLOAD, legacy: AA_PAYLOAD }),
      now: NOW,
    });

    const metrics = result.items[0]!.model.metrics;
    // Not present on the legacy catalogue endpoint, which is why these sat empty.
    expect(metrics.agentic).toBe(79.5);
    expect(metrics.costPerTaskUsd).toBe(0.1678);
    expect(metrics.cacheReadPricePerMillion).toBe(0.015);
    expect(metrics.cacheWritePricePerMillion).toBe(0.075);
    expect(metrics.outputSpeedTps).toBe(69.394);
  });

  it("never lets a null from either endpoint displace a published value", async () => {
    const result = await fetchArtificialAnalysis({
      apiKey: "test",
      fetchImpl: routeByEndpoint({
        free: AA_FREE_PAYLOAD,
        // The legacy row publishes no agentic index; the merged value must survive.
        legacy: {
          status: 200,
          data: [
            {
              id: "3e87c73e-a257-495e-9730-367a66229811",
              name: "Claude Fable 5.1",
              slug: "claude-fable-5-1",
              model_creator: { name: "Anthropic", slug: "anthropic" },
              evaluations: {
                artificial_analysis_agentic_index: null,
                artificial_analysis_math_index: 88.2,
              },
            },
          ],
        },
      }),
      now: NOW,
    });

    const metrics = result.items[0]!.model.metrics;
    expect(metrics.agentic).toBe(79.5);
    // ...and the legacy endpoint still contributes what only it has.
    expect(metrics.math).toBe(88.2);
  });

  it("reads both endpoints exactly once when neither reports more pages", async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(String(url));
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(AA_PAYLOAD),
        json: async () => AA_PAYLOAD,
      };
    };

    const result = await fetchArtificialAnalysis({ apiKey: "test", fetchImpl, now: NOW });

    expect(result.requests).toBe(2);
    expect(urls).toHaveLength(2);
    expect(urls.some((url) => url.includes("/language/models/free"))).toBe(true);
    expect(urls.some((url) => url.includes("/data/llms/models"))).toBe(true);
    // The singular path serves the site's 404 page; it must never be requested.
    expect(urls.some((url) => url.includes("/data/llm/models"))).toBe(false);
  });

  it("does not re-fetch a full page when the response carries no pagination metadata", async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(String(url));
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(AA_PAYLOAD),
        json: async () => AA_PAYLOAD,
      };
    };

    // pageSize 1 makes the response a "full page" of 2 rows; a loop that trusted
    // the row count alone would keep requesting page 2, 3, ... forever.
    const result = await fetchArtificialAnalysis({
      apiKey: "test",
      fetchImpl,
      now: NOW,
      pageSize: 1,
    });

    // One request per endpoint, and no page 2 for either.
    expect(result.requests).toBe(2);
    expect(urls).toHaveLength(2);
    expect(urls.every((url) => url.includes("page=1"))).toBe(true);
  });

  it("tolerates an unknown extra field without breaking", () => {
    const mapped = mapArtificialAnalysisModel(
      {
        id: "1",
        name: "Model",
        some_new_field: { nested: true },
      } as never,
      NOW.toISOString(),
    );
    expect(mapped.model.metrics.intelligence).toBeNull();
  });

  it("maps missing metrics to null rather than zero", () => {
    const mapped = mapArtificialAnalysisModel({ id: "1", name: "Model" }, NOW.toISOString());
    expect(mapped.model.metrics.coding).toBeNull();
    expect(mapped.model.metrics.inputPricePerMillion).toBeNull();
  });

  it("never guesses a provider group from the payload", () => {
    const result = toPersistenceRows(
      [
        mapArtificialAnalysisModel(
          {
            id: "1",
            name: "Model",
            model_creator: { name: "Some Lab", slug: "some-lab" },
          } as never,
          NOW.toISOString(),
        ),
      ],
      NOW,
    );

    expect(result.providers[0]?.group).toBe("other");
    expect(result.providers[0]?.region).toBeNull();
  });

  it("provides the persistence rows with stable model and provider ids", () => {
    const items = [
      mapArtificialAnalysisModel(
        {
          id: "1",
          slug: "gpt-5-2",
          name: "GPT-5.2",
          model_creator: { name: "OpenAI", slug: "openai" },
        } as never,
        NOW.toISOString(),
      ),
    ];

    const rows = toPersistenceRows(items, NOW);
    expect(rows.providers[0]?.id).toBe("provider:openai");
    expect(rows.snapshots).toHaveLength(1);
    expect(rows.snapshots[0]?.payloadHash.length).toBeGreaterThanOrEqual(16);
  });

  it("refuses to write an empty catalogue over the stored one", async () => {
    const result = await fetchArtificialAnalysis({
      apiKey: "test",
      // A valid envelope that happens to carry no rows. A successful write of it
      // would wipe every stored model, so the adapter fails instead.
      fetchImpl: stubFetch({ status: 200, data: [] }),
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("schema");
    expect(result.error?.message).toContain("no models");
  });

  it("returns a network error when the transport fails", async () => {
    const failing: FetchLike = async () => {
      throw new Error("socket hang up");
    };

    // Injected client keeps the retry backoff out of the test's wall clock.
    const client = new HttpClient({
      fetchImpl: failing,
      sleep: async () => undefined,
      maxAttempts: 1,
    });

    const result = await fetchArtificialAnalysis({ apiKey: "test", client, now: NOW });
    expect(result.ok).toBe(false);
    expect(result.error?.retryable).toBe(true);
  });

  it("classifies a quota-guard refusal as a retryable rate limit, not a transport failure", async () => {
    const client = new HttpClient({
      fetchImpl: async () => {
        throw new Error("the quota guard must refuse before any request is issued");
      },
      sleep: async () => undefined,
    });
    client.rateLimit = { remaining: 0, limit: 100, resetAt: null };

    const result = await fetchArtificialAnalysis({ apiKey: "test", client, now: NOW });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("rate_limited");
    expect(result.error?.message).toContain("Deferred request");
    expect(result.error?.retryable).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Community contract (Bluesky + Hacker News)                                  */
/* -------------------------------------------------------------------------- */

describe("bluesky adapter", () => {
  const accounts = buildFixtureMonitoredAccounts();

  it("issues no request when no Bluesky account is monitored", async () => {
    const calls: string[] = [];
    const spy: FetchLike = async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => "{}",
        json: async () => ({ feed: [] }),
      };
    };

    await fetchBlueskyPosts({ accounts: [], fetchImpl: spy });
    expect(calls).toHaveLength(0);
  });

  it("maps an author-feed entry only when the account is monitored", async () => {
    const payload = {
      feed: [
        {
          post: {
            uri: "at://did:plc:x/app.bsky.feed.post/abc123",
            author: { handle: "openai.bsky.social", displayName: "OpenAI" },
            record: { text: "GPT-5.2 is out", createdAt: "2026-09-18T06:00:00.000Z" },
            indexedAt: "2026-09-18T06:00:01.000Z",
            likeCount: 10,
            repostCount: 2,
            replyCount: 1,
          },
        },
      ],
    };
    const fetchImpl: FetchLike = async (url) => {
      const body = url.includes("openai.bsky.social") ? payload : { feed: [] };
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(body),
        json: async () => body,
      };
    };

    const result = await fetchBlueskyPosts({ accounts, fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ platform: "bluesky", postId: "abc123" });
    expect(result.items[0]?.url).toContain("bsky.app/profile/openai.bsky.social/post/abc123");
  });

  it("drops an entry from an account that is not monitored", async () => {
    const payload = {
      feed: [
        {
          post: {
            uri: "at://did:plc:x/app.bsky.feed.post/zzz",
            author: { handle: "random.bsky.social" },
            record: { text: "hello", createdAt: "2026-09-18T06:00:00.000Z" },
          },
        },
      ],
    };
    const result = await fetchBlueskyPosts({ accounts, fetchImpl: stubFetch(payload) });
    expect(result.items).toHaveLength(0);
  });
});

describe("hacker news adapter", () => {
  const accounts = buildFixtureMonitoredAccounts();

  it("issues no request when no Hacker News account is configured", async () => {
    const calls: string[] = [];
    const spy: FetchLike = async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => "{}",
        json: async () => ({ hits: [] }),
      };
    };

    await fetchHackerNewsPosts({ accounts: [], fetchImpl: spy });
    expect(calls).toHaveLength(0);
  });

  it("maps points as likes and comments as replies, never a repost", async () => {
    const payload = {
      hits: [
        {
          objectID: "1",
          title: "Show HN: local-first agent",
          points: 412,
          num_comments: 138,
          created_at: "2026-09-18T06:00:00.000Z",
        },
      ],
    };

    const result = await fetchHackerNewsPosts({ accounts, fetchImpl: stubFetch(payload) });

    expect(result.ok).toBe(true);
    expect(result.items[0]).toMatchObject({
      platform: "hackernews",
      postId: "1",
      metrics: { likes: 412, reposts: null, replies: 138 },
    });
  });

  it("fails loudly on an unexpected envelope", async () => {
    const result = await fetchHackerNewsPosts({ accounts, fetchImpl: stubFetch({ nope: true }) });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("schema");
  });
});

/* -------------------------------------------------------------------------- */
/* World news contract                                                         */
/* -------------------------------------------------------------------------- */

describe("world news adapter", () => {
  it("reports not_configured without a provider", async () => {
    const result = await fetchWorldNews({ now: NOW });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
  });

  it("drops a non-neutral summary but keeps the attributable item", () => {
    const outcome = mapWorldWireItem(
      {
        id: "1",
        headline: "Agency publishes monthly figure",
        summary: "We endorse this candidate and you should vote for them.",
        url: "https://example.com/a?utm_source=wire",
      },
      {
        sourceId: "world-primary-wire",
        sourceName: "Primary Wire",
        trustTier: 2,
        defaultRegion: "world",
        defaultCategory: "other",
        now: NOW,
      },
    );

    expect(outcome.item).not.toBeNull();
    expect(outcome.item?.summary).toBeNull();
    expect(outcome.dropped).toContain("Non-neutral summary dropped");
    expect(outcome.item?.canonicalUrl).toBe("https://example.com/a");
  });

  it("keeps a neutral summary and flags contested stories", () => {
    const outcome = mapWorldWireItem(
      {
        id: "2",
        headline: "Two governments announce reviews",
        summary: "Each government published its own announcement.",
        url: "https://example.com/b",
        disputed: true,
        regions: ["geopolitics"],
        country_codes: ["us", "cn"],
      },
      {
        sourceId: "world-primary-wire",
        sourceName: "Primary Wire",
        trustTier: 2,
        defaultRegion: "world",
        defaultCategory: "other",
        now: NOW,
      },
    );

    expect(outcome.item?.summary).toBe("Each government published its own announcement.");
    expect(outcome.item?.multipleAccounts).toBe(true);
    expect(outcome.item?.region).toBe("geopolitics");
    expect(outcome.item?.countryCodes).toEqual(["US", "CN"]);
  });

  it("normalises an unusable date to null", () => {
    const outcome = mapWorldWireItem(
      { id: "3", headline: "Headline", url: "https://example.com/c", published_at: "whenever" },
      {
        sourceId: "world-primary-wire",
        sourceName: "Primary Wire",
        trustTier: 2,
        defaultRegion: "world",
        defaultCategory: "other",
        now: NOW,
      },
    );
    expect(outcome.item?.publishedAt).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* OpenRouter contract                                                         */
/* -------------------------------------------------------------------------- */

const OPENROUTER_PAYLOAD = {
  data: [
    {
      id: "openai/gpt-4o",
      name: "OpenAI: GPT-4o",
      context_length: 128000,
      pricing: { prompt: "0.0000025", completion: "0.00001" },
    },
    { id: "no-author-segment" },
  ],
};

describe("openrouter adapter", () => {
  it("maps the catalogue without a key and skips an unusable row", async () => {
    const result = await fetchOpenRouterModels({
      fetchImpl: stubFetch(OPENROUTER_PAYLOAD),
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(1);

    const rows = openRouterRows(result.items);
    expect(rows.providers[0]?.id).toBe("provider:openai");
    expect(rows.models[0]?.slug).toBe("gpt-4o");
    expect(rows.models[0]?.metrics.contextWindow).toBe(128000);
  });

  it("fails loudly on an unexpected envelope", async () => {
    const result = await fetchOpenRouterModels({
      fetchImpl: stubFetch({ nope: true }),
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("schema");
  });
});

/* -------------------------------------------------------------------------- */
/* Hugging Face contract                                                       */
/* -------------------------------------------------------------------------- */

const HF_PAYLOAD = [
  { id: "meta-llama/Llama-3.1-8B", downloads: 12345, likes: 678 },
  { id: "someone/unknown-model", downloads: 3, likes: 1 },
];

describe("hugging face adapter", () => {
  it("reads popularity with no key", async () => {
    const result = await fetchHuggingFaceModels({ fetchImpl: stubFetch(HF_PAYLOAD) });
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ slug: "llama-3-1-8b", downloads: 12345 });
  });

  it("fails loudly when the payload is not an array", async () => {
    const result = await fetchHuggingFaceModels({ fetchImpl: stubFetch({ models: [] }) });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("schema");
  });
});

/* -------------------------------------------------------------------------- */
/* GDELT contract                                                              */
/* -------------------------------------------------------------------------- */

describe("gdelt adapter", () => {
  it("maps articles, canonicalizes urls and skips a row with no title", async () => {
    const payload = {
      articles: [
        {
          url: "https://example.com/a?utm_source=wire",
          title: "AI news",
          domain: "example.com",
          seendate: "20260918T120000Z",
        },
        { url: "https://example.com/b" },
      ],
    };

    const result = await fetchGdeltArticles({ query: "test", fetchImpl: stubFetch(payload) });

    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.items[0]?.canonicalUrl).toBe("https://example.com/a");
  });

  it("treats a response with no articles as a valid empty result", async () => {
    const result = await fetchGdeltArticles({ query: "test", fetchImpl: stubFetch({}) });
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Job runner                                                                  */
/* -------------------------------------------------------------------------- */

describe("job runner", () => {
  it("reports an unknown job key instead of silently succeeding", async () => {
    const result = await runJob("not-a-job", { now: NOW });
    expect(result.totals.failed).toBe(1);
    expect(result.outcomes[0]?.message).toContain("Unknown job key");
  });

  it("defers every source in mock mode and never claims a write", async () => {
    const result = await runJob("sync-models", { now: NOW });
    expect(result.dataMode).toBe("mock");
    expect(result.totals.written).toBe(0);
    expect(result.outcomes.length).toBeGreaterThan(0);
    for (const outcome of result.outcomes) {
      expect(["deferred", "disabled"]).toContain(outcome.outcome);
      if (outcome.outcome === "deferred") {
        expect(outcome.message).toContain("Mock mode");
      }
    }
  });

  it("marks a disabled source as disabled rather than failed", async () => {
    const result = await runJob("sync-world-news", { now: NOW });
    const outcome = result.outcomes.find((entry) => entry.sourceId === "world-primary-wire");
    expect(outcome?.outcome).toBe("disabled");
    expect(outcome?.enabled).toBe(false);
  });

  it("never reports a write while Supabase is unconfigured", async () => {
    for (const job of JOBS) {
      const result = await runJob(job.key, { now: NOW });
      expect(result.totals.written).toBe(0);
    }
  });

  it("is idempotent for a repeated run at the same timestamp", async () => {
    const first = await runJob("sync-models", { now: NOW });
    const second = await runJob("sync-models", { now: NOW });
    expect(first.outcomes).toEqual(second.outcomes);
    expect(first.totals).toEqual(second.totals);
  });

  it("exposes a live-mode-eligible source set for each job", async () => {
    const result = await runJob("sync-ai-news", { now: NOW });
    expect(result.outcomes.length).toBeGreaterThan(3);
  });
});
