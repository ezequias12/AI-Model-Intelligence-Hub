"use client";

import * as React from "react";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Section,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  buildCheapestViews,
  deriveHarnessPlanMetrics,
  type CheapestContext,
  type CheapestEntry,
} from "@/lib/domain/harness-metrics";
import type { HarnessPlan, HarnessPlanSnapshot, HarnessProduct } from "@/lib/domain/schema";
import { DASH, formatRatio, formatUnitPrice } from "@/lib/format";
import { ProductMark } from "./plan-board";

/**
 * Builds the shared `CheapestContext[]` once from the serialisable workspace
 * subset. Plans without a captured snapshot are skipped rather than rendered
 * with an invented price.
 */
export function buildHarnessContexts(
  plans: HarnessPlan[],
  products: HarnessProduct[],
  latestSnapshots: HarnessPlanSnapshot[],
): CheapestContext[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const snapshotByPlan = new Map(latestSnapshots.map((snapshot) => [snapshot.planId, snapshot]));
  const contexts: CheapestContext[] = [];

  for (const plan of plans) {
    const snapshot = snapshotByPlan.get(plan.id);
    if (!snapshot) continue;
    contexts.push({
      planId: plan.id,
      productId: plan.productId,
      planName: plan.name,
      productName: productById.get(plan.productId)?.name ?? "Unknown product",
      derived: deriveHarnessPlanMetrics(snapshot),
      snapshot,
    });
  }

  return contexts;
}

export interface CheapestProps {
  products: HarnessProduct[];
  plans: HarnessPlan[];
  latestSnapshots: HarnessPlanSnapshot[];
}

type ValueKind = "usd" | "ratio" | "requests";

export function Cheapest({ products, plans, latestSnapshots }: CheapestProps): React.JSX.Element {
  const [premiumThresholdUsd, setPremiumThresholdUsd] = React.useState(20);

  const contexts = React.useMemo(
    () => buildHarnessContexts(plans, products, latestSnapshots),
    [plans, products, latestSnapshots],
  );

  const views = React.useMemo(
    () => buildCheapestViews(contexts, { premiumThresholdUsd }),
    [contexts, premiumThresholdUsd],
  );

  const contextById = React.useMemo(
    () => new Map(contexts.map((context) => [context.planId, context])),
    [contexts],
  );

  return (
    <Section
      title="Cheapest options"
      description="Each category names the formula and the values behind the result. Nothing is an unexplained winner, and every figure links to the page that documented it."
      actions={
        <div className="flex items-center gap-2">
          <label htmlFor="premium-threshold" className="text-2xs text-muted-foreground">
            Premium threshold (USD)
          </label>
          <Input
            id="premium-threshold"
            type="number"
            min={0}
            step={1}
            value={premiumThresholdUsd}
            onChange={(event) => {
              const next = Number(event.target.value);
              setPremiumThresholdUsd(Number.isFinite(next) && next >= 0 ? next : 0);
            }}
            className="h-8 w-20 text-xs"
          />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <CheapestCard
          title="Free options"
          description="Plans documented at no monthly cost, including BYOK and ad-supported tiers."
          unitLabel="free"
          valueKind="usd"
          entries={views.free}
          contextById={contextById}
        />
        <CheapestCard
          title="Lowest paid entry"
          description="Cheapest plan that still charges a documented monthly price."
          unitLabel="USD/mo"
          valueKind="usd"
          entries={toEntries(views.lowestPaidEntryUsd)}
          contextById={contextById}
        />
        <CheapestCard
          title="Highest included credit / USD"
          description="Included credit value divided by the entry price, for plans that document a credit allocation."
          unitLabel="credit/USD"
          valueKind="ratio"
          entries={toEntries(views.highestCreditPerDollar)}
          contextById={contextById}
        />
        <CheapestCard
          title={`Premium models under $${premiumThresholdUsd}`}
          description="Frontier-tier model access at or below the configured monthly threshold."
          unitLabel="USD/mo"
          valueKind="usd"
          entries={toEntries(views.premiumUnderThreshold)}
          contextById={contextById}
        />
        <CheapestCard
          title="Open models"
          description="Cheapest plan that lists an open-weight model family, regardless of threshold."
          unitLabel="USD/mo"
          valueKind="usd"
          entries={toEntries(views.openModelsUnderThreshold)}
          contextById={contextById}
        />
        <CheapestCard
          title="BYOK-friendly"
          description="Cheapest plan that supports bringing your own provider key."
          unitLabel="USD/mo"
          valueKind="usd"
          entries={toEntries(views.byokFriendly)}
          contextById={contextById}
        />
        <CheapestCard
          title="Highest documented allowance"
          description="Only plans where the vendor documents a request estimate. Undocumented counts are shown as — elsewhere."
          unitLabel="requests/USD"
          valueKind="requests"
          entries={toEntries(views.highestDocumentedAllowance)}
          contextById={contextById}
        />
      </div>
    </Section>
  );
}

function toEntries(entry: CheapestEntry | null): CheapestEntry[] {
  return entry ? [entry] : [];
}

function CheapestCard({
  title,
  description,
  unitLabel,
  valueKind,
  entries,
  contextById,
}: {
  title: string;
  description: string;
  unitLabel: string;
  valueKind: ValueKind;
  entries: CheapestEntry[];
  contextById: Map<string, CheapestContext>;
}): React.JSX.Element {
  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-center justify-between gap-2">
          <PanelTitle>{title}</PanelTitle>
          <Badge variant="muted">{unitLabel}</Badge>
        </div>
        <PanelDescription>{description}</PanelDescription>
      </PanelHeader>
      <PanelBody className="flex flex-col gap-3">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No plan qualifies with the current data.</p>
        ) : (
          entries.map((entry) => (
            <CheapestRow
              key={entry.planId}
              entry={entry}
              valueKind={valueKind}
              context={contextById.get(entry.planId)}
            />
          ))
        )}
      </PanelBody>
    </Panel>
  );
}

function CheapestRow({
  entry,
  valueKind,
  context,
}: {
  entry: CheapestEntry;
  valueKind: ValueKind;
  context: CheapestContext | undefined;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
          {context && <ProductMark name={context.productName} size={16} />}
          <span className="truncate">{entry.planName}</span>
        </span>
        <span className="measured shrink-0 text-sm font-semibold">
          {formatValue(entry.value, valueKind)}
        </span>
      </div>
      <p className="text-2xs text-muted-foreground">{entry.detail}</p>
      <p className="measured text-2xs text-muted-foreground">{entry.formula}</p>
      {context && (
        <div className="flex flex-wrap items-center gap-2 text-2xs">
          <a
            href={context.snapshot.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            Source
          </a>
          <span className="text-muted-foreground">
            Verified <RelativeTime value={context.snapshot.capturedAt} />
          </span>
        </div>
      )}
    </div>
  );
}

function formatValue(value: number, kind: ValueKind): string {
  switch (kind) {
    case "usd":
      return formatUnitPrice(value);
    case "ratio":
      return `${value.toFixed(2)}x`;
    case "requests":
      return `${formatRatio(value)}`;
    default:
      return DASH;
  }
}
