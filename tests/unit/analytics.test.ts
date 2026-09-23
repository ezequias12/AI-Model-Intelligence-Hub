import { describe, expect, it } from "vitest";
import {
  computeLandscapeChart,
  computeLeaderCards,
  computeRankings,
  computeReleases,
  RANKING_BOARDS,
} from "@/lib/analytics";
import {
  buildModelContexts,
  getMetric,
  METRICS,
  metricCatalog,
} from "@/lib/analytics/metric-registry";
import type { Model, ModelMetrics, Provider } from "@/lib/domain/schema";
import { buildFixtureModels } from "@/lib/fixtures/models";
import { PROVIDER_SEEDS, buildFixtureProviders } from "@/lib/fixtures/providers";

const NOW = new Date("2026-09-18T12:00:00.000Z");

function workspace(): {
  models: Model[];
  providers: Provider[];
  contexts: ReturnType<typeof buildModelContexts>;
} {
  const providers = buildFixtureProviders(NOW);
  const models = buildFixtureModels(providers, PROVIDER_SEEDS, NOW);
  const previous = new Map<string, ModelMetrics>();
  return { models, providers, contexts: buildModelContexts(models, providers, previous) };
}

describe("metric registry", () => {
  it("declares every metric exactly once", () => {
    const keys = METRICS.map((metric) => metric.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every metric a direction, a format and a description", () => {
    for (const metric of METRICS) {
      expect(["higher", "lower"]).toContain(metric.direction);
      expect(metric.description.length).toBeGreaterThan(10);
      expect(metric.format(null)).toBe("—");
    }
  });

  it("labels derived metrics as derived", () => {
    const derived = METRICS.filter((metric) => metric.provenance === "derived");
    expect(derived.length).toBeGreaterThan(0);
    for (const metric of derived) {
      expect([
        "blendedPrice",
        "intelligencePerDollar",
        "codingPerDollar",
        "agenticPerDollar",
        "weightedValue",
        "tokensPerTask",
      ]).toContain(metric.key);
    }
  });

  it("marks price metrics as lower-is-better", () => {
    expect(getMetric("inputPricePerMillion")?.direction).toBe("lower");
    expect(getMetric("outputPricePerMillion")?.direction).toBe("lower");
    expect(getMetric("blendedPrice")?.direction).toBe("lower");
    expect(getMetric("ttftSeconds")?.direction).toBe("lower");
  });

  it("marks capability metrics as higher-is-better", () => {
    expect(getMetric("intelligence")?.direction).toBe("higher");
    expect(getMetric("coding")?.direction).toBe("higher");
    expect(getMetric("agentic")?.direction).toBe("higher");
  });

  it("exposes a catalogue for the methodology page", () => {
    const catalogue = metricCatalog();
    expect(catalogue.length).toBe(METRICS.length);
    expect(catalogue[0]).toHaveProperty("provenance");
  });
});

describe("computeLeaderCards", () => {
  it("produces one card per declared leader plus the newest model", () => {
    const { contexts } = workspace();
    const cards = computeLeaderCards(contexts);
    expect(cards.length).toBe(8);
    expect(cards.at(-1)?.id).toBe("newest_relevant");
  });

  it("never returns an empty card when the population has data", () => {
    const { contexts } = workspace();
    const cards = computeLeaderCards(contexts);
    for (const card of cards) {
      expect(card.empty).toBe(false);
      expect(card.context).not.toBeNull();
      expect(card.metricDisplay).not.toBe("");
    }
  });

  it("picks the actual maximum for the intelligence card", () => {
    const { contexts } = workspace();
    const card = computeLeaderCards(contexts).find((entry) => entry.id === "highest_intelligence");
    const best = Math.max(...contexts.map((context) => context.model.metrics.intelligence ?? 0));
    expect(card?.value).toBe(best);
  });

  it("picks the actual minimum for the lowest input price card", () => {
    const { contexts } = workspace();
    const card = computeLeaderCards(contexts).find((entry) => entry.id === "lowest_input_price");
    const cheapest = Math.min(
      ...contexts
        .map((context) => context.model.metrics.inputPricePerMillion)
        .filter((value): value is number => value !== null),
    );
    expect(card?.value).toBe(cheapest);
  });
});

describe("computeRankings", () => {
  it("produces a result for every declared board", () => {
    const { contexts } = workspace();
    const results = computeRankings(contexts, {
      scope: "all",
      providerScope: { filter: "all" },
      selectedIds: [],
      minimumCapability: 0,
    });
    expect(results).toHaveLength(RANKING_BOARDS.length);
  });

  it("limits each board to ten rows and ranks them ascending", () => {
    const { contexts } = workspace();
    const results = computeRankings(contexts, {
      scope: "all",
      providerScope: { filter: "all" },
      selectedIds: [],
      minimumCapability: 0,
    });

    for (const result of results) {
      expect(result.rows.length).toBeLessThanOrEqual(10);
      for (let index = 1; index < result.rows.length; index += 1) {
        expect(result.rows[index]!.rank).toBeGreaterThanOrEqual(result.rows[index - 1]!.rank);
      }
    }
  });

  it("places the highest intelligence model first on its board", () => {
    const { contexts } = workspace();
    const board = computeRankings(contexts, {
      scope: "all",
      providerScope: { filter: "all" },
      selectedIds: [],
      minimumCapability: 0,
    }).find((result) => result.definition.id === "intelligence");

    const best = Math.max(...contexts.map((context) => context.model.metrics.intelligence ?? 0));
    expect(board?.rows[0]?.value).toBe(best);
  });

  it("excludes cheap-but-weak models when a capability threshold is set", () => {
    const { contexts } = workspace();
    const board = computeRankings(contexts, {
      scope: "all",
      providerScope: { filter: "all" },
      selectedIds: [],
      minimumCapability: 65,
    }).find((result) => result.definition.id === "value_intelligence");

    expect(board?.excludedBelowThreshold).toBeGreaterThan(0);
    for (const row of board?.rows ?? []) {
      const intelligence = row.context.model.metrics.intelligence;
      expect(intelligence === null || intelligence >= 65).toBe(true);
    }
  });

  it("restricts to the selection when the scope is 'selected'", () => {
    const { contexts, models } = workspace();
    const selectedIds = models.slice(0, 3).map((model) => model.id);
    const boards = computeRankings(contexts, {
      scope: "selected",
      providerScope: { filter: "all" },
      selectedIds,
      minimumCapability: 0,
    });

    const ids = new Set(boards.flatMap((board) => board.rows.map((row) => row.context.model.id)));
    for (const id of ids) expect(selectedIds).toContain(id);
  });

  it("reports the excluded-without-data count instead of hiding it", () => {
    const { contexts } = workspace();
    const board = computeRankings(contexts, {
      scope: "all",
      providerScope: { filter: "all" },
      selectedIds: [],
      minimumCapability: 0,
    }).find((result) => result.definition.id === "value_weighted");

    expect(board?.excludedNoData).toBeGreaterThanOrEqual(0);
    expect(board?.populationSize).toBeGreaterThan(0);
  });
});

describe("computeLandscapeChart", () => {
  it("computes a Pareto frontier with a described rule", () => {
    const { contexts } = workspace();
    const result = computeLandscapeChart(contexts, {
      xKey: "blendedPrice",
      yKey: "intelligence",
      selectedIds: [],
      showFrontier: true,
    });

    expect(result.points.length).toBeGreaterThan(0);
    expect(result.points.some((point) => point.onFrontier)).toBe(true);
    expect(result.frontierRule).toContain("no other model is at least as good");
  });

  it("omits the frontier when disabled", () => {
    const { contexts } = workspace();
    const result = computeLandscapeChart(contexts, {
      xKey: "blendedPrice",
      yKey: "intelligence",
      selectedIds: [],
      showFrontier: false,
    });
    expect(result.points.every((point) => !point.onFrontier)).toBe(true);
  });

  it("drops points missing either axis", () => {
    const { contexts } = workspace();
    const result = computeLandscapeChart(contexts, {
      xKey: "blendedPrice",
      yKey: "intelligence",
      selectedIds: [],
      showFrontier: false,
    });

    for (const point of result.points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

describe("computeReleases", () => {
  it("includes a release row for every model with a release date", () => {
    const { contexts, models } = workspace();
    const rows = computeReleases(contexts, []);
    const releases = rows.filter((row) => row.kind === "release");
    expect(releases).toHaveLength(models.filter((model) => model.releaseDate).length);
  });

  it("sorts newest first", () => {
    const { contexts } = workspace();
    const rows = computeReleases(contexts, []);
    for (let index = 1; index < rows.length; index += 1) {
      expect(Date.parse(rows[index]!.date)).toBeLessThanOrEqual(Date.parse(rows[index - 1]!.date));
    }
  });

  it("includes deprecations", () => {
    const { contexts } = workspace();
    const rows = computeReleases(contexts, []);
    expect(rows.some((row) => row.kind === "deprecation")).toBe(true);
  });
});
