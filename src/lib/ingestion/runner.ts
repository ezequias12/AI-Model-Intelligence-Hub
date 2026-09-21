/**
 * Ingestion job runner.
 *
 * One function executes any registered job. It is deliberately boring: resolve
 * the sources, call the adapter, record an ingestion run, write the results, and
 * report exactly what happened. Nothing here hides a missing credential or a
 * parser that failed to match.
 */
import { HttpClient, isDeferralError } from "@/lib/adapters/http";
import { fetchArtificialAnalysis, toPersistenceRows } from "@/lib/adapters/artificial-analysis";
import { fetchBlueskyPosts } from "@/lib/adapters/bluesky";
import {
  fetchGdeltArticles,
  GDELT_QUERY_BY_SOURCE,
  gdeltToNewsItem,
  gdeltToWorldItem,
} from "@/lib/adapters/gdelt";
import { fetchHackerNewsPosts } from "@/lib/adapters/hackernews";
import { applyPopularity, fetchHuggingFaceModels } from "@/lib/adapters/huggingface";
import { extractHarnessPage } from "@/lib/adapters/harness-html";
import {
  fetchOpenRouterModels,
  toPersistenceRows as openRouterRows,
} from "@/lib/adapters/openrouter";
import { feedToNewsItems } from "@/lib/adapters/rss";
import { fetchWorldNews } from "@/lib/adapters/world";
import type { AdapterError, RateLimitState, FetchLike } from "@/lib/adapters/types";
import { getRepository } from "@/lib/data";
import { getDataMode } from "@/lib/data/mode";
import { stableHash } from "@/lib/domain/hash";
import type { HarnessPlanSnapshot, IngestionRun, NewsItem } from "@/lib/domain/schema";
import {
  buildHarnessChangeEvents,
  buildModelChangeEvents,
  latestSnapshotBy,
} from "./change-events";
import { HARNESS_CONFIG_BY_SOURCE } from "./harness-configs";
import { mergeModelSources, mergeProviders } from "./merge-models";
import { createIngestionWriter } from "./writer";
import {
  emptyTotals,
  isJobKey,
  JOB_BY_KEY,
  sourcesForJob,
  summarize,
  type JobKey,
  type JobResult,
  type JobSourceOutcome,
} from "@/lib/jobs/registry";

export interface RunJobOptions {
  now?: Date;
  dryRun?: boolean;
  /** Restrict the run to specific source ids. */
  sourceIds?: string[];
  fetchImpl?: FetchLike;
}

export async function runJob(jobKey: string, options: RunJobOptions = {}): Promise<JobResult> {
  const now = options.now ?? new Date();

  if (!isJobKey(jobKey)) {
    return {
      job: "sync-ai-news",
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      durationMs: 0,
      dryRun: options.dryRun ?? false,
      dataMode: getDataMode(),
      outcomes: [
        {
          sourceId: "unknown",
          enabled: false,
          outcome: "failed",
          itemsSeen: 0,
          itemsWritten: 0,
          itemsSkipped: 0,
          rateLimitRemaining: null,
          message: `Unknown job key "${jobKey}". Known jobs: ${[...JOB_BY_KEY.keys()].join(", ")}.`,
        },
      ],
      totals: { ...emptyTotals(), failed: 1 },
    };
  }

  const job = JOB_BY_KEY.get(jobKey) as NonNullable<ReturnType<typeof JOB_BY_KEY.get>>;
  const startedAt = Date.now();
  const dataMode = getDataMode();
  const writer = createIngestionWriter();

  let sources = sourcesForJob(job);
  if (options.sourceIds && options.sourceIds.length > 0) {
    const allowed = new Set(options.sourceIds);
    sources = sources.filter((source) => allowed.has(source.id));
  }

  if (job.maintenance) {
    const outcome = await runMaintenance(job.key, writer.enabled);
    return {
      job: job.key,
      startedAt: now.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      dryRun: options.dryRun ?? false,
      dataMode,
      outcomes: [outcome],
      totals: summarize([outcome]),
    };
  }

  const outcomes: JobSourceOutcome[] = [];

  for (const source of sources) {
    if (!source.enabled) {
      outcomes.push({
        sourceId: source.id,
        enabled: false,
        outcome: "disabled",
        itemsSeen: 0,
        itemsWritten: 0,
        itemsSkipped: 0,
        rateLimitRemaining: null,
        message: "Source disabled: credentials not configured or source retired.",
      });
      continue;
    }

    if (dataMode === "mock" || options.dryRun) {
      outcomes.push({
        sourceId: source.id,
        enabled: true,
        outcome: "deferred",
        itemsSeen: 0,
        itemsWritten: 0,
        itemsSkipped: 0,
        rateLimitRemaining: null,
        message:
          dataMode === "mock"
            ? `Mock mode: no live fetch performed. Enable live mode and configure the source to run it.`
            : "Dry run: adapter not executed.",
      });
      continue;
    }

    const outcome = await runSource(source, {
      now,
      writer,
      fetchImpl: options.fetchImpl,
    });
    outcomes.push(outcome);
  }

  return {
    job: job.key,
    startedAt: now.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    dryRun: options.dryRun ?? false,
    dataMode,
    outcomes,
    totals: summarize(outcomes),
  };
}

async function runSource(
  source: ReturnType<typeof sourcesForJob>[number],
  context: {
    now: Date;
    writer: ReturnType<typeof createIngestionWriter>;
    fetchImpl?: FetchLike;
  },
): Promise<JobSourceOutcome> {
  const { now, writer, fetchImpl } = context;
  const http = new HttpClient({
    fetchImpl,
    userAgent: "AI-Model-Intelligence-Hub/0.1 (+ingestion)",
  });
  const base = baseOutcome(source.id);

  try {
    /* ----------------------------- Model metrics ---------------------------- */
    if (source.domain === "models" && source.type === "api") {
      const result = await fetchArtificialAnalysis({ fetchImpl, now });
      if (!result.ok) {
        return await adapterFailureOutcome(
          writer,
          source.id,
          "sync-models",
          now,
          base,
          result.error,
          result.rateLimit,
          "Adapter failed.",
        );
      }

      const payload = toPersistenceRows(result.items, now);
      if (!writer.enabled) {
        return deferred(
          {
            ...base,
            itemsSeen: result.items.length,
            rateLimitRemaining: result.rateLimit.remaining,
          },
          "Adapters ran but Supabase is not configured, so nothing was persisted.",
        );
      }

      // Read the stored state before writing, so the diff compares against the
      // previous snapshot rather than the one this run is about to insert, and
      // so a second source can never blank a first-party value (see
      // merge-models.ts).
      const repository = await getRepository();
      const [existingModels, existingProviders, storedSnapshots] = await Promise.all([
        repository.getModels(),
        repository.getProviders(),
        repository.getModelSnapshots(),
      ]);
      const previousByModel = latestSnapshotBy(
        storedSnapshots,
        (snapshot) => snapshot.modelId,
        (snapshot) => snapshot.capturedAt,
      );

      const providerSummary = await writer.writeProviders(
        mergeProviders(existingProviders, payload.providers),
      );
      const modelSummary = await writer.writeModels(
        mergeModelSources(existingModels, payload.models),
      );
      const snapshotSummary = await writer.writeModelSnapshots(payload.snapshots);
      const changeSummary = await writer.writeChangeEvents(
        buildModelChangeEvents(previousByModel, payload.snapshots),
      );

      const errors = [
        ...providerSummary.errors,
        ...modelSummary.errors,
        ...snapshotSummary.errors,
        ...changeSummary.errors,
      ];
      if (errors.length > 0) {
        return fail(
          {
            ...base,
            itemsSeen: result.items.length,
            itemsWritten: modelSummary.written,
            rateLimitRemaining: result.rateLimit.remaining,
          },
          "failed",
          errors[0] ?? "Write failed.",
        );
      }

      await recordRun(writer, source.id, "sync-models", now, {
        itemsSeen: result.items.length,
        itemsWritten: modelSummary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: result.rateLimit.remaining,
        rateLimitResetAt: result.rateLimit.resetAt,
        error: null,
      });

      return ok({
        ...base,
        itemsSeen: result.items.length,
        itemsWritten: modelSummary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: result.rateLimit.remaining,
        message: `Mapped ${result.items.length} models from Artificial Analysis (${changeSummary.written} change events).`,
      });
    }

    /* --------------------------- OpenRouter models -------------------------- */
    if (source.type === "openrouter_models") {
      const result = await fetchOpenRouterModels({ fetchImpl, now });
      if (!result.ok) {
        return await adapterFailureOutcome(
          writer,
          source.id,
          "sync-models",
          now,
          base,
          result.error,
          result.rateLimit,
          "OpenRouter adapter failed.",
        );
      }

      const payload = openRouterRows(result.items);
      if (!writer.enabled) {
        return deferred(
          {
            ...base,
            itemsSeen: result.items.length,
            rateLimitRemaining: result.rateLimit.remaining,
          },
          "OpenRouter responded, but Supabase is not configured so nothing was persisted.",
        );
      }

      const repository = await getRepository();
      const [existingModels, existingProviders] = await Promise.all([
        repository.getModels(),
        repository.getProviders(),
      ]);

      const providerSummary = await writer.writeProviders(
        mergeProviders(existingProviders, payload.providers),
      );
      const modelSummary = await writer.writeModels(
        mergeModelSources(existingModels, payload.models),
      );

      await recordRun(writer, source.id, "sync-models", now, {
        itemsSeen: result.items.length,
        itemsWritten: modelSummary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: result.rateLimit.remaining,
        rateLimitResetAt: result.rateLimit.resetAt,
        error: modelSummary.errors[0] ?? providerSummary.errors[0] ?? null,
      });

      return ok({
        ...base,
        itemsSeen: result.items.length,
        itemsWritten: modelSummary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: result.rateLimit.remaining,
        message: `Mapped ${result.items.length} OpenRouter catalogue entries (context window and breadth only).`,
      });
    }

    /* ------------------------- Hugging Face popularity ---------------------- */
    if (source.type === "huggingface_models") {
      const result = await fetchHuggingFaceModels({ fetchImpl });
      if (!result.ok) {
        return await adapterFailureOutcome(
          writer,
          source.id,
          "sync-models",
          now,
          base,
          result.error,
          result.rateLimit,
          "Hugging Face adapter failed.",
        );
      }

      if (!writer.enabled) {
        return deferred(
          {
            ...base,
            itemsSeen: result.items.length,
            rateLimitRemaining: result.rateLimit.remaining,
          },
          "Hugging Face responded, but Supabase is not configured so nothing was persisted.",
        );
      }

      const repository = await getRepository();
      const existing = await repository.getModels();
      const matched = applyPopularity(existing, result.items);

      const summary = await writer.writeModels(matched.models);

      await recordRun(writer, source.id, "sync-models", now, {
        itemsSeen: result.items.length,
        itemsWritten: summary.written,
        itemsSkipped: matched.unmatched,
        rateLimitRemaining: result.rateLimit.remaining,
        rateLimitResetAt: result.rateLimit.resetAt,
        error: summary.errors[0] ?? null,
      });

      return ok({
        ...base,
        itemsSeen: result.items.length,
        itemsWritten: summary.written,
        itemsSkipped: matched.unmatched,
        rateLimitRemaining: result.rateLimit.remaining,
        message: `Matched popularity for ${matched.matched} of ${result.items.length} Hugging Face models.`,
      });
    }

    /* ------------------------------- Feed news ------------------------------ */
    if (source.type === "rss" || source.type === "atom") {
      const xml = await http.requestText(source.url);
      const result = feedToNewsItems(
        xml,
        {
          sourceId: source.id,
          sourceName: source.name,
          domain: feedDomain(source.domain),
          category: source.domain === "research" ? "research" : "other",
          trustTier: source.priority === 1 ? 1 : 2,
          official: source.priority === 1,
        },
        now,
      );

      if (!result.ok) return fail(base, "failed", result.error?.message ?? "Feed parse failed.");

      const items = result.items.map((item) => ({
        ...item,
        id: `news:${source.id}:${stableHash(item.canonicalUrl)}`,
        clusterId: null,
      })) as NewsItem[];

      if (!writer.enabled) {
        return deferred(
          { ...base, itemsSeen: items.length, rateLimitRemaining: http.rateLimit.remaining },
          "Feed parsed but Supabase is not configured, so nothing was persisted.",
        );
      }

      const summary = await writer.writeNewsItems(items);
      await recordRun(writer, source.id, jobKeyForDomain(source.domain), now, {
        itemsSeen: items.length,
        itemsWritten: summary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: http.rateLimit.remaining,
        rateLimitResetAt: http.rateLimit.resetAt,
        error: summary.errors[0] ?? null,
      });

      if (summary.errors.length > 0) {
        return fail(
          { ...base, itemsSeen: items.length },
          "failed",
          summary.errors[0] ?? "Write failed.",
        );
      }

      return ok({
        ...base,
        itemsSeen: items.length,
        itemsWritten: summary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: http.rateLimit.remaining,
        message: `Parsed ${items.length} feed entries.`,
      });
    }

    /* --------------------------- Harness pricing --------------------------- */
    if (source.type === "official_pricing" || source.type === "official_site") {
      const config = HARNESS_CONFIG_BY_SOURCE.get(source.id);
      if (!config) {
        return fail(
          base,
          "failed",
          `No extraction configuration registered for "${source.id}". Add one before enabling this source.`,
        );
      }

      const html = await http.requestText(source.url);
      const extraction = await extractHarnessPage(html, config, now);
      if (!extraction.ok) {
        return fail(base, "failed", extraction.error?.message ?? "Extraction failed.");
      }

      if (!writer.enabled) {
        return deferred(
          {
            ...base,
            itemsSeen: extraction.items.length,
            rateLimitRemaining: http.rateLimit.remaining,
          },
          "Pricing page parsed with the registered config, but Supabase is not configured so nothing was persisted.",
        );
      }

      const repository = await getRepository();
      const plans = await repository.getHarnessPlans();
      const previousByPlan = latestSnapshotBy(
        await repository.getHarnessPlanSnapshots(),
        (snapshot) => snapshot.planId,
        (snapshot) => snapshot.capturedAt,
      );
      const snapshots: HarnessPlanSnapshot[] = [];

      for (const plan of extraction.items) {
        const existing = plans.find((entry) => entry.canonicalPlanKey === plan.planKey);
        if (!existing) continue;
        snapshots.push({
          id: `snapshot:${existing.id}:${now.toISOString()}`,
          planId: existing.id,
          capturedAt: now.toISOString(),
          ...plan.snapshot,
          sourceId: source.id,
          sourceUrl: config.sourceUrl,
          rawSourceHash: stableHash(html),
        });
      }

      const summary = await writer.writeHarnessSnapshots(snapshots);
      const changeSummary = await writer.writeHarnessChangeEvents(
        buildHarnessChangeEvents(
          new Map(plans.map((plan) => [plan.id, plan])),
          previousByPlan,
          snapshots,
        ),
      );

      await recordRun(writer, source.id, "sync-harness-pricing", now, {
        itemsSeen: extraction.items.length,
        itemsWritten: summary.written,
        itemsSkipped: extraction.skipped,
        rateLimitRemaining: http.rateLimit.remaining,
        rateLimitResetAt: http.rateLimit.resetAt,
        error: summary.errors[0] ?? changeSummary.errors[0] ?? null,
      });

      if (summary.errors.length > 0 || changeSummary.errors.length > 0) {
        return fail(
          base,
          "failed",
          summary.errors[0] ?? changeSummary.errors[0] ?? "Write failed.",
        );
      }

      return ok({
        ...base,
        itemsSeen: extraction.items.length,
        itemsWritten: summary.written,
        itemsSkipped: extraction.skipped,
        rateLimitRemaining: http.rateLimit.remaining,
        message: `Extracted ${extraction.items.length} plans with config ${config.configVersion} (${changeSummary.written} change events).`,
      });
    }

    /* --------------------------- Community signals -------------------------- */
    if (source.type === "bluesky" || source.type === "hackernews") {
      const repository = await getRepository();
      const accounts = await repository.getMonitoredAccounts();
      const isBluesky = source.type === "bluesky";
      const result = isBluesky
        ? await fetchBlueskyPosts({ accounts, fetchImpl })
        : await fetchHackerNewsPosts({ accounts, fetchImpl });
      const label = isBluesky ? "Bluesky" : "Hacker News";

      if (!result.ok) {
        return await adapterFailureOutcome(
          writer,
          source.id,
          "sync-social",
          now,
          base,
          result.error,
          result.rateLimit,
          `${label} adapter failed.`,
        );
      }

      if (!writer.enabled) {
        return deferred(
          { ...base, itemsSeen: result.items.length },
          `${label} responded, but Supabase is not configured so nothing was persisted.`,
        );
      }

      const accountSummary = await writer.writeSocialAccounts(accounts);
      const postSummary = await writer.writeSocialPosts(result.items);

      await recordRun(writer, source.id, "sync-social", now, {
        itemsSeen: result.items.length,
        itemsWritten: postSummary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: result.rateLimit.remaining,
        rateLimitResetAt: result.rateLimit.resetAt,
        error: [...accountSummary.errors, ...postSummary.errors][0] ?? null,
      });

      return ok({
        ...base,
        itemsSeen: result.items.length,
        itemsWritten: postSummary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: result.rateLimit.remaining,
        message: `Ingested ${result.items.length} ${label} items.`,
      });
    }

    /* -------------------------------- GDELT --------------------------------- */
    if (source.type === "gdelt") {
      const query = GDELT_QUERY_BY_SOURCE[source.id] ?? '"artificial intelligence"';
      const result = await fetchGdeltArticles({ query, fetchImpl });

      if (!result.ok) {
        return await adapterFailureOutcome(
          writer,
          source.id,
          jobKeyForDomain(source.domain),
          now,
          base,
          result.error,
          result.rateLimit,
          "GDELT adapter failed.",
        );
      }

      if (!writer.enabled) {
        return deferred(
          { ...base, itemsSeen: result.items.length },
          "GDELT responded, but Supabase is not configured so nothing was persisted.",
        );
      }

      const isWorld = source.domain === "world_politics";
      const trustTier = source.priority === 1 ? 1 : 2;
      const summary = isWorld
        ? await writer.writeWorldNews(
            result.items.map((article) =>
              gdeltToWorldItem(article, {
                sourceId: source.id,
                sourceName: source.name,
                trustTier,
                now,
              }),
            ),
          )
        : await writer.writeNewsItems(
            result.items.map((article) =>
              gdeltToNewsItem(article, {
                sourceId: source.id,
                sourceName: source.name,
                trustTier,
                now,
              }),
            ),
          );

      await recordRun(writer, source.id, isWorld ? "sync-world-news" : "sync-ai-news", now, {
        itemsSeen: result.items.length,
        itemsWritten: summary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: result.rateLimit.remaining,
        rateLimitResetAt: result.rateLimit.resetAt,
        error: summary.errors[0] ?? null,
      });

      return ok({
        ...base,
        itemsSeen: result.items.length,
        itemsWritten: summary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: result.rateLimit.remaining,
        message: `Ingested ${result.items.length} GDELT articles.`,
      });
    }

    /* ----------------------------- World news ------------------------------ */
    if (source.domain === "world_politics") {
      const result = await fetchWorldNews({
        fetchImpl,
        sourceId: source.id,
        sourceName: source.name,
        trustTier: source.priority === 1 ? 1 : 2,
        now,
      });

      if (!result.ok) {
        return await adapterFailureOutcome(
          writer,
          source.id,
          "sync-world-news",
          now,
          base,
          result.error,
          result.rateLimit,
          "World news adapter failed.",
        );
      }

      if (!writer.enabled) {
        return deferred(
          { ...base, itemsSeen: result.items.length },
          "World news provider responded, but Supabase is not configured so nothing was persisted.",
        );
      }

      const summary = await writer.writeWorldNews(result.items);
      await recordRun(writer, source.id, "sync-world-news", now, {
        itemsSeen: result.items.length,
        itemsWritten: summary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: result.rateLimit.remaining,
        rateLimitResetAt: result.rateLimit.resetAt,
        error: summary.errors[0] ?? null,
      });

      return ok({
        ...base,
        itemsSeen: result.items.length,
        itemsWritten: summary.written,
        rateLimitRemaining: result.rateLimit.remaining,
        message: `Ingested ${result.items.length} world news items.`,
      });
    }

    /* ------------------- HTML / changelog without a config ----------------- */
    if (source.domain === "harness" && source.type === "github_releases") {
      const atomUrl = source.url.endsWith(".atom")
        ? source.url
        : `${source.url.replace(/\/$/, "")}.atom`;
      const xml = await http.requestText(atomUrl);
      const result = feedToNewsItems(
        xml,
        {
          sourceId: source.id,
          sourceName: source.name,
          domain: "harness",
          category: "product",
          trustTier: 1,
          official: true,
        },
        now,
      );

      if (!result.ok)
        return fail(base, "failed", result.error?.message ?? "Release feed parse failed.");

      const items = result.items.map((item) => ({
        ...item,
        id: `news:${source.id}:${stableHash(item.canonicalUrl)}`,
        clusterId: null,
      })) as NewsItem[];

      if (!writer.enabled) {
        return deferred(
          { ...base, itemsSeen: items.length },
          "Release feed parsed but Supabase is not configured so nothing was persisted.",
        );
      }

      const summary = await writer.writeNewsItems(items);
      await recordRun(writer, source.id, "sync-harness-changelogs", now, {
        itemsSeen: items.length,
        itemsWritten: summary.written,
        itemsSkipped: result.skipped,
        rateLimitRemaining: http.rateLimit.remaining,
        rateLimitResetAt: http.rateLimit.resetAt,
        error: summary.errors[0] ?? null,
      });

      return ok({
        ...base,
        itemsSeen: items.length,
        itemsWritten: summary.written,
        message: `Parsed ${items.length} release entries.`,
      });
    }

    return deferred(
      base,
      `No adapter registered for source type "${source.type}" in domain "${source.domain}".`,
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return fail(base, isDeferralError(cause) ? "deferred" : "failed", message);
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function baseOutcome(sourceId: string): JobSourceOutcome {
  return {
    sourceId,
    enabled: true,
    outcome: "ok",
    itemsSeen: 0,
    itemsWritten: 0,
    itemsSkipped: 0,
    rateLimitRemaining: null,
    message: null,
  };
}

function ok(outcome: JobSourceOutcome): JobSourceOutcome {
  return { ...outcome, outcome: "ok" };
}

function deferred(outcome: JobSourceOutcome, message: string): JobSourceOutcome {
  return { ...outcome, outcome: "deferred", message };
}

function fail(
  outcome: JobSourceOutcome,
  kind: "failed" | "not_configured" | "deferred",
  message: string,
): JobSourceOutcome {
  return { ...outcome, outcome: kind, message };
}

/** Maps an adapter error to the honest outcome: missing config, deferral or failure. */
function classifyAdapterError(
  error: AdapterError | null,
): "not_configured" | "deferred" | "failed" {
  if (!error) return "failed";
  if (error.code === "not_configured") return "not_configured";
  if (error.code === "rate_limited") return "deferred";
  return isDeferralError(error.message) ? "deferred" : "failed";
}

/**
 * Reports an adapter failure with the right outcome and, for a deferral, records
 * a `rate_limited` ledger row so a quota brake reads as a deferral in the
 * Sources workspace instead of as a failure (KI-1 / M1).
 */
async function adapterFailureOutcome(
  writer: ReturnType<typeof createIngestionWriter>,
  sourceId: string,
  jobKey: string,
  now: Date,
  base: JobSourceOutcome,
  error: AdapterError | null,
  rateLimit: RateLimitState,
  fallbackMessage: string,
): Promise<JobSourceOutcome> {
  const kind = classifyAdapterError(error);
  const message = error?.message ?? fallbackMessage;

  if (kind === "deferred" && writer.enabled) {
    await recordRun(writer, sourceId, jobKey, now, {
      itemsSeen: 0,
      itemsWritten: 0,
      itemsSkipped: 0,
      rateLimitRemaining: rateLimit.remaining,
      rateLimitResetAt: rateLimit.resetAt,
      error: message,
      status: "rate_limited",
    });
  }

  return fail(base, kind, message);
}

function feedDomain(domain: string): NewsItem["domain"] {
  if (domain === "provider_news") return "provider";
  if (domain === "research") return "research";
  if (domain === "harness") return "harness";
  return "ai_general";
}

function jobKeyForDomain(domain: string): string {
  if (domain === "harness") return "sync-harness-changelogs";
  return "sync-ai-news";
}

async function recordRun(
  writer: ReturnType<typeof createIngestionWriter>,
  sourceId: string,
  jobKey: string,
  now: Date,
  data: {
    itemsSeen: number;
    itemsWritten: number;
    itemsSkipped: number;
    rateLimitRemaining: number | null;
    rateLimitResetAt: string | null;
    error: string | null;
    /** Overrides the derived status; used to record a deferral as rate_limited. */
    status?: IngestionRun["status"];
  },
): Promise<void> {
  const run: IngestionRun = {
    id: `run:${sourceId}:${now.toISOString()}`,
    sourceId,
    jobKey,
    status:
      data.status ?? (data.error ? (data.itemsWritten > 0 ? "partial" : "failed") : "success"),
    startedAt: now.toISOString(),
    finishedAt: new Date().toISOString(),
    itemsSeen: data.itemsSeen,
    itemsWritten: data.itemsWritten,
    itemsSkipped: data.itemsSkipped,
    rateLimitRemaining: data.rateLimitRemaining,
    rateLimitResetAt: data.rateLimitResetAt,
    error: data.error,
    idempotencyKey: `${sourceId}:${jobKey}:${now.toISOString().slice(0, 13)}`,
  };

  await writer.writeIngestionRun(run);
}

async function runMaintenance(jobKey: JobKey, writerEnabled: boolean): Promise<JobSourceOutcome> {
  if (!writerEnabled) {
    return {
      sourceId: "private.raw_ingestion_payloads",
      enabled: false,
      outcome: "not_configured",
      itemsSeen: 0,
      itemsWritten: 0,
      itemsSkipped: 0,
      rateLimitRemaining: null,
      message: "Supabase is not configured; raw payload cleanup cannot run.",
    };
  }

  return {
    sourceId: "private.raw_ingestion_payloads",
    enabled: true,
    outcome: "ok",
    itemsSeen: 0,
    itemsWritten: 0,
    itemsSkipped: 0,
    rateLimitRemaining: null,
    message: `${jobKey}: retention cleanup is delegated to the SQL maintenance query documented in docs/05-operations/runbooks/stale-data.md.`,
  };
}
