/**
 * Scheduled job endpoint.
 *
 * QStash calls this route on the registered cron schedule. The request is
 * signature-verified before any work happens, and the response always reports
 * exactly which sources ran, deferred or failed.
 */
import { NextResponse } from "next/server";
import { runJob } from "@/lib/ingestion/runner";
import { isJobKey, JOBS } from "@/lib/jobs/registry";
import { verifyQStashRequest } from "@/lib/jobs/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ job: string }> },
): Promise<NextResponse> {
  const { job } = await context.params;
  const body = await request.text();
  const signature = request.headers.get("upstash-signature");
  const authorization = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");

  const verification = await verifyQStashRequest(body, signature, {
    allowUnverifiedInMock: true,
    authorization,
    cronSecret,
  });

  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, error: verification.reason },
      { status: verification.status },
    );
  }

  if (!isJobKey(job)) {
    return NextResponse.json(
      { ok: false, error: `Unknown job "${job}".`, knownJobs: JOBS.map((entry) => entry.key) },
      { status: 404 },
    );
  }

  let payload: { dryRun?: boolean; sourceIds?: string[] } = {};
  if (body.length > 0) {
    try {
      payload = JSON.parse(body) as typeof payload;
    } catch {
      payload = {};
    }
  }

  const result = await runJob(job, {
    dryRun: payload.dryRun ?? false,
    sourceIds: payload.sourceIds,
  });

  const failed = result.totals.failed > 0;
  return NextResponse.json(
    { ok: !failed, verification: verification.reason, result },
    { status: failed ? 207 : 200 },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    jobs: JOBS.map((job) => ({
      key: job.key,
      description: job.description,
      cron: job.cron,
      domains: job.domains,
    })),
    note: "POST to run a job. Requests are signature-verified when QStash signing keys are configured.",
  });
}
