/**
 * Database row schemas.
 *
 * Rows are validated at the boundary so a schema drift in Postgres surfaces as
 * a clear error instead of a silently malformed object in the UI.
 *
 * These mirror `supabase/migrations/*`. When the schema changes, update both.
 * `npm run db:gen-types` regenerates the raw `Database` type once the Supabase
 * CLI and project link are available.
 */
import { z } from "zod";

const iso = z.string();
const nullableIso = z.string().nullable();
const nullableNumber = z.number().nullable();

export const providerRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  country_code: z.string().nullable(),
  region: z.string().nullable(),
  provider_group: z.enum(["mainstream_global", "china_based", "other"]),
  logo_url: z.string().nullable(),
  color: z.string().nullable(),
  active: z.boolean(),
  source_id: z.string().nullable(),
  updated_at: iso,
});
export type ProviderRow = z.infer<typeof providerRowSchema>;

export const modelRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  short_name: z.string(),
  provider_id: z.string(),
  release_date: nullableIso,
  deprecated_at: nullableIso,
  open_weight: z.boolean(),
  description: z.string().nullable(),
  official_url: z.string().nullable(),
  source_id: z.string().nullable(),
  source_version: z.string().nullable(),
  last_refreshed_at: nullableIso,
  intelligence: nullableNumber,
  coding: nullableNumber,
  agentic: nullableNumber,
  math: nullableNumber,
  output_speed_tps: nullableNumber,
  ttft_seconds: nullableNumber,
  input_price_per_million: nullableNumber,
  output_price_per_million: nullableNumber,
  cache_read_price_per_million: nullableNumber,
  cache_write_price_per_million: nullableNumber,
  context_window: nullableNumber,
});
export type ModelRow = z.infer<typeof modelRowSchema>;

export const modelSnapshotRowSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  captured_at: iso,
  metrics: z.record(z.string(), z.unknown()),
  source_id: z.string(),
  source_version: z.string().nullable(),
  payload_hash: z.string(),
});
export type ModelSnapshotRow = z.infer<typeof modelSnapshotRowSchema>;

export const sourceRowSchema = z.object({
  id: z.string(),
  domain: z.string(),
  name: z.string(),
  type: z.string(),
  url: z.string(),
  enabled: z.boolean(),
  priority: z.number(),
  cadence_minutes: z.number().nullable(),
  attribution: z.string().nullable(),
  licensing_note: z.string().nullable(),
  notes: z.string().nullable(),
});
export type SourceRow = z.infer<typeof sourceRowSchema>;

export const ingestionRunRowSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  job_key: z.string(),
  status: z.string(),
  started_at: iso,
  finished_at: nullableIso,
  items_seen: z.number(),
  items_written: z.number(),
  items_skipped: z.number(),
  rate_limit_remaining: z.number().nullable(),
  rate_limit_reset_at: nullableIso,
  error: z.string().nullable(),
  idempotency_key: z.string().nullable(),
});
export type IngestionRunRow = z.infer<typeof ingestionRunRowSchema>;

export const changeEventRowSchema = z.object({
  id: z.string(),
  entity: z.string(),
  entity_id: z.string(),
  event_type: z.string(),
  observed_at: iso,
  significance: z.string(),
  before_json: z.unknown().nullable(),
  after_json: z.unknown().nullable(),
  source_id: z.string().nullable(),
  summary: z.string(),
});
export type ChangeEventRow = z.infer<typeof changeEventRowSchema>;

export const newsItemRowSchema = z.object({
  id: z.string(),
  domain: z.string(),
  category: z.string(),
  title: z.string(),
  url: z.string(),
  canonical_url: z.string(),
  source_id: z.string(),
  source_name: z.string(),
  trust_tier: z.number(),
  published_at: nullableIso,
  discovered_at: iso,
  excerpt: z.string().nullable(),
  summary: z.string().nullable(),
  entities: z.array(z.string()),
  provider_ids: z.array(z.string()),
  official: z.boolean(),
  corroborated: z.boolean(),
  developing: z.boolean(),
  content_hash: z.string(),
  cluster_id: z.string().nullable(),
});
export type NewsItemRow = z.infer<typeof newsItemRowSchema>;

export const socialPostRowSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  handle: z.string(),
  display_name: z.string(),
  platform: z.string(),
  post_id: z.string(),
  url: z.string(),
  text: z.string(),
  published_at: iso,
  metrics_json: z.unknown().nullable(),
  entities: z.array(z.string()),
  corroborated: z.boolean(),
});
export type SocialPostRow = z.infer<typeof socialPostRowSchema>;

export const monitoredAccountRowSchema = z.object({
  id: z.string(),
  handle: z.string(),
  display_name: z.string(),
  platform: z.string(),
  account_category: z.string(),
  provider_id: z.string().nullable(),
  harness_product_id: z.string().nullable(),
  enabled: z.boolean(),
});
export type MonitoredAccountRow = z.infer<typeof monitoredAccountRowSchema>;

export const harnessProductRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  vendor: z.string(),
  website: z.string(),
  docs_url: z.string().nullable(),
  pricing_url: z.string().nullable(),
  changelog_url: z.string().nullable(),
  open_source: z.boolean(),
  repo_url: z.string().nullable(),
  platforms: z.array(z.string()),
  active: z.boolean(),
});
export type HarnessProductRow = z.infer<typeof harnessProductRowSchema>;

export const harnessPlanRowSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  canonical_plan_key: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export type HarnessPlanRow = z.infer<typeof harnessPlanRowSchema>;

export const harnessPlanSnapshotRowSchema = z.object({
  id: z.string(),
  plan_id: z.string(),
  captured_at: iso,
  monthly_price_usd: nullableNumber,
  annual_price_usd: nullableNumber,
  included_credits_usd: nullableNumber,
  estimated_requests: z.number().nullable(),
  estimated_requests_source_url: z.string().nullable(),
  reset_period: z.string(),
  overage_model: z.string(),
  byok: z.boolean(),
  models_json: z.array(z.string()),
  frontier_model_access: z.boolean(),
  platforms_json: z.array(z.string()),
  regions_json: z.array(z.string()),
  notes: z.string().nullable(),
  source_id: z.string(),
  source_url: z.string(),
  raw_source_hash: z.string(),
});
export type HarnessPlanSnapshotRow = z.infer<typeof harnessPlanSnapshotRowSchema>;

export const harnessChangeEventRowSchema = z.object({
  id: z.string(),
  plan_id: z.string(),
  product_id: z.string(),
  event_type: z.string(),
  before_json: z.unknown().nullable(),
  after_json: z.unknown().nullable(),
  observed_at: iso,
  significance: z.string(),
  source_id: z.string(),
  summary: z.string(),
});
export type HarnessChangeEventRow = z.infer<typeof harnessChangeEventRowSchema>;

export const worldNewsRowSchema = z.object({
  id: z.string(),
  region: z.string(),
  category: z.string(),
  headline: z.string(),
  summary: z.string().nullable(),
  source_id: z.string(),
  source_name: z.string(),
  trust_tier: z.number(),
  url: z.string(),
  canonical_url: z.string(),
  primary_source_url: z.string().nullable(),
  published_at: nullableIso,
  event_at: nullableIso,
  discovered_at: iso,
  country_codes: z.array(z.string()),
  multiple_accounts: z.boolean(),
  developing: z.boolean(),
  content_hash: z.string(),
});
export type WorldNewsRow = z.infer<typeof worldNewsRowSchema>;
