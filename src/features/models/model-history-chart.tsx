"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { ModelSnapshot } from "@/lib/domain/schema";
import { blendedPrice } from "@/lib/domain/metrics";

type SeriesKey = "intelligence" | "coding" | "agentic" | "blendedPrice";

const SERIES: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: "intelligence", label: "Intelligence", color: "#2563eb" },
  { key: "coding", label: "Coding", color: "#7c3aed" },
  { key: "agentic", label: "Agentic", color: "#0d9488" },
  { key: "blendedPrice", label: "Blended price (USD/1M)", color: "#d97706" },
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
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                width={44}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
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
                stroke="#d97706"
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
