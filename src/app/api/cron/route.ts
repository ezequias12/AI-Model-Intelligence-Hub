/**
 * Vercel Cron endpoint.
 *
 * Triggered daily by Vercel Cron via HTTP GET.
 * Verifies Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
 */
import { NextResponse } from "next/server";
import { runJob } from "@/lib/ingestion/runner";

export const dynamic = "force-dynamic";
// Four jobs run sequentially here too; keep the same ceiling as the job route
// so the daily run is not truncated mid-pipeline.
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : request.headers.get("x-cron-secret");

    if (token !== cronSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
  }

  const jobsToRun = ["sync-models", "sync-ai-news", "sync-social", "sync-harness-pricing"] as const;

  const results = [];
  for (const jobKey of jobsToRun) {
    try {
      const res = await runJob(jobKey);
      results.push({
        job: jobKey,
        ok: res.totals.failed === 0,
        totals: res.totals,
      });
    } catch (err) {
      results.push({
        job: jobKey,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failedCount = results.filter((r) => !r.ok).length;
  return NextResponse.json({
    ok: failedCount === 0,
    results,
    timestamp: new Date().toISOString(),
  });
}
