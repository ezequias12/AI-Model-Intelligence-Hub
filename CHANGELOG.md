# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Artificial Analysis data completeness, ADR-0011)

- **The adapter now reads the documented free endpoint** `/api/v2/language/models/free` alongside
  the legacy `/data/llms/models` path. The documented endpoint is authoritative; the legacy one only
  fills what it uniquely has (the math index, and models the former omits). A null never displaces a
  published value. This is what restores the `agentic` index, the cost per task and the cache
  prices, which the legacy path never returned.
- **New metrics**: `costPerTaskUsd` (vendor figure, free API tier), `answerTokensPerTask` and
  `reasoningTokensPerTask` (vendor web dataset), plus derived `tokensPerTask`. Migration
  `20260923000100` adds three nullable columns to `models`.
- **New source** `artificial-analysis-web` (`src/lib/adapters/artificial-analysis-web.ts`): reads
  the Schema.org `Dataset` blocks the vendor publishes in its comparison page for the per-task
  token split, which the free API tier does not expose. Block selection is by name, a missing block
  fails loudly, the payload is hashed, and coverage (a few dozen models) is stated in the UI.
  Migration `20260923000200` seeds the registry row.
- **New chart set** on `/models/landscape`, two cards to a row: intelligence per model, cost per
  task per model, tokens per task per model (stacked answer/reasoning), and the
  intelligence-against-cost Pareto scatter, which reuses the existing frontier implementation.

### Fixed

- **The weighted value score no longer blanks out when a component is missing.** `valueScore` had
  returned null whenever any of intelligence/coding/agentic was absent from the population, so with
  Artificial Analysis publishing no agentic index on the free tier the score was null for every
  model — which emptied the "Best weighted value" card and the "Top 10 Cost Efficient — Weighted"
  board. The weights are now renormalized over the components the source actually publishes, and the
  explanation names which ones were used.
- The adapter refuses to write an empty catalogue over the stored one: two endpoints returning zero
  rows is now a failure, not a successful wipe.
- A React fragment around Recharts `<Bar>` children silently produced an empty plot, because Recharts
  discovers series by walking a chart's direct children.

### Changed

- `sync-models` runs every two hours instead of every thirty minutes: the adapter now issues about
  five requests per run and the free tier allows 100 requests per 24 hours.

### Changed (interface redesign, ADR-0010)

- **One blue brand accent in both themes.** The primary token moves from cyan-teal (hue 192) to
  blue: `#2b57f0` in light, `#0072f5`-family in dark. Blue is used for links, focus, active and
  selected states, chart series and highlights only — never across large surfaces.
- **Light mode follows Fina**: page background `#f3f6fd` with a deliberate blue tint, white cards,
  `#e1e8f5` borders, and a barely-there blue-tinted card shadow. Dark mode follows Vercel: pure
  neutral surfaces (`#0a0a0a` / `#111111` / `#191919`), `#2a2a2a` hairlines, `#fafafa` text, and no
  card shadow at all — the hairline is the elevation.
- **Self-hosted Geist** (Sans + Mono, `geist` package) replaces the system font stacks. Bundled, so
  builds and offline environments are unaffected; the system stack remains as a fallback.
- **Shared chart theme** (`src/components/charts/theme.ts`): one series palette, axis, grid, tooltip
  and legend definition, a numeric tick formatter and a deterministic accent helper. The two
  Recharts modules, the harness product marks and the analytics provider-colour fallback now read
  from it instead of hardcoding colours.
- **Metric leaders are tiered**: three primary readings (highest intelligence, best weighted value,
  fastest output) above five compact secondary ones. All eight readings still render.
- New tokens: `--border-strong`, `--shadow-card`, `--chart-1`..`--chart-6`, exposed as
  `border-border-strong`, `shadow-card` and `chart-1`..`chart-6`.
- Inputs and selects now sit on the surface they are placed on (`bg-surface`) rather than on the
  page background, matching both references.

### Fixed (interface redesign)

- Recharts legends overlapped their own entries: the shared `wrapperStyle` was overriding the
  library default's `width: 100%`. The shared style now passes it back explicitly.
- Chart axes rendered raw floats (`0.35000000000000003`); axis ticks now format by magnitude.
- The landscape charts carried an in-chart X axis label that collided with the legend and merely
  repeated the card header; it is removed. The snapshot history chart's static legend was removed
  because the interactive series toggles above it already carry every label.
- The Provider segmented control in the filter bar could not shrink below its content width, making
  the document 36px wider than a 390px viewport. It scrolls inside its own box now.
- A visually-hidden span inside a compare table cell is absolutely positioned; with no containing
  block in the table's scroll wrapper it resolved against a distant ancestor and stretched the
  document by 323px at narrow widths. The wrapper is now a containing block.
- Light-mode semantic ink (success, warning, info, destructive, muted foreground) is darker than
  the reference palette so 11px badges meet WCAG AA on their own tints; the axe audit failed 28
  assertions at the lighter values.

### Added

- `QuickSyncButton` (`src/components/shell/quick-sync.tsx`), mounted in the app shell header: runs
  the core pipeline (`job: "all"`) through `/api/jobs/manual` from any page, shares the stored
  `amih_admin_key` token with the Sources panel, opens the token popover on 401 and calls
  `router.refresh()` on success.

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

- `/api/jobs/manual` and `/api/cron` now declare `maxDuration = 300`: a full four-job pass measured
  ~83s, so the previous 60s ceiling truncated the pipeline mid-run.
- Production `NEXT_PUBLIC_SUPABASE_URL` had been set to the Supabase dashboard URL instead of the
  project API URL, so every select received HTML and the UI rendered em dashes under a green "Live"
  banner. Corrected in the Vercel project environment.

- Accessibility defects surfaced by the axe audit: an `<hr>` directly inside the Sources capability
  `<ul>`, scrollable Methodology tables without keyboard access, and unlabelled Recharts scatter
  symbols on the landscape charts (the plot is now decorative; the data table is the accessible
  equivalent).

### Changed (community and news pivot, ADR-0009)

- **X is out of scope.** The X adapter, its source row, its account seed and `X_BEARER_TOKEN` are
  removed. Nothing scrapes a source that publishes an API.
- **Community Pulse** is served by the public, key-less **Bluesky** AppView and **Hacker News**
  Algolia API. A Hacker News story maps points to likes, comments to replies, reposts to null.
- **News and World** are served by **GDELT DOC 2.0**, key-less, feeding `news_items` and
  `world_news_items`.
- **Model garden**: **OpenRouter** adds catalogue breadth and the context window; the **Hugging
  Face Hub** adds popularity (`hfDownloads`, `hfLikes`), with two new "most-downloaded" and
  "most-liked" ranking boards and a Popularity section on the model detail page.
- **Multi-source model merge** with field-level precedence: a source never overwrites a non-null
  value with null, so Artificial Analysis capability and first-party price always win; Hugging Face
  only enriches matched models and never inserts one; OpenRouter's routed price is not used.
- A curated provider registry is seeded and the merge preserves it, resolving KI-19.

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
