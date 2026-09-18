/**
 * Ingestion writer.
 *
 * Persists adapter output through the service-role Supabase client. Upserts are
 * keyed so a retried run is idempotent: re-ingesting the same payload writes the
 * same rows instead of duplicating them.
 *
 * When Supabase is not configured the writer is a no-op that reports zero rows
 * written — it never pretends a write happened.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  WorldNewsItem,
} from "@/lib/domain/schema";
import { supabaseCredentials } from "@/lib/data/supabase-repository";

export interface WriteSummary {
  table: string;
  attempted: number;
  written: number;
  errors: string[];
}

export interface IngestionWriter {
  readonly enabled: boolean;
  writeProviders(rows: Provider[]): Promise<WriteSummary>;
  writeModels(rows: Model[]): Promise<WriteSummary>;
  writeModelSnapshots(rows: ModelSnapshot[]): Promise<WriteSummary>;
  writeNewsItems(rows: NewsItem[]): Promise<WriteSummary>;
  writeSocialAccounts(rows: MonitoredAccount[]): Promise<WriteSummary>;
  writeSocialPosts(rows: SocialPost[]): Promise<WriteSummary>;
  writeHarnessProducts(rows: HarnessProduct[]): Promise<WriteSummary>;
  writeHarnessPlans(rows: HarnessPlan[]): Promise<WriteSummary>;
  writeHarnessSnapshots(rows: HarnessPlanSnapshot[]): Promise<WriteSummary>;
  writeHarnessChangeEvents(rows: HarnessChangeEvent[]): Promise<WriteSummary>;
  writeWorldNews(rows: WorldNewsItem[]): Promise<WriteSummary>;
  writeChangeEvents(rows: ChangeEvent[]): Promise<WriteSummary>;
  writeIngestionRun(run: IngestionRun): Promise<WriteSummary>;
}

function disabledWriter(): IngestionWriter {
  const noop =
    (table: string) =>
    async (rows: unknown[]): Promise<WriteSummary> => ({
      table,
      attempted: rows.length,
      written: 0,
      errors: [],
    });

  const noopSingle = (table: string) => async (): Promise<WriteSummary> => ({
    table,
    attempted: 1,
    written: 0,
    errors: [],
  });

  return {
    enabled: false,
    writeProviders: noop("providers"),
    writeModels: noop("models"),
    writeModelSnapshots: noop("model_snapshots"),
    writeNewsItems: noop("news_items"),
    writeSocialAccounts: noop("monitored_social_accounts"),
    writeSocialPosts: noop("social_posts"),
    writeHarnessProducts: noop("harness_products"),
    writeHarnessPlans: noop("harness_plans"),
    writeHarnessSnapshots: noop("harness_plan_snapshots"),
    writeHarnessChangeEvents: noop("harness_change_events"),
    writeWorldNews: noop("world_news_items"),
    writeChangeEvents: noop("change_events"),
    writeIngestionRun: noopSingle("ingestion_runs"),
  };
}

export function createIngestionWriter(): IngestionWriter {
  const credentials = supabaseCredentials();
  if (!credentials) return disabledWriter();

  const client: SupabaseClient = createClient(credentials.url, credentials.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const table = (name: string) =>
    (
      client as unknown as {
        from: (table: string) => {
          upsert: (rows: unknown[], options: { onConflict: string }) => Promise<{ error: unknown }>;
        };
      }
    ).from(name);

  async function upsert(name: string, onConflict: string, rows: unknown[]): Promise<WriteSummary> {
    if (rows.length === 0) return { table: name, attempted: 0, written: 0, errors: [] };

    // Chunked to stay well below payload limits.
    const chunkSize = 200;
    let written = 0;
    const errors: string[] = [];

    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize);
      const { error } = await table(name).upsert(chunk, { onConflict });
      if (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      } else {
        written += chunk.length;
      }
    }

    return { table: name, attempted: rows.length, written, errors };
  }

  return {
    enabled: true,

    writeProviders(rows) {
      return upsert(
        "providers",
        "id",
        rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          domain: row.domain,
          country_code: row.countryCode,
          region: row.region,
          provider_group: row.group,
          logo_url: row.logoUrl,
          color: row.color,
          active: row.active,
          source_id: row.sourceId,
          updated_at: row.updatedAt,
        })),
      );
    },

    writeModels(rows) {
      return upsert(
        "models",
        "id",
        rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          short_name: row.shortName,
          provider_id: row.providerId,
          release_date: row.releaseDate,
          deprecated_at: row.deprecatedAt,
          open_weight: row.openWeight,
          description: row.description,
          official_url: row.officialUrl,
          source_id: row.sourceId,
          source_version: row.sourceVersion,
          last_refreshed_at: row.lastRefreshedAt,
          intelligence: row.metrics.intelligence,
          coding: row.metrics.coding,
          agentic: row.metrics.agentic,
          math: row.metrics.math,
          output_speed_tps: row.metrics.outputSpeedTps,
          ttft_seconds: row.metrics.ttftSeconds,
          input_price_per_million: row.metrics.inputPricePerMillion,
          output_price_per_million: row.metrics.outputPricePerMillion,
          cache_read_price_per_million: row.metrics.cacheReadPricePerMillion,
          cache_write_price_per_million: row.metrics.cacheWritePricePerMillion,
          context_window: row.metrics.contextWindow,
        })),
      );
    },

    writeModelSnapshots(rows) {
      return upsert(
        "model_snapshots",
        "model_id,captured_at,payload_hash",
        rows.map((row) => ({
          id: row.id,
          model_id: row.modelId,
          captured_at: row.capturedAt,
          metrics: row.metrics,
          source_id: row.sourceId,
          source_version: row.sourceVersion,
          payload_hash: row.payloadHash,
        })),
      );
    },

    writeNewsItems(rows) {
      return upsert(
        "news_items",
        "source_id,canonical_url",
        rows.map((row) => ({
          id: row.id,
          domain: row.domain,
          category: row.category,
          title: row.title,
          url: row.url,
          canonical_url: row.canonicalUrl,
          source_id: row.sourceId,
          source_name: row.sourceName,
          trust_tier: row.trustTier,
          published_at: row.publishedAt,
          discovered_at: row.discoveredAt,
          excerpt: row.excerpt,
          summary: row.summary,
          entities: row.entities,
          provider_ids: row.providerIds,
          official: row.official,
          corroborated: row.corroborated,
          developing: row.developing,
          content_hash: row.contentHash,
          cluster_id: row.clusterId,
        })),
      );
    },

    writeSocialAccounts(rows) {
      return upsert(
        "monitored_social_accounts",
        "id",
        rows.map((row) => ({
          id: row.id,
          handle: row.handle,
          display_name: row.displayName,
          platform: row.platform,
          account_category: row.accountCategory,
          provider_id: row.providerId,
          harness_product_id: row.harnessProductId,
          enabled: row.enabled,
        })),
      );
    },

    writeSocialPosts(rows) {
      return upsert(
        "social_posts",
        "platform,post_id",
        rows.map((row) => ({
          id: row.id,
          account_id: row.accountId,
          handle: row.handle,
          display_name: row.displayName,
          platform: row.platform,
          post_id: row.postId,
          url: row.url,
          text: row.text,
          published_at: row.publishedAt,
          metrics_json: row.metrics,
          entities: row.entities,
          corroborated: row.corroborated,
        })),
      );
    },

    writeHarnessProducts(rows) {
      return upsert(
        "harness_products",
        "id",
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          vendor: row.vendor,
          website: row.website,
          docs_url: row.docsUrl,
          pricing_url: row.pricingUrl,
          changelog_url: row.changelogUrl,
          open_source: row.openSource,
          repo_url: row.repoUrl,
          platforms: row.platforms,
          active: row.active,
        })),
      );
    },

    writeHarnessPlans(rows) {
      return upsert(
        "harness_plans",
        "id",
        rows.map((row) => ({
          id: row.id,
          product_id: row.productId,
          canonical_plan_key: row.canonicalPlanKey,
          name: row.name,
          active: row.active,
        })),
      );
    },

    writeHarnessSnapshots(rows) {
      return upsert(
        "harness_plan_snapshots",
        "plan_id,captured_at,raw_source_hash",
        rows.map((row) => ({
          id: row.id,
          plan_id: row.planId,
          captured_at: row.capturedAt,
          monthly_price_usd: row.monthlyPriceUsd,
          annual_price_usd: row.annualPriceUsd,
          included_credits_usd: row.includedCreditsUsd,
          estimated_requests: row.estimatedRequests,
          estimated_requests_source_url: row.estimatedRequestsSourceUrl,
          reset_period: row.resetPeriod,
          overage_model: row.overageModel,
          byok: row.byok,
          models_json: row.models,
          frontier_model_access: row.frontierModelAccess,
          platforms_json: row.platforms,
          regions_json: row.regions,
          notes: row.notes,
          source_id: row.sourceId,
          source_url: row.sourceUrl,
          raw_source_hash: row.rawSourceHash,
        })),
      );
    },

    writeHarnessChangeEvents(rows) {
      return upsert(
        "harness_change_events",
        "id",
        rows.map((row) => ({
          id: row.id,
          plan_id: row.planId,
          product_id: row.productId,
          event_type: row.eventType,
          before_json: row.before,
          after_json: row.after,
          observed_at: row.observedAt,
          significance: row.significance,
          source_id: row.sourceId,
          summary: row.summary,
        })),
      );
    },

    writeWorldNews(rows) {
      return upsert(
        "world_news_items",
        "source_id,canonical_url",
        rows.map((row) => ({
          id: row.id,
          region: row.region,
          category: row.category,
          headline: row.headline,
          summary: row.summary,
          source_id: row.sourceId,
          source_name: row.sourceName,
          trust_tier: row.trustTier,
          url: row.url,
          canonical_url: row.canonicalUrl,
          primary_source_url: row.primarySourceUrl,
          published_at: row.publishedAt,
          event_at: row.eventAt,
          discovered_at: row.discoveredAt,
          country_codes: row.countryCodes,
          multiple_accounts: row.multipleAccounts,
          developing: row.developing,
          content_hash: row.contentHash,
        })),
      );
    },

    writeChangeEvents(rows) {
      return upsert(
        "change_events",
        "id",
        rows.map((row) => ({
          id: row.id,
          entity: row.entity,
          entity_id: row.entityId,
          event_type: row.eventType,
          observed_at: row.observedAt,
          significance: row.significance,
          before_json: row.before,
          after_json: row.after,
          source_id: row.sourceId,
          summary: row.summary,
        })),
      );
    },

    writeIngestionRun(run) {
      return upsert("ingestion_runs", "id", [
        {
          id: run.id,
          source_id: run.sourceId,
          job_key: run.jobKey,
          status: run.status,
          started_at: run.startedAt,
          finished_at: run.finishedAt,
          items_seen: run.itemsSeen,
          items_written: run.itemsWritten,
          items_skipped: run.itemsSkipped,
          rate_limit_remaining: run.rateLimitRemaining,
          rate_limit_reset_at: run.rateLimitResetAt,
          error: run.error,
          idempotency_key: run.idempotencyKey,
        },
      ]);
    },
  };
}
