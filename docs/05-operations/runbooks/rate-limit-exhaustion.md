# Runbook: rate-limit exhaustion

**Severity:** medium (data freshness degrades; nothing corrupts)
**Typical signal:** an `ingestion_runs` row with `rate_limit_remaining` at or near zero; a job
outcome reported as `failed` with a message containing "rate limited", or a source repeatedly
producing no items; an Artificial Analysis pass that stops early.

## Symptoms

- `error` on a run containing "Rate limited by https://... after N attempts."
- `rate_limit_remaining = 0` in the ingestion ledger, with `rate_limit_reset_at` set.
- `sync-models` writing fewer rows than expected because pagination stopped early.
- Repeated `deferred` outcomes where a source would normally return items.

## How the system behaves under a limit

Two distinct mechanisms, and they are reported differently:

1. **Pre-emptive deferral.** `HttpClient` refuses to issue a request when the last captured
   `remaining` value is below the request's `minRemaining` (the model adapter uses 1 by
   default), throwing `QuotaGuardError` with the message
   `Deferred request: N quota remaining, M required.` This is a deliberate, benign deferral.
2. **Reactive backoff.** On HTTP 429 the client waits for `Retry-After` (seconds or an HTTP
   date) or backs off exponentially with jitter, up to `maxAttempts` (default 4). Exhausting
   the attempts throws `RateLimitExceededError`.

Important caveat: a quota-guard deferral is currently misclassified. The message does not match
`/rate limited/i`, so the model adapter reports it as code `network` and the runner reports the
source as `failed`. Treat a `failed` outcome whose message starts with "Deferred request" as a
deferral, not a defect. Tracked as KI-1, and backlog item M1 is to fix the classification.

## Likely causes

| Cause | How to confirm quickly |
| --- | --- |
| The quota window is genuinely exhausted | `rate_limit_remaining` is 0 and `rate_limit_reset_at` is in the near future |
| Cadence is too aggressive for the plan | Compare `sources.cadence_minutes` for the source against the observed request count per run |
| A pagination cap is too high | `maxPages` defaults to 20 and page size to 100 in the model adapter |
| Concurrent runs of the same job | Two `ingestion_runs` rows with the same `job_key` and overlapping `started_at` |
| A retry storm after an unrelated failure | Several rows with the same source and short intervals |

## Immediate mitigation

1. Confirm whether it is a deferral or a genuine 429:

```sql
select source_id, job_key, status, items_seen, items_written,
       rate_limit_remaining, rate_limit_reset_at, error, started_at
from public.ingestion_runs
where source_id = '<source-id>'
order by started_at desc
limit 20;
```

2. If the quota is exhausted, reduce pressure until the window resets:

```sql
-- Increase the cadence (minutes between runs) for the affected source
update public.sources set cadence_minutes = 120 where id = '<source-id>';
```

Then update the matching entry in `src/lib/fixtures/sources.ts` so the registry agrees.

3. Verify the shape of the run without consuming quota:

```bash
npm run jobs:run sync-models --dry-run
```

## Diagnosis

```bash
# Run one source and inspect its outcome and captured limits
npm run jobs:run sync-models --source=artificial-analysis-api
```

In the response, check:

- `outcomes[0].outcome` and `outcomes[0].message`;
- `outcomes[0].rateLimitRemaining`;
- whether `result.totals.written` is 0 because of the limit or because nothing changed.

For a broader view:

```sql
-- Sources whose remaining quota is lowest, newest run each
with latest as (
  select source_id, rate_limit_remaining, rate_limit_reset_at, started_at,
         row_number() over (partition by source_id order by started_at desc) as rn
  from public.ingestion_runs
)
select source_id, rate_limit_remaining, rate_limit_reset_at, started_at
from latest where rn = 1 order by rate_limit_remaining nulls last;
```

## Fix

| Situation | Action |
| --- | --- |
| Legitimate quota ceiling | Lower the cadence, and let the deploy script re-create the schedule if the cron changed |
| Pagination cap reached | Reduce `pageSize` or `maxPages` to fit the plan's budget, or split the run across windows |
| Concurrent runs | Ensure one runner per job; there is no distributed lock (see ADR-0001 and the ingestion architecture) |
| Persistent 401/403 instead of 429 | The key is missing or invalid; this is a credential problem, not a rate limit |
| Quota guard firing constantly | Investigate whether the last captured `remaining` is stale; the guard compares against the most recently observed value |

After changing a cadence, update both the registry (`src/lib/jobs/registry.ts`) and the schedule
script (`scripts/jobs/create-schedules.mjs`), then:

```bash
npm run jobs:schedule
```

## Verification

- [ ] A subsequent run records `rate_limit_remaining` above zero, or the reset time has passed
- [ ] The source produces items again (`items_seen` greater than zero)
- [ ] No source is repeatedly `failed` with a "Deferred request" or "rate limited" message
- [ ] The Sources workspace shows the source as fresh rather than stale

## Prevention

- `HttpClient` enforces a hard request cap per client instance (200 by default, 400 for social),
  so one adapter cannot burn the whole quota.
- The quota guard refuses requests below `minRemaining` rather than discovering the limit the
  hard way.
- Rate-limit headers are captured across several vendor spellings and stored on the run, which
  is what makes this diagnosis possible.
- Fixing the quota-guard classification (backlog M1) will make deferrals visible as deferrals.
- A per-source rate-limit budget is not modelled; only the shared guard exists.

## Related

- Known issues: KI-1 (quota deferral reported as failure)
- Files: `src/lib/adapters/http.ts`, `src/lib/adapters/artificial-analysis.ts`,
  `src/lib/ingestion/runner.ts`, `src/lib/jobs/registry.ts`
- Reference: `docs/01-architecture/ingestion-architecture.md`,
  `docs/05-operations/qstash-schedules.md`
