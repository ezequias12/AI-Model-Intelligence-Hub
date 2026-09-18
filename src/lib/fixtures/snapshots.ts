/**
 * Fixture model snapshot history.
 *
 * Snapshot history is what makes deltas, change events and the Releases view
 * possible. Values are generated deterministically from a per-model seed so the
 * same fixture always produces the same history.
 */
import type { Model, ModelMetrics, ModelSnapshot } from "@/lib/domain/schema";
import { hashPayload, stableHash } from "@/lib/domain/hash";

/** Days in the past at which a snapshot is generated. Oldest first. */
const SNAPSHOT_OFFSETS_DAYS = [120, 90, 60, 30, 7, 0];

function seededUnit(seed: string, index: number): number {
  const hash = stableHash(`${seed}:${index}`);
  const value = Number.parseInt(hash.slice(0, 8), 16);
  return value / 0xffffffff;
}

function drift(base: number | null, seed: string, index: number, magnitude: number): number | null {
  if (base === null) return null;
  const delta = (seededUnit(seed, index) - 0.5) * 2 * magnitude;
  return round(base * (1 + delta), base);
}

function round(value: number, reference: number): number {
  if (Math.abs(reference) >= 100) return Math.round(value);
  if (Math.abs(reference) >= 10) return Math.round(value * 10) / 10;
  if (Math.abs(reference) >= 1) return Math.round(value * 100) / 100;
  return Math.round(value * 10000) / 10000;
}

function metricsAt(model: Model, index: number, total: number): ModelMetrics {
  const base = model.metrics;
  const seed = model.slug;
  // Progressively approach the current values: the newest snapshot is exact.
  const progress = total <= 1 ? 1 : index / (total - 1);

  const project = (current: number | null, driftMagnitude: number): number | null => {
    if (current === null) return null;
    const historical = drift(current, seed, index, driftMagnitude);
    if (historical === null) return null;
    return round(historical + (current - historical) * progress, current);
  };

  return {
    intelligence: project(base.intelligence, 0.06),
    coding: project(base.coding, 0.07),
    agentic: project(base.agentic, 0.08),
    math: project(base.math, 0.05),
    outputSpeedTps: project(base.outputSpeedTps, 0.09),
    ttftSeconds: project(base.ttftSeconds, 0.12),
    inputPricePerMillion: project(base.inputPricePerMillion, 0.08),
    outputPricePerMillion: project(base.outputPricePerMillion, 0.08),
    cacheReadPricePerMillion: project(base.cacheReadPricePerMillion, 0.1),
    cacheWritePricePerMillion: project(base.cacheWritePricePerMillion, 0.1),
    contextWindow: base.contextWindow,
  };
}

export function buildFixtureModelSnapshots(models: Model[], now: Date): ModelSnapshot[] {
  const snapshots: ModelSnapshot[] = [];

  for (const model of models) {
    const offsets = SNAPSHOT_OFFSETS_DAYS.filter((days) => {
      if (!model.releaseDate) return true;
      const releaseAgeDays = (now.getTime() - Date.parse(model.releaseDate)) / 86_400_000;
      return days <= releaseAgeDays;
    });

    const effective = offsets.length === 0 ? [0] : offsets;

    effective.forEach((days, index) => {
      const capturedAt = new Date(now.getTime() - days * 86_400_000).toISOString();
      const metrics = metricsAt(model, index, effective.length);
      snapshots.push({
        id: `model-snapshot:${model.slug}:${index}`,
        modelId: model.id,
        capturedAt,
        metrics,
        sourceId: model.sourceId ?? "artificial-analysis-api",
        sourceVersion: model.sourceVersion,
        payloadHash: hashPayload({ modelId: model.id, capturedAt, metrics }),
      });
    });
  }

  return snapshots.sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
}

/** Latest snapshot before the current one, used for metric deltas. */
export function previousSnapshot(
  snapshots: ModelSnapshot[],
  modelId: string,
  now: Date,
): ModelSnapshot | null {
  const forModel = snapshots
    .filter((snapshot) => snapshot.modelId === modelId)
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));

  const latest = forModel[0];
  if (!latest) return null;
  // The newest snapshot is treated as "current", so the delta compares against
  // the one that precedes it.
  return forModel[1] ?? (Date.parse(latest.capturedAt) < now.getTime() - 86_400_000 ? null : null);
}
