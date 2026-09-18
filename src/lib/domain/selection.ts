/**
 * Model selection: default comparison set, presets, provider grouping and
 * URL/local-storage state.
 *
 * The default set is resolved dynamically from provider metadata and current
 * metrics instead of being hard-coded to specific model names, so it stays
 * useful as models rotate.
 */
import type { Model, Provider, ProviderGroup } from "./schema";
import { blendedPrice, median } from "./metrics";

/* -------------------------------------------------------------------------- */
/* Default slots                                                               */
/* -------------------------------------------------------------------------- */

export interface DefaultSlot {
  key: string;
  label: string;
  /** Which provider slugs are eligible. Empty = any. */
  providerSlugs: string[];
  /** Metric used to pick the representative model. */
  metric: "intelligence" | "coding" | "agentic";
  /** Restrict to open-weight models. */
  openWeightOnly?: boolean;
  /** Restrict to the cheapest models passing a capability floor. */
  cheapestAboveCapabilityFloor?: boolean;
}

/**
 * Default comparison set: one current representative model per major lab, plus
 * one strong low-cost/open option. Slots that no model satisfies are skipped
 * rather than faked.
 */
export const DEFAULT_SLOTS: DefaultSlot[] = [
  {
    key: "openai_flagship",
    label: "OpenAI flagship",
    providerSlugs: ["openai"],
    metric: "intelligence",
  },
  {
    key: "anthropic_flagship",
    label: "Anthropic flagship",
    providerSlugs: ["anthropic"],
    metric: "intelligence",
  },
  {
    key: "google_flagship",
    label: "Google flagship",
    providerSlugs: ["google", "google-deepmind"],
    metric: "intelligence",
  },
  { key: "xai_flagship", label: "xAI flagship", providerSlugs: ["xai"], metric: "intelligence" },
  {
    key: "deepseek_flagship",
    label: "DeepSeek flagship",
    providerSlugs: ["deepseek"],
    metric: "intelligence",
  },
  {
    key: "qwen_flagship",
    label: "Alibaba/Qwen flagship",
    providerSlugs: ["alibaba", "qwen"],
    metric: "intelligence",
  },
  {
    key: "moonshot_flagship",
    label: "Moonshot/Kimi flagship",
    providerSlugs: ["moonshot", "moonshot-ai", "kimi"],
    metric: "intelligence",
  },
  {
    key: "best_open_value",
    label: "Best-value open model",
    providerSlugs: [],
    metric: "intelligence",
    openWeightOnly: true,
    cheapestAboveCapabilityFloor: true,
  },
];

function isActive(model: Model, now: Date): boolean {
  if (model.deprecatedAt && Date.parse(model.deprecatedAt) <= now.getTime()) return false;
  return true;
}

function sortByMetric(models: Model[], metric: DefaultSlot["metric"]): Model[] {
  return [...models].sort((a, b) => {
    const av = a.metrics[metric] ?? Number.NEGATIVE_INFINITY;
    const bv = b.metrics[metric] ?? Number.NEGATIVE_INFINITY;
    if (bv !== av) return bv - av;
    const ad = a.releaseDate ? Date.parse(a.releaseDate) : 0;
    const bd = b.releaseDate ? Date.parse(b.releaseDate) : 0;
    return bd - ad;
  });
}

export interface ResolveDefaultOptions {
  now?: Date;
  slots?: DefaultSlot[];
  /** Fallback ids used when nothing resolves (mock mode guarantee). */
  fallbackIds?: string[];
}

/**
 * Resolves the default comparison set. Deterministic: same inputs always
 * produce the same output, which keeps fixtures and E2E tests stable.
 */
export function resolveDefaultSelection(
  models: Model[],
  providers: Provider[],
  options: ResolveDefaultOptions = {},
): string[] {
  const now = options.now ?? new Date();
  const slots = options.slots ?? DEFAULT_SLOTS;
  const providerBySlug = new Map(providers.map((p) => [p.slug, p]));
  const active = models.filter((m) => isActive(m, now));

  const capabilityFloor = median(
    active.map((m) => m.metrics.intelligence).filter((v): v is number => v !== null),
  );

  const selected: string[] = [];

  for (const slot of slots) {
    let pool = active;

    if (slot.providerSlugs.length > 0) {
      const providerIds = new Set(
        slot.providerSlugs
          .map((slug) => providerBySlug.get(slug)?.id)
          .filter((id): id is string => Boolean(id)),
      );
      pool = pool.filter((m) => providerIds.has(m.providerId));
    }

    if (slot.openWeightOnly) pool = pool.filter((m) => m.openWeight);

    if (slot.cheapestAboveCapabilityFloor && capabilityFloor !== null) {
      const qualifying = pool.filter(
        (m) => (m.metrics.intelligence ?? Number.NEGATIVE_INFINITY) >= capabilityFloor,
      );
      if (qualifying.length > 0) pool = qualifying;
    }

    if (slot.cheapestAboveCapabilityFloor) {
      pool = [...pool].sort((a, b) => {
        const ap = blendedPrice(a.metrics)?.value ?? Number.POSITIVE_INFINITY;
        const bp = blendedPrice(b.metrics)?.value ?? Number.POSITIVE_INFINITY;
        if (ap !== bp) return ap - bp;
        return (b.metrics.intelligence ?? 0) - (a.metrics.intelligence ?? 0);
      });
    } else {
      pool = sortByMetric(pool, slot.metric);
    }

    const winner = pool[0];
    if (winner && !selected.includes(winner.id)) selected.push(winner.id);
  }

  if (selected.length === 0 && options.fallbackIds) {
    return options.fallbackIds.slice();
  }

  return selected;
}

/* -------------------------------------------------------------------------- */
/* Presets                                                                     */
/* -------------------------------------------------------------------------- */

export const PRESET_KEYS = [
  "frontier",
  "best_value",
  "fast",
  "coding",
  "agentic",
  "open_weight",
  "mainstream_western",
  "china_based",
  "custom",
] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export const PRESET_LABELS: Record<PresetKey, string> = {
  frontier: "Frontier",
  best_value: "Best Value",
  fast: "Fast",
  coding: "Coding",
  agentic: "Agentic",
  open_weight: "Open / Open-weight",
  mainstream_western: "Mainstream Providers",
  china_based: "China-based Labs",
  custom: "Custom",
};

export interface PresetApplication {
  key: PresetKey;
  ids: string[];
  /** True when the preset could not fully resolve and fell back to fewer models. */
  degraded: boolean;
}

export interface ApplyPresetOptions {
  maxModels?: number;
  now?: Date;
}

export function applyPreset(
  preset: PresetKey,
  models: Model[],
  providers: Provider[],
  options: ApplyPresetOptions = {},
): PresetApplication {
  const now = options.now ?? new Date();
  const max = options.maxModels ?? 6;
  const providerById = new Map(providers.map((p) => [p.id, p]));
  const active = models.filter((m) => isActive(m, now));
  const take = (list: Model[]) => list.slice(0, max).map((m) => m.id);

  const rank = (pool: Model[], metric: keyof Model["metrics"]) =>
    [...pool]
      .filter((m) => m.metrics[metric] !== null)
      .sort((a, b) => (b.metrics[metric] ?? 0) - (a.metrics[metric] ?? 0));

  switch (preset) {
    case "frontier":
      return { key: preset, ids: take(rank(active, "intelligence")), degraded: false };
    case "fast":
      return { key: preset, ids: take(rank(active, "outputSpeedTps")), degraded: false };
    case "coding":
      return { key: preset, ids: take(rank(active, "coding")), degraded: false };
    case "agentic":
      return { key: preset, ids: take(rank(active, "agentic")), degraded: false };
    case "open_weight":
      return {
        key: preset,
        ids: take(
          rank(
            active.filter((m) => m.openWeight),
            "intelligence",
          ),
        ),
        degraded: false,
      };
    case "mainstream_western":
      return {
        key: preset,
        ids: take(
          rank(
            active.filter((m) => providerById.get(m.providerId)?.group === "mainstream_global"),
            "intelligence",
          ),
        ),
        degraded: false,
      };
    case "china_based":
      return {
        key: preset,
        ids: take(
          rank(
            active.filter((m) => providerById.get(m.providerId)?.group === "china_based"),
            "intelligence",
          ),
        ),
        degraded: false,
      };
    case "best_value":
    case "custom":
    default: {
      const withPrice = active.filter((m) => blendedPrice(m.metrics) !== null);
      const sorted = [...withPrice].sort((a, b) => {
        const ac = (a.metrics.intelligence ?? 0) / (blendedPrice(a.metrics)?.value ?? 1);
        const bc = (b.metrics.intelligence ?? 0) / (blendedPrice(b.metrics)?.value ?? 1);
        return bc - ac;
      });
      return { key: preset, ids: take(sorted), degraded: false };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Provider group filter                                                       */
/* -------------------------------------------------------------------------- */

export const PROVIDER_FILTER_VALUES = [
  "all",
  "mainstream",
  "china_based",
  "open_weight",
  "closed",
  "custom",
] as const;
export type ProviderFilterValue = (typeof PROVIDER_FILTER_VALUES)[number];

export const PROVIDER_FILTER_LABELS: Record<ProviderFilterValue, string> = {
  all: "All",
  mainstream: "Mainstream",
  china_based: "China-based",
  open_weight: "Open-weight",
  closed: "Closed",
  custom: "Custom",
};

export interface ProviderScope {
  filter: ProviderFilterValue;
  /** Only used when filter === "custom". */
  providerIds?: string[];
}

/**
 * Applies a provider scope to a model list. "Mainstream" and "China-based" are
 * geographic/structural groupings, never quality judgements.
 */
export function applyProviderScope(
  models: Model[],
  providers: Provider[],
  scope: ProviderScope,
): Model[] {
  const providerById = new Map(providers.map((p) => [p.id, p]));

  switch (scope.filter) {
    case "all":
      return models;
    case "mainstream":
      return models.filter((m) => providerById.get(m.providerId)?.group === "mainstream_global");
    case "china_based":
      return models.filter((m) => providerById.get(m.providerId)?.group === "china_based");
    case "open_weight":
      return models.filter((m) => m.openWeight);
    case "closed":
      return models.filter((m) => !m.openWeight);
    case "custom": {
      const allowed = new Set(scope.providerIds ?? []);
      if (allowed.size === 0) return models;
      return models.filter((m) => allowed.has(m.providerId));
    }
    default:
      return models;
  }
}

export function groupForProvider(provider: Provider | undefined): ProviderGroup {
  return provider?.group ?? "other";
}

/* -------------------------------------------------------------------------- */
/* URL + storage state                                                         */
/* -------------------------------------------------------------------------- */

export const SELECTION_QUERY_PARAM = "models";
export const SELECTION_STORAGE_KEY = "amih.models.selection.v1";
export const SELECTION_SOURCE_KEY = "amih.models.selectionSource.v1";
export type SelectionSource = "default" | "preset" | "custom";

export function encodeSelection(ids: string[]): string {
  return ids.join(",");
}

export function decodeSelection(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** Removes ids that no longer exist so a stale shared URL degrades gracefully. */
export function reconcileSelection(ids: string[], models: Model[]): string[] {
  const known = new Set(models.map((m) => m.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export interface SelectionState {
  ids: string[];
  source: SelectionSource;
  preset: PresetKey | null;
}

export const MAX_COMPARISON_MODELS = 8;

export function clampSelection(ids: string[], max = MAX_COMPARISON_MODELS): string[] {
  return ids.slice(0, max);
}
