# Ingestion architecture

## Goals

- One code path per job, shared by the scheduler, the HTTP endpoint and the local
  runner.
- Never hide a missing credential, a broken parser or an exhausted quota.
- Never duplicate rows when a run is retried.
- Never invent a value the source did not publish.

## Components

| Component | File | Responsibility |
| --- | --- | --- |
| Job registry | `src/lib/jobs/registry.ts` | Declares the seven jobs (key, description, cron, domains), resolves the sources for a job, defines the outcome/result types and totals |
| Signature verification | `src/lib/jobs/verify.ts` | Builds the Upstash `Receiver`, verifies the `Upstash-Signature` header, allows the unverified path only in mock mode |
| Runner | `src/lib/ingestion/runner.ts` | Dispatches by source domain/type, calls adapters, records runs, aggregates outcomes |
| Writer | `src/lib/ingestion/writer.ts` | Chunked idempotent upserts using the service role; no-op writer when Supabase is not configured |
| Harness configs | `src/lib/ingestion/harness-configs.ts` | Versioned selector configuration for seven pricing pages |
| HTTP client | `src/lib/adapters/http.ts` | Quota guard, 429/`Retry-After`, exponential backoff with jitter, rate-limit header capture, request cap |
| Adapters | `src/lib/adapters/*` | Source-specific parsing and mapping into the shared envelope |
| Job endpoint | `src/app/api/jobs/[job]/route.ts` | Verifies the signature, validates the job key, parses the body, runs the job, returns per-source outcomes |
| Schedule script | `scripts/jobs/create-schedules.mjs` | Creates/deletes QStash schedules idempotently |
| Local runner | `scripts/jobs/run-local.mjs` | Calls the job endpoint of a running app |

## Adapter contract

Every adapter returns `AdapterResult<T>` from `src/lib/adapters/types.ts`:

```typescript
interface AdapterResult<T> {
  ok: boolean;
  items: T[];
  skipped: number;
  rateLimit: { remaining: number | null; limit: number | null; resetAt: string | null };
  error: AdapterError | null;
  payloadHash: string | null;
  requests: number;
  durationMs: number;
}
```

`AdapterError.code` is one of `network`, `http`, `rate_limited`, `parse`, `schema`,
`unauthorized`, `not_configured`, `unsupported`. `not_configured` is produced by
`NOT_CONFIGURED(what, envVar)` and always names the variable that would enable the
source. `ok: false` with `code: "not_configured"` is a reported state, not a crash.

## Dispatch table

`runSource()` in `src/lib/ingestion/runner.ts` selects an adapter from the source
definition:

| Source `domain` | Source `type` | Adapter | Writes |
| --- | --- | --- | --- |
| `models` | `api` | `fetchArtificialAnalysis` | `providers`, `models`, `model_snapshots`, then the run |
| any news domain | `rss`, `atom` | `feedToNewsItems` (RSS/Atom parser) | `news_items`, then the run |
| `harness` | `official_pricing`, `official_site` | `extractHarnessPage` with the registered config | `harness_plan_snapshots` for plans whose `canonicalPlanKey` already exists, then the run |
| `social` | `social_api` | `fetchSocialPosts` | `monitored_social_accounts`, `social_posts`, then the run |
| `world_politics` | any | `fetchWorldNews` | `world_news_items`, then the run |
| `harness` | `github_releases` | `feedToNewsItems` against the repository's `.atom` feed | `news_items`, then the run |
| anything else | anything else | none | Reported as `deferred` with a message naming the unhandled type |

Sources whose `enabled` flag is false are reported as `disabled` with the message
"Source disabled: credentials not configured or source retired." and never fetched.

## Outcomes

| Outcome | Meaning |
| --- | --- |
| `ok` | The adapter ran and (unless dry run or mock mode) rows were written |
| `not_configured` | A required credential is missing; the adapter named it |
| `disabled` | The source is disabled in the registry |
| `deferred` | No live fetch happened (mock mode, dry run, quota guard, or no adapter registered) |
| `failed` | The adapter or the write failed; the message carries the reason |

The endpoint returns HTTP `200` when nothing failed and `207` when at least one source
failed. `GET /api/jobs/[job]` lists the registered jobs with their crons.

## Mode interaction

| Mode | Behaviour of `runJob` |
| --- | --- |
| `mock` | Every enabled source is reported `deferred` with the message "Mock mode: no live fetch performed...". Nothing is fetched and nothing is written. |
| `live` + Supabase configured | Adapters run and rows are written. |
| `live` without Supabase | Adapters run but the writer is the no-op writer, so each source is reported `deferred` with the message that Supabase is not configured and nothing was persisted. |

This is asserted in `tests/integration/adapters-contract.test.ts`: in mock mode every
source is `deferred` or `disabled`, the written total is zero for every job, and a
repeated run at the same timestamp produces identical outcomes.

## Quota discipline

`HttpClient` (`src/lib/adapters/http.ts`) enforces:

1. A hard request cap (`maxRequests`, default 200; 400 for the social adapter).
2. `minRemaining` on each request: if the last captured `remaining` is below the
   requirement, the client throws `QuotaGuardError` instead of issuing the request.
   The Artificial Analysis adapter uses `minRemaining: 1` by default.
3. On HTTP 429: honour `Retry-After` (seconds or an HTTP date, parsed by
   `parseRetryAfter`) and otherwise back off exponentially with jitter, up to
   `maxAttempts` (default 4). Exhausting attempts throws `RateLimitExceededError`.
4. On 5xx: retry with backoff. Other non-OK statuses throw immediately with the status
   and a truncated body.
5. Rate-limit headers are captured from several vendor spellings
   (`x-ratelimit-remaining`, `ratelimit-remaining`, `x-rate-limit-remaining`, and the
   `limit`/`reset` counterparts) and surfaced on the ingestion run.

## Harness pricing extraction

Pricing pages are the hardest source class, so extraction is deliberately strict.

1. The configuration (`HARNESS_PAGE_CONFIGS`) is versioned (`configVersion`, currently
   `2026.09.1`) and declares, per plan, a set of regex field extractors and a `required`
   list.
2. `extractPlan()` normalizes the page to plain text, applies each extractor, applies a
   fallback only for non-required fields, and fails with a reason when a required field
   does not resolve. The failure message states that nothing was written.
3. `extractHarnessPage()` fails the whole run when no plan resolves, and otherwise
   reports how many plans were skipped.
4. The raw page hash (`stableHash(html)`) is stored on every snapshot so a silent page
   change is detectable.
5. `estimatedRequestsSourceUrl` is only set when the vendor documents a request
   estimate; it is `null` otherwise, and derived request-per-dollar figures are then
   `null` as well.
6. A missing number is never coerced to zero. `coerce()` returns `undefined` for an
   unparseable number, and the field is then either taken from the fallback or treated
   as missing.

Configured pages: `command-code-pricing` (Go, GOAT), `opencode-go`, `kilo-pricing`
(Individual platform, Kilo Pass), `claude-pricing` (Pro, Max), `freebuff`,
`cursor-pricing` (Pro), `windsurf-pricing` (Pro).

Status: the code paths are complete and unit-tested against fixtures, but the selector
patterns have not been verified against the current live pages. This is recorded as
`IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` in
`docs/00-overview/project-status.md`.

## Idempotency and locking

- Idempotency is enforced by database keys, not by application-side locking (see the
  idempotency table in `docs/01-architecture/database-schema.md`).
- `ingestion_runs.idempotency_key` is `{sourceId}:{jobKey}:{YYYY-MM-DDTHH}`, so a
  retry inside the same hour records the same run row.
- There is **no** distributed lock across runners. Two concurrent runs of the same job
  would both execute; the upsert keys prevent duplicated rows, but the second run would
  still consume quota. Scheduling a single runner per job is the current mitigation.

## Not implemented

- Raw payload capture into `private.raw_ingestion_payloads`. The table and its
  retention index exist; nothing writes to it.
- Raw payload retention cleanup. The `cleanup-raw-ingestion` job is registered with the
  cron `0 4 * * *`, but `runMaintenance()` only returns a message stating that retention
  cleanup is delegated to a SQL maintenance query. It deletes nothing.
- Harness product and plan seeding. `writeHarnessProducts` and `writeHarnessPlans` exist,
  but no job populates those tables, so a fresh database has no harness rows for the
  pricing job to attach snapshots to.
- Benchmark ingestion. No adapter writes `benchmark_definitions` or
  `model_benchmark_values`.
- Distributed locking and backpressure between concurrent runs.
- Structured JSON logging or tracing; output is plain console logging.
