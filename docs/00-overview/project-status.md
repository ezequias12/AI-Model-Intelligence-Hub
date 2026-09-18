# Project status

Status of **AI Model Intelligence Hub** as reflected by the code in this repository.

This file is the honest checklist. Nothing here is aspirational. If something is not
built, it is listed under "Not implemented" with the reason.

Evidence for each claim is a file path you can read. No test result, benchmark,
coverage figure or live-response sample is claimed anywhere in this document: run
`npm run check` to produce results on your machine.

Last documentation update: 2026-09-18 (live-mode completion phase: Artificial Analysis verified
against the live API, harness and social seeds added, change events wired, axe audit added).

## Status markers

| Marker | Meaning |
| --- | --- |
| `IMPLEMENTED` | Code exists, is reachable from the running app or a job, and is covered by at least one test or is exercised by the default mock-mode page render. |
| `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | The real integration boundary (adapter, writer, verification) exists and is tested with stubs or fixtures, but it has never executed against the live third-party service from this repository. The required environment variable is named. |
| `PARTIAL` | Some of the capability exists; the missing part is stated. |
| `NOT IMPLEMENTED` | No code exists for this. |

## 1. Core product (no credentials required)

| Capability | Status | Evidence |
| --- | --- | --- |
| App shell, left rail, workspace sub-navigation, mobile tabs | `IMPLEMENTED` | `src/components/shell/app-shell.tsx`, `src/lib/nav.ts` |
| Command palette search over pages, models, providers, plans, sources, news | `IMPLEMENTED` | `src/lib/search/index.ts`, `src/components/shell/command-palette.tsx` |
| Dark mode with pre-hydration init script | `IMPLEMENTED` | `src/components/shell/theme.tsx` |
| Data-mode banner and freshness indicator | `IMPLEMENTED` | `src/app/layout.tsx`, `src/components/ui/primitives.tsx`, `src/lib/domain/freshness.ts` |
| Overview workspace with six deep-linking blocks | `IMPLEMENTED` | `src/app/page.tsx`, `src/features/overview/overview-blocks.tsx` |
| Models dashboard with eight metric leader cards | `IMPLEMENTED` | `src/features/models/dashboard-view.tsx`, `src/lib/analytics/index.ts` |
| Eleven ranking boards | `IMPLEMENTED` | `src/lib/analytics/index.ts` (`RANKING_BOARDS`), `src/features/models/ranking-boards.tsx` |
| Configurable landscape charts with Pareto frontier | `IMPLEMENTED` | `src/features/models/landscape-charts.tsx`, `src/lib/domain/metrics.ts` |
| Dense model table with sorting, column selection, pinning, CSV export | `IMPLEMENTED` | `src/features/models/model-table.tsx` |
| Model detail route with snapshot history and change events | `IMPLEMENTED` | `src/app/models/[slug]/page.tsx`, `src/features/models/model-detail.tsx`, `src/features/models/model-history-chart.tsx` |
| Releases view combining releases, deprecations and change events | `IMPLEMENTED` | `src/features/models/releases-view.tsx`, `src/lib/analytics/index.ts` |
| Selected-model tray with URL + local-storage persistence | `IMPLEMENTED` | `src/features/models/selection-tray.tsx`, `src/features/models/workspace-context.tsx` |
| Dynamic default comparison set (no hard-coded model names) | `IMPLEMENTED` | `src/lib/domain/selection.ts` (`DEFAULT_SLOTS`, `resolveDefaultSelection`) |
| Eight selection presets | `IMPLEMENTED` | `src/lib/domain/selection.ts` (`applyPreset`) |
| Provider-group filters (All, Mainstream, China-based, Open-weight, Closed, Custom) | `IMPLEMENTED` | `src/lib/domain/selection.ts` (`applyProviderScope`) |
| Compare workspace with models mode and harness-plan mode | `IMPLEMENTED` | `src/features/compare/compare-view.tsx` |
| News overview, AI General, Providers, Social Pulse, Research tabs | `IMPLEMENTED` | `src/app/news/**`, `src/features/news/**` |
| News search and saved searches (local storage) | `IMPLEMENTED` | `src/features/news/news-search.tsx` |
| Cross-source news clustering | `IMPLEMENTED` | `src/lib/domain/hash.ts` (`clusterNewsItems`), `src/lib/data/workspace.ts` |
| Harness overview, plans, compare, cheapest, changes, news, calculator | `IMPLEMENTED` | `src/app/harness/**`, `src/features/harness/**` |
| Cheapest views that expose a formula per category | `IMPLEMENTED` | `src/lib/domain/harness-metrics.ts` (`buildCheapestViews`) |
| Budget calculator with transparent fit scoring | `IMPLEMENTED` | `src/lib/domain/harness-metrics.ts` (`recommendPlans`), `src/features/harness/calculator.tsx` |
| World & Politics workspace with nine tabs | `IMPLEMENTED` | `src/app/world/page.tsx`, `src/features/world/world-feed.tsx`, `src/lib/domain/world.ts` |
| Neutrality guardrails (forbidden-pattern scan, attribution-first summaries) | `IMPLEMENTED` | `src/lib/domain/world.ts`; asserted in `tests/unit/world-neutrality.test.ts` |
| Watchlists over models, providers, harness products, topics, queries | `IMPLEMENTED` | `src/features/watchlists/watchlist-manager.tsx` |
| Sources workspace with registry, freshness, rate limits, run history | `IMPLEMENTED` | `src/features/sources/source-registry.tsx` |
| Methodology workspace driven by the metric registry | `IMPLEMENTED` | `src/features/methodology/methodology-content.tsx`, `src/lib/analytics/metric-registry.ts` |
| Mock data mode (default) | `IMPLEMENTED` | `src/lib/data/mode.ts`, `src/lib/data/mock-repository.ts`, `src/lib/fixtures/**` |
| Degraded live mode surfaced rather than hidden | `IMPLEMENTED` | `src/lib/data/index.ts` (`createDegradedRepository`), `src/components/ui/primitives.tsx` |
| Playwright end-to-end specs | `IMPLEMENTED` | `tests/e2e/**` (shell, models, news, harness, world/system, accessibility fundamentals, axe audit), `playwright.config.ts` (desktop and mobile projects) |
| Automated WCAG audit with axe | `IMPLEMENTED` | `tests/e2e/axe.spec.ts`, `@axe-core/playwright` |
| CI workflow | `IMPLEMENTED` | `.github/workflows/ci.yml` (`quality` and `e2e` jobs) |

## 2. Implemented integration boundaries - live verification pending credentials

| Capability | Status | Required variable(s) | What exists | What cannot be verified yet |
| --- | --- | --- | --- | --- |
| Artificial Analysis model metrics | `IMPLEMENTED - LIVE-VERIFIED 2026-09-18 (persistence pending)` | `ARTIFICIAL_ANALYSIS_API_KEY` (optional `ARTIFICIAL_ANALYSIS_BASE_URL`) | Typed adapter, quota guard, 429/`Retry-After` handling, mapping to domain models, contract test built on a captured real response | Reading the live API and mapping it is verified. Writing the result to Supabase is not. The free API exposes no context window, open-weights flag, deprecation date, cache prices or agentic index, so those stay `null`/`false` live. |
| Supabase persistence and live reads | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase repository, Zod row validation, idempotent writer with chunked upserts, six migrations | Migrations never applied here; RLS never exercised against a live project |
| QStash schedules | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | `QSTASH_TOKEN`, `QSTASH_TARGET_BASE_URL` | `scripts/jobs/create-schedules.mjs` creates/deletes schedules idempotently for all seven jobs | No schedule was ever created |
| QStash signature verification | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | `src/lib/jobs/verify.ts` uses the Upstash `Receiver`; the job route rejects unverified requests in live mode | No real Upstash signature has been verified |
| Social / X ingestion | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | `X_BEARER_TOKEN` | Adapter against the documented X API v2 shape, monitored-account registry, entity extraction, contract tests | No authorized API call has been made; the source stays disabled |
| World and political news | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | `WORLD_NEWS_API_KEY`, `WORLD_NEWS_BASE_URL` | Separate adapter group with a neutrality gate, cursor pagination, contract tests | No licensed provider has been called; the source stays disabled |
| Harness pricing-page extraction | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | None (public pages) | Versioned selector configs for seven pricing pages, required-field failure, raw source hashing, unit tests against fixtures | Selector patterns have not been verified against the current live pages |
| LLM news summaries | `NOT IMPLEMENTED` (see section 4) | `LLM_SUMMARY_API_KEY` | Only capability reporting in `src/lib/data/mode.ts` | No summariser client exists; `NewsItem.summary` is always `null` |

## 3. Data platform

| Capability | Status | Evidence |
| --- | --- | --- |
| Repository contract with interchangeable implementations | `IMPLEMENTED` | `src/lib/data/repository.ts`, `src/lib/data/mock-repository.ts`, `src/lib/data/supabase-repository.ts` |
| Deterministic fixtures for every entity | `IMPLEMENTED` | `src/lib/fixtures/**`; determinism asserted in `tests/integration/repository.test.ts` |
| Snapshot history with change-event derivation | `IMPLEMENTED` | `src/lib/fixtures/snapshots.ts`, `src/lib/domain/diff.ts`, `src/lib/fixtures/index.ts` |
| Seven registered ingestion jobs with one runner | `IMPLEMENTED` | `src/lib/jobs/registry.ts`, `src/lib/ingestion/runner.ts` |
| Adapter result envelope, rate-limit capture, exponential backoff | `IMPLEMENTED` | `src/lib/adapters/types.ts`, `src/lib/adapters/http.ts` |
| Ingestion-run ledger and idempotency keys | `IMPLEMENTED` | `src/lib/ingestion/runner.ts` (`recordRun`), `supabase/migrations/20260918000300_sources_and_ingestion.sql` |
| Source registry as data, seeded by migration | `IMPLEMENTED` | `src/lib/fixtures/sources.ts`, `supabase/migrations/20260918000600_seed_source_registry.sql` |
| Harness catalogue seed (products and plans) | `IMPLEMENTED` | `supabase/migrations/20260918000700_seed_harness_catalog.sql` |
| Monitored social account seed | `IMPLEMENTED` | `supabase/migrations/20260918000800_seed_monitored_social_accounts.sql` |
| Change-event persistence from snapshot diffs | `IMPLEMENTED` | `src/lib/ingestion/change-events.ts`, `src/lib/ingestion/runner.ts` |
| Row-level security on every public table | `IMPLEMENTED` | `supabase/migrations/20260918000500_indexes_and_rls.sql` |
| Private schema for operational data | `IMPLEMENTED` (schema and table only) | `20260918000100_init_schema.sql`, `20260918000300_sources_and_ingestion.sql` |
| Benchmark tables (`benchmark_definitions`, `model_benchmark_values`) | `PARTIAL` | Tables exist in SQL; no application code reads or writes them |
| Raw ingestion payload capture | `NOT IMPLEMENTED` | Table and retention index exist; nothing writes to `private.raw_ingestion_payloads` |
| Raw payload retention cleanup | `NOT IMPLEMENTED` | `runMaintenance()` in `src/lib/ingestion/runner.ts` returns a message; it deletes nothing |

## 4. Not implemented

| Item | Reason / note |
| --- | --- |
| LLM summarisation of news | No client exists. `LLM_SUMMARY_API_KEY` is reported as a capability only. The UI degrades to the source excerpt, and `feedToNewsItems` writes `summary: null`. |
| Application authentication | No auth provider, no login route, no session handling. |
| Supabase-backed watchlists | Local storage only, behind a `WatchlistStore` interface intended for replacement. |
| Notifications, alerts or digests | No email, webhook or push channel. |
| Harness CSV export | CSV export exists only in the model table. |
| Per-user saved dashboards | Presets and selection persist per browser. |
| Security headers / CSP | `next.config.ts` sets no custom headers. |
| Rate limiting on app routes | Not present. |
| Dependency or container scanning | Not present. |

## 5. Checks

| Command | Exists | Note |
| --- | --- | --- |
| `npm run format:check` | Yes | Prettier check over the repository |
| `npm run lint` | Yes | `next lint` over `src` and `tests` |
| `npm run typecheck` | Yes | `tsc --noEmit` with strict mode |
| `npm run test` | Yes | Vitest unit + integration |
| `npm run build` | Yes | Production Next.js build |
| `npm run check` | Yes | Chains the five above |
| `npm run test:e2e` | Yes | Playwright smoke suite over `tests/e2e`, desktop and mobile projects |
| `npm run db:gen-types` | Yes | Requires the Supabase CLI and a linked project |

The CI workflow (`.github/workflows/ci.yml`) runs these stages: a `quality` job
(`npm ci --include=dev`, `format:check`, `lint`, `typecheck`, `test`, `build`) and an
`e2e` job (`npm run test:e2e`). No CI run has been executed yet. The same stages pass
locally when last run; run `npm run check` and `npm run test:e2e` yourself and read the
output. No result is claimed here.

## 6. What the owner must do next

1. Apply all eight migrations to a Supabase project (see
   `docs/05-operations/supabase-setup.md`) and run `npm run db:gen-types`.
2. Set the remaining values listed in section 2 in `.env.local`, then switch
   `NEXT_PUBLIC_DATA_MODE=live`.
3. Load live data: `npm run jobs:run sync-models` populates providers, models,
   snapshots and change events. Provider grouping is still not curated for live
   providers (known issue KI-19).
4. Verify the harness pricing selectors against the current pages; fix the
   configuration version in `src/lib/ingestion/harness-configs.ts` when a pattern
   changes.
5. Configure `X_BEARER_TOKEN` and enable the `x-monitored-accounts` source to run
   social ingestion; the accounts to monitor are already seeded.
6. Create the QStash schedules once the deployment URL exists.
7. Choose a license and replace `LICENSE`.
