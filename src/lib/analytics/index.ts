/**
 * Analytics assembly.
 *
 * Pure functions that turn a model population into the exact structures the
 * workspace renders: metric leaders, ranking boards, chart series and release
 * history. Keeping this out of components means the same numbers are used by
 * the UI, the tests and (later) any export.
 */
import type { ChangeEvent, ModelMetrics } from "@/lib/domain/schema";
import {
  paretoFrontier,
  rankBy,
  percentChange,
  blendedPrice,
  type BetterDirection,
} from "@/lib/domain/metrics";
import { DEFAULT_BLENDED_PRICE_WEIGHTS } from "@/lib/domain/schema";
import { applyProviderScope, type ProviderScope } from "@/lib/domain/selection";
import type { ModelContext } from "./metric-registry";
import { getMetric, METRICS } from "./metric-registry";

/* -------------------------------------------------------------------------- */
/* Metric leaders                                                              */
/* -------------------------------------------------------------------------- */

export interface LeaderCard {
  id: string;
  metricKey: string;
  label: string;
  /** One-line explanation of what the card answers. */
  question: string;
  metricLabel: string;
  metricDisplay: string;
  value: number | null;
  delta: number | null;
  deltaDirection: BetterDirection;
  context: ModelContext | null;
  /** True when no model satisfied the card's constraint. */
  empty: boolean;
}

export const LEADER_CARDS: Array<{
  id: string;
  metricKey: string;
  label: string;
  question: string;
}> = [
  {
    id: "highest_intelligence",
    metricKey: "intelligence",
    label: "Highest intelligence",
    question: "Which model scores highest overall?",
  },
  {
    id: "best_coding",
    metricKey: "coding",
    label: "Best coding",
    question: "Which model leads on code?",
  },
  {
    id: "best_agentic",
    metricKey: "agentic",
    label: "Best agentic",
    question: "Which model handles tools and long tasks best?",
  },
  {
    id: "fastest_output",
    metricKey: "outputSpeedTps",
    label: "Fastest output",
    question: "Which model streams fastest?",
  },
  {
    id: "lowest_input_price",
    metricKey: "inputPricePerMillion",
    label: "Lowest input price",
    question: "Cheapest input tokens?",
  },
  {
    id: "lowest_output_price",
    metricKey: "outputPricePerMillion",
    label: "Lowest output price",
    question: "Cheapest output tokens?",
  },
  {
    id: "best_weighted_value",
    metricKey: "weightedValue",
    label: "Best weighted value",
    question: "Best capability per dollar?",
  },
];

export function computeLeaderCards(
  contexts: ModelContext[],
  options: { minimumCapability?: number } = {},
): LeaderCard[] {
  const minimum = options.minimumCapability ?? 0;

  const cards = LEADER_CARDS.map<LeaderCard>((definition) => {
    const metric = getMetric(definition.metricKey);
    if (!metric) {
      return {
        id: definition.id,
        metricKey: definition.metricKey,
        label: definition.label,
        question: definition.question,
        metricLabel: definition.metricKey,
        metricDisplay: "—",
        value: null,
        delta: null,
        deltaDirection: "higher",
        context: null,
        empty: true,
      };
    }

    const ranked = rankBy(
      contexts.filter((context) => {
        const capability = context.model.metrics.intelligence;
        return minimum <= 0 || capability === null || capability >= minimum;
      }),
      (context) => metric.get(context),
      metric.direction,
      1,
    );

    const winner = ranked[0]?.item ?? null;
    const value = winner ? metric.get(winner) : null;
    const previousValue =
      winner && winner.previous
        ? getMetricFromMetrics(winner.previous, definition.metricKey, winner)
        : null;
    const delta =
      metric.provenance === "derived" ? null : percentChange(previousValue ?? null, value ?? null);

    return {
      id: definition.id,
      metricKey: definition.metricKey,
      label: definition.label,
      question: definition.question,
      metricLabel: metric.label,
      metricDisplay: metric.format(value),
      value,
      delta,
      deltaDirection: metric.direction,
      context: winner,
      empty: winner === null,
    };
  });

  const newestMetric = contexts
    .filter((context) => context.model.releaseDate && !context.model.deprecatedAt)
    .sort(
      (a, b) => Date.parse(b.model.releaseDate ?? "") - Date.parse(a.model.releaseDate ?? ""),
    )[0];

  cards.push({
    id: "newest_relevant",
    metricKey: "releaseDate",
    label: "Newest relevant model",
    question: "What changed most recently?",
    metricLabel: "Release date",
    metricDisplay: newestMetric?.model.releaseDate
      ? new Date(newestMetric.model.releaseDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—",
    value: null,
    delta: null,
    deltaDirection: "higher",
    context: newestMetric ?? null,
    empty: !newestMetric,
  });

  return cards;
}

/** Recomputes a derived metric against a historical snapshot. */
function getMetricFromMetrics(
  metrics: ModelMetrics,
  metricKey: string,
  context: ModelContext,
): number | null {
  if (metricKey === "blendedPrice") {
    return blendedPrice(metrics, DEFAULT_BLENDED_PRICE_WEIGHTS)?.value ?? null;
  }
  const key = metricKey as keyof ModelMetrics;
  if (key in metrics) {
    const value = metrics[key];
    return typeof value === "number" ? value : null;
  }
  // Derived value metrics need the population; approximate with the historical
  // metric over the current price rather than inventing a number.
  void context;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Ranking boards                                                              */
/* -------------------------------------------------------------------------- */

export interface RankingBoardDefinition {
  id: string;
  title: string;
  metricKey: string;
  description: string;
  /** Marks the cost-efficiency boards that need the capability threshold. */
  emphasisesCostEfficiency?: boolean;
}

export const RANKING_BOARDS: RankingBoardDefinition[] = [
  {
    id: "intelligence",
    title: "Top 10 Intelligence",
    metricKey: "intelligence",
    description: "Overall capability index.",
  },
  {
    id: "coding",
    title: "Top 10 Coding",
    metricKey: "coding",
    description: "Coding-specific index.",
  },
  {
    id: "agentic",
    title: "Top 10 Agentic",
    metricKey: "agentic",
    description: "Tool use and long-horizon tasks.",
  },
  {
    id: "speed",
    title: "Top 10 Speed",
    metricKey: "outputSpeedTps",
    description: "Median output tokens per second.",
  },
  {
    id: "input_price",
    title: "Top 10 Lowest Input Price",
    metricKey: "inputPricePerMillion",
    description: "Cheapest input tokens.",
  },
  {
    id: "output_price",
    title: "Top 10 Lowest Output Price",
    metricKey: "outputPricePerMillion",
    description: "Cheapest output tokens.",
  },
  {
    id: "blended_price",
    title: "Top 10 Lowest Blended Price",
    metricKey: "blendedPrice",
    description: "75% input + 25% output.",
  },
  {
    id: "value_intelligence",
    title: "Top 10 Cost Efficient — Intelligence",
    metricKey: "intelligencePerDollar",
    description: "Intelligence index per blended dollar.",
    emphasisesCostEfficiency: true,
  },
  {
    id: "value_coding",
    title: "Top 10 Cost Efficient — Coding",
    metricKey: "codingPerDollar",
    description: "Coding index per blended dollar.",
    emphasisesCostEfficiency: true,
  },
  {
    id: "value_agentic",
    title: "Top 10 Cost Efficient — Agentic",
    metricKey: "agenticPerDollar",
    description: "Agentic index per blended dollar.",
    emphasisesCostEfficiency: true,
  },
  {
    id: "value_weighted",
    title: "Top 10 Cost Efficient — Weighted",
    metricKey: "weightedValue",
    description: "Weighted normalised capability per blended dollar.",
    emphasisesCostEfficiency: true,
  },
  {
    id: "hf_downloads",
    title: "Most-downloaded open models",
    metricKey: "hfDownloads",
    description: "Hugging Face 30-day downloads. Popularity, not capability.",
  },
  {
    id: "hf_likes",
    title: "Most-liked open models",
    metricKey: "hfLikes",
    description: "Hugging Face likes. Popularity, not capability.",
  },
];

export interface RankingRow {
  rank: number;
  context: ModelContext;
  value: number;
  display: string;
  delta: number | null;
  selected: boolean;
}

export interface RankingBoardResult {
  definition: RankingBoardDefinition;
  rows: RankingRow[];
  /** Models excluded because they fell below the capability threshold. */
  excludedBelowThreshold: number;
  /** Models excluded because the metric is unavailable for them. */
  excludedNoData: number;
  populationSize: number;
  methodology: string;
}

export interface RankingOptions {
  scope: "selected" | "all";
  providerScope: ProviderScope;
  selectedIds: string[];
  minimumCapability: number;
  limit?: number;
}

export function computeRankings(
  contexts: ModelContext[],
  options: RankingOptions,
): RankingBoardResult[] {
  const limit = options.limit ?? 10;

  const scoped =
    options.scope === "selected"
      ? contexts.filter((context) => options.selectedIds.includes(context.model.id))
      : applyProviderScope(
          contexts.map((context) => context.model),
          contexts
            .map((context) => context.provider)
            .filter((provider): provider is NonNullable<typeof provider> => Boolean(provider)),
          options.providerScope,
        ).map((model) => contexts.find((context) => context.model.id === model.id)!);

  let excludedBelowThreshold = 0;
  const eligible = scoped.filter((context) => {
    const capability = context.model.metrics.intelligence;
    if (
      options.minimumCapability > 0 &&
      capability !== null &&
      capability < options.minimumCapability
    ) {
      excludedBelowThreshold += 1;
      return false;
    }
    return true;
  });

  return RANKING_BOARDS.map((definition) => {
    const metric = getMetric(definition.metricKey);
    if (!metric) {
      return {
        definition,
        rows: [],
        excludedBelowThreshold,
        excludedNoData: 0,
        populationSize: eligible.length,
        methodology: "Metric not registered.",
      };
    }

    const withData = eligible.filter((context) => metric.get(context) !== null);
    const ranked = rankBy(eligible, (context) => metric.get(context), metric.direction, limit);

    return {
      definition,
      rows: ranked.map((entry) => ({
        rank: entry.rank,
        context: entry.item,
        value: entry.value,
        display: metric.format(entry.value),
        delta:
          entry.item.previous && metric.provenance === "measured"
            ? percentChange(
                getMetricFromMetrics(entry.item.previous, definition.metricKey, entry.item),
                entry.value,
              )
            : null,
        selected: options.selectedIds.includes(entry.item.model.id),
      })),
      excludedBelowThreshold,
      excludedNoData: scoped.length - withData.length,
      populationSize: eligible.length,
      methodology: metric.description,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Charts                                                                      */
/* -------------------------------------------------------------------------- */

export interface LandscapePoint {
  id: string;
  name: string;
  shortName: string;
  providerName: string;
  providerColor: string;
  providerGroup: string;
  x: number;
  y: number;
  bubble: number | null;
  selected: boolean;
  onFrontier: boolean;
}

export interface LandscapeChartResult {
  points: LandscapePoint[];
  xKey: string;
  yKey: string;
  bubbleKey: string | null;
  xLabel: string;
  yLabel: string;
  bubbleLabel: string | null;
  /** Human-readable description of the frontier computation. */
  frontierRule: string;
}

export function computeLandscapeChart(
  contexts: ModelContext[],
  options: {
    xKey: string;
    yKey: string;
    bubbleKey?: string | null;
    selectedIds: string[];
    showFrontier: boolean;
    bubblesByContextSize?: boolean;
  },
): LandscapeChartResult {
  const xMetric = getMetric(options.xKey);
  const yMetric = getMetric(options.yKey);
  const bubbleMetric = options.bubbleKey ? getMetric(options.bubbleKey) : undefined;

  const usable = contexts.filter(
    (context) => xMetric?.get(context) !== null && yMetric?.get(context) !== null,
  );

  const frontier = options.showFrontier
    ? paretoFrontier(
        usable.map((context) => ({
          item: context,
          x: xMetric?.get(context) ?? 0,
          y: yMetric?.get(context) ?? 0,
        })),
        {
          xBetter: xMetric?.direction ?? "higher",
          yBetter: yMetric?.direction ?? "higher",
        },
      )
    : [];

  const frontierIds = new Set(frontier.map((point) => point.item.model.id));

  const points: LandscapePoint[] = usable.map((context) => ({
    id: context.model.id,
    name: context.model.name,
    shortName: context.model.shortName,
    providerName: context.provider?.name ?? "Unknown provider",
    providerColor: context.provider?.color ?? "#94a3b8",
    providerGroup: context.provider?.group ?? "other",
    x: xMetric?.get(context) ?? 0,
    y: yMetric?.get(context) ?? 0,
    bubble: bubbleMetric?.get(context) ?? null,
    selected: options.selectedIds.includes(context.model.id),
    onFrontier: frontierIds.has(context.model.id),
  }));

  const bubbleLabel =
    bubbleMetric?.label ?? (options.bubblesByContextSize ? "Context window" : null);

  return {
    points,
    xKey: options.xKey,
    yKey: options.yKey,
    bubbleKey: options.bubbleKey ?? null,
    xLabel: xMetric?.label ?? options.xKey,
    yLabel: yMetric?.label ?? options.yKey,
    bubbleLabel,
    frontierRule:
      xMetric && yMetric
        ? `A model is on the frontier when no other model is at least as good on both ${xMetric.label} (${xMetric.direction} is better) and ${yMetric.label} (${yMetric.direction} is better).`
        : "Frontier unavailable.",
  };
}

/* -------------------------------------------------------------------------- */
/* Releases                                                                    */
/* -------------------------------------------------------------------------- */

export interface ReleaseRow {
  id: string;
  modelId: string;
  modelName: string;
  modelSlug: string;
  providerName: string;
  providerColor: string;
  date: string;
  kind: "release" | "deprecation" | "change";
  detail: string;
  significance: "low" | "medium" | "high";
}

export function computeReleases(
  contexts: ModelContext[],
  changeEvents: ChangeEvent[],
): ReleaseRow[] {
  const rows: ReleaseRow[] = [];
  const contextById = new Map(contexts.map((context) => [context.model.id, context]));

  for (const context of contexts) {
    if (context.model.releaseDate) {
      rows.push({
        id: `release:${context.model.id}`,
        modelId: context.model.id,
        modelName: context.model.name,
        modelSlug: context.model.slug,
        providerName: context.provider?.name ?? "Unknown provider",
        providerColor: context.provider?.color ?? "#94a3b8",
        date: context.model.releaseDate,
        kind: "release",
        detail: context.model.openWeight
          ? "Released with open weights"
          : "Released as a hosted model",
        significance: "medium",
      });
    }

    if (context.model.deprecatedAt) {
      rows.push({
        id: `deprecation:${context.model.id}`,
        modelId: context.model.id,
        modelName: context.model.name,
        modelSlug: context.model.slug,
        providerName: context.provider?.name ?? "Unknown provider",
        providerColor: context.provider?.color ?? "#94a3b8",
        date: context.model.deprecatedAt,
        kind: "deprecation",
        detail: "Marked deprecated",
        significance: "high",
      });
    }
  }

  for (const event of changeEvents) {
    if (event.entity !== "model") continue;
    const context = contextById.get(event.entityId);
    rows.push({
      id: event.id,
      modelId: event.entityId,
      modelName: context?.model.name ?? event.entityId.replace("model:", ""),
      modelSlug: context?.model.slug ?? event.entityId.replace("model:", ""),
      providerName: context?.provider?.name ?? "Unknown provider",
      providerColor: context?.provider?.color ?? "#94a3b8",
      date: event.observedAt,
      kind: "change",
      detail: event.summary,
      significance: event.significance,
    });
  }

  return rows.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

/** Convenience: every registered metric, for the Methodology catalogue. */
export function allMetricKeys(): string[] {
  return METRICS.map((metric) => metric.key);
}
