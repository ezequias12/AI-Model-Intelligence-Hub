# Data quality

The product's quality promises are narrow and enforced: a missing value is `null` and renders
as an em dash, every value carries a provenance and a time, and nothing is invented. This
document describes how those promises are implemented and where they are not fully met.

## Validation layers

| Layer | Mechanism | Failure behaviour |
| --- | --- | --- |
| Adapter payload | Zod schema per adapter, `.passthrough()` where a vendor may add fields | Envelope mismatch returns a `schema` failure; an unmappable row is counted in `skipped` and dropped |
| Feed parsing | Narrow RSS/Atom parser | A non-feed payload returns a `parse` failure, not an empty success |
| Harness page extraction | Required-field gate per plan | A required field that does not resolve fails the run and writes nothing |
| Domain boundary | Zod schemas in `src/lib/domain/schema.ts` | Types are inferred from the schemas, so runtime and static shapes cannot drift |
| Database boundary | Zod row schemas in `src/lib/db/rows.ts` applied per row | An invalid row is logged with `console.error` and skipped; the rest of the page still renders |
| Repository read | Same row schemas | Same behaviour; a live schema drift surfaces as a log line, not a crash |

## Missing-value policy

| Situation | Behaviour |
| --- | --- |
| A metric the source did not publish | `null` in the domain, `null` in SQL, em dash in the UI |
| A price the extractor could not find | The run fails if the field is required; otherwise the field is `null`. A number is never coerced to `0`. |
| A request allowance the vendor did not document | `estimatedRequests` is `null`, `estimatedRequestsSourceUrl` is `null`, and `documentedRequestEstimatePerDollar` is `null` |
| A derived metric with a missing input | The derived value is `null`; it is never partially computed |
| A template snapshot payload that fails validation | `toModelSnapshot` falls back to an all-null metric set so the snapshot still renders its timestamp |
| A ranking entry with a `null` metric value | `rankBy` drops it rather than ranking it last |
| A zone with no data | An em dash from `src/lib/format/index.ts`, which is the single formatting entry point |

Formatting helpers all return the em dash constant `DASH` for `null`, `undefined` or a
non-finite number. Sub-cent prices keep more precision (`formatUnitPrice` switches to 3 and 4
decimals) and ratios switch representation by magnitude, so a small value is not rounded away.

## Freshness

`computeFreshness()` classifies the age of a value against thresholds:

| State | Condition | Label example |
| --- | --- | --- |
| `fresh` | age <= `freshMinutes` | `12m ago` |
| `aging` | age <= `agingMinutes` | `4h ago` |
| `stale` | beyond `agingMinutes` | `3d ago` |
| `unknown` | Missing or unparseable timestamp | `Never synced` |

Domain thresholds are listed in `docs/01-architecture/data-flow.md`. Unknown values sort last
via `freshnessSortKey`, so ordering by age puts the genuinely old data first and never treats
unknown as newest.

A negative age (a future timestamp) is clamped to zero.

## Idempotency and duplicate prevention

Detailed in `docs/01-architecture/database-schema.md`. In summary: unique keys on
`(source_id, canonical_url)` for news and world items, `(platform, post_id)` for social posts,
`(model_id, captured_at, payload_hash)` for model snapshots,
`(plan_id, captured_at, raw_source_hash)` for plan snapshots, and a partial unique index on
`ingestion_runs.idempotency_key`. A retried run cannot duplicate rows.

Content-level dedupe is separate and happens before writing: canonical URL identity plus a
content hash, with event clustering on top.

## Determinism

Fixtures are deterministic for a given `now`. `tests/integration/repository.test.ts` asserts
that building the fixture bundle twice with the same timestamp produces identical ids,
metrics, payload hashes and content hashes. This is what makes the mock-mode render and any
future E2E suite stable.

Snapshot history is generated from a per-model seed with six fixed offsets, so history is
reproducible while still producing non-trivial drift.

## Integrity checks present in tests

| Check | Where |
| --- | --- |
| Every model references an existing provider | `repository.test.ts` |
| Every snapshot references an existing model | `repository.test.ts` |
| Every harness snapshot references an existing plan | `repository.test.ts` |
| Every model has at least one snapshot | `repository.test.ts` |
| No snapshot predates its model's release date | `repository.test.ts` |
| News is returned newest first, honouring `limit` | `repository.test.ts` |
| No change event is dated in the future | `repository.test.ts` |
| Fixture world summaries pass the neutrality guardrails | `world-neutrality.test.ts` |
| Every metric key in every ranking board is a registered, non-political metric | `world-neutrality.test.ts` |
| Harness extraction configs exist for every pricing source and declare required fields | `adapters.test.ts` |

## Quality gaps, stated plainly

| Gap | Impact |
| --- | --- |
| A quota deferral is classified as a `network` error and then reported as `failed` | A benign deferral looks like a defect in the Sources view (KI-1) |
| A `null` capability is not excluded by the minimum-capability gate | An unknown-capability model is not filtered by an explicit threshold (KI-2) |
| `payloadHash` is documented as sha256 but is a 16-character FNV-1a hash | A reader may assume properties that do not exist (KI-3) |
| Live-ingested news has no entities and no provider ids | Entity chips and provider filters work only in mock mode (KI-4) |
| Live-ingested news categories are `other` or `research` | The category facet is effectively binary outside fixtures (KI-5) |
| `html` news sources have no adapter | Enabled sources that never produce items (KI-6) |
| Monitored social accounts are not seeded in live mode | Social ingestion returns nothing on a fresh database (KI-7) |
| Change events are never written by the runner | Change feeds are empty in live mode (KI-8) |
| Harness products and plans are never seeded by a job | The pricing job has nothing to attach snapshots to on a fresh database (KI-9) |
| Duplicate current state (`models` and the newest snapshot) | The two can diverge; reconciliation is manual |
| No validation-failure counter | A persistent row-validation failure is only a log line |
| No retention policy for model and plan snapshots | Storage grows with capture frequency |
| No source-health alerting | Failures are visible only in the Sources view and `/api/health` |
| Neutrality scan is regex-based and English-only | A floor, not a guarantee |
| Fixture values are plausible by design | The mode banner is the only guard against mistaking them for live data |

## Operating the quality signals

| Signal | Where to look |
| --- | --- |
| Which integrations are configured | `GET /api/health` (`capabilities`, `pendingCredentials`) |
| Last run per source, status, error, rate limit | Sources workspace; `ingestion_runs` table |
| Row validation failures | Server logs, lines prefixed `[supabase] row failed validation in "<table>"` |
| Adapter outcome per source for a manual run | `npm run jobs:run <job>` output (`outcomes[]`) |
| Current mode and degraded reason | The shell banner and `repository.meta` |
