#!/usr/bin/env node
/**
 * Local job runner.
 *
 * Calls the job endpoint on a running server, so local execution uses exactly
 * the same code path as the scheduled production run.
 *
 * Usage:
 *   node scripts/jobs/run-local.mjs sync-models            # runs against http://localhost:3000
 *   node scripts/jobs/run-local.mjs sync-ai-news --dry-run
 *   JOB_BASE_URL=https://your-app.vercel.app node scripts/jobs/run-local.mjs sync-models
 *
 * Note: in mock mode every source reports `deferred` — that is intentional and
 * honest. Nothing is fetched and nothing is claimed to have been fetched.
 */
const baseUrl = process.env.JOB_BASE_URL ?? "http://localhost:3000";

const [, , jobKey, ...flags] = process.argv;

if (!jobKey) {
  console.error("Usage: node scripts/jobs/run-local.mjs <job-key> [--dry-run] [--source=<id>]");
  console.error(
    "Job keys: sync-models, sync-ai-news, sync-harness-pricing, sync-harness-changelogs, sync-social, sync-world-news, cleanup-raw-ingestion",
  );
  process.exit(1);
}

const dryRun = flags.includes("--dry-run");
const sourceIds = flags
  .filter((flag) => flag.startsWith("--source="))
  .map((flag) => flag.slice("--source=".length));

const url = `${baseUrl.replace(/\/$/, "")}/api/jobs/${encodeURIComponent(jobKey)}`;

try {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dryRun, sourceIds: sourceIds.length > 0 ? sourceIds : undefined }),
  });

  const payload = await response.json();
  console.log(JSON.stringify(payload, null, 2));
  process.exit(response.ok || response.status === 207 ? 0 : 1);
} catch (error) {
  console.error(`Could not reach ${url}. Start the app first (npm run dev) or set JOB_BASE_URL.`);
  console.error(String(error));
  process.exit(1);
}
