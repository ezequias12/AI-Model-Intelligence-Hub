/**
 * Fixture bundle.
 *
 * One factory builds the entire deterministic dataset. Passing a fixed `now`
 * makes the whole fixture set reproducible, which is what unit tests and E2E
 * tests rely on.
 */
import type {
  ChangeEvent,
  HarnessChangeEvent,
  HarnessPlan,
  HarnessPlanSnapshot,
  HarnessProduct,
  Model,
  ModelSnapshot,
  MonitoredAccount,
  NewsItem,
  Provider,
  SocialPost,
  SourceDefinition,
  WorldNewsItem,
} from "@/lib/domain/schema";
import { PROVIDER_SEEDS, buildFixtureProviders } from "./providers";
import { buildFixtureModels } from "./models";
import { buildFixtureModelSnapshots } from "./snapshots";
import { buildFixtureNews } from "./news";
import { buildFixtureSocialPosts, buildFixtureMonitoredAccounts } from "./social";
import { buildFixtureHarness } from "./harness";
import { buildFixtureWorldNews } from "./world";
import { SOURCE_REGISTRY } from "./sources";
import { clusterNewsItems } from "@/lib/domain/hash";

export interface FixtureBundle {
  now: Date;
  providers: Provider[];
  models: Model[];
  modelSnapshots: ModelSnapshot[];
  news: NewsItem[];
  socialPosts: SocialPost[];
  monitoredAccounts: MonitoredAccount[];
  harnessProducts: HarnessProduct[];
  harnessPlans: HarnessPlan[];
  harnessPlanSnapshots: HarnessPlanSnapshot[];
  harnessChangeEvents: HarnessChangeEvent[];
  worldNews: WorldNewsItem[];
  sources: SourceDefinition[];
  changeEvents: ChangeEvent[];
}

let cached: FixtureBundle | null = null;

export function buildFixtures(now: Date = new Date()): FixtureBundle {
  const providers = buildFixtureProviders(now);
  const models = buildFixtureModels(providers, PROVIDER_SEEDS, now);
  const modelSnapshots = buildFixtureModelSnapshots(models, now);
  const news = clusterFixtureNews(buildFixtureNews(now));
  const harness = buildFixtureHarness(now);

  return {
    now,
    providers,
    models,
    modelSnapshots,
    news,
    socialPosts: buildFixtureSocialPosts(now),
    monitoredAccounts: buildFixtureMonitoredAccounts(),
    harnessProducts: harness.products,
    harnessPlans: harness.plans,
    harnessPlanSnapshots: harness.snapshots,
    harnessChangeEvents: harness.changeEvents,
    worldNews: buildFixtureWorldNews(now),
    sources: SOURCE_REGISTRY,
    changeEvents: buildFixtureChangeEvents(now, modelSnapshots, harness.changeEvents),
  };
}

/** Process-wide fixtures. Deterministic per process start, never mutated. */
export function getFixtures(): FixtureBundle {
  if (!cached) cached = buildFixtures();
  return cached;
}

/** Applies cross-source clustering so secondary reports attach to an anchor. */
function clusterFixtureNews(items: NewsItem[]): NewsItem[] {
  const { assignments } = clusterNewsItems(
    items.map((item) => ({
      id: item.id,
      canonicalUrl: item.canonicalUrl,
      title: item.title,
      trustTier: item.trustTier,
      publishedAt: item.publishedAt,
      domain: "news",
    })),
    { similarityThreshold: 0.62, windowHours: 48 },
  );

  return items.map((item) => {
    const anchor = assignments.get(item.id) ?? item.id;
    return { ...item, clusterId: anchor === item.id ? null : anchor };
  });
}

function buildFixtureChangeEvents(
  now: Date,
  modelSnapshots: ModelSnapshot[],
  harnessEvents: HarnessChangeEvent[],
): ChangeEvent[] {
  const events: ChangeEvent[] = [];

  const byModel = new Map<string, ModelSnapshot[]>();
  for (const snapshot of modelSnapshots) {
    const list = byModel.get(snapshot.modelId) ?? [];
    list.push(snapshot);
    byModel.set(snapshot.modelId, list);
  }

  for (const [modelId, snapshots] of byModel) {
    const sorted = [...snapshots].sort(
      (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
    );
    const latest = sorted[0];
    const previous = sorted[1];
    if (!latest || !previous) continue;

    const beforePrice = previous.metrics.outputPricePerMillion;
    const afterPrice = latest.metrics.outputPricePerMillion;
    if (beforePrice !== null && afterPrice !== null && beforePrice !== afterPrice) {
      events.push({
        id: `change:${modelId}:price:${latest.id}`,
        entity: "model",
        entityId: modelId,
        eventType: "price_changed",
        observedAt: latest.capturedAt,
        significance: "high",
        before: { outputPricePerMillion: beforePrice },
        after: { outputPricePerMillion: afterPrice },
        sourceId: latest.sourceId,
        summary: `${modelId.replace("model:", "")} output price changed from $${beforePrice} to $${afterPrice} per 1M tokens`,
      });
    }

    const beforeIntel = previous.metrics.intelligence;
    const afterIntel = latest.metrics.intelligence;
    if (beforeIntel !== null && afterIntel !== null && beforeIntel !== afterIntel) {
      events.push({
        id: `change:${modelId}:intelligence:${latest.id}`,
        entity: "model",
        entityId: modelId,
        eventType: "metric_changed",
        observedAt: latest.capturedAt,
        significance: "medium",
        before: { intelligence: beforeIntel },
        after: { intelligence: afterIntel },
        sourceId: latest.sourceId,
        summary: `${modelId.replace("model:", "")} intelligence moved from ${beforeIntel} to ${afterIntel}`,
      });
    }
  }

  for (const harnessEvent of harnessEvents) {
    events.push({
      id: `change:${harnessEvent.id}`,
      entity: "harness_plan",
      entityId: harnessEvent.planId,
      eventType: harnessEvent.eventType,
      observedAt: harnessEvent.observedAt,
      significance: harnessEvent.significance,
      before: harnessEvent.before,
      after: harnessEvent.after,
      sourceId: harnessEvent.sourceId,
      summary: harnessEvent.summary,
    });
  }

  return events
    .filter((event) => Date.parse(event.observedAt) <= now.getTime())
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}
