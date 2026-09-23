import { describe, expect, it } from "vitest";
import {
  mapHuggingFaceModel,
  applyPopularity,
  huggingFaceModelSchema,
} from "@/lib/adapters/huggingface";
import {
  mapOpenRouterModel,
  openRouterModelSchema,
  toPersistenceRows,
} from "@/lib/adapters/openrouter";
import { normalizeAuthorSlug, normalizeModelSlug } from "@/lib/adapters/model-identity";
import { mergeModelSources, mergeProviders } from "@/lib/ingestion/merge-models";
import type { Model, ModelMetrics, Provider } from "@/lib/domain/schema";

const NOW = "2026-09-18T12:00:00.000Z";

function metrics(input: Partial<ModelMetrics> = {}): ModelMetrics {
  return {
    intelligence: null,
    coding: null,
    agentic: null,
    math: null,
    outputSpeedTps: null,
    ttftSeconds: null,
    inputPricePerMillion: null,
    outputPricePerMillion: null,
    cacheReadPricePerMillion: null,
    cacheWritePricePerMillion: null,
    contextWindow: null,
    costPerTaskUsd: null,
    answerTokensPerTask: null,
    reasoningTokensPerTask: null,
    hfDownloads: null,
    hfLikes: null,
    ...input,
  };
}

function model(overrides: Partial<Model> = {}): Model {
  return {
    id: "model:gpt-5-2",
    slug: "gpt-5-2",
    name: "GPT-5.2",
    shortName: "GPT-5.2",
    providerId: "provider:openai",
    releaseDate: NOW,
    deprecatedAt: null,
    openWeight: false,
    description: "primary",
    officialUrl: null,
    metrics: metrics({ intelligence: 72, inputPricePerMillion: 1.75 }),
    sourceId: "artificial-analysis-api",
    sourceVersion: null,
    lastRefreshedAt: NOW,
    ...overrides,
  };
}

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "provider:openai",
    slug: "openai",
    name: "OpenAI",
    domain: "openai.com",
    countryCode: "US",
    region: "United States",
    group: "mainstream_global",
    logoUrl: null,
    color: "#10a37f",
    active: true,
    sourceId: "internal:provider-registry",
    updatedAt: NOW,
    ...overrides,
  };
}

describe("model identity", () => {
  it("normalises author/model ids to a kebab-case slug", () => {
    expect(normalizeModelSlug("openai/gpt-4o")).toBe("gpt-4o");
    expect(normalizeModelSlug("meta-llama/Llama-3.1-8B")).toBe("llama-3-1-8b");
    expect(normalizeModelSlug("openai/gpt-4o:free")).toBe("gpt-4o");
    expect(normalizeModelSlug("gpt-5-2")).toBe("gpt-5-2");
  });

  it("extracts the author segment only when one is present", () => {
    expect(normalizeAuthorSlug("meta-llama/Llama-3.1-8B")).toBe("meta-llama");
    expect(normalizeAuthorSlug("gpt-5-2")).toBeNull();
  });
});

describe("mergeModelSources", () => {
  it("fills nulls from the incoming source without overwriting measured values", () => {
    const existing = model();
    const incoming = model({
      sourceId: "openrouter-models",
      providerId: "provider:openai",
      description: null,
      metrics: metrics({ contextWindow: 128_000, inputPricePerMillion: 99 }),
    });

    const [merged] = mergeModelSources([existing], [incoming]);

    expect(merged?.metrics.intelligence).toBe(72); // AA value kept
    expect(merged?.metrics.inputPricePerMillion).toBe(1.75); // never overwritten
    expect(merged?.metrics.contextWindow).toBe(128_000); // filled from OpenRouter
    expect(merged?.sourceId).toBe("artificial-analysis-api"); // identity preserved
  });

  it("keeps popularity when another source reports null", () => {
    const existing = model({ metrics: metrics({ hfDownloads: 500_000, hfLikes: 900 }) });
    const incoming = model({ sourceId: "artificial-analysis-api", metrics: metrics() });

    const [merged] = mergeModelSources([existing], [incoming]);

    expect(merged?.metrics.hfDownloads).toBe(500_000);
    expect(merged?.metrics.hfLikes).toBe(900);
  });

  it("inserts a model it has never seen", () => {
    const merged = mergeModelSources([], [model({ id: "model:new", slug: "new" })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("model:new");
  });
});

describe("mergeProviders", () => {
  it("preserves curated grouping, region and colour over an inferred `other`", () => {
    const curated = provider();
    const inferred = provider({
      group: "other",
      region: null,
      countryCode: null,
      color: null,
      name: "openai",
      sourceId: "artificial-analysis-api",
    });

    const [merged] = mergeProviders([curated], [inferred]);

    expect(merged?.group).toBe("mainstream_global");
    expect(merged?.region).toBe("United States");
    expect(merged?.name).toBe("OpenAI");
    expect(merged?.color).toBe("#10a37f");
  });

  it("inserts an uncurated provider as-is", () => {
    const merged = mergeProviders([], [provider({ id: "provider:new", slug: "new" })]);
    expect(merged[0]?.id).toBe("provider:new");
  });
});

describe("OpenRouter adapter", () => {
  const raw = openRouterModelSchema.parse({
    id: "openai/gpt-4o",
    name: "OpenAI: GPT-4o",
    context_length: 128_000,
    pricing: { prompt: "0.0000025", completion: "0.00001" },
  });

  it("maps routed pricing to per-million tokens and reads the context window", () => {
    const mapped = mapOpenRouterModel(raw, NOW);
    expect(mapped?.model.slug).toBe("gpt-4o");
    expect(mapped?.model.metrics.inputPricePerMillion).toBeCloseTo(2.5, 6);
    expect(mapped?.model.metrics.outputPricePerMillion).toBeCloseTo(10, 6);
    expect(mapped?.model.metrics.contextWindow).toBe(128_000);
  });

  it("never invents a capability index or a provider group", () => {
    const mapped = mapOpenRouterModel(raw, NOW);
    expect(mapped?.model.metrics.intelligence).toBeNull();
    expect(mapped?.provider.group).toBe("other");
    expect(mapped?.provider.region).toBeNull();
  });

  it("drops an id with no author segment", () => {
    expect(mapOpenRouterModel(openRouterModelSchema.parse({ id: "gpt-4o" }), NOW)).toBeNull();
  });

  it("de-duplicates providers and models", () => {
    const rows = toPersistenceRows([mapOpenRouterModel(raw, NOW)!, mapOpenRouterModel(raw, NOW)!]);
    expect(rows.providers).toHaveLength(1);
    expect(rows.models).toHaveLength(1);
  });
});

describe("Hugging Face adapter", () => {
  it("maps a model to a popularity record", () => {
    const mapped = mapHuggingFaceModel(
      huggingFaceModelSchema.parse({ id: "meta-llama/Llama-3.1-8B", downloads: 12345, likes: 678 }),
    );
    expect(mapped).toMatchObject({ slug: "llama-3-1-8b", downloads: 12345, likes: 678 });
  });

  it("enriches matched models and counts unmatched ones", () => {
    const models = [model()];
    const outcome = applyPopularity(models, [
      { rawId: "openai/gpt-5.2", slug: "gpt-5-2", downloads: 400_000, likes: 1_200 },
      { rawId: "someone/unknown", slug: "unknown", downloads: 5, likes: 1 },
    ]);

    expect(outcome.matched).toBe(1);
    expect(outcome.unmatched).toBe(1);
    expect(outcome.models[0]?.metrics.hfDownloads).toBe(400_000);
  });

  it("does not clear an existing popularity value with a null", () => {
    const models = [model({ metrics: metrics({ hfDownloads: 999, hfLikes: 10 }) })];
    const outcome = applyPopularity(models, [
      { rawId: "openai/gpt-5.2", slug: "gpt-5-2", downloads: null, likes: null },
    ]);
    expect(outcome.models[0]?.metrics.hfDownloads).toBe(999);
  });
});
