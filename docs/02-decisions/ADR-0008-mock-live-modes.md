# ADR-0008: Mock mode is a first-class mode, and degraded live mode is surfaced

- Status: Accepted
- Date: 2026-09-18
- Deciders: implementation agent (autonomous phase)

## Context

Several integrations need third-party credentials: the Artificial Analysis Data API, a
Supabase project, Upstash QStash signing keys, an authorized X API token, a licensed world
news provider and (for a capability that is not implemented) an LLM key.

Two responses are tempting and both are wrong:

1. **Ship with empty screens.** "The Models workspace requires `ARTIFICIAL_ANALYSIS_API_KEY`"
   is honest but useless. Nothing can be built, reviewed or verified, and a reviewer cannot
   tell a rendering bug from a missing credential.
2. **Fake the live path.** Seed a database with plausible rows and present them as current
   data. This is worse than useless: it produces confident wrong numbers, it hides the real
   integration state, and it removes the pressure to configure anything.

There is a third, subtler failure: a request for live mode that silently falls back to
fixtures. The user believes they are looking at live data; the numbers are invented but
labelled as real by omission. That is the same sin as (2) with better intentions.

Meanwhile, the repository must be genuinely useful with no credentials: a reviewer should be
able to clone it, run it and see the whole product, including every workspace, every chart
and every state.

## Decision

Mock mode is a first-class data mode, and any degradation of live mode is surfaced rather
than hidden.

1. **Two modes exist and both are real.** `NEXT_PUBLIC_DATA_MODE` resolves through
   `resolveDataMode()` to `mock` or `live`; anything unrecognised, including unset, resolves
   to `mock`. `mock` never requires credentials. `live` uses real adapters.
2. **Mock mode powers the whole product.** `createMockRepository()` is backed entirely by the
   deterministic fixtures in `src/lib/fixtures/**`, and every page in every workspace renders
   from it. Determinism is deliberate: fixtures accept a fixed `now` and are asserted to be
   byte-identical for the same timestamp in `tests/integration/repository.test.ts`, which is
   what makes E2E work possible later.
3. **Mode is visible in the UI.** The root layout renders a `DataModeBanner` in mock mode
   stating that every value on the screen is a deterministic fixture and is labelled as
   such. The shell also shows a "Mock data" or "Live" label.
4. **Missing credentials are reported, not hidden.** Each adapter returns
   `not_configured` and names the environment variable
   (`NOT_CONFIGURED(what, envVar)`). `runJob` reports such a source as `not_configured`
   rather than `ok`, and the Sources workspace renders the state.
5. **Degraded live mode is a labelled state, not a silent fallback.** If live mode is
   requested and Supabase credentials are absent, `createDegradedRepository()` returns a
   repository built on fixtures whose `meta` says `label: "Live mode - degraded"`,
   `degraded: true` and a `degradedReason` naming the missing variables. The UI renders a
   banner with that reason, and `GET /api/health` returns `ok: false` with `degraded: true`
   and a `pendingCredentials` list.
6. **Jobs never claim a write they did not perform.** In mock mode, or on a dry run, every
   enabled source is reported as `deferred` with an explanatory message; and in live mode
   without Supabase the adapters run but the writer is a no-op that reports zero rows
   written. `tests/integration/adapters-contract.test.ts` asserts that the written total is
   zero for every job while Supabase is unconfigured.
7. **Capability reporting is explicit.** `describeCapabilities()` enumerates the six
   credential-dependent capabilities with a `configured` boolean and a note, and
   `buildDataSourceMeta()` carries that list into the UI.

## Consequences

Positive:

- The repository is fully reviewable with no credentials: every workspace, chart and state
  is reachable in mock mode.
- The distinction between "not configured" and "broken" is explicit in the data model
  (`not_configured` versus `failed`), which makes troubleshooting tractable.
- Tests are deterministic because they run against fixtures with a pinned clock, so a
  failure means a real regression rather than an upstream change.
- A user can never mistake fixture data for live data, because the banner says so and the
  health endpoint says so.
- The same `IntelligenceRepository` interface serves both paths, so the UI has no
  mock-specific branches buried in components.

Negative:

- Fixture data can be mistaken for realistic values by a careless reader, since the numbers
  are plausible (deliberately so, to exercise rankings and frontiers). The banner is the only
  guard.
- Some behaviours are only reachable in live mode: real pagination, real quota exhaustion,
  real RLS enforcement, real signature verification. Those remain
  `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`.
- Mock mode can hide a problem: a component that only works with fixture shapes would pass in
  mock mode and fail against live data, because fixtures are validated by the same schemas
  but do not exercise real payload variety. Contract tests with stub payloads are the partial
  mitigation.
- The process-wide repository and fixture caches (`cached` in `src/lib/data/index.ts`,
  `cached` in `src/lib/fixtures/index.ts`) mean a mode change requires a restart.
- A degraded deployment is still an operational problem. Surfacing it makes it visible; it
  does not fix it.

## Alternatives considered

1. **Require credentials for the app to start.** Rejected. It makes the repository
   unverifiable and blocks any work that does not need live data.
2. **Seed a real database with plausible rows and present them as data.** Rejected. It
   fabricates current values, which is exactly the failure the product exists to avoid.
3. **Silently fall back to fixtures when live mode is requested.** Rejected. It is the same
   fabrication with less honesty. Degradation must be labelled and must name the missing
   variable.
4. **A third "hybrid" mode that mixes live and fixture rows.** Rejected. It would make the
   provenance of any single row ambiguous, which breaks the freshness and attribution
   guarantees.
5. **Gate mock mode behind a build flag so production cannot run it.** Rejected. The mode is
   operational, not a build property; an owner may legitimately run a degraded deployment and
   needs to see the label.
6. **Rely on tests alone for the no-credential story.** Rejected. Tests verify internals; a
   reviewer needs a running product to judge the design.
