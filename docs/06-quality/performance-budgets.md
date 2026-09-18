# Performance budgets

**These are declared targets, not measured results.** Nothing in this repository has been
profiled, and no Lighthouse run, bundle analysis or query timing is recorded here. Treat the
numbers below as budgets to defend, and measure before believing any of them.

## Targets

| Area | Budget | Rationale |
| --- | --- | --- |
| Initial JS on the Models table route | Keep the client bundle small; no charting or table library is loaded on routes that do not use it | TanStack Table and Recharts are the heaviest dependencies |
| Command palette open latency | Perceived as instant; the index is a plain serialisable array filtered by substring | The index is small by construction |
| Fixture workspace load | Under 100ms of server work in mock mode | Fixtures are built once and memoised per process |
| Live workspace load | Bounded by the number of repository queries per page, not by dataset size | Each loader issues a fixed number of queries |
| Job route duration | Under the `maxDuration = 300` export on `src/app/api/jobs/[job]/route.ts` | Serverless function limit |
| Outbound requests per adapter run | Under the client caps | See "Existing caps" |

Measure with the browser dev tools, `next build` output for route sizes, and the `durationMs` /
`requests` fields in an adapter result or job outcome.

## Design decisions that bound cost

| Decision | Effect |
| --- | --- |
| Fixtures are deterministic and memoised per process | No repeated construction cost across requests |
| Journal index is built once per layout render and passed as data | No client fetch for search |
| Search index includes only the 60 most recent news items | Bounds the serialised payload |
| Snapshot history is capped at 12 per model (`groupSnapshotsByModel`) | Bounds the payload sent to the client |
| News list reads are limited (200 rows by default, 80 for the search index) | Bounds query and payload size |
| Upserts are chunked at 200 rows | Bounds write payload size |
| Artificial Analysis pagination caps at 20 pages of 100 | Bounds one run's request count |
| `HttpClient.maxRequests` defaults to 200 (400 for social) | Hard ceiling per adapter run |
| No client-side chart animation dependency | Recharts only, no additional animation library |
| System font stack | No network font request; no layout shift from a font swap |
| Dense components, minimal chrome | Fewer DOM nodes and fewer images than a card-heavy layout |

## Existing caps and limits

| Limit | Value | Where |
| --- | --- | --- |
| Adapter request cap | 200 (social: 400) | `src/lib/adapters/http.ts` |
| Model pagination | `pageSize` 100, `maxPages` 20 | `src/lib/adapters/artificial-analysis.ts` |
| World pagination | `limit=50` per page, `maxPages` 10 | `src/lib/adapters/world.ts` |
| Social accounts per run | All enabled accounts by default; `maxAccounts` supported | `src/lib/adapters/social.ts` |
| News read limit | 200 (default), 80 for the search index, 12 for the overview world strip | `src/lib/data/supabase-repository.ts`, `src/app/layout.tsx`, `src/lib/data/workspace.ts` |
| Snapshot history per model | 12 | `src/lib/data/workspace.ts` |
| Comparison selection | 8 models | `src/lib/domain/selection.ts` |
| Ranking board size | 10 rows | `src/lib/analytics/index.ts` |
| Ingestion run read | 200 (default), 300 for harness change events | `src/lib/data/supabase-repository.ts` |
| Upsert chunk | 200 rows | `src/lib/ingestion/writer.ts` |
| Job route max duration | 300s | `src/app/api/jobs/[job]/route.ts` |

## Database cost

Every index in `supabase/migrations/20260918000500_indexes_and_rls.sql` exists to keep a read
path cheap. The ones that matter for interactive queries:

| Query pattern | Index |
| --- | --- |
| Ranking boards ordered by intelligence | `models_intelligence_idx` |
| Model table filtered by provider or openness | `models_provider_id_idx`, `models_open_weight_idx` |
| Releases ordering | `models_release_date_idx` |
| Model name search | `models_name_trgm_idx` (GIN, trigram) |
| Snapshot history per model | `model_snapshots_model_captured_idx` |
| News by domain, newest first | `news_items_domain_published_idx` |
| News by provider or entity | `news_items_provider_ids_idx`, `news_items_entities_idx` (GIN) |
| Cluster membership | `news_items_cluster_idx` |
| Plan history | `harness_plan_snapshots_plan_captured_idx` |
| Change feeds | `change_events_observed_idx`, `harness_change_events_observed_idx` |
| World news by region | `world_news_region_published_idx`, `world_news_country_codes_idx` |
| Source health | `ingestion_runs_source_started_idx` |

## Known costs and risks

| Risk | Detail |
| --- | --- |
| No caching layer | Every render reads the repository. With Supabase this is a fixed set of queries per page; there is no ISR, no request-scoped dedupe beyond `Promise.all`, and no cache invalidation strategy |
| Repository query breadth | Loaders request whole tables (for example all models and all snapshots) rather than a filtered projection, so cost grows with dataset size |
| Full snapshots in memory | The Models workspace loads the entire `model_snapshots` table to compute previous metrics, then caps only the serialised per-model history |
| Ingested dataset unbounded | `news_items` and `world_news_items` accumulate; list reads are limited but the tables are not pruned |
| Fixture data is all-or-nothing | Mock mode builds the whole fixture bundle (30 models, 30 news items, 22 world items, 9 harness products) even if a page needs a subset |
| Client-side CSV export | The export builds a string in the browser from an already-serialised dataset; a large dataset would be exported in full |
| Chart rendering | Landscape charts render all usable points per configuration; there is no server-side decimation |
| No bundle analysis configured | There is no `@next/bundle-analyzer` setup, so route sizes are only visible in `next build` output |
| No Lighthouse or Core Web Vitals measurement | No baseline exists for LCP, CLS or INP |
| No performance regression gate | The CI workflow runs the correctness gates only, so a bundle-size regression would pass CI unnoticed; it is visible only by reading the build output |

## Verification steps not yet performed

1. Record a `next build` route-size table as a baseline.
2. Record a Lighthouse run for `/models/table` and `/news` in both themes, on desktop and mobile.
3. Time the mock repository loaders for each workspace.
4. Time each repository query against a seeded database and review the query plans.
5. Confirm the job route stays under its duration cap with real Artificial Analysis pagination.

None of these has been run. With the CI workflow in place, route-size recording is the cheapest
regression guard to add.
