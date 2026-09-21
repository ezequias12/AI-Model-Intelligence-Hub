# Technical debt

Deliberate shortcuts, why they were taken, and what a proper fix looks like. Debt here is
recorded, not hidden: each item states the cost of leaving it and the cost of fixing it.

## Environment and configuration

| Item | Why it exists | Cost of leaving it | Proper fix |
| --- | --- | --- | --- |
| Four declared but unread variables (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `LOG_LEVEL`, `LLM_SUMMARY_MODEL`) | The template was written ahead of the features that would use them | Operators set values that do nothing | Either wire them (absolute metadata URLs, `LOG_LEVEL`-gated logging) or remove them from `.env.example` |
| `LLM_SUMMARY_API_KEY` reported as a capability with no client | The capability list needed to be complete for the status story | The health endpoint advertises a capability that cannot be enabled | Implement the summariser or drop the capability entry |
| Mode and fixture memoisation in module scope | Simplest correct implementation; avoids repeated fixture construction | A mode change needs a restart, which is surprising in a long-lived process | Key the cache by mode, or drop the cache when the mode differs |

## Data layer

| Item | Why it exists | Cost of leaving it | Proper fix |
| --- | --- | --- | --- |
| Hand-written row schemas in `src/lib/db/rows.ts` mirroring the SQL | Generated Supabase types were unavailable without the CLI and a linked project | A migration change can drift from the row schemas; drift is caught only at runtime, as a logged validation failure | Run `npm run db:gen-types`, keep the Zod schemas for boundary validation but derive field lists from the generated types, and add a test that fails when a migration adds a column |
| Hand-shaped client interface cast in the Supabase repository | Same cause: no generated types | Loses compile-time query checking; a column rename is not caught by `tsc` | Same as above |
| Row validation logs and skips an invalid row | Keeps one bad row from blanking a page | Failure is a console line, not a metric; a persistent validation failure can go unnoticed | Count and expose validation failures per table in the Sources workspace |
| Duplicate sources of current state (`models` plus the newest snapshot) | Snapshots are append-only history, the current table is a fast read path | The two can diverge if the snapshot write succeeds and the model write fails; the run is marked `partial` or `failed` but reconciliation is manual | Add a reconciliation query or write current state from the newest snapshot in a single transaction |
| Live providers are not curated (KI-19, resolved 2026-09-18) | — | — | The curated registry is seeded (migration 0012) and `mergeProviders` preserves it |
| Popularity metrics come from one platform | Hugging Face is the only key-less source with downloads and likes | Trending on the Hub is not adoption or quality, and a model with no Hub page shows an em dash | Keep it labelled as popularity; consider a second independent popularity signal later |
| OpenRouter contributes no capability and its routed price is unused | It publishes neither an index nor a first-party price | Its catalogue entries can carry a price with no capability, and its routed price is silently ignored | Surface a clearly labelled routed-price metric only if it proves useful |

## Ingestion

| Item | Why it exists | Cost of leaving it | Proper fix |
| --- | --- | --- | --- |
| Idempotency by database key rather than by locking | Keys are simple, durable and enforced where the data lives | Two concurrent runs both execute and both consume quota; only duplicate rows are prevented | A short-lived advisory lock per job key, or single-runner scheduling discipline |
| Regex-based harness extraction | Pricing pages have no structured API; a full HTML parser would add a dependency and still need per-page selectors | Selectors break silently against a page redesign; mitigations are required fields, a fitted `configVersion` and a raw page hash | Add a captured HTML fixture per page and a scheduled canary that fails loudly; consider a headless browser only if the pages become script-rendered |
| `estimatedRequests` regex fallback set to `null` | The value may legitimately be absent | A documented estimate on a page the regex misses is dropped rather than reported | Report unmatched optional fields in the run outcome so a missing extractor is visible |
| Maintenance job returns a message instead of deleting | Retention SQL was not written | `private.raw_ingestion_payloads` grows unbounded once capture exists | Write the retention query and call it from `runMaintenance` |
| No structured logging | Console output was sufficient for development | No queryable run history beyond the ingestion ledger; no correlation ids | Add a logger honouring `LOG_LEVEL` with one line of JSON per source outcome |

## Domain and analytics

| Item | Why it exists | Cost of leaving it | Proper fix |
| --- | --- | --- | --- |
| Derived metric deltas are not computed across snapshots | Derived values depend on the population, which the historical payload does not carry | A leader card or board row for a derived metric shows no delta | Recompute derived metrics for the previous snapshot with the same population, or persist computed derived values on the snapshot |
| Capability gate ignores `null` capability | Treating unknown as failed would hide models with missing source data | A model with unknown capability is not excluded by an explicit threshold | Add an explicit policy flag (`excludeUnknownCapability`) and surface the count |
| Weighted value requires all three capability inputs | Normalisation without a component is undefined | A model missing any of intelligence, coding or agentic has no weighted value at all | Consider a configurable policy on missing components, with the policy stated in the Methodology page |
| `assertNoPoliticalMetrics` lives in the production module but is only used by tests | The guard reads naturally next to the other world helpers | A production-only helper exists that nothing in production calls | Either use it in a startup assertion or move it to a test helper |

## Frontend

| Item | Why it exists | Cost of leaving it | Proper fix |
| --- | --- | --- | --- |
| Selection and table preferences in local storage | No authentication exists, so there is no user to key on | Preferences do not follow a user across devices; clearing storage loses them | Add auth, then use the owner-scoped `watchlists` and `watchlist_items` policies as the pattern |
| Global freshness label uses model thresholds on every route | One label was simpler than a per-route label | The shell can read "stale" on a page whose own domain thresholds are satisfied | Derive the shell label from the active workspace's domain |
| Client-side CSV export only | Simple and dependency-free | Large exports are bounded by the serialised dataset already sent to the browser | Add a server route that streams CSV when the dataset is large |
| No cache layer between database and pages | Every render reads the repository | Latency scales with dataset size and query count | Add request-scoped caching first, then revalidation for slow-changing data (sources, plans) |

## Testing and process

| Item | Why it exists | Cost of leaving it | Proper fix |
| --- | --- | --- | --- |
| No performance or coverage gate in CI | The workflow runs the correctness stages only (format, lint, typecheck, tests, build) | A bundle-size or coverage regression passes CI unnoticed | Record `next build` route sizes and compare them in the `quality` job (see `docs/06-quality/performance-budgets.md`) |
| Testing Library installed but unused | Added for future component tests | An unused dependency, and rendering behaviour has no automated coverage | Add component tests or remove the dependency |
| axe integration (resolved 2026-09-18) | The dependency and spec were added; the gate is `serious`/`critical` only | Moderate and minor findings are surfaced but not enforced | Raise the gate once the backlog of moderate findings is cleared |
| Dead exports (`previousSnapshot`, `signingKeysConfigured`) | Left behind by refactors | Misleads a reader into thinking they are part of a flow | Delete or use them |

## Documentation

| Item | Why it exists | Cost of leaving it | Proper fix |
| --- | --- | --- | --- |
| `payloadHash` documented as sha256 in code | Original intent changed when a dependency-free hash was chosen | A reader may assume cryptographic properties that do not exist | Correct the comment; the domain documentation already states the real algorithm |
| No git history | The repository has not been committed yet | No review diff and no rollback point | Make the initial commit |
| `LICENSE` is a placeholder | Choosing a license is the owner's decision | The repository grants no rights by default | The owner chooses a license and replaces the file |
