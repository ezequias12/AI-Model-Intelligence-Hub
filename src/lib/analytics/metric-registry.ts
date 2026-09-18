/**
 * Metric registry.
 *
 * Every metric the product can rank, chart, filter or export is declared once
 * here with its direction (higher/lower is better), its display format and
 * whether it is measured or derived. Rankings, the table, the charts and the
 * methodology page all read from this registry, so a metric can never mean two
 * different things in two different screens.
 */
import type { Model, ModelMetrics, Provider } from "@/lib/domain/schema";
import { blendedPrice, valueScore, type BetterDirection } from "@/lib/domain/metrics";
import {
  formatContextWindow,
  formatScore,
  formatSpeed,
  formatTtft,
  formatUnitPrice,
} from "@/lib/format";

export type MetricGroup = "capability" | "performance" | "cost" | "derived";

export interface ModelContext {
  model: Model;
  provider: Provider | undefined;
  /** Derived blended price using the default 75/25 weighting. */
  blendedPrice: number | null;
  /** Previous snapshot metrics, when history exists. */
  previous: ModelMetrics | null;
  /** All models in the population, used for normalisation. */
  population: ModelMetrics[];
}

export interface MetricDefinition {
  key: string;
  label: string;
  shortLabel: string;
  group: MetricGroup;
  direction: BetterDirection;
  /** `measured` comes from the source payload; `derived` is computed here. */
  provenance: "measured" | "derived";
  unit: string | null;
  description: string;
  get: (context: ModelContext) => number | null;
  format: (value: number | null) => string;
}

const fmtScore = (value: number | null): string => formatScore(value);
const fmtUsd = (value: number | null): string => formatUnitPrice(value);
const fmtSpeed = (value: number | null): string => formatSpeed(value);
const fmtTtft = (value: number | null): string => formatTtft(value);
const fmtContext = (value: number | null): string => formatContextWindow(value);
const fmtRatio = (value: number | null): string =>
  value === null || !Number.isFinite(value)
    ? "—"
    : value >= 100
      ? Math.round(value).toString()
      : value.toFixed(2);

export const METRICS: MetricDefinition[] = [
  {
    key: "intelligence",
    label: "Intelligence",
    shortLabel: "Intel",
    group: "capability",
    direction: "higher",
    provenance: "measured",
    unit: null,
    description:
      "Composite reasoning and general capability index as published by the metrics source.",
    get: (context) => context.model.metrics.intelligence,
    format: fmtScore,
  },
  {
    key: "coding",
    label: "Coding",
    shortLabel: "Coding",
    group: "capability",
    direction: "higher",
    provenance: "measured",
    unit: null,
    description: "Coding-specific index. Not a substitute for evaluating your own repository.",
    get: (context) => context.model.metrics.coding,
    format: fmtScore,
  },
  {
    key: "agentic",
    label: "Agentic / tool use",
    shortLabel: "Agentic",
    group: "capability",
    direction: "higher",
    provenance: "measured",
    unit: null,
    description:
      "Tool-use and long-horizon task index. Highly sensitive to the surrounding agent scaffold.",
    get: (context) => context.model.metrics.agentic,
    format: fmtScore,
  },
  {
    key: "math",
    label: "Math",
    shortLabel: "Math",
    group: "capability",
    direction: "higher",
    provenance: "measured",
    unit: null,
    description: "Math benchmark index, where the source publishes it separately.",
    get: (context) => context.model.metrics.math,
    format: fmtScore,
  },
  {
    key: "outputSpeedTps",
    label: "Output speed",
    shortLabel: "Speed",
    group: "performance",
    direction: "higher",
    provenance: "measured",
    unit: "tok/s",
    description: "Median output tokens per second observed by the metrics source.",
    get: (context) => context.model.metrics.outputSpeedTps,
    format: fmtSpeed,
  },
  {
    key: "ttftSeconds",
    label: "Time to first token",
    shortLabel: "TTFT",
    group: "performance",
    direction: "lower",
    provenance: "measured",
    unit: "s",
    description: "Median time to first token. Lower is better.",
    get: (context) => context.model.metrics.ttftSeconds,
    format: fmtTtft,
  },
  {
    key: "contextWindow",
    label: "Context window",
    shortLabel: "Context",
    group: "capability",
    direction: "higher",
    provenance: "measured",
    unit: "tokens",
    description: "Maximum documented context window, in tokens.",
    get: (context) => context.model.metrics.contextWindow,
    format: fmtContext,
  },
  {
    key: "inputPricePerMillion",
    label: "Input price",
    shortLabel: "$ in",
    group: "cost",
    direction: "lower",
    provenance: "measured",
    unit: "USD / 1M tokens",
    description: "Published price for input tokens. Lower is better.",
    get: (context) => context.model.metrics.inputPricePerMillion,
    format: fmtUsd,
  },
  {
    key: "outputPricePerMillion",
    label: "Output price",
    shortLabel: "$ out",
    group: "cost",
    direction: "lower",
    provenance: "measured",
    unit: "USD / 1M tokens",
    description: "Published price for output tokens. Lower is better.",
    get: (context) => context.model.metrics.outputPricePerMillion,
    format: fmtUsd,
  },
  {
    key: "cacheReadPricePerMillion",
    label: "Cache read price",
    shortLabel: "$ cache",
    group: "cost",
    direction: "lower",
    provenance: "measured",
    unit: "USD / 1M tokens",
    description:
      "Cached input read price. Reported separately because caching changes real workloads materially.",
    get: (context) => context.model.metrics.cacheReadPricePerMillion,
    format: fmtUsd,
  },
  {
    key: "blendedPrice",
    label: "Blended price",
    shortLabel: "Blended",
    group: "cost",
    direction: "lower",
    provenance: "derived",
    unit: "USD / 1M tokens",
    description:
      "Derived: 75% input price + 25% output price. The weighting is an assumption and is labeled as such everywhere it appears.",
    get: (context) => context.blendedPrice,
    format: fmtUsd,
  },
  {
    key: "intelligencePerDollar",
    label: "Intelligence per dollar",
    shortLabel: "Intel/$",
    group: "derived",
    direction: "higher",
    provenance: "derived",
    unit: "index points per USD",
    description: "Derived: intelligence index divided by blended price.",
    get: (context) =>
      valueScore(context.model.metrics, {
        mode: "intelligence_per_dollar",
      })?.score ?? null,
    format: fmtRatio,
  },
  {
    key: "codingPerDollar",
    label: "Coding per dollar",
    shortLabel: "Coding/$",
    group: "derived",
    direction: "higher",
    provenance: "derived",
    unit: "index points per USD",
    description: "Derived: coding index divided by blended price.",
    get: (context) =>
      valueScore(context.model.metrics, { mode: "coding_per_dollar" })?.score ?? null,
    format: fmtRatio,
  },
  {
    key: "agenticPerDollar",
    label: "Agentic per dollar",
    shortLabel: "Agentic/$",
    group: "derived",
    direction: "higher",
    provenance: "derived",
    unit: "index points per USD",
    description: "Derived: agentic index divided by blended price.",
    get: (context) =>
      valueScore(context.model.metrics, { mode: "agentic_per_dollar" })?.score ?? null,
    format: fmtRatio,
  },
  {
    key: "weightedValue",
    label: "Weighted value",
    shortLabel: "Weighted",
    group: "derived",
    direction: "higher",
    provenance: "derived",
    unit: "normalised capability per USD",
    description:
      "Derived: min-max normalised intelligence/coding/agentic (weights 0.5/0.3/0.2) divided by blended price.",
    get: (context) =>
      valueScore(context.model.metrics, { mode: "weighted_value" }, context.population)?.score ??
      null,
    format: fmtRatio,
  },
];

export const METRIC_BY_KEY = new Map(METRICS.map((metric) => [metric.key, metric]));

export function getMetric(key: string): MetricDefinition | undefined {
  return METRIC_BY_KEY.get(key);
}

export function metricDirection(
  key: string,
  fallback: BetterDirection = "higher",
): BetterDirection {
  return METRIC_BY_KEY.get(key)?.direction ?? fallback;
}

export function formatMetric(key: string, value: number | null): string {
  return METRIC_BY_KEY.get(key)?.format(value) ?? (value === null ? "—" : String(value));
}

/** Metrics that make sense as a scatter-chart axis. */
export const CHART_METRIC_KEYS = [
  "blendedPrice",
  "intelligence",
  "coding",
  "agentic",
  "outputSpeedTps",
  "ttftSeconds",
  "inputPricePerMillion",
  "outputPricePerMillion",
  "contextWindow",
  "weightedValue",
] as const;

/** Metrics pre-selected for the dense table, in display order. */
export const DEFAULT_TABLE_METRIC_KEYS = [
  "intelligence",
  "coding",
  "agentic",
  "inputPricePerMillion",
  "outputPricePerMillion",
  "cacheReadPricePerMillion",
  "outputSpeedTps",
  "ttftSeconds",
  "contextWindow",
] as const;

export function buildModelContexts(
  models: Model[],
  providers: Provider[],
  previousByModelId: Map<string, ModelMetrics>,
): ModelContext[] {
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const population = models.map((model) => model.metrics);

  return models.map((model) => ({
    model,
    provider: providerById.get(model.providerId),
    blendedPrice: blendedPrice(model.metrics)?.value ?? null,
    previous: previousByModelId.get(model.id) ?? null,
    population,
  }));
}

/** The single source of truth for the metric list shown on the Methodology page. */
export function metricCatalog(): Array<
  Pick<
    MetricDefinition,
    "key" | "label" | "group" | "direction" | "provenance" | "unit" | "description"
  >
> {
  return METRICS.map((metric) => ({
    key: metric.key,
    label: metric.label,
    group: metric.group,
    direction: metric.direction,
    provenance: metric.provenance,
    unit: metric.unit,
    description: metric.description,
  }));
}
