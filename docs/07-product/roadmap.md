# Roadmap

Work that is not done, ordered by dependency and value. Every item is reachable from the code as
it stands; nothing here invents a capability that would need a different architecture.

This roadmap deliberately does not attach dates or versions beyond the current `0.1.0`. Sequencing
matters more than calendar time, and no capacity is known.

## Stage 1 - Make live mode real

The whole product works without credentials. This stage removes that limitation.

| Item | Outcome | Depends on |
| --- | --- | --- |
| Verify the Artificial Analysis mapping against the live API | Field names, pagination and quota behaviour confirmed; adapter corrected if the envelope differs | `ARTIFICIAL_ANALYSIS_API_KEY` |
| Apply the migrations to a Supabase project | Tables, indexes and RLS exist in a real database | Supabase project |
| Generate Supabase types | The hand-shaped client cast is replaced by generated types | Supabase CLI and a linked project |
| Seed harness products and plans | The pricing job has plans to attach snapshots to | A migration or a seeding job |
| Seed monitored social accounts | Social ingestion has accounts to query | Account list |
| Persist change events from diffs | Model and harness change feeds populate in live mode | Existing writer methods |
| Verify harness selectors against live pages | Either confirm `configVersion` `2026.09.1` or fix and bump it | None (manual step) |

Exit criteria: one full ingestion cycle produces model rows, plan snapshots, news items and change
events in a real database, and every credential-dependent capability moves from
`IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` to verified.

## Stage 2 - Close the honesty gaps

These are cases where the product currently under-reports rather than lies, but the gap is visible.

| Item | Outcome |
| --- | --- |
| Fix the quota-guard classification | A deferral is reported as `deferred`, not `failed` (KI-1) |
| Correct the `payloadHash` documentation | The code comment matches the FNV-1a implementation (KI-3) |
| Decide the capability-gate policy for `null` | Either document that unknown capability is retained, or exclude it explicitly (KI-2) |
| Add an `html` news adapter | `anthropic-news` and similar sources produce items instead of `deferred` (KI-6) |
| Populate `providerIds` and `entities` for ingested news | Provider filtering and entity chips work outside mock mode (KI-4) |
| Derive news categories from content | The category facet becomes meaningful in live mode (KI-5) |
| Implement raw payload capture and retention | Parser breakage is diagnosable from a stored payload, with a bounded retention window |
| Surface validation failures | A counter in the Sources workspace instead of log lines only |
| Remove or use dead exports | `previousSnapshot`, `signingKeysConfigured` |

Exit criteria: no entry in `docs/03-implementation/current/known-issues.md` describes a state the
product reports incorrectly.

## Stage 3 - Engineering rigour

| Item | Outcome |
| --- | --- |
| Component tests | Testing Library actually used, or removed |
| Accessibility automation | axe scans in E2E, failing on serious and critical violations |
| Structured logging | JSON log lines honouring `LOG_LEVEL`, with one line per source outcome |
| Route-size baseline | `next build` output recorded and compared in CI |
| Stale-source alerting | A scheduled report or alert on sources beyond their aging window |

Done since this roadmap was written: the CI workflow (`.github/workflows/ci.yml`) and the
Playwright E2E suite (`tests/e2e/**`) from this stage now exist.

Exit criteria: a broken change cannot be pushed without a failing check, and source health is
observable without a human looking.

## Stage 4 - Product depth

| Item | Outcome |
| --- | --- |
| LLM summaries behind a key | Structured, attributed, optional summaries with a graceful fallback to the excerpt |
| Benchmark-level ingestion | `benchmark_definitions` and `model_benchmark_values` are used, enabling per-benchmark weighting |
| Watchlists in Supabase for authenticated users | The owner-scoped RLS policies are finally used |
| Notifications | Alerts or a digest for model releases, price changes, plan changes and stale sources |
| Harness CSV export | The plan board matches the model table |
| Cross-domain search | One query over AI news and world news, with the domains still separated in the schema |
| Per-source "retry now" control | Operate a single source without waiting for the cron |

Exit criteria: the product answers a question nobody could answer by reading the sources manually,
without weakening any of the separation guarantees.

## Stage 5 - Scale, if it is ever needed

Only if dataset growth or ingestion load makes the monolith insufficient.

| Item | Trigger |
| --- | --- |
| Request-scoped and then revalidated caching | Page latency grows with dataset size |
| Snapshot partitioning or retention | `model_snapshots` and `harness_plan_snapshots` grow materially |
| Extraction of the ingestion runner into a worker | A job approaches the function duration cap, or ingestion contends with page rendering |
| Read projections for the heavy pages | Loading whole tables stops being acceptable |

ADR-0001 records that the module boundaries exist precisely so this extraction is mechanical rather
than a rewrite.

## Deliberately off the roadmap

| Not planned | Why |
| --- | --- |
| Scraping Artificial Analysis | Policy decision, ADR-0003 |
| Scraping X/Twitter HTML | Policy decision, and the authorized API path exists |
| Political sentiment or ideology scoring | Policy decision, ADR-0006 |
| Candidate or party recommendations | Policy decision |
| A universal composite model score | The product deliberately exposes four explicit modes instead |
| Hard-coded model names for the default set | The default set is resolved from metadata (ADR-0002) |

## Related

- Backlog with file-level detail: `docs/03-implementation/current/backlog.md`
- Status: `docs/00-overview/project-status.md`
- Ideas that are not yet work: `docs/07-product/future-ideas.md`
