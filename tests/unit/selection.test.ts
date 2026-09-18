import { describe, expect, it } from "vitest";
import {
  applyPreset,
  applyProviderScope,
  clampSelection,
  decodeSelection,
  encodeSelection,
  reconcileSelection,
  resolveDefaultSelection,
  MAX_COMPARISON_MODELS,
} from "@/lib/domain/selection";
import type { Model, Provider } from "@/lib/domain/schema";
import { buildFixtureModels } from "@/lib/fixtures/models";
import { PROVIDER_SEEDS, buildFixtureProviders } from "@/lib/fixtures/providers";

const NOW = new Date("2026-09-18T12:00:00.000Z");

function workspace(): { models: Model[]; providers: Provider[] } {
  const providers = buildFixtureProviders(NOW);
  const models = buildFixtureModels(providers, PROVIDER_SEEDS, NOW);
  return { models, providers };
}

describe("resolveDefaultSelection", () => {
  it("is deterministic for the same inputs", () => {
    const { models, providers } = workspace();
    const first = resolveDefaultSelection(models, providers, { now: NOW });
    const second = resolveDefaultSelection(models, providers, { now: NOW });
    expect(first).toEqual(second);
  });

  it("picks one representative model per default slot", () => {
    const { models, providers } = workspace();
    const ids = resolveDefaultSelection(models, providers, { now: NOW });

    expect(ids.length).toBeGreaterThanOrEqual(6);
    expect(new Set(ids).size).toBe(ids.length);

    const picked = ids.map((id) => models.find((model) => model.id === id));
    const providerIds = picked.map((model) => model?.providerId);
    expect(providerIds).toContain("provider:openai");
    expect(providerIds).toContain("provider:anthropic");
    expect(providerIds).toContain("provider:google");
    expect(providerIds).toContain("provider:deepseek");
  });

  it("never selects a deprecated model", () => {
    const { models, providers } = workspace();
    const ids = resolveDefaultSelection(models, providers, { now: NOW });
    const deprecated = models.filter((model) => model.deprecatedAt && ids.includes(model.id));
    expect(deprecated).toHaveLength(0);
  });

  it("includes an open-weight model in the best-value slot", () => {
    const { models, providers } = workspace();
    const ids = resolveDefaultSelection(models, providers, { now: NOW });
    const openWeightSelected = models.filter((model) => ids.includes(model.id) && model.openWeight);
    expect(openWeightSelected.length).toBeGreaterThan(0);
  });

  it("falls back to the provided ids when nothing resolves", () => {
    const ids = resolveDefaultSelection([], [], { now: NOW, fallbackIds: ["model:x"] });
    expect(ids).toEqual(["model:x"]);
  });
});

describe("applyPreset", () => {
  it("returns the highest coding models for the coding preset", () => {
    const { models, providers } = workspace();
    const application = applyPreset("coding", models, providers, { now: NOW, maxModels: 3 });
    const top = [...models]
      .filter((model) => model.metrics.coding !== null)
      .sort((a, b) => (b.metrics.coding ?? 0) - (a.metrics.coding ?? 0))
      .slice(0, 3)
      .map((model) => model.id);

    expect(application.ids).toEqual(top);
  });

  it("restricts the open-weight preset to open-weight models", () => {
    const { models, providers } = workspace();
    const application = applyPreset("open_weight", models, providers, { now: NOW });
    const contexts = application.ids.map((id) => models.find((model) => model.id === id));
    expect(contexts.every((model) => model?.openWeight === true)).toBe(true);
  });

  it("treats China-based as a grouping, not a quality ranking", () => {
    const { models, providers } = workspace();
    const application = applyPreset("china_based", models, providers, { now: NOW });
    const chinaProviderIds = new Set(
      providers
        .filter((provider) => provider.group === "china_based")
        .map((provider) => provider.id),
    );
    const picked = application.ids.map((id) => models.find((model) => model.id === id));
    expect(picked.every((model) => model && chinaProviderIds.has(model.providerId))).toBe(true);
  });
});

describe("applyProviderScope", () => {
  it("returns everything for the 'all' filter", () => {
    const { models, providers } = workspace();
    expect(applyProviderScope(models, providers, { filter: "all" })).toHaveLength(models.length);
  });

  it("splits open and closed weight models", () => {
    const { models, providers } = workspace();
    const open = applyProviderScope(models, providers, { filter: "open_weight" });
    const closed = applyProviderScope(models, providers, { filter: "closed" });
    expect(open.length + closed.length).toBe(models.length);
    expect(open.every((model) => model.openWeight)).toBe(true);
    expect(closed.every((model) => !model.openWeight)).toBe(true);
  });

  it("honours an explicit custom provider list", () => {
    const { models, providers } = workspace();
    const scoped = applyProviderScope(models, providers, {
      filter: "custom",
      providerIds: ["provider:openai"],
    });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((model) => model.providerId === "provider:openai")).toBe(true);
  });

  it("falls back to everything when the custom list is empty", () => {
    const { models, providers } = workspace();
    expect(
      applyProviderScope(models, providers, { filter: "custom", providerIds: [] }),
    ).toHaveLength(models.length);
  });
});

describe("selection URL state", () => {
  it("round-trips through encode/decode", () => {
    const ids = ["model:a", "model:b"];
    expect(decodeSelection(encodeSelection(ids))).toEqual(ids);
  });

  it("ignores empty and malformed input", () => {
    expect(decodeSelection(null)).toEqual([]);
    expect(decodeSelection("")).toEqual([]);
    expect(decodeSelection(" , , ")).toEqual([]);
  });

  it("drops unknown ids so a stale shared link degrades gracefully", () => {
    const { models } = workspace();
    const reconciled = reconcileSelection(["model:gpt-5-2", "model:does-not-exist"], models);
    expect(reconciled).toEqual(["model:gpt-5-2"]);
  });

  it("de-duplicates while preserving order", () => {
    const { models } = workspace();
    expect(reconcileSelection(["model:gpt-5-2", "model:gpt-5-2"], models)).toEqual([
      "model:gpt-5-2",
    ]);
  });

  it("clamps the comparison set to the maximum", () => {
    const ids = Array.from({ length: 20 }, (_, index) => `model:${index}`);
    expect(clampSelection(ids)).toHaveLength(MAX_COMPARISON_MODELS);
  });
});
