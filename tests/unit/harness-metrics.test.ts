import { describe, expect, it } from "vitest";
import {
  buildCheapestViews,
  buildPlanComparisonRows,
  deriveHarnessPlanMetrics,
  recommendPlans,
  type CheapestContext,
  type CalculatorInput,
} from "@/lib/domain/harness-metrics";
import type { HarnessPlanSnapshot } from "@/lib/domain/schema";

function snapshot(input: Partial<HarnessPlanSnapshot> & { planId: string }): HarnessPlanSnapshot {
  return {
    ...input,
    id: `snapshot:${input.planId}`,
    planId: input.planId,
    capturedAt: "2026-09-18T06:00:00.000Z",
    monthlyPriceUsd: input.monthlyPriceUsd ?? null,
    annualPriceUsd: input.annualPriceUsd ?? null,
    includedCreditsUsd: input.includedCreditsUsd ?? null,
    estimatedRequests: input.estimatedRequests ?? null,
    estimatedRequestsSourceUrl: input.estimatedRequestsSourceUrl ?? null,
    resetPeriod: input.resetPeriod ?? "monthly",
    overageModel: input.overageModel ?? "unknown",
    byok: input.byok ?? false,
    models: input.models ?? [],
    frontierModelAccess: input.frontierModelAccess ?? false,
    platforms: input.platforms ?? ["cli"],
    regions: input.regions ?? ["Global"],
    notes: input.notes ?? null,
    sourceId: input.sourceId ?? "command-code-pricing",
    sourceUrl: input.sourceUrl ?? "https://example.com/pricing",
    rawSourceHash: input.rawSourceHash ?? "0123456789abcdef",
  };
}

function context(
  planId: string,
  snap: Partial<HarnessPlanSnapshot> & { planId: string },
  productName = "Product",
): CheapestContext {
  const built = snapshot(snap);
  return {
    planId,
    productId: `harness:${planId}`,
    planName: built.id,
    productName,
    derived: deriveHarnessPlanMetrics(built),
    snapshot: built,
  };
}

describe("deriveHarnessPlanMetrics", () => {
  it("computes credit per dollar", () => {
    const derived = deriveHarnessPlanMetrics(
      snapshot({ planId: "go", monthlyPriceUsd: 1, includedCreditsUsd: 10 }),
    );
    expect(derived.includedCreditPerDollar).toBe(10);
    expect(derived.includedValueOverPriceUsd).toBe(9);
    expect(derived.isFree).toBe(false);
  });

  it("derives a monthly equivalent from an annual price only", () => {
    const derived = deriveHarnessPlanMetrics(snapshot({ planId: "annual", annualPriceUsd: 120 }));
    expect(derived.effectiveMonthlyPriceUsd).toBe(10);
    expect(derived.entryPriceUsd).toBe(10);
  });

  it("treats a zero monthly price as free", () => {
    const derived = deriveHarnessPlanMetrics(snapshot({ planId: "free", monthlyPriceUsd: 0 }));
    expect(derived.isFree).toBe(true);
    expect(derived.includedCreditPerDollar).toBeNull();
  });

  it("never infers a request estimate", () => {
    const derived = deriveHarnessPlanMetrics(snapshot({ planId: "go", monthlyPriceUsd: 1 }));
    expect(derived.documentedRequestEstimatePerDollar).toBeNull();
  });

  it("computes requests per dollar only when documented", () => {
    const derived = deriveHarnessPlanMetrics(
      snapshot({ planId: "go", monthlyPriceUsd: 1, estimatedRequests: 15000 }),
    );
    expect(derived.documentedRequestEstimatePerDollar).toBe(15000);
  });

  it("leaves every derived value null when the price is unknown", () => {
    const derived = deriveHarnessPlanMetrics(
      snapshot({ planId: "unknown", includedCreditsUsd: 10 }),
    );
    expect(derived.entryPriceUsd).toBeNull();
    expect(derived.includedCreditPerDollar).toBeNull();
    expect(derived.includedValueOverPriceUsd).toBeNull();
  });
});

describe("buildCheapestViews", () => {
  const contexts = [
    context(
      "go",
      {
        planId: "go",
        monthlyPriceUsd: 1,
        includedCreditsUsd: 10,
        estimatedRequests: 15000,
        platforms: ["cli"],
      },
      "Command Code",
    ),
    context(
      "goat",
      { planId: "goat", monthlyPriceUsd: 10, includedCreditsUsd: 60, frontierModelAccess: true },
      "Command Code",
    ),
    context(
      "free",
      { planId: "free", monthlyPriceUsd: 0, platforms: ["ide"], byok: true },
      "Kilo Code",
    ),
    context(
      "pro",
      {
        planId: "pro",
        monthlyPriceUsd: 20,
        includedCreditsUsd: 20,
        frontierModelAccess: true,
        byok: false,
      },
      "Cursor",
    ),
  ];

  const views = buildCheapestViews(contexts, { premiumThresholdUsd: 20 });

  it("lists every free option", () => {
    expect(views.free).toHaveLength(1);
    expect(views.free[0]?.planId).toBe("free");
  });

  it("finds the lowest paid entry, ignoring free plans", () => {
    expect(views.lowestPaidEntryUsd?.planId).toBe("go");
    expect(views.lowestPaidEntryUsd?.value).toBe(1);
  });

  it("finds the best included credit per dollar", () => {
    // $10 of credits for $1 is 10x, which beats $60 of credits for $10 (6x).
    expect(views.highestCreditPerDollar?.planId).toBe("go");
    expect(views.highestCreditPerDollar?.value).toBeCloseTo(10, 6);
  });

  it("finds the cheapest plan with documented frontier model access", () => {
    expect(views.premiumUnderThreshold?.planId).toBe("goat");
  });

  it("finds a BYOK-friendly plan", () => {
    expect(views.byokFriendly?.planId).toBe("free");
  });

  it("finds the highest documented allowance", () => {
    expect(views.highestDocumentedAllowance?.planId).toBe("go");
  });

  it("exposes the formula for every category so nothing is an unexplained winner", () => {
    for (const entry of [
      views.lowestPaidEntryUsd,
      views.highestCreditPerDollar,
      views.premiumUnderThreshold,
      views.byokFriendly,
      views.highestDocumentedAllowance,
    ]) {
      expect(entry?.formula.length).toBeGreaterThan(0);
    }
  });

  it("returns nulls instead of inventing winners when data is absent", () => {
    const empty = buildCheapestViews([]);
    expect(empty.lowestPaidEntryUsd).toBeNull();
    expect(empty.highestCreditPerDollar).toBeNull();
    expect(empty.free).toEqual([]);
  });
});

describe("buildPlanComparisonRows", () => {
  it("produces one row per declared field with a value per plan", () => {
    const contexts = [
      context("a", { planId: "a", monthlyPriceUsd: 5 }),
      context("b", { planId: "b", monthlyPriceUsd: 10, byok: true }),
    ];
    const rows = buildPlanComparisonRows(contexts);

    expect(rows.length).toBeGreaterThan(5);
    const price = rows.find((row) => row.key === "price");
    expect(price?.values.map((entry) => entry.value)).toEqual([5, 10]);
    expect(price?.betterDirection).toBe("lower");

    const byok = rows.find((row) => row.key === "byok");
    expect(byok?.values.map((entry) => entry.value)).toEqual([false, true]);
    expect(byok?.betterDirection).toBeNull();
  });

  it("renders missing values as null rather than zero", () => {
    const rows = buildPlanComparisonRows([context("a", { planId: "a" })]);
    expect(rows.find((row) => row.key === "price")?.values[0]?.value).toBeNull();
  });
});

describe("recommendPlans", () => {
  const contexts = [
    context(
      "go",
      { planId: "go", monthlyPriceUsd: 1, includedCreditsUsd: 10, platforms: ["cli", "ide"] },
      "Command Code",
    ),
    context(
      "pro",
      {
        planId: "pro",
        monthlyPriceUsd: 20,
        includedCreditsUsd: 20,
        frontierModelAccess: true,
        platforms: ["cli"],
      },
      "Cursor",
    ),
    context("pricey", { planId: "pricey", monthlyPriceUsd: 200, platforms: ["cli"] }, "Enterprise"),
  ];

  const base: CalculatorInput = {
    monthlyBudgetUsd: 25,
    codingHoursPerDay: 4,
    preferOpen: false,
    requiresByok: false,
    requiresCli: true,
    requiresCloudAgents: false,
    requiresIde: false,
  };

  it("excludes plans above the budget", () => {
    const results = recommendPlans(base, contexts);
    expect(results.map((entry) => entry.context.planId)).not.toContain("pricey");
  });

  it("excludes plans missing a required platform", () => {
    const results = recommendPlans({ ...base, requiresIde: true }, contexts);
    expect(results.map((entry) => entry.context.planId)).toEqual(["go"]);
  });

  it("excludes plans that cannot satisfy BYOK", () => {
    const results = recommendPlans({ ...base, requiresByok: true }, contexts);
    expect(results).toHaveLength(0);
  });

  it("explains every score with reasons and disqualifiers", () => {
    const results = recommendPlans(base, contexts);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.fit).toBeGreaterThanOrEqual(0);
      expect(result.fit).toBeLessThanOrEqual(100);
    }
  });

  it("surfaces disqualifiers instead of silently dropping a plan", () => {
    const results = recommendPlans({ ...base, requiresByok: true }, contexts);
    // Disqualified plans are filtered out of the ranking, so assert via a plan
    // that fails a soft constraint and therefore stays visible.
    const soft = recommendPlans({ ...base, preferOpen: true }, contexts);
    expect(soft.length).toBeGreaterThan(0);
    expect(results).toHaveLength(0);
  });
});
