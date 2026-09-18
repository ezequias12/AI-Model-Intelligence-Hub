# Tooling

Two categories: tooling in the repository, and tooling available to an agent working on it. Only
the first is verifiable from the code. Agent tooling is described by capability, and no usage claim
is made.

## Repository tooling

| Tool | Version | Configuration | Purpose |
| --- | --- | --- | --- |
| Next.js | 15.1.6 | `next.config.ts` | App Router framework |
| React | 19.0.0 | - | UI runtime |
| TypeScript | 5.7.3 | `tsconfig.json` | Strict mode with `noUncheckedIndexedAccess`, `noImplicitOverride` and `noFallthroughCasesInSwitch`; path alias `@/*` to `./src` |
| Tailwind CSS | 3.4.17 | `tailwind.config.ts`, `postcss.config.js`, `src/app/globals.css` | Styling, with per-theme design tokens |
| ESLint | 8.57.1 | `.eslintrc.json` | `next/core-web-vitals`, `next/typescript`, prettier; unused variables are an error; type imports are a warning; `no-console` warns but allows `warn`, `error`, `info` |
| Prettier | 3.4.2 | `.prettierrc.json`, `.prettierignore` | Formatting, with the Tailwind plugin |
| Vitest | 2.1.8 | `vitest.config.ts` | Unit and integration tests, `node` environment, v8 coverage over `src/lib` |
| Playwright | 1.49.1 | `playwright.config.ts`, `tests/e2e/**` | E2E smoke suite, desktop Chromium and Pixel 7 projects |
| Zod | 3.24.1 | Used throughout | Runtime validation at every boundary |
| @supabase/supabase-js | 2.47.10 | `src/lib/data/supabase-repository.ts`, `src/lib/ingestion/writer.ts` | Service-role access |
| @upstash/qstash | 2.7.23 | `src/lib/jobs/verify.ts`, `scripts/jobs/create-schedules.mjs` | Signature verification and schedule management |
| TanStack Table | 8.20.6 | `src/features/models/model-table.tsx` | Dense table |
| Recharts | 2.15.0 | Landscape and history charts | Charts |
| lucide-react | 0.468.0 | UI icons | Icons |
| class-variance-authority, clsx, tailwind-merge | 0.7.1 / 2.1.1 / 2.6.0 | `src/components/ui/**` | Styling primitives |
| date-fns | 4.1.0 | - | Available; formatting is handled by `src/lib/format/index.ts` |
| Testing Library (`react`, `dom`, `jest-dom`) | 16.1.0 / 10.4.0 / 6.6.3 | Installed, unused | Intended for component tests |

### Scripts

| Script | Purpose |
| --- | --- |
| `scripts/dev.mjs` | Cross-platform dev launcher that pins `NODE_ENV=development` before starting `next dev` |
| `scripts/jobs/create-schedules.mjs` | Creates QStash schedules for all seven jobs, idempotently by `amih-<job>` id |
| `scripts/jobs/run-local.mjs` | Calls the job endpoint on a running app |
| `scripts/db/generate-types.mjs` | Generates Supabase types into `src/lib/db/database.types.ts` |

## Deliberately absent tooling

| Tool | Why absent | Consequence |
| --- | --- | --- |
| axe (`@axe-core/playwright`) | No axe dependency is installed; the E2E suite asserts structural fundamentals only | A full WCAG audit is not automated; the remaining rules are caught by review |
| Bundle analyser | Not configured | Route sizes are visible only in `next build` output |
| A logger (pino, winston, or a custom module) | `LOG_LEVEL` is declared but unread | Output is plain console logging |
| An HTML parser or headless browser | Harness extraction uses regex plus a required-field gate | Selector changes are a maintenance task; no script-rendered page can be read |
| A general XML library | The RSS/Atom parser is dependency-free | Narrow but well-understood parsing |
| A hashing library | `stableHash` is a dependency-free FNV-1a | Not cryptographic (and not used for security) |
| A schema migration tool beyond the Supabase CLI | Supabase migrations are the mechanism | No down migrations exist |
| An auth library | No authentication is implemented | Access control is a deployment concern |

## Agent tooling available in this environment

Recorded for the next agent. Availability is a property of the environment, not of the repository,
and nothing here has been used to write application code.

| Capability | Use |
| --- | --- |
| Persistent project memory | Search for prior decisions before starting; save decisions after. Never store secrets. |
| Supabase management | Inspect tables, run read-only SQL, review security and performance advisors, list migrations and edge functions. Useful for verifying the migrations after they are applied. |
| Vercel management | Inspect projects, deployments, build logs, runtime errors and analytics. Useful for diagnosing a deployment. |
| Library documentation search | Look up current Next.js, Supabase or QStash behaviour rather than trusting a code comment. Aligns with AGENTS.md rule 7. |
| Codebase knowledge graph | Structural search over the repository. Useful for locating a call path quickly. |
| Browser automation | Drive and screenshot the running app, including mobile viewports. Useful while E2E specs do not exist. |
| Shell and file tools | Standard operation. Prefer targeted reads and greps over broad scans. |

## Guidance for the next agent

1. Run `npm run check` before claiming anything works, and record the actual output.
2. Use the documentation-search capability for any integration whose API shape might have changed.
3. Do not install new MCP servers or CLIs without a stated reason; the repository works with what is
   declared in `package.json`.
4. Keep the pinned dependency style: every dependency in `package.json` uses an exact version.
5. When a check is impossible (no credentials, no browser), say so explicitly rather than
   approximating a result.

## Related

- `AGENTS.md` - mandatory rules
- `CONTRIBUTING.md` - quality gates and conventions
- `docs/03-implementation/current/technical-debt.md` - the tooling gaps and their cost
