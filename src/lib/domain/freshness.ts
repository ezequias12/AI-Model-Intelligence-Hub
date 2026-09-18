/**
 * Data freshness.
 *
 * Every number rendered as "current" must carry its age. These helpers turn a
 * timestamp into a state the UI can act on, so stale values are never presented
 * as if they were live.
 */

export type FreshnessState = "fresh" | "aging" | "stale" | "unknown";

export interface FreshnessThresholds {
  /** Below this age (minutes) the value is fresh. */
  freshMinutes: number;
  /** Below this age (minutes) the value is aging; beyond it, stale. */
  agingMinutes: number;
}

export interface Freshness {
  state: FreshnessState;
  ageMinutes: number | null;
  ageMs: number | null;
  label: string;
  capturedAt: string | null;
  thresholds: FreshnessThresholds;
}

export const DEFAULT_FRESHNESS: FreshnessThresholds = { freshMinutes: 60, agingMinutes: 360 };

const SOURCE_FRESHNESS: Record<string, FreshnessThresholds> = {
  models: { freshMinutes: 60, agingMinutes: 360 },
  ai_news: { freshMinutes: 90, agingMinutes: 720 },
  harness: { freshMinutes: 360, agingMinutes: 2880 },
  world_politics: { freshMinutes: 180, agingMinutes: 1440 },
  social: { freshMinutes: 60, agingMinutes: 720 },
  research: { freshMinutes: 360, agingMinutes: 2880 },
};

export function thresholdsForDomain(domain: string): FreshnessThresholds {
  return SOURCE_FRESHNESS[domain] ?? DEFAULT_FRESHNESS;
}

export function computeFreshness(
  capturedAt: string | null | undefined,
  options: { now?: Date; thresholds?: FreshnessThresholds } = {},
): Freshness {
  const now = options.now ?? new Date();
  const thresholds = options.thresholds ?? DEFAULT_FRESHNESS;

  if (!capturedAt) {
    return {
      state: "unknown",
      ageMinutes: null,
      ageMs: null,
      label: "Never synced",
      capturedAt: null,
      thresholds,
    };
  }

  const timestamp = Date.parse(capturedAt);
  if (Number.isNaN(timestamp)) {
    return {
      state: "unknown",
      ageMinutes: null,
      ageMs: null,
      label: "Unknown freshness",
      capturedAt,
      thresholds,
    };
  }

  const ageMs = Math.max(0, now.getTime() - timestamp);
  const ageMinutes = ageMs / 60000;

  let state: FreshnessState = "stale";
  if (ageMinutes <= thresholds.freshMinutes) state = "fresh";
  else if (ageMinutes <= thresholds.agingMinutes) state = "aging";

  return {
    state,
    ageMinutes,
    ageMs,
    label: formatAge(ageMinutes),
    capturedAt,
    thresholds,
  };
}

export function formatAge(ageMinutes: number): string {
  if (ageMinutes < 1) return "just now";
  if (ageMinutes < 60) return `${Math.round(ageMinutes)}m ago`;
  const hours = ageMinutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/** Sort key: oldest first, unknowns last. Used by the Sources workspace. */
export function freshnessSortKey(freshness: Freshness): number {
  return freshness.ageMinutes ?? Number.POSITIVE_INFINITY;
}
