"use client";

import * as React from "react";
import { computeFreshness, type FreshnessThresholds } from "@/lib/domain/freshness";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

/**
 * Relative timestamps.
 *
 * A relative label depends on the moment it is rendered, so a statically
 * prerendered page bakes one age into the HTML and the client computes another
 * at hydration time. React reports that as a hydration mismatch, which is a real
 * defect rather than a cosmetic one.
 *
 * The escape hatch is `suppressHydrationWarning`, used exactly where the
 * guideline says it is justified: on an element whose text is *expected* to
 * differ between the server pass and the client pass. The label is then kept
 * live, so a long session never shows a stale age.
 */

const REFRESH_INTERVAL_MS = 30_000;

function useLiveLabel(value: string | null | undefined, compute: () => string): string {
  const [label, setLabel] = React.useState(compute);

  React.useEffect(() => {
    setLabel(compute());
    if (!value) return;

    const id = window.setInterval(() => setLabel(compute()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
    // `compute` is recreated per render by design; `value` is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return label;
}

export function RelativeTime({
  value,
  className,
  prefix,
  emptyLabel = "—",
}: {
  value: string | null | undefined;
  className?: string;
  prefix?: string;
  emptyLabel?: string;
}): React.JSX.Element {
  const label = useLiveLabel(value, () => (value ? formatRelative(value) : emptyLabel));

  return (
    <time
      dateTime={value ?? undefined}
      title={value ? formatDateTime(value) : undefined}
      className={className}
      suppressHydrationWarning
    >
      {prefix ? `${prefix} ${label}` : label}
    </time>
  );
}

/**
 * Freshness of a reading.
 *
 * The state drives the colour, so it must settle after mount for the same reason
 * as the label. Both the label and the tone update together.
 */
export function FreshnessBadge({
  value,
  thresholds,
  className,
  title = "Age of this reading",
}: {
  value: string | null | undefined;
  thresholds?: FreshnessThresholds;
  className?: string;
  title?: string;
}): React.JSX.Element {
  const [freshness, setFreshness] = React.useState(() =>
    computeFreshness(value, thresholds ? { thresholds } : {}),
  );

  React.useEffect(() => {
    const update = (): void =>
      setFreshness(computeFreshness(value, thresholds ? { thresholds } : {}));
    update();
    const id = window.setInterval(update, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [value, thresholds]);

  const tone =
    freshness.state === "fresh"
      ? "bg-success-muted text-success"
      : freshness.state === "aging"
        ? "bg-warning-muted text-warning"
        : freshness.state === "stale"
          ? "bg-destructive-muted text-destructive"
          : "bg-muted text-muted-foreground";

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-chip px-1.5 py-[3px] text-2xs font-medium leading-none",
        tone,
        className,
      )}
      suppressHydrationWarning
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {freshness.label}
    </span>
  );
}
