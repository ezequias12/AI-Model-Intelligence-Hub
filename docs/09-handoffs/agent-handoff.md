# Agent handoff

Read this file first, after `docs/00-overview/project-status.md`. It states what to do, in what
order, and what will mislead you.

## Start here

1. **Read `docs/00-overview/project-status.md`.** It is the honest checklist: what is implemented,
   what is pending credentials, and what is not implemented at all.
2. **Read `docs/09-handoffs/session-log.md`** for the most recent session record.
3. **Inspect git status.** The repository currently has **no commits**: `git status` reports every
   file as untracked and `git log` fails. Everything the documentation describes is uncommitted
   work. Consider making an initial commit before changing anything, so a rollback point exists.
4. **Search persistent memory** if Engram or an equivalent tool is available, before inventing an
   approach. Never store secrets there.
5. **Follow `AGENTS.md`.** The ten rules are mandatory.

## The current state in one paragraph

The application is complete as a product and fully usable without credentials, because mock mode is
a first-class mode: every workspace renders from deterministic fixtures and the UI labels them.
Domain logic, analytics, adapters, the repository layer, ingestion, migrations, CI and tests are all
in place. **Artificial Analysis is now verified against the live API** (endpoint, field map and
single-page behaviour reconciled), and the credential-free gaps are closed: harness products and plans
are seeded, monitored social accounts are seeded, and the runner persists model and harness change
events. Five capabilities remain `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`: Supabase
persistence, QStash schedules and signature verification, X social ingestion and the world news
provider. Accessibility is now audited with axe over fourteen routes. The main live-mode defect still
open is that providers are not curated, so every live provider is `group: "other"` and the
provider-group filters have nothing to match (KI-19). No result is claimed here; run `npm run check`
and `npm run test:e2e`.

## What to do first

**Artificial Analysis is already verified** (2026-09-18): endpoint `/data/llms/models`, nested
`evaluations.artificial_analysis_*`, no pagination block, contract test built on a captured real
response. Do not re-verify it; extend it only if the vendor adds fields.

### If you have credentials

1. **Apply and verify Supabase.** Follow `docs/05-operations/supabase-setup.md`. There are **eight**
   migrations: apply all of them, including `20260918000700_seed_harness_catalog.sql` and
   `20260918000800_seed_monitored_social_accounts.sql`. Run `npm run db:gen-types` and replace the
   hand-shaped client cast in `src/lib/data/supabase-repository.ts`. Verify RLS by attempting an
   anonymous write: it must fail.
2. **Load live data.** `NEXT_PUBLIC_DATA_MODE=live npm run jobs:run sync-models` writes providers,
   models, snapshots and change events. Then `sync-harness-pricing` writes plan snapshots.
3. **Curate providers (KI-19).** Live providers are all `group: "other"`. Seed the curated provider
   registry and make `sync-models` preserve an existing curated group, region and colour.
4. **Create the QStash schedules** and confirm one accepted trigger per job, then that an unsigned
   POST is rejected with 401 in live mode.
5. **Configure `X_BEARER_TOKEN`** and enable the `x-monitored-accounts` source; its accounts are
   already seeded.

### If you do not have credentials

1. **Curate providers (KI-19).** This is the highest-leverage remaining item: without it the
   provider-group filters are dead in live mode.
2. **Add the HTML news-index adapter** (H3/KI-6) so `type: "html"` sources (for example
   `anthropic-news`) stop reporting `deferred`.
3. **Populate `providerIds` and `entities` for ingested news** (H4/KI-4) and **derive news
   categories from content** (H5/KI-5).
4. **Implement raw payload capture and retention** (H6/H7).

Do not start by adding features. The gaps above are about the product telling the truth about
itself, which is the property this repository is built around.

## Hard constraints

| Constraint | Detail |
| --- | --- |
| Never fabricate a number | A missing input yields `null` and renders as an em dash. Never `0`, never `N/A` |
| Never present mock data as live | The mode banner and `repository.meta` exist for this; degraded live mode must name the missing variables |
| Never infer an undocumented vendor figure | Request allowances are only recorded when a vendor documents them |
| Never infer provider grouping or region | ADR-0005; the adapter deliberately writes `other` and `null` |
| Never scrape a source that publishes an API | ADR-0003, and never scrape X HTML |
| Never mix political content into scoring | ADR-0006; asserted by `tests/unit/world-neutrality.test.ts` |
| Never put a secret in a `NEXT_PUBLIC_` variable | Values with that prefix are inlined into the client bundle |
| Never claim an unrun result | Run `npm run check` and report what actually happened |

## Things that will mislead you

| Trap | Reality |
| --- | --- |
| Assuming the suite has not been run | It has. The last session recorded the exact results in `docs/09-handoffs/session-log.md`: `npm run check` exits 0 (format, lint, typecheck, 241 unit and integration tests, a 26-route build) and `npm run test:e2e` passes 205 tests and skips 5 across both projects. Re-run both before trusting them for your own change |
| `npm run dev` failing with `Module parse failed: Unexpected character '@'` on `@tailwind base` | A globally exported `NODE_ENV=production` makes Next.js compile in production mode and break the CSS pipeline. `npm run dev` goes through `scripts/dev.mjs`, which pins `NODE_ENV=development`. Do not bypass that script |
| The same environment variable also silently skips devDependencies | With `NODE_ENV=production`, `npm install` omits `devDependencies`. Use `npm ci --include=dev` |
| `npm run test:e2e` reporting nothing to run | It does run: seven spec files under `tests/e2e`, executed against the `chromium-desktop` and `chromium-mobile` projects. Playwright builds and starts the app on port 3100 in mock mode first, so a clean run takes a couple of minutes. If it fails instantly with "Executable doesn't exist", run `npx playwright install chromium` |
| A dashboard full of em dashes after connecting Artificial Analysis | The mapper returns `null` for an absent field, so a renamed field looks like missing data rather than an error. Compare against the field map in `docs/04-data/artificial-analysis-field-map.md`. Note the free API genuinely does not expose `context_window`, `open_weights`, `deprecated`, cache prices or an agentic index, so those are always `null`/`false` live |
| Artificial Analysis returning 404 HTML | The endpoint is `/data/llms/models` (plural). The singular `/data/llm/models` serves the site's 404 page. Fixed 2026-09-18; do not regress it |
| A job reporting `deferred` with "Deferred request: ..." | Correct since 2026-09-18: a quota guard and a persistent 429 are classified as deferrals and recorded as a `rate_limited` run (KI-1, resolved). `failed` with that message means the classification regressed |
| A source showing as enabled that never produces items | `type: "html"` news sources have no adapter (KI-6) |
| `NEXT_PUBLIC_DATA_MODE` changed but nothing happened | The repository and fixtures are memoised per process (KI-11); restart. Also, `NEXT_PUBLIC_` values are build-time, so a deployment needs a redeploy |
| Harness pricing source reporting `deferred` with "No adapter registered" | The source `type` is not `official_pricing`, `official_site`, `rss`, `atom`, `social_api` or `github_releases`. Note `opencode-go` is `official_docs` with a config, so it is **not** fetched |
| `writeHarnessProducts`, `writeHarnessPlans` (writer) | Implemented but still unused by any job: the harness catalogue is seeded by migration, not by the writer. `writeChangeEvents` and `writeHarnessChangeEvents` **are** now called by the runner |
| `benchmark_definitions` and `model_benchmark_values` | Tables exist; no code reads or writes them |
| `private.raw_ingestion_payloads` | Table and retention index exist; nothing writes to it and nothing deletes from it |
| `previousSnapshot()` in fixtures and `signingKeysConfigured()` in verify | Dead exports |
| Harness plans or social accounts missing on a fresh database | The seeds are migrations `0007` and `0008`. A database created before 2026-09-18 must apply them, or the pricing job writes no snapshots and the social job polls nothing |

## Documentation rules

- Anything under `docs/` plus the root markdown files is documentation territory. `src/`, `tests/`,
  `supabase/` and `scripts/` are implementation territory: do not change them for a documentation
  task.
- Documentation must not contain a claim the code does not support.
- Credential-dependent capabilities are marked
  `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` in `docs/00-overview/project-status.md` and
  `docs/03-implementation/current/implementation-status.md`, and each names its environment
  variable. Keep that true.
- Architectural decisions get an ADR, using `docs/_templates/ADR-template.md`, with the negative
  consequences stated.
- After a significant phase, write `docs/03-implementation/history/YYYY-MM-DD-<phase>.md`.
- Update this file and `docs/09-handoffs/session-log.md` before you finish.

## Open threads

| Thread | Where it is tracked |
| --- | --- |
| Credential verification for the remaining five capabilities | `docs/00-overview/project-status.md` section 2 |
| Ordered next work with file-level detail | `docs/03-implementation/current/backlog.md` |
| Defects and rough edges | `docs/03-implementation/current/known-issues.md` |
| Deliberate shortcuts and their cost | `docs/03-implementation/current/technical-debt.md` |
| Staged plan | `docs/07-product/roadmap.md` |
| Speculative ideas, not work | `docs/07-product/future-ideas.md` |
| Source review open questions | `docs/08-research/source-reviews/artificial-analysis.md` |
| Provider metadata options | `docs/08-research/alternatives/provider-metadata-sources.md` |
| One commit exists, license undecided | `LICENSE`, `docs/00-overview/project-status.md` section 6 |
| Live provider grouping not curated (KI-19) | `docs/03-implementation/current/known-issues.md` |

## When you finish

1. Run the checks and record the real output: `npm run check`.
2. Update `docs/00-overview/project-status.md` and
   `docs/03-implementation/current/implementation-status.md` if any status changed.
3. Update `docs/03-implementation/current/{backlog,known-issues,technical-debt}.md`.
4. Add a phase record under `docs/03-implementation/history/`.
5. Add a `CHANGELOG.md` entry.
6. Update this handoff and `docs/09-handoffs/session-log.md`.
7. Persist the session summary to project memory if a memory tool is available, without secrets.
