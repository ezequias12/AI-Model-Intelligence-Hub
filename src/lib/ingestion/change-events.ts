/**
 * Change-event derivation.
 *
 * Turns a snapshot diff into the rows the change feeds read. Both functions are
 * pure, so the runner stays thin orchestration and the mapping is unit-testable.
 *
 * An unchanged snapshot produces no events: the diff is the gate, which is what
 * makes a repeated run at the same state a no-op instead of a duplicate feed.
 */
import type {
  ChangeEvent,
  HarnessChangeEvent,
  HarnessPlan,
  HarnessPlanSnapshot,
  ModelSnapshot,
} from "@/lib/domain/schema";
import { arrayDelta, describeChange, diffSnapshots, type FieldChange } from "@/lib/domain/diff";

const PRICE_FIELDS = new Set([
  "inputPricePerMillion",
  "outputPricePerMillion",
  "cacheReadPricePerMillion",
  "cacheWritePricePerMillion",
]);
const CAPABILITY_FIELDS = new Set(["intelligence", "coding", "agentic", "math"]);

function modelEventType(field: string): string {
  if (PRICE_FIELDS.has(field)) return "price_changed";
  if (field === "deprecatedAt") return "deprecated";
  return "metric_changed";
}

function modelSignificance(field: string): ChangeEvent["significance"] {
  if (PRICE_FIELDS.has(field)) return "high";
  if (CAPABILITY_FIELDS.has(field)) return "medium";
  return "low";
}

/** Latest snapshot per entity, so a diff always compares against the prior state. */
export function latestSnapshotBy<T>(
  rows: T[],
  key: (row: T) => string,
  capturedAt: (row: T) => string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    const existing = map.get(id);
    if (!existing || Date.parse(capturedAt(row)) >= Date.parse(capturedAt(existing))) {
      map.set(id, row);
    }
  }
  return map;
}

/** One `change_events` row per changed model metric, priced changes marked high. */
export function buildModelChangeEvents(
  previousByModel: Map<string, ModelSnapshot>,
  incoming: ModelSnapshot[],
): ChangeEvent[] {
  const events: ChangeEvent[] = [];

  for (const snapshot of incoming) {
    const previous = previousByModel.get(snapshot.modelId);
    if (!previous || previous.id === snapshot.id) continue;

    const diff = diffSnapshots(
      previous.metrics as unknown as Record<string, unknown>,
      snapshot.metrics as unknown as Record<string, unknown>,
    );
    if (!diff.changed) continue;

    const label = snapshot.modelId.replace(/^model:/, "");
    for (const change of diff.changes) {
      events.push({
        id: `change:${snapshot.modelId}:${change.field}:${snapshot.id}`,
        entity: "model",
        entityId: snapshot.modelId,
        eventType: modelEventType(change.field),
        observedAt: snapshot.capturedAt,
        significance: modelSignificance(change.field),
        before: { [change.field]: change.before },
        after: { [change.field]: change.after },
        sourceId: snapshot.sourceId,
        summary: describeChange(label, change),
      });
    }
  }

  return events;
}

/** Fields compared between two harness snapshots; identity and provenance are not changes. */
const HARNESS_FIELDS = [
  "monthlyPriceUsd",
  "annualPriceUsd",
  "includedCreditsUsd",
  "estimatedRequests",
  "resetPeriod",
  "overageModel",
  "byok",
  "models",
  "frontierModelAccess",
  "platforms",
  "regions",
] as const;

const HARNESS_EVENT_BY_FIELD: Record<
  string,
  { eventType: HarnessChangeEvent["eventType"]; significance: HarnessChangeEvent["significance"] }
> = {
  monthlyPriceUsd: { eventType: "price_changed", significance: "high" },
  annualPriceUsd: { eventType: "price_changed", significance: "high" },
  includedCreditsUsd: { eventType: "credits_changed", significance: "high" },
  estimatedRequests: { eventType: "limit_changed", significance: "medium" },
  resetPeriod: { eventType: "limit_changed", significance: "medium" },
  overageModel: { eventType: "limit_changed", significance: "low" },
  byok: { eventType: "feature_added", significance: "low" },
  frontierModelAccess: { eventType: "feature_added", significance: "low" },
  platforms: { eventType: "feature_added", significance: "low" },
};

function projectHarnessSnapshot(snapshot: HarnessPlanSnapshot): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const field of HARNESS_FIELDS) projected[field] = snapshot[field];
  return projected;
}

function harnessModelEvents(
  plan: HarnessPlan,
  snapshot: HarnessPlanSnapshot,
  change: FieldChange,
): HarnessChangeEvent[] {
  const before = Array.isArray(change.before) ? (change.before as string[]) : [];
  const after = Array.isArray(change.after) ? (change.after as string[]) : [];
  const { added, removed } = arrayDelta(before, after);
  const events: HarnessChangeEvent[] = [];

  const push = (
    eventType: HarnessChangeEvent["eventType"],
    values: string[],
    verb: string,
  ): void => {
    events.push({
      id: `harness-change:${snapshot.planId}:${eventType}:${snapshot.id}`,
      planId: snapshot.planId,
      productId: plan.productId,
      eventType,
      before: { models: before },
      after: { models: after },
      observedAt: snapshot.capturedAt,
      significance: "medium",
      sourceId: snapshot.sourceId,
      summary: `${plan.name}: model ${verb} (${values.join(", ")})`,
    });
  };

  if (added.length > 0) push("model_added", added, "added");
  if (removed.length > 0) push("model_removed", removed, "removed");
  return events;
}

/** One `harness_change_events` row per changed plan field, typed via the event enum. */
export function buildHarnessChangeEvents(
  plansById: Map<string, HarnessPlan>,
  previousByPlan: Map<string, HarnessPlanSnapshot>,
  incoming: HarnessPlanSnapshot[],
): HarnessChangeEvent[] {
  const events: HarnessChangeEvent[] = [];

  for (const snapshot of incoming) {
    const previous = previousByPlan.get(snapshot.planId);
    const plan = plansById.get(snapshot.planId);
    if (!previous || !plan || previous.id === snapshot.id) continue;

    const diff = diffSnapshots(projectHarnessSnapshot(previous), projectHarnessSnapshot(snapshot));
    if (!diff.changed) continue;

    for (const change of diff.changes) {
      if (change.field === "models") {
        events.push(...harnessModelEvents(plan, snapshot, change));
        continue;
      }

      const mapping = HARNESS_EVENT_BY_FIELD[change.field];
      if (!mapping) continue;

      events.push({
        id: `harness-change:${snapshot.planId}:${mapping.eventType}:${change.field}:${snapshot.id}`,
        planId: snapshot.planId,
        productId: plan.productId,
        eventType: mapping.eventType,
        before: { [change.field]: change.before },
        after: { [change.field]: change.after },
        observedAt: snapshot.capturedAt,
        significance: mapping.significance,
        sourceId: snapshot.sourceId,
        summary: describeChange(plan.name, change),
      });
    }
  }

  return events;
}
