# Runbook: stale data

**Severity:** medium (the product still renders, but the confidence in the numbers drops)
**Typical signal:** a source is `stale` in the Sources workspace; a page shows values whose
freshness label is measured in days; a job has not recorded a successful run inside its domain's
aging window.

## Symptoms

- The shell freshness label reads like `3d ago` or `Never synced`.
- The Sources workspace marks a source stale.
- A model card, harness plan or news item shows an old capture time.
- The newest `ingestion_runs` row for a source is older than its cadence.

## Freshness thresholds

A value is `fresh` up to `freshMinutes`, `aging` up to `agingMinutes`, and `stale` beyond it. A
missing or unparseable timestamp is `unknown` with the label `Never synced`.

| Domain | Fresh | Aging |
| --- | --- | --- |
| models | 60m | 360m |
| ai_news | 90m | 720m |
| harness | 360m | 2880m |
| world_politics | 180m | 1440m |
| social | 60m | 720m |
| research | 360m | 2880m |

Note that the shell label always uses the `models` thresholds, so a page whose own domain
thresholds are satisfied can still show a globally stale label. Tracked as KI-16.

## Likely causes

| Cause | How to confirm quickly |
| --- | --- |
| The source is disabled | `select id, enabled from public.sources where id = '<source-id>';` |
| A credential is missing | The job response reports `not_configured` and names the variable |
| Mock mode is active | The shell banner says the values are fixtures; `meta.datasetCapturedAt` is the fixture timestamp, not a recent sync |
| The schedule does not exist or is wrong | Check the QStash console for a schedule id prefixed `amih-`; compare its cron with the registry |
| Signature verification rejects the trigger | An `Upstash-Signature` failure returns 401; check `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` |
| The job runs but writes nothing | Supabase is unconfigured, so the writer is a no-op and the run reports `deferred` |
| A source's cadence is longer than the aging window | Compare `cadence_minutes` with the domain's `agingMinutes` |
| The parser broke and the source now fails | See the source parser breakage runbook |

## Immediate mitigation

1. Determine whether data is missing or merely old:

```sql
select s.id, s.domain, s.enabled, s.cadence_minutes,
       max(r.started_at) as last_run,
       max(r.status) as last_status
from public.sources s
left join public.ingestion_runs r on r.source_id = s.id
group by s.id, s.domain, s.enabled, s.cadence_minutes
order by last_run nulls first;
```

2. Trigger the relevant job immediately rather than waiting for the schedule:

```bash
npm run jobs:run sync-models
npm run jobs:run sync-ai-news
npm run jobs:run sync-harness-pricing
npm run jobs:run sync-world-news
```

## Diagnosis

```bash
# Is the app configured at all?
curl -s http://localhost:3000/api/health | jq '.dataMode, .degraded, .degradedReason, .pendingCredentials'

# Are the jobs registered with the expected crons?
curl -s http://localhost:3000/api/jobs/registry | jq '.jobs'
```

Decision path:

1. `dataMode` is `mock` → there is no live data by design. This is not a staleness defect.
2. `degraded` is `true` → Supabase is unconfigured; the writer is a no-op, so nothing persists
   and every source will look stale. Fix the credentials first.
3. `pendingCredentials` names the relevant capability → set the variable.
4. The source is `enabled = false` → enable it once the credential exists.
5. Everything is configured and the last run is old → check the schedule and the signature keys.

If a job runs but the page still shows old data, confirm that the run actually wrote rows:
`items_written` on the newest run, then a direct count on the target table.

## Fix

| Situation | Action |
| --- | --- |
| Missing credential | Set the variable from `docs/05-operations/environment-variables.md` and re-run the job |
| Missing schedule | `QSTASH_TOKEN=... QSTASH_TARGET_BASE_URL=... npm run jobs:schedule` |
| Wrong cron | Update both `src/lib/jobs/registry.ts` and `scripts/jobs/create-schedules.mjs`, then re-run the schedule script |
| Signature rejection | Align the signing keys with the QStash account; the job route returns 401 while they are wrong |
| Cadence longer than the window | Either shorten the cadence or accept that the domain will be labelled `aging` |
| `unknown` freshness | The capture timestamp is null or unparseable; check that the row really has `captured_at` (or `published_at` for news) set |

## Verification

- [ ] The source's newest run is inside its cadence window
- [ ] The affected workspace shows a fresh or aging label rather than stale
- [ ] `items_seen` and `items_written` on the newest run are consistent with the source's volume
- [ ] `/api/health` reports `degraded: false`

## Retention cleanup query referenced by the runner

The `cleanup-raw-ingestion` job does not delete anything itself. `runMaintenance()` in
`src/lib/ingestion/runner.ts` returns a message stating that retention cleanup is delegated to
"the SQL maintenance query documented in docs/05-operations/runbooks/stale-data.md". That
statement is only true if the query is actually here, so it is:

```sql
-- Delete raw ingestion payloads past their retention window.
-- Run manually, or wire it into the cleanup-raw-ingestion job.
delete from private.raw_ingestion_payloads
where retained_until < now();

-- Verify what is left, oldest first.
select source_id, min(retained_until) as oldest_retained, count(*)
from private.raw_ingestion_payloads
group by source_id
order by oldest_retained;
```

Notes on this query:

- Nothing writes to `private.raw_ingestion_payloads` today, so it currently deletes zero rows. The
  table and the `raw_payloads_retention_idx` index exist; payload capture is not implemented.
- Snapshot tables are not covered. `model_snapshots` and `harness_plan_snapshots` have no retention
  policy; pruning them would destroy history, so any query there must be a deliberate decision, not
  a cleanup default.
- The query is not scheduled. `cleanup-raw-ingestion` runs daily (`0 4 * * *`) and reports `ok` with
  an explanatory message.

## Prevention

- Freshness is a first-class state: every "current" value carries a timestamp, and unknown is
  labelled `Never synced` rather than being presented as fresh.
- Domain-specific thresholds mean a slow-changing source class is not falsely alarmed by the
  model-domain window.
- Sources are seeded with a cadence so the intended frequency is recorded, not assumed.
- Not implemented: no alert fires on a stale source. Checking the Sources workspace is a manual
  step today. A scheduled staleness reporter is proposed in
  `docs/05-operations/observability.md`.
- Not implemented: snapshot and payload retention. Data does not expire; it accumulates.

## Related

- Known issues: KI-16 (shell label uses model thresholds on every route), KI-11 (mode changes need
  a restart), KI-10 (declared but unread variables)
- Files: `src/lib/domain/freshness.ts`, `src/features/sources/source-registry.tsx`,
  `src/lib/data/mode.ts`, `src/lib/jobs/registry.ts`
- Reference: `docs/01-architecture/data-flow.md`, `docs/04-data/data-quality.md`
