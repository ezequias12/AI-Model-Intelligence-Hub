/**
 * Workspace data loaders.
 *
 * Pages call these instead of touching repositories directly, so the shape of
 * what a workspace needs lives in one place and every page gets the same
 * derived context.
 */
import { buildModelContexts, type ModelContext } from "@/lib/analytics/metric-registry";
import { getRepository, type IntelligenceRepository } from "@/lib/data";
import { DEFAULT_SLOTS, resolveDefaultSelection } from "@/lib/domain/selection";
import { clusterNewsItems } from "@/lib/domain/hash";
import type {
  ChangeEvent,
  HarnessChangeEvent,
  HarnessPlan,
  HarnessPlanSnapshot,
  HarnessProduct,
  IngestionRun,
  Model,
  ModelMetrics,
  ModelSnapshot,
  NewsItem,
  Provider,
  SocialPost,
  SourceDefinition,
  WorldNewsItem,
} from "@/lib/domain/schema";

export interface ModelWorkspaceData {
  repository: IntelligenceRepository;
  models: Model[];
  providers: Provider[];
  snapshots: ModelSnapshot[];
  contexts: ModelContext[];
  defaultSelection: string[];
  providersById: Map<string, Provider>;
  /** Serialisable previous-metrics map keyed by model id. */
  previousByModelId: Record<string, ModelMetrics>;
  /** Serialisable snapshot history keyed by model id. */
  snapshotsByModelId: Record<string, ModelSnapshot[]>;
}

/** Builds the previous-metrics map used for deltas across the whole workspace. */
export function previousMetricsByModel(snapshots: ModelSnapshot[]): Map<string, ModelMetrics> {
  const byModel = new Map<string, ModelSnapshot[]>();

  for (const snapshot of snapshots) {
    const list = byModel.get(snapshot.modelId) ?? [];
    list.push(snapshot);
    byModel.set(snapshot.modelId, list);
  }

  const result = new Map<string, ModelMetrics>();
  for (const [modelId, list] of byModel) {
    const sorted = [...list].sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
    const previous = sorted[1];
    if (previous) result.set(modelId, previous.metrics);
  }
  return result;
}

/** Groups snapshots by model, newest first, capped to bound the serialised payload. */
export function groupSnapshotsByModel(
  snapshots: ModelSnapshot[],
  maxPerModel = 12,
): Record<string, ModelSnapshot[]> {
  const grouped: Record<string, ModelSnapshot[]> = {};

  for (const snapshot of snapshots) {
    const list = grouped[snapshot.modelId] ?? [];
    list.push(snapshot);
    grouped[snapshot.modelId] = list;
  }

  for (const [modelId, list] of Object.entries(grouped)) {
    grouped[modelId] = [...list]
      .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))
      .slice(0, maxPerModel);
  }

  return grouped;
}

export async function loadModelWorkspace(): Promise<ModelWorkspaceData> {
  const repository = await getRepository();
  const [models, providers, snapshots] = await Promise.all([
    repository.getModels(),
    repository.getProviders(),
    repository.getModelSnapshots(),
  ]);

  const previousMap = previousMetricsByModel(snapshots);
  const contexts = buildModelContexts(models, providers, previousMap);
  const defaultSelection = resolveDefaultSelection(models, providers, {
    fallbackIds: models.slice(0, DEFAULT_SLOTS.length).map((model) => model.id),
  });

  return {
    repository,
    models,
    providers,
    snapshots,
    contexts,
    defaultSelection,
    providersById: new Map(providers.map((provider) => [provider.id, provider])),
    previousByModelId: Object.fromEntries(previousMap),
    snapshotsByModelId: groupSnapshotsByModel(snapshots),
  };
}

export interface HarnessWorkspaceData {
  repository: IntelligenceRepository;
  products: HarnessProduct[];
  plans: HarnessPlan[];
  snapshots: HarnessPlanSnapshot[];
  changeEvents: HarnessChangeEvent[];
  latestSnapshotByPlan: Map<string, HarnessPlanSnapshot>;
  productsById: Map<string, HarnessProduct>;
}

export async function loadHarnessWorkspace(): Promise<HarnessWorkspaceData> {
  const repository = await getRepository();
  const [products, plans, snapshots, changeEvents] = await Promise.all([
    repository.getHarnessProducts(),
    repository.getHarnessPlans(),
    repository.getHarnessPlanSnapshots(),
    repository.getHarnessChangeEvents(),
  ]);

  const latestSnapshotByPlan = new Map<string, HarnessPlanSnapshot>();
  for (const snapshot of snapshots) {
    const existing = latestSnapshotByPlan.get(snapshot.planId);
    if (!existing || Date.parse(snapshot.capturedAt) > Date.parse(existing.capturedAt)) {
      latestSnapshotByPlan.set(snapshot.planId, snapshot);
    }
  }

  return {
    repository,
    products,
    plans,
    snapshots,
    changeEvents,
    latestSnapshotByPlan,
    productsById: new Map(products.map((product) => [product.id, product])),
  };
}

export interface NewsWorkspaceData {
  repository: IntelligenceRepository;
  news: NewsItem[];
  socialPosts: SocialPost[];
  sources: SourceDefinition[];
  providers: Provider[];
}

export async function loadNewsWorkspace(): Promise<NewsWorkspaceData> {
  const repository = await getRepository();
  const [news, socialPosts, sources, providers] = await Promise.all([
    repository.getNews(),
    repository.getSocialPosts(),
    repository.getSources(),
    repository.getProviders(),
  ]);

  return { repository, news, socialPosts, sources, providers };
}

export interface WorldWorkspaceData {
  repository: IntelligenceRepository;
  items: WorldNewsItem[];
  sources: SourceDefinition[];
}

export async function loadWorldWorkspace(): Promise<WorldWorkspaceData> {
  const repository = await getRepository();
  const [items, sources] = await Promise.all([repository.getWorldNews(), repository.getSources()]);
  return { repository, items, sources };
}

export interface OverviewData {
  repository: IntelligenceRepository;
  modelWorkspace: ModelWorkspaceData;
  harness: HarnessWorkspaceData;
  news: NewsItem[];
  world: WorldNewsItem[];
  socialPosts: SocialPost[];
  changeEvents: ChangeEvent[];
  sources: SourceDefinition[];
  /**
   * Ingestion ledger. The freshness block must report the age of the last real
   * sync attempt, not an inference from whatever news items happen to exist.
   */
  ingestionRuns: IngestionRun[];
}

export async function loadOverview(): Promise<OverviewData> {
  const harness = await loadHarnessWorkspace();
  const modelWorkspace = await loadModelWorkspace();

  const [news, world, socialPosts, changeEvents, sources, ingestionRuns] = await Promise.all([
    modelWorkspace.repository.getNews({ limit: 40 }),
    modelWorkspace.repository.getWorldNews({ limit: 12 }),
    modelWorkspace.repository.getSocialPosts(),
    modelWorkspace.repository.getChangeEvents(30),
    modelWorkspace.repository.getSources(),
    modelWorkspace.repository.getIngestionRuns({ limit: 400 }),
  ]);

  return {
    repository: modelWorkspace.repository,
    modelWorkspace,
    harness,
    news,
    world,
    socialPosts,
    changeEvents,
    sources,
    ingestionRuns,
  };
}

/** Clusters news around primary-source anchors; shared by list and detail views. */
export function clusterForDisplay(items: NewsItem[]): Map<string, NewsItem[]> {
  const { clusters } = clusterNewsItems(
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

  const byId = new Map(items.map((item) => [item.id, item]));
  const result = new Map<string, NewsItem[]>();

  for (const [anchorId, memberIds] of clusters) {
    const members = memberIds
      .map((id) => byId.get(id))
      .filter((item): item is NewsItem => Boolean(item));
    if (members.length > 0) result.set(anchorId, members);
  }

  return result;
}
