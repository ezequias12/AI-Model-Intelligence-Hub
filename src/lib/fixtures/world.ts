/**
 * Fixture world & politics items.
 *
 * FIXTURE DATA. Every summary here is descriptive and attribution-first, and
 * deliberately avoids partisan framing. Contested items are flagged with
 * `multipleAccounts` so the UI shows sources instead of a synthesized verdict.
 */
import type { WorldNewsItem } from "@/lib/domain/schema";
import { canonicalizeUrl, newsContentHash } from "@/lib/domain/hash";

interface WorldSeed {
  id: string;
  region: WorldNewsItem["region"];
  category: WorldNewsItem["category"];
  headline: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  trustTier: WorldNewsItem["trustTier"];
  url: string;
  primarySourceUrl?: string | null;
  hoursAgo: number;
  eventHoursAgo?: number;
  countryCodes: string[];
  multipleAccounts?: boolean;
  developing?: boolean;
}

const W = (seed: WorldSeed): WorldSeed => seed;

export const WORLD_SEEDS: WorldSeed[] = [
  W({
    id: "world-01",
    region: "argentina",
    category: "economy",
    headline: "National statistics agency publishes monthly inflation reading",
    summary:
      "The agency reported the month-over-month figure in its scheduled release. Analysts surveyed beforehand had published a range of expectations.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/argentina-inflation",
    primarySourceUrl: "https://example.com/primary/argentina-indec",
    hoursAgo: 5,
    eventHoursAgo: 6,
    countryCodes: ["AR"],
  }),
  W({
    id: "world-02",
    region: "argentina",
    category: "regulation",
    headline: "Congress committee schedules debate on a tax measure",
    summary: "The committee published a hearing schedule. A vote has not been scheduled.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/argentina-tax-committee",
    hoursAgo: 12,
    countryCodes: ["AR"],
    developing: true,
  }),
  W({
    id: "world-03",
    region: "argentina",
    category: "economy",
    headline: "Central bank publishes its weekly reserves statement",
    summary: "The statement reports gross and net reserve levels as of the previous close.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/argentina-reserves",
    primarySourceUrl: "https://example.com/primary/bcra",
    hoursAgo: 20,
    countryCodes: ["AR"],
  }),
  W({
    id: "world-04",
    region: "united_states",
    category: "regulation",
    headline: "Federal agency opens a public comment period on an AI disclosure rule",
    summary:
      "The agency published a draft and opened a comment window. Industry groups and civil society organisations have said they will file comments.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/us-ai-disclosure",
    primarySourceUrl: "https://example.com/primary/federal-register",
    hoursAgo: 8,
    countryCodes: ["US"],
  }),
  W({
    id: "world-05",
    region: "united_states",
    category: "economy",
    headline: "Labor department releases monthly employment report",
    summary: "The report covers payrolls, the unemployment rate and revisions to prior months.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/us-employment",
    primarySourceUrl: "https://example.com/primary/bls",
    hoursAgo: 16,
    eventHoursAgo: 17,
    countryCodes: ["US"],
  }),
  W({
    id: "world-06",
    region: "united_states",
    category: "election",
    headline: "State officials publish certified results for a special election",
    summary:
      "Certified totals were published by the relevant state authority. Two outlets have reported slightly different turnout figures pending a final canvass.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/us-special-election",
    hoursAgo: 30,
    countryCodes: ["US"],
    multipleAccounts: true,
  }),
  W({
    id: "world-07",
    region: "latin_america",
    category: "economy",
    headline: "Regional trade bloc publishes quarterly trade statistics",
    summary: "The release covers intra-bloc and extra-bloc merchandise trade volumes.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/latam-trade",
    hoursAgo: 26,
    countryCodes: ["BR", "AR", "CL", "UY"],
  }),
  W({
    id: "world-08",
    region: "latin_america",
    category: "geopolitics",
    headline: "Two neighbouring governments announce a border infrastructure agreement",
    summary:
      "Both governments issued separate statements describing the scope of the agreement. Details on financing have not been published.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 2,
    url: "https://example.com/world/latam-border-infra",
    hoursAgo: 44,
    countryCodes: ["CL", "AR"],
    developing: true,
  }),
  W({
    id: "world-09",
    region: "world",
    category: "geopolitics",
    headline: "Multilateral summit concludes with a joint communiqué",
    summary:
      "Delegations published a joint communiqué. Two participants entered reservations on one paragraph.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/summit-communique",
    primarySourceUrl: "https://example.com/primary/communique",
    hoursAgo: 10,
    countryCodes: [],
    multipleAccounts: true,
  }),
  W({
    id: "world-10",
    region: "world",
    category: "conflict",
    headline: "Humanitarian agencies report access constraints in a conflict zone",
    summary:
      "Agencies described access constraints in their regular situation report. Figures are described as provisional.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 2,
    url: "https://example.com/world/humanitarian-access",
    hoursAgo: 18,
    countryCodes: [],
    developing: true,
  }),
  W({
    id: "world-11",
    region: "world",
    category: "diplomacy",
    headline: "Foreign ministers meet for a scheduled bilateral session",
    summary:
      "Both delegations described the meeting as scheduled diplomacy. No joint statement was published.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 2,
    url: "https://example.com/world/bilateral-session",
    hoursAgo: 34,
    countryCodes: [],
  }),
  W({
    id: "world-12",
    region: "economy",
    category: "economy",
    headline: "Central bank holds its policy rate at the current level",
    summary:
      "The rate decision was announced with the accompanying statement. The next meeting date was published.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/policy-rate-hold",
    primarySourceUrl: "https://example.com/primary/rate-statement",
    hoursAgo: 14,
    countryCodes: ["US"],
  }),
  W({
    id: "world-13",
    region: "economy",
    category: "economy",
    headline: "Global shipping index reports a change in container rates",
    summary: "The index publishes weekly rate movements on major routes.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 2,
    url: "https://example.com/world/shipping-rates",
    hoursAgo: 28,
    countryCodes: [],
  }),
  W({
    id: "world-14",
    region: "economy",
    category: "infrastructure",
    headline: "Energy regulator approves a transmission line project",
    summary: "The regulator published the approval and the conditions attached to it.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/transmission-approval",
    hoursAgo: 52,
    countryCodes: ["AR"],
  }),
  W({
    id: "world-15",
    region: "regulation",
    category: "regulation",
    headline: "Data protection authority issues guidance on automated decision-making",
    summary:
      "The guidance describes obligations and includes worked examples. It is not itself a binding decision.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/dpa-guidance",
    primarySourceUrl: "https://example.com/primary/dpa-guidance",
    hoursAgo: 22,
    countryCodes: [],
  }),
  W({
    id: "world-16",
    region: "regulation",
    category: "regulation",
    headline: "Competition authority opens a market study into cloud concentration",
    summary: "The authority published the scope of the study and invited submissions.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/cloud-market-study",
    hoursAgo: 38,
    countryCodes: [],
  }),
  W({
    id: "world-17",
    region: "geopolitics",
    category: "geopolitics",
    headline: "Two governments announce reciprocal tariff reviews",
    summary:
      "Each government published its own announcement. The scope of the reviews differs between the two statements.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 2,
    url: "https://example.com/world/tariff-reviews",
    hoursAgo: 24,
    countryCodes: ["US", "CN"],
    multipleAccounts: true,
    developing: true,
  }),
  W({
    id: "world-18",
    region: "geopolitics",
    category: "diplomacy",
    headline: "Trade delegation concludes a scheduled visit",
    summary:
      "The visiting delegation and the host government each published readouts of the meetings.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 2,
    url: "https://example.com/world/trade-delegation",
    hoursAgo: 46,
    countryCodes: [],
  }),
  W({
    id: "world-19",
    region: "elections",
    category: "other",
    headline: "Electoral authority publishes the official calendar for an upcoming vote",
    summary: "The calendar lists registration deadlines, campaign windows and the polling date.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/electoral-calendar",
    primarySourceUrl: "https://example.com/primary/electoral-authority",
    hoursAgo: 36,
    countryCodes: ["AR"],
  }),
  W({
    id: "world-20",
    region: "elections",
    category: "election",
    headline: "Pre-election polling aggregate shows a range of published estimates",
    summary:
      "The aggregate lists the individual published polls and their field dates. The app does not produce forecasts or predictions.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 2,
    url: "https://example.com/world/polling-aggregate",
    hoursAgo: 48,
    countryCodes: ["AR"],
  }),
  W({
    id: "world-21",
    region: "conflict_diplomacy",
    category: "conflict",
    headline: "Ceasefire monitors publish a quarterly compliance report",
    summary:
      "The monitoring body published its quarterly observations. Both parties disputed portions of the report.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 1,
    url: "https://example.com/world/ceasefire-compliance",
    hoursAgo: 60,
    countryCodes: [],
    multipleAccounts: true,
  }),
  W({
    id: "world-22",
    region: "conflict_diplomacy",
    category: "diplomacy",
    headline: "Mediators announce a further round of talks",
    summary: "The mediating parties announced a date. No agenda was published.",
    sourceId: "world-primary-wire",
    sourceName: "Primary Wire",
    trustTier: 2,
    url: "https://example.com/world/talks-round",
    hoursAgo: 15,
    countryCodes: [],
    developing: true,
  }),
];

export function buildFixtureWorldNews(now: Date): WorldNewsItem[] {
  return WORLD_SEEDS.map((seed) => {
    const canonicalUrl = canonicalizeUrl(seed.url);
    const publishedAt = new Date(now.getTime() - seed.hoursAgo * 3_600_000).toISOString();
    const eventAt =
      seed.eventHoursAgo === undefined
        ? null
        : new Date(now.getTime() - seed.eventHoursAgo * 3_600_000).toISOString();

    return {
      id: seed.id,
      region: seed.region,
      category: seed.category,
      headline: seed.headline,
      summary: seed.summary,
      sourceId: seed.sourceId,
      sourceName: seed.sourceName,
      trustTier: seed.trustTier,
      url: seed.url,
      canonicalUrl,
      primarySourceUrl: seed.primarySourceUrl ?? null,
      publishedAt,
      eventAt,
      discoveredAt: now.toISOString(),
      countryCodes: seed.countryCodes,
      multipleAccounts: seed.multipleAccounts ?? false,
      developing: seed.developing ?? false,
      contentHash: newsContentHash({ canonicalUrl, title: seed.headline, publishedAt }),
    } satisfies WorldNewsItem;
  });
}
