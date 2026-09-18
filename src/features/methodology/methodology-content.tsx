import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Section, SectionStack } from "@/components/ui/card";
import { TrustTierBadge } from "@/components/ui/primitives";
import { metricCatalog } from "@/lib/analytics/metric-registry";
import { thresholdsForDomain, type FreshnessState } from "@/lib/domain/freshness";
import { DEFAULT_BLENDED_PRICE_WEIGHTS, DEFAULT_WEIGHTED_VALUE_WEIGHTS } from "@/lib/domain/schema";
import { DASH, formatEnumLabel } from "@/lib/format";

const METRIC_GROUP_LABELS: Record<string, string> = {
  capability: "Capability",
  performance: "Performance",
  cost: "Cost",
  derived: "Derived",
};

const FRESHNESS_DOMAINS = [
  { domain: "models", label: "Model metrics" },
  { domain: "ai_news", label: "AI news" },
  { domain: "harness", label: "Harness pricing" },
  { domain: "world_politics", label: "World & politics" },
  { domain: "social", label: "Social" },
  { domain: "research", label: "Research" },
];

function directionLabel(direction: "higher" | "lower"): string {
  return direction === "higher" ? "Higher is better" : "Lower is better";
}

function provenanceLabel(provenance: "measured" | "derived"): string {
  return provenance === "measured" ? "Measured" : "Derived";
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function freshnessStateLabel(state: FreshnessState): string {
  switch (state) {
    case "fresh":
      return "Fresh";
    case "aging":
      return "Aging";
    case "stale":
      return "Stale";
    default:
      return "Unknown";
  }
}

const PROSE = "flex max-w-[68ch] flex-col gap-3 text-sm leading-relaxed text-muted-foreground";

export function MethodologyContent(): React.JSX.Element {
  const blendedInput = DEFAULT_BLENDED_PRICE_WEIGHTS.input;
  const blendedOutput = DEFAULT_BLENDED_PRICE_WEIGHTS.output;
  const metrics = metricCatalog();

  return (
    <SectionStack>
      <header className="flex flex-col gap-1">
        <p className="max-w-3xl text-xs text-muted-foreground">
          How every number is produced, and what it does not claim. Anything that is an assumption
          is labelled as one wherever it appears, and any unknown value renders as an em dash.
        </p>
      </header>

      <Section
        title="Model data"
        description="Where model metrics come from and how measured and derived values are distinguished."
      >
        <div className={PROSE}>
          <p>
            Model metrics come from the Artificial Analysis Data API with attribution. Values are
            rendered as published. Capability and performance metrics are <em>measured</em>; cost
            efficiency scores are <em>derived</em> from published prices, and both are marked in the
            catalogue below.
          </p>
          <p>
            Every refresh writes a snapshot, so a value shown as current always carries its age and
            any movement is backed by a before/after change event. A metric the source did not
            publish is unknown and renders as <span className="tabular">—</span>, never as zero.
          </p>
        </div>
      </Section>

      <Section
        title="Cost efficiency"
        description="The blended-price assumption is explicit and configurable."
      >
        <div className={PROSE}>
          <p>
            Cost efficiency divides a capability index by a blended token price. By default the
            blended price is{" "}
            <span className="font-medium text-foreground">
              {Math.round(blendedInput * 100)}% input + {Math.round(blendedOutput * 100)}% output
            </span>
            . This is an assumption about a typical workload, not a fact published by any vendor,
            and it is configurable.
          </p>
          <p>
            The weighted-value score additionally min-max normalises intelligence, coding and
            agentic scores (default weights{" "}
            <span className="tabular">
              {DEFAULT_WEIGHTED_VALUE_WEIGHTS.intelligence} /{" "}
              {DEFAULT_WEIGHTED_VALUE_WEIGHTS.coding} / {DEFAULT_WEIGHTED_VALUE_WEIGHTS.agentic}
            </span>
            ) before dividing by the blended price. Changing the weighting changes the ranking, so
            the assumption is always shown next to the result.
          </p>
          <p>
            Cache-read and cache-write prices are reported separately because caching changes real
            workloads materially and cannot be folded into a single blended number without another
            assumption.
          </p>
        </div>
      </Section>

      <Section
        title="Provider groups"
        description="Grouping is geographic and structural — never a quality judgement."
      >
        <div className={PROSE}>
          <p>
            Providers are grouped as{" "}
            <span className="font-medium text-foreground">mainstream / global</span>,{" "}
            <span className="font-medium text-foreground">China-based</span> and{" "}
            <span className="font-medium text-foreground">other</span>. This is a geographic and
            structural classification used for filtering and segmentation only.
          </p>
          <p>
            The grouping is never a ranking, never a rating of quality, safety or trustworthiness,
            and never used as a scoring input. No metric is computed differently because of a
            provider&apos;s group.
          </p>
        </div>
      </Section>

      <Section
        title="News trust tiers"
        description="Trust tiers describe provenance quality, never a political viewpoint."
      >
        <div className={PROSE}>
          <ul className="flex flex-col gap-2">
            <li className="flex items-start gap-2">
              <TrustTierBadge tier={1} />
              <span>
                Official source: provider documentation, release notes, changelogs, pricing pages or
                a primary document.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <TrustTierBadge tier={2} />
              <span>Established reporting or a reputable technical publication.</span>
            </li>
            <li className="flex items-start gap-2">
              <TrustTierBadge tier={3} />
              <span>
                Social post or uncorroborated discovery signal; treated as a lead, not a
                confirmation.
              </span>
            </li>
          </ul>
          <p>
            A tier describes where a claim comes from, not whether it is true and not what it
            implies. Corroboration is tracked separately, and a lower-tier item is never promoted to
            a verdict.
          </p>
        </div>
      </Section>

      <Section
        title="Harness plan comparison"
        description="What plan comparison does and does not infer."
      >
        <div className={PROSE}>
          <p>
            Plan prices, included credits, reset periods, overage models, model access, BYOK
            support, platforms and regions come from official pricing and documentation pages. Every
            plan refresh is snapshotted, and price and feature changes are recorded as change
            events.
          </p>
          <p>
            Estimated request counts are shown only when the vendor documents them; they are never
            inferred from a model&apos;s token prices. Any cheapest-option or fit view states the
            formula it uses and the assumptions it makes, and never hides the raw prices behind it.
          </p>
        </div>
      </Section>

      <Section
        title="Political-news neutrality"
        description="World & Politics is a separate editorial domain with hard constraints."
      >
        <div className={PROSE}>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>
              Every item names its source, trust tier, publication time and, when it differs, the
              event time, plus country and region tags.
            </li>
            <li>
              Contested stories show a <Badge variant="outline">Multiple accounts</Badge> indicator
              and list sources individually. The app does not adjudicate contested claims and does
              not synthesize a verdict.
            </li>
            <li>
              Stories whose facts may be changing carry a{" "}
              <Badge variant="warning">Developing</Badge> badge.
            </li>
            <li>
              No ideological sentiment scores, no ranking of political actors, no party or candidate
              recommendations and no electoral predictions are produced.
            </li>
            <li>
              Political content is stored under its own domain and structurally never feeds model or
              harness recommendations.
            </li>
          </ul>
        </div>
      </Section>

      <Section
        title="Historical snapshots"
        description="Immutability and idempotency behind every change event."
      >
        <div className={PROSE}>
          <p>
            Model metrics and harness plans are stored as snapshots rather than overwritten in
            place. Each snapshot records when it was captured, its source and a content hash of the
            normalised payload.
          </p>
          <p>
            The payload hash makes ingestion idempotent and lets the change feed show a genuine
            before/after difference, so a value never silently changes without a recorded event.
          </p>
        </div>
      </Section>

      <Section
        title="Data freshness"
        description="Every value shown as current carries its age, measured against per-domain thresholds."
      >
        <div className="flex flex-col gap-2">
          <div className="scroll-thin overflow-x-auto" tabIndex={0}>
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <caption className="sr-only">
                Freshness thresholds per domain, with the state each age range maps to.
              </caption>
              <thead className="bg-surface">
                <tr className="border-b border-border">
                  <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Domain
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Fresh
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Aging
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Stale
                  </th>
                </tr>
              </thead>
              <tbody>
                {FRESHNESS_DOMAINS.map((entry) => {
                  const thresholds = thresholdsForDomain(entry.domain);
                  return (
                    <tr key={entry.domain} className="border-b border-border/50">
                      <td className="px-3 py-1.5 font-medium">{entry.label}</td>
                      <td className="tabular px-3 py-1.5 text-muted-foreground">
                        {freshnessStateLabel("fresh")} ≤ {formatMinutes(thresholds.freshMinutes)}
                      </td>
                      <td className="tabular px-3 py-1.5 text-muted-foreground">
                        ≤ {formatMinutes(thresholds.agingMinutes)}
                      </td>
                      <td className="tabular px-3 py-1.5 text-muted-foreground">
                        Beyond {formatMinutes(thresholds.agingMinutes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-2xs text-muted-foreground">
            A source that has never synced is reported as{" "}
            <span className="tabular">Never synced</span> rather than assumed fresh.
          </p>
        </div>
      </Section>

      <Section
        title="Metric catalogue"
        description={`${metrics.length} metrics. Direction, provenance, unit and description for each.`}
      >
        <div className="scroll-thin overflow-x-auto" tabIndex={0}>
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <caption className="sr-only">
              Every metric the product can rank, chart, filter or export, with its direction,
              provenance, unit and description.
            </caption>
            <thead className="bg-surface">
              <tr className="border-b border-border">
                {["Metric", "Group", "Direction", "Provenance", "Unit", "Description"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.key} className="border-b border-border/50 align-top">
                  <td className="px-3 py-1.5 font-medium">{metric.label}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                    {METRIC_GROUP_LABELS[metric.group] ?? formatEnumLabel(metric.group)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                    {directionLabel(metric.direction)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <Badge variant={metric.provenance === "measured" ? "muted" : "outline"}>
                      {provenanceLabel(metric.provenance)}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                    {metric.unit ?? DASH}
                  </td>
                  <td className="max-w-[420px] px-3 py-1.5 text-muted-foreground">
                    {metric.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </SectionStack>
  );
}
