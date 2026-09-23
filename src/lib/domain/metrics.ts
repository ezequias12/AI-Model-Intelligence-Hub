/**
 * Derived model metrics.
 *
 * Everything here is a pure function so it can be unit-tested exhaustively and
 * reused identically by the UI, the ingestion pipeline and fixtures.
 *
 * Design rule: never invent a number. If an input metric is missing the derived
 * value is `null`, and the UI must render "—" rather than a fabricated zero.
 */
import type {
  BlendedPriceWeights,
  Model,
  ModelMetrics,
  ValueScoreMode,
  WeightedValueWeights,
} from "./schema";
import { DEFAULT_BLENDED_PRICE_WEIGHTS, DEFAULT_WEIGHTED_VALUE_WEIGHTS } from "./schema";

export type BetterDirection = "higher" | "lower";

/* -------------------------------------------------------------------------- */
/* Blended price                                                               */
/* -------------------------------------------------------------------------- */

export interface BlendedPriceResult {
  /** USD per 1M blended tokens. */
  value: number;
  weights: BlendedPriceWeights;
  input: number;
  output: number;
}

/**
 * Blended price = inputPrice * wInput + outputPrice * wOutput.
 *
 * Default assumption is 75% input / 25% output, matching typical chat/agent
 * workloads where the prompt dominates. The weights are always surfaced in the
 * UI so the assumption is never hidden.
 */
export function blendedPrice(
  metrics: Pick<ModelMetrics, "inputPricePerMillion" | "outputPricePerMillion">,
  weights: BlendedPriceWeights = DEFAULT_BLENDED_PRICE_WEIGHTS,
): BlendedPriceResult | null {
  const { inputPricePerMillion: input, outputPricePerMillion: output } = metrics;
  if (input === null || output === null) return null;

  const total = weights.input + weights.output;
  if (total <= 0) return null;

  const normalized: BlendedPriceWeights = {
    input: weights.input / total,
    output: weights.output / total,
  };

  return {
    value: input * normalized.input + output * normalized.output,
    weights: normalized,
    input,
    output,
  };
}

/* -------------------------------------------------------------------------- */
/* Monthly workload cost                                                       */
/* -------------------------------------------------------------------------- */

export interface WorkloadInput {
  /** Millions of input tokens per month. */
  inputMillions: number;
  /** Millions of output tokens per month. */
  outputMillions: number;
  /** Fraction of input tokens served from cache (0-1). Optional. */
  cacheHitRate?: number;
}

export interface WorkloadCostResult {
  inputCost: number;
  outputCost: number;
  cacheSavings: number;
  totalCost: number;
  workload: WorkloadInput;
}

/**
 * Monthly workload cost:
 *   inputMillions * inputPrice + outputMillions * outputPrice
 *
 * When a cache hit rate and a cache-read price are both available, the cached
 * share of input is priced at the cache rate and the saving is reported
 * explicitly instead of silently discounting the total.
 */
export function monthlyWorkloadCost(
  metrics: Pick<
    ModelMetrics,
    "inputPricePerMillion" | "outputPricePerMillion" | "cacheReadPricePerMillion"
  >,
  workload: WorkloadInput,
): WorkloadCostResult | null {
  const { inputPricePerMillion: inputPrice, outputPricePerMillion: outputPrice } = metrics;
  if (inputPrice === null || outputPrice === null) return null;

  const cacheHitRate = clamp01(workload.cacheHitRate ?? 0);
  const cachePrice = metrics.cacheReadPricePerMillion;

  const cachedMillions = workload.inputMillions * cacheHitRate;
  const uncachedMillions = workload.inputMillions - cachedMillions;

  const uncachedCost = uncachedMillions * inputPrice;
  const cachedCost =
    cachePrice === null ? cachedMillions * inputPrice : cachedMillions * cachePrice;

  const inputCost = uncachedCost + cachedCost;
  const outputCost = workload.outputMillions * outputPrice;
  const cacheSavings =
    cachePrice === null ? 0 : cachedMillions * Math.max(0, inputPrice - cachePrice);

  return {
    inputCost,
    outputCost,
    cacheSavings,
    totalCost: inputCost + outputCost,
    workload: { ...workload, cacheHitRate },
  };
}

/* -------------------------------------------------------------------------- */
/* Value scores                                                                */
/* -------------------------------------------------------------------------- */

export interface ValueScoreOptions {
  mode: ValueScoreMode;
  blendedWeights?: BlendedPriceWeights;
  weightedWeights?: WeightedValueWeights;
  /** Minimum capability index required to be considered. */
  minimumCapability?: number;
  /** Which capability gate applies. Defaults to intelligence. */
  capabilityMetric?: "intelligence" | "coding" | "agentic";
}

export interface ValueScoreResult {
  mode: ValueScoreMode;
  /** Capability units per blended USD. Higher is better. */
  score: number;
  capability: number;
  blendedPriceUsd: number;
  capabilityMetric: "intelligence" | "coding" | "agentic";
  /** For weighted_value the normalized components are exposed for transparency. */
  components?: Record<string, number>;
  weights?: WeightedValueWeights;
  /** True when the model failed the minimum capability gate. */
  belowThreshold: boolean;
  explanation: string;
}

const CAPABILITY_FOR_MODE: Record<
  Exclude<ValueScoreMode, "weighted_value">,
  "intelligence" | "coding" | "agentic"
> = {
  intelligence_per_dollar: "intelligence",
  coding_per_dollar: "coding",
  agentic_per_dollar: "agentic",
};

/**
 * Value score. There is deliberately no mysterious universal number — each mode
 * is an explicit, explainable formula and the caller receives the components.
 *
 * Cheap-but-weak models cannot silently top the board: when a minimum
 * capability threshold is supplied, models below it are flagged and excluded by
 * the caller from ranking.
 */
export function valueScore(
  metrics: ModelMetrics,
  options: ValueScoreOptions,
  population: ModelMetrics[] = [],
): ValueScoreResult | null {
  const blended = blendedPrice(metrics, options.blendedWeights);
  if (!blended || blended.value <= 0) return null;

  if (options.mode === "weighted_value") {
    const weights = options.weightedWeights ?? DEFAULT_WEIGHTED_VALUE_WEIGHTS;
    const components = normalizeCapabilities(metrics, population);
    if (!components) return null;

    // Renormalize the weights over the components the source actually publishes.
    // A source that publishes no agentic index reweights the score instead of
    // switching it off, and the explanation names which components were used.
    const parts: Array<{
      key: "intelligence" | "coding" | "agentic";
      value: number;
      weight: number;
    }> = [];
    for (const key of ["intelligence", "coding", "agentic"] as const) {
      const value = components[key];
      if (value === undefined) continue;
      parts.push({ key, value, weight: weights[key] });
    }

    const weightSum = parts.reduce((total, part) => total + part.weight, 0);
    if (weightSum <= 0) return null;

    const capability =
      parts.reduce((total, part) => total + part.value * part.weight, 0) / weightSum;
    const score = capability / blended.value;
    const gate = gateValue(metrics, options);

    return {
      mode: options.mode,
      score,
      capability,
      capabilityMetric: options.capabilityMetric ?? "intelligence",
      blendedPriceUsd: blended.value,
      components,
      weights,
      belowThreshold: gate === null ? false : gate < (options.minimumCapability ?? 0),
      explanation: `weighted_value = (${parts
        .map((part) => `${part.weight}·${part.key}`)
        .join(" + ")}) / blended_price${
        parts.length < 3 ? `, renormalized over the ${parts.length} published component(s)` : ""
      }`,
    };
  }

  const capabilityMetric = CAPABILITY_FOR_MODE[options.mode];
  const capability = metrics[capabilityMetric];
  if (capability === null) return null;

  const gate = capability;
  return {
    mode: options.mode,
    score: capability / blended.value,
    capability,
    capabilityMetric,
    blendedPriceUsd: blended.value,
    belowThreshold: gate < (options.minimumCapability ?? 0),
    explanation: `${options.mode} = ${capabilityMetric} / blended_price`,
  };
}

/**
 * Min-max normalizes capability indices across the population into 0..1.
 *
 * Only the components the population actually publishes are normalized, and only
 * the ones the model itself reports are returned: a source that publishes no
 * agentic index must not switch the whole score off. The caller renormalizes the
 * weights over whatever comes back, so a missing index reweights the result
 * instead of blanking it. Returns null only when nothing at all can be resolved.
 */
export function normalizeCapabilities(
  metrics: ModelMetrics,
  population: ModelMetrics[],
): Partial<Record<"intelligence" | "coding" | "agentic", number>> | null {
  const keys = ["intelligence", "coding", "agentic"] as const;
  const out: Partial<Record<(typeof keys)[number], number>> = {};

  for (const key of keys) {
    const own = metrics[key];
    if (own === null) continue;

    const values = population
      .map((entry) => entry[key])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (values.length === 0) continue;

    out[key] = normalize(own, Math.min(...values), Math.max(...values));
  }

  return Object.keys(out).length === 0 ? null : out;
}

/* -------------------------------------------------------------------------- */
/* Pareto frontier                                                             */
/* -------------------------------------------------------------------------- */

export interface ParetoPoint<T> {
  item: T;
  x: number;
  y: number;
}

export interface ParetoOptions {
  xBetter: BetterDirection;
  yBetter: BetterDirection;
}

/**
 * Computes the Pareto-optimal set: a point is on the frontier when no other
 * point is at least as good on both axes and strictly better on one.
 *
 * Handles lower-is-better axes (e.g. price) by flipping the comparison.
 */
export function paretoFrontier<T>(
  points: ParetoPoint<T>[],
  options: ParetoOptions,
): ParetoPoint<T>[] {
  const sx = options.xBetter === "higher" ? 1 : -1;
  const sy = options.yBetter === "higher" ? 1 : -1;

  const finite = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const frontier: ParetoPoint<T>[] = [];

  for (const candidate of finite) {
    const cx = candidate.x * sx;
    const cy = candidate.y * sy;

    const dominated = finite.some((other) => {
      if (other === candidate) return false;
      const ox = other.x * sx;
      const oy = other.y * sy;
      const atLeastAsGood = ox >= cx && oy >= cy;
      const strictlyBetter = ox > cx || oy > cy;
      return atLeastAsGood && strictlyBetter;
    });

    if (!dominated) frontier.push(candidate);
  }

  return frontier;
}

/** Convenience wrapper that marks which models belong to the frontier. */
export function paretoFrontierIds<T extends { id: string }>(
  entries: Array<{ item: T; x: number; y: number }>,
  options: ParetoOptions,
): Set<string> {
  return new Set(paretoFrontier(entries, options).map((p) => p.item.id));
}

/* -------------------------------------------------------------------------- */
/* Ranking helpers                                                             */
/* -------------------------------------------------------------------------- */

export interface RankedEntry<T> {
  item: T;
  value: number;
  rank: number;
}

/**
 * Ranks entries with an explicit direction. Entries with a null value are
 * dropped (never ranked last by accident). Ties share the lower rank number.
 */
export function rankBy<T>(
  items: T[],
  getValue: (item: T) => number | null,
  direction: BetterDirection,
  limit?: number,
): RankedEntry<T>[] {
  const withValues = items
    .map((item) => ({ item, value: getValue(item) }))
    .filter((entry): entry is { item: T; value: number } => entry.value !== null)
    .sort((a, b) => (direction === "higher" ? b.value - a.value : a.value - b.value));

  const ranked: RankedEntry<T>[] = [];
  let lastValue: number | null = null;
  let lastRank = 0;

  withValues.forEach((entry, index) => {
    const rank = lastValue !== null && entry.value === lastValue ? lastRank : index + 1;
    lastValue = entry.value;
    lastRank = rank;
    ranked.push({ item: entry.item, value: entry.value, rank });
  });

  return limit === undefined ? ranked : ranked.slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Statistics                                                                  */
/* -------------------------------------------------------------------------- */

export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return clamp01((value - min) / (max - min));
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function median(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  if (upper === undefined) return null;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[mid - 1];
  return lower === undefined ? upper : (lower + upper) / 2;
}

/* -------------------------------------------------------------------------- */
/* Model-level conveniences                                                    */
/* -------------------------------------------------------------------------- */

export function modelBlendedPrice(
  model: Model,
  weights: BlendedPriceWeights = DEFAULT_BLENDED_PRICE_WEIGHTS,
): number | null {
  return blendedPrice(model.metrics, weights)?.value ?? null;
}

/** Percentage change between two snapshots, or null when not computable. */
export function percentChange(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null;
  if (before === 0) return null;
  return ((after - before) / before) * 100;
}

function gateValue(metrics: ModelMetrics, options: ValueScoreOptions): number | null {
  const metric = options.capabilityMetric ?? "intelligence";
  return metrics[metric];
}
