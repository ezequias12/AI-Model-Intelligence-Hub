"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, Section } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CHART_GRID,
  CHART_INK,
  CHART_SERIES,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  formatChartTick,
} from "@/components/charts/theme";
import { formatMetric } from "@/lib/analytics/metric-registry";
import { useModelsWorkspace } from "./workspace-context";
import { LandscapeCharts } from "./landscape-charts";

/**
 * The Artificial Analysis set.
 *
 * Three per-model bar charts plus the Pareto scatter, laid out two to a row so
 * they can be read against each other. Every card carries the criterion it
 * ranks by, because a bar chart without its rule is decoration.
 *
 * `costPerTaskUsd`, `answerTokensPerTask` and `reasoningTokensPerTask` are
 * vendor figures (see the metric registry): the cost comes from the documented
 * free API tier and the token split from the vendor's web dataset, which only
 * covers the models that dataset publishes. That is stated on the card rather
 * than hidden, so a short bar list is not mistaken for the whole catalogue.
 */
const TOP_N = 12;

interface BarRow {
  id: string;
  slug: string;
  name: string;
  provider: string;
  color: string;
  value: number;
  answer: number | null;
  reasoning: number | null;
}

export function ArtificialAnalysisCharts(): React.JSX.Element {
  const workspace = useModelsWorkspace();

  const rank = React.useCallback(
    (metricKey: string, direction: "higher" | "lower"): BarRow[] => {
      const rows: BarRow[] = [];
      for (const context of workspace.contexts) {
        const value = readMetric(context.model.metrics, metricKey);
        if (value === null) continue;
        rows.push({
          id: context.model.id,
          slug: context.model.slug,
          name: context.model.shortName,
          provider: context.provider?.name ?? "Unknown provider",
          color: context.provider?.color ?? CHART_INK.primary,
          value,
          answer: context.model.metrics.answerTokensPerTask,
          reasoning: context.model.metrics.reasoningTokensPerTask,
        });
      }

      rows.sort((a, b) => (direction === "higher" ? b.value - a.value : a.value - b.value));
      return rows.slice(0, TOP_N);
    },
    [workspace.contexts],
  );

  const byIntelligence = React.useMemo(() => rank("intelligence", "higher"), [rank]);
  const byCostPerTask = React.useMemo(() => rank("costPerTaskUsd", "lower"), [rank]);
  const byTokensPerTask = React.useMemo(() => rank("tokensPerTask", "lower"), [rank]);

  return (
    <Section
      title="Artificial Analysis set"
      description="One bar per model, plus the capability-against-cost frontier. Same scope, provider grouping and capability threshold as the rest of the workspace."
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <BarCard
          title="Intelligence by model"
          criterion="Artificial Analysis Intelligence Index. Higher is better."
          note="Longer bar = more capable."
          rows={byIntelligence}
          metricKey="intelligence"
        />

        <BarCard
          title="Cost per task by model"
          criterion="Weighted average cost in USD to run one Intelligence Index task. Lower is better."
          note="Vendor figure, already net of input, cache, reasoning and answer token prices."
          rows={byCostPerTask}
          metricKey="costPerTaskUsd"
        />

        <BarCard
          title="Tokens per task by model"
          criterion="Answer tokens plus reasoning tokens per Intelligence Index task. Lower is better."
          note="Split into answer and reasoning. The vendor publishes this only for the models shown on their charts, so this list is shorter than the others by nature."
          rows={byTokensPerTask}
          metricKey="tokensPerTask"
          stacked
        />

        <div className="min-w-0">
          <LandscapeCharts
            columns={1}
            charts={[
              {
                id: "intelligence-vs-cost-per-task",
                title: "Intelligence vs cost per task",
                xKey: "costPerTaskUsd",
                yKey: "intelligence",
                bubbleKey: null,
              },
            ]}
          />
        </div>
      </div>
    </Section>
  );
}

function readMetric(metrics: Record<string, unknown>, key: string): number | null {
  if (key === "tokensPerTask") {
    const answer = metrics.answerTokensPerTask;
    const reasoning = metrics.reasoningTokensPerTask;
    const a = typeof answer === "number" ? answer : null;
    const r = typeof reasoning === "number" ? reasoning : null;
    if (a === null && r === null) return null;
    return (a ?? 0) + (r ?? 0);
  }
  const value = metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function BarCard({
  title,
  criterion,
  note,
  rows,
  metricKey,
  stacked = false,
}: {
  title: string;
  criterion: string;
  note: string;
  rows: BarRow[];
  metricKey: string;
  stacked?: boolean;
}): React.JSX.Element {
  const hasTokens = rows.some((row) => row.answer !== null || row.reasoning !== null);

  /**
   * Recharts walks the chart's direct children to discover its series, and a
   * React fragment in between hides them: the chart renders an empty plot with
   * no error. The bars are therefore passed as a flat array, never wrapped.
   */
  const bars: React.ReactElement[] =
    stacked && hasTokens
      ? [
          <Bar
            key="answer"
            dataKey="answer"
            stackId="tokens"
            name="answer"
            fill={CHART_SERIES[0]}
          />,
          <Bar
            key="reasoning"
            dataKey="reasoning"
            stackId="tokens"
            name="reasoning"
            fill={CHART_SERIES[2]}
          />,
        ]
      : [
          <Bar key="value" dataKey="value" name={metricKey} radius={[0, 3, 3, 0]}>
            {rows.map((row) => (
              <Cell key={row.id} fill={row.color} />
            ))}
          </Bar>,
        ];

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle className="truncate">{title}</CardTitle>
          <p className="text-2xs text-muted-foreground">{criterion}</p>
        </div>
        <Badge variant="outline">Top {rows.length}</Badge>
      </CardHeader>

      <CardContent className="px-2 py-3">
        {rows.length === 0 ? (
          <p className="grid h-[300px] place-items-center px-4 text-center text-xs text-muted-foreground">
            The configured source publishes no value for this metric, so there is nothing to rank.
          </p>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
              >
                <CartesianGrid {...CHART_GRID} horizontal={false} />
                <XAxis
                  type="number"
                  tick={CHART_TICK}
                  tickFormatter={formatChartTick}
                  domain={["auto", "auto"]}
                />
                <YAxis type="category" dataKey="name" tick={CHART_TICK} width={112} interval={0} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number | string, name: string) => [
                    formatMetric(name === "reasoning" ? "tokensPerTask" : metricKey, Number(value)),
                    name === "reasoning"
                      ? "Reasoning tokens"
                      : name === "answer"
                        ? "Answer tokens"
                        : "Value",
                  ]}
                />
                {bars}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="px-2 pt-1 text-2xs text-muted-foreground">{note}</p>

        <BarDataTable title={title} rows={rows} metricKey={metricKey} />
      </CardContent>
    </Card>
  );
}

/** Charts must have an accessible data alternative, not only a canvas. */
function BarDataTable({
  title,
  rows,
  metricKey,
}: {
  title: string;
  rows: BarRow[];
  metricKey: string;
}): React.JSX.Element {
  return (
    <details className="mt-2 px-2">
      <summary className="cursor-pointer text-2xs text-muted-foreground">
        View as a table ({rows.length} models)
      </summary>
      <div className="scroll-thin mt-1.5 max-h-64 overflow-auto border-t border-border">
        <table className="w-full text-2xs">
          <caption className="sr-only">{title}</caption>
          <thead className="sticky top-0 bg-surface-sunken">
            <tr>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Model
              </th>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Provider
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border/60">
                <td className="px-2 py-1">
                  <Link href={`/models/${row.slug}`} className="underline-offset-2 hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td className="px-2 py-1 text-muted-foreground">{row.provider}</td>
                <td className="tabular px-2 py-1 text-right">
                  {formatMetric(metricKey, row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
