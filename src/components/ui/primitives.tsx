import * as React from "react";
import { cn } from "@/lib/utils/cn";

/* -------------------------------------------------------------------------- */
/* Provider identity                                                          */
/* -------------------------------------------------------------------------- */

export function ProviderDot({
  color,
  name,
  size = 8,
  className,
}: {
  color: string | null;
  name: string;
  size?: number;
  className?: string;
}): React.JSX.Element {
  // Never rely on colour alone: the dot carries a title and every caller renders
  // the provider name next to it.
  const resolved = color ?? "hsl(var(--muted-foreground))";
  return (
    <span
      title={name}
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-full", className)}
      style={{ width: size, height: size, backgroundColor: resolved }}
    />
  );
}

export interface ProviderMeta {
  id: string;
  name: string;
  color: string | null;
  group: string;
}

/** Geographic/structural grouping only, never a quality judgement. */
export function groupLabel(group: string): string {
  if (group === "china_based") return "China-based";
  if (group === "mainstream_global") return "Mainstream";
  return "Other";
}

export function ProviderLabel({
  provider,
  showGroup = false,
  className,
}: {
  provider: ProviderMeta | undefined;
  showGroup?: boolean;
  className?: string;
}): React.JSX.Element {
  if (!provider) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <ProviderDot color={provider.color} name={provider.name} />
      <span className="truncate">{provider.name}</span>
      {showGroup && (
        <span className="text-2xs text-muted-foreground">{groupLabel(provider.group)}</span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Inline metadata.
 *
 * Fragments are separated by a hairline rule rather than a middle dot. Joining
 * phrases with a punctuation character is a generated-UI tell; a divider between
 * fields is a structural device that shows where one field ends and the next
 * begins.
 */
export function MetaLine({
  items,
  className,
}: {
  items: Array<React.ReactNode>;
  className?: string;
}): React.JSX.Element {
  const visible = items.filter(
    (item) => item !== null && item !== undefined && item !== false && item !== "",
  );

  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {visible.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span aria-hidden="true" className="meta-sep" />}
          <span className="min-w-0">{item}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

/**
 * Segmented control.
 *
 * A real radiogroup, so the keyboard model and the announced state come from the
 * platform rather than from ARIA invented for the occasion.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "default",
  ariaLabel,
  className,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  size?: "default" | "sm";
  ariaLabel: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control bg-surface-sunken p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[6px] font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
              size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm",
              selected
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Chips                                                                      */
/* -------------------------------------------------------------------------- */

export function Chip({
  children,
  onRemove,
  removeLabel,
  className,
  title,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
  title?: string;
}): React.JSX.Element {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border border-border bg-surface px-2 py-1 text-xs text-foreground",
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? "Remove"}
          className="-mr-0.5 rounded-[4px] p-0.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
        >
          <svg viewBox="0 0 14 14" className="h-2.5 w-2.5" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Measurement                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A measured value.
 *
 * Monospace is earned here: every number in this product is an observation, and
 * a fixed-width face is what makes a column of readings scannable.
 */
export function MetricValue({
  value,
  unit,
  className,
  emphasize = false,
}: {
  value: string;
  unit?: string;
  className?: string;
  emphasize?: boolean;
}): React.JSX.Element {
  const isUnknown = value === "—";

  return (
    <span
      className={cn(
        "measured",
        emphasize && "font-medium",
        isUnknown && "text-muted-foreground",
        className,
      )}
    >
      {value}
      {unit && !isUnknown && (
        <span className="ml-1 font-sans text-2xs text-muted-foreground">{unit}</span>
      )}
    </span>
  );
}

/**
 * Change indicator. Direction is carried by a glyph and a sign, so the meaning
 * survives without colour.
 */
export function DeltaBadge({
  value,
  format,
  betterDirection = "higher",
}: {
  value: number | null;
  format: (value: number) => string;
  betterDirection?: "higher" | "lower";
}): React.JSX.Element | null {
  if (value === null || !Number.isFinite(value) || value === 0) return null;

  const improved = betterDirection === "higher" ? value > 0 : value < 0;
  const arrow = value > 0 ? "▲" : "▼";

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 rounded-chip px-1 py-[2px] text-2xs font-medium leading-none",
        improved ? "bg-success-muted text-success" : "bg-destructive-muted text-destructive",
      )}
      title={`Change: ${format(value)}`}
    >
      <span aria-hidden="true">{arrow}</span>
      <span className="sr-only">{value > 0 ? "Up" : "Down"} </span>
      {format(Math.abs(value))}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Trust tier describes provenance quality. It is never a statement about a
 * political viewpoint.
 */
export function TrustTierBadge({ tier }: { tier: 1 | 2 | 3 }): React.JSX.Element {
  const label = tier === 1 ? "Tier 1" : tier === 2 ? "Tier 2" : "Tier 3";
  const title =
    tier === 1
      ? "Official source, documentation or changelog"
      : tier === 2
        ? "Established reporting or a reputable technical publication"
        : "Social post or uncorroborated discovery signal";

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-chip px-1.5 py-[3px] text-2xs font-medium leading-none",
        tier === 1 && "bg-success-muted text-success",
        tier === 2 && "bg-info-muted text-info",
        tier === 3 && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Data mode                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * States the data mode in the interface's own voice. A degraded live state names
 * the missing configuration instead of hiding behind a generic warning.
 */
export function DataModeBanner({
  mode,
  degraded,
  label,
  detail,
}: {
  mode: "mock" | "live";
  degraded: boolean;
  label: string;
  detail?: string | null;
}): React.JSX.Element {
  const tone = degraded
    ? "border-warning/30 bg-warning-muted"
    : mode === "mock"
      ? "border-border bg-surface"
      : "border-success/30 bg-success-muted";

  return (
    <div className={cn("rounded-panel border px-3.5 py-2.5 text-xs", tone)} role="status">
      <span className="font-medium text-foreground">{label}.</span>{" "}
      <span className="text-muted-foreground">
        {detail ??
          (mode === "mock"
            ? "Values are deterministic fixtures and are labeled as such throughout."
            : "Live adapters are active.")}
      </span>
    </div>
  );
}
