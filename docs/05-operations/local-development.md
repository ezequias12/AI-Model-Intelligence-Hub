# Local development

## Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | `>=20.9.0` | Declared in `package.json` under `engines` |
| npm | Bundled with Node | `package-lock.json` is committed |
| Supabase CLI | Latest | Only needed for migrations and `npm run db:gen-types` |
| Playwright browsers | Only for E2E | `npm run test:e2e:install` |

No credentials are required to run the application. Mock mode is the default.

## First run

```bash
git clone https://github.com/ezequias12/AI-Model-Intelligence-Hub.git
cd AI-Model-Intelligence-Hub
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The shell shows a banner stating that every value on the screen
is a deterministic fixture, and the freshness label is derived from the fixture capture time.

`npm run dev` runs through `scripts/dev.mjs`, which pins `NODE_ENV=development` before starting
`next dev`. A machine or CI image that exports `NODE_ENV=production` globally would otherwise make
Next.js compile in production mode and fail with
`Module parse failed: Unexpected character '@'` on the first `@tailwind` line. The launcher makes
the dev server deterministic on every platform without adding a `cross-env` dependency and without
touching your shell configuration.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint over `src` and `tests` |
| `npm run format` / `npm run format:check` | Prettier write / verify |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` / `test:watch` / `test:coverage` | Vitest |
| `npm run test:e2e` | Playwright smoke suite (builds and serves the app in mock mode on port 3100) |
| `npm run test:e2e:install` | Install the Playwright `chromium` browser |
| `npm run check` | Format check, lint, typecheck, test, build |
| `npm run jobs:run sync-models` | Call the job endpoint of a running app |
| `npm run jobs:schedule` | Create QStash schedules (needs `QSTASH_TOKEN` and `QSTASH_TARGET_BASE_URL`) |
| `npm run db:gen-types` | Generate Supabase types (needs the CLI and a linked project) |

## Running jobs locally

The local runner calls the same HTTP endpoint the scheduler calls, so local execution uses the
production code path.

```bash
npm run dev                     # terminal 1
npm run jobs:run sync-ai-news   # terminal 2
npm run jobs:run sync-models --dry-run
npm run jobs:run sync-ai-news --source=openai-blog-rss
JOB_BASE_URL=https://your-deployment npm run jobs:run sync-world-news
```

In mock mode every source reports `deferred` with a message explaining that no live fetch
happened. That is intentional: the runner must not claim a fetch it did not perform. To see an
adapter actually run, set `NEXT_PUBLIC_DATA_MODE=live` and configure the relevant credential
plus a Supabase project.

`GET /api/jobs` lists the registered jobs and crons:

```bash
curl http://localhost:3000/api/jobs/anything
```

## Checking configuration

```bash
curl http://localhost:3000/api/health
```

The response reports `dataMode`, `degraded`, `degradedReason`, `datasetCapturedAt`,
`capabilities` and `pendingCredentials`.

## Project structure

The layout and layer responsibilities are in
`docs/01-architecture/application-architecture.md`. The practical rules while developing:

- Domain logic goes in `src/lib/domain/**` and must stay pure (no I/O, no `process.env`).
- Anything that talks to a network or a database belongs in `src/lib/adapters/**` or
  `src/lib/data/**`.
- New metrics are registered in `src/lib/analytics/metric-registry.ts`, not computed inside a
  component.
- New routes follow the existing pattern: a thin page that loads a workspace via
  `src/lib/data/workspace.ts` and passes plain data to a client component.

## Testing

```bash
npm run test                                  # unit + integration
npx vitest run tests/unit/metrics.test.ts      # one file
npm run test:coverage                          # coverage over src/lib
npm run test:e2e:install && npm run test:e2e   # E2E (desktop + mobile smoke suite)
```

`vitest.config.ts` sets `environment: "node"`, globals on, includes
`tests/unit/**/*.test.ts` and `tests/integration/**/*.test.ts`, and runs
`tests/setup/vitest.setup.ts`, which pins `NEXT_PUBLIC_DATA_MODE=mock`.

`playwright.config.ts` targets `tests/e2e`, uses port 3100 by default, and starts
`npm run build && npm run start` with `NEXT_PUBLIC_DATA_MODE=mock` unless `E2E_BASE_URL` is
set. It defines two projects, `chromium-desktop` (1440x900) and `chromium-mobile` (Pixel 7).
The specs cover the shell, Models, News, Harness, World/system workspaces and accessibility
fundamentals.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| The banner says "Live mode - degraded" | `NEXT_PUBLIC_DATA_MODE=live` without Supabase credentials | Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, or set the mode back to `mock` |
| A mode change appears to have no effect | The repository and fixture bundle are memoised per process | Restart the dev server |
| `next dev` fails with `Module parse failed: Unexpected character '@'` on an `@tailwind` line | A globally exported `NODE_ENV=production` makes Next.js compile in production mode | Run the dev server through `npm run dev`, which pins `NODE_ENV=development` via `scripts/dev.mjs`, instead of invoking `next dev` directly |
| `POST /api/jobs/...` returns 500 | No QStash signing keys and the mode is `live` | Set both signing keys, or use mock mode where the unverified path is allowed |
| A job reports `deferred` for every source | Mock mode, or a dry run, or Supabase not configured | Expected in mock mode; configure Supabase for real writes |
| `npm run db:gen-types` fails | The Supabase CLI is missing or the project is not linked | Install the CLI and run `npx supabase link --project-ref <ref>` |
| ESLint complains about unused variables | `@typescript-eslint/no-unused-vars` is an error | Prefix intentionally unused bindings with `_` |
| TypeScript errors about `possibly undefined` | `noUncheckedIndexedAccess` is enabled | Handle the index access explicitly |

## Conventions worth remembering

- Unknown values render as an em dash, never `0` and never `N/A`.
- Never fabricate a value the source did not publish; return `null`.
- Never present fixture data as live; the mode banner and `meta` exist for this reason.
- Prefer adding a metric to the registry over adding a bespoke calculation to a component.
