/**
 * Fixture ingestion run ledger.
 *
 * Gives the Sources workspace realistic adapter status, rate-limit state and
 * error history without touching any external service.
 */
import type { IngestionRun, SourceDefinition } from "@/lib/domain/schema";
import { stableHash } from "@/lib/domain/hash";

export function buildFixtureIngestionRuns(sources: SourceDefinition[], now: Date): IngestionRun[] {
  const runs: IngestionRun[] = [];

  sources.forEach((source, sourceIndex) => {
    if (!source.enabled) {
      runs.push({
        id: `run:${source.id}:disabled`,
        sourceId: source.id,
        jobKey: jobKeyFor(source.domain),
        status: "skipped",
        startedAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
        finishedAt: new Date(now.getTime() - 30 * 60_000 + 120).toISOString(),
        itemsSeen: 0,
        itemsWritten: 0,
        itemsSkipped: 0,
        rateLimitRemaining: null,
        rateLimitResetAt: null,
        error: "Source disabled: credentials not configured.",
        idempotencyKey: null,
      });
      return;
    }

    const cadence = source.cadenceMinutes ?? 120;
    const runCount = 3;

    for (let index = 0; index < runCount; index += 1) {
      const minutesAgo = cadence * index + (sourceIndex % 7) * 3 + 4;
      const startedAt = new Date(now.getTime() - minutesAgo * 60_000);
      const durationMs =
        400 + (Number.parseInt(stableHash(`${source.id}:${index}`).slice(0, 4), 16) % 3200);
      const finishedAt = new Date(startedAt.getTime() + durationMs);

      const seedValue = Number.parseInt(stableHash(`${source.id}:${index}:count`).slice(0, 6), 16);
      const itemsSeen = source.domain === "models" ? 96 + (seedValue % 40) : 8 + (seedValue % 24);
      const itemsWritten = Math.max(0, itemsSeen - (seedValue % 9));
      const itemsSkipped = itemsSeen - itemsWritten;

      const isRateLimited = source.id === "artificial-analysis-api" && index === 2;
      const hasError = source.id === "kilo-pricing" && index === 1;

      runs.push({
        id: `run:${source.id}:${index}`,
        sourceId: source.id,
        jobKey: jobKeyFor(source.domain),
        status: hasError
          ? "failed"
          : isRateLimited
            ? "rate_limited"
            : index === 0
              ? "success"
              : "partial",
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        itemsSeen,
        itemsWritten,
        itemsSkipped,
        rateLimitRemaining: isRateLimited
          ? 0
          : source.domain === "models"
            ? 240 - index * 40
            : null,
        rateLimitResetAt: isRateLimited
          ? new Date(startedAt.getTime() + cadence * 60_000).toISOString()
          : null,
        error: hasError
          ? "Pricing page selector did not match the expected shape; extraction aborted without writing values."
          : isRateLimited
            ? "Quota exhausted; run deferred to the next window."
            : null,
        idempotencyKey: `${source.id}:${jobKeyFor(source.domain)}:${startedAt.toISOString().slice(0, 16)}`,
      });
    }
  });

  return runs.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function jobKeyFor(domain: SourceDefinition["domain"]): string {
  switch (domain) {
    case "models":
      return "sync-models";
    case "harness":
      return "sync-harness-pricing";
    case "social":
      return "sync-social";
    case "world_politics":
      return "sync-world-news";
    case "research":
      return "sync-ai-news";
    case "ai_news":
    case "provider_news":
      return "sync-ai-news";
    default:
      return "sync-ai-news";
  }
}
