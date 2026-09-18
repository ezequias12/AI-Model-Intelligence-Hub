import { describe, expect, it } from "vitest";
import {
  blendedPrice,
  clamp01,
  median,
  monthlyWorkloadCost,
  normalize,
  normalizeCapabilities,
  paretoFrontier,
  paretoFrontierIds,
  percentChange,
  rankBy,
  valueScore,
} from "@/lib/domain/metrics";
import { DEFAULT_BLENDED_PRICE_WEIGHTS, type ModelMetrics } from "@/lib/domain/schema";

function metrics(input: Partial<ModelMetrics>): ModelMetrics {
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
    ...input,
  };
}

describe("blendedPrice", () => {
  it("uses the documented 75/25 default weighting", () => {
    const result = blendedPrice(
      metrics({ inputPricePerMillion: 4, outputPricePerMillion: 8 }),
      DEFAULT_BLENDED_PRICE_WEIGHTS,
    );

    expect(result).not.toBeNull();
    expect(result?.value).toBeCloseTo(4 * 0.75 + 8 * 0.25, 10);
    expect(result?.weights).toEqual({ input: 0.75, output: 0.25 });
  });

  it("normalises weights that do not sum to one", () => {
    const result = blendedPrice(metrics({ inputPricePerMillion: 10, outputPricePerMillion: 0 }), {
      input: 3,
      output: 1,
    });
    expect(result?.value).toBeCloseTo(7.5, 10);
  });

  it("returns null when either price is unknown instead of guessing", () => {
    expect(blendedPrice(metrics({ inputPricePerMillion: 4 }))).toBeNull();
    expect(blendedPrice(metrics({ outputPricePerMillion: 4 }))).toBeNull();
  });

  it("rejects a degenerate weighting", () => {
    expect(
      blendedPrice(metrics({ inputPricePerMillion: 1, outputPricePerMillion: 1 }), {
        input: 0,
        output: 0,
      }),
    ).toBeNull();
  });
});

describe("monthlyWorkloadCost", () => {
  it("computes input + output cost for a workload", () => {
    const result = monthlyWorkloadCost(
      metrics({ inputPricePerMillion: 2, outputPricePerMillion: 10 }),
      { inputMillions: 100, outputMillions: 10 },
    );

    expect(result?.inputCost).toBeCloseTo(200, 6);
    expect(result?.outputCost).toBeCloseTo(100, 6);
    expect(result?.totalCost).toBeCloseTo(300, 6);
  });

  it("prices the cached share at the cache rate and reports the saving", () => {
    const result = monthlyWorkloadCost(
      metrics({
        inputPricePerMillion: 2,
        outputPricePerMillion: 10,
        cacheReadPricePerMillion: 0.5,
      }),
      { inputMillions: 100, outputMillions: 0, cacheHitRate: 0.5 },
    );

    expect(result?.inputCost).toBeCloseTo(50 * 2 + 50 * 0.5, 6);
    expect(result?.cacheSavings).toBeCloseTo(50 * 1.5, 6);
  });

  it("clamps a cache hit rate above one", () => {
    const result = monthlyWorkloadCost(
      metrics({ inputPricePerMillion: 2, outputPricePerMillion: 1, cacheReadPricePerMillion: 0.5 }),
      { inputMillions: 10, outputMillions: 0, cacheHitRate: 5 },
    );
    expect(result?.workload.cacheHitRate).toBe(1);
  });

  it("returns null when a required price is missing", () => {
    expect(
      monthlyWorkloadCost(metrics({ inputPricePerMillion: 2 }), {
        inputMillions: 1,
        outputMillions: 1,
      }),
    ).toBeNull();
  });
});

describe("valueScore", () => {
  const population = [
    metrics({
      intelligence: 40,
      coding: 30,
      agentic: 20,
      inputPricePerMillion: 1,
      outputPricePerMillion: 1,
    }),
    metrics({
      intelligence: 80,
      coding: 70,
      agentic: 60,
      inputPricePerMillion: 3,
      outputPricePerMillion: 3,
    }),
  ];

  it("computes intelligence per dollar", () => {
    const cheap = metrics({ intelligence: 50, inputPricePerMillion: 1, outputPricePerMillion: 1 });
    const result = valueScore(cheap, { mode: "intelligence_per_dollar" });
    expect(result?.score).toBeCloseTo(50, 6);
    expect(result?.explanation).toContain("intelligence / blended_price");
  });

  it("flags models below the minimum capability gate", () => {
    const weak = metrics({
      intelligence: 20,
      inputPricePerMillion: 0.01,
      outputPricePerMillion: 0.01,
    });
    const result = valueScore(weak, {
      mode: "intelligence_per_dollar",
      minimumCapability: 40,
    });

    expect(result?.belowThreshold).toBe(true);
    // The score still exists so the UI can show it, but the caller excludes it.
    expect(result?.score).toBeGreaterThan(0);
  });

  it("normalises capability components for weighted value", () => {
    const target = metrics({
      intelligence: 80,
      coding: 30,
      agentic: 40,
      inputPricePerMillion: 1,
      outputPricePerMillion: 1,
    });
    const result = valueScore(target, { mode: "weighted_value" }, population);

    expect(result?.components?.intelligence).toBeCloseTo(1, 6);
    expect(result?.components?.coding).toBeCloseTo(0, 6);
    expect(result?.components?.agentic).toBeCloseTo(0.5, 6);
  });

  it("returns null for weighted value when a component is missing", () => {
    const incomplete = metrics({
      intelligence: 80,
      inputPricePerMillion: 1,
      outputPricePerMillion: 1,
    });
    expect(valueScore(incomplete, { mode: "weighted_value" }, population)).toBeNull();
  });

  it("returns null when the price is zero or missing", () => {
    expect(
      valueScore(metrics({ intelligence: 50, inputPricePerMillion: 0, outputPricePerMillion: 0 }), {
        mode: "intelligence_per_dollar",
      }),
    ).toBeNull();
  });
});

describe("normalizeCapabilities", () => {
  it("returns null when the population has no values for a component", () => {
    expect(normalizeCapabilities(metrics({ intelligence: 1 }), [metrics({})])).toBeNull();
  });

  it("maps the extremes to 0 and 1", () => {
    const population = [
      metrics({ intelligence: 10, coding: 10, agentic: 10 }),
      metrics({ intelligence: 20, coding: 20, agentic: 20 }),
    ];
    const result = normalizeCapabilities(
      metrics({ intelligence: 20, coding: 10, agentic: 15 }),
      population,
    );
    expect(result).toEqual({ intelligence: 1, coding: 0, agentic: 0.5 });
  });
});

describe("paretoFrontier", () => {
  it("keeps only non-dominated points when both axes are higher-is-better", () => {
    const points = [
      { item: { id: "a" }, x: 1, y: 1 },
      { item: { id: "b" }, x: 2, y: 2 },
      { item: { id: "c" }, x: 1, y: 3 },
      { item: { id: "d" }, x: 0, y: 0 },
    ];

    const frontier = paretoFrontierIds(points, { xBetter: "higher", yBetter: "higher" });
    expect([...frontier].sort()).toEqual(["b", "c"]);
  });

  it("handles a lower-is-better price axis", () => {
    const points = [
      { item: { id: "cheap-weak" }, x: 1, y: 10 },
      { item: { id: "mid" }, x: 5, y: 50 },
      { item: { id: "expensive-strong" }, x: 10, y: 90 },
      { item: { id: "dominated" }, x: 8, y: 20 },
    ];

    const frontier = paretoFrontierIds(points, { xBetter: "lower", yBetter: "higher" });
    expect(frontier.has("cheap-weak")).toBe(true);
    expect(frontier.has("mid")).toBe(true);
    expect(frontier.has("expensive-strong")).toBe(true);
    expect(frontier.has("dominated")).toBe(false);
  });

  it("ignores non-finite coordinates", () => {
    const frontier = paretoFrontier(
      [
        { item: { id: "ok" }, x: 1, y: 1 },
        { item: { id: "nan" }, x: Number.NaN, y: 5 },
      ],
      { xBetter: "higher", yBetter: "higher" },
    );
    expect(frontier.map((point) => point.item.id)).toEqual(["ok"]);
  });
});

describe("rankBy", () => {
  const items = [
    { id: "a", value: 10 },
    { id: "b", value: null },
    { id: "c", value: 30 },
    { id: "d", value: 30 },
  ];

  it("drops null values rather than ranking them last", () => {
    const ranked = rankBy(items, (item) => item.value, "higher");
    expect(ranked.map((entry) => entry.item.id)).toEqual(["c", "d", "a"]);
  });

  it("gives tied values the same rank number", () => {
    const ranked = rankBy(items, (item) => item.value, "higher");
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(1);
    expect(ranked[2]?.rank).toBe(3);
  });

  it("supports lower-is-better and a limit", () => {
    const ranked = rankBy(items, (item) => item.value, "lower", 2);
    expect(ranked.map((entry) => entry.item.id)).toEqual(["a", "c"]);
  });
});

describe("statistics helpers", () => {
  it("computes an odd-length median", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the middle pair for an even length", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("returns null for an empty or non-finite input", () => {
    expect(median([])).toBeNull();
    expect(median([Number.NaN])).toBeNull();
  });

  it("normalises and clamps", () => {
    expect(normalize(5, 0, 10)).toBe(0.5);
    expect(normalize(5, 5, 5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
  });

  it("computes percent change and refuses division by zero", () => {
    expect(percentChange(10, 15)).toBeCloseTo(50, 6);
    expect(percentChange(0, 15)).toBeNull();
    expect(percentChange(null, 15)).toBeNull();
  });
});
