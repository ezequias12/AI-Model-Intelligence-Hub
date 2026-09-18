import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle, Section } from "@/components/ui/card";
import { MetaLine } from "@/components/ui/primitives";
import { cn } from "@/lib/utils/cn";
import { loadHarnessWorkspace } from "@/lib/data/workspace";
import {
  buildCheapestViews,
  deriveHarnessPlanMetrics,
  type CheapestContext,
} from "@/lib/domain/harness-metrics";
import { computeFreshness, thresholdsForDomain } from "@/lib/domain/freshness";
import { DASH, formatEnumLabel, formatRelative, formatUnitPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Harness Watch",
  description:
    "Coding-agent subscriptions: monitored products, current plans, prices, included credits, model access and change history.",
};

export default async function HarnessOverviewPage(): Promise<React.JSX.Element> {
  const workspace = await loadHarnessWorkspace();

  const contexts: CheapestContext[] = [];
  for (const plan of workspace.plans) {
    const snapshot = workspace.latestSnapshotByPlan.get(plan.id);
    if (!snapshot) continue;
    contexts.push({
      planId: plan.id,
      productId: plan.productId,
      planName: plan.name,
      productName: workspace.productsById.get(plan.productId)?.name ?? "Unknown product",
      derived: deriveHarnessPlanMetrics(snapshot),
      snapshot,
    });
  }

  const cheapest = buildCheapestViews(contexts);
  const monitoredProducts = workspace.products.filter((product) => product.active);

  const changes = [...workspace.changeEvents].sort(
    (a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt),
  );
  const latestChange = changes[0] ?? null;

  const latestVerifiedAt = contexts.reduce<string | null>((acc, context) => {
    if (acc === null) return context.snapshot.capturedAt;
    return Date.parse(context.snapshot.capturedAt) > Date.parse(acc)
      ? context.snapshot.capturedAt
      : acc;
  }, null);

  const freshness = computeFreshness(latestVerifiedAt, {
    thresholds: thresholdsForDomain("harness"),
  });

  const paidEntry = cheapest.lowestPaidEntryUsd;

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Harness Watch"
        description="A first-class workspace for coding-agent subscriptions. Prices carry their verification time and link to the page that documented them."
        actions={
          <Link
            href="/harness/plans"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Open plans board
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Monitored products"
            value={String(monitoredProducts.length)}
            detail={`${contexts.length} active plans tracked`}
          />
          <StatCard
            label="Latest plan change"
            value={latestChange ? formatEnumLabel(latestChange.eventType) : DASH}
            detail={latestChange ? latestChange.summary : "No changes recorded"}
            href={latestChange ? "/harness/changes" : undefined}
            footer={latestChange ? formatRelative(latestChange.observedAt) : undefined}
          />
          <StatCard
            label="Cheapest paid entry"
            value={paidEntry ? `${formatUnitPrice(paidEntry.value)}/mo` : DASH}
            detail={paidEntry ? paidEntry.planName : "No paid plan documented"}
            href={paidEntry ? "/harness/cheapest" : undefined}
          />
          <StatCard
            label="Free options"
            value={String(cheapest.free.length)}
            detail="Plans documented at no monthly cost"
            href="/harness/cheapest"
          />
          <StatCard
            label="Last verification"
            value={freshness.label}
            detail="Most recent plan snapshot in this dataset"
          />
        </div>
      </Section>

      <Section
        title="Monitored products"
        description="Vendors currently tracked for plan, price, credit and model-access changes."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {monitoredProducts.map((product) => (
            <Panel key={product.id}>
              <PanelHeader className="flex-row items-start justify-between gap-2">
                <PanelTitle>{product.name}</PanelTitle>
                {product.openSource ? (
                  <Badge variant="success">Open source</Badge>
                ) : (
                  <Badge variant="outline">Proprietary</Badge>
                )}
              </PanelHeader>
              <PanelBody className="flex flex-col gap-2 text-xs">
                <span className="text-2xs text-muted-foreground">{product.vendor}</span>
                <span className="flex flex-wrap gap-1">
                  {product.platforms.map((platform) => (
                    <Badge key={platform} variant="muted">
                      {formatEnumLabel(platform)}
                    </Badge>
                  ))}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <a
                    href={product.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-2xs underline underline-offset-2"
                  >
                    Website
                  </a>
                  {product.pricingUrl && (
                    <a
                      href={product.pricingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-2xs underline underline-offset-2"
                    >
                      Pricing
                    </a>
                  )}
                  {product.changelogUrl && (
                    <a
                      href={product.changelogUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-2xs underline underline-offset-2"
                    >
                      Changelog
                    </a>
                  )}
                </span>
              </PanelBody>
            </Panel>
          ))}
        </div>
      </Section>

      <Section
        title="Latest plan changes"
        description="The most recent observed changes across tracked plans."
        actions={
          <Link
            href="/harness/changes"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            All changes
          </Link>
        }
      >
        <Panel>
          <PanelBody className="flex flex-col divide-y divide-border p-0">
            {changes.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">No plan changes recorded.</p>
            ) : (
              changes.slice(0, 8).map((change) => {
                const product = workspace.productsById.get(change.productId);
                return (
                  <div
                    key={change.id}
                    className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs"
                  >
                    <MetaLine
                      className="min-w-0 flex-1"
                      items={[
                        <span key="product" className="font-medium">
                          {product?.name ?? "Unknown product"}
                        </span>,
                        <span key="summary" className="truncate text-muted-foreground">
                          {change.summary}
                        </span>,
                      ]}
                    />
                    <Badge variant="muted">{formatEnumLabel(change.eventType)}</Badge>
                    <Badge
                      variant={
                        change.significance === "high"
                          ? "warning"
                          : change.significance === "medium"
                            ? "info"
                            : "muted"
                      }
                    >
                      {formatEnumLabel(change.significance)}
                    </Badge>
                    <span className="tabular text-2xs text-muted-foreground">
                      {formatRelative(change.observedAt)}
                    </span>
                  </div>
                );
              })
            )}
          </PanelBody>
        </Panel>
      </Section>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/harness/plans" variant="default" size="sm">
          Plans
        </ButtonLink>
        <ButtonLink href="/harness/compare" variant="outline" size="sm">
          Compare
        </ButtonLink>
        <ButtonLink href="/harness/cheapest" variant="outline" size="sm">
          Cheapest
        </ButtonLink>
        <ButtonLink href="/harness/changes" variant="outline" size="sm">
          Changes
        </ButtonLink>
        <ButtonLink href="/harness/news" variant="outline" size="sm">
          News
        </ButtonLink>
        <ButtonLink href="/harness/calculator" variant="outline" size="sm">
          Calculator
        </ButtonLink>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  footer,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  footer?: string;
  href?: string;
}): React.JSX.Element {
  const body = (
    <PanelBody className="flex flex-col gap-1 py-3">
      <span className="tabular text-lg font-semibold">{value}</span>
      <span className="text-2xs text-muted-foreground">{detail}</span>
      {footer && <span className="text-2xs text-muted-foreground">{footer}</span>}
    </PanelBody>
  );

  return (
    <Panel>
      <PanelHeader className="py-2.5">
        <span className="text-2xs font-medium text-muted-foreground">{label}</span>
      </PanelHeader>
      {href ? (
        <Link
          href={href}
          className="rounded-b-panel transition-[background-color] duration-150 ease-out hover:bg-accent"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </Panel>
  );
}
