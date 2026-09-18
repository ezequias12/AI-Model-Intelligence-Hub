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
in place. The UI has undergone a complete design overhaul (cyan-teal system, removal of AI tells,
role-based radii, border-only elevation) with the React #418 static route hydration bug resolved via
`<RelativeTime>`. The full gate has been verified post-redesign: `npm run check` exits 0 (format, lint,
typecheck, 222 unit and integration tests, a 26-route production build) and `npm run test:e2e` passes
177 tests across the desktop and mobile projects. Nothing that requires a third-party credential has
ever executed against the live service, so six capabilities are marked
`IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`. No job seeds harness products, plans or
monitored social accounts, and no job writes change events, so several live-mode feeds would be empty
even with credentials configured. Accessibility automation is structural only; axe is not installed.

## What to do first

Pick exactly one of these, in this order of preference.

### If you have credentials

1. **Verify Artificial Analysis.** Set `ARTIFICIAL_ANALYSIS_API_KEY`, then
   `NEXT_PUBLIC_DATA_MODE=live npm run jobs:run sync-models`. Capture the real response, replace the
   hand-written stub in `tests/integration/adapters-contract.test.ts` with a fixture of it, and
   reconcile the field map. The open questions are listed in
   `docs/08-research/source-reviews/artificial-analysis.md`.
2. **Apply and verify Supabase.** Follow `docs/05-operations/supabase-setup.md`, then run
   `npm run db:gen-types` and replace the hand-shaped client cast in
   `src/lib/data/supabase-repository.ts`. Verify RLS by attempting an anonymous write: it must fail.
3. **Create the QStash schedules** and confirm one accepted trigger per job. Then confirm that an
   unsigned POST is rejected with 401 in live mode.

### If you do not have credentials

1. **Seed harness products and plans** (backlog H1) so the pricing job has plans to attach snapshots
   to. Without it, harness snapshots can never be written in live mode. This is now the single
   highest-leverage change.
2. **Persist change events from diffs** (backlog H2). `writer.writeChangeEvents` and
   `writer.writeHarnessChangeEvents` already exist and are unused; wiring them makes the Releases
   and Changes feeds real in live mode.
3. **Seed monitored social accounts** (backlog H3) so the social job has accounts to poll.
4. **Fix KI-1** (backlog M1): report a quota-guard deferral as `deferred` rather than `failed`. It is
   a small change with a clear payoff, and it makes the later live verification readable.
5. **Add axe** (backlog H10). The Playwright suite already asserts structural accessibility
   fundamentals; axe would extend it to a real audit.

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
| Assuming the suite has not been run | It has. The last session recorded the exact results in `docs/09-handoffs/session-log.md`: `npm run check` exits 0 and `npx playwright test` passes 177 tests. Re-run both before trusting them for your own change |
| `npm run dev` failing with `Module parse failed: Unexpected character '@'` on `@tailwind base` | A globally exported `NODE_ENV=production` makes Next.js compile in production mode and break the CSS pipeline. `npm run dev` goes through `scripts/dev.mjs`, which pins `NODE_ENV=development`. Do not bypass that script |
| The same environment variable also silently skips devDependencies | With `NODE_ENV=production`, `npm install` omits `devDependencies`. Use `npm ci --include=dev` |
| `npm run test:e2e` reporting nothing to run | It does run: six spec files under `tests/e2e`, executed against the `chromium-desktop` and `chromium-mobile` projects. Playwright builds and starts the app on port 3100 in mock mode first, so a clean run takes a couple of minutes |
| A dashboard full of em dashes after connecting Artificial Analysis | The mapper returns `null` for an absent field, so a renamed field looks like missing data rather than an error. Compare against the field map in `docs/04-data/artificial-analysis-field-map.md` |
| A job reporting `failed` with "Deferred request: ..." | That is the quota guard being misclassified (KI-1), not a defect |
| A source showing as enabled that never produces items | `type: "html"` news sources have no adapter (KI-6) |
| `NEXT_PUBLIC_DATA_MODE` changed but nothing happened | The repository and fixtures are memoised per process (KI-11); restart. Also, `NEXT_PUBLIC_` values are build-time, so a deployment needs a redeploy |
| Harness pricing source reporting `deferred` with "No adapter registered" | The source `type` is not `official_pricing`, `official_site`, `rss`, `atom`, `social_api` or `github_releases`. Check the dispatch table in `docs/01-architecture/ingestion-architecture.md` |
| `writeHarnessProducts`, `writeHarnessPlans`, `writeChangeEvents`, `writeHarnessChangeEvents` | Implemented but unused by any job. Do not assume they run |
| `benchmark_definitions` and `model_benchmark_values` | Tables exist; no code reads or writes them |
| `private.raw_ingestion_payloads` | Table and retention index exist; nothing writes to it and nothing deletes from it |
| `previousSnapshot()` in fixtures and `signingKeysConfigured()` in verify | Dead exports |

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
| Credential verification for six capabilities | `docs/00-overview/project-status.md` section 2 |
| Ordered next work with file-level detail | `docs/03-implementation/current/backlog.md` |
| Defects and rough edges | `docs/03-implementation/current/known-issues.md` |
| Deliberate shortcuts and their cost | `docs/03-implementation/current/technical-debt.md` |
| Staged plan | `docs/07-product/roadmap.md` |
| Speculative ideas, not work | `docs/07-product/future-ideas.md` |
| Source review open questions | `docs/08-research/source-reviews/artificial-analysis.md` |
| Provider metadata options | `docs/08-research/alternatives/provider-metadata-sources.md` |
| No git history, license undecided | `LICENSE`, `docs/00-overview/project-status.md` section 6 |

## When you finish

1. Run the checks and record the real output: `npm run check`.
2. Update `docs/00-overview/project-status.md` and
   `docs/03-implementation/current/implementation-status.md` if any status changed.
3. Update `docs/03-implementation/current/{backlog,known-issues,technical-debt}.md`.
4. Add a phase record under `docs/03-implementation/history/`.
5. Add a `CHANGELOG.md` entry.
6. Update this handoff and `docs/09-handoffs/session-log.md`.
7. Persist the session summary to project memory if a memory tool is available, without secrets.
