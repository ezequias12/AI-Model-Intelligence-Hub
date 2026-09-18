# Vercel deployment

No deployment has been performed from this repository. This is the documented procedure,
based on the code and configuration actually present.

## Prerequisites

| Item | Note |
| --- | --- |
| Vercel account and a project | Either import the repository or create a project and connect it |
| Supabase project with migrations applied | See `docs/05-operations/supabase-setup.md`. Optional if you deploy in mock mode. |
| Artificial Analysis API key | Optional; without it model metrics come from fixtures |
| Upstash QStash account | Optional; required only for scheduled ingestion |
| Social and world news credentials | Optional; both sources are disabled by default |

## 1. Import the project

Repository: `https://github.com/ezequias12/AI-Model-Intelligence-Hub`

Framework preset: Next.js (auto-detected from `next.config.ts` and `package.json`).

| Setting | Value |
| --- | --- |
| Build command | `npm run build` (default) |
| Output | `.next` (default) |
| Install command | `npm install` (default) |
| Node version | `>=20.9.0` as declared in `engines`; set the runtime to Node 20 or later |
| Root directory | Repository root |

There is no `vercel.json` in the repository and none is required.

## 2. Environment variables

Set these in the Vercel project settings. The full reference is
`docs/05-operations/environment-variables.md`.

Minimum for mock mode:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_DATA_MODE` | `mock` |

Live mode:

| Variable | Required | Server-only |
| --- | --- | --- |
| `NEXT_PUBLIC_DATA_MODE` | Yes | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Yes** |
| `ARTIFICIAL_ANALYSIS_API_KEY` | For live model metrics | Yes |
| `ARTIFICIAL_ANALYSIS_BASE_URL` | Optional | Yes |
| `QSTASH_CURRENT_SIGNING_KEY` | For job verification | Yes |
| `QSTASH_NEXT_SIGNING_KEY` | For job verification | Yes |
| `QSTASH_TOKEN` | For the schedule script only | Yes |
| `QSTASH_TARGET_BASE_URL` | For the schedule script only | Yes |
| `X_BEARER_TOKEN` | Optional | Yes |
| `WORLD_NEWS_API_KEY` | Optional | Yes |
| `WORLD_NEWS_BASE_URL` | Required together with the key | Yes |
| `LLM_SUMMARY_API_KEY` | Not usable yet (no client) | Yes |

Mark server-only values as "Sensitive" in Vercel where available. Never use a
`NEXT_PUBLIC_` prefix for a secret: those values are inlined into the client bundle.

## 3. Deploy

```bash
npm run build   # verify locally first
```

Then deploy through the Vercel dashboard or the CLI. Watch the build log for the usual causes:
a TypeScript error (`tsc --noEmit` runs as part of the build), a lint error, or an ESLint
failure on unused variables.

Recommended local gate before deploying:

```bash
npm run check
```

## 4. Verify the deployment

| Check | Command or location |
| --- | --- |
| Health and configuration | `GET /api/health` - expect `ok: true` and `degraded: false` for a fully configured live deployment |
| Job registry | `GET /api/jobs/anything` - lists the seven jobs |
| Signature enforcement | `POST /api/jobs/sync-models` without an `Upstash-Signature` header must return 401 in live mode |
| Mock banner | In mock mode the shell must state that values are fixtures |
| Degraded banner | In live mode without Supabase the shell must say "Live mode - degraded" and name the reason |
| Model data | `/models` renders leader cards and boards; `/models/table` renders rows and exports CSV |
| Empty states | `/news/social` and `/world` show fixture data and a disabled-source note while the credentials are unset |

```bash
curl https://your-deployment/api/health
curl -i -X POST https://your-deployment/api/jobs/sync-models
```

## 5. Point QStash at the deployment

```bash
QSTASH_TOKEN=<token> \
QSTASH_TARGET_BASE_URL=https://your-deployment \
npm run jobs:schedule
```

The script creates one schedule per job with id `amih-<job-key>` and destination
`<base>/api/jobs/<job-key>`. It is safe to re-run: existing schedules with the same id are
deleted first. See `docs/05-operations/qstash-schedules.md`.

`QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` must be the keys for the same QStash
account, or every scheduled request will be rejected.

## 6. Runtime considerations

| Consideration | Detail |
| --- | --- |
| Job route duration | `export const maxDuration = 300` on `src/app/api/jobs/[job]/route.ts`. Check your plan's function duration limit; a long `sync-models` run with pagination needs it. |
| Runtime choice | The route handlers use the Node.js runtime (Supabase, Upstash and the adapters use Node APIs). Do not switch the job route to the Edge runtime without verifying the adapters. |
| Cold starts and fixtures | Fixtures are built lazily and memoised per process; a cold start rebuilds them. The dataset is small. |
| No caching layer | Every render reads the repository. With Supabase this is one query per entity per page render. |
| Cache invalidation | No `revalidate` values are declared, so there is no ISR behaviour to reason about. |
| Logs | `console.error` is used for row-validation failures and select failures; other diagnostics come from job responses. |
| `NEXT_PUBLIC_` values are build-time | Changing `NEXT_PUBLIC_DATA_MODE` requires a redeploy, not just an environment edit. |
| Preview deployments | They inherit the environment variables of the selected scope. Do not point a preview at the production service-role key. |

## 7. Optional extra protection

The application has no authentication. If the deployment is not on a private network, protect
it at the platform level, for example with Vercel Deployment Protection (password or Vercel
Authentication) or an allowlist. The app sets `robots: { index: false, follow: false }`, which
discourages indexing but is not access control.

## 8. Security headers

`next.config.ts` sets `reactStrictMode: true`, `poweredByHeader: false` and disables typed
routes and typed env. It sets **no** custom security headers and no Content Security Policy.
Adding them is backlog item M9.

## 9. Rollback

See `docs/05-operations/runbooks/rollback.md`. In short: roll back the deployment in Vercel,
remember that a `NEXT_PUBLIC_` change needs a redeploy, and note that database migrations are
forward-only in this repository (there are no down migrations).

## 10. What deployment does not fix

Deploying does not make the integrations live. The following remain
`IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` until their variables are set and a run
is observed: Artificial Analysis calls, Supabase persistence, QStash schedules and signature
verification, social ingestion, world news, and harness pricing selectors. In addition, no job
seeds harness products, harness plans or monitored social accounts, and no job writes change
events (see the known issues list).
