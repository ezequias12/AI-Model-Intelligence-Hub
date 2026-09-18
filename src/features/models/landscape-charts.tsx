"use client";

import * as React from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Maximize2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { MetaLine, Segmented } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlay";
import { CHART_METRIC_KEYS } from "@/lib/analytics/metric-registry";
import { computeLandscapeChart, type LandscapeChartResult } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";
import { useModelsWorkspace } from "./workspace-context";

interface ChartConfig {
  id: string;
  title: string;
  xKey: string;
  yKey: string;
  bubbleKey: string | null;
}

const DEFAULT_CHARTS: ChartConfig[] = [
  {
    id: "intel-price",
    title: "Intelligence vs blended price",
    xKey: "blendedPrice",
    yKey: "intelligence",
    bubbleKey: null,
  },
  {
    id: "coding-price",
    title: "Coding vs blended price",
    xKey: "blendedPrice",
    yKey: "coding",
    bubbleKey: null,
  },
  {
    id: "speed-intel",
    title: "Speed vs intelligence",
    xKey: "outputSpeedTps",
    yKey: "intelligence",
    bubbleKey: "contextWindow",
  },
  {
    id: "outprice-intel",
    title: "Output price vs intelligence",
    xKey: "outputPricePerMillion",
    yKey: "intelligence",
    bubbleKey: null,
  },
];

const METRIC_OPTIONS = CHART_METRIC_KEYS.map((key) => ({ key }));

export function LandscapeCharts({
  charts = DEFAULT_CHARTS,
  columns = 2,
}: {
  charts?: ChartConfig[];
  columns?: 1 | 2;
}): React.JSX.Element {
  return (
    <div className={cn("grid grid-cols-1 gap-3", columns === 2 && "xl:grid-cols-2")}>
      {charts.map((chart) => (
        <ChartCard key={chart.id} initial={chart} />
      ))}
    </div>
  );
}

function ChartCard({ initial }: { initial: ChartConfig }): React.JSX.Element {
  const workspace = useModelsWorkspace();
  const [config, setConfig] = React.useState<ChartConfig>(initial);
  const [showFrontier, setShowFrontier] = React.useState(true);
  const [showLabels, setShowLabels] = React.useState(false);
  const [logScale, setLogScale] = React.useState(true);
  const [contextOnly, setContextOnly] = React.useState<"all" | "selected">("all");
  const [fullscreen, setFullscreen] = React.useState(false);

  const contexts = React.useMemo(
    () =>
      contextOnly === "selected"
        ? workspace.contexts.filter((context) => workspace.selectedIds.includes(context.model.id))
        : workspace.contexts,
    [contextOnly, workspace.contexts, workspace.selectedIds],
  );

  const result = React.useMemo(
    () =>
      computeLandscapeChart(contexts, {
        xKey: config.xKey,
        yKey: config.yKey,
        bubbleKey: config.bubbleKey,
        selectedIds: workspace.selectedIds,
        showFrontier,
      }),
    [config, contexts, showFrontier, workspace.selectedIds],
  );

  const body = (
    <ChartBody
      result={result}
      showLabels={showLabels}
      logScale={logScale}
      showFrontier={showFrontier}
    />
  );

  const toolbar = (
    <div className="flex flex-wrap items-end gap-2">
      <Label className="text-2xs text-muted-foreground">
        X
        <Select
          className="w-[150px]"
          value={config.xKey}
          onChange={(event) => setConfig((current) => ({ ...current, xKey: event.target.value }))}
          aria-label="X axis metric"
        >
          {METRIC_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {labelForMetric(option.key)}
            </option>
          ))}
        </Select>
      </Label>
      <Label className="text-2xs text-muted-foreground">
        Y
        <Select
          className="w-[150px]"
          value={config.yKey}
          onChange={(event) => setConfig((current) => ({ ...current, yKey: event.target.value }))}
          aria-label="Y axis metric"
        >
          {METRIC_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {labelForMetric(option.key)}
            </option>
          ))}
        </Select>
      </Label>
      <Label className="text-2xs text-muted-foreground">
        Bubble
        <Select
          className="w-[140px]"
          value={config.bubbleKey ?? ""}
          onChange={(event) =>
            setConfig((current) => ({ ...current, bubbleKey: event.target.value || null }))
          }
          aria-label="Bubble size metric"
        >
          <option value="">None</option>
          {METRIC_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {labelForMetric(option.key)}
            </option>
          ))}
        </Select>
      </Label>
      <Segmented
        ariaLabel="Chart scope"
        size="sm"
        value={contextOnly}
        onChange={setContextOnly}
        options={[
          { value: "all", label: "All + context" },
          { value: "selected", label: "Selected only" },
        ]}
      />
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <CardTitle className="truncate">{initial.title}</CardTitle>
            <MetaLine
              className="text-2xs text-muted-foreground"
              items={[
                `${result.xLabel} (x) vs ${result.yLabel} (y)`,
                result.bubbleLabel ? `bubble: ${result.bubbleLabel}` : null,
              ]}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setConfig(initial)}
              aria-label="Reset chart configuration"
              title="Reset chart"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setFullscreen(true)}
              aria-label="Expand chart"
              title="Expand"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>

        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-2">
          {toolbar}
        </div>

        <CardContent className="px-2 py-3">
          {/* Recharts marks every scatter symbol as role="img" with no name and
              offers no way to label it, so the plot is decorative here and the
              accessible data table below is its screen-reader equivalent. */}
          <div className="h-[300px] w-full" aria-hidden="true">
            {body}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 px-2">
            <ToggleChip active={showFrontier} onClick={() => setShowFrontier((value) => !value)}>
              Pareto frontier
            </ToggleChip>
            <ToggleChip active={showLabels} onClick={() => setShowLabels((value) => !value)}>
              Labels
            </ToggleChip>
            <ToggleChip active={logScale} onClick={() => setLogScale((value) => !value)}>
              Log scale
            </ToggleChip>
            <span className="tabular text-2xs text-muted-foreground" title={result.frontierRule}>
              {result.points.filter((point) => point.onFrontier).length} on frontier
            </span>
          </div>

          <AccessibleChartTable result={result} />
        </CardContent>
      </Card>

      <Modal
        open={fullscreen}
        onOpenChange={setFullscreen}
        title={initial.title}
        description={result.frontierRule}
        className="max-w-6xl"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-2">
          {toolbar}
        </div>
        <div className="p-4">
          <div className="h-[62vh] w-full" aria-hidden="true">
            {body}
          </div>
        </div>
      </Modal>
    </>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-chip border px-2 py-0.5 text-2xs transition-colors",
        active
          ? "border-primary/40 bg-primary-muted text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ChartBody({
  result,
  showLabels,
  logScale,
  showFrontier,
}: {
  result: LandscapeChartResult;
  showLabels: boolean;
  logScale: boolean;
  showFrontier: boolean;
}): React.JSX.Element {
  if (result.points.length === 0) {
    return (
      <p className="grid h-full place-items-center text-xs text-muted-foreground">
        No models have both metrics in the current scope.
      </p>
    );
  }

  const useLogX = logScale && result.points.every((point) => point.x > 0);
  const useLogY = logScale && result.points.every((point) => point.y > 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.5} />
        <XAxis
          type="number"
          dataKey="x"
          name={result.xLabel}
          scale={useLogX ? "log" : "auto"}
          domain={["auto", "auto"]}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          label={{
            value: result.xLabel,
            position: "insideBottom",
            offset: -12,
            style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={result.yLabel}
          scale={useLogY ? "log" : "auto"}
          domain={["auto", "auto"]}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          width={56}
        />
        <ZAxis
          type="number"
          dataKey="bubble"
          range={result.bubbleKey ? [40, 400] : [70, 70]}
          name={result.bubbleLabel ?? "Size"}
        />
        <Tooltip content={<ChartTooltip xLabel={result.xLabel} yLabel={result.yLabel} />} />
        <Legend
          wrapperStyle={{ fontSize: 10 }}
          payload={[
            { value: "In comparison set", type: "circle", color: "hsl(var(--primary))" },
            { value: "Market context", type: "circle", color: "hsl(var(--muted-foreground))" },
          ]}
        />
        <Scatter
          data={result.points}
          shape={(props: unknown) => renderPoint(props, showLabels, showFrontier)}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

interface PointShapeProps {
  cx?: number;
  cy?: number;
  payload?: {
    shortName: string;
    providerName: string;
    providerColor: string;
    onFrontier: boolean;
    selected: boolean;
  };
}

function renderPoint(
  props: unknown,
  showLabels: boolean,
  showFrontier: boolean,
): React.ReactElement<SVGElement> {
  const { cx = 0, cy = 0, payload } = (props ?? {}) as PointShapeProps;
  const frontier = showFrontier && payload?.onFrontier;
  const fill = payload?.selected
    ? (payload.providerColor ?? "hsl(var(--primary))")
    : "hsl(var(--muted-foreground))";

  return (
    <g>
      {frontier && (
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
      )}
      <circle cx={cx} cy={cy} r={4} fill={fill} fillOpacity={payload?.selected ? 0.95 : 0.4} />
      {showLabels && payload && (
        <text x={cx + 7} y={cy + 3} fontSize={9} fill="hsl(var(--foreground))">
          {payload.shortName}
        </text>
      )}
    </g>
  );
}

interface TooltipPayloadEntry {
  payload?: {
    name: string;
    providerName: string;
    x: number;
    y: number;
    bubble: number | null;
    selected: boolean;
    onFrontier: boolean;
  };
}

function ChartTooltip({
  active,
  payload,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  xLabel: string;
  yLabel: string;
}): React.ReactElement | null {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-control border border-border bg-popover px-3 py-2 text-2xs shadow-overlay">
      <p className="font-medium">{point.name}</p>
      <p className="text-muted-foreground">{point.providerName}</p>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <dt className="text-muted-foreground">{xLabel}</dt>
        <dd className="tabular text-right">{point.x.toFixed(2)}</dd>
        <dt className="text-muted-foreground">{yLabel}</dt>
        <dd className="tabular text-right">{point.y.toFixed(2)}</dd>
        {point.bubble !== null && (
          <>
            <dt className="text-muted-foreground">Bubble</dt>
            <dd className="tabular text-right">{point.bubble.toFixed(2)}</dd>
          </>
        )}
      </dl>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {point.selected && <Badge variant="primary">In comparison</Badge>}
        {point.onFrontier && <Badge variant="info">Frontier</Badge>}
      </div>
    </div>
  );
}

/** Charts must have an accessible data alternative, not only a canvas. */
function AccessibleChartTable({ result }: { result: LandscapeChartResult }): React.JSX.Element {
  return (
    <details className="mt-2 px-2">
      <summary className="cursor-pointer text-2xs text-muted-foreground">
        View chart data as a table ({result.points.length} models)
      </summary>
      <div className="scroll-thin mt-1.5 max-h-56 overflow-auto border-t border-border">
        <table className="w-full text-2xs">
          <caption className="sr-only">
            {result.xLabel} versus {result.yLabel} for the current scope
          </caption>
          <thead className="sticky top-0 bg-surface-sunken">
            <tr>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Model
              </th>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Provider
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                {result.xLabel}
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                {result.yLabel}
              </th>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Frontier
              </th>
            </tr>
          </thead>
          <tbody>
            {result.points.map((point) => (
              <tr key={point.id} className="border-t border-border/60">
                <td className="px-2 py-1">
                  <Link
                    href={`/models/${point.id.replace("model:", "")}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {point.name}
                  </Link>
                </td>
                <td className="px-2 py-1 text-muted-foreground">{point.providerName}</td>
                <td className="tabular px-2 py-1 text-right">{point.x.toFixed(2)}</td>
                <td className="tabular px-2 py-1 text-right">{point.y.toFixed(2)}</td>
                <td className="px-2 py-1">{point.onFrontier ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function labelForMetric(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}
