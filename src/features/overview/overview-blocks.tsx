import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProviderDot, TrustTierBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils/cn";
import type {
  ChangeEvent,
  HarnessChangeEvent,
  HarnessPlan,
  HarnessPlanSnapshot,
  HarnessProduct,
  IngestionRun,
  Model,
  ModelMetrics,
  NewsItem,
  Provider,
  SocialPost,
  SourceDefinition,
  WorldNewsItem,
} from "@/lib/domain/schema";
import { buildModelContexts } from "@/lib/analytics/metric-registry";
import { computeLeaderCards, computeRankings } from "@/lib/analytics";
import {
  buildCheapestViews,
  deriveHarnessPlanMetrics,
  type CheapestContext,
} from "@/lib/domain/harness-metrics";
import { computeFreshness, thresholdsForDomain } from "@/lib/domain/freshness";
import { formatRelative, formatUnitPrice } from "@/lib/format";
import { countryName } from "@/lib/domain/world";

export interface OverviewBlocksProps {
  models: Model[];
  providers: Provider[];
  previousByModelId: Map<string, ModelMetrics>;
  news: NewsItem[];
  harnessProducts: HarnessProduct[];
  harnessPlans: HarnessPlan[];
  harnessSnapshots: HarnessPlanSnapshot[];
  harnessChangeEvents: HarnessChangeEvent[];
  world: WorldNewsItem[];
  socialPosts: SocialPost[];
  changeEvents: ChangeEvent[];
  sources: SourceDefinition[];
  /** Ingestion ledger, so freshness reports when a source was actually polled. */
  ingestionRuns: IngestionRun[];
}

/**
 * Overview: a compact cross-domain command center.
 *
 * Deliberately not the full product: every block is a summary that deep-links
 * into the workspace that owns the detail.
 */
export function OverviewBlocks({
  models,
  providers,
  previousByModelId,
  news,
  harnessProducts,
  harnessPlans,
  harnessSnapshots,
  harnessChangeEvents,
  world,
  socialPosts,
  changeEvents,
  sources,
  ingestionRuns,
}: OverviewBlocksProps): React.JSX.Element {
  const contexts = buildModelContexts(models, providers, previousByModelId);
  const leaders = computeLeaderCards(contexts);
  const valueBoard = computeRankings(contexts, {
    scope: "all",
    providerScope: { filter: "all" },
    selectedIds: [],
    minimumCapability: 50,
    limit: 5,
  }).find((result) => result.definition.id === "value_weighted");

  const productById = new Map(harnessProducts.map((product) => [product.id, product]));
  const latestByPlan = new Map<string, HarnessPlanSnapshot>();
  for (const snapshot of harnessSnapshots) {
    const existing = latestByPlan.get(snapshot.planId);
    if (!existing || Date.parse(snapshot.capturedAt) > Date.parse(existing.capturedAt)) {
      latestByPlan.set(snapshot.planId, snapshot);
    }
  }

  const cheapestContexts: CheapestContext[] = [];
  for (const plan of harnessPlans) {
    const snapshot = latestByPlan.get(plan.id);
    if (!snapshot) continue;
    cheapestContexts.push({
      planId: plan.id,
      productId: plan.productId,
      planName: plan.name,
      productName: productById.get(plan.productId)?.name ?? "Unknown product",
      derived: deriveHarnessPlanMetrics(snapshot),
      snapshot,
    });
  }

  const cheapest = buildCheapestViews(cheapestContexts);

  const topNews = [...news]
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
    .slice(0, 6);

  const worldHeadlines = [...world]
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
    .slice(0, 5);

  const socialSample = [...socialPosts]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 4);

  const recentChanges = [...changeEvents]
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
    .slice(0, 6);

  const staleSources = sources
    .map((source) => ({
      source,
      freshness: computeFreshness(latestAttemptForSource(source.id, ingestionRuns), {
        thresholds: thresholdsForDomain(source.domain),
      }),
    }))
    .sort(
      (a, b) =>
        (b.freshness.ageMinutes ?? Number.POSITIVE_INFINITY) -
        (a.freshness.ageMinutes ?? Number.POSITIVE_INFINITY),
    );

  return (
    <div className="flex flex-col gap-8">
      <MarketPulse leaders={leaders} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChangeBlock
          title="Today's model changes"
          description="Observed metric and price changes across tracked models."
          href="/models/releases"
          hrefLabel="Model releases"
        >
          {recentChanges.filter((event) => event.entity === "model").length === 0 ? (
            <Empty>No model changes observed in the current window.</Empty>
          ) : (
            recentChanges
              .filter((event) => event.entity === "model")
              .map((event) => (
                <Row key={event.id} title={event.summary}>
                  <Badge variant={event.significance === "high" ? "warning" : "muted"}>
                    {event.significance}
                  </Badge>
                  <span className="text-2xs text-muted-foreground">
                    {formatRelative(event.observedAt)}
                  </span>
                </Row>
              ))
          )}
        </ChangeBlock>

        <ChangeBlock
          title="Harness plan changes"
          description="Subscription, credit and model-access changes."
          href="/harness/changes"
          hrefLabel="All harness changes"
        >
          {harnessChangeEvents.length === 0 ? (
            <Empty>No harness plan changes recorded.</Empty>
          ) : (
            harnessChangeEvents.slice(0, 6).map((event) => (
              <Row key={event.id} title={event.summary}>
                <Badge variant={event.significance === "high" ? "warning" : "muted"}>
                  {event.eventType.replace(/_/g, " ")}
                </Badge>
                <span className="text-2xs text-muted-foreground">
                  {formatRelative(event.observedAt)}
                </span>
              </Row>
            ))
          )}
        </ChangeBlock>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Top value models</CardTitle>
            <Link href="/models/rankings" className="text-2xs underline underline-offset-2">
              Rankings
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <p className="text-2xs text-muted-foreground">
              Weighted value with a minimum intelligence threshold of 50, so cheap-but-weak models
              do not top the list.
            </p>
            {valueBoard?.rows.length ? (
              valueBoard.rows.map((row) => (
                <div key={row.context.model.id} className="flex items-center gap-2 text-xs">
                  <span className="tabular w-4 text-right text-2xs text-muted-foreground">
                    {row.rank}
                  </span>
                  <ProviderDot
                    color={row.context.provider?.color ?? null}
                    name={row.context.provider?.name ?? "Unknown"}
                  />
                  <Link
                    href={`/models/${row.context.model.slug}`}
                    className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                  >
                    {row.context.model.shortName}
                  </Link>
                  <span className="tabular text-2xs">{row.display}</span>
                </div>
              ))
            ) : (
              <Empty>No models pass the threshold.</Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Cheapest harness entry points</CardTitle>
            <Link href="/harness/cheapest" className="text-2xs underline underline-offset-2">
              Cheapest
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 text-xs">
            <CheapestLine label="Free options" value={`${cheapest.free.length} available`} />
            <CheapestLine
              label="Lowest paid entry"
              name={cheapest.lowestPaidEntryUsd?.planName ?? null}
              value={
                cheapest.lowestPaidEntryUsd
                  ? `${formatUnitPrice(cheapest.lowestPaidEntryUsd.value)}/month`
                  : null
              }
            />
            <CheapestLine
              label="Best credit per USD"
              name={cheapest.highestCreditPerDollar?.planName ?? null}
              value={
                cheapest.highestCreditPerDollar
                  ? `${cheapest.highestCreditPerDollar.value.toFixed(2)}x`
                  : null
              }
            />
            <CheapestLine
              label="Premium under $20"
              name={cheapest.premiumUnderThreshold?.planName ?? null}
              value={
                cheapest.premiumUnderThreshold
                  ? formatUnitPrice(cheapest.premiumUnderThreshold.value)
                  : null
              }
            />
            <p className="max-w-[68ch] text-xs text-muted-foreground">
              Every figure links to its source page and carries its verification timestamp.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Social pulse</CardTitle>
            <Link href="/news/social" className="text-2xs underline underline-offset-2">
              Social Pulse
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {socialSample.length === 0 ? (
              <Empty>No monitored posts.</Empty>
            ) : (
              socialSample.map((post) => (
                <div key={post.id} className="flex flex-col gap-0.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{post.handle}</span>
                    {post.corroborated ? (
                      <Badge variant="success">Corroborated</Badge>
                    ) : (
                      <Badge variant="muted">Not yet corroborated</Badge>
                    )}
                    <span className="ml-auto text-2xs text-muted-foreground">
                      {formatRelative(post.publishedAt)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-2xs text-muted-foreground">{post.text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Important AI news</CardTitle>
            <Link href="/news" className="text-2xs underline underline-offset-2">
              News
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border p-0">
            {topNews.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-2xs font-medium">{item.sourceName}</span>
                  <TrustTierBadge tier={item.trustTier} />
                  {item.official && <Badge variant="success">Official</Badge>}
                  <span className="ml-auto text-2xs text-muted-foreground">
                    {formatRelative(item.publishedAt)}
                  </span>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs font-medium underline-offset-2 hover:underline"
                >
                  {item.title}
                </a>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>World headline strip</CardTitle>
            <Link href="/world" className="text-2xs underline underline-offset-2">
              World &amp; Politics
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-2xs text-muted-foreground">
              Separate editorial domain. Descriptive, attributed, and never used for model or
              harness recommendations.
            </p>
            {worldHeadlines.map((item) => (
              <div key={item.id} className="flex flex-col gap-0.5 text-xs">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="line-clamp-2 font-medium underline-offset-2 hover:underline"
                >
                  {item.headline}
                </a>
                <span className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                  {item.sourceName}
                  {item.countryCodes.slice(0, 2).map((code) => (
                    <Badge key={code} variant="outline">
                      {countryName(code)}
                    </Badge>
                  ))}
                  {item.multipleAccounts && <Badge variant="warning">Multiple accounts</Badge>}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Source freshness</CardTitle>
          <Link href="/sources" className="text-xs text-foreground underline decoration-border">
            All sources
          </Link>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-px bg-border p-0 sm:grid-cols-2 lg:grid-cols-4">
          {staleSources.slice(0, 8).map(({ source, freshness }) => (
            <div key={source.id} className="flex flex-col gap-0.5 bg-card px-3 py-2.5">
              <span className="truncate text-xs font-medium text-foreground">{source.name}</span>
              <span
                className={cn(
                  "text-2xs",
                  freshness.state === "fresh"
                    ? "text-success"
                    : freshness.state === "aging"
                      ? "text-warning"
                      : freshness.state === "stale"
                        ? "text-destructive"
                        : "text-muted-foreground",
                )}
              >
                {freshness.label}
              </span>
              <span className="truncate text-2xs text-muted-foreground">
                {source.enabled
                  ? `${source.cadenceMinutes ?? "—"} minute cadence`
                  : "Disabled, no credentials"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/models" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
          Open Models
        </Link>
        <Link href="/news" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Open News
        </Link>
        <Link href="/harness" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Open Harness Watch
        </Link>
      </div>
    </div>
  );
}

/**
 * When a source was last polled, taken from the ingestion ledger.
 *
 * A source with no recorded run is reported as never synced rather than inferred
 * from whatever news items happen to carry its id.
 */
function latestAttemptForSource(sourceId: string, runs: IngestionRun[]): string | null {
  let latest: number | null = null;

  for (const run of runs) {
    if (run.sourceId !== sourceId || run.status === "skipped") continue;
    const at = Date.parse(run.finishedAt ?? run.startedAt);
    if (Number.isNaN(at)) continue;
    if (latest === null || at > latest) latest = at;
  }

  return latest === null ? null : new Date(latest).toISOString();
}

function MarketPulse({
  leaders,
}: {
  leaders: ReturnType<typeof computeLeaderCards>;
}): React.JSX.Element {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Market pulse</CardTitle>
          <p className="max-w-[68ch] text-xs text-muted-foreground">
            The fastest read on the current model landscape.
          </p>
        </div>
        <Link
          href="/models/rankings"
          className="whitespace-nowrap text-xs text-foreground underline decoration-border"
        >
          Full rankings
        </Link>
      </CardHeader>

      {/* One band divided by hairlines: the readings are comparable, so they
          belong on a single line the eye can scan across. */}
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {leaders.map((leader) => (
          <div key={leader.id} className="flex min-w-0 flex-col bg-card px-3 py-2.5">
            <span className="truncate text-2xs font-medium text-muted-foreground">
              {leader.label}
            </span>
            <span className="measured mt-1 text-md font-medium leading-none">
              {leader.metricDisplay}
            </span>
            {leader.context ? (
              <Link
                href={`/models/${leader.context.model.slug}`}
                className="mt-1.5 flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground"
              >
                <ProviderDot
                  color={leader.context.provider?.color ?? null}
                  name={leader.context.provider?.name ?? "Unknown"}
                  size={6}
                />
                <span className="truncate text-foreground">{leader.context.model.shortName}</span>
              </Link>
            ) : (
              <span className="mt-1.5 text-2xs text-muted-foreground">—</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ChangeBlock({
  title,
  description,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <CardTitle>{title}</CardTitle>
          <p className="text-2xs text-muted-foreground">{description}</p>
        </div>
        <Link href={href} className="text-2xs underline underline-offset-2">
          {hrefLabel}
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border p-0">{children}</CardContent>
    </Card>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
      <span className="min-w-0 flex-1">{title}</span>
      {children}
    </div>
  );
}

/**
 * One cheapest-option row.
 *
 * The plan name and its figure are separate fields divided by a hairline, so the
 * row never reads as a chain of em dashes.
 */
function CheapestLine({
  label,
  name,
  value,
}: {
  label: string;
  name?: string | null;
  value: string | null;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-baseline gap-2">
        {name && <span className="truncate text-foreground">{name}</span>}
        {name && <span aria-hidden="true" className="meta-sep" />}
        <span
          className={cn(
            "measured shrink-0 text-2xs",
            value === null ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {value ?? "—"}
        </span>
      </span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="px-4 py-3 text-xs text-muted-foreground">{children}</p>;
}
