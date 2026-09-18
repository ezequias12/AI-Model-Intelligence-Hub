# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Artificial Analysis adapter verified against the live API: endpoint corrected to
  `/data/llms/models`, capability metrics mapped from `evaluations.artificial_analysis_*`,
  single-page handling for the free endpoint (which returns everything without a pagination
  block), and a contract test rebuilt from a captured real response.
- `src/lib/ingestion/change-events.ts`: derives `change_events` and `harness_change_events` from
  snapshot diffs; the runner persists them after each successful sync.
- `supabase/migrations/20260918000700_seed_harness_catalog.sql`: seeds harness products and plans
  whose `canonical_plan_key` matches the extraction configuration.
- `supabase/migrations/20260918000800_seed_monitored_social_accounts.sql`: seeds the twelve
  accounts to monitor.
- Automated WCAG audit (`tests/e2e/axe.spec.ts`, `@axe-core/playwright`) over fourteen routes in
  both viewports, gating on serious and critical violations.
- `tests/unit/change-events.test.ts`.

### Changed

- A quota-guard or persistent-429 deferral is classified as `deferred` and recorded as a
  `rate_limited` ingestion run instead of a failure (KI-1 / M1).
- The Artificial Analysis mapper reads the nested evaluation indices; fields the free API does not
  expose (`contextWindow`, `openWeight`, `deprecatedAt`, cache prices, `agentic`) stay `null`/`false`
  rather than being guessed.
- Prettier `endOfLine` is now `auto`, so the format check passes on a CRLF Windows checkout.

### Fixed

- Accessibility defects surfaced by the axe audit: an `<hr>` directly inside the Sources capability
  `<ul>`, scrollable Methodology tables without keyboard access, and unlabelled Recharts scatter
  symbols on the landscape charts (the plot is now decorative; the data table is the accessible
  equivalent).

## [0.1.0] - 2026-09-18

Initial implementation of AI Model Intelligence Hub.

### Added

- Application shell (Next.js 15 App Router, TypeScript strict, Tailwind): left rail
  with Core / Intelligence / Personal / System sections, workspace sub-navigation,
  command palette search index, freshness indicator, data-mode banner and dark mode.
- Models workspace: dashboard with metric leaders, Top 10 ranking boards, configurable
  landscape charts with a Pareto frontier, dense research table with CSV export and
  local column/sort persistence, releases view, model detail route with snapshot
  history, model history chart.
- Model selection: dynamic default comparison set resolved from provider metadata,
  eight presets, provider-group filters, selected-model tray, URL query state
  (`?models=`) plus local-storage persistence.
- Domain logic: Zod schemas for every entity, blended price (75/25 default), monthly
  workload cost with cache accounting, four value-score modes, Pareto frontier,
  ranking helper, statistics helpers, stable hashing, URL canonicalization, news
  clustering, snapshot diffing, freshness thresholds and world-politics neutrality
  guardrails.
- Analytics: single metric registry (measured vs derived), metric leaders, ranking
  boards, landscape chart assembly and release history.
- Adapters: Artificial Analysis Data API (paginated, quota-aware, typed), RSS 2.0 /
  Atom parser, controlled harness pricing-page extractor with required-field
  failures, social/X adapter contract and world news adapter with a neutrality gate.
  All adapters share one result envelope.
- Data layer: repository contract with a mock implementation (default, no
  credentials) and a Supabase implementation validated row by row with Zod;
  workspace loaders for Models, Harness, News, World and Overview.
- Ingestion: seven registered jobs, a single job runner, an idempotent writer with
  chunked upserts, an ingestion-run ledger and QStash signature verification.
- Storage: six Supabase migrations covering schemas and helpers, core model tables,
  sources and ingestion, news/social/harness/world tables, indexes and row level
  security, and the seeded source registry.
- Routes: `/`, `/models` (+ rankings, landscape, table, releases), `/models/[slug]`,
  `/compare`, `/news` (+ ai, providers, social, research), `/harness` (+ plans,
  compare, cheapest, changes, news, calculator), `/world`, `/watchlists`, `/sources`,
  `/methodology`, `GET /api/health` and `POST /api/jobs/[job]`.
- Fixtures: deterministic provider, model, snapshot, news, social, harness and world
  datasets plus a fixture ingestion-run ledger.
- Tests: eight Vitest unit suites and two integration suites covering domain metrics,
  selection, hashing and clustering, diffing and freshness, harness metrics,
  analytics, adapter contracts and the repository.
- Documentation: this changelog, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`,
  `SECURITY.md`, `LICENSE` placeholder and the full `docs/` tree.
- Tooling: ESLint, Prettier, Vitest and Playwright configuration; `scripts/jobs`
  schedule creation and local runner; `scripts/db/generate-types.mjs`.

### Known limitations at this version

- A CI workflow (`.github/workflows/ci.yml`) and a Playwright end-to-end suite
  (`tests/e2e`) are committed. No CI run has executed yet.
- LLM summarisation is not implemented; news `summary` is always `null`.
- Raw ingestion payload capture and retention deletion are not implemented.
- No commit exists yet in the repository history.
