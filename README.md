# AI Model Intelligence Hub

Canonical product name: **AI Model Intelligence Hub**
Canonical repository: `AI-Model-Intelligence-Hub`

An information-dense intelligence portal for AI models, AI news, coding-agent
subscriptions (coding harnesses) and neutral world news. It is deliberately not a
marketing landing page and not a generic admin dashboard: the hierarchy comes from
the product domains, and the primary workspace is Models.

## Status

The application code, database migrations, fixtures and unit/integration tests are
in place and run against deterministic fixtures by default. A GitHub Actions workflow
(`.github/workflows/ci.yml`) and a Playwright end-to-end suite (`tests/e2e`) are committed;
no CI run has executed yet. Integrations that need
third-party credentials are implemented but have never executed against a live
endpoint from this repository. See
[`docs/03-implementation/current/implementation-status.md`](docs/03-implementation/current/implementation-status.md)
and [`docs/00-overview/project-status.md`](docs/00-overview/project-status.md) for
the exact checklist, and the "Pending credentials" section below.

Nothing in this document claims a test result. Run the checks yourself.

## What it does

Two core worlds plus supporting workspaces:

- **Models** (primary): metric leaders, Top 10 ranking boards, configurable
  landscape charts with a Pareto frontier, a dense research table with CSV export,
  model detail with snapshot history, cost-efficiency modes and provider
  segmentation.
- **News & Watch**: AI news by domain, provider feeds, social pulse (authorized
  APIs only), research/benchmark signal, coding-harness plan tracking with price
  and credit history, and a separate neutral World & Politics feed.

Feature list:

| Area | What exists |
| --- | --- |
| App shell | Left rail with four sections, workspace sub-navigation, command palette search, freshness indicator, data-mode banner, dark mode |
| Models | Dashboard, Rankings, Landscape, Table, Releases, per-model detail route |
| Selection | Persistent selected-model tray, dynamic default comparison set, presets, provider-group filters, URL + local-storage state |
| Metrics | Measured and derived metrics driven by one registry; blended price, monthly workload cost, value scores, Pareto frontier |
| Harness Watch | Overview, Plans, Compare, Cheapest, Changes, News, budget calculator |
| News | Overview, AI General, Providers, Social Pulse, Research, saved searches |
| World & Politics | Nine region/category tabs, attribution-first summaries, neutrality guardrails enforced in code |
| Compare | Model comparison and a separate harness-plan comparison mode (schemas never mixed) |
| Watchlists | Locally persisted watchlists over models, providers, harness products, topics and news queries |
| Sources | Source registry with adapter status, freshness, rate-limit state and run history |
| Methodology | Every metric, formula, threshold and limitation in one place |
| Ingestion | Seven registered jobs, adapter contract, ingestion ledger, idempotent upserts, QStash signature verification |
| Storage | Six Supabase migrations, RLS on every public table, private schema for raw payloads |

## Quick start

Requirements: Node.js `>=20.9.0`.

```bash
git clone https://github.com/ezequias12/AI-Model-Intelligence-Hub.git
cd AI-Model-Intelligence-Hub
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. With no credentials and no configuration the app runs
in mock mode: every screen works against deterministic fixtures and every screen is
labelled as fixture data. No Supabase project is required to browse the product.

## Scripts

| Script | Command | What it does |
| --- | --- | --- |
| `npm run dev` | `node scripts/dev.mjs` | Development server (pins `NODE_ENV=development`) |
| `npm run build` | `next build` | Production build |
| `npm run start` | `next start` | Serve a production build |
| `npm run lint` | `next lint` | ESLint over `src` and `tests` |
| `npm run format` | `prettier --write .` | Write formatting |
| `npm run format:check` | `prettier --check .` | Verify formatting |
| `npm run typecheck` | `tsc --noEmit` | TypeScript strict check |
| `npm run test` | `vitest run` | Unit + integration tests |
| `npm run test:watch` | `vitest` | Vitest in watch mode |
| `npm run test:coverage` | `vitest run --coverage` | Coverage over `src/lib` |
| `npm run test:e2e` | `playwright test` | Playwright smoke suite (desktop and mobile projects, mock mode) |
| `npm run test:e2e:install` | `playwright install --with-deps chromium` | Install Playwright browsers |
| `npm run check` | format:check, lint, typecheck, test, build | Full local gate |
| `npm run db:gen-types` | `node scripts/db/generate-types.mjs` | Generate Supabase types (needs the CLI and a linked project) |
| `npm run jobs:schedule` | `node scripts/jobs/create-schedules.mjs` | Create/refresh QStash schedules (needs `QSTASH_TOKEN` and `QSTASH_TARGET_BASE_URL`) |
| `npm run jobs:run` | `node scripts/jobs/run-local.mjs <job>` | Run a job through the HTTP endpoint of a running app |

## Data modes

`NEXT_PUBLIC_DATA_MODE` selects one of two modes.

| Mode | Credentials | Behaviour |
| --- | --- | --- |
| `mock` (default) | None | Deterministic fixtures for models, news, social, harness and world data. Clearly labelled in the UI. |
| `live` | Supabase plus per-source keys | Real adapters; every source that is not configured reports `not_configured` or `deferred` instead of inventing data. |

If live mode is requested while Supabase is not configured, the repository factory
falls back to fixtures and labels the state **"Live mode - degraded"** with the
reason. The application never presents fixture data as live data.

## Documentation

Start at [`docs/README.md`](docs/README.md). Most useful entry points:

| Need | Document |
| --- | --- |
| Honest status and gaps | [`docs/00-overview/project-status.md`](docs/00-overview/project-status.md) |
| How the system fits together | [`docs/01-architecture/system-context.md`](docs/01-architecture/system-context.md) |
| Database tables and RLS | [`docs/01-architecture/database-schema.md`](docs/01-architecture/database-schema.md) |
| Metrics and formulas | [`docs/04-data/scoring-methodology.md`](docs/04-data/scoring-methodology.md) |
| Environment variables | [`docs/05-operations/environment-variables.md`](docs/05-operations/environment-variables.md) |
| Scheduled jobs | [`docs/05-operations/qstash-schedules.md`](docs/05-operations/qstash-schedules.md) |
| Tests | [`docs/06-quality/testing-strategy.md`](docs/06-quality/testing-strategy.md) |
| Working on the repo | [`CONTRIBUTING.md`](CONTRIBUTING.md), [`AGENTS.md`](AGENTS.md), [`SECURITY.md`](SECURITY.md) |
| Where the next agent starts | [`docs/09-handoffs/agent-handoff.md`](docs/09-handoffs/agent-handoff.md) |

## Pending credentials

These integrations are implemented in code but cannot be verified until the listed
variables are set. Each is marked `IMPLEMENTED - LIVE VERIFICATION PENDING
CREDENTIALS` in the status documents.

| Capability | Variables | Without them |
| --- | --- | --- |
| Artificial Analysis live model metrics | `ARTIFICIAL_ANALYSIS_API_KEY` | Adapter returns `not_configured`; the app keeps fixture models |
| Supabase persistence and live reads | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Live mode degrades to fixtures with a visible banner |
| QStash schedules and signature verification | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `QSTASH_TARGET_BASE_URL` | No schedules are created; the job endpoint refuses unverified triggers in live mode |
| Social / X ingestion | `X_BEARER_TOKEN` | `x-monitored-accounts` stays disabled; the adapter issues no requests |
| World news provider | `WORLD_NEWS_API_KEY`, `WORLD_NEWS_BASE_URL` | `world-primary-wire` stays disabled; World workspace shows fixtures |
| LLM summaries | `LLM_SUMMARY_API_KEY` | Not implemented; news `summary` is always `null` and the UI falls back to the source excerpt |

`GET /api/health` reports the mode, degraded state and the list of unconfigured
capabilities.

## Attribution and licensing

- Model metrics are sourced from the Artificial Analysis Data API. Attribution is
  required and quota must be respected; the code never scrapes it to bypass limits.
- Harness plan values are published pricing-page values captured as timestamped
  snapshots with a source URL. They are not permanent truth.
- News items store a short permitted excerpt and a link. Full articles are never
  mirrored.
- The repository has no license yet. See [`LICENSE`](LICENSE): the owner must choose
  one before publication.
