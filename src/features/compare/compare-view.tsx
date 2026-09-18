"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Section } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { Chip, ProviderDot, Segmented } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlay";
import { RelativeTime } from "@/components/ui/relative-time";
import { METRICS } from "@/lib/analytics/metric-registry";
import {
  buildPlanComparisonRows,
  deriveHarnessPlanMetrics,
  type CheapestContext,
} from "@/lib/domain/harness-metrics";
import { cn } from "@/lib/utils/cn";
import type { HarnessPlan, HarnessPlanSnapshot, HarnessProduct } from "@/lib/domain/schema";
import { useModelsWorkspace } from "@/features/models/workspace-context";

type CompareMode = "models" | "plans";

const PLANS_QUERY_PARAM = "plans";
const PLANS_STORAGE_KEY = "amih.harness.selection.v1";
const MAX_COMPARE_PLANS = 6;

export interface CompareViewProps {
  products: HarnessProduct[];
  plans: HarnessPlan[];
  latestSnapshots: HarnessPlanSnapshot[];
  defaultPlanIds: string[];
}

export function CompareView({
  products,
  plans,
  latestSnapshots,
  defaultPlanIds,
}: CompareViewProps): React.JSX.Element {
  const [mode, setMode] = React.useState<CompareMode>("models");

  return (
    <Section
      title="Compare"
      description="Side-by-side comparison. Model metrics and harness-plan metrics are never mixed in one schema."
      actions={
        <Segmented
          ariaLabel="Comparison mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "models", label: "Models" },
            { value: "plans", label: "Harness plans" },
          ]}
        />
      }
    >
      {mode === "models" ? (
        <ModelComparison />
      ) : (
        <PlanComparison
          products={products}
          plans={plans}
          latestSnapshots={latestSnapshots}
          defaultPlanIds={defaultPlanIds}
        />
      )}
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Model comparison                                                            */
/* -------------------------------------------------------------------------- */

function ModelComparison(): React.JSX.Element {
  const workspace = useModelsWorkspace();
  const [highlightBest, setHighlightBest] = React.useState(true);

  const selected = workspace.selectedIds
    .map((id) => workspace.contexts.find((context) => context.model.id === id))
    .filter((context): context is NonNullable<typeof context> => Boolean(context));

  const identityRows = React.useMemo(
    () => [
      {
        key: "provider",
        label: "Provider",
        get: (context: NonNullable<(typeof selected)[number]>) => context.provider?.name ?? "—",
        best: null as "higher" | "lower" | null,
      },
      {
        key: "releaseDate",
        label: "Released",
        get: (context: NonNullable<(typeof selected)[number]>) =>
          context.model.releaseDate
            ? new Date(context.model.releaseDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—",
        best: null,
      },
      {
        key: "openWeight",
        label: "Open weights",
        get: (context: NonNullable<(typeof selected)[number]>) =>
          context.model.openWeight ? "Yes" : "No",
        best: null,
      },
      {
        key: "status",
        label: "Status",
        get: (context: NonNullable<(typeof selected)[number]>) =>
          context.model.deprecatedAt ? "Deprecated" : "Active",
        best: null,
      },
    ],
    [],
  );

  const metricRows = METRICS.map((metric) => ({
    key: metric.key,
    label: metric.label,
    direction: metric.direction,
    provenance: metric.provenance,
    description: metric.description,
    get: (context: NonNullable<(typeof selected)[number]>) => metric.get(context),
    format: metric.format,
  }));

  const bestByRow = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of metricRows) {
      const values = selected
        .map((context) => ({ id: context.model.id, value: row.get(context) }))
        .filter((entry): entry is { id: string; value: number } => entry.value !== null);
      if (values.length === 0) continue;

      const target =
        row.direction === "higher"
          ? Math.max(...values.map((entry) => entry.value))
          : Math.min(...values.map((entry) => entry.value));

      map.set(
        row.key,
        values.filter((entry) => entry.value === target).map((entry) => entry.id),
      );
    }
    return map;
  }, [metricRows, selected]);

  if (selected.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-xs text-muted-foreground">
          No models selected. Use the comparison set tray above to add at least two models.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-2xs">
          <Checkbox checked={highlightBest} onChange={() => setHighlightBest((value) => !value)} />
          Highlight the better value per row
        </label>
        <span className="text-2xs text-muted-foreground">
          Better direction comes from the metric registry, so a lower price is never treated as
          worse.
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <caption className="sr-only">Model comparison across every registered metric</caption>
              <thead className="bg-surface">
                <tr className="border-b border-border">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium text-muted-foreground"
                  >
                    Attribute
                  </th>
                  {selected.map((context) => (
                    <th
                      key={context.model.id}
                      scope="col"
                      className="px-3 py-2 text-left font-medium"
                    >
                      <span className="flex flex-col gap-0.5">
                        <Link
                          href={`/models/${context.model.slug}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {context.model.shortName}
                        </Link>
                        <span className="flex items-center gap-1 text-2xs font-normal text-muted-foreground">
                          <ProviderDot
                            color={context.provider?.color ?? null}
                            name={context.provider?.name ?? "Unknown"}
                            size={6}
                          />
                          {context.provider?.name ?? "Unknown"}
                        </span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {identityRows.map((row) => (
                  <tr key={row.key} className="border-b border-border/50">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-normal text-muted-foreground"
                    >
                      {row.label}
                    </th>
                    {selected.map((context) => (
                      <td key={context.model.id} className="px-3 py-2">
                        {row.get(context)}
                      </td>
                    ))}
                  </tr>
                ))}

                {metricRows.map((row) => {
                  const best = bestByRow.get(row.key) ?? [];
                  return (
                    <tr key={row.key} className="border-b border-border/50">
                      <th
                        scope="row"
                        title={row.description}
                        className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-normal text-muted-foreground"
                      >
                        {row.label}
                        {row.provenance === "derived" && (
                          <span className="ml-1 text-2xs">(derived)</span>
                        )}
                      </th>
                      {selected.map((context) => {
                        const value = row.get(context);
                        const isBest = highlightBest && best.includes(context.model.id);
                        return (
                          <td
                            key={context.model.id}
                            className={cn(
                              "tabular px-3 py-2",
                              isBest && "bg-success/10 font-medium text-success",
                            )}
                          >
                            {row.format(value)}
                            {isBest && <span className="sr-only"> (best in this comparison)</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-normal text-muted-foreground"
                  >
                    Freshness
                  </th>
                  {selected.map((context) => (
                    <td key={context.model.id} className="px-3 py-2 text-2xs text-muted-foreground">
                      <RelativeTime value={context.model.lastRefreshedAt} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-2xs text-muted-foreground">
        Model metrics and harness-plan metrics are kept in separate schemas. Switch mode to compare
        subscriptions instead.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Plan comparison                                                             */
/* -------------------------------------------------------------------------- */

function PlanComparison({
  products,
  plans,
  latestSnapshots,
  defaultPlanIds,
}: CompareViewProps): React.JSX.Element {
  const [selectedIds, setSelectedIds] = React.useState<string[]>(() =>
    defaultPlanIds.slice(0, MAX_COMPARE_PLANS),
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string[]>([]);

  const productById = React.useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const snapshotByPlan = React.useMemo(() => {
    const map = new Map<string, HarnessPlanSnapshot>();
    for (const snapshot of latestSnapshots) {
      const existing = map.get(snapshot.planId);
      if (!existing || Date.parse(snapshot.capturedAt) > Date.parse(existing.capturedAt)) {
        map.set(snapshot.planId, snapshot);
      }
    }
    return map;
  }, [latestSnapshots]);

  // Restore the last-used plan selection once on mount.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get(PLANS_QUERY_PARAM);
    if (fromUrl) {
      const ids = fromUrl.split(",").filter((id) => snapshotByPlan.has(id));
      if (ids.length > 0) {
        setSelectedIds(ids.slice(0, MAX_COMPARE_PLANS));
        return;
      }
    }
    try {
      const stored = window.localStorage.getItem(PLANS_STORAGE_KEY);
      if (stored) {
        const ids = stored.split(",").filter((id) => snapshotByPlan.has(id));
        if (ids.length > 0) setSelectedIds(ids.slice(0, MAX_COMPARE_PLANS));
      }
    } catch {
      // Storage unavailable; keep the server-provided default.
    }
  }, [snapshotByPlan]);

  const persist = React.useCallback((ids: string[]) => {
    try {
      window.localStorage.setItem(PLANS_STORAGE_KEY, ids.join(","));
    } catch {
      // Ignore storage failures; the URL still carries the state.
    }
    const params = new URLSearchParams(window.location.search);
    if (ids.length > 0) params.set(PLANS_QUERY_PARAM, ids.join(","));
    else params.delete(PLANS_QUERY_PARAM);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  const update = (ids: string[]): void => {
    const next = ids.slice(0, MAX_COMPARE_PLANS);
    setSelectedIds(next);
    persist(next);
  };

  const contexts: CheapestContext[] = selectedIds
    .map((planId) => {
      const plan = plans.find((entry) => entry.id === planId);
      const snapshot = snapshotByPlan.get(planId);
      if (!plan || !snapshot) return null;
      return {
        planId,
        productId: plan.productId,
        planName: plan.name,
        productName: productById.get(plan.productId)?.name ?? "Unknown product",
        derived: deriveHarnessPlanMetrics(snapshot),
        snapshot,
      } satisfies CheapestContext;
    })
    .filter((entry): entry is CheapestContext => entry !== null);

  const rows = React.useMemo(() => buildPlanComparisonRows(contexts), [contexts]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
        <span className="text-xs font-medium">Plans</span>
        <Badge variant="muted">
          {contexts.length}/{MAX_COMPARE_PLANS}
        </Badge>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {contexts.map((context) => (
            <Chip
              key={context.planId}
              removeLabel={`Remove ${context.planName}`}
              onRemove={() => update(selectedIds.filter((id) => id !== context.planId))}
            >
              <span className="font-medium">{context.productName}</span>
              <span className="text-2xs text-muted-foreground">{context.planName}</span>
            </Chip>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => {
            setDraft(selectedIds);
            setPickerOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add plans
        </Button>
      </div>

      {contexts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            Select two to six plans to compare price, credits, usage, model access and platform
            availability.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Plan comparison</CardTitle>
            <p className="text-2xs text-muted-foreground">
              Values come from the most recent stored snapshot of each plan&apos;s official page.
              Every column carries its verification date.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-xs">
                <caption className="sr-only">Harness plan comparison</caption>
                <thead className="bg-surface">
                  <tr className="border-b border-border">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium text-muted-foreground"
                    >
                      Field
                    </th>
                    {contexts.map((context) => (
                      <th
                        key={context.planId}
                        scope="col"
                        className="px-3 py-2 text-left font-medium"
                      >
                        <span className="flex flex-col gap-0.5">
                          <Link
                            href={`/harness/plans?plan=${encodeURIComponent(context.planId)}`}
                            className="underline-offset-2 hover:underline"
                          >
                            {context.productName}
                          </Link>
                          <span className="text-2xs font-normal text-muted-foreground">
                            {context.planName}
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const numeric = row.values
                      .map((entry) => entry.value)
                      .filter((value): value is number => typeof value === "number");

                    const best =
                      row.betterDirection && numeric.length > 0
                        ? row.betterDirection === "higher"
                          ? Math.max(...numeric)
                          : Math.min(...numeric)
                        : null;

                    return (
                      <tr key={row.key} className="border-b border-border/50">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-normal text-muted-foreground"
                        >
                          {row.label}
                        </th>
                        {row.values.map((entry) => {
                          const isBest = best !== null && entry.value === best;
                          return (
                            <td
                              key={entry.planId}
                              className={cn(
                                "px-3 py-2",
                                row.format === "currency" || row.format === "number"
                                  ? "tabular"
                                  : "",
                                isBest && "bg-success/10 font-medium text-success",
                              )}
                            >
                              {formatComparisonValue(row.format, entry.value)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-normal text-muted-foreground"
                    >
                      Source
                    </th>
                    {contexts.map((context) => (
                      <td key={context.planId} className="px-3 py-2 text-2xs">
                        <a
                          href={context.snapshot.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline underline-offset-2"
                        >
                          {context.snapshot.sourceId}
                        </a>
                        <div className="text-muted-foreground">
                          verified <RelativeTime value={context.snapshot.capturedAt} />
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Add plans to compare"
        description={`Pick up to ${MAX_COMPARE_PLANS} plans.`}
      >
        <div className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
          {plans
            .filter((plan) => plan.active && snapshotByPlan.has(plan.id))
            .map((plan) => {
              const product = productById.get(plan.productId);
              const checked = draft.includes(plan.id);
              const disabled = !checked && draft.length >= MAX_COMPARE_PLANS;
              return (
                <label
                  key={plan.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors",
                    checked ? "bg-accent/70" : "hover:bg-accent/50",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      setDraft((current) =>
                        current.includes(plan.id)
                          ? current.filter((id) => id !== plan.id)
                          : [...current, plan.id],
                      )
                    }
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-medium">
                      {product?.name ?? "Unknown product"}
                    </span>
                    <span className="truncate text-2xs text-muted-foreground">{plan.name}</span>
                  </span>
                </label>
              );
            })}
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
          <span className="text-2xs text-muted-foreground">{draft.length} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft([])}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => {
                update(draft);
                setPickerOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function formatComparisonValue(
  format: "currency" | "number" | "boolean" | "text" | "list",
  value: string | number | boolean | null,
): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (format === "currency" && typeof value === "number") {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (format === "number" && typeof value === "number") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  if (typeof value === "string") return value.length === 0 ? "—" : value;
  return String(value);
}
