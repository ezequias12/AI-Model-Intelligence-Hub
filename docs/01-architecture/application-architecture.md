# Application architecture

## Shape

A modular monolith: one Next.js application, one deployment unit, with internal
module boundaries that are enforced by directory structure and import discipline rather
than by separate services. All layers except the fixtures and pure domain logic are
server-side.

```text
src/
  app/                  route entry points (pages + API handlers)
  features/             workspace UI (server wrappers + client views)
  components/           shell, UI primitives, overlay, theme
  lib/
    domain/             Zod schemas + pure logic (no I/O)
    analytics/          metric registry + analytics assembly (pure)
    adapters/           source adapters sharing one result envelope
    data/               repository contract, mock + Supabase implementations, workspace loaders
    db/                 row schemas + row-to-domain mappers
    ingestion/          job runner, writer, harness extraction configs
    jobs/               job registry + QStash verification
    fixtures/           deterministic data for mock mode and tests
    format/             display formatting (em dash for unknown)
    search/             command palette index
    nav.ts              navigation model
    utils/              small guards and class-name helper
supabase/migrations/    schema, indexes, RLS, seed data
scripts/                schedule creation, local job run, type generation
tests/                  unit + integration suites, vitest setup
```

## Layer responsibilities

| Layer | Owns | Must not |
| --- | --- | --- |
| `lib/domain` | Entity schemas, metric math, selection logic, hashing, diffing, freshness, harness metrics, world guardrails | Perform I/O, import React, read `process.env` |
| `lib/analytics` | Metric registry and the exact structures the workspace renders (leaders, boards, chart points, release rows) | Duplicate metric math already in `lib/domain` |
| `lib/adapters` | Talking to a source, mapping its payload to domain objects, reporting rate-limit state | Call `fetch` directly, write to the database, knowing about React |
| `lib/data` | Repository contract, mode resolution, workspace loading, degraded fallback | Contain presentation logic |
| `lib/db` | Row schemas and mappers | Be the only validation layer (adapters validate too) |
| `lib/ingestion` | Executing a job, recording a run, writing rows idempotently | Decide business rules that belong in `lib/domain` |
| `lib/jobs` | Job registry and inbound signature verification | Hold source-specific parsing logic |
| `app` | Route entry points, metadata, data loading for a route | Hold large amounts of business logic |
| `features` | Rendering, interaction, workspace-local state | Talk to Supabase directly |

## Rendering strategy

| Concern | Approach |
| --- | --- |
| Default | Server components. `src/app/layout.tsx` loads the repository, builds the search index and computes freshness on every request. |
| Interactivity | Client components in `src/features/**` marked `"use client"`. |
| Cache | No `fetch` cache configuration and no `revalidate` values are declared; `GET /api/health` and the job route set `export const dynamic = "force-dynamic"`. |
| Workspace state | `ModelsWorkspaceProvider` (`src/features/models/workspace-context.tsx`) builds contexts once on the client from serialised props and owns the selection state. |
| Serialisation | Server wrappers pass plain data (records and arrays) into client components. Deltas are passed as `previousByModelId` and history as `snapshotsByModelId`, capped at 12 snapshots per model by `groupSnapshotsByModel`. |

## Key modules

### Domain and schema

`src/lib/domain/schema.ts` is the single source of truth for every entity shape. Types
are inferred from the Zod schemas (`z.infer`), so runtime validation and static types
cannot drift. It also defines the scoring configuration constants
(`DEFAULT_BLENDED_PRICE_WEIGHTS = { input: 0.75, output: 0.25 }`,
`DEFAULT_WEIGHTED_VALUE_WEIGHTS = { intelligence: 0.5, coding: 0.3, agentic: 0.2 }`)
and `resolveDataMode()`, which treats any unrecognised value as `mock`.

### Metric registry

`src/lib/analytics/metric-registry.ts` declares every metric once with `key`, `label`,
`group`, `direction`, `provenance` (`measured` | `derived`), `unit`, `description`,
a `get(context)` accessor and a `format(value)` function. The table, the charts, the
rankings and the Methodology page all read from this registry, so a metric cannot mean
two different things in two screens. `buildModelContexts()` attaches the provider, the
default blended price, the previous snapshot metrics and the population used for
normalisation.

### Analytics assembly

`src/lib/analytics/index.ts` turns contexts into view structures:
`computeLeaderCards`, `computeRankings`, `computeLandscapeChart` and `computeReleases`.
Ranking boards carry `excludedBelowThreshold` and `excludedNoData` counts so the UI can
state what was filtered out instead of hiding it.

### Selection

`src/lib/domain/selection.ts` owns the default comparison set (`DEFAULT_SLOTS` plus
`resolveDefaultSelection`), presets (`applyPreset`), provider scope
(`applyProviderScope`), URL encoding (`encodeSelection` / `decodeSelection` /
`reconcileSelection`) and the comparison cap (`MAX_COMPARISON_MODELS = 8`).

### Data access

`src/lib/data/repository.ts` defines `IntelligenceRepository`. Two implementations
exist: `mock-repository.ts` (fixtures) and `supabase-repository.ts` (service role,
per-row Zod validation, `console.error` on an invalid row instead of throwing).
`src/lib/data/index.ts` caches the resolved repository for the process and creates a
degraded repository when live mode is requested without Supabase credentials.

### Ingestion

`src/lib/jobs/registry.ts` declares seven jobs with cron and domains.
`src/lib/ingestion/runner.ts` executes any job key: it resolves the sources for the
job, skips disabled sources, defers everything in mock mode or on `dryRun`, otherwise
calls the matching adapter and records an `IngestionRun`. `src/lib/ingestion/writer.ts`
performs chunked upserts (200 rows per chunk) keyed by `onConflict` so a retried run is
idempotent, and becomes a no-op writer when Supabase is not configured.

## Deliberate architectural constraints

1. **One metric registry.** No screen computes its own version of a metric.
2. **No hidden numbers.** A derived metric returns `null` when an input is missing;
   `src/lib/format/index.ts` renders `null` as an em dash.
3. **One HTTP client.** Quota guard, `Retry-After` handling and backoff are centralised
   in `src/lib/adapters/http.ts`.
4. **Two real modes, never a fake third.** Mock mode and live mode, with degraded live
   mode surfaced as a labelled state rather than a silent fallback.
5. **Domain logic is pure.** Every function in `src/lib/domain` that computes a value
   can be called from a unit test with no environment.
6. **Server-only secrets never cross to the client.** See `SECURITY.md`.

## Known structural limitations

- `src/lib/data/supabase-repository.ts` uses a hand-shaped client interface
  (`unchecked`) because generated Supabase types are not present. The intended fix is
  `npm run db:gen-types` once the CLI is linked.
- Row schemas in `src/lib/db/rows.ts` are hand-written mirrors of the SQL. They must be
  updated in the same change as a migration.
- There is no cache layer or background revalidation between the database and the
  pages; each render reads the repository.
- There is no observability integration (no tracing, no log shipping), only console
  logging and the in-app Sources view.
