import { describe, expect, it } from "vitest";
import {
  COUNTRY_NAMES,
  WORLD_REGION_LABELS,
  WORLD_REGIONS,
  WORLD_TAB_ORDER,
  assertNoPoliticalMetrics,
  buildAttributionSummary,
  countryName,
  findNeutralityViolations,
  isNeutral,
  isPoliticalDomain,
} from "@/lib/domain/world";
import { WORLD_SEEDS } from "@/lib/fixtures/world";
import { metricCatalog } from "@/lib/analytics/metric-registry";
import { computeRankings } from "@/lib/analytics";
import { buildModelContexts } from "@/lib/analytics/metric-registry";
import type { Model, Provider } from "@/lib/domain/schema";
import { buildFixtureModels } from "@/lib/fixtures/models";
import { PROVIDER_SEEDS, buildFixtureProviders } from "@/lib/fixtures/providers";

const NOW = new Date("2026-09-18T12:00:00.000Z");

describe("neutrality guardrails", () => {
  it("flags endorsements and voting advice", () => {
    const violations = findNeutralityViolations(
      "We endorse this candidate and you should vote for them.",
    );
    expect(violations.map((violation) => violation.id)).toContain("endorsement");
  });

  it("flags electoral predictions", () => {
    expect(isNeutral("The incumbent will win the election by a wide margin.")).toBe(false);
  });

  it("flags unattributed verdicts", () => {
    expect(isNeutral("The truth is that the minister is obviously lying.")).toBe(false);
  });

  it("flags ideological scoring language", () => {
    expect(isNeutral("Our ideology score ranks this party as extreme.")).toBe(false);
  });

  it("flags ranking of political actors", () => {
    expect(isNeutral("This is the ranking of politicians by performance.")).toBe(false);
  });

  it("accepts descriptive, attributed reporting", () => {
    expect(
      isNeutral(
        "The statistics agency reported the monthly figure. Analysts had published a range of expectations.",
      ),
    ).toBe(true);
  });

  it("accepts a report that mentions disagreement without adjudicating", () => {
    expect(
      isNeutral(
        "Both governments published separate statements describing the scope of the agreement.",
      ),
    ).toBe(true);
  });
});

describe("buildAttributionSummary", () => {
  it("prefixes every claim with its source", () => {
    const summary = buildAttributionSummary({
      headline: "Agency publishes monthly figure",
      claims: [{ text: "the figure rose 3.1%", attributedTo: "The agency" }],
      multipleAccounts: false,
      developing: false,
    });

    expect(summary).toContain("The agency reports: the figure rose 3.1%");
  });

  it("states explicitly that contested claims are not adjudicated", () => {
    const summary = buildAttributionSummary({
      headline: "Two governments announce tariff reviews",
      claims: [],
      multipleAccounts: true,
      developing: false,
    });

    expect(summary).toContain("does not adjudicate");
  });

  it("labels developing stories", () => {
    const summary = buildAttributionSummary({
      headline: "Committee schedules debate",
      claims: [],
      multipleAccounts: false,
      developing: true,
    });

    expect(summary).toContain("Developing story");
  });
});

describe("domain separation", () => {
  it("identifies the political domain", () => {
    expect(isPoliticalDomain("world_politics")).toBe(true);
    expect(isPoliticalDomain("ai_general")).toBe(false);
  });

  it("asserts no model metric is political", () => {
    const keys = metricCatalog().map((metric) => metric.key);
    const result = assertNoPoliticalMetrics(keys);
    expect(result.ok).toBe(true);
    expect(result.offending).toEqual([]);
  });

  it("detects a political metric key when one is injected", () => {
    const result = assertNoPoliticalMetrics(["intelligence", "political_lean"]);
    expect(result.ok).toBe(false);
    expect(result.offending).toEqual(["political_lean"]);
  });

  it("never lets a model ranking accept political input", () => {
    const providers: Provider[] = buildFixtureProviders(NOW);
    const models: Model[] = buildFixtureModels(providers, PROVIDER_SEEDS, NOW);
    const contexts = buildModelContexts(models, providers, new Map());

    const rankings = computeRankings(contexts, {
      scope: "all",
      providerScope: { filter: "all" },
      selectedIds: [],
      minimumCapability: 0,
    });

    // Every board metric must be a registered, non-political metric.
    const metricKeys = new Set(metricCatalog().map((metric) => metric.key));
    for (const board of rankings) {
      expect(metricKeys.has(board.definition.metricKey)).toBe(true);
      expect(board.definition.metricKey).not.toContain("political");
      expect(board.definition.metricKey).not.toContain("ideolog");
    }
  });
});

describe("world fixtures", () => {
  it("covers every region label", () => {
    for (const region of WORLD_REGIONS) {
      expect(WORLD_REGION_LABELS[region]).toBeTruthy();
    }
  });

  it("includes a 'top' tab first", () => {
    expect(WORLD_TAB_ORDER[0]).toBe("top");
  });

  it("has no neutral summary that violates the guardrails", () => {
    for (const seed of WORLD_SEEDS) {
      if (seed.summary) {
        expect(findNeutralityViolations(seed.summary)).toEqual([]);
      }
    }
  });

  it("marks contested fixtures as multiple accounts rather than resolving them", () => {
    const contested = WORLD_SEEDS.filter((seed) => seed.multipleAccounts);
    expect(contested.length).toBeGreaterThan(0);
  });

  it("maps known country codes to names and falls back to the code", () => {
    expect(countryName("AR")).toBe("Argentina");
    expect(countryName("ar")).toBe("Argentina");
    expect(countryName("ZZ")).toBe("ZZ");
    expect(Object.keys(COUNTRY_NAMES).length).toBeGreaterThan(10);
  });
});
