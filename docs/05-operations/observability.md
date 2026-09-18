# Observability

What the system reports, where to look, and what is missing. There is no tracing, no log
shipping and no metrics backend: observation is the ingestion ledger, the Sources workspace,
`GET /api/health`, and console logs.

## Signals available today

| Signal | Where | Contents |
| --- | --- | --- |
| Health and configuration | `GET /api/health` | `ok`, `dataMode`, `degraded`, `degradedReason`, `datasetCapturedAt`, `capabilities[]`, `pendingCredentials[]`, `checkedAt` |
| Ingestion ledger | `public.ingestion_runs` and the Sources workspace | Per source and job: `status`, `started_at`, `finished_at`, `items_seen`, `items_written`, `items_skipped`, `rate_limit_remaining`, `rate_limit_reset_at`, `error`, `idempotency_key` |
| Job run response | `POST /api/jobs/[job]` and `npm run jobs:run <job>` | Per-source `outcome`, counts, message, and the aggregated `totals` |
| Adapter rate-limit state | `AdapterResult.rateLimit` and the ingestion run | `remaining`, `limit`, `resetAt` captured from vendor headers |
| Freshness | Shell header, per-item labels, Sources view | `fresh` / `aging` / `stale` / `unknown` with an age label |
| Data mode | Shell banner | Mock, live, or "Live mode - degraded" with the reason |
| Row validation failures | Server logs | `[supabase] row failed validation in "<table>"` followed by the Zod error |
| Supabase query failures | Server logs | `[supabase] select from "<table>" failed` followed by the error |
| Build-time diagnostics | Build log | TypeScript and ESLint output |

## Interpreting an ingestion run

| `status` | Meaning | Likely cause |
| --- | --- | --- |
| `success` | Adapter ran and writes succeeded, or no error was recorded | Normal |
| `partial` | An error was recorded **and** some rows were written | A write failed part-way, or one plan in a page failed to extract |
| `failed` | An error was recorded and nothing was written | Parser breakage, schema mismatch, transport failure, or a quota guard (see KI-1) |
| `skipped` | Reserved for skipped work | Used by fixture data for disabled sources; the runner reports disabled sources in the job response instead |
| `rate_limited` | Reserved for explicit rate limiting | Used by fixture data; the runner reports a 429 exhaustion as `failed` on the source outcome |
| `running` | Reserved for in-flight runs | The runner writes the row after the source finishes, so this value is currently unused |

Fields that matter most when a run misbehaves:

- `items_seen` versus `items_written` versus `items_skipped`, to distinguish "the source returned
  little" from "we dropped most of it".
- `error`, which carries the adapter or writer message.
- `rate_limit_remaining` and `rate_limit_reset_at`, to see whether the source is approaching a
  ceiling.
- `idempotency_key` (`{sourceId}:{jobKey}:{YYYY-MM-DDTHH}`), to confirm that a retry inside the
  same hour targeted the same run row.

## Interpreting a job response

```bash
npm run jobs:run sync-ai-news
```

| Outcome | Meaning | Action |
| --- | --- | --- |
| `ok` | Adapter ran (and wrote, if Supabase is configured) | None |
| `not_configured` | A required credential is missing; the message names the variable | Set the variable |
| `disabled` | The source is disabled in the registry | Enable it in the registry once credentials exist |
| `deferred` | No live fetch: mock mode, dry run, quota guard, or no adapter for the type | Expected in mock mode; investigate otherwise |
| `failed` | Adapter or write failure | Read the message and the runbook for that class of failure |

The endpoint returns 207 when at least one source failed, and includes the partial result in
the body, so a failure is never reported as a success.

## Recommended checks

| Cadence | Check |
| --- | --- |
| After each deploy | `GET /api/health` returns `ok: true` and `degraded: false`; `pendingCredentials` is as expected |
| Daily | Sources workspace: any source `stale`, any run `failed`, any rate-limit state approaching zero |
| Weekly | Row counts by table; snapshot growth; duplicate check on news canonical URLs |
| After a provider change | The relevant adapter's `skipped` count, to catch a field rename |

Useful queries are in `docs/05-operations/supabase-setup.md`.

## Freshness thresholds as an alerting basis

A source is `stale` beyond its domain's `agingMinutes`. This is a reasonable alerting basis
even without a metrics backend: a query over `ingestion_runs` joined to `sources` can find
sources that have not produced a successful run inside their window.

| Domain | Aging threshold |
| --- | --- |
| models | 360 minutes |
| ai_news | 720 minutes |
| harness | 2880 minutes |
| world_politics | 1440 minutes |
| social | 720 minutes |
| research | 2880 minutes |

## Not implemented

| Gap | Impact |
| --- | --- |
| No structured logging | Output is plain console lines; there is no JSON log or correlation id, and `LOG_LEVEL` is declared but read nowhere |
| No tracing or APM | No span per adapter call or per page render |
| No metrics backend | No counters, gauges or histograms; everything must be derived from the database |
| No alerting | Nothing notifies on `failed`, `not_configured`, `stale`, or a growing error rate. A human must look. |
| No error reporting integration | Exceptions go to the platform log only |
| No validation-failure counter | Row validation failures are log lines, not a reported figure |
| No source health dashboard beyond the Sources workspace | The Sources view is the primary operational surface |
| No uptime monitoring | `/api/health` exists but nothing polls it |
| No log retention policy | Platform defaults apply |
| No per-source rate-limit budget modelling | Only the shared `HttpClient` guard exists |

## Adding observability

When this is addressed, the natural first steps are: a logger honouring `LOG_LEVEL` with one
line of JSON per source outcome, a validation-failure counter surfaced in the Sources
workspace, and a scheduled job that reports `stale` sources. Log shipping, tracing and a
metrics backend come after that; none of them requires the modular monolith to be split
(ADR-0001).
