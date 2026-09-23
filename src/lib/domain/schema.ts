/**
 * Canonical domain schemas for AI Model Intelligence Hub.
 *
 * Every entity that crosses a boundary (adapter -> ingestion -> repository -> UI)
 * is validated with these Zod schemas. They are the single source of truth for
 * the shape of the domain, and the TypeScript types are inferred from them so
 * runtime validation and static types can never drift apart.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

export const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid ISO date" });

export const isoDateNullableSchema = isoDateSchema.nullable();

/** Numeric metric that may legitimately be unknown (source did not publish it). */
export const metricSchema = z.number().finite().nullable();

/** Non-negative money amount in USD. */
export const usdSchema = z.number().finite().nonnegative().nullable();

export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be kebab-case");

/* -------------------------------------------------------------------------- */
/* Providers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Provider grouping is a geographic/structural classification, never a quality
 * statement. The UI must present it that way.
 */
export const providerGroupSchema = z.enum(["mainstream_global", "china_based", "other"]);
export type ProviderGroup = z.infer<typeof providerGroupSchema>;

export const providerSchema = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  name: z.string().min(1),
  /** Official domain, e.g. "openai.com". */
  domain: z.string().min(1).nullable(),
  /** ISO 3166-1 alpha-2 country code when confidently known. */
  countryCode: z.string().length(2).nullable(),
  /** Human-readable region label for display. */
  region: z.string().min(1).nullable(),
  group: providerGroupSchema,
  logoUrl: z.string().url().nullable(),
  /** Brand color used for charts/markers. Hex. */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  active: z.boolean(),
  sourceId: z.string().min(1).nullable(),
  updatedAt: isoDateSchema,
});
export type Provider = z.infer<typeof providerSchema>;

/* -------------------------------------------------------------------------- */
/* Models                                                                      */
/* -------------------------------------------------------------------------- */

export const modelMetricsSchema = z.object({
  /** Artificial Analysis Intelligence Index (0-100 scale). */
  intelligence: metricSchema,
  /** Coding index. */
  coding: metricSchema,
  /** Agentic / tool-use index. */
  agentic: metricSchema,
  /** Math index when published separately. */
  math: metricSchema,
  /** Output speed, tokens per second. */
  outputSpeedTps: metricSchema,
  /** Time to first token, seconds. */
  ttftSeconds: metricSchema,
  /** USD per 1M input tokens. */
  inputPricePerMillion: usdSchema,
  /** USD per 1M output tokens. */
  outputPricePerMillion: usdSchema,
  /** USD per 1M cached input tokens (read). */
  cacheReadPricePerMillion: usdSchema,
  /** USD per 1M cached input tokens (write). */
  cacheWritePricePerMillion: usdSchema,
  /** Maximum context window in tokens. */
  contextWindow: metricSchema,
  /**
   * Vendor figure: weighted average cost in USD to run one Intelligence Index
   * task. Published by Artificial Analysis on their free API tier, so it is
   * measured, not derived here.
   */
  costPerTaskUsd: usdSchema,
  /**
   * Vendor figure: weighted average answer tokens per Intelligence Index task.
   * Artificial Analysis publishes this on the web only (their API exposes it on
   * the Pro tier), so it arrives from the web-dataset adapter.
   */
  answerTokensPerTask: metricSchema,
  /** Vendor figure: weighted average reasoning tokens per Intelligence Index task. */
  reasoningTokensPerTask: metricSchema,
  /**
   * Hugging Face 30-day download count. A popularity signal from a specific
   * platform, never a capability measure.
   */
  hfDownloads: metricSchema,
  /** Hugging Face like count. Popularity, never capability. */
  hfLikes: metricSchema,
});
export type ModelMetrics = z.infer<typeof modelMetricsSchema>;

export const MODEL_METRIC_KEYS = [
  "intelligence",
  "coding",
  "agentic",
  "math",
  "outputSpeedTps",
  "ttftSeconds",
  "inputPricePerMillion",
  "outputPricePerMillion",
  "cacheReadPricePerMillion",
  "cacheWritePricePerMillion",
  "contextWindow",
  "costPerTaskUsd",
  "answerTokensPerTask",
  "reasoningTokensPerTask",
  "hfDownloads",
  "hfLikes",
] as const;
export type ModelMetricKey = (typeof MODEL_METRIC_KEYS)[number];

export const modelSchema = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  name: z.string().min(1),
  /** Compact label for chips/tables. */
  shortName: z.string().min(1),
  providerId: z.string().min(1),
  releaseDate: isoDateNullableSchema,
  deprecatedAt: isoDateNullableSchema,
  /** Whether weights are publicly available. Lives on the model, not provider. */
  openWeight: z.boolean(),
  description: z.string().nullable(),
  officialUrl: z.string().url().nullable(),
  metrics: modelMetricsSchema,
  sourceId: z.string().min(1).nullable(),
  sourceVersion: z.string().nullable(),
  lastRefreshedAt: isoDateNullableSchema,
});
export type Model = z.infer<typeof modelSchema>;

export const modelSnapshotSchema = z.object({
  id: z.string().min(1),
  modelId: z.string().min(1),
  capturedAt: isoDateSchema,
  metrics: modelMetricsSchema,
  sourceId: z.string().min(1),
  sourceVersion: z.string().nullable(),
  /** sha256 of the normalized payload, used for change detection + idempotency. */
  payloadHash: z.string().min(16),
});
export type ModelSnapshot = z.infer<typeof modelSnapshotSchema>;

export const benchmarkDefinitionSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  unit: z.string().nullable(),
  /** "higher" | "lower" — which direction is better. */
  direction: z.enum(["higher", "lower"]),
  category: z.enum(["capability", "performance", "cost", "safety", "other"]),
  weights: z.record(z.string(), z.number().finite()),
});
export type BenchmarkDefinition = z.infer<typeof benchmarkDefinitionSchema>;

export const modelBenchmarkValueSchema = z.object({
  modelId: z.string().min(1),
  benchmarkId: z.string().min(1),
  value: z.number().finite(),
  sourceId: z.string().min(1),
  capturedAt: isoDateSchema,
});
export type ModelBenchmarkValue = z.infer<typeof modelBenchmarkValueSchema>;

/* -------------------------------------------------------------------------- */
/* Sources & ingestion                                                         */
/* -------------------------------------------------------------------------- */

export const sourceDomainSchema = z.enum([
  "models",
  "ai_news",
  "provider_news",
  "research",
  "social",
  "harness",
  "world_politics",
  "internal",
]);
export type SourceDomain = z.infer<typeof sourceDomainSchema>;

export const sourceTypeSchema = z.enum([
  "api",
  "rss",
  "atom",
  "json",
  "html",
  "official_pricing",
  "official_docs",
  "official_site",
  "official_changelog",
  "github_releases",
  "social_api",
  "openrouter_models",
  "huggingface_models",
  "artificial_analysis_web",
  "bluesky",
  "hackernews",
  "gdelt",
  "manual",
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const sourceSchema = z.object({
  id: z.string().min(1),
  domain: sourceDomainSchema,
  name: z.string().min(1),
  type: sourceTypeSchema,
  url: z.string().url(),
  enabled: z.boolean(),
  priority: z.number().int().min(1).max(5),
  /** Minutes between scheduled syncs. */
  cadenceMinutes: z.number().int().positive().nullable(),
  attribution: z.string().nullable(),
  licensingNote: z.string().nullable(),
  notes: z.string().nullable(),
});
export type SourceDefinition = z.infer<typeof sourceSchema>;

export const ingestionRunStatusSchema = z.enum([
  "running",
  "success",
  "partial",
  "failed",
  "skipped",
  "rate_limited",
]);
export type IngestionRunStatus = z.infer<typeof ingestionRunStatusSchema>;

export const ingestionRunSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  jobKey: z.string().min(1),
  status: ingestionRunStatusSchema,
  startedAt: isoDateSchema,
  finishedAt: isoDateNullableSchema,
  itemsSeen: z.number().int().nonnegative(),
  itemsWritten: z.number().int().nonnegative(),
  itemsSkipped: z.number().int().nonnegative(),
  rateLimitRemaining: z.number().int().nullable(),
  rateLimitResetAt: isoDateNullableSchema,
  error: z.string().nullable(),
  /** Idempotency key so retries do not duplicate work. */
  idempotencyKey: z.string().min(1).nullable(),
});
export type IngestionRun = z.infer<typeof ingestionRunSchema>;

export const changeEventSchema = z.object({
  id: z.string().min(1),
  entity: z.enum(["model", "harness_plan", "source", "news"]),
  entityId: z.string().min(1),
  eventType: z.string().min(1),
  observedAt: isoDateSchema,
  significance: z.enum(["low", "medium", "high"]),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  sourceId: z.string().min(1).nullable(),
  summary: z.string().min(1),
});
export type ChangeEvent = z.infer<typeof changeEventSchema>;

/* -------------------------------------------------------------------------- */
/* News                                                                        */
/* -------------------------------------------------------------------------- */

export const newsDomainSchema = z.enum([
  "ai_general",
  "provider",
  "social",
  "research",
  "harness",
  "world_politics",
]);
export type NewsDomain = z.infer<typeof newsDomainSchema>;

export const newsCategorySchema = z.enum([
  "model_release",
  "pricing",
  "benchmark",
  "research",
  "developer",
  "product",
  "infrastructure",
  "funding",
  "acquisition",
  "regulation",
  "election",
  "geopolitics",
  "economy",
  "conflict",
  "diplomacy",
  "other",
]);
export type NewsCategory = z.infer<typeof newsCategorySchema>;

/** Trust tiers describe provenance quality — never a political viewpoint. */
export const trustTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type TrustTier = z.infer<typeof trustTierSchema>;

export const newsItemSchema = z.object({
  id: z.string().min(1),
  domain: newsDomainSchema,
  category: newsCategorySchema,
  title: z.string().min(1),
  url: z.string().url(),
  /** URL after canonicalization (tracking params stripped). */
  canonicalUrl: z.string().url(),
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  trustTier: trustTierSchema,
  publishedAt: isoDateNullableSchema,
  discoveredAt: isoDateSchema,
  /** Short permitted excerpt. Never a full article mirror. */
  excerpt: z.string().nullable(),
  /** Optional structured LLM summary. Null when no model key is configured. */
  summary: z.string().nullable(),
  entities: z.array(z.string().min(1)),
  providerIds: z.array(z.string().min(1)),
  official: z.boolean(),
  corroborated: z.boolean(),
  developing: z.boolean(),
  /** Content hash used for cross-source dedupe. */
  contentHash: z.string().min(1),
  /** Anchor item id when this story is a secondary report of the same event. */
  clusterId: z.string().min(1).nullable(),
});
export type NewsItem = z.infer<typeof newsItemSchema>;

export const newsEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["company", "model", "person", "benchmark", "country", "other"]),
  slug: slugSchema,
});
export type NewsEntity = z.infer<typeof newsEntitySchema>;

export const NEWS_DOMAIN_LABELS: Record<NewsDomain, string> = {
  ai_general: "AI General",
  provider: "Model Providers",
  social: "Social Pulse",
  research: "Research & Benchmarks",
  harness: "Harness",
  world_politics: "World & Politics",
};

/* -------------------------------------------------------------------------- */
/* Social                                                                      */
/* -------------------------------------------------------------------------- */

export const monitoredAccountSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  displayName: z.string().min(1),
  platform: z.enum(["x", "bluesky", "hackernews", "linkedin", "youtube", "blog", "reddit"]),
  accountCategory: z.enum([
    "model_provider",
    "executive_researcher",
    "benchmark_org",
    "coding_harness",
    "coding_harness_founder",
    "other",
  ]),
  providerId: z.string().min(1).nullable(),
  harnessProductId: z.string().min(1).nullable(),
  enabled: z.boolean(),
});
export type MonitoredAccount = z.infer<typeof monitoredAccountSchema>;

export const socialPostSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  handle: z.string().min(1),
  displayName: z.string().min(1),
  platform: z.enum(["x", "bluesky", "hackernews", "linkedin", "youtube", "blog", "reddit"]),
  postId: z.string().min(1),
  url: z.string().url(),
  /** Short excerpt consistent with platform terms. */
  text: z.string().max(600),
  publishedAt: isoDateSchema,
  metrics: z
    .object({
      likes: z.number().int().nonnegative().nullable(),
      reposts: z.number().int().nonnegative().nullable(),
      replies: z.number().int().nonnegative().nullable(),
    })
    .nullable(),
  entities: z.array(z.string().min(1)),
  /** Whether an official/tier-1 source later confirmed the same claim. */
  corroborated: z.boolean(),
});
export type SocialPost = z.infer<typeof socialPostSchema>;

/* -------------------------------------------------------------------------- */
/* Harness Watch                                                               */
/* -------------------------------------------------------------------------- */

export const harnessProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: slugSchema,
  vendor: z.string().min(1),
  website: z.string().url(),
  docsUrl: z.string().url().nullable(),
  pricingUrl: z.string().url().nullable(),
  changelogUrl: z.string().url().nullable(),
  openSource: z.boolean(),
  repoUrl: z.string().url().nullable(),
  platforms: z.array(z.enum(["cli", "desktop", "ide", "web", "cloud_agent"])),
  active: z.boolean(),
});
export type HarnessProduct = z.infer<typeof harnessProductSchema>;

export const resetPeriodSchema = z.enum(["daily", "weekly", "monthly", "rolling_5h", "none"]);
export const overageModelSchema = z.enum(["hard_cap", "pay_as_you_go", "throttle", "unknown"]);

export const harnessPlanSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  /** Stable key so renames do not fork the history. */
  canonicalPlanKey: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean(),
});
export type HarnessPlan = z.infer<typeof harnessPlanSchema>;

export const harnessPlanSnapshotSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  capturedAt: isoDateSchema,
  monthlyPriceUsd: usdSchema,
  annualPriceUsd: usdSchema,
  includedCreditsUsd: usdSchema,
  /** Only when the vendor documents it. Never inferred. */
  estimatedRequests: z.number().int().nonnegative().nullable(),
  estimatedRequestsSourceUrl: z.string().url().nullable(),
  resetPeriod: resetPeriodSchema,
  overageModel: overageModelSchema,
  byok: z.boolean(),
  /** Model families/families reachable on this plan. */
  models: z.array(z.string().min(1)),
  /** True only when a frontier-tier model is documented as included. */
  frontierModelAccess: z.boolean(),
  platforms: z.array(z.enum(["cli", "desktop", "ide", "web", "cloud_agent"])),
  regions: z.array(z.string().min(1)),
  notes: z.string().nullable(),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  rawSourceHash: z.string().min(1),
});
export type HarnessPlanSnapshot = z.infer<typeof harnessPlanSnapshotSchema>;

export const harnessEventTypeSchema = z.enum([
  "plan_created",
  "plan_removed",
  "price_changed",
  "credits_changed",
  "model_added",
  "model_removed",
  "limit_changed",
  "cli_release",
  "feature_added",
  "promotion_started",
  "promotion_ended",
]);
export type HarnessEventType = z.infer<typeof harnessEventTypeSchema>;

export const harnessChangeEventSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  productId: z.string().min(1),
  eventType: harnessEventTypeSchema,
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  observedAt: isoDateSchema,
  significance: z.enum(["low", "medium", "high"]),
  sourceId: z.string().min(1),
  summary: z.string().min(1),
});
export type HarnessChangeEvent = z.infer<typeof harnessChangeEventSchema>;

/* -------------------------------------------------------------------------- */
/* World & Politics                                                            */
/* -------------------------------------------------------------------------- */

export const worldRegionSchema = z.enum([
  "argentina",
  "united_states",
  "latin_america",
  "world",
  "economy",
  "regulation",
  "geopolitics",
  "elections",
  "conflict_diplomacy",
]);
export type WorldRegion = z.infer<typeof worldRegionSchema>;

export const worldNewsItemSchema = z.object({
  id: z.string().min(1),
  region: worldRegionSchema,
  category: newsCategorySchema,
  headline: z.string().min(1),
  /** Neutral, descriptive summary. No interpretation, no verdict. */
  summary: z.string().nullable(),
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  trustTier: trustTierSchema,
  url: z.string().url(),
  canonicalUrl: z.string().url(),
  primarySourceUrl: z.string().url().nullable(),
  publishedAt: isoDateNullableSchema,
  /** When the underlying event happened, if different from publication. */
  eventAt: isoDateNullableSchema,
  discoveredAt: isoDateSchema,
  countryCodes: z.array(z.string().length(2)),
  /** True when sources disagree — the UI must show both, not a verdict. */
  multipleAccounts: z.boolean(),
  developing: z.boolean(),
  contentHash: z.string().min(1),
});
export type WorldNewsItem = z.infer<typeof worldNewsItemSchema>;

/* -------------------------------------------------------------------------- */
/* Watchlists                                                                  */
/* -------------------------------------------------------------------------- */

export const watchlistItemKindSchema = z.enum([
  "model",
  "provider",
  "harness_product",
  "topic",
  "news_query",
]);

export const watchlistItemSchema = z.object({
  id: z.string().min(1),
  kind: watchlistItemKindSchema,
  /** Stable reference id for the entity, or the query string for news_query. */
  refId: z.string().min(1),
  label: z.string().min(1),
  addedAt: isoDateSchema,
});
export type WatchlistItem = z.infer<typeof watchlistItemSchema>;

export const watchlistSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  items: z.array(watchlistItemSchema),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type Watchlist = z.infer<typeof watchlistSchema>;

/* -------------------------------------------------------------------------- */
/* Scoring configuration                                                       */
/* -------------------------------------------------------------------------- */

export const valueScoreModeSchema = z.enum([
  "intelligence_per_dollar",
  "coding_per_dollar",
  "agentic_per_dollar",
  "weighted_value",
]);
export type ValueScoreMode = z.infer<typeof valueScoreModeSchema>;

export const blendedPriceWeightsSchema = z.object({
  input: z.number().min(0).max(1),
  output: z.number().min(0).max(1),
});
export type BlendedPriceWeights = z.infer<typeof blendedPriceWeightsSchema>;

export const DEFAULT_BLENDED_PRICE_WEIGHTS: BlendedPriceWeights = { input: 0.75, output: 0.25 };

export const weightedValueWeightsSchema = z.object({
  intelligence: z.number().min(0).max(1),
  coding: z.number().min(0).max(1),
  agentic: z.number().min(0).max(1),
  dearestIsWorst: z.boolean(),
});
export type WeightedValueWeights = z.infer<typeof weightedValueWeightsSchema>;

export const DEFAULT_WEIGHTED_VALUE_WEIGHTS: WeightedValueWeights = {
  intelligence: 0.5,
  coding: 0.3,
  agentic: 0.2,
  dearestIsWorst: true,
};

/* -------------------------------------------------------------------------- */
/* Data mode                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `mock` never requires credentials and never pretends to be live.
 * `live` uses real adapters and degrades gracefully when a key is missing.
 */
export const dataModeSchema = z.enum(["mock", "live"]);
export type DataMode = z.infer<typeof dataModeSchema>;

export function resolveDataMode(raw: string | undefined | null): DataMode {
  const parsed = dataModeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "mock";
}
