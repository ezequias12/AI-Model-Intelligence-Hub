# Contributing

## Before you start

1. Read `docs/00-overview/project-status.md` and `docs/09-handoffs/agent-handoff.md`.
2. Read `AGENTS.md` and follow the ten mandatory rules.
3. Run `git status` so you know what is already modified.

## Development setup

Requirements: Node.js `>=20.9.0`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Do not put real secrets in `.env.example`. Use `.env.local`, which is git-ignored.

## Project layout

| Path | Contents |
| --- | --- |
| `src/app/**` | Next.js App Router routes and API handlers |
| `src/features/**` | Workspace components (client and server) |
| `src/components/**` | Shell, UI primitives, overlay, theme |
| `src/lib/domain/**` | Zod schemas and pure domain logic (metrics, selection, hash, diff, freshness, harness metrics, world guardrails) |
| `src/lib/analytics/**` | Metric registry and analytics assembly |
| `src/lib/adapters/**` | Source adapters sharing one result envelope |
| `src/lib/data/**` | Repository contract, mock and Supabase implementations, workspace loaders |
| `src/lib/db/**` | Row schemas and row-to-domain mappers |
| `src/lib/ingestion/**` | Job runner, writer, harness extraction configs |
| `src/lib/jobs/**` | Job registry and QStash signature verification |
| `src/lib/fixtures/**` | Deterministic fixture data |
| `supabase/migrations/**` | Schema, indexes, RLS, seed registry |
| `tests/unit`, `tests/integration` | Vitest suites |
| `docs/**` | This documentation set |
| `scripts/**` | Operational scripts (schedule creation, local job run, type generation) |

## Coding conventions

- TypeScript strict mode is on, including `noUncheckedIndexedAccess`.
- Domain shapes are defined once as Zod schemas in `src/lib/domain/schema.ts`;
  TypeScript types are inferred from them so runtime validation and static types
  cannot drift.
- Derived metrics are pure functions with no I/O, so they can be unit-tested.
- A missing value is `null`, never `0` and never a fabricated placeholder. The UI
  renders an em dash for unknown values.
- Adapters return the shared `AdapterResult` envelope and never call `fetch`
  directly; quota discipline lives in `HttpClient`.
- Report errors honestly. A missing credential produces `not_configured`, not a
  silent empty success.

## Quality gates

Run before opening a change:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run check` runs all five in order.

Tests:

```bash
npm run test           # unit + integration
npm run test:watch     # watch mode
npm run test:coverage  # coverage over src/lib
```

Playwright is configured in `playwright.config.ts` with two projects (desktop
Chromium and Pixel 7) and the specs live under `tests/e2e`. The suite builds and
starts the app on port 3100 in mock mode, so it needs no credentials and takes a
couple of minutes on a clean run.

Run `npm run dev` rather than `next dev` directly: `scripts/dev.mjs` pins
`NODE_ENV=development`, which a globally exported `NODE_ENV=production` would
otherwise override and break the CSS pipeline.

## Change process

1. Make the change in the smallest coherent slice.
2. Add or update tests for behaviour that can be tested without credentials.
3. Run the quality gates and report the actual result.
4. If the change alters architecture or a product-level contract, add an ADR in
   `docs/02-decisions/` using `docs/_templates/ADR-template.md`.
5. Update the affected documentation in the same change. Documentation that
   contradicts the code is a defect.
6. After a significant phase, add
   `docs/03-implementation/history/YYYY-MM-DD-<phase>.md` using
   `docs/_templates/implementation-history-template.md`.
7. Update `docs/09-handoffs/agent-handoff.md`.

## Commit style

Imperative mood, scoped when useful, one logical change per commit:

```text
adapters: honour Retry-After on 429 responses
docs: add harness watch product notes
```

Never commit secrets, generated Supabase types, `.env.local`, build output or
Playwright reports.

## What not to do

- Do not hard-code current model names, prices or plan limits as permanent truth.
  Use snapshots with `capturedAt` and a source URL.
- Do not infer a value the vendor does not publish. The harness request estimates
  and value scores return `null` when an input is missing.
- Do not mix political content into model or harness scoring.
- Do not add an unexplained composite score. Every derived number must be
  decomposable and explained in `docs/04-data/scoring-methodology.md`.
