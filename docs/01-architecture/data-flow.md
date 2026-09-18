# Data flow

## End-to-end path

```text
Source (API, feed, pricing page)
      |
      | HttpClient: quota guard, Retry-After, exponential backoff, rate-limit capture
      v
Adapter (src/lib/adapters/*)
      |
      | Zod parse of the raw payload, then map to domain objects
      | returns AdapterResult<T> { ok, items, skipped, rateLimit, error, payloadHash, requests, durationMs }
      v
Job runner (src/lib/ingestion/runner.ts)
      |
      | records an IngestionRun (status, counts, rate limit, error, idempotency key)
      | writes through the ingestion writer (chunked upserts, onConflict keys)
      v
Postgres (public schema)  +  private schema (reserved for raw payloads)
      |
      | repository layer (mock or Supabase) with per-row Zod validation
      v
Workspace loaders (src/lib/data/workspace.ts)
      |
      | buildModelContexts, resolveDefaultSelection, previousMetricsByModel, groupSnapshotsByModel,
      | latestSnapshotByPlan, clusterForDisplay
      v
Analytics (src/lib/analytics)
      |
      | leader cards, ranking boards, landscape points, release rows
      v
Server components -> client workspace components -> DOM
```

## Read path in detail

1. A page (for example `src/app/models/rankings/page.tsx`) renders
   `ModelsShellServer`, which calls `loadModelWorkspace()`.
2. `loadModelWorkspace()` requests models, providers and model snapshots in parallel
   from `getRepository()`.
3. It derives `previousMetricsByModel` (the second-newest snapshot per model, used for
   deltas), builds `ModelContext[]` through `buildModelContexts`, resolves the default
   selection, and groups snapshots into a serialisable map capped at 12 per model.
4. Client components receive plain props and compute view structures with
   `src/lib/analytics`. `ModelsWorkspaceProvider` holds selection state and writes it to
   the `?models=` query parameter and to local storage.

## Write path in detail

Writes happen only in the ingestion pipeline, only with the service role.

1. QStash POSTs to `/api/jobs/{job}` on the registered cron.
2. `src/app/api/jobs/[job]/route.ts` reads the raw body, reads the `upstash-signature`
   header, and calls `verifyQStashRequest(body, signature, { allowUnverifiedInMock: true })`.
3. On success it calls `runJob(jobKey, { dryRun, sourceIds })`.
4. `runJob` resolves the job definition and its sources from the registry. A disabled
   source produces an `IngestionRun`-like outcome with `outcome: "disabled"`.
5. In `mock` mode, or when `dryRun` is set, every enabled source is reported as
   `deferred` with a message explaining that no live fetch happened.
6. Otherwise `runSource()` dispatches by source `domain` and `type`:
   - `models` + `api` -> Artificial Analysis adapter, then providers, models and
     snapshots are written.
   - `rss` / `atom` -> feed parser, then news items are written.
   - `official_pricing` / `official_site` -> harness page extractor, then plan
     snapshots are written for plans whose `canonicalPlanKey` already exists.
   - `social_api` -> social adapter, then monitored accounts and posts are written.
   - `world_politics` -> world news adapter, then world items are written.
   - `harness` + `github_releases` -> release feed parsed with the news contract.
7. `recordRun()` writes an `IngestionRun` with a `status` of `success`, `partial` or
   `failed`, an hour-granular idempotency key (`{sourceId}:{jobKey}:{YYYY-MM-DDTHH}`)
   and the captured rate-limit state.
8. The route responds `200` when nothing failed and `207` when at least one source
   failed. The response body includes the per-source outcomes so a failure is never
   silent.

## Idempotency

| Layer | Mechanism |
| --- | --- |
| Ingestion run | Unique index on `ingestion_runs.idempotency_key` (partial, `where idempotency_key is not null`); the key is hour-granular. |
| Model snapshot | `unique (model_id, captured_at, payload_hash)`; upsert conflict target `model_id,captured_at,payload_hash`. |
| Plan snapshot | `unique (plan_id, captured_at, raw_source_hash)`; upsert conflict target `plan_id,captured_at,raw_source_hash`. |
| News item | Unique index on `(source_id, canonical_url)`; upsert conflict target `source_id,canonical_url`. |
| World item | `unique (source_id, canonical_url)`; upsert conflict target `source_id,canonical_url`. |
| Social post | `unique (platform, post_id)`; upsert conflict target `platform,post_id`. |
| Plain entities | Upsert by `id` (providers, models, sources-style tables, plans, products). |

Upserts are chunked at 200 rows per request to stay well below payload limits.

## Change detection

1. `diffSnapshots(before, after)` compares two snapshots field by field and returns
   `{ changed, changes, significance }`. Significance defaults: price and credit fields
   are `high`; model lists, request estimates, reset period, overage model, BYOK,
   frontier access, deprecation and active flags are `medium`; everything else is `low`.
2. `describeChange(entityLabel, change)` produces the human-readable feed line, for
   example `Command Code GOAT: monthly price changed from $10.00 to $7.00 (-30.0%)`.
3. An empty diff means nothing is written, which is what keeps a repeated run from
   creating duplicate rows.
4. Fixture mode derives change events the same way
   (`src/lib/fixtures/index.ts` -> `buildFixtureChangeEvents`), so the Releases and
   Changes views are exercised without a database.

## News dedupe and clustering

1. The raw link is canonicalized: tracking parameters, fragment, `www.` prefix and a
   trailing slash are removed, the host is lowercased and the remaining query
   parameters are sorted (`canonicalizeUrl`).
2. `newsContentHash({ canonicalUrl, title, publishedAt })` produces a 16-character
   deterministic hash over the canonical URL, the normalized title and the publication
   day.
3. `clusterNewsItems(items, { similarityThreshold: 0.62, windowHours: 48 })` groups
   similar titles within the window. Token Jaccard similarity is used, and the anchor
   is the highest-trust item, tie-broken by earliest publication, so the primary source
   wins the cluster. Secondary items receive `clusterId` pointing at the anchor.

## Freshness flow

`computeFreshness(capturedAt, { thresholds })` classifies a timestamp as `fresh`,
`aging`, `stale` or `unknown` and produces a label such as `2h ago`. Domain-specific
thresholds come from `thresholdsForDomain()`:

| Domain | Fresh (minutes) | Aging (minutes) |
| --- | --- | --- |
| models | 60 | 360 |
| ai_news | 90 | 720 |
| harness | 360 | 2880 |
| world_politics | 180 | 1440 |
| social | 60 | 720 |
| research | 360 | 2880 |
| default (unknown domain) | 60 | 360 |

A missing or unparseable timestamp yields `unknown` with the label `Never synced`, and
`freshnessSortKey()` sorts unknown values last so the Sources view puts the worst case
first when reversed.

## Mode resolution flow

```text
NEXT_PUBLIC_DATA_MODE
  "live"  -> Supabase credentials present? -> supabase repository
                        | no
                        v
             degraded repository (fixtures + "Live mode - degraded" + reason)
  anything else (including unset, "mock", "production", typos)
                        v
             mock repository (fixtures)
```

`resolveDataMode()` in `src/lib/domain/schema.ts` is the only place that decides this,
and `describeCapabilities()` in `src/lib/data/mode.ts` reports which integrations are
configured.
