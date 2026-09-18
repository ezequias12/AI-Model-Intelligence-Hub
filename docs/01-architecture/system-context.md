# System context

## Purpose

This document places AI Model Intelligence Hub in its environment: what consumes it,
what it depends on, and which parts are trusted with what.

## Context diagram

```text
                 +--------------------------+
                 |  Technical readers       |
                 |  (browser, desktop and   |
                 |   mobile viewports)      |
                 +------------+-------------+
                              |
                              | HTTPS (read-only application)
                              v
        +-----------------------------------------------+
        |        AI Model Intelligence Hub              |
        |        Next.js 15 App Router (Vercel)         |
        |                                               |
        |  Server components  --> repository layer       |
        |  Route handlers     --> job runner             |
        |  Client components  --> workspace state only   |
        +---+------------+---------------+--------------+
            |            |               |
            |            |               |
   (1) model metrics     | (2) persistence | (3) schedule triggers
            v            v               v
   +----------------+  +-------------+  +------------------+
   | Artificial     |  | Supabase    |  | Upstash QStash   |
   | Analysis Data  |  | Postgres    |  | cron + signature |
   | API (quota)    |  | public/     |  | verification     |
   +----------------+  | private     |  +------------------+
                       +-------------+
                              ^
                              | (4) writes, service role
                              |
        +-----------------------------------------------+
        |  Ingestion pipeline (server-only, job runner) |
        +---+-------------+--------------+--------------+
            |             |              |
            v             v              v
   +-------------+  +-------------+  +------------------+
   | Feeds: RSS, |  | Harness     |  | X API v2         |
   | Atom,       |  | pricing     |  | (authorized)     |
   | changelogs  |  | pages (HTML)|  +------------------+
   +-------------+  +-------------+
                          |
                          v
                   +------------------+
                   | World news wire  |
                   | (licensed)       |
                   +------------------+
```

## External systems

| System | Role | Direction | Trust | Status |
| --- | --- | --- | --- | --- |
| Artificial Analysis Data API | Primary model metrics and pricing | Outbound only | Third party, quota-limited | Adapter implemented; live verification pending `ARTIFICIAL_ANALYSIS_API_KEY` |
| Supabase (Postgres) | Persistence for all entities, snapshots, runs and change events | Outbound only, service role | First party infrastructure | Repository and writer implemented; live verification pending `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| Upstash QStash | Cron schedules and signed triggers | Inbound (triggers) and outbound (schedule management script) | Third party | Verification and script implemented; live verification pending `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `QSTASH_TOKEN`, `QSTASH_TARGET_BASE_URL` |
| Provider and research feeds | AI news and research signal | Outbound only | Mixed trust, tiered 1-3 | Parser implemented; live fetch depends on live mode and an enabled source |
| Harness pricing pages | Plan prices, credits and model access | Outbound only | Vendor-published factual pages | Extractor implemented and versioned; selectors need live verification |
| X API v2 | Social pulse signal | Outbound only | Requires authorized access | Adapter implemented; source disabled without `X_BEARER_TOKEN` |
| World news wire provider | Neutral world and political news | Outbound only | Licensed provider required | Adapter implemented; source disabled without `WORLD_NEWS_API_KEY` and `WORLD_NEWS_BASE_URL` |
| Vercel | Hosting and runtime | Deployment target | First party infrastructure | Deployment guide documented; no deployment performed here |

## Consumers

| Consumer | Interaction |
| --- | --- |
| Human readers | Read-only web UI. No write path from the browser exists: there is no application authentication and no CRUD surface. |
| Scheduled jobs | QStash POSTs to `/api/jobs/[job]` with an Upstash signature. Rejected when verification fails in live mode. |
| Local operators | `scripts/jobs/run-local.mjs` calls the same job endpoint; `scripts/jobs/create-schedules.mjs` manages schedules; `scripts/db/generate-types.mjs` generates types. |
| Health checks | `GET /api/health` reports mode, degraded state and unconfigured capabilities. |

## Trust zones

| Zone | Contents | Trust |
| --- | --- | --- |
| Browser | Rendered UI, local storage keys (`amih.*`), selection state | Untrusted. Never receives a `NEXT_PUBLIC_` secret, never receives raw payloads. |
| Next.js server | Server components, route handlers, adapters, repository, writer | Trusted for reads of secrets. All secrets are read here. |
| Supabase `public` schema | Published content, read through RLS | Read-only for `anon`/`authenticated`; write only as `service_role`. |
| Supabase `private` schema | Raw ingestion payloads and operational artefacts | Revoked from `anon`/`authenticated`; `service_role` only. |
| Third-party APIs | Upstream sources | Untrusted input. Every payload is parsed with Zod and never trusted to be well-shaped. |

## Boundaries the architecture deliberately enforces

1. **Political isolation.** `world_politics` content enters only through
   `src/lib/adapters/world.ts` and is never read by model or harness scoring code.
   `assertNoPoliticalMetrics()` in `src/lib/domain/world.ts` makes this testable, and
   `tests/unit/world-neutrality.test.ts` asserts that no ranking board metric key
   contains `political`, `ideolog` or `partisan`.
2. **Adapter isolation.** Adapters never call `fetch` directly; all outbound HTTP
   passes through `HttpClient` so quota discipline and retry behaviour live in one
   place.
3. **UI isolation from storage.** Components depend on the `IntelligenceRepository`
   interface, never on Supabase directly, which is what makes mock mode a genuine
   mode rather than a test-only path.
4. **No full-article mirroring.** Only a permitted excerpt and a link are stored.
