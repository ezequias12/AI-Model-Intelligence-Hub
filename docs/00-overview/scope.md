# Scope

## In scope for this repository

| Area | Included |
| --- | --- |
| Product shell | Workspace navigation, sub-navigation, command palette, freshness indicator, data-mode banner, dark mode, mobile tabs |
| Models workspace | Metric leaders, ranking boards, cost-efficiency modes, landscape charts, dense table with CSV export, model detail, release history |
| Model selection | Dynamic defaults, presets, provider grouping, selection tray, URL and local-storage persistence |
| Derived analytics | Blended price, monthly workload cost, four value-score modes, Pareto frontier, ranking with tie handling, snapshot diffs |
| News workspace | Domain tabs, search, saved searches, cross-source clustering, trust tiers, official badge |
| Social | Monitored-account registry, adapter contract against the X API v2 shape, entity extraction |
| Harness Watch | Products, plans, snapshots, change feed, cheapest views with formulas, plan comparison, budget calculator |
| World & Politics | Region tabs, attribution-first summaries, contested-story flags, neutrality guardrails enforced in code |
| Compare | Model mode and harness-plan mode, never mixed in one schema |
| Watchlists | Local persistence over models, providers, harness products, topics and news queries |
| Sources | Registry view with adapter status, freshness, rate-limit state and ingestion-run history |
| Methodology | Metric catalogue, formulas, thresholds and stated limitations |
| Data layer | Repository contract, deterministic mock implementation, Supabase implementation with per-row validation |
| Ingestion | Seven registered jobs, one runner, idempotent writer, ingestion ledger, adapter envelope |
| Storage | Six migrations: schemas/helpers, core model tables, sources/ingestion, news/social/harness/world, indexes/RLS, seeded sources |
| Tests | Unit and integration suites over domain logic, analytics, adapters and the repository, plus Playwright end-to-end specs over the main journeys |
| CI | GitHub Actions workflow (`.github/workflows/ci.yml`): a `quality` job (frozen install, format check, lint, typecheck, unit/integration tests, build) and an `e2e` job (Playwright smoke suite) |
| Documentation | This `docs/` set plus root README, AGENTS, CONTRIBUTING, SECURITY, CHANGELOG, LICENSE placeholder |

## Out of scope

| Excluded | Reason |
| --- | --- |
| Application user authentication | No auth provider is wired. Access control is expected to come from deployment-level protection. |
| Multi-tenant or team workspaces | Single-audience internal tool. |
| Writing or editing source content in the UI | Sources are authoritative; the UI is read-only. |
| Scraping X/Twitter HTML | Policy: authorized APIs only. |
| Scraping Artificial Analysis | Policy: official API only, respecting quota. |
| Mirroring full articles | Legal and ethical: excerpts and links only. |
| Political analysis, forecasting or scoring | Policy: descriptive and attributed only. |
| Paid, destructive or irreversible account operations | Requires explicit owner authorization. |

## Deferred, with the reason recorded

| Deferred item | Status | Note |
| --- | --- | --- |
| Accessibility automation (axe) | NOT IMPLEMENTED | No axe dependency is installed. Structural accessibility assertions live in `tests/e2e/accessibility.spec.ts`; a manual review checklist exists in `docs/06-quality/accessibility.md`. |
| LLM-generated news summaries | NOT IMPLEMENTED | `LLM_SUMMARY_API_KEY` is only reported as a capability. No summariser client exists; `NewsItem.summary` is always `null`. |
| Raw payload capture and retention deletion | NOT IMPLEMENTED | The `private.raw_ingestion_payloads` table and its retention index exist, but no code writes to it and no deletion job performs the cleanup. |
| Supabase-backed user preferences | NOT IMPLEMENTED | Watchlists use local storage behind a narrow `WatchlistStore` interface designed for later replacement. |
| Benchmark definition tables in use | PARTIAL | `benchmark_definitions` and `model_benchmark_values` exist in SQL, but no application code reads or writes them. |
| News entity persistence | PARTIAL | `news_entities` exists in SQL; entities are stored as a text array on `news_items`, and no rows are written to `news_entities`. |
| Harness product/plan seeding through the writer | PARTIAL | `writeHarnessProducts` and `writeHarnessPlans` exist, but no job populates those tables; the pricing job only writes snapshots for plans that already exist. |
| Notifications, digests or alerts | NOT IMPLEMENTED | No email, webhook or push channel. |
| Harness CSV export | NOT IMPLEMENTED | CSV export exists only in the model table. |
| Per-user saved dashboards | NOT IMPLEMENTED | Presets and selection persist per browser, not per account. |
