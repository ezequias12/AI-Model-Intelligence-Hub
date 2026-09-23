import { describe, expect, it } from "vitest";
import {
  buildHarnessChangeEvents,
  buildModelChangeEvents,
  latestSnapshotBy,
} from "@/lib/ingestion/change-events";
import type { HarnessPlan, HarnessPlanSnapshot, ModelSnapshot } from "@/lib/domain/schema";

const METRICS: ModelSnapshot["metrics"] = {
  intelligence: 60,
  coding: 60,
  agentic: 60,
  math: 60,
  outputSpeedTps: 90,
  ttftSeconds: 2,
  inputPricePerMillion: 1,
  outputPricePerMillion: 10,
  cacheReadPricePerMillion: 0.1,
  cacheWritePricePerMillion: null,
  contextWindow: 128000,
  costPerTaskUsd: null,
  answerTokensPerTask: null,
  reasoningTokensPerTask: null,
  hfDownloads: null,
  hfLikes: null,
};

function snapshot(overrides: Partial<ModelSnapshot> = {}): ModelSnapshot {
  return {
    id: "model-snapshot:gpt:2",
    modelId: "model:gpt",
    capturedAt: "2026-09-18T00:00:00.000Z",
    metrics: { ...METRICS },
    sourceId: "artificial-analysis-api",
    sourceVersion: null,
    payloadHash: "0123456789abcdef",
    ...overrides,
  };
}

function plan(overrides: Partial<HarnessPlan> = {}): HarnessPlan {
  return {
    id: "plan:command-code:go",
    productId: "harness:command-code",
    canonicalPlanKey: "command-code-go",
    name: "Go",
    active: true,
    ...overrides,
  };
}

function harnessSnapshot(overrides: Partial<HarnessPlanSnapshot> = {}): HarnessPlanSnapshot {
  return {
    id: "snapshot:plan:command-code:go:2",
    planId: "plan:command-code:go",
    capturedAt: "2026-09-18T00:00:00.000Z",
    monthlyPriceUsd: 1,
    annualPriceUsd: null,
    includedCreditsUsd: 10,
    estimatedRequests: null,
    estimatedRequestsSourceUrl: null,
    resetPeriod: "monthly",
    overageModel: "hard_cap",
    byok: false,
    models: [],
    frontierModelAccess: false,
    platforms: ["cli"],
    regions: ["Global"],
    notes: null,
    sourceId: "command-code-pricing",
    sourceUrl: "https://commandcode.ai/pricing",
    rawSourceHash: "abcdef",
    ...overrides,
  };
}

describe("latestSnapshotBy", () => {
  it("keeps the newest snapshot per key regardless of input order", () => {
    const older = snapshot({ id: "a", capturedAt: "2026-09-01T00:00:00.000Z" });
    const newer = snapshot({ id: "b", capturedAt: "2026-09-18T00:00:00.000Z" });
    const other = snapshot({
      id: "c",
      modelId: "model:other",
      capturedAt: "2026-09-10T00:00:00.000Z",
    });

    const map = latestSnapshotBy(
      [newer, older, other],
      (row) => row.modelId,
      (row) => row.capturedAt,
    );

    expect(map.get("model:gpt")?.id).toBe("b");
    expect(map.get("model:other")?.id).toBe("c");
  });
});

describe("buildModelChangeEvents", () => {
  it("emits nothing when the metrics are unchanged", () => {
    const previous = snapshot({ id: "prev" });
    const events = buildModelChangeEvents(new Map([["model:gpt", previous]]), [snapshot()]);
    expect(events).toEqual([]);
  });

  it("emits a high-significance price change", () => {
    const previous = snapshot({ id: "prev" });
    const next = snapshot({
      id: "next",
      metrics: { ...METRICS, outputPricePerMillion: 12 },
    });

    const events = buildModelChangeEvents(new Map([["model:gpt", previous]]), [next]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      entity: "model",
      entityId: "model:gpt",
      eventType: "price_changed",
      significance: "high",
    });
    expect(events[0]?.summary).toContain("output price changed");
    expect(events[0]?.before).toEqual({ outputPricePerMillion: 10 });
    expect(events[0]?.after).toEqual({ outputPricePerMillion: 12 });
  });

  it("emits a medium-significance capability change", () => {
    const previous = snapshot({ id: "prev" });
    const next = snapshot({ id: "next", metrics: { ...METRICS, intelligence: 65 } });

    const events = buildModelChangeEvents(new Map([["model:gpt", previous]]), [next]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: "metric_changed", significance: "medium" });
  });

  it("ignores a model with no previous snapshot", () => {
    const events = buildModelChangeEvents(new Map(), [snapshot()]);
    expect(events).toEqual([]);
  });

  it("ignores the same snapshot replayed at the same id", () => {
    const previous = snapshot({ id: "same", metrics: { ...METRICS, intelligence: 60 } });
    const next = snapshot({ id: "same", metrics: { ...METRICS, intelligence: 99 } });
    const events = buildModelChangeEvents(new Map([["model:gpt", previous]]), [next]);
    expect(events).toEqual([]);
  });
});

describe("buildHarnessChangeEvents", () => {
  const plans = new Map([["plan:command-code:go", plan()]]);

  it("emits nothing when the plan is unchanged", () => {
    const previous = harnessSnapshot({ id: "prev" });
    const events = buildHarnessChangeEvents(plans, new Map([["plan:command-code:go", previous]]), [
      harnessSnapshot(),
    ]);
    expect(events).toEqual([]);
  });

  it("maps a price change to price_changed", () => {
    const previous = harnessSnapshot({ id: "prev" });
    const events = buildHarnessChangeEvents(plans, new Map([["plan:command-code:go", previous]]), [
      harnessSnapshot({ id: "next", monthlyPriceUsd: 2 }),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      planId: "plan:command-code:go",
      productId: "harness:command-code",
      eventType: "price_changed",
      significance: "high",
    });
    expect(events[0]?.summary).toContain("Go: monthly price changed");
  });

  it("maps a credits change to credits_changed", () => {
    const previous = harnessSnapshot({ id: "prev" });
    const events = buildHarnessChangeEvents(plans, new Map([["plan:command-code:go", previous]]), [
      harnessSnapshot({ id: "next", includedCreditsUsd: 20 }),
    ]);
    expect(events[0]).toMatchObject({ eventType: "credits_changed", significance: "high" });
  });

  it("splits a model-list change into model_added and model_removed", () => {
    const previous = harnessSnapshot({ id: "prev", models: ["A", "B"] });
    const events = buildHarnessChangeEvents(plans, new Map([["plan:command-code:go", previous]]), [
      harnessSnapshot({ id: "next", models: ["B", "C"] }),
    ]);

    expect(events.map((event) => event.eventType).sort()).toEqual(["model_added", "model_removed"]);
    const added = events.find((event) => event.eventType === "model_added");
    expect(added?.summary).toContain("model added (C)");
  });

  it("maps a platform change to feature_added", () => {
    const previous = harnessSnapshot({ id: "prev" });
    const events = buildHarnessChangeEvents(plans, new Map([["plan:command-code:go", previous]]), [
      harnessSnapshot({ id: "next", platforms: ["cli", "ide"] }),
    ]);
    expect(events[0]).toMatchObject({ eventType: "feature_added", significance: "low" });
  });

  it("ignores a notes-only change and a plan it cannot resolve", () => {
    const previous = harnessSnapshot({ id: "prev" });
    const notesOnly = buildHarnessChangeEvents(
      plans,
      new Map([["plan:command-code:go", previous]]),
      [harnessSnapshot({ id: "next", notes: "new wording" })],
    );
    expect(notesOnly).toEqual([]);

    const unknownPlan = buildHarnessChangeEvents(
      plans,
      new Map([["plan:command-code:go", previous]]),
      [harnessSnapshot({ id: "next", planId: "plan:unknown", monthlyPriceUsd: 9 })],
    );
    expect(unknownPlan).toEqual([]);
  });

  it("ignores a plan with no previous snapshot", () => {
    const events = buildHarnessChangeEvents(plans, new Map(), [harnessSnapshot()]);
    expect(events).toEqual([]);
  });
});
