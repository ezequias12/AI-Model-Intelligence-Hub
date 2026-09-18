# Definition of done

A change is done when all applicable items below hold. Anything not applicable must be marked
"not applicable" explicitly, not silently skipped.

## Always

- [ ] The change is the smallest coherent slice that solves the problem.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] `npm run lint` and `npm run format:check` pass.
- [ ] Actual command output is recorded in the handoff or the phase history. A claim without an
      observed result is not acceptable.
- [ ] No secret is committed, and no secret was added to a `NEXT_PUBLIC_` variable.
- [ ] Documentation that contradicts the change has been updated in the same change.

`npm run check` chains the five gates.

## When code changes

- [ ] Unknown values still propagate as `null` and render as an em dash. No new `0` or `N/A`
      stands in for an unknown.
- [ ] No value is fabricated. If an input is missing, the output is missing.
- [ ] New domain logic is a pure function in `src/lib/domain/**` or
      `src/lib/domain/harness-metrics.ts`, with no I/O and no `process.env` read.
- [ ] A new metric is registered in `src/lib/analytics/metric-registry.ts` with a direction, a
      provenance, a unit (or an explicit `null`), a description and a formatter, rather than
      being computed inside a component.
- [ ] A new derived metric documents its formula in `docs/04-data/scoring-methodology.md`.
- [ ] A new source is registered with attribution and a licensing note, and a matching seed row
      exists in the migration.
- [ ] A new table has RLS enabled with a read-only policy for `anon` and `authenticated` and no
      write policy for those roles.
- [ ] A new database column is reflected in `src/lib/db/rows.ts` and, if it reaches the UI, in
      the Zod domain schema.
- [ ] A new adapter returns the shared `AdapterResult` envelope, goes through `HttpClient` for
      network access, and returns `not_configured` naming the variable when its credential is
      absent.
- [ ] A new job is added to `src/lib/jobs/registry.ts` **and**
      `scripts/jobs/create-schedules.mjs`, and its cron is documented in
      `docs/05-operations/qstash-schedules.md`.
- [ ] Mock mode still works with no credentials, and every new screen is reachable in it.

## When behaviour changes

- [ ] A test covers the new behaviour, or the reason it cannot be tested without credentials is
      recorded.
- [ ] Tests assert the negative case as well: a missing value is `null`, a missing credential is
      `not_configured`, a broken payload fails loudly.
- [ ] Fixture data is updated so the change is visible in mock mode.
- [ ] The status documents are updated: `docs/00-overview/project-status.md` and
      `docs/03-implementation/current/implementation-status.md` when a capability moves between
      `IMPLEMENTED`, `PARTIAL`, `NOT IMPLEMENTED` or
      `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`.
- [ ] `docs/03-implementation/current/known-issues.md` is updated if the change fixes, introduces
      or changes an issue.
- [ ] `docs/03-implementation/current/technical-debt.md` records any deliberate shortcut taken.

## When a decision is architectural

- [ ] An ADR is added under `docs/02-decisions/` following
      `docs/_templates/ADR-template.md`, with Status, Context, Decision, Consequences and
      Alternatives considered.
- [ ] The ADR index in `docs/02-decisions/README.md` lists the new record.
- [ ] The ADR states the negative consequences, not only the benefits.

## When a phase completes

- [ ] `docs/03-implementation/history/YYYY-MM-DD-<phase>.md` exists and states what changed, why,
      which files and systems, tests, trade-offs and unresolved items, following
      `docs/_templates/implementation-history-template.md`.
- [ ] `CHANGELOG.md` has an entry for the released or unreleased change.
- [ ] `docs/09-handoffs/agent-handoff.md` reflects the new first task and the open threads.
- [ ] `docs/09-handoffs/session-log.md` has a session entry.
- [ ] `docs/03-implementation/current/backlog.md` is reordered to reflect what is genuinely next.

## Explicitly not part of done

These are goals, not gates, because they are not implemented in this repository:

- Playwright E2E results (specs exist under `tests/e2e`; no result is recorded here).
- Accessibility automation results (no axe dependency; the E2E specs assert structural
  fundamentals only).
- CI run results (the workflow is committed at `.github/workflows/ci.yml`, but no CI run has been
  executed).
- Live integration verification (credentials pending; the capability stays
  `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` until an observed live run exists).
- Coverage thresholds (no threshold is configured; `npm run test:coverage` reports only).

Do not present any of the above as evidence that a change is done.

## Definition of done for the documentation set itself

- [ ] Every statement is verifiable from the repository; nothing is projected as if it existed.
- [ ] Anything not implemented is stated as not implemented.
- [ ] Credential-dependent capabilities are marked
      `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` and name their variable.
- [ ] No test result, benchmark or coverage number is claimed.
- [ ] Files follow `REPOSITORY_AND_DOCUMENTATION_STANDARD.md`.
- [ ] No emojis; code fences carry a language tag; files stay under 400 lines.
