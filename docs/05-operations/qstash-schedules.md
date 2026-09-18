# QStash schedules

Scheduled ingestion runs on Upstash QStash. QStash calls a single Next.js route on a cron
schedule, and the route verifies an Upstash signature before doing any work.

## Job table

Reproduced from `src/lib/jobs/registry.ts` (`JOBS`), which is the source of truth. The schedule
script duplicates the same table because it runs outside Next.js; the two must stay in step.

| Key | Cron | Domains | Description |
| --- | --- | --- | --- |
| `sync-models` | `*/30 * * * *` | `models` | Pull model metrics and pricing from the Artificial Analysis Data API, respecting quota and rate-limit headers. |
| `sync-ai-news` | `*/20 * * * *` | `ai_news`, `provider_news`, `research` | Pull official provider feeds and general AI news (RSS, Atom, JSON, official changelogs). |
| `sync-harness-pricing` | `0 */4 * * *` | `harness` | Extract coding-agent plan prices, credits and model access from official pricing pages. Fails loudly when a page shape changes. |
| `sync-harness-changelogs` | `*/30 * * * *` | `harness` | Watch harness changelogs and GitHub releases for plan, model and CLI changes. |
| `sync-social` | `0 * * * *` | `social` | Pull monitored accounts through the authorized social API. Disabled without a token. |
| `sync-world-news` | `*/30 * * * *` | `world_politics` | Pull world and political news from the licensed provider. Isolated from model and harness ranking. |
| `cleanup-raw-ingestion` | `0 4 * * *` | (none) | Delete raw ingestion payloads past their retention window. Maintenance job. |

Cadence rationale: the model source is quota-limited, so 30 minutes is chosen to keep a full
paginated pass comfortable; news is polled more often because feeds are cheap; harness pricing
pages change slowly and are expensive to parse, so they run every four hours; the cleanup job
runs once a day.

The `cleanup-raw-ingestion` job is registered and scheduled, but its handler does not delete
anything: `runMaintenance()` returns a message stating that retention cleanup is delegated to a
SQL maintenance query. See the "Not implemented" section below.

## Endpoint

`src/app/api/jobs/[job]/route.ts`.

| Method | Behaviour |
| --- | --- |
| `POST` | Verifies the signature, validates the job key against the registry, parses an optional JSON body, runs the job, returns `{ ok, verification, result }` with HTTP 200 when nothing failed and 207 when at least one source failed. |
| `GET` | Returns the registered jobs with `key`, `description`, `cron` and `domains`, plus a note about verification. |

The route exports `dynamic = "force-dynamic"` and `maxDuration = 300`.

Accepted body fields:

```json
{ "dryRun": true, "sourceIds": ["openai-blog-rss"] }
```

- `dryRun: true` reports every enabled source as `deferred` ("Dry run: adapter not executed.")
  without fetching anything.
- `sourceIds` restricts the run to the named sources from the registry.

## Signature verification

Implemented in `src/lib/jobs/verify.ts` using the `Receiver` from `@upstash/qstash`.

1. `createReceiver()` returns `null` unless **both** `QSTASH_CURRENT_SIGNING_KEY` and
   `QSTASH_NEXT_SIGNING_KEY` are set.
2. With no receiver:
   - if `allowUnverifiedInMock` is set **and** `NEXT_PUBLIC_DATA_MODE !== "live"`, the request
     is accepted with the reason "Mock mode: signature verification skipped (no signing keys).";
   - otherwise the request is rejected with HTTP 500 and the reason naming the two variables.
3. With a receiver:
   - a missing `Upstash-Signature` header is rejected with 401;
   - an invalid signature is rejected with 401;
   - a verification exception is rejected with 401 using the error message.
4. The job route passes `allowUnverifiedInMock: true`, so local development works in mock mode
   while a live deployment refuses unauthenticated triggers.

Note: the check compares `process.env.NEXT_PUBLIC_DATA_MODE !== "live"` directly rather than
using `getDataMode()`, so a misspelled mode value also permits the unverified path. Recorded as
KI-12.

## Creating schedules

```bash
QSTASH_TOKEN=<token> \
QSTASH_TARGET_BASE_URL=https://your-deployment \
npm run jobs:schedule
```

What the script does, from `scripts/jobs/create-schedules.mjs`:

1. Exits with an error if `QSTASH_TOKEN` or `QSTASH_TARGET_BASE_URL` is missing.
2. For each job, deletes any existing schedule with id `amih-<job-key>` (errors ignored), so
   re-running is idempotent.
3. Creates a schedule with `scheduleId: amih-<job-key>`,
   `destination: <base>/api/jobs/<job-key>`, the job's cron, `method: POST`,
   `body: {"job":"<key>"}`, `retries: 3` and a JSON content type.
4. Prints a JSON summary and exits non-zero if any job failed to schedule.

Schedule ids are prefixed `amih-` so they are identifiable in the QStash console.

To change a cadence: update `src/lib/jobs/registry.ts` **and**
`scripts/jobs/create-schedules.mjs` (they are duplicated by necessity), then re-run the
schedule script.

## Manual runs

```bash
npm run jobs:run sync-models
npm run jobs:run sync-ai-news --dry-run
npm run jobs:run sync-harness-pricing --source=claude-pricing
JOB_BASE_URL=https://your-deployment npm run jobs:run sync-world-news
```

The local runner POSTs to the same endpoint, so local execution exercises the production code
path. It exits 0 on HTTP 200 or 207 and 1 otherwise.

A direct call without a signature works only when the mode is not `live`:

```bash
curl -X POST http://localhost:3000/api/jobs/sync-models \
  -H 'content-type: application/json' -d '{"dryRun":true}'
```

## Reading the result

```json
{
  "ok": true,
  "verification": "Mock mode: signature verification skipped (no signing keys).",
  "result": {
    "job": "sync-models",
    "startedAt": "...",
    "finishedAt": "...",
    "durationMs": 12,
    "dryRun": false,
    "dataMode": "mock",
    "outcomes": [
      { "sourceId": "artificial-analysis-api", "enabled": true, "outcome": "deferred",
        "itemsSeen": 0, "itemsWritten": 0, "itemsSkipped": 0,
        "rateLimitRemaining": null,
        "message": "Mock mode: no live fetch performed. Enable live mode and configure the source to run it." }
    ],
    "totals": { "seen": 0, "written": 0, "skipped": 0, "failed": 0, "notConfigured": 0 }
  }
}
```

Outcome values: `ok`, `not_configured`, `disabled`, `deferred`, `failed`. `not_configured`
always comes with a message naming the missing environment variable. `deferred` is used for
mock mode, dry runs, quota guards and unregistered source types.

## Mock-mode skip

In mock mode, `runJob` does not call any adapter. Every enabled source is reported as
`deferred` with the message "Mock mode: no live fetch performed. Enable live mode and configure
the source to run it.", and nothing is written. Disabled sources are reported as `disabled`
instead. `tests/integration/adapters-contract.test.ts` asserts that:

- every outcome in a mock-mode run is `deferred` or `disabled`;
- the `written` total is 0 for every registered job;
- a disabled source is reported as `disabled`, not as a failure;
- the run is idempotent at the same timestamp (identical outcomes and totals);
- an unknown job key fails with a message listing the known jobs.

## Not implemented

| Item | Note |
| --- | --- |
| Retention deletion | `cleanup-raw-ingestion` is scheduled but deletes nothing. |
| Distributed locking | Two concurrent runs of the same job both execute; database keys prevent duplicate rows but not duplicate quota consumption. |
| Retry/backoff policy beyond QStash `retries: 3` | No per-source retry schedule is modelled in the app. |
| Alerting on repeated failures | Nothing notifies on `failed` or `not_configured` runs. |
| Schedule drift detection | Nothing verifies that the live QStash schedules still match the registry. |
