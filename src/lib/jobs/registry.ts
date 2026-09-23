/**
 * Ingestion job registry.
 *
 * Each job is a named unit with an explicit cadence, a description and a
 * handler. The same definitions drive the QStash schedule script, the HTTP
 * endpoint and the local runner, so a job cannot mean three different things.
 */
import { SOURCE_REGISTRY } from "@/lib/fixtures/sources";
import type { SourceDefinition, SourceDomain } from "@/lib/domain/schema";

export const JOB_KEYS = [
  "sync-models",
  "sync-ai-news",
  "sync-harness-pricing",
  "sync-harness-changelogs",
  "sync-social",
  "sync-world-news",
  "cleanup-raw-ingestion",
] as const;

export type JobKey = (typeof JOB_KEYS)[number];

export interface JobDefinition {
  key: JobKey;
  description: string;
  /** Cron expression used by the schedule script. */
  cron: string;
  /** Source domains this job consumes. Empty for maintenance jobs. */
  domains: SourceDomain[];
  /** True for jobs that only touch operational storage. */
  maintenance?: boolean;
}

export const JOBS: JobDefinition[] = [
  {
    key: "sync-models",
    description:
      "Pull model metrics and pricing from the Artificial Analysis Data API, respecting quota and rate-limit headers.",
    // Every two hours, not every thirty minutes: the adapter now reads the
    // documented free endpoint, which paginates at 200 rows, plus the legacy
    // catalogue endpoint. That is five requests per run, and the free tier
    // allows 100 requests per 24 hours.
    cron: "0 */2 * * *",
    domains: ["models"],
  },
  {
    key: "sync-ai-news",
    description:
      "Pull official provider feeds and general AI news (RSS, Atom, JSON, official changelogs).",
    cron: "*/20 * * * *",
    domains: ["ai_news", "provider_news", "research"],
  },
  {
    key: "sync-harness-pricing",
    description:
      "Extract coding-agent plan prices, credits and model access from official pricing pages. Fails loudly when a page shape changes.",
    cron: "0 */4 * * *",
    domains: ["harness"],
  },
  {
    key: "sync-harness-changelogs",
    description: "Watch harness changelogs and GitHub releases for plan, model and CLI changes.",
    cron: "*/30 * * * *",
    domains: ["harness"],
  },
  {
    key: "sync-social",
    description:
      "Pull monitored accounts through the authorized social API. Disabled without a token.",
    cron: "0 * * * *",
    domains: ["social"],
  },
  {
    key: "sync-world-news",
    description:
      "Pull world and political news from the licensed provider. Isolated from model and harness ranking.",
    cron: "*/30 * * * *",
    domains: ["world_politics"],
  },
  {
    key: "cleanup-raw-ingestion",
    description: "Delete raw ingestion payloads past their retention window.",
    cron: "0 4 * * *",
    domains: [],
    maintenance: true,
  },
];

export const JOB_BY_KEY = new Map(JOBS.map((job) => [job.key, job]));

export function isJobKey(value: string): value is JobKey {
  return (JOB_KEYS as readonly string[]).includes(value);
}

export function sourcesForJob(job: JobDefinition): SourceDefinition[] {
  if (job.domains.length === 0) return [];
  return SOURCE_REGISTRY.filter((source) => job.domains.includes(source.domain));
}

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

export interface JobSourceOutcome {
  sourceId: string;
  enabled: boolean;
  /** "not_configured" means credentials are missing — never a failure to hide. */
  outcome: "ok" | "not_configured" | "disabled" | "deferred" | "failed";
  itemsSeen: number;
  itemsWritten: number;
  itemsSkipped: number;
  rateLimitRemaining: number | null;
  message: string | null;
}

export interface JobResult {
  job: JobKey;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  dryRun: boolean;
  dataMode: "mock" | "live";
  outcomes: JobSourceOutcome[];
  totals: { seen: number; written: number; skipped: number; failed: number; notConfigured: number };
}

export function emptyTotals(): JobResult["totals"] {
  return { seen: 0, written: 0, skipped: 0, failed: 0, notConfigured: 0 };
}

export function summarize(outcomes: JobSourceOutcome[]): JobResult["totals"] {
  const totals = emptyTotals();
  for (const outcome of outcomes) {
    totals.seen += outcome.itemsSeen;
    totals.written += outcome.itemsWritten;
    totals.skipped += outcome.itemsSkipped;
    if (outcome.outcome === "failed") totals.failed += 1;
    if (outcome.outcome === "not_configured") totals.notConfigured += 1;
  }
  return totals;
}
