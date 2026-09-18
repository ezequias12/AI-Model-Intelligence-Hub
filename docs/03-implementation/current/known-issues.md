# Known issues

Defects and rough edges observed by reading the code. Each entry states the behaviour,
why it is a problem, and where it lives. Severity is assessed against the product's own
promises (never invent a number, always date a value, report state honestly).

None of these were introduced by the documentation phase; they are properties of the
implementation as written.

## Correctness

### KI-1 - A quota-guard deferral is reported as a failure

Severity: medium.

`HttpClient` refuses to issue a request when the reported remaining quota is below
`minRemaining`, throwing `QuotaGuardError` with the message
`Deferred request: N quota remaining, M required.`

The Artificial Analysis adapter classifies errors by testing the message for
`/rate limited/i`, so a quota-guard error becomes `code: "network"`, `retryable: true`. The
runner then reports the source as `failed` because the code is neither `not_configured`
nor `rate_limited`. A deliberate, benign deferral therefore looks like a failure in the
Sources workspace.

Files: `src/lib/adapters/http.ts`, `src/lib/adapters/artificial-analysis.ts`,
`src/lib/ingestion/runner.ts`.

### KI-2 - A `null` capability value is not excluded by the capability threshold

Severity: low.

`computeRankings` increments `excludedBelowThreshold` only when the capability value is
non-null and below the threshold:

```typescript
if (options.minimumCapability > 0 && capability !== null && capability < options.minimumCapability)
```

A model whose capability is unknown is therefore retained even when a threshold is set, and
can appear on a cost-efficiency board with a value derived from the threshold-independent
price. It cannot top the board with a fabricated capability (derived metrics return `null`
and `rankBy` drops nulls), but it is not excluded by the gate either.

Files: `src/lib/analytics/index.ts`.

### KI-3 - `payloadHash` is documented as sha256 but is not

Severity: low (documentation defect inside code).

The `modelSnapshotSchema` JSDoc says "sha256 of the normalized payload, used for change
detection + idempotency". The implementation uses `stableHash()`, which is two FNV-1a 32-bit
passes concatenated into 16 hexadecimal characters. This is not cryptographic and must
never be treated as a security hash. The schema validates a minimum length of 16, which
matches the implementation.

Files: `src/lib/domain/schema.ts`, `src/lib/domain/hash.ts`.

## Data completeness (live mode)

### KI-4 - Ingested news has no provider links and no entities

Severity: medium in live mode.

`feedToNewsItems` sets `providerIds` from `meta.providerSlugs` and `entities` to an empty
array. The runner's feed branch does not pass `providerSlugs`, so every live-ingested news
item has `providerIds: []` and `entities: []`. Provider filtering and entity chips therefore
only work with fixtures.

Files: `src/lib/ingestion/runner.ts`, `src/lib/adapters/rss.ts`.

### KI-5 - Ingested news categories are always `other` or `research`

Severity: medium in live mode.

`runSource()` sets the category from the source domain only:
`category: source.domain === "research" ? "research" : "other"`. There is no content-based
classifier, so the category facet is effectively binary for live data while fixtures
demonstrate the full 16-value vocabulary.

Files: `src/lib/ingestion/runner.ts`.

### KI-6 - `html` news sources have no adapter

Severity: medium in live mode.

Sources registered with `type: "html"` (for example `anthropic-news`) fall through the
dispatch table and are reported as `deferred` with the message that no adapter is
registered for the type. They are enabled in the registry, so the Sources view shows them as
enabled but never producing items.

Files: `src/lib/ingestion/runner.ts`, `src/lib/fixtures/sources.ts`.

### KI-7 - Monitored social accounts are never seeded in live mode

Severity: medium in live mode.

The social branch reads `repository.getMonitoredAccounts()` and then writes the same rows
back. On a fresh database the table is empty, so the adapter receives zero accounts and
returns a successful result with no items and zero requests. Nothing populates the registry.

Files: `src/lib/ingestion/runner.ts`, `src/lib/adapters/social.ts`.

### KI-8 - Harness change events and change events are never written

Severity: medium in live mode.

`writer.writeChangeEvents` and `writer.writeHarnessChangeEvents` are implemented, but no job
calls them. Change feeds in live mode are therefore empty; `change_events` and
`harness_change_events` are only populated by fixtures.

Files: `src/lib/ingestion/{runner,writer}.ts`.

### KI-9 - No job populates harness products or plans

Severity: medium in live mode.

`writeHarnessProducts` and `writeHarnessPlans` exist but are unused, and the pricing job
skips extracted plans whose `canonicalPlanKey` is not already present. A fresh database
therefore attaches no snapshots.

Files: `src/lib/ingestion/{runner,writer}.ts`.

## Environment and configuration

### KI-10 - Three declared variables are never read

Severity: low.

`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `LLM_SUMMARY_MODEL` appear in
`.env.example` but are read nowhere in the codebase, and `LOG_LEVEL` is read nowhere either.
Setting them has no effect. `NEXT_PUBLIC_SITE_URL` means Open Graph and canonical URLs are
not absolute.

Files: `.env.example`, `src/**`.

### KI-11 - Mode changes require a restart

Severity: low.

Both the repository (`src/lib/data/index.ts`) and the fixture bundle
(`src/lib/fixtures/index.ts`) are memoised in module scope. Changing
`NEXT_PUBLIC_DATA_MODE` at runtime has no effect until the process restarts.

### KI-12 - `NEXT_PUBLIC_DATA_MODE` is compared directly in one place

Severity: low.

`verifyQStashRequest` tests `process.env.NEXT_PUBLIC_DATA_MODE !== "live"` rather than using
`getDataMode()`. Since `resolveDataMode()` treats an unrecognised value as `mock`, any
non-`live` spelling also permits the unverified path in that function. This is only reached
when `allowUnverifiedInMock` is set, which the job route does, so a typo in the mode value
degrades verification to mock-mode behaviour.

Files: `src/lib/jobs/verify.ts`, `src/lib/data/mode.ts`.

## Testing and quality gates

### KI-13 - No component tests and no axe accessibility automation

Severity: low.

The Playwright suite under `tests/e2e` covers the shell, Models, News, Harness, World and system
workspaces, and the accessibility fundamentals (a single `h1` per route, a `main` landmark, no
unlabelled interactive control, skip-link focus, table column headers and table captions). What is
still missing: Testing Library is installed but no component/DOM test exists, and no axe dependency
(`@axe-core/playwright`) is installed, so there is no full WCAG audit.

Files: `tests/e2e/**`, `package.json`.

### KI-14 - No CI workflow (resolved)

Resolved.

`.github/workflows/ci.yml` runs the quality stages (frozen install, format check, lint, typecheck,
unit/integration tests, build) and a separate Playwright E2E job on push and pull request to
`main` and on manual dispatch. No CI run has executed yet; the same stages pass locally when last
run.

### KI-15 - No git history

Severity: low at this stage, higher the moment a second contributor appears.

The repository has no commits; `git status` reports every file as untracked. Until the
initial commit exists, there is no diff to review and no rollback point.

## Presentation

### KI-16 - Freshness threshold mismatch between the footer and the domain

Severity: low.

`src/app/layout.tsx` computes the global freshness label with the `models` thresholds
(60/360 minutes) regardless of the route. The News, Harness and World workspaces render
per-item freshness with their own domain thresholds, so a globally "stale" label can appear
next to harness items that are legitimately within their own window.

### KI-17 - Fixture values are plausible by design

Severity: low, by design, but worth stating.

Fixture model metrics, harness prices and world headlines are deliberately realistic so
that rankings, frontiers and change feeds exercise real-looking data. The only guard against
mistaking them for live data is the mode banner. Reading a number without reading the banner
is the failure mode.

### KI-18 - `previousSnapshot()` in fixtures contains a no-op ternary

Severity: cosmetic.

```typescript
return forModel[1] ?? (Date.parse(latest.capturedAt) < now.getTime() - 86_400_000 ? null : null);
```

Both branches return `null`, so the fallback adds nothing. The function is also unused
anywhere in the codebase.

Files: `src/lib/fixtures/snapshots.ts`.
