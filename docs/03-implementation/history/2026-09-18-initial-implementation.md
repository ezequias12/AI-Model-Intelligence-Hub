# 2026-09-18 - Initial implementation

Phase record for the first implementation pass of AI Model Intelligence Hub, produced from
the product package (`START_HERE.md`, `MASTER_AGENT_PROMPT.md`,
`PRODUCT_INFORMATION_ARCHITECTURE.md`, `UI_UX_SPECIFICATION.md`,
`NEWS_AND_HARNESS_SPECIFICATION.md`, `DATA_SOURCES_AND_PIPELINES.md`,
`REPOSITORY_AND_DOCUMENTATION_STANDARD.md`, `SEED_SOURCE_REGISTRY.json`).

## What changed

Everything. This phase created the entire application:

- **Application shell.** Left rail with four sections (Core, Intelligence, Personal,
  System), workspace sub-navigation, command palette search, freshness indicator, data-mode
  banner, dark mode with a pre-hydration init script, mobile tabs.
- **Models workspace.** Dashboard with eight metric leader cards, eleven Top 10 boards a
  configurable landscape view with a Pareto frontier, a dense table with sorting, column
  selection, pinning and CSV export, a releases view, a per-model detail route with snapshot
  history and a history chart.
- **Model selection.** Dynamic default comparison set, eight presets, provider-group filters,
  a persistent selection tray, `?models=` URL state plus local-storage persistence, and
  defined behaviour for unknown or duplicated ids.
- **Domain logic.** Zod schemas for every entity; blended price; monthly workload cost with
  cache accounting; four value-score modes; Pareto frontier; ranking with ties; statistics
  helpers; stable hashing and URL canonicalization; news content hash and clustering;
  snapshot diffing; freshness states and domain thresholds; world-politics neutrality
  guardrails.
- **Analytics.** One metric registry declaring direction, provenance, unit, description,
  accessor and formatter per metric, plus assembly functions for leaders, boards, charts and
  release rows.
- **Adapters.** Artificial Analysis Data API (typed, paginated, quota-aware), RSS 2.0 / Atom
  parser, controlled harness pricing-page extractor with a required-field gate, X API v2
  social contract, and a world news adapter with a neutrality gate. All share one result
  envelope, and all outbound HTTP goes through one client.
- **Data layer.** Repository contract; deterministic fixture-backed mock implementation;
  Supabase implementation with per-row Zod validation; workspace loaders for Models, Harness,
  News, World and Overview; labelled degraded live mode.
- **Ingestion.** Seven registered jobs; one runner; chunked idempotent writer; ingestion-run
  ledger with hour-granular idempotency keys; per-source outcome reporting; a
  signature-verified HTTP endpoint; QStash schedule script; local runner script.
- **Storage.** Six migrations: extensions/schemas/helpers, core model tables,
  sources/ingestion/change events, news/social/harness/world/watchlists, indexes plus RLS and
  grants, and the seeded source registry.
- **Tests.** Eight unit suites and two integration suites.
- **Documentation.** This `docs/` set, plus `README.md`, `AGENTS.md`, `CONTRIBUTING.md`,
  `SECURITY.md`, `CHANGELOG.md` and a `LICENSE` placeholder.

## Why

The product package specified an information-dense analytical portal for AI models, news,
coding-harness subscriptions and neutral world news, to be left as close as possible to
"connect credentials, add keys, deploy". The implementation therefore prioritised three
things above breadth of features:

1. **Real integration boundaries with honest failure reporting.** Every credential-dependent
   adapter is implemented, returns a typed error that names the missing variable, and is
   tested against stub payloads. Nothing fabricates a live state.
2. **A product that works with no credentials.** Mock mode is a first-class mode with
   deterministic fixtures, so the whole product is reviewable and testable before any key
   exists.
3. **No invented numbers.** Missing inputs propagate to `null`, the UI renders an em dash,
   derived values return `null` when an input is absent, and undocumented vendor figures are
   never inferred.

## Files and systems

| Area | Paths |
| --- | --- |
| Routes | `src/app/**` (25 pages plus `api/health` and `api/jobs/[job]`) |
| Features | `src/features/{models,news,harness,world,compare,overview,sources,methodology,watchlists}/**` |
| Shell and UI | `src/components/**` |
| Domain | `src/lib/domain/{schema,metrics,selection,hash,diff,freshness,harness-metrics,world}.ts` |
| Analytics | `src/lib/analytics/{metric-registry,index}.ts` |
| Adapters | `src/lib/adapters/{types,http,artificial-analysis,rss,harness-html,social,world,text-utils}.ts` |
| Data | `src/lib/data/{mode,repository,mock-repository,supabase-repository,workspace,index}.ts` |
| Database mapping | `src/lib/db/{rows,mappers}.ts` |
| Ingestion | `src/lib/ingestion/{runner,writer,harness-configs}.ts`, `src/lib/jobs/{registry,verify}.ts` |
| Fixtures | `src/lib/fixtures/**` |
| SQL | `supabase/migrations/**` (6 files) |
| Scripts | `scripts/jobs/{create-schedules,run-local}.mjs`, `scripts/db/generate-types.mjs` |
| Tests | `tests/unit/**` (8 files), `tests/integration/**` (2 files), `tests/setup/vitest.setup.ts` |
| Docs | `docs/**`, root markdown files |

## Tests

The suites added in this phase are listed in `docs/06-quality/testing-strategy.md`, file by
file, with what each covers.

No result is recorded here. This phase did not run the suite; run `npm run check` to obtain
results on your machine. The documented local gate is format check, lint, typecheck, unit and
integration tests, then the production build.

Not added in this phase: component tests and axe accessibility automation, which remain
outstanding. A CI workflow (`.github/workflows/ci.yml`) and Playwright E2E specs (`tests/e2e/**`)
were added after this phase, so backlog items H8 and H9 are now done; see
`docs/03-implementation/current/backlog.md`.

## Trade-offs

| Decision | Trade-off accepted |
| --- | --- |
| Modular monolith (ADR-0001) | Ingestion shares the web runtime; no independent scaling; boundaries are convention, not compiled |
| Selection in URL plus local storage (ADR-0002) | No cross-device persistence; requires auth to improve |
| Artificial Analysis API-first (ADR-0003) | No live model data until a key exists; fixture fallback instead of scraping |
| Snapshots plus a current table (ADR-0004) | Two sources of truth for current values; storage grows with polling |
| Curated provider groups (ADR-0005) | New providers land in `other` until curated by hand |
| Separate political domain (ADR-0006) | Cross-domain search is impossible without an explicit union; regex neutrality gate is English-only |
| Canonical plan keys and snapshots (ADR-0007) | Extraction depends on regex selectors that need live verification; storage grows with capture frequency |
| Mock mode as a first-class mode (ADR-0008) | Fixtures can be mistaken for real data; live-only behaviours remain unverified |
| Quota guard in `HttpClient` | A run can legitimately do nothing when quota is low; the current error classification makes that look like a failure (KI-1) |
| Missing values propagate as `null` | More `null` handling in components, but no fabricated numbers |
| No LLM summariser | `summary` is always `null`; the UI depends on the source excerpt |

## Unresolved items

Credential-dependent gaps, each also listed in
`docs/00-overview/project-status.md`:

- Artificial Analysis live verification (`ARTIFICIAL_ANALYSIS_API_KEY`).
- Supabase migration application, type generation and RLS verification
  (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- QStash schedule creation and signature verification (`QSTASH_TOKEN`,
  `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `QSTASH_TARGET_BASE_URL`).
- Social ingestion (`X_BEARER_TOKEN`).
- World news provider (`WORLD_NEWS_API_KEY`, `WORLD_NEWS_BASE_URL`).
- Harness selector verification against the current live pricing pages.

Implementation gaps:

- No LLM summariser.
- No raw payload capture or retention deletion.
- No job populates harness products, harness plans, monitored social accounts, change events
  or the benchmark tables.
- No `html` news adapter.
- Ingested news has no provider links, no entities and a binary category.
- A quota deferral is reported as a failure.
- No component tests and no axe accessibility automation (a CI workflow and Playwright E2E
  specs were added after this phase).
- No git history, and the license is undecided.
