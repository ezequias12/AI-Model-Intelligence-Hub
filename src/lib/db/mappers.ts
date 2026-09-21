/**
 * Row -> domain mappers.
 *
 * Postgres uses snake_case flat columns (fast to index, easy to query) while the
 * domain uses nested, validated objects. This is the single place that
 * translates between them.
 */
import type {
  ChangeEvent,
  HarnessChangeEvent,
  HarnessPlan,
  HarnessPlanSnapshot,
  HarnessProduct,
  IngestionRun,
  Model,
  ModelSnapshot,
  MonitoredAccount,
  NewsItem,
  Provider,
  SocialPost,
  SourceDefinition,
  WorldNewsItem,
} from "@/lib/domain/schema";
import { modelMetricsSchema } from "@/lib/domain/schema";
import { arrayMinimum } from "@/lib/utils/guards";
import type {
  ChangeEventRow,
  HarnessChangeEventRow,
  HarnessPlanRow,
  HarnessPlanSnapshotRow,
  HarnessProductRow,
  IngestionRunRow,
  ModelRow,
  ModelSnapshotRow,
  MonitoredAccountRow,
  NewsItemRow,
  ProviderRow,
  SocialPostRow,
  SourceRow,
  WorldNewsRow,
} from "./rows";

export function toProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    domain: row.domain,
    countryCode: row.country_code,
    region: row.region,
    group: row.provider_group,
    logoUrl: row.logo_url,
    color: row.color,
    active: row.active,
    sourceId: row.source_id,
    updatedAt: row.updated_at,
  };
}

export function toModel(row: ModelRow): Model {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    providerId: row.provider_id,
    releaseDate: row.release_date,
    deprecatedAt: row.deprecated_at,
    openWeight: row.open_weight,
    description: row.description,
    officialUrl: row.official_url,
    metrics: {
      intelligence: row.intelligence,
      coding: row.coding,
      agentic: row.agentic,
      math: row.math,
      outputSpeedTps: row.output_speed_tps,
      ttftSeconds: row.ttft_seconds,
      inputPricePerMillion: row.input_price_per_million,
      outputPricePerMillion: row.output_price_per_million,
      cacheReadPricePerMillion: row.cache_read_price_per_million,
      cacheWritePricePerMillion: row.cache_write_price_per_million,
      contextWindow: row.context_window,
      hfDownloads: row.hf_downloads,
      hfLikes: row.hf_likes,
    },
    sourceId: row.source_id,
    sourceVersion: row.source_version,
    lastRefreshedAt: row.last_refreshed_at,
  };
}

export function toModelSnapshot(row: ModelSnapshotRow): ModelSnapshot {
  const parsed = modelMetricsSchema.safeParse(row.metrics);
  // A malformed snapshot payload must not poison the whole page: fall back to
  // an all-null metric set so the snapshot still renders its timestamp.
  const metrics = parsed.success
    ? parsed.data
    : modelMetricsSchema.parse({
        intelligence: null,
        coding: null,
        agentic: null,
        math: null,
        outputSpeedTps: null,
        ttftSeconds: null,
        inputPricePerMillion: null,
        outputPricePerMillion: null,
        cacheReadPricePerMillion: null,
        cacheWritePricePerMillion: null,
        contextWindow: null,
        hfDownloads: null,
        hfLikes: null,
      });

  return {
    id: row.id,
    modelId: row.model_id,
    capturedAt: row.captured_at,
    metrics,
    sourceId: row.source_id,
    sourceVersion: row.source_version,
    payloadHash: row.payload_hash,
  };
}

export function toSource(row: SourceRow): SourceDefinition {
  return {
    id: row.id,
    domain: row.domain as SourceDefinition["domain"],
    name: row.name,
    type: row.type as SourceDefinition["type"],
    url: row.url,
    enabled: row.enabled,
    priority: row.priority,
    cadenceMinutes: row.cadence_minutes,
    attribution: row.attribution,
    licensingNote: row.licensing_note,
    notes: row.notes,
  };
}

export function toIngestionRun(row: IngestionRunRow): IngestionRun {
  return {
    id: row.id,
    sourceId: row.source_id,
    jobKey: row.job_key,
    status: row.status as IngestionRun["status"],
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    itemsSeen: row.items_seen,
    itemsWritten: row.items_written,
    itemsSkipped: row.items_skipped,
    rateLimitRemaining: row.rate_limit_remaining,
    rateLimitResetAt: row.rate_limit_reset_at,
    error: row.error,
    idempotencyKey: row.idempotency_key,
  };
}

export function toChangeEvent(row: ChangeEventRow): ChangeEvent {
  return {
    id: row.id,
    entity: row.entity as ChangeEvent["entity"],
    entityId: row.entity_id,
    eventType: row.event_type,
    observedAt: row.observed_at,
    significance: arrayMinimum(row.significance, ["low", "medium", "high"], "low"),
    before: row.before_json,
    after: row.after_json,
    sourceId: row.source_id,
    summary: row.summary,
  };
}

export function toNewsItem(row: NewsItemRow): NewsItem {
  return {
    id: row.id,
    domain: row.domain as NewsItem["domain"],
    category: row.category as NewsItem["category"],
    title: row.title,
    url: row.url,
    canonicalUrl: row.canonical_url,
    sourceId: row.source_id,
    sourceName: row.source_name,
    trustTier: (row.trust_tier === 1 || row.trust_tier === 2
      ? row.trust_tier
      : 3) as NewsItem["trustTier"],
    publishedAt: row.published_at,
    discoveredAt: row.discovered_at,
    excerpt: row.excerpt,
    summary: row.summary,
    entities: row.entities,
    providerIds: row.provider_ids,
    official: row.official,
    corroborated: row.corroborated,
    developing: row.developing,
    contentHash: row.content_hash,
    clusterId: row.cluster_id,
  };
}

export function toSocialPost(row: SocialPostRow): SocialPost {
  const metrics = row.metrics_json as SocialPost["metrics"];
  return {
    id: row.id,
    accountId: row.account_id,
    handle: row.handle,
    displayName: row.display_name,
    platform: row.platform as SocialPost["platform"],
    postId: row.post_id,
    url: row.url,
    text: row.text,
    publishedAt: row.published_at,
    metrics: metrics ?? null,
    entities: row.entities,
    corroborated: row.corroborated,
  };
}

export function toMonitoredAccount(row: MonitoredAccountRow): MonitoredAccount {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    platform: row.platform as MonitoredAccount["platform"],
    accountCategory: row.account_category as MonitoredAccount["accountCategory"],
    providerId: row.provider_id,
    harnessProductId: row.harness_product_id,
    enabled: row.enabled,
  };
}

export function toHarnessProduct(row: HarnessProductRow): HarnessProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    vendor: row.vendor,
    website: row.website,
    docsUrl: row.docs_url,
    pricingUrl: row.pricing_url,
    changelogUrl: row.changelog_url,
    openSource: row.open_source,
    repoUrl: row.repo_url,
    platforms: row.platforms as HarnessProduct["platforms"],
    active: row.active,
  };
}

export function toHarnessPlan(row: HarnessPlanRow): HarnessPlan {
  return {
    id: row.id,
    productId: row.product_id,
    canonicalPlanKey: row.canonical_plan_key,
    name: row.name,
    active: row.active,
  };
}

export function toHarnessPlanSnapshot(row: HarnessPlanSnapshotRow): HarnessPlanSnapshot {
  return {
    id: row.id,
    planId: row.plan_id,
    capturedAt: row.captured_at,
    monthlyPriceUsd: row.monthly_price_usd,
    annualPriceUsd: row.annual_price_usd,
    includedCreditsUsd: row.included_credits_usd,
    estimatedRequests: row.estimated_requests,
    estimatedRequestsSourceUrl: row.estimated_requests_source_url,
    resetPeriod: row.reset_period as HarnessPlanSnapshot["resetPeriod"],
    overageModel: row.overage_model as HarnessPlanSnapshot["overageModel"],
    byok: row.byok,
    models: row.models_json,
    frontierModelAccess: row.frontier_model_access,
    platforms: row.platforms_json as HarnessPlanSnapshot["platforms"],
    regions: row.regions_json,
    notes: row.notes,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    rawSourceHash: row.raw_source_hash,
  };
}

export function toHarnessChangeEvent(row: HarnessChangeEventRow): HarnessChangeEvent {
  return {
    id: row.id,
    planId: row.plan_id,
    productId: row.product_id,
    eventType: row.event_type as HarnessChangeEvent["eventType"],
    before: row.before_json,
    after: row.after_json,
    observedAt: row.observed_at,
    significance: arrayMinimum(row.significance, ["low", "medium", "high"], "low"),
    sourceId: row.source_id,
    summary: row.summary,
  };
}

export function toWorldNews(row: WorldNewsRow): WorldNewsItem {
  return {
    id: row.id,
    region: row.region as WorldNewsItem["region"],
    category: row.category as WorldNewsItem["category"],
    headline: row.headline,
    summary: row.summary,
    sourceId: row.source_id,
    sourceName: row.source_name,
    trustTier: (row.trust_tier === 1 || row.trust_tier === 2
      ? row.trust_tier
      : 3) as WorldNewsItem["trustTier"],
    url: row.url,
    canonicalUrl: row.canonical_url,
    primarySourceUrl: row.primary_source_url,
    publishedAt: row.published_at,
    eventAt: row.event_at,
    discoveredAt: row.discovered_at,
    countryCodes: row.country_codes,
    multipleAccounts: row.multiple_accounts,
    developing: row.developing,
    contentHash: row.content_hash,
  };
}
