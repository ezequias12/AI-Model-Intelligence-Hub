/**
 * Chart theme.
 *
 * Every chart in the product reads its colour from one place, so a series keeps
 * the same identity wherever it appears and both themes stay in step. Values are
 * CSS custom properties rather than literals, which is what lets a theme switch
 * repaint the charts without React re-rendering them.
 *
 * Colour is never the only signal: callers pair a series with a legend label and,
 * where the chart is not itself accessible, with a data table.
 */

const hsl = (token: string): string => `hsl(var(${token}))`;

/** Ordered series palette. The first entry is the brand blue. */
export const CHART_SERIES = [
  hsl("--chart-1"),
  hsl("--chart-2"),
  hsl("--chart-3"),
  hsl("--chart-4"),
  hsl("--chart-5"),
  hsl("--chart-6"),
] as const;

export const CHART_INK = {
  grid: hsl("--border"),
  axis: hsl("--muted-foreground"),
  label: hsl("--foreground"),
  primary: hsl("--primary"),
  muted: hsl("--muted-foreground"),
  tooltipSurface: hsl("--popover"),
  tooltipBorder: hsl("--border"),
} as const;

/** Shared axis tick style, sized for dense dashboards. */
export const CHART_TICK = { fontSize: 10, fill: CHART_INK.axis } as const;

/** Shared dashed grid, tuned to stay visible without competing with the data. */
export const CHART_GRID = {
  stroke: CHART_INK.grid,
  strokeDasharray: "3 3",
  opacity: 0.5,
} as const;

/** Shared Recharts tooltip container style. */
export const CHART_TOOLTIP_STYLE = {
  fontSize: 11,
  background: CHART_INK.tooltipSurface,
  border: `1px solid ${CHART_INK.tooltipBorder}`,
  borderRadius: 8,
  padding: "6px 10px",
} as const;

/**
 * Chart legend wrapper style.
 *
 * Recharts replaces its default wrapper style wholesale when `wrapperStyle` is
 * given, and that default carries the `width: 100%` the layout depends on. Pass
 * it back explicitly or the legend entries stack on top of each other.
 */
export const CHART_LEGEND_STYLE = {
  fontSize: 10,
  width: "100%",
} as const;

/**
 * Axis tick formatter.
 *
 * Raw floats are unreadable on an axis (`0.35000000000000003`), so ticks are
 * reduced to the precision their magnitude actually warrants. No currency symbol:
 * the axis label already names the metric.
 */
export function formatChartTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  const magnitude = Math.abs(value);
  if (magnitude === 0) return "0";
  if (magnitude >= 10000) return `${(value / 1000).toFixed(0)}k`;
  if (magnitude >= 100) return value.toFixed(0);
  if (magnitude >= 10) return value.toFixed(0);
  if (magnitude >= 1) return value.toFixed(magnitude >= 2 ? 1 : 2);
  return value.toFixed(2);
}

/**
 * Picks a stable accent for an entity by hashing its id. Used by the harness
 * plan board, where products have no brand colour of their own: the same product
 * always lands on the same series colour.
 */
export function accentForId(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 100000;
  }
  return CHART_SERIES[hash % CHART_SERIES.length] ?? CHART_SERIES[0];
}
