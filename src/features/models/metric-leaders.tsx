"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeltaBadge, ProviderDot } from "@/components/ui/primitives";
import { RelativeTime } from "@/components/ui/relative-time";
import { computeLeaderCards } from "@/lib/analytics";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { useModelsWorkspace } from "./workspace-context";

/**
 * Metric leaders.
 *
 * Composed as one instrument strip divided by hairlines rather than eight
 * identical cards: the readings are comparable, so they belong in one band where
 * the eye can scan across them. This is also the single authored motion moment
 * in the product, a short staggered settle on first paint. Everything else in
 * the interface animates only in answer to a user action.
 *
 * Deltas appear only when a previous snapshot exists, so an absent delta is
 * never rendered as a zero.
 */
export function MetricLeaders(): React.JSX.Element {
  const workspace = useModelsWorkspace();

  const cards = React.useMemo(() => computeLeaderCards(workspace.contexts), [workspace.contexts]);

  return (
    <div className="stagger overflow-hidden rounded-panel border border-border bg-border">
      <div className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {cards.map((card, index) => {
          const model = card.context?.model;
          const provider = card.context?.provider;
          const selected = model ? workspace.selectedIds.includes(model.id) : false;
          const isNumeric = /^[$0-9]/.test(card.metricDisplay);

          return (
            <div
              key={card.id}
              style={{ "--stagger-index": index } as React.CSSProperties}
              className={cn(
                "group relative flex min-w-0 animate-leader-in flex-col bg-card px-3 py-3",
                card.empty && "opacity-60",
              )}
            >
              <h3
                className="truncate text-2xs font-medium text-muted-foreground"
                title={card.question}
              >
                {card.label}
              </h3>

              {card.empty || !model ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No model satisfies this metric.
                </p>
              ) : (
                <>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                    <span
                      className={cn(
                        "text-lg font-medium leading-tight text-foreground",
                        /* Monospace is for readings that get compared; a date is
                           not one, and in a fixed-width face it would overflow
                           the cell. */
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

                  <div className="mt-2 flex min-w-0 items-center gap-1.5">
                    <ProviderDot
                      color={provider?.color ?? null}
                      name={provider?.name ?? "Unknown"}
                    />
                    <Link
                      href={`/models/${model.slug}`}
                      className="min-w-0 truncate text-xs font-medium text-foreground underline decoration-border hover:decoration-foreground"
                      title={`${model.name}. Open the model page.`}
                    >
                      {model.shortName}
                    </Link>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      /* Always visible: the action is never gated behind hover.
                         It only gains contrast when the cell is engaged. */
                      className="ml-auto shrink-0 text-muted-foreground opacity-70 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
                      onClick={() => workspace.toggleModel(model.id)}
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
        })}
      </div>
    </div>
  );
}
