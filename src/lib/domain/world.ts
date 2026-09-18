/**
 * World & Politics neutrality guardrails.
 *
 * This workspace is explicitly, structurally separated from model/harness
 * recommendation logic. These helpers exist so neutrality is enforced by code
 * and by tests, not only by good intentions:
 *
 *  - no ideological sentiment scoring;
 *  - no candidate or party recommendations;
 *  - descriptive, attribution-first summaries;
 *  - contested claims are flagged, never adjudicated by the app.
 */
import type { WorldRegion } from "./schema";

export const WORLD_REGIONS: WorldRegion[] = [
  "argentina",
  "united_states",
  "latin_america",
  "world",
  "economy",
  "regulation",
  "geopolitics",
  "elections",
  "conflict_diplomacy",
];

export const WORLD_REGION_LABELS: Record<WorldRegion, string> = {
  argentina: "Argentina",
  united_states: "United States",
  latin_america: "Latin America",
  world: "World",
  economy: "Economy",
  regulation: "Regulation",
  geopolitics: "Geopolitics",
  elections: "Elections",
  conflict_diplomacy: "Conflict / Diplomacy",
};

/** Tabs shown in the UI, in order. */
export const WORLD_TAB_ORDER: Array<WorldRegion | "top"> = [
  "top",
  "argentina",
  "united_states",
  "latin_america",
  "world",
  "economy",
  "regulation",
  "geopolitics",
  "elections",
  "conflict_diplomacy",
];

/* -------------------------------------------------------------------------- */
/* Forbidden output                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Language patterns that turn reporting into advocacy or prediction. Their
 * presence in a generated summary is a defect, not a style preference.
 */
export const FORBIDDEN_PATTERNS: Array<{ id: string; pattern: RegExp; reason: string }> = [
  {
    id: "endorsement",
    pattern: /\b(we endorse|our endorsement|should vote for|best candidate|vote for)\b/i,
    reason: "Endorsement or voting advice",
  },
  {
    id: "prediction",
    pattern: /\b(will win|is certain to win|guaranteed to win|will lose the election)\b/i,
    reason: "Electoral prediction",
  },
  {
    id: "verdict",
    pattern: /\b(the truth is|obviously lying|clearly the culprit|proven guilty of|undeniably)\b/i,
    reason: "Unattributed verdict",
  },
  {
    id: "ideology_score",
    pattern:
      /\b(ideology score|partisan score|left-wing score|right-wing score|extremism index)\b/i,
    reason: "Ideological scoring",
  },
  {
    id: "dehumanizing",
    pattern: /\b(subhuman|vermin|animals who|infestation of)\b/i,
    reason: "Dehumanizing language",
  },
  {
    id: "ranking_actors",
    pattern: /\b(best president|worst president|best party|worst party|ranking of politicians)\b/i,
    reason: "Ranking political actors",
  },
];

export interface NeutrallityViolation {
  id: string;
  reason: string;
  match: string;
}

/** Scans a candidate summary for non-neutral patterns. Returns [] when clean. */
export function findNeutralityViolations(text: string): NeutrallityViolation[] {
  const violations: NeutrallityViolation[] = [];
  for (const rule of FORBIDDEN_PATTERNS) {
    const match = rule.pattern.exec(text);
    if (match) violations.push({ id: rule.id, reason: rule.reason, match: match[0] });
  }
  return violations;
}

export function isNeutral(text: string): boolean {
  return findNeutralityViolations(text).length === 0;
}

/* -------------------------------------------------------------------------- */
/* Attribution-first summaries                                                 */
/* -------------------------------------------------------------------------- */

export interface AttributionSummaryInput {
  headline: string;
  /** Reported facts, each already attributed by the caller. */
  claims: Array<{ text: string; attributedTo: string }>;
  multipleAccounts: boolean;
  developing: boolean;
}

/**
 * Builds a descriptive, attribution-first summary.
 *
 * Every sentence is either the headline restated or an explicitly attributed
 * claim. Contested stories get an explicit unresolved-claims note instead of a
 * synthesized verdict.
 */
export function buildAttributionSummary(input: AttributionSummaryInput): string {
  const parts: string[] = [input.headline.trim()];

  for (const claim of input.claims) {
    parts.push(`${claim.attributedTo} reports: ${claim.text.trim()}`);
  }

  if (input.multipleAccounts) {
    parts.push(
      "Accounts differ; sources are listed individually and the app does not adjudicate between them.",
    );
  }
  if (input.developing) {
    parts.push("Developing story: facts may change as more reporting becomes available.");
  }

  return parts.filter(Boolean).join(" ");
}

/**
 * Structural guard: political relevance must never leak into model or harness
 * ranking inputs. This is asserted in tests over the scoring modules.
 */
export const POLITICAL_DOMAIN = "world_politics" as const;

export function isPoliticalDomain(domain: string): boolean {
  return domain === POLITICAL_DOMAIN;
}

/**
 * Model/harness scoring inputs are arrays of metric keys. This asserts the set
 * contains no political field, because there is no such thing.
 */
export function assertNoPoliticalMetrics(metricKeys: string[]): {
  ok: boolean;
  offending: string[];
} {
  const offending = metricKeys.filter(
    (key) => key.includes("political") || key.includes("ideolog") || key.includes("partisan"),
  );
  return { ok: offending.length === 0, offending };
}

/** Country code -> display name for the region chips on world cards. */
export const COUNTRY_NAMES: Record<string, string> = {
  AR: "Argentina",
  US: "United States",
  BR: "Brazil",
  CL: "Chile",
  UY: "Uruguay",
  PY: "Paraguay",
  BO: "Bolivia",
  PE: "Peru",
  CO: "Colombia",
  MX: "Mexico",
  VE: "Venezuela",
  EC: "Ecuador",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  CN: "China",
  JP: "Japan",
  IN: "India",
  RU: "Russia",
  UA: "Ukraine",
  IL: "Israel",
  IR: "Iran",
  TW: "Taiwan",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}
