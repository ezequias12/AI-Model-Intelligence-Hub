/**
 * Model detail sections.
 *
 * Presentational only (no client hooks) so the same markup backs both the quick
 * inspect drawer and the full model page.
 */
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeltaBadge, MetaLine, ProviderDot } from "@/components/ui/primitives";
import { METRICS, getMetric, type ModelContext } from "@/lib/analytics/metric-registry";
import { percentChange } from "@/lib/domain/metrics";
import {
  formatContextWindow,
  formatDate,
  formatPercent,
  formatRelative,
  formatScore,
  formatSpeed,
  formatTtft,
  formatUnitPrice,
} from "@/lib/format";
import { sourceName } from "@/lib/fixtures/sources";
import type { Model, ModelSnapshot, Provider } from "@/lib/domain/schema";

export function ModelIdentitySection({
  model,
  provider,
}: {
  model: Model;
  provider: Provider | undefined;
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ProviderDot color={provider?.color ?? null} name={provider?.name ?? "Unknown"} size={10} />
        <span className="text-xs font-medium">{provider?.name ?? "Unknown provider"}</span>
        {model.openWeight ? (
          <Badge variant="info">Open-weight</Badge>
        ) : (
          <Badge variant="muted">Closed weights</Badge>
        )}
        {model.deprecatedAt ? (
          <Badge variant="destructive" title={`Deprecated ${formatDate(model.deprecatedAt)}`}>
            Deprecated
          </Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        )}
        {provider?.group === "china_based" && (
          <Badge variant="outline" title="Geographic provider classification, not a quality label">
            China-based
          </Badge>
        )}
        {provider?.group === "mainstream_global" && (
          <Badge variant="outline">Mainstream/global</Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
        <Field label="Released" value={formatDate(model.releaseDate)} />
        <Field
          label="Deprecated"
          value={model.deprecatedAt ? formatDate(model.deprecatedAt) : "Not deprecated"}
        />
        <Field label="Context window" value={formatContextWindow(model.metrics.contextWindow)} />
        <Field label="Source" value={sourceName(model.sourceId)} />
        <Field label="Source version" value={model.sourceVersion ?? "—"} />
        <Field label="Last refreshed" value={formatRelative(model.lastRefreshedAt)} />
      </dl>

      {model.description && <p className="text-xs text-muted-foreground">{model.description}</p>}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <dt className="text-2xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

export function ModelMetricsSection({
  model,
  previous,
}: {
  model: Model;
  previous: Model["metrics"] | null;
}): React.JSX.Element {
  const capability = METRICS.filter((metric) => metric.group === "capability");
  const performance = METRICS.filter((metric) => metric.group === "performance");

  return (
    <section className="flex flex-col gap-3">
      <MetricGroup title="Capability" metrics={capability} model={model} previous={previous} />
      <MetricGroup title="Performance" metrics={performance} model={model} previous={previous} />
    </section>
  );
}

function MetricGroup({
  title,
  metrics,
  model,
  previous,
}: {
  title: string;
  metrics: typeof METRICS;
  model: Model;
  previous: Model["metrics"] | null;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {metrics.map((metric) => {
          const current = metric.get({
            model,
            provider: undefined,
            blendedPrice: null,
            previous,
            population: [model.metrics],
          });
          const key = metric.key as keyof Model["metrics"];
          const previousValue = previous && key in previous ? previous[key] : null;
          const delta =
            typeof previousValue === "number" && typeof current === "number"
              ? percentChange(previousValue, current)
              : null;

          return (
            <div key={metric.key} className="flex flex-col gap-1 border-t border-border pt-2.5">
              <p className="text-2xs text-muted-foreground" title={metric.description}>
                {metric.label}
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="tabular text-sm font-semibold">{metric.format(current)}</span>
                {delta !== null && (
                  <DeltaBadge
                    value={delta}
                    betterDirection={metric.direction}
                    format={(value) => formatPercent(value, 1)}
                  />
                )}
              </div>
              {metric.provenance === "derived" && (
                <p className="mt-0.5 text-2xs text-muted-foreground">derived</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ModelPricingSection({ model }: { model: Model }): React.JSX.Element {
  const blended = getMetric("blendedPrice");
  const blendedValue = blended?.get({
    model,
    provider: undefined,
    blendedPrice: null,
    previous: null,
    population: [model.metrics],
  });

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">Pricing (USD per 1M tokens)</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <PriceCell label="Input" value={formatUnitPrice(model.metrics.inputPricePerMillion)} />
        <PriceCell label="Output" value={formatUnitPrice(model.metrics.outputPricePerMillion)} />
        <PriceCell
          label="Cache read"
          value={formatUnitPrice(model.metrics.cacheReadPricePerMillion)}
        />
        <PriceCell
          label="Cache write"
          value={formatUnitPrice(model.metrics.cacheWritePricePerMillion)}
        />
      </div>
      <p className="text-2xs text-muted-foreground">
        Blended price (75% input / 25% output):{" "}
        <span className="tabular font-medium text-foreground">
          {formatUnitPrice(blendedValue ?? null)}
        </span>
        . The 75/25 weighting is a stated assumption, not a vendor figure.
      </p>
    </section>
  );
}

function PriceCell({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border pt-2.5">
      <p className="text-2xs text-muted-foreground">{label}</p>
      <p className="tabular text-sm font-medium">{value}</p>
    </div>
  );
}

export function ModelLineageSection({
  model,
  snapshots,
}: {
  model: Model;
  snapshots: ModelSnapshot[];
}): React.JSX.Element {
  const ordered = [...snapshots].sort(
    (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
  );
  const latest = ordered[0];
  const previous = ordered[1];

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">Source lineage &amp; snapshots</h3>
      <div className="border-t border-border">
        <table className="w-full text-2xs">
          <caption className="sr-only">Historical snapshots for {model.name}</caption>
          <thead className="bg-surface-sunken">
            <tr>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Captured
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Intelligence
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Output price
              </th>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Source
              </th>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">
                Payload hash
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.slice(0, 8).map((snapshot) => (
              <tr key={snapshot.id} className="border-t border-border/60">
                <td className="px-2 py-1.5">{formatRelative(snapshot.capturedAt)}</td>
                <td className="tabular px-2 py-1.5 text-right">
                  {formatScore(snapshot.metrics.intelligence)}
                </td>
                <td className="tabular px-2 py-1.5 text-right">
                  {formatUnitPrice(snapshot.metrics.outputPricePerMillion)}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {sourceName(snapshot.sourceId)}
                </td>
                <td className="truncate px-2 py-1.5 font-mono text-muted-foreground">
                  {snapshot.payloadHash.slice(0, 12)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-2xs text-muted-foreground">
        {ordered.length} snapshot{ordered.length === 1 ? "" : "s"} stored.
        {latest && previous
          ? ` Latest differs from the previous snapshot on ${countChanges(latest, previous)} field${countChanges(latest, previous) === 1 ? "" : "s"}.`
          : " No prior snapshot to compare against yet."}
      </p>
    </section>
  );
}

function countChanges(latest: ModelSnapshot, previous: ModelSnapshot): number {
  const keys: Array<keyof Model["metrics"]> = [
    "intelligence",
    "coding",
    "agentic",
    "outputSpeedTps",
    "inputPricePerMillion",
    "outputPricePerMillion",
  ];
  return keys.filter((key) => latest.metrics[key] !== previous.metrics[key]).length;
}

export function RelatedModels({
  contexts,
  model,
}: {
  contexts: ModelContext[];
  model: Model;
}): React.JSX.Element {
  const related = contexts
    .filter(
      (context) =>
        context.model.id !== model.id &&
        (context.model.providerId === model.providerId ||
          context.model.openWeight === model.openWeight),
    )
    .sort(
      (a, b) =>
        Math.abs((b.model.metrics.intelligence ?? 0) - (model.metrics.intelligence ?? 0)) -
        Math.abs((a.model.metrics.intelligence ?? 0) - (model.metrics.intelligence ?? 0)),
    )
    .slice(0, 6);

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">Related models</h3>
      {related.length === 0 ? (
        <p className="text-xs text-muted-foreground">No closely related models in the catalogue.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {related.map((context) => (
            <li key={context.model.id}>
              <Link
                href={`/models/${context.model.slug}`}
                className="inline-flex items-center gap-1.5 rounded-chip border border-border bg-surface px-2 py-1 text-2xs underline-offset-2 hover:underline"
              >
                <ProviderDot
                  color={context.provider?.color ?? null}
                  name={context.provider?.name ?? "Unknown"}
                />
                {context.model.shortName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ModelHeadline({
  model,
  provider,
}: {
  model: Model;
  provider: Provider | undefined;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-md">{model.name}</CardTitle>
        <MetaLine
          className="text-xs text-muted-foreground"
          items={[
            provider?.name ?? "Unknown provider",
            model.openWeight ? "open-weight" : "closed weights",
            formatSpeed(model.metrics.outputSpeedTps),
            `TTFT ${formatTtft(model.metrics.ttftSeconds)}`,
          ]}
        />
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <HeadlineMetric label="Intelligence" value={formatScore(model.metrics.intelligence)} />
        <HeadlineMetric label="Coding" value={formatScore(model.metrics.coding)} />
        <HeadlineMetric label="Agentic" value={formatScore(model.metrics.agentic)} />
        <HeadlineMetric label="Context" value={formatContextWindow(model.metrics.contextWindow)} />
      </CardContent>
    </Card>
  );
}

function HeadlineMetric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <p className="text-2xs font-medium text-muted-foreground">{label}</p>
      <p className="measured text-lg font-semibold leading-tight">{value}</p>
    </div>
  );
}
