"use client";

import * as React from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/overlay";
import { Chip } from "@/components/ui/primitives";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils/cn";
import {
  buildPlanComparisonRows,
  type CheapestContext,
  type PlanComparisonRow,
} from "@/lib/domain/harness-metrics";
import type { HarnessPlan, HarnessPlanSnapshot, HarnessProduct } from "@/lib/domain/schema";
import { DASH, formatUnitPrice } from "@/lib/format";
import { buildHarnessContexts } from "./cheapest";
import { ProductMark } from "./plan-board";

const STORAGE_KEY = "amih.harness.selection.v1";
const QUERY_PARAM = "plans";
const MAX_COMPARE_PLANS = 6;

export interface PlanCompareProps {
  products: HarnessProduct[];
  plans: HarnessPlan[];
  latestSnapshots: HarnessPlanSnapshot[];
}

export function PlanCompare({
  products,
  plans,
  latestSnapshots,
}: PlanCompareProps): React.JSX.Element {
  const contexts = React.useMemo(
    () => buildHarnessContexts(plans, products, latestSnapshots),
    [plans, products, latestSnapshots],
  );

  const knownIds = React.useMemo(
    () => new Set(contexts.map((context) => context.planId)),
    [contexts],
  );
  const defaultIds = React.useMemo(
    () => contexts.slice(0, Math.min(4, MAX_COMPARE_PLANS)).map((context) => context.planId),
    [contexts],
  );

  const [selectedIds, setSelectedIds] = React.useState<string[]>(defaultIds);
  const [selectorOpen, setSelectorOpen] = React.useState(false);

  const persist = React.useCallback((ids: string[]) => {
    const encoded = ids.join(",");
    try {
      if (encoded.length > 0) window.localStorage.setItem(STORAGE_KEY, encoded);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable (private mode); the URL still carries state.
    }

    const params = new URLSearchParams(window.location.search);
    if (encoded.length > 0) params.set(QUERY_PARAM, encoded);
    else params.delete(QUERY_PARAM);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  const apply = React.useCallback(
    (ids: string[]) => {
      const next = ids.slice(0, MAX_COMPARE_PLANS);
      setSelectedIds(next);
      persist(next);
    },
    [persist],
  );

  // Prefer an explicit URL selection, then the last stored one, then the default.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = decodeIds(params.get(QUERY_PARAM)).filter((id) => knownIds.has(id));
    if (fromUrl.length > 0) {
      setSelectedIds(fromUrl.slice(0, MAX_COMPARE_PLANS));
      return;
    }
    try {
      const stored = decodeIds(window.localStorage.getItem(STORAGE_KEY)).filter((id) =>
        knownIds.has(id),
      );
      if (stored.length > 0) setSelectedIds(stored.slice(0, MAX_COMPARE_PLANS));
    } catch {
      // Ignore storage failures and keep the resolved default.
    }
  }, [knownIds]);

  const selectedContexts = React.useMemo(
    () =>
      selectedIds
        .map((id) => contexts.find((context) => context.planId === id))
        .filter((context): context is CheapestContext => Boolean(context)),
    [selectedIds, contexts],
  );

  const rows = React.useMemo(() => buildPlanComparisonRows(selectedContexts), [selectedContexts]);

  const toggle = (id: string): void => {
    apply(
      selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-panel border border-border bg-surface-raised p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">Comparison set</span>
            <span className="text-2xs text-muted-foreground">
              {selectedContexts.length}/{MAX_COMPARE_PLANS} plans
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => apply(defaultIds)}
              disabled={defaultIds.length === 0}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restore defaults
            </Button>
            <Button
              size="sm"
              onClick={() => setSelectorOpen(true)}
              disabled={contexts.length === 0}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add plans
            </Button>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {selectedContexts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No plans selected. Use <span className="font-medium">Add plans</span> to build a
              comparison set.
            </p>
          ) : (
            selectedContexts.map((context) => (
              <Chip
                key={context.planId}
                title={`${context.productName} — ${context.planName}`}
                removeLabel={`Remove ${context.productName} ${context.planName}`}
                onRemove={() => toggle(context.planId)}
              >
                <ProductMark name={context.productName} size={16} />
                <span className="font-medium">{context.planName}</span>
                <span className="hidden text-2xs text-muted-foreground sm:inline">
                  {context.productName}
                </span>
              </Chip>
            ))
          )}
        </div>
      </div>

      <Section
        title="Plan comparison"
        description="These are harness-plan metrics only — prices, credits, usage and platform support. Model metrics are never mixed into this table."
      >
        {selectedContexts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Select at least one plan to see the comparison.
          </p>
        ) : (
          <Panel>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-xs">
                <caption className="sr-only">
                  Side-by-side comparison of the selected coding-agent plans.
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-2xs font-medium text-muted-foreground"
                    >
                      Field
                    </th>
                    {selectedContexts.map((context) => (
                      <th
                        key={context.planId}
                        scope="col"
                        className="px-3 py-2 text-left align-bottom"
                      >
                        <span className="flex items-center gap-2">
                          <ProductMark name={context.productName} />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-xs font-semibold">
                              {context.planName}
                            </span>
                            <span className="truncate text-2xs font-normal text-muted-foreground">
                              {context.productName}
                            </span>
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <th
                      scope="row"
                      className="px-3 py-2 text-left font-medium text-muted-foreground"
                    >
                      Source
                    </th>
                    {selectedContexts.map((context) => (
                      <td key={context.planId} className="px-3 py-2">
                        <span className="flex flex-col gap-0.5">
                          <a
                            href={context.snapshot.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-2xs underline underline-offset-2"
                          >
                            Source page
                          </a>
                          <RelativeTime
                            value={context.snapshot.capturedAt}
                            className="text-2xs text-muted-foreground"
                          />
                        </span>
                      </td>
                    ))}
                  </tr>
                  {rows.map((row) => (
                    <ComparisonRow key={row.key} row={row} contexts={selectedContexts} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </Section>

      <PlanSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        contexts={contexts}
        selectedIds={selectedIds}
        onApply={apply}
      />
    </div>
  );
}

function ComparisonRow({
  row,
  contexts,
}: {
  row: PlanComparisonRow;
  contexts: CheapestContext[];
}): React.JSX.Element {
  const bestIds = bestPlanIds(row);

  return (
    <tr className="border-b border-border last:border-0">
      <th scope="row" className="px-3 py-2 text-left font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {row.label}
          {row.betterDirection && (
            <span className="text-2xs font-normal text-muted-foreground">
              ({row.betterDirection} is better)
            </span>
          )}
        </span>
      </th>
      {contexts.map((context) => {
        const value = row.values.find((entry) => entry.planId === context.planId)?.value ?? null;
        const isBest = bestIds.has(context.planId);
        return (
          <td key={context.planId} className={cn("px-3 py-2", isBest && "bg-success-muted")}>
            <span className="flex items-center gap-1.5">
              <span className={cn("tabular", isBest && "font-semibold")}>
                {row.key === "verified" && typeof value === "string" ? (
                  <RelativeTime value={value} />
                ) : (
                  formatRowValue(row.format, value)
                )}
              </span>
              {isBest && <Badge variant="success">Best</Badge>}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

function bestPlanIds(row: PlanComparisonRow): Set<string> {
  const ids = new Set<string>();
  if (!row.betterDirection) return ids;

  const numbers = row.values.filter(
    (entry): entry is { planId: string; value: number } => typeof entry.value === "number",
  );
  if (numbers.length === 0) return ids;

  const distinct = new Set(numbers.map((entry) => entry.value));
  if (distinct.size < 2) return ids;

  const target =
    row.betterDirection === "higher"
      ? Math.max(...numbers.map((entry) => entry.value))
      : Math.min(...numbers.map((entry) => entry.value));

  for (const entry of numbers) {
    if (entry.value === target) ids.add(entry.planId);
  }
  return ids;
}

function formatRowValue(
  format: PlanComparisonRow["format"],
  value: string | number | boolean | null,
): string {
  if (value === null || value === undefined) return DASH;

  switch (format) {
    case "currency":
      return typeof value === "number" ? formatUnitPrice(value) : String(value);
    case "number":
      return typeof value === "number" ? value.toFixed(2) : String(value);
    case "boolean":
      return value ? "Yes" : "No";
    case "list":
    case "text":
    default: {
      const text = String(value);
      return text.length === 0 ? DASH : text;
    }
  }
}

function decodeIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function PlanSelector({
  open,
  onOpenChange,
  contexts,
  selectedIds,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contexts: CheapestContext[];
  selectedIds: string[];
  onApply: (ids: string[]) => void;
}): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState<string[]>(selectedIds);

  React.useEffect(() => {
    if (open) {
      setDraft(selectedIds);
      setQuery("");
    }
  }, [open, selectedIds]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return contexts;
    return contexts.filter((context) =>
      `${context.productName} ${context.planName}`.toLowerCase().includes(needle),
    );
  }, [contexts, query]);

  const toggle = (id: string): void => {
    setDraft((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= MAX_COMPARE_PLANS
          ? current
          : [...current, id],
    );
  };

  const atLimit = draft.length >= MAX_COMPARE_PLANS;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add plans"
      description={`Pick up to ${MAX_COMPARE_PLANS} plans to compare.`}
      className="max-w-2xl"
    >
      <div className="border-b border-border px-4 py-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search plans or products…"
            aria-label="Search plans"
            className="pl-8"
          />
        </div>
      </div>

      <div
        className="scroll-thin max-h-[46vh] overflow-y-auto p-1.5"
        role="group"
        aria-label="Plan list"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No plans match.</p>
        ) : (
          filtered.map((context) => {
            const checked = draft.includes(context.planId);
            const disabled = !checked && atLimit;
            return (
              <label
                key={context.planId}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-control px-2.5 py-2 transition-[background-color] duration-150 ease-out",
                  checked ? "bg-accent" : "hover:bg-accent",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(context.planId)}
                />
                <ProductMark name={context.productName} size={18} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-medium">{context.planName}</span>
                  <span className="truncate text-2xs text-muted-foreground">
                    {context.productName}
                  </span>
                </span>
                <span className="tabular ml-auto text-2xs text-muted-foreground">
                  {formatUnitPrice(context.derived.entryPriceUsd)}/mo
                </span>
              </label>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-2xs text-muted-foreground">
          <span className="tabular">{draft.length} selected</span>
          {atLimit && (
            <>
              <span aria-hidden="true" className="meta-sep" />
              <span>Limit reached</span>
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDraft([])}>
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply selection
          </Button>
        </div>
      </div>
    </Modal>
  );
}
