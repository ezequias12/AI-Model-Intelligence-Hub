import { describe, expect, it } from "vitest";
import { createMockRepository } from "@/lib/data/mock-repository";
import { buildFixtures } from "@/lib/fixtures";
import { buildModelContexts } from "@/lib/analytics/metric-registry";
import { resolveDefaultSelection } from "@/lib/domain/selection";

const NOW = new Date("2026-09-18T12:00:00.000Z");

describe("fixture determinism", () => {
  it("produces byte-identical fixtures for the same timestamp", () => {
    const first = buildFixtures(NOW);
    const second = buildFixtures(NOW);

    expect(first.models.map((model) => model.id)).toEqual(second.models.map((model) => model.id));
    expect(first.models.map((model) => model.metrics)).toEqual(
      second.models.map((model) => model.metrics),
    );
    expect(first.modelSnapshots.map((snapshot) => snapshot.payloadHash)).toEqual(
      second.modelSnapshots.map((snapshot) => snapshot.payloadHash),
    );
    expect(first.news.map((item) => item.contentHash)).toEqual(
      second.news.map((item) => item.contentHash),
    );
  });

  it("keeps every model pointing at a provider that exists", () => {
    const fixtures = buildFixtures(NOW);
    const providerIds = new Set(fixtures.providers.map((provider) => provider.id));
    for (const model of fixtures.models) {
      expect(providerIds.has(model.providerId)).toBe(true);
    }
  });

  it("keeps every snapshot pointing at a model that exists", () => {
    const fixtures = buildFixtures(NOW);
    const modelIds = new Set(fixtures.models.map((model) => model.id));
    for (const snapshot of fixtures.modelSnapshots) {
      expect(modelIds.has(snapshot.modelId)).toBe(true);
    }
  });

  it("keeps every harness snapshot pointing at a plan that exists", () => {
    const fixtures = buildFixtures(NOW);
    const planIds = new Set(fixtures.harnessPlans.map((plan) => plan.id));
    for (const snapshot of fixtures.harnessPlanSnapshots) {
      expect(planIds.has(snapshot.planId)).toBe(true);
    }
  });

  it("includes a previously deprecated model so history is exercised", () => {
    const fixtures = buildFixtures(NOW);
    expect(fixtures.models.some((model) => model.deprecatedAt !== null)).toBe(true);
  });

  it("gives every model at least one snapshot", () => {
    const fixtures = buildFixtures(NOW);
    const withSnapshots = new Set(fixtures.modelSnapshots.map((snapshot) => snapshot.modelId));
    for (const model of fixtures.models) {
      expect(withSnapshots.has(model.id)).toBe(true);
    }
  });

  it("only creates snapshots at or after the model release date", () => {
    const fixtures = buildFixtures(NOW);
    for (const snapshot of fixtures.modelSnapshots) {
      const model = fixtures.models.find((entry) => entry.id === snapshot.modelId);
      if (!model?.releaseDate) continue;
      expect(Date.parse(snapshot.capturedAt)).toBeGreaterThanOrEqual(Date.parse(model.releaseDate));
    }
  });
});

describe("mock repository", () => {
  const repository = createMockRepository();

  it("reports mock mode and a dataset timestamp", async () => {
    const meta = repository.meta;
    expect(meta.mode).toBe("mock");
    expect(meta.degraded).toBe(false);
    expect(meta.datasetCapturedAt).not.toBeNull();
  });

  it("returns the full model catalogue", async () => {
    const models = await repository.getModels();
    expect(models.length).toBeGreaterThan(20);
  });

  it("filters snapshots by model", async () => {
    const models = await repository.getModels();
    const target = models[0]!;
    const snapshots = await repository.getModelSnapshots(target.id);
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots.every((snapshot) => snapshot.modelId === target.id)).toBe(true);
  });

  it("filters news by domain", async () => {
    const news = await repository.getNews({ domain: "harness" });
    expect(news.length).toBeGreaterThan(0);
    expect(news.every((item) => item.domain === "harness")).toBe(true);
  });

  it("filters news by search across title and entities", async () => {
    const news = await repository.getNews({ search: "gpt-5.2" });
    expect(news.length).toBeGreaterThan(0);
  });

  it("returns news newest first", async () => {
    const news = await repository.getNews();
    for (let index = 1; index < news.length; index += 1) {
      const previous = news[index - 1]!.publishedAt;
      const current = news[index]!.publishedAt;
      if (!previous || !current) continue;
      expect(Date.parse(current)).toBeLessThanOrEqual(Date.parse(previous));
    }
  });

  it("honours a news limit", async () => {
    const news = await repository.getNews({ limit: 5 });
    expect(news).toHaveLength(5);
  });

  it("filters world news by region", async () => {
    const world = await repository.getWorldNews({ region: "argentina" });
    expect(world.length).toBeGreaterThan(0);
    expect(world.every((item) => item.region === "argentina")).toBe(true);
  });

  it("returns all world news for the 'top' region", async () => {
    const all = await repository.getWorldNews();
    const top = await repository.getWorldNews({ region: "top" });
    expect(top.length).toBe(all.length);
  });

  it("exposes the full source registry", async () => {
    const sources = await repository.getSources();
    expect(sources.length).toBeGreaterThan(15);
    expect(sources.some((source) => !source.enabled)).toBe(true);
  });

  it("reports ingestion runs including skipped disabled sources", async () => {
    const runs = await repository.getIngestionRuns({ limit: 500 });
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.some((run) => run.status === "skipped")).toBe(true);
    expect(runs.some((run) => run.status === "rate_limited")).toBe(true);
    expect(runs.some((run) => run.status === "failed")).toBe(true);
  });

  it("filters ingestion runs by source", async () => {
    const runs = await repository.getIngestionRuns({ sourceId: "artificial-analysis-api" });
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.every((run) => run.sourceId === "artificial-analysis-api")).toBe(true);
  });

  it("returns change events newest first", async () => {
    const events = await repository.getChangeEvents(50);
    for (let index = 1; index < events.length; index += 1) {
      expect(Date.parse(events[index]!.observedAt)).toBeLessThanOrEqual(
        Date.parse(events[index - 1]!.observedAt),
      );
    }
  });

  it("never returns a change event dated in the future", async () => {
    const events = await repository.getChangeEvents(500);
    const now = Date.now();
    for (const event of events) {
      expect(Date.parse(event.observedAt)).toBeLessThanOrEqual(now);
    }
  });
});

describe("end-to-end fixture analytics", () => {
  it("resolves a default selection from the fixture catalogue", async () => {
    const repository = createMockRepository();
    const [models, providers] = await Promise.all([
      repository.getModels(),
      repository.getProviders(),
    ]);

    const selection = resolveDefaultSelection(models, providers, { fallbackIds: [] });
    expect(selection.length).toBeGreaterThanOrEqual(6);
    expect(selection.length).toBeLessThanOrEqual(8);
  });

  it("builds contexts with a working blended price for priced models", async () => {
    const repository = createMockRepository();
    const [models, providers] = await Promise.all([
      repository.getModels(),
      repository.getProviders(),
    ]);

    const contexts = buildModelContexts(models, providers, new Map());
    const priced = contexts.filter((context) => context.blendedPrice !== null);
    expect(priced.length).toBeGreaterThan(10);

    for (const context of priced) {
      const { inputPricePerMillion: input, outputPricePerMillion: output } = context.model.metrics;
      expect(context.blendedPrice).toBeCloseTo((input ?? 0) * 0.75 + (output ?? 0) * 0.25, 6);
    }
  });
});
