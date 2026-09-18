# 2026-09-18 - Live-mode completion, Artificial Analysis verification and accessibility audit

Phase record for the session that closed the credential-free backlog, verified the Artificial
Analysis integration against the live API, and added automated accessibility auditing.

## What changed

**Backlog items, all without new credentials**

- **H1 — harness catalogue seed.** `supabase/migrations/20260918000700_seed_harness_catalog.sql`
  seeds `harness_products` and `harness_plans`. `canonical_plan_key` values match the `planKey`
  in `src/lib/ingestion/harness-configs.ts`, so the pricing job can attach a snapshot.
- **H2 — change events.** `src/lib/ingestion/change-events.ts` derives `change_events` and
  `harness_change_events` from snapshot diffs; the runner writes them after each successful
  sync. The diff is the gate, so an unchanged snapshot writes nothing.
- **H3 / KI-7 — monitored social accounts.** `20260918000800_seed_monitored_social_accounts.sql`
  seeds the twelve accounts. `provider_id` is left `null` until `sync-models` has created the
  provider rows.
- **M1 / KI-1 — quota-guard classification.** `isDeferralError` in `src/lib/adapters/http.ts`
  treats a quota guard and a persistent 429 as deferrals; the adapter returns `rate_limited`; the
  runner reports `deferred` and records a `rate_limited` ingestion run.
- **H10 — axe.** `@axe-core/playwright` (4.13.0) and `tests/e2e/axe.spec.ts` audit fourteen
  routes in both viewports, gating on serious and critical violations.

**Artificial Analysis verified against the live API**

A real key became available. A read-only request found three defects, all fixed:

1. The endpoint was `/data/llm/models` (singular), which 404s; corrected to `/data/llms/models`.
2. Capability metrics are nested under `evaluations.artificial_analysis_*`; the mapper now reads
   them.
3. The free endpoint returns everything with no `pagination` block; the old loop treated a full
   page as incomplete and re-fetched the same list up to 20 times. It now stops after page one
   when no pagination metadata is present.

The contract test is rebuilt from a captured real response (trimmed), and the field map,
source review and source catalog are reconciled.

**Accessibility fixes surfaced by axe**

The audit found three real defects, fixed rather than suppressed: an `<hr>` directly inside the
Sources capability `<ul>`, scrollable Methodology tables with no keyboard access, and Recharts
scatter symbols that ship `role="img"` with no name (the plot is now decorative and the existing
chart data table is the accessible equivalent).

**Tooling**

- Prettier `endOfLine` is now `auto`. On a Windows checkout with `core.autocrlf=true` the working
  tree is CRLF while the committed blobs are LF, so the default `lf` setting failed
  `format:check` for every file. `auto` accepts both and keeps CI (LF) green.

## Why

The repository's stated purpose is to be left "connect credentials, deploy". The credential-free
gaps blocked exactly that: with no harness plans the pricing job writes no snapshots, with no
social accounts the social job polls nothing, and with no change events the live feeds are empty.
The API key additionally made the Artificial Analysis integration verifiable, which exposed that
it had never actually worked.

## Verified

Run on this machine (Windows, Node 20):

- `npm run check` exits 0: Prettier, ESLint, `tsc --noEmit`, 241 unit and integration tests, and a
  26-route production build.
- `npm run test:e2e` passes 205 tests and skips 5 across the `chromium-desktop` and
  `chromium-mobile` projects (210 total), including the 28 axe cases.
- A live `GET https://artificialanalysis.ai/api/v2/data/llms/models` returned HTTP 200 with 652
  rows and no pagination block, matching the reconciled field map.

No result is claimed beyond what these commands printed.

## Not done

- No Supabase project was touched from this repository: the migrations (including the two new
  seed files) have not been applied here, `npm run db:gen-types` has not been run, and no row has
  been written through the service role.
- The harness pricing selectors have not been checked against the live pages.
- `X_BEARER_TOKEN` and the world news provider are still unconfigured; the social and world
  sources stay disabled.
- No component/DOM test was added (Testing Library remains unused).

## Unresolved items

- **KI-19:** live providers all carry `group: "other"` because grouping is curated only in the
  fixtures. The provider-group filters need a curated provider seed and a sync that preserves it.
- Raw payload capture and retention deletion remain unimplemented.
- The repository still has a single commit; this phase's changes were not committed.
