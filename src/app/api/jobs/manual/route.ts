/**
 * Manual ingestion trigger endpoint.
 *
 * Allows manual execution of sync jobs on-demand from the UI or CLI.
 * Verifies CRON_SECRET if configured.
 */
import { NextResponse } from "next/server";
import { runJob } from "@/lib/ingestion/runner";
import { isJobKey, JOBS, type JobKey } from "@/lib/jobs/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecretHeader = request.headers.get("x-cron-secret");
  const configuredSecret = process.env.CRON_SECRET;

  let body: { job?: string; adminKey?: string; dryRun?: boolean; sourceIds?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  // Check authorization if CRON_SECRET is configured
  if (configuredSecret) {
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;
    const provided = bearer ?? cronSecretHeader ?? body.adminKey;

    if (provided !== configuredSecret) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Provide a valid CRON_SECRET or adminKey." },
        { status: 401 },
      );
    }
  }

  const job = body.job ?? "all";

  if (job === "all") {
    const jobsToRun: JobKey[] = [
      "sync-models",
      "sync-ai-news",
      "sync-social",
      "sync-harness-pricing",
    ];
    const results = [];
    for (const j of jobsToRun) {
      try {
        const res = await runJob(j, { dryRun: body.dryRun });
        results.push({ job: j, ok: res.totals.failed === 0, result: res });
      } catch (err) {
        results.push({
          job: j,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const failedCount = results.filter((r) => !r.ok).length;
    return NextResponse.json({ ok: failedCount === 0, results });
  }

  if (!isJobKey(job)) {
    return NextResponse.json(
      { ok: false, error: `Unknown job "${job}".`, knownJobs: JOBS.map((e) => e.key) },
      { status: 404 },
    );
  }

  try {
    const result = await runJob(job, {
      dryRun: body.dryRun ?? false,
      sourceIds: body.sourceIds,
    });
    return NextResponse.json({ ok: result.totals.failed === 0, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
