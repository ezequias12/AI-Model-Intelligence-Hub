#!/usr/bin/env node
/**
 * Creates (or updates) the QStash schedules for every registered job.
 *
 * Usage:
 *   QSTASH_TOKEN=... QSTASH_TARGET_BASE_URL=https://your-app.vercel.app npm run jobs:schedule
 *
 * The job definitions are duplicated here by necessity (this script runs outside
 * Next.js), so `registry.ts` is the source of truth and this table must match.
 */
import { Client } from "@upstash/qstash";

const JOBS = [
  {
    key: "sync-models",
    cron: "*/30 * * * *",
    description: "Artificial Analysis model metrics and pricing",
  },
  {
    key: "sync-ai-news",
    cron: "*/20 * * * *",
    description: "Official provider feeds and general AI news",
  },
  { key: "sync-harness-pricing", cron: "0 */4 * * *", description: "Harness pricing pages" },
  {
    key: "sync-harness-changelogs",
    cron: "*/30 * * * *",
    description: "Harness changelogs and GitHub releases",
  },
  {
    key: "sync-social",
    cron: "0 * * * *",
    description: "Monitored social accounts via authorized API",
  },
  {
    key: "sync-world-news",
    cron: "*/30 * * * *",
    description: "World and political news (isolated domain)",
  },
  { key: "cleanup-raw-ingestion", cron: "0 4 * * *", description: "Raw payload retention cleanup" },
];

const token = process.env.QSTASH_TOKEN;
const baseUrl = process.env.QSTASH_TARGET_BASE_URL;

if (!token) {
  console.error("QSTASH_TOKEN is not set. Nothing was scheduled.");
  process.exit(1);
}

if (!baseUrl) {
  console.error(
    "QSTASH_TARGET_BASE_URL is not set. Point it at your deployment (or a tunnel) so QStash can call back.",
  );
  process.exit(1);
}

const client = new Client({ token });
const destination = `${baseUrl.replace(/\/$/, "")}/api/jobs`;

const results = [];

for (const job of JOBS) {
  const scheduleId = `amih-${job.key}`;
  try {
    // Remove any previous schedule with the same id so re-running is idempotent.
    await client.schedules.delete(scheduleId).catch(() => undefined);

    const created = await client.schedules.create({
      scheduleId,
      destination: `${destination}/${job.key}`,
      cron: job.cron,
      method: "POST",
      body: JSON.stringify({ job: job.key }),
      retries: 3,
      headers: { "content-type": "application/json" },
    });

    results.push({
      scheduleId,
      cron: job.cron,
      status: "created",
      scheduleIdReturned: created.scheduleId,
    });
    console.log(`scheduled ${job.key} (${job.cron}) -> ${destination}/${job.key}`);
  } catch (error) {
    results.push({ scheduleId, cron: job.cron, status: "failed", error: String(error) });
    console.error(`failed to schedule ${job.key}:`, error);
  }
}

const failed = results.filter((entry) => entry.status === "failed");
console.log(
  JSON.stringify(
    { scheduled: results.length - failed.length, failed: failed.length, results },
    null,
    2,
  ),
);
process.exit(failed.length > 0 ? 1 : 0);
