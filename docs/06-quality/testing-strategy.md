# Testing strategy

The suites exist as files in this repository. This document lists them and what each covers.

**No test result is claimed anywhere in this document.** Nothing here was run to produce a
number, a pass count or a coverage figure. Run the suite yourself:

```bash
npm run test              # unit + integration
npm run test:coverage     # coverage over src/lib
npm run test:e2e          # Playwright (desktop + mobile smoke suite)
npm run check             # format check, lint, typecheck, test, build
```

## Configuration

`vitest.config.ts`:

| Setting | Value |
| --- | --- |
| Environment | `node` |
| Globals | Enabled |
| Includes | `tests/unit/**/*.test.ts`, `tests/integration/**/*.test.ts` |
| Setup file | `tests/setup/vitest.setup.ts` |
| Coverage provider | `v8`, reporters `text`, `html`, `lcov` |
| Coverage scope | `src/lib/**/*.ts`, excluding `*.d.ts` and `src/lib/db/database.types.ts` |
| Alias | `@` maps to `./src` |

`tests/setup/vitest.setup.ts` pins `NEXT_PUBLIC_DATA_MODE=mock` before the suite runs and
suppresses expected `[supabase]` console noise from row-validation failure paths.
`tests/integration/adapters-contract.test.ts` additionally deletes credential variables in
`beforeEach` and restores the environment in `afterEach`, so no test depends on a developer's
`.env.local`.

`playwright.config.ts` targets `tests/e2e`, defaults to port 3100, and starts
`npm run build && npm run start` with `NEXT_PUBLIC_DATA_MODE=mock` unless `E2E_BASE_URL` is set.
Projects: `chromium-desktop` (1440x900) and `chromium-mobile` (Pixel 7).

## End-to-end suites

Playwright specs live under `tests/e2e` and run against a production build served in mock mode
(`NEXT_PUBLIC_DATA_MODE=mock`) on port 3100, in the two projects above. No result is claimed here;
run `npm run test:e2e`.

| File | What it covers |
| --- | --- |
| `tests/e2e/shell.spec.ts` | App shell: rail navigation, explicit mock-mode labelling, workspace navigation and the header title, the mobile navigation drawer, the command palette (Cmd/Ctrl+K open, search, navigate, close), theme switching with persistence, mobile bottom tabs, and the API surface (`GET /api/health`, `GET /api/jobs/sync-models`, and a 404 for an unknown job key) |
| `tests/e2e/models.spec.ts` | Models workspace: default comparison set, metric leader cards, add/remove with reload persistence, presets and restore-defaults, ranking provider-group and capability-threshold filters, the selected/all scope toggle, landscape chart reconfiguration and the chart data table, the Pareto frontier toggle, table sort/filter, the selected-only toggle, releases/deprecations chronology, the model detail route and a 404 for an unknown slug; plus the Compare workspace in models and harness-plan modes |
| `tests/e2e/news.spec.ts` | News workspace: overview blocks, feed cards with source, trust tier and external link, cross-source clustering, the provider filter, headline search and saved queries, the social-pulse statements (authorized APIs only, never scraped, fixture data), corroborated vs unverified posts, the research and providers tabs, and saved-query persistence |
| `tests/e2e/harness.spec.ts` | Harness Watch: overview, the plans board with price/credits/freshness, price sorting, the cheapest views with their formulas, plan comparison with URL persistence, the change feed, the budget calculator, the harness news tab, and the mock-mode label |
| `tests/e2e/world-and-system.spec.ts` | World & politics (neutrality notice, region tabs, the URL region filter, contested-story attribution, developing flags, source attribution with a primary-source link, search), watchlists (create and persistence, catalogue search), sources (registry, domain/status filters, integration capabilities, a recorded adapter failure) and methodology (scoring sections, the blended-price assumption, the provider-grouping caveat, the metric catalogue) |
| `tests/e2e/accessibility.spec.ts` | Structural accessibility fundamentals across fourteen routes: a single `h1` and a `main` landmark, no unlabelled interactive control, skip-link focus, table column headers and table captions/accessible names |
| `tests/e2e/axe.spec.ts` | Automated WCAG audit with `@axe-core/playwright` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) over the same fourteen routes in both viewports; fails on any `serious` or `critical` violation and prints the offending selectors otherwise |
| `tests/e2e/helpers.ts` | Shared helpers: `isDesktop`, `desktopOnly`, `mobileOnly` and `openApp` (navigates and waits for hydration) |

## Unit suites

| File | What it covers |
| --- | --- |
| `tests/unit/metrics.test.ts` | Blended price including the documented 75/25 default, weight normalisation, the degenerate-weighting `null` case, and `null` when a price is unknown; monthly workload cost including cached-share pricing, reported cache savings, hit-rate clamping and the missing-price case; all four value-score modes, the capability gate setting `belowThreshold`, weighted-value component normalisation and its `null` cases; `normalizeCapabilities` extremes; Pareto frontier with both higher-is-better and lower-is-better axes and non-finite coordinate filtering; `rankBy` dropping nulls, tie ranking and direction/limit handling; statistics helpers including the median for odd and even lengths and division-by-zero protection in `percentChange` |
| `tests/unit/selection.test.ts` | `resolveDefaultSelection` determinism, one representative per slot, never selecting a deprecated model, including an open-weight model in the best-value slot, and the fallback path; `applyPreset` for coding and open-weight, and that the China-based preset is a grouping rather than a ranking; `applyProviderScope` for all, open/closed partitioning and custom provider lists plus the empty-custom fallback; selection URL round-trip, malformed input handling, dropping unknown ids, de-duplication and clamping to the comparison maximum |
| `tests/unit/hash.test.ts` | `stableHash` determinism and width, key-order independence in `hashPayload`, array order in `stableStringify`, `undefined` dropping; `canonicalizeUrl` tracking-parameter stripping, host lowercasing and `www` removal, fragment and trailing-slash removal, parameter sorting, root-slash preservation, malformed input passthrough and collapsing two tracking variants to one URL; `normalizeTitle` and `tokenSet`; `newsContentHash` stability and title sensitivity; `jaccard`; `clusterNewsItems` anchoring on the highest-trust item, window enforcement and cluster contents |
| `tests/unit/diff-and-freshness.test.ts` | `diffSnapshots` no-change detection, high significance for price, medium for model lists, added/removed fields, a `null`-before snapshot, structural array and nested-object comparison, division-by-zero protection and custom impact fields; `describeChange` for added, numeric and removed fields; `arrayDelta`; freshness states, unknown for a missing or unparseable timestamp, fresh/aging/stale classification, no negative age for a future timestamp, domain-specific thresholds and age formatting plus unknown sorting |
| `tests/unit/harness-metrics.test.ts` | `deriveHarnessPlanMetrics` credit per dollar, annual-only monthly equivalent, zero price as free, never inferring a request estimate, requests per dollar only when documented, and all-null derived values when the price is unknown; `buildCheapestViews` for free options, lowest paid entry, best credit per dollar, premium under threshold, BYOK, highest documented allowance, the presence of a formula on every category, and nulls instead of invented winners; `buildPlanComparisonRows` row shape, integer values and `null` for missing values; `recommendPlans` budget exclusion, required-platform exclusion, BYOK disqualification, decomposable reasons and range clamping |
| `tests/unit/analytics.test.ts` | Metric registry uniqueness, every metric having a direction, formatter and description, derived metrics being labelled derived, price metrics marked lower-is-better, capability metrics higher-is-better and the catalogue shape; `computeLeaderCards` card count, non-empty cards, real maxima and minima; `computeRankings` result per board, ten-row limit, ascending ranks, capability-threshold exclusion, selected-scope restriction and excluded counts; `computeLandscapeChart` frontier computation and rule text, frontier disabled and dropping points missing an axis; `computeReleases` release rows, newest-first ordering and deprecations |
| `tests/unit/adapters.test.ts` | Entity decoding and plain-text reduction including script/style removal and out-of-range code points; `parseFeedDate`; RSS and Atom parsing including alternate-link preference and an unknown payload being reported rather than silently parsed; `feedToNewsItems` canonicalisation, content hash width, provider ids, official flag, excerpt presence, `summary: null` (no fabricated summary) and loud failure on a non-feed; `parseRetryAfter` for seconds, HTTP dates and unusable input; `HttpClient` rate-limit header capture, 429 retry then success, giving up after the attempt cap, 5xx retry, the quota guard, the hard request cap and non-retryable status handling; harness extraction for declared fields, loud failure when a required field is missing, fallbacks for optional fields, never coercing a missing number to zero, page-level partial success with a skipped count and whole-run failure; harness config coverage for every pricing source, at least one required field per plan and canonical plan key generation |
| `tests/unit/change-events.test.ts` | `latestSnapshotBy` newest-wins regardless of input order; `buildModelChangeEvents` producing nothing for unchanged metrics, a high-significance `price_changed`, a medium `metric_changed`, and nothing for a model with no previous snapshot or a replayed snapshot id; `buildHarnessChangeEvents` mapping a price change, a credits change and a platform change, splitting a model-list change into `model_added`/`model_removed`, and ignoring a notes-only change, an unresolvable plan and a plan with no previous snapshot |
| `tests/unit/world-neutrality.test.ts` | Guardrail detection for endorsements, electoral prediction, unattributed verdicts, ideological scoring and ranking of political actors; acceptance of descriptive attributed reporting and of reports mentioning disagreement; `buildAttributionSummary` source prefixes, the explicit non-adjudication statement and the developing label; domain separation (`isPoliticalDomain`, `assertNoPoliticalMetrics` on the real metric catalogue plus a deliberately injected political key); and that every ranking board metric key is registered and contains no political term; world fixture coverage of region labels, the `top` tab first, neutrality of every fixture summary, presence of contested items and country code resolution |

## Integration suites

| File | What it covers |
| --- | --- |
| `tests/integration/adapters-contract.test.ts` | Artificial Analysis: `not_configured` without a key and non-retryable; mapping a payload while counting an unusable row as skipped; tolerating an unknown extra field; mapping missing metrics to `null` rather than zero; never guessing a provider group or region; stable persistence ids and a payload hash of at least 16 characters; an envelope without `data` or `models` yielding zero rows and `ok: true`; a transport failure producing a retryable network error. Social: `not_configured` without a token and **no HTTP request issued**; mapping only monitored accounts; dropping an unmonitored author; dropping a post with no timestamp; conservative entity extraction. World: `not_configured` without a provider; dropping a non-neutral summary while keeping the attributable item; keeping a neutral summary and flagging a contested story; normalising an unusable date to `null`. Job runner: an unknown job key failing with the known keys listed; every source `deferred` or `disabled` in mock mode with no writes; a disabled source reported as `disabled`; zero writes for every job while Supabase is unconfigured; idempotent outcomes and totals for a repeated run at the same timestamp; and a live-eligible source set per job |
| `tests/integration/repository.test.ts` | Fixture determinism (identical ids, metrics, payload hashes and content hashes for the same timestamp); referential integrity for models to providers, snapshots to models and harness snapshots to plans; presence of a deprecated model so history is exercised; every model having at least one snapshot; no snapshot predating its model's release date; mock repository metadata (`mode: mock`, not degraded, dataset timestamp present); the full model catalogue; snapshot filtering by model; news filtering by domain, by search across title and entities, newest-first ordering and `limit`; world filtering by region and the `top` region returning everything; the full source registry including disabled sources; ingestion runs including `skipped`, `rate_limited` and `failed` states and filtering by source; change events newest-first with no future-dated events; and an end-to-end analytics pass resolving a default selection and verifying blended price against the 75/25 formula for every priced model |

## Not covered by any test

| Gap | Note |
| --- | --- |
| React components | Testing Library is installed but no component test exists |
| Page rendering | No server-render test for a route exists; the E2E specs only render routes inside a browser |
| axe moderate/minor findings | `tests/e2e/axe.spec.ts` gates on `serious`/`critical`; moderate and minor violations are surfaced in the failure output but do not fail the run |
| Supabase repository happy path | Only the missing-credential path is exercised; there is no live or emulated database |
| Ingestion writer | Upserts are not tested against a database |
| RLS policies | No test asserts that a write is denied to `anon` or `authenticated` |
| QStash signature verification | The verify function is not unit-tested (no test file covers `src/lib/jobs/verify.ts`) |

## End-to-end journeys covered

These are the journeys the product is judged on. They are implemented in the specs listed above;
no result is claimed here.

1. Default model set loads with a non-empty selection tray.
2. Add a model and remove a model; the selection persists across a reload.
3. Apply a preset and confirm the selection changes and is labelled as a preset.
4. Ranking filters: selected/all scope, provider group, minimum capability threshold.
5. Chart metric switching, including the Pareto frontier toggle and log scale.
6. Compare: model mode and harness-plan mode, confirming the two schemas never mix.
7. Harness plan filtering and the cheapest views, confirming each category shows its formula.
8. News tabs and the search/saved-search flow.
9. World and politics rendering, including a contested item showing both accounts.
10. Mobile shell: bottom tabs and the horizontal model chip scroller.

## Conventions when adding a test

- Prefer a pure function test in `tests/unit` over a rendering test. Most logic is already pure.
- Use a fixed timestamp (`new Date("2026-09-18T12:00:00.000Z")` is the convention) so
  freshness and delta assertions are stable.
- Inject `fetchImpl` rather than mocking `globalThis.fetch`, matching the adapter contract.
- Assert the negative case: a missing value is `null`, a missing credential is
  `not_configured`, and a broken payload fails loudly.
- Never assert on a value the code does not produce, and never loosen an assertion to make a
  suite pass.
