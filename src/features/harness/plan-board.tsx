"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, Section } from "@/components/ui/card";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils/cn";
import { accentForId } from "@/components/charts/theme";
import { deriveHarnessPlanMetrics, type HarnessPlanDerived } from "@/lib/domain/harness-metrics";
import type { HarnessPlan, HarnessPlanSnapshot, HarnessProduct } from "@/lib/domain/schema";
import { DASH, formatEnumLabel, formatUnitPrice } from "@/lib/format";

/** Deterministic accent so a product keeps the same mark colour across views. */
export function productAccent(name: string): string {
  return accentForId(name);
}

/**
 * Products have no logos, so identity is a letter mark. The mark is decorative
 * (aria-hidden); the product name is always rendered as text next to it.
 */
export function ProductMark({
  name,
  size = 22,
}: {
  name: string;
  size?: number;
}): React.JSX.Element {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-chip font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: productAccent(name),
        fontSize: Math.round(size * 0.5),
      }}
    >
      {letter}
    </span>
  );
}

export interface PlanBoardProps {
  products: HarnessProduct[];
  plans: HarnessPlan[];
  latestSnapshots: HarnessPlanSnapshot[];
}

type SortKey = "price" | "credits" | "creditPerDollar" | "product" | "freshness";
type SortDirection = "asc" | "desc";

const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  price: "asc",
  credits: "desc",
  creditPerDollar: "desc",
  product: "asc",
  freshness: "desc",
};

interface PlanRow {
  plan: HarnessPlan;
  product: HarnessProduct | undefined;
  snapshot: HarnessPlanSnapshot | null;
  derived: HarnessPlanDerived | null;
}

export function PlanBoard({ products, plans, latestSnapshots }: PlanBoardProps): React.JSX.Element {
  const [sortKey, setSortKey] = React.useState<SortKey>("price");
  const [direction, setDirection] = React.useState<SortDirection>("asc");

  const rows = React.useMemo(() => {
    const productById = new Map(products.map((product) => [product.id, product]));
    const snapshotByPlan = new Map(latestSnapshots.map((snapshot) => [snapshot.planId, snapshot]));

    const list: PlanRow[] = plans
      .filter((plan) => plan.active)
      .map((plan) => {
        const snapshot = snapshotByPlan.get(plan.id) ?? null;
        return {
          plan,
          product: productById.get(plan.productId),
          snapshot,
          derived: snapshot ? deriveHarnessPlanMetrics(snapshot) : null,
        };
      });

    list.sort((a, b) => compareRows(a, b, sortKey, direction));
    return list;
  }, [plans, products, latestSnapshots, sortKey, direction]);

  const onSort = (key: SortKey): void => {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection(DEFAULT_DIRECTION[key]);
  };

  return (
    <Section
      title="Plans board"
      description="Every active plan with price, billing period, included credits, model access and platform support. Prices link to the page that documented them and carry their verification time."
    >
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active plans are tracked.</p>
      ) : (
        <Panel>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-xs">
              <caption className="sr-only">
                Active coding-agent plans with price, included credits, model access, platform
                support and verification freshness. Column headers marked as buttons sort the table.
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-2xs font-medium text-muted-foreground">
                  <SortHeader
                    column="product"
                    label="Product"
                    sortKey={sortKey}
                    direction={direction}
                    onSort={onSort}
                  />
                  <th scope="col" className="px-3 py-2 font-medium">
                    Plan
                  </th>
                  <SortHeader
                    column="price"
                    label="Price"
                    sortKey={sortKey}
                    direction={direction}
                    onSort={onSort}
                  />
                  <th scope="col" className="px-3 py-2 font-medium">
                    Billing
                  </th>
                  <SortHeader
                    column="credits"
                    label="Credits"
                    sortKey={sortKey}
                    direction={direction}
                    onSort={onSort}
                  />
                  <SortHeader
                    column="creditPerDollar"
                    label="Credit/USD"
                    sortKey={sortKey}
                    direction={direction}
                    onSort={onSort}
                  />
                  <th scope="col" className="px-3 py-2 font-medium">
                    Model access
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    BYOK
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Open source
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Platforms
                  </th>
                  <SortHeader
                    column="freshness"
                    label="Last checked"
                    sortKey={sortKey}
                    direction={direction}
                    onSort={onSort}
                  />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <PlanRowView key={row.plan.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </Section>
  );
}

function SortHeader({
  column,
  label,
  sortKey,
  direction,
  onSort,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}): React.JSX.Element {
  const active = column === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className="px-3 py-2"
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 text-2xs font-medium transition-[color] duration-150 ease-out hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ? (
          direction === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function PlanRowView({ row }: { row: PlanRow }): React.JSX.Element {
  const { plan, product, snapshot, derived } = row;
  const productName = product?.name ?? "Unknown product";
  const billing =
    snapshot === null
      ? DASH
      : snapshot.monthlyPriceUsd !== null
        ? "Monthly"
        : snapshot.annualPriceUsd !== null
          ? "Annual"
          : DASH;

  return (
    <tr className="border-b border-border align-top last:border-0">
      <th scope="row" className="px-3 py-2.5 text-left font-medium">
        <span className="flex items-center gap-2">
          <ProductMark name={productName} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{productName}</span>
            <span className="truncate text-2xs font-normal text-muted-foreground">
              {product?.vendor ?? DASH}
            </span>
          </span>
        </span>
      </th>
      <td className="px-3 py-2.5">{plan.name}</td>
      <td className="tabular px-3 py-2.5">
        {snapshot ? (
          <span className="flex flex-col gap-0.5">
            <a
              href={snapshot.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium underline-offset-2 hover:underline"
            >
              {formatUnitPrice(derived?.entryPriceUsd ?? null)}
            </a>
            <RelativeTime value={snapshot.capturedAt} className="text-2xs text-muted-foreground" />
            {snapshot.annualPriceUsd !== null && (
              <span className="text-2xs text-muted-foreground">
                {formatUnitPrice(snapshot.annualPriceUsd)}/yr
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">{DASH}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{billing}</td>
      <td className="tabular px-3 py-2.5">
        {derived?.includedCreditsUsd === null || derived === null
          ? DASH
          : formatUnitPrice(derived.includedCreditsUsd)}
      </td>
      <td className="tabular px-3 py-2.5">
        {derived?.includedCreditPerDollar === null || derived === null
          ? DASH
          : `${derived.includedCreditPerDollar.toFixed(2)}x`}
      </td>
      <td className="px-3 py-2.5">
        {snapshot === null || snapshot.models.length === 0 ? (
          <span className="text-muted-foreground">{DASH}</span>
        ) : (
          <span className="flex flex-col gap-1">
            <span className="flex flex-wrap gap-1">
              {snapshot.frontierModelAccess && <Badge variant="info">Frontier</Badge>}
              {derived !== null && derived.modelCount > 0 && (
                <Badge variant="muted">{derived.modelCount} listed</Badge>
              )}
            </span>
            <span className="line-clamp-2 text-2xs text-muted-foreground">
              {snapshot.models.join(", ")}
            </span>
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">{derived?.byok ? "Yes" : "No"}</td>
      <td className="px-3 py-2.5">{product?.openSource ? "Open source" : "Proprietary"}</td>
      <td className="px-3 py-2.5">
        {snapshot === null || snapshot.platforms.length === 0 ? (
          <span className="text-muted-foreground">{DASH}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {snapshot.platforms.map((platform) => (
              <Badge key={platform} variant="outline">
                {formatEnumLabel(platform)}
              </Badge>
            ))}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {snapshot === null ? (
          <span className="text-muted-foreground">{DASH}</span>
        ) : (
          <RelativeTime value={snapshot.capturedAt} className="text-2xs text-muted-foreground" />
        )}
      </td>
    </tr>
  );
}

function compareRows(a: PlanRow, b: PlanRow, key: SortKey, direction: SortDirection): number {
  switch (key) {
    case "product":
      return orderText(a.product?.name ?? "", b.product?.name ?? "", direction);
    case "price":
      return orderNullable(
        a.derived?.entryPriceUsd ?? null,
        b.derived?.entryPriceUsd ?? null,
        direction,
      );
    case "credits":
      return orderNullable(
        a.derived?.includedCreditsUsd ?? null,
        b.derived?.includedCreditsUsd ?? null,
        direction,
      );
    case "creditPerDollar":
      return orderNullable(
        a.derived?.includedCreditPerDollar ?? null,
        b.derived?.includedCreditPerDollar ?? null,
        direction,
      );
    case "freshness":
      return orderNullable(
        a.snapshot ? Date.parse(a.snapshot.capturedAt) : null,
        b.snapshot ? Date.parse(b.snapshot.capturedAt) : null,
        direction,
      );
    default:
      return 0;
  }
}

function orderNullable(a: number | null, b: number | null, direction: SortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function orderText(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b);
  return direction === "asc" ? result : -result;
}
