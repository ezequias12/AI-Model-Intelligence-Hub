# Implementation status

Feature-by-feature status of the implementation in this repository. This is the
engineering view; `docs/00-overview/project-status.md` is the product-owner view. Both
are honest about gaps.

Evidence is a file path you can read. No test result, coverage figure or live-response
sample is claimed here.

## Legend

| Marker | Meaning |
| --- | --- |
| `IMPLEMENTED` | Code exists, is reachable, and has test coverage or is exercised by the default mock-mode render |
| `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | The integration boundary exists and is tested with stubs or fixtures, but has never executed against the live third-party service from this repository |
| `PARTIAL` | Some of the capability exists; the missing part is named |
| `NOT IMPLEMENTED` | No code exists |

## Application shell and navigation

| Item | Status | Evidence |
| --- | --- | --- |
| Shell with four-section left rail | `IMPLEMENTED` | `src/lib/nav.ts`, `src/components/shell/app-shell.tsx` |
| Workspace sub-navigation for Models, News, Harness | `IMPLEMENTED` | `src/lib/nav.ts` (`WORKSPACES`), `src/features/models/views.tsx` |
| Mobile tabs | `IMPLEMENTED` | `src/lib/nav.ts` (`MOBILE_TABS`) |
| Command palette search | `IMPLEMENTED` | `src/lib/search/index.ts`, `src/components/shell/command-palette.tsx` |
| Dark mode with pre-hydration script | `IMPLEMENTED` | `src/components/shell/theme.tsx` |
| Freshness indicator | `IMPLEMENTED` | `src/app/layout.tsx`, `src/lib/domain/freshness.ts` |
| Data-mode banner (mock and degraded) | `IMPLEMENTED` | `src/components/ui/primitives.tsx`, `src/lib/data/mode.ts` |
| UI component primitives | `IMPLEMENTED` | `src/components/ui/{card,badge,button,input,overlay,primitives}.tsx` |

## Models workspace

| Item | Status | Evidence |
| --- | --- | --- |
| Dashboard with eight metric leader cards | `IMPLEMENTED` | `src/features/models/metric-leaders.tsx`, `computeLeaderCards` |
| Eleven ranking boards | `IMPLEMENTED` | `computeRankings`, `RANKING_BOARDS` |
| Selected / all scope toggle and provider scope per board | `IMPLEMENTED` | `RankingOptions` in `src/lib/analytics/index.ts` |
| Minimum capability threshold that excludes cheap-but-weak models | `IMPLEMENTED` | `computeRankings`; asserted in `tests/unit/analytics.test.ts` |
| Landscape charts with configurable X, Y and bubble metrics | `IMPLEMENTED` | `src/features/models/landscape-charts.tsx`, `computeLandscapeChart` |
| Pareto frontier toggle and rule description | `IMPLEMENTED` | `src/lib/domain/metrics.ts`, `paretoFrontier` |
| Dense table with sorting, filters, column selection, pinning | `IMPLEMENTED` | `src/features/models/model-table.tsx` |
| CSV export | `IMPLEMENTED` | `model-table.tsx` (Blob download, `ai-model-intelligence-hub-models.csv`) |
| Model detail route | `IMPLEMENTED` | `src/app/models/[slug]/page.tsx` |
| Snapshot history table and history chart | `IMPLEMENTED` | `src/features/models/model-detail-sections.tsx`, `model-history-chart.tsx` |
| Releases view (releases, deprecations, change events) | `IMPLEMENTED` | `src/features/models/releases-view.tsx`, `computeReleases` |
| Selection tray with add/remove/preset/reset | `IMPLEMENTED` | `src/features/models/selection-tray.tsx`, `model-selector.tsx` |
| URL and local-storage persistence | `IMPLEMENTED` | `src/features/models/workspace-context.tsx` |
| Related models and related news on the detail view | `IMPLEMENTED` | `src/features/models/model-detail-sections.tsx` |
| Server-side per-column export beyond CSV | `NOT IMPLEMENTED` | Only CSV from the client is available |

## Data modes and repositories

| Item | Status | Evidence |
| --- | --- | --- |
| Mock repository over deterministic fixtures | `IMPLEMENTED` | `src/lib/data/mock-repository.ts`, `src/lib/fixtures/**` |
| Supabase repository with per-row Zod validation | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | `src/lib/data/supabase-repository.ts`, `src/lib/db/{rows,mappers}.ts` |
| Degraded live mode with a visible reason | `IMPLEMENTED` | `src/lib/data/index.ts` |
| Repository caching per process | `IMPLEMENTED` | `src/lib/data/index.ts` (`cached`) |
| Capability reporting | `IMPLEMENTED` | `src/lib/data/mode.ts` (`describeCapabilities`) |

## Ingestion

| Item | Status | Evidence |
| --- | --- | --- |
| Seven registered jobs with cron and domains | `IMPLEMENTED` | `src/lib/jobs/registry.ts` |
| One runner for any job key | `IMPLEMENTED` | `src/lib/ingestion/runner.ts` |
| Disabled sources reported as `disabled` | `IMPLEMENTED` | `runJob`; asserted in `adapters-contract.test.ts` |
| Mock mode / dry run reported as `deferred` | `IMPLEMENTED` | `runJob`; asserted in `adapters-contract.test.ts` |
| Idempotent chunked upserts | `IMPLEMENTED` | `src/lib/ingestion/writer.ts` |
| Ingestion-run ledger with idempotency key | `IMPLEMENTED` | `recordRun` in `runner.ts` |
| QStash signature verification | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | `src/lib/jobs/verify.ts` |
| Job HTTP endpoint with per-source outcomes | `IMPLEMENTED` | `src/app/api/jobs/[job]/route.ts` |
| Schedule creation script | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` | `scripts/jobs/create-schedules.mjs` |
| Local job runner | `IMPLEMENTED` | `scripts/jobs/run-local.mjs` |
| Harness product / plan catalogue seed | `IMPLEMENTED` | `supabase/migrations/20260918000700_seed_harness_catalog.sql` |
| Monitored social account seed | `IMPLEMENTED` | `supabase/migrations/20260918000800_seed_monitored_social_accounts.sql` |
| Change-event persistence from diffs | `IMPLEMENTED` | `src/lib/ingestion/change-events.ts`; the runner writes model and harness change events after each sync |
| Raw payload capture | `NOT IMPLEMENTED` | Nothing writes to `private.raw_ingestion_payloads` |
| Raw payload retention cleanup | `NOT IMPLEMENTED` | `runMaintenance()` returns a message and deletes nothing |
| Distributed locking between concurrent runs | `NOT IMPLEMENTED` | Idempotency is key-based only |

## Adapters

| Adapter | Status | Evidence |
| --- | --- | --- |
| Shared result envelope and error codes | `IMPLEMENTED` | `src/lib/adapters/types.ts` |
| HTTP client: quota guard, `Retry-After`, backoff, header capture | `IMPLEMENTED` | `src/lib/adapters/http.ts`; `tests/unit/adapters.test.ts` |
| Artificial Analysis Data API | `IMPLEMENTED - LIVE-VERIFIED 2026-09-18 (persistence pending)` (`ARTIFICIAL_ANALYSIS_API_KEY`) | `src/lib/adapters/artificial-analysis.ts` |
| RSS 2.0 and Atom parser | `IMPLEMENTED` | `src/lib/adapters/rss.ts` |
| Harness pricing-page extractor | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` (selectors unverified against live pages) | `src/lib/adapters/harness-html.ts`, `src/lib/ingestion/harness-configs.ts` |
| Social / X API contract | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` (`X_BEARER_TOKEN`) | `src/lib/adapters/social.ts` |
| World news provider | `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` (`WORLD_NEWS_API_KEY`, `WORLD_NEWS_BASE_URL`) | `src/lib/adapters/world.ts` |
| Text and hashing helpers | `IMPLEMENTED` | `src/lib/adapters/text-utils.ts` |
| Dedicated HTML-news-index adapter (for `type: "html"` news sources) | `NOT IMPLEMENTED` | No adapter is registered for `html` news sources; they are reported as `deferred` |
| LLM summariser client | `NOT IMPLEMENTED` | No module exists; `NewsItem.summary` is always `null` from ingestion |

## Domain logic

| Item | Status | Evidence | Tests |
| --- | --- | --- | --- |
| Blended price with configurable weights | `IMPLEMENTED` | `src/lib/domain/metrics.ts` | `tests/unit/metrics.test.ts` |
| Monthly workload cost with cache accounting | `IMPLEMENTED` | `metrics.ts` | `metrics.test.ts` |
| Four value-score modes | `IMPLEMENTED` | `metrics.ts` (`valueScore`) | `metrics.test.ts` |
| Pareto frontier | `IMPLEMENTED` | `metrics.ts` | `metrics.test.ts` |
| Ranking with tie handling and null dropping | `IMPLEMENTED` | `metrics.ts` (`rankBy`) | `metrics.test.ts` |
| Stable hash, payload hash, URL canonicalization | `IMPLEMENTED` | `src/lib/domain/hash.ts` | `tests/unit/hash.test.ts` |
| News content hash and clustering | `IMPLEMENTED` | `hash.ts` (`newsContentHash`, `clusterNewsItems`) | `hash.test.ts` |
| Snapshot diffing and change description | `IMPLEMENTED` | `src/lib/domain/diff.ts` | `tests/unit/diff-and-freshness.test.ts` |
| Array delta for model add/remove | `IMPLEMENTED` | `diff.ts` | `diff-and-freshness.test.ts` |
| Freshness states and domain thresholds | `IMPLEMENTED` | `src/lib/domain/freshness.ts` | `diff-and-freshness.test.ts` |
| Harness derived metrics | `IMPLEMENTED` | `src/lib/domain/harness-metrics.ts` | `tests/unit/harness-metrics.test.ts` |
| Cheapest views with formulas | `IMPLEMENTED` | `harness-metrics.ts` | `harness-metrics.test.ts` |
| Plan comparison rows | `IMPLEMENTED` | `harness-metrics.ts` | `harness-metrics.test.ts` |
| Budget calculator | `IMPLEMENTED` | `harness-metrics.ts` (`recommendPlans`) | `harness-metrics.test.ts` |
| Default selection resolution | `IMPLEMENTED` | `src/lib/domain/selection.ts` | `tests/unit/selection.test.ts` |
| Presets and provider scope | `IMPLEMENTED` | `selection.ts` | `selection.test.ts` |
| World neutrality guardrails | `IMPLEMENTED` | `src/lib/domain/world.ts` | `tests/unit/world-neutrality.test.ts` |

## Analytics

| Item | Status | Evidence |
| --- | --- | --- |
| Metric registry with direction, provenance, unit, format | `IMPLEMENTED` | `src/lib/analytics/metric-registry.ts` |
| Metric leaders | `IMPLEMENTED` | `src/lib/analytics/index.ts` |
| Ranking boards with excluded counts surfaced | `IMPLEMENTED` | `index.ts` |
| Landscape chart assembly with provider colours | `IMPLEMENTED` | `index.ts` |
| Release and change rows | `IMPLEMENTED` | `index.ts` |
| Exported metric catalogue for the Methodology page | `IMPLEMENTED` | `metric-registry.ts` (`metricCatalog`) |

## Workspaces

| Workspace | Status | Note |
| --- | --- | --- |
| Overview | `IMPLEMENTED` | Six blocks, every block deep-links into its workspace |
| Models | `IMPLEMENTED` | Five sub-routes plus detail |
| Compare | `IMPLEMENTED` | Two modes: models and harness plans, never mixed |
| News | `IMPLEMENTED` | Five tabs, search, saved searches |
| Harness Watch | `IMPLEMENTED` | Seven sub-routes including the calculator |
| World & Politics | `IMPLEMENTED` | Nine tabs |
| Watchlists | `PARTIAL` | Full UI over local storage; no server-side persistence (no auth exists) |
| Sources | `IMPLEMENTED` | Registry, adapter status, freshness, rate limits, run history |
| Methodology | `IMPLEMENTED` | Metric catalogue, formulas, thresholds, stated limitations |

## Testing

| Suite | Status | Files |
| --- | --- | --- |
| Unit | `IMPLEMENTED` | `tests/unit/{metrics,selection,hash,diff-and-freshness,harness-metrics,analytics,adapters,world-neutrality}.test.ts` |
| Integration | `IMPLEMENTED` | `tests/integration/{adapters-contract,repository}.test.ts` |
| Component / DOM | `NOT IMPLEMENTED` | Testing Library is installed but no component tests exist |
| End-to-end | `IMPLEMENTED` | `tests/e2e/{shell,models,news,harness,world-and-system,accessibility}.spec.ts`, `playwright.config.ts` (desktop and mobile) |
| Accessibility automation | `IMPLEMENTED` | `tests/e2e/accessibility.spec.ts` (structural assertions) plus `tests/e2e/axe.spec.ts` (`@axe-core/playwright`, a serious/critical gate over fourteen routes in both viewports) |
| CI | `IMPLEMENTED` | `.github/workflows/ci.yml` (`quality` and `e2e` jobs) |

Details, including what each file covers, are in `docs/06-quality/testing-strategy.md`.

## Repository hygiene

| Item | Status | Note |
| --- | --- | --- |
| `README.md` | `IMPLEMENTED` | |
| `AGENTS.md` | `IMPLEMENTED` | |
| `CONTRIBUTING.md` | `IMPLEMENTED` | |
| `SECURITY.md` | `IMPLEMENTED` | |
| `CHANGELOG.md` | `IMPLEMENTED` | One `0.1.0` entry dated 2026-09-18 |
| `LICENSE` | `PARTIAL` | Placeholder only; the owner must choose a license |
| `.env.example` | `IMPLEMENTED` | Names and comments only, no values |
| Documentation set | `IMPLEMENTED` | `docs/**` |
| Git history | `PARTIAL` | One commit (`a659239`); the live-mode completion changes are uncommitted |
