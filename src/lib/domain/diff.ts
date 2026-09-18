/**
 * Change detection.
 *
 * Snapshots only matter if we can say *what changed* between two of them. These
 * pure functions produce structured diffs that feed `change_events` and the
 * harness/model change feeds, and they drive idempotency: if the diff is empty
 * we write nothing.
 */

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
  /** Relative magnitude for numeric changes; null otherwise. */
  percentChange: number | null;
  direction: "up" | "down" | "changed" | "added" | "removed";
}

export interface SnapshotDiff {
  changed: boolean;
  changes: FieldChange[];
  /** Coarse significance for the change feed. */
  significance: "low" | "medium" | "high";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a === "number" && typeof b === "number") return Object.is(a, b);
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => valuesEqual(entry, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) if (!valuesEqual(a[key], b[key])) return false;
    return true;
  }
  return false;
}

/**
 * Diffs two snapshots field by field.
 *
 * `significance` reflects business impact: price and credits changes are high,
 * model additions/removals are medium, cosmetic or note changes are low.
 */
export function diffSnapshots(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  options: { highImpactFields?: string[]; mediumImpactFields?: string[] } = {},
): SnapshotDiff {
  const high = new Set(
    options.highImpactFields ?? [
      "monthlyPriceUsd",
      "annualPriceUsd",
      "includedCreditsUsd",
      "inputPricePerMillion",
      "outputPricePerMillion",
    ],
  );
  const medium = new Set(
    options.mediumImpactFields ?? [
      "models",
      "estimatedRequests",
      "resetPeriod",
      "overageModel",
      "byok",
      "frontierModelAccess",
      "deprecatedAt",
      "active",
    ],
  );

  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: FieldChange[] = [];

  for (const field of [...keys].sort()) {
    const beforeValue = before?.[field] ?? null;
    const afterValue = after?.[field] ?? null;
    if (valuesEqual(beforeValue ?? null, afterValue ?? null)) continue;

    let direction: FieldChange["direction"] = "changed";
    if (beforeValue === null || beforeValue === undefined) direction = "added";
    else if (afterValue === null || afterValue === undefined) direction = "removed";
    else if (typeof beforeValue === "number" && typeof afterValue === "number") {
      direction = afterValue > beforeValue ? "up" : "down";
    }

    changes.push({
      field,
      before: beforeValue,
      after: afterValue,
      percentChange:
        typeof beforeValue === "number" && typeof afterValue === "number" && beforeValue !== 0
          ? ((afterValue - beforeValue) / Math.abs(beforeValue)) * 100
          : null,
      direction,
    });
  }

  let significance: SnapshotDiff["significance"] = "low";
  for (const change of changes) {
    if (high.has(change.field)) {
      significance = "high";
      break;
    }
    if (medium.has(change.field)) significance = "medium";
  }

  return { changed: changes.length > 0, changes, significance };
}

/** Human-readable one-liner for a change event feed row. */
export function describeChange(entityLabel: string, change: FieldChange): string {
  const { field, before, after, direction, percentChange } = change;
  const human = HUMAN_FIELD_LABELS[field] ?? field;

  if (direction === "added") return `${entityLabel}: ${human} added (${formatValue(field, after)})`;
  if (direction === "removed")
    return `${entityLabel}: ${human} removed (was ${formatValue(field, before)})`;

  const delta =
    percentChange === null ? "" : ` (${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}%)`;
  return `${entityLabel}: ${human} changed from ${formatValue(field, before)} to ${formatValue(field, after)}${delta}`;
}

const HUMAN_FIELD_LABELS: Record<string, string> = {
  monthlyPriceUsd: "monthly price",
  annualPriceUsd: "annual price",
  includedCreditsUsd: "included credits",
  estimatedRequests: "estimated requests",
  resetPeriod: "reset period",
  overageModel: "overage model",
  byok: "BYOK",
  frontierModelAccess: "frontier model access",
  models: "included models",
  platforms: "platforms",
  deprecatedAt: "deprecation date",
  active: "active status",
  inputPricePerMillion: "input price",
  outputPricePerMillion: "output price",
  intelligence: "intelligence",
  coding: "coding",
  agentic: "agentic",
};

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") {
    if (field.toLowerCase().includes("price") || field.toLowerCase().includes("credit")) {
      return `$${value.toFixed(2)}`;
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.join(", ");
  return String(value);
}

/** Array delta used by model_added / model_removed harness events. */
export function arrayDelta(
  before: string[],
  after: string[],
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((value) => !beforeSet.has(value)),
    removed: before.filter((value) => !afterSet.has(value)),
  };
}
