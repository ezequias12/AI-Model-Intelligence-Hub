"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader, PanelTitle, Section } from "@/components/ui/card";
import { RelativeTime } from "@/components/ui/relative-time";
import type { HarnessChangeEvent, HarnessPlan, HarnessProduct } from "@/lib/domain/schema";
import { DASH, formatEnumLabel } from "@/lib/format";
import { ProductMark } from "./plan-board";

export interface ChangeFeedProps {
  changeEvents: HarnessChangeEvent[];
  products: HarnessProduct[];
  plans: HarnessPlan[];
}

const SIGNIFICANCE_VARIANT: Record<
  HarnessChangeEvent["significance"],
  "warning" | "info" | "muted"
> = {
  high: "warning",
  medium: "info",
  low: "muted",
};

const KEY_LABELS: Record<string, string> = {
  includedCreditsUsd: "Included credits (USD)",
  monthlyPriceUsd: "Monthly price (USD)",
  annualPriceUsd: "Annual price (USD)",
  estimatedRequests: "Documented requests",
  resetPeriod: "Reset period",
  overageModel: "Overage model",
  bonusCreditsUsd: "Bonus credits (USD)",
  models: "Models",
  platforms: "Platforms",
  byok: "BYOK",
};

export function ChangeFeed({ changeEvents, products, plans }: ChangeFeedProps): React.JSX.Element {
  const productById = React.useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const planById = React.useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);

  const grouped = React.useMemo(() => {
    const sorted = [...changeEvents].sort(
      (a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt),
    );
    const map = new Map<string, HarnessChangeEvent[]>();
    for (const event of sorted) {
      const month = event.observedAt.slice(0, 7);
      const list = map.get(month) ?? [];
      list.push(event);
      map.set(month, list);
    }
    return [...map.entries()];
  }, [changeEvents]);

  return (
    <Section
      title="Change feed"
      description="Chronological plan, price, credit, model-access and promotion changes, newest first. Each event shows the before and after values that were observed."
    >
      {grouped.length === 0 ? (
        <p className="text-xs text-muted-foreground">No plan changes are recorded.</p>
      ) : (
        grouped.map(([month, monthEvents]) => (
          <Panel key={month}>
            <PanelHeader>
              <PanelTitle>
                {new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                })}
              </PanelTitle>
              <p className="text-2xs text-muted-foreground">
                {monthEvents.length} event{monthEvents.length === 1 ? "" : "s"}
              </p>
            </PanelHeader>
            <PanelBody className="flex flex-col divide-y divide-border p-0">
              {monthEvents.map((event) => {
                const product = productById.get(event.productId);
                const plan = planById.get(event.planId);
                return (
                  <div key={event.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ProductMark name={product?.name ?? "Unknown product"} size={18} />
                      <span className="text-xs font-medium">
                        {product?.name ?? "Unknown product"}
                      </span>
                      <span className="text-2xs text-muted-foreground">
                        {plan?.name ?? event.planId}
                      </span>
                      <Badge variant="muted">{formatEnumLabel(event.eventType)}</Badge>
                      <Badge variant={SIGNIFICANCE_VARIANT[event.significance]}>
                        {formatEnumLabel(event.significance)} impact
                      </Badge>
                      <RelativeTime
                        value={event.observedAt}
                        className="tabular ml-auto text-2xs text-muted-foreground"
                      />
                    </div>
                    <p className="text-xs">{event.summary}</p>
                    <ChangeDiff before={event.before} after={event.after} />
                  </div>
                );
              })}
            </PanelBody>
          </Panel>
        ))
      )}
    </Section>
  );
}

interface DiffPair {
  key: string | null;
  before: unknown;
  after: unknown;
}

function ChangeDiff({ before, after }: { before: unknown; after: unknown }): React.JSX.Element {
  const pairs = diffPairs(before, after);

  if (pairs.length === 0) {
    return (
      <p className="text-2xs text-muted-foreground">
        No field-level values were recorded for this event.
      </p>
    );
  }

  return (
    <dl className="flex flex-col gap-1 text-2xs sm:flex-row sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
      {pairs.map((pair) => (
        <div key={pair.key ?? "value"} className="flex flex-wrap items-center gap-1.5">
          {pair.key && <dt className="text-muted-foreground">{labelFor(pair.key)}:</dt>}
          <dd className="flex flex-wrap items-center gap-1.5">
            <span className="tabular rounded-chip bg-muted px-1.5 py-0.5 text-muted-foreground">
              {formatChangeValue(pair.before)}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              →
            </span>
            <span className="sr-only">changed to</span>
            <span className="tabular rounded-chip bg-success-muted px-1.5 py-0.5 text-success">
              {formatChangeValue(pair.after)}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function labelFor(key: string): string {
  return KEY_LABELS[key] ?? formatEnumLabel(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diffPairs(before: unknown, after: unknown): DiffPair[] {
  if (isRecord(before) && isRecord(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map((key) => ({ key, before: before[key], after: after[key] }));
  }
  return [{ key: null, before, after }];
}

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return DASH;
  if (typeof value === "string") return value.length === 0 ? DASH : value;
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.length === 0 ? DASH : value.map((entry) => formatChangeValue(entry)).join(", ");
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, entry]) => `${labelFor(key)}: ${formatChangeValue(entry)}`)
      .join("; ");
  }
  return String(value);
}
