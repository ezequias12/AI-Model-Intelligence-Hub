"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CHART_GRID,
  CHART_SERIES,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  formatChartTick,
} from "@/components/charts/theme";
import { cn } from "@/lib/utils/cn";
import type { ModelSnapshot } from "@/lib/domain/schema";
import { blendedPrice } from "@/lib/domain/metrics";

type SeriesKey = "intelligence" | "coding" | "agentic" | "blendedPrice";

const SERIES: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: "intelligence", label: "Intelligence", color: CHART_SERIES[0] },
  { key: "coding", label: "Coding", color: CHART_SERIES[1] },
  { key: "agentic", label: "Agentic", color: CHART_SERIES[2] },
  { key: "blendedPrice", label: "Blended price (USD/1M)", color: CHART_SERIES[3] },
];

export function ModelHistoryChart({
  snapshots,
  modelName,
}: {
  snapshots: ModelSnapshot[];
  modelName: string;
}): React.JSX.Element {
  const [enabled, setEnabled] = React.useState<Record<SeriesKey, boolean>>({
    intelligence: true,
    coding: true,
    agentic: true,
    blendedPrice: false,
  });

  const data = React.useMemo(
    () =>
      [...snapshots]
        .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
        .map((snapshot) => ({
          capturedAt: snapshot.capturedAt,
          label: new Date(snapshot.capturedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          intelligence: snapshot.metrics.intelligence,
          coding: snapshot.metrics.coding,
          agentic: snapshot.metrics.agentic,
          blendedPrice: blendedPrice(snapshot.metrics)?.value ?? null,
        })),
    [snapshots],
  );

  if (data.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Only one snapshot stored for this model. History appears once the ingestion pipeline has
            captured at least two observations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle>Snapshot history</CardTitle>
          <p className="text-2xs text-muted-foreground">
            {data.length} observations for {modelName}. Derived series are recomputed per snapshot.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {SERIES.map((series) => (
            <Button
              key={series.key}
              variant={enabled[series.key] ? "subtle" : "ghost"}
              size="xs"
              aria-pressed={enabled[series.key]}
              onClick={() =>
                setEnabled((current) => ({ ...current, [series.key]: !current[series.key] }))
              }
              className={cn(!enabled[series.key] && "text-muted-foreground")}
            >
              <span
                aria-hidden="true"
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              {series.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 py-3">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="label" tick={CHART_TICK} />
              <YAxis yAxisId="left" tick={CHART_TICK} tickFormatter={formatChartTick} width={44} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={CHART_TICK}
                tickFormatter={formatChartTick}
                width={52}
              />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              {/* The series toggles in the card header are this chart's legend:
                  they carry every label and toggle the lines, so a second static
                  legend under the plot would only repeat them. */}
              {SERIES.filter((series) => series.key !== "blendedPrice").map((series) => (
                <Line
                  key={series.key}
                  yAxisId="left"
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  hide={!enabled[series.key]}
                  connectNulls
                />
              ))}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="blendedPrice"
                name="Blended price (USD/1M)"
                stroke={CHART_SERIES[3]}
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={{ r: 2 }}
                hide={!enabled.blendedPrice}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
