import { describe, expect, it } from "vitest";
import { arrayDelta, describeChange, diffSnapshots } from "@/lib/domain/diff";
import {
  computeFreshness,
  formatAge,
  freshnessSortKey,
  thresholdsForDomain,
} from "@/lib/domain/freshness";

describe("diffSnapshots", () => {
  it("reports no change for identical snapshots", () => {
    const snapshot = { monthlyPriceUsd: 10, includedCreditsUsd: 20, models: ["a"] };
    const diff = diffSnapshots(snapshot, { ...snapshot });
    expect(diff.changed).toBe(false);
    expect(diff.changes).toHaveLength(0);
  });

  it("classifies a price change as high significance", () => {
    const diff = diffSnapshots({ monthlyPriceUsd: 10 }, { monthlyPriceUsd: 7 });
    expect(diff.changed).toBe(true);
    expect(diff.significance).toBe("high");

    const change = diff.changes[0];
    expect(change?.field).toBe("monthlyPriceUsd");
    expect(change?.direction).toBe("down");
    expect(change?.percentChange).toBeCloseTo(-30, 6);
  });

  it("classifies a model list change as medium significance", () => {
    const diff = diffSnapshots({ models: ["a"] }, { models: ["a", "b"] });
    expect(diff.significance).toBe("medium");
    expect(diff.changes[0]?.direction).toBe("changed");
  });

  it("marks added and removed fields", () => {
    const diff = diffSnapshots({ a: 1 }, { a: 1, b: 2 });
    expect(diff.changes[0]?.direction).toBe("added");

    const removed = diffSnapshots({ a: 1, b: 2 }, { a: 1 });
    expect(removed.changes[0]?.direction).toBe("removed");
  });

  it("handles a null-before snapshot (new plan)", () => {
    const diff = diffSnapshots(null, { monthlyPriceUsd: 5 });
    expect(diff.changed).toBe(true);
    expect(diff.changes[0]?.direction).toBe("added");
  });

  it("compares arrays and nested objects structurally", () => {
    expect(diffSnapshots({ models: ["a", "b"] }, { models: ["a", "b"] }).changed).toBe(false);
    expect(diffSnapshots({ meta: { x: 1 } }, { meta: { x: 1 } }).changed).toBe(false);
    expect(diffSnapshots({ meta: { x: 1 } }, { meta: { x: 2 } }).changed).toBe(true);
  });

  it("never divides by zero when computing percent change", () => {
    const diff = diffSnapshots({ monthlyPriceUsd: 0 }, { monthlyPriceUsd: 5 });
    expect(diff.changes[0]?.percentChange).toBeNull();
  });

  it("respects custom impact field configuration", () => {
    const diff = diffSnapshots(
      { customField: 1 },
      { customField: 2 },
      { highImpactFields: ["customField"] },
    );
    expect(diff.significance).toBe("high");
  });
});

describe("describeChange", () => {
  it("describes an added field", () => {
    const diff = diffSnapshots({}, { monthlyPriceUsd: 5 });
    const change = diff.changes[0];
    expect(change).toBeDefined();
    expect(describeChange("Command Code GOAT", change!)).toContain("monthly price added");
  });

  it("describes a numeric change with the delta", () => {
    const diff = diffSnapshots({ includedCreditsUsd: 50 }, { includedCreditsUsd: 60 });
    const change = diff.changes[0];
    expect(describeChange("Command Code GOAT", change!)).toContain("+20.0%");
  });

  it("describes a removed field", () => {
    const diff = diffSnapshots({ estimatedRequests: 100 }, {});
    const change = diff.changes[0];
    expect(describeChange("Plan", change!)).toContain("estimated requests removed");
  });
});

describe("arrayDelta", () => {
  it("reports added and removed entries", () => {
    expect(arrayDelta(["a", "b"], ["b", "c"])).toEqual({ added: ["c"], removed: ["a"] });
    expect(arrayDelta([], [])).toEqual({ added: [], removed: [] });
  });
});

describe("freshness", () => {
  const now = new Date("2026-09-18T12:00:00.000Z");

  it("returns unknown for a missing timestamp", () => {
    const result = computeFreshness(null, { now });
    expect(result.state).toBe("unknown");
    expect(result.label).toBe("Never synced");
    expect(result.ageMinutes).toBeNull();
  });

  it("returns unknown for an unparseable timestamp", () => {
    expect(computeFreshness("not-a-date", { now }).state).toBe("unknown");
  });

  it("classifies fresh, aging and stale", () => {
    const thresholds = { freshMinutes: 60, agingMinutes: 360 };
    expect(
      computeFreshness(new Date(now.getTime() - 30 * 60_000).toISOString(), { now, thresholds })
        .state,
    ).toBe("fresh");
    expect(
      computeFreshness(new Date(now.getTime() - 180 * 60_000).toISOString(), { now, thresholds })
        .state,
    ).toBe("aging");
    expect(
      computeFreshness(new Date(now.getTime() - 1000 * 60_000).toISOString(), { now, thresholds })
        .state,
    ).toBe("stale");
  });

  it("never returns a negative age for a future timestamp", () => {
    const result = computeFreshness(new Date(now.getTime() + 60_000).toISOString(), { now });
    expect(result.ageMinutes).toBe(0);
  });

  it("uses domain-specific thresholds", () => {
    expect(thresholdsForDomain("harness").agingMinutes).toBeGreaterThan(
      thresholdsForDomain("models").agingMinutes,
    );
  });

  it("formats ages across scales", () => {
    expect(formatAge(0)).toBe("just now");
    expect(formatAge(5)).toBe("5m ago");
    expect(formatAge(120)).toBe("2h ago");
    expect(formatAge(60 * 24 * 3)).toBe("3d ago");
  });

  it("sorts unknowns last", () => {
    expect(freshnessSortKey(computeFreshness(null, { now }))).toBe(Number.POSITIVE_INFINITY);
  });
});
