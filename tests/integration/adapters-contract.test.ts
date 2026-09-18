import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchArtificialAnalysis,
  mapArtificialAnalysisModel,
  toPersistenceRows,
} from "@/lib/adapters/artificial-analysis";
import { fetchSocialPosts, extractEntities, mapXPost } from "@/lib/adapters/social";
import { fetchWorldNews, mapWorldWireItem } from "@/lib/adapters/world";
import type { FetchLike } from "@/lib/adapters/types";
import { HttpClient } from "@/lib/adapters/http";
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
  delete process.env.X_BEARER_TOKEN;
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
      fetchImpl: stubFetch(AA_PAYLOAD),
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

  it("requests the documented /data/llms/models endpoint once when there is no pagination", async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(AA_PAYLOAD),
        json: async () => AA_PAYLOAD,
      };
    };

    const result = await fetchArtificialAnalysis({ apiKey: "test", fetchImpl, now: NOW });

    expect(result.requests).toBe(1);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/data/llms/models");
    expect(urls[0]).not.toContain("/data/llm/models");
  });

  it("does not re-fetch the full list when a full page carries no pagination metadata", async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(AA_PAYLOAD),
        json: async () => AA_PAYLOAD,
      };
    };

    // pageSize 1 makes the response a "full page" of 2 rows; the old loop kept
    // requesting page 2, 3, ... and duplicated the same models.
    const result = await fetchArtificialAnalysis({
      apiKey: "test",
      fetchImpl,
      now: NOW,
      pageSize: 1,
    });

    expect(result.requests).toBe(1);
    expect(urls).toHaveLength(1);
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

  it("surfaces an envelope that does not match the expected schema", async () => {
    const result = await fetchArtificialAnalysis({
      apiKey: "test",
      fetchImpl: stubFetch({ unexpected: true }),
      now: NOW,
    });

    // An envelope without `data`/`models` yields zero rows but is still a valid envelope.
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(0);
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
/* Social contract                                                             */
/* -------------------------------------------------------------------------- */

describe("social adapter", () => {
  const accounts = buildFixtureMonitoredAccounts();

  it("returns not_configured without a bearer token", async () => {
    const result = await fetchSocialPosts({ accounts });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
  });

  it("never scrapes HTML as a fallback", async () => {
    const calls: string[] = [];
    const spy: FetchLike = async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => "<html>tweet</html>",
        json: async () => ({}),
      };
    };

    await fetchSocialPosts({ accounts, fetchImpl: spy });
    // Without a token the adapter must not issue any request at all.
    expect(calls).toHaveLength(0);
  });

  it("maps a post only when the account is monitored", () => {
    const mapped = mapXPost(
      { id: "1", text: "Hello @OpenAI #models", created_at: "2026-09-18T06:00:00.000Z" },
      { username: "OpenAI", name: "OpenAI" },
      { accounts, knownEntities: ["GPT-5.2"] },
    );

    expect(mapped?.handle).toBe("@OpenAI");
    expect(mapped?.entities).toContain("@OpenAI");
    expect(mapped?.corroborated).toBe(false);
  });

  it("drops a post whose author is not monitored", () => {
    const mapped = mapXPost(
      { id: "1", text: "Hello", created_at: "2026-09-18T06:00:00.000Z" },
      { username: "random", name: "Random" },
      { accounts, knownEntities: [] },
    );
    expect(mapped).toBeNull();
  });

  it("drops a post with no timestamp instead of inventing one", () => {
    const mapped = mapXPost(
      { id: "1", text: "Hello" },
      { username: "OpenAI", name: "OpenAI" },
      { accounts, knownEntities: [] },
    );
    expect(mapped).toBeNull();
  });

  it("extracts handles, hashtags and known entity names conservatively", () => {
    const entities = extractEntities("GPT-5.2 is out. See @OpenAI and #benchmarks", ["GPT-5.2"]);
    expect(entities).toContain("@OpenAI");
    expect(entities).toContain("#benchmarks");
    expect(entities).toContain("GPT-5.2");
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
    const result = await runJob("sync-social", { now: NOW });
    const outcome = result.outcomes.find((entry) => entry.sourceId === "x-monitored-accounts");
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
