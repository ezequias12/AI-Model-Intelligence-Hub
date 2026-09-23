"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeltaBadge, ProviderDot } from "@/components/ui/primitives";
import { RelativeTime } from "@/components/ui/relative-time";
import { computeLeaderCards, type LeaderCard } from "@/lib/analytics";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { useModelsWorkspace } from "./workspace-context";

/**
 * Metric leaders.
 *
 * Eight readings, two tiers. Three headline readings answer the questions most
 * people open this workspace with (capability, capability per dollar, speed) and
 * get the visual weight; the remaining five stay a compact band below them. All
 * eight are always rendered — the tier is hierarchy, not a filter.
 *
 * This is the single authored motion moment in the product: a short staggered
 * settle on first paint. Everything else animates only in response to a user
 * action. Deltas appear only where a previous snapshot exists, so an absent
 * delta is never rendered as a zero.
 */
const PRIMARY_IDS: readonly string[] = [
  "highest_intelligence",
  "best_weighted_value",
  "fastest_output",
];

export function MetricLeaders(): React.JSX.Element {
  const workspace = useModelsWorkspace();

  const cards = React.useMemo(() => computeLeaderCards(workspace.contexts), [workspace.contexts]);

  const { primary, secondary } = React.useMemo(() => {
    const primaryCards = PRIMARY_IDS.map((id) => cards.find((card) => card.id === id)).filter(
      (card): card is LeaderCard => Boolean(card),
    );
    const primaryIds = new Set(primaryCards.map((card) => card.id));
    return {
      primary: primaryCards,
      secondary: cards.filter((card) => !primaryIds.has(card.id)),
    };
  }, [cards]);

  return (
    <div className="overflow-hidden rounded-panel border border-border bg-card shadow-card">
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {primary.map((card, index) => (
          <LeaderCell
            key={card.id}
            card={card}
            index={index}
            emphasis
            selectedIds={workspace.selectedIds}
            onToggle={workspace.toggleModel}
          />
        ))}
      </div>

      {secondary.length > 0 && (
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {secondary.map((card, index) => (
            <LeaderCell
              key={card.id}
              card={card}
              index={index + primary.length}
              selectedIds={workspace.selectedIds}
              onToggle={workspace.toggleModel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LeaderCell({
  card,
  index,
  emphasis = false,
  selectedIds,
  onToggle,
}: {
  card: LeaderCard;
  index: number;
  emphasis?: boolean;
  selectedIds: string[];
  onToggle: (id: string) => void;
}): React.JSX.Element {
  const model = card.context?.model;
  const provider = card.context?.provider;
  const selected = model ? selectedIds.includes(model.id) : false;
  const isNumeric = /^[$0-9]/.test(card.metricDisplay);

  return (
    <div
      style={{ "--stagger-index": index } as React.CSSProperties}
      className={cn(
        "group relative flex min-w-0 animate-leader-in flex-col bg-card",
        emphasis ? "px-4 py-4" : "px-3 py-2.5",
        card.empty && "opacity-60",
      )}
    >
      <h3
        className={cn(
          "truncate font-medium text-muted-foreground",
          emphasis ? "text-xs" : "text-2xs",
        )}
        title={card.question}
      >
        {card.label}
      </h3>

      {card.empty || !model ? (
        <p className={cn("text-muted-foreground", emphasis ? "mt-2 text-xs" : "mt-1 text-2xs")}>
          No model satisfies this metric.
        </p>
      ) : (
        <>
          <div
            className={cn(
              "flex flex-wrap items-baseline gap-x-1.5 gap-y-1",
              emphasis ? "mt-2" : "mt-1",
            )}
          >
            <span
              className={cn(
                "font-medium leading-tight tracking-[-0.02em] text-foreground",
                emphasis ? "text-2xl" : "text-lg",
                /* Monospace is for readings that get compared; a date is not one,
                   and in a fixed-width face it would overflow the cell. */
                isNumeric && "measured",
              )}
            >
              {card.metricDisplay}
            </span>
            {card.delta !== null && (
              <DeltaBadge
                value={card.delta}
                betterDirection={card.deltaDirection}
                format={(value) => formatPercent(value, 1)}
              />
            )}
          </div>

          <div className={cn("flex min-w-0 items-center gap-1.5", emphasis ? "mt-2.5" : "mt-1.5")}>
            <ProviderDot color={provider?.color ?? null} name={provider?.name ?? "Unknown"} />
            <Link
              href={`/models/${model.slug}`}
              className={cn(
                "min-w-0 truncate font-medium text-foreground underline decoration-border hover:decoration-foreground",
                emphasis ? "text-sm" : "text-xs",
              )}
              title={`${model.name}. Open the model page.`}
            >
              {model.shortName}
            </Link>

            <Button
              variant="ghost"
              size="icon-xs"
              /* Always visible: the action is never gated behind hover. It only
                 gains contrast when the cell is engaged. */
              className="ml-auto shrink-0 text-muted-foreground opacity-70 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
              onClick={() => onToggle(model.id)}
              aria-label={
                selected
                  ? `Remove ${model.name} from comparison`
                  : `Add ${model.name} to comparison`
              }
              title={selected ? "In comparison set" : "Add to comparison set"}
            >
              {selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>

          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-2xs text-muted-foreground">
            <span className="truncate">{provider?.name ?? "Unknown provider"}</span>
            <span aria-hidden="true" className="meta-sep" />
            <RelativeTime value={model.lastRefreshedAt} className="whitespace-nowrap" />
          </div>
        </>
      )}
    </div>
  );
}
