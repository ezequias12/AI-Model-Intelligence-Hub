# Session log

Append-only record of working sessions. Newest entries first. Each entry states what was done, what
was verified (and how), and what was left open. Do not rewrite past entries.

## 2026-09-23 - Production live-data fix, global refresh button, job ceilings

**Scope:** production debugging through the Supabase and Vercel MCPs, a global manual refresh
control, and job-route duration ceilings.

**What was done**

1. **Empty-dashboard root cause (Vercel MCP).** `NEXT_PUBLIC_SUPABASE_URL` held
   `https://supabase.com/dashboard/project/...` (the dashboard URL) instead of
   `https://<ref>.supabase.co`. Every `supabase-js` select received the SPA HTML and failed JSON
   parsing (`Unexpected token '<'`), rendering em dashes across the UI while the banner showed
   "Live" green (the banner only checks variable presence). Corrected with `edit_project_env` and
   redeployed; `/api/health` reports `ok: true, dataMode: live` and `/sources` renders live rows.
2. **Migrations were already applied.** The Supabase MCP showed eleven combined migrations and a
   populated database (864 models, 2322 news items); a diagnostic test validated every table
   against the Zod row schemas with zero rejected rows. No SQL needed to be applied.
3. **Stale data explained.** No `ingestion_runs` existed after 2026-09-21 and `/api/cron` had never
   been called: the `vercel.json` schedule first reached a READY production deployment on
   2026-09-23 and QStash is unconfigured. The core pipeline was then executed against the live
   database from a local server: models (673 Artificial Analysis / 454 OpenRouter / 200 Hugging
   Face), AI news, social and harness pricing runs all recorded `success` on 2026-09-23.
4. **Global refresh button.** `src/components/shell/quick-sync.tsx` mounted in the app shell header
   runs `job: "all"` through `/api/jobs/manual`, reuses the `amih_admin_key` localStorage token,
   opens the token popover on 401 and calls `router.refresh()` on success.
5. **Duration ceilings.** `/api/jobs/manual` and `/api/cron` moved from `maxDuration = 60` to `300`:
   a full four-job pass measured ~83s, so 60s truncated it on a deployed run.

**Verified**

- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test` (267 tests across 13
  files) and `npm run build` (26 routes) all exit 0.

**Open**

- GDELT remains `rate_limited` on every run; world news still needs `WORLD_NEWS_API_KEY`.
- `CRON_SECRET` was created in Vercel on 2026-09-23; the daily `0 4 * * *` UTC run had not yet fired
  when this session ended — confirm the first scheduled execution.

## 2026-09-22 - Vercel deployment preparation, Vercel Cron & Manual Ingestion

**Scope:** Supabase credential mapping from dashboard screenshots, Vercel Cron integration (with Hobby plan
daily cadence), manual on-demand ingestion trigger (UI control in `/sources` + API endpoint), and CRON_SECRET
authorization support.

**What was done**

1. **Vercel Cron setup:** Created `vercel.json` with a daily cron schedule (`0 4 * * *`) targeting `/api/cron`,
   respecting Vercel Hobby tier limitations (max 2 cron jobs, max 1 execution per day, GET method).
2. **Cron handler:** Implemented `src/app/api/cron/route.ts` with `CRON_SECRET` authorization support. Runs core
   sync jobs sequentially.
3. **Manual ingestion endpoint:** Implemented `src/app/api/jobs/manual/route.ts` allowing on-demand execution
   with optional `adminKey`/`CRON_SECRET` verification.
4. **Manual Sync UI:** Added `ManualSyncPanel` in `src/features/sources/source-registry.tsx` with job picker,
   real-time execution progress, localStorage-persisted admin token, and feedback display.
5. **Job verification enhancement:** Updated `src/lib/jobs/verify.ts` and `src/app/api/jobs/[job]/route.ts`
   to support Bearer authorization via `CRON_SECRET` alongside QStash signatures.
6. **Config & docs:** Updated `.env.example` with `CRON_SECRET`.

**Verified**

- `npm run check` exits 0: format check, lint, strict typecheck, 267 tests passed across 13 test files, 26 routes built.

## 2026-09-18 - Community/news pivot: free sources, X removed (ADR-0009)

**Scope:** drop X, move Social Pulse to free key-less APIs, add free news/world via GDELT, and extend
the model garden with OpenRouter and Hugging Face. Out of scope: live calls to the new sources,
applying the new migrations to Supabase, QStash.

**What was done**

1. **X removed.** `src/lib/adapters/social.ts` deleted; the `x-monitored-accounts` source, its
   account seed and `X_BEARER_TOKEN` removed from the registry, seeds and env templates. The
   `social_api` type survives only in the SQL CHECK for historical rows.
2. **Community Pulse.** New `bluesky.ts` (public AppView `getAuthorFeed`, per monitored handle) and
   `hackernews.ts` (Algolia; points → likes, comments → replies, reposts null); `entities.ts` holds
   the shared entity extractor.
3. **News + World.** New `gdelt.ts` producing `news_items` (ai_news) or `world_news_items`
   (world_politics) by domain, key-less.
4. **Model garden.** New `openrouter.ts` (breadth + context window) and `huggingface.ts`
   (popularity); new `model-identity.ts` and `merge-models.ts` implement field-level source
   precedence so a source never overwrites a non-null value with null.
5. **Popularity metrics.** `hfDownloads`/`hfLikes` added to the domain, DB, mapper, writer and a new
   `popularity` metric group; two ranking boards and a model-detail section.
6. **KI-19 resolved.** Migration `0012` seeds the curated provider registry; `mergeProviders`
   preserves it.
7. **Migrations 0009-0015** widen the source-type and social-platform checks, add the popularity
   columns, and seed the model-garden sources, provider registry, community sources/accounts and
   GDELT sources.
8. **Docs.** ADR-0009, the source catalog, status docs, testing strategy, environment variables,
   changelog and this log.

**Verified**

- `npm run check` exits 0: format, lint, typecheck, **267 unit and integration tests**, 26-route
  build.
- `npm run test:e2e` passes **205 tests**, skips 5, both viewports, including the 28 axe cases.

**Not done**

- No live call to Bluesky, Hacker News, GDELT, OpenRouter or Hugging Face from this repository; all
  are covered by contract tests with stubs.
- Migrations 0009-0015 not applied to Supabase from here.
- GDELT queries are first-guess keywords.

**Open**

- Popularity is one platform's attention, not quality (labelled as such).
- Hugging Face slug matching is fuzzy; an unmatched model silently gets no popularity.
- OpenRouter contributes no capability index and its routed price is unused.

## 2026-09-18 - Live-mode completion, Artificial Analysis verification and axe

**Scope:** close the credential-free backlog (harness/social seeds, change-event persistence, quota-guard
classification, axe), and verify the Artificial Analysis integration now that an API key exists. Out of
scope: applying migrations to a live Supabase project, QStash schedules, X and world-news providers,
deployment.

**What was done**

1. **H1 seed.** `supabase/migrations/20260918000700_seed_harness_catalog.sql` seeds harness products and
   plans whose `canonical_plan_key` equals the extraction `planKey`, so the pricing job can attach a
   snapshot.
2. **H2 change events.** New `src/lib/ingestion/change-events.ts` derives `change_events` (from model
   snapshot diffs) and `harness_change_events` (from harness snapshot diffs); the runner writes them
   after each successful sync, gated by the diff.
3. **KI-7 seed.** `20260918000800_seed_monitored_social_accounts.sql` seeds the twelve social accounts;
   `provider_id` stays null until `sync-models` creates the providers.
4. **KI-1 / M1.** `isDeferralError` in `src/lib/adapters/http.ts` classifies a quota guard and a
   persistent 429 as deferrals; the AA adapter returns `rate_limited`; the runner reports `deferred` and
   records a `rate_limited` ingestion run.
5. **H10 axe.** Added `@axe-core/playwright` 4.13.0 and `tests/e2e/axe.spec.ts` (fourteen routes, both
   viewports, serious/critical gate).
6. **Artificial Analysis live verification.** Found and fixed three defects: the endpoint was the
   singular `/data/llm/models` (404); capability metrics are nested under `evaluations.artificial_analysis_*`;
   and the free endpoint returns everything with no pagination block, which the old loop re-fetched up to
   20 times. The contract test now uses a captured real response.
7. **Accessibility fixes from axe.** `<hr>` removed from directly inside the Sources capability `<ul>`;
   `tabIndex` added to the two scrollable Methodology tables; the landscape chart plot marked
   `aria-hidden` (Recharts ships `role="img"` with no name) with the existing data table as the
   accessible equivalent.
8. **Tooling.** Prettier `endOfLine` set to `auto` so `format:check` passes on a CRLF Windows checkout.
9. **Docs.** Reconciled the field map, source review, source catalog, project status, implementation
   status, backlog, known-issues (KI-1/7/8/9 resolved, KI-13 updated, KI-19 added), technical debt,
   Supabase setup, testing strategy, this log, the handoff and a new phase record.

**Verified**

- `npm run check` exits 0: Prettier, ESLint, `tsc --noEmit`, **241 unit and integration tests**, and a
  **26-route** production build.
- `npm run test:e2e` passes **205 tests** and skips 5 (210 total) across `chromium-desktop` and
  `chromium-mobile`, including the 28 axe cases.
- A live `GET https://artificialanalysis.ai/api/v2/data/llms/models` returned HTTP 200 with **652 rows**
  and no pagination block; the mapper was reconciled against the real field names.

**Not done**

- Migrations were not applied to a Supabase project from this repository; `npm run db:gen-types` was not
  run; no row was written through the service role.
- Harness pricing selectors were not checked against the live pages.
- `X_BEARER_TOKEN` and the world news provider are still unconfigured.
- No component/DOM test was added.

**Open**

- KI-19: live providers all carry `group: "other"`; the provider-group filters need a curated provider
  seed and a sync that preserves it.
- Raw payload capture and retention deletion remain unimplemented.
- The changes are uncommitted.

## 2026-09-18 - UI redesign, hydration fix and E2E verification session

**Scope:** Complete UI redesign following GitHub UI skills guidelines (Anthropic `frontend-design`, Vercel `web-design-guidelines`, `impeccable`, `accessibility`), fix the React hydration mismatch bug (#418) caused by relative time rendering in static routes, and re-verify the full gate including Playwright E2E.

**What was done**

1. Implemented a refreshed design system in `tailwind.config.ts`: typographic scale (11/12/13/14/16/18/22/28/36), role-based radii (`rounded-panel` 12px, `rounded-control` 8px, `rounded-chip` 6px), edge-only elevation (`shadow-overlay`, `shadow-tooltip`, removing diffuse card shadows), exponential easing, and keyframe animations (`overlay-in`, `sheet-in`, `leader-in`).
2. Overhauled `src/app/globals.css`: cyan-teal tinted neutrals, deep cyan-teal accent, semantic `-muted` surface tokens, themed browser surfaces (`::selection`, `caret-color`, custom scrollbars, `:focus-visible` offset ring), hairline metadata separators (`.meta-sep`), and monospace measurement tokens (`.measured`).
3. Re-architected UI primitives: `card.tsx` (Panel structure + aliases), `button.tsx`, `badge.tsx`, `input.tsx`, `overlay.tsx`, and `primitives.tsx` (`MetaLine`, `MetricValue`, `DeltaBadge`).
4. Redesigned the application shell (`src/components/shell/app-shell.tsx`): labeled rail section dividers, underline tab indicators, and collapsed rail state.
5. Transformed features across the app: eliminated AI tells (all uppercase tracking-wide eyebrows and middle-dot separators removed in favour of `.meta-sep`), converted Market Pulse to an instrument strip, converted Metric Leaders into a signature component with 40ms stagger motion, and corrected overview source freshness to read from the ingestion ledger.
6. Resolved React hydration mismatch bug (#418) on 7 static routes (`/models`, `/models/table`, `/models/releases`, `/compare`, `/news`, `/news/social`, `/sources`) by creating `src/components/ui/relative-time.tsx` (`<RelativeTime>`, `<FreshnessBadge>`) with `suppressHydrationWarning` and dynamic client-side timer updates across 24 usages in 14 files.

**Verified**

- `npm run check` (Prettier, ESLint, TypeScript strict mode, 222 unit/integration tests, production build) exits 0.
- `npm run test:e2e` (Playwright suite covering desktop and mobile Chromium projects) passes 177 tests (5 skipped) in 1.5 minutes.
- Verified absence of React hydration warnings (#418) on static routes under production build.

**Not done**

- No credential-dependent integration was exercised.
- Repository still has no commits yet.

**Open**

- Priority backlog without credentials: seed harness products and plans (H1), persist change events from diffs (H2), seed monitored social accounts (H3), report quota guard as deferred (KI-1/M1).

## 2026-09-18 - Implementation and verification session

**Scope:** build the application described by the specification package, then verify it end to end.
Out of scope: any credentialed or billable external action, and any deployment.

**What was done**

1. Scaffolded the repository: `package.json` with pinned versions, strict TypeScript, Next.js 15 App
   Router, Tailwind with token-based light/dark themes, ESLint, Prettier, Vitest and Playwright.
2. Implemented the domain core: Zod schemas for every entity, derived metrics (blended price,
   monthly workload cost, four value-score modes, Pareto frontier, ranking), the dynamic default
   model resolver, presets, provider grouping, URL and storage selection state, URL canonicalization,
   stable hashing, news clustering, snapshot diffing and freshness.
3. Built deterministic fixtures for 32 models, 16 providers, model snapshot history, news, social
   posts, nine harness products with plans and change events, 22 world items and the source registry.
4. Implemented the data layer: a repository interface with a mock implementation and a Supabase
   implementation, row schemas validated at the boundary, mappers, and a factory that degrades loudly
   when live mode is requested without credentials.
5. Implemented adapters: an Artificial Analysis client with pagination, quota guard, rate-limit
   header capture, `Retry-After` handling and exponential backoff; a dependency-free RSS/Atom parser;
   a versioned, fail-loud harness pricing extractor; a social adapter that refuses to run without an
   authorized token and never scrapes HTML; and an isolated world-news adapter with a neutrality gate.
6. Built the ingestion layer: an explicit job registry, a QStash signature verifier that refuses
   unverified triggers in live mode, a service-role writer with idempotent upserts, and a runner that
   reports `ok`, `deferred`, `disabled`, `not_configured` or `failed` per source.
7. Built the interface: app shell with a collapsible rail, mobile tabs, command palette and
   first-paint theme script; the Models workspace (selection tray, metric leaders, ranking boards,
   configurable charts with a Pareto frontier, dense table with CSV export, model detail page and
   drawer, releases feed); Compare in two separate schemas; News; Harness Watch; World & Politics;
   Watchlists; Sources; and Methodology.
8. Added the database migrations (six files) with the RLS model, indexes, idempotency keys and a
   seeded source registry, plus job-scheduling, local-job and type-generation scripts.

**Verified**

- `npm run check` (format check, lint, typecheck, tests, production build) exits 0.
- `npm run test` runs 222 tests across 10 files and all pass.
- `npm run build` produces 26 routes.
- `npx playwright test` runs 177 tests across the desktop and mobile projects and all pass.
- The browser console is clean on nine routes in both viewports after the fixes below.
- No test result, coverage figure or benchmark is claimed anywhere in the documentation.

**Defects found during verification and fixed**

- The native `<dialog>` collapsed to a zero-size box because its only child is positioned, which made
  every modal and drawer unreachable for assistive technology and automation. The dialog now owns a
  full-viewport box.
- `buildSearchIndex` emitted the same id twice for paths that are both a rail item and a workspace
  sub-route, producing duplicate React keys in the command palette.
- The inline theme script was exported from a client module and imported by the server layout, which
  forced a full reload on every edit. It now lives in its own module.
- Four pages rendered a second `<h1>` alongside the shell's, so each of those routes had two top-level
  headings. The duplicate headings were removed and the intro copy kept.
- `npm run dev` failed on any machine with a globally exported `NODE_ENV=production`, breaking the CSS
  pipeline. `scripts/dev.mjs` now pins `NODE_ENV=development` cross-platform.
- The fixture launch story did not cluster because its secondary headlines were too dissimilar; the
  clustering demo was therefore invisible.

**Not done**

- No credential-dependent integration was exercised: Artificial Analysis live calls, Supabase
  persistence, QStash schedules, the social API and the world news provider all remain unverified.
- The harness pricing selectors have not been checked against the live pages.
- No accessibility audit with axe, no performance measurement and no security scan.
- No commit was created; the repository still has no commits.

**Open**

- Everything in `docs/09-handoffs/agent-handoff.md`, plus the housekeeping items: create an initial
  commit and choose a license.

## 2026-09-18 - Documentation phase

**Scope:** write the complete documentation set required by
`REPOSITORY_AND_DOCUMENTATION_STANDARD.md`, plus the root markdown files. No file under `src/`,
`tests/`, `supabase/` or `scripts/` was modified.

**What was done**

1. Read the authoritative product specifications at the repository root: `START_HERE.md`,
   `PACKAGE_MANIFEST.md`, `CANONICAL_NAMING.md`, `MASTER_AGENT_PROMPT.md`,
   `PRODUCT_INFORMATION_ARCHITECTURE.md`, `UI_UX_SPECIFICATION.md`,
   `NEWS_AND_HARNESS_SPECIFICATION.md`, `DATA_SOURCES_AND_PIPELINES.md`,
   `REPOSITORY_AND_DOCUMENTATION_STANDARD.md`, `SEED_SOURCE_REGISTRY.json`,
   `SEND_THIS_TO_AGENT.txt`.
2. Read the implementation to document it rather than describe intent: the domain modules
   (schema, metrics, selection, hash, diff, freshness, harness metrics, world), the analytics
   registry and assembly, all eight adapters plus the HTTP client, the data layer (mode, repository,
   mock and Supabase implementations, workspace loaders), the row schemas and mappers, the ingestion
   runner, writer and harness configs, the job registry and QStash verification, the fixtures, the
   navigation and search modules, the formatting module, all six migrations, the App Router pages
   and feature components, the scripts, the two API route handlers, the package manifest, the
   environment template and the ESLint, Prettier, TypeScript, Next.js, Vitest and Playwright
   configurations.
3. Read all ten test files and the Vitest setup to describe coverage accurately.
4. Created the documentation tree required by the standard, the four templates, the archive
   placeholder, and the root files `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`,
   `CHANGELOG.md` and a `LICENSE` placeholder.
5. Recorded the honest status picture: six capabilities marked
   `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` with the exact variable each needs, and a
   separate list of what is not implemented at all.

**Verified**

- `git status` reports every file as untracked and `git log` fails: the repository has no commits.
  This is stated in the handoff, the status documents and the changelog.
- At the time of this phase no CI workflow existed (no `.github` directory; confirmed by directory
  listing and glob). A CI workflow (`.github/workflows/ci.yml`) has since been added.
- At the time of this phase no Playwright spec files existed: `tests/` contained `unit`,
  `integration` and `setup` only, while `playwright.config.ts` targeted `tests/e2e` (confirmed by
  glob). Specs have since been added under `tests/e2e`.
- No axe dependency is installed. Confirmed by reading `package.json`.
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `QSTASH_URL`, `LLM_SUMMARY_MODEL` and
  `LOG_LEVEL` appear in `.env.example` but are read nowhere in the code. Confirmed by searching
  `process.env` usage across the repository.
- No LLM summariser implementation exists: `LLM_SUMMARY_API_KEY` appears only in the capability
  report, and no client module exists. Confirmed by searching for the variable and for summary
  generation.
- `private.raw_ingestion_payloads` is referenced only by its migration and by a maintenance branch
  that returns a message. Nothing writes to it and nothing deletes from it. Confirmed by searching
  for the table name.
- `writer.writeChangeEvents`, `writer.writeHarnessChangeEvents`, `writer.writeHarnessProducts` and
  `writer.writeHarnessPlans` are implemented but called by no job. Confirmed by searching for each
  method name.
- `previousSnapshot()` (fixtures) and `signingKeysConfigured()` (verify) are exported and unused.
  Confirmed by searching for each identifier.
- The `payloadHash` JSDoc says sha256 while the implementation is a 16-character FNV-1a hash.
  Confirmed by reading `src/lib/domain/schema.ts` and `src/lib/domain/hash.ts`.
- RLS model, unique indexes, table columns and constraints were taken from the SQL files directly.

**Not done**

- No test suite was executed. No result is claimed anywhere in the documentation, and
  `docs/06-quality/testing-strategy.md` instructs the reader to run the suite.
- No credential-dependent integration was exercised.
- No deployment was performed.
- No accessibility, performance or security audit was run.

**Open**

Everything listed in `docs/09-handoffs/agent-handoff.md` under "Open threads", plus the two
immediate housekeeping items: make an initial commit so a rollback point exists, and choose a
license so the repository grants rights.

## Template for the next entry

```text
## YYYY-MM-DD - <session name>

**Scope:** <what this session was for, and what was explicitly out of scope>

**What was done**
1. <Change>

**Verified**
- <Claim>: <how it was verified>

**Not done**
- <What was skipped, and why>

**Open**
- <Threads left open, with a pointer to where they are tracked>
```
