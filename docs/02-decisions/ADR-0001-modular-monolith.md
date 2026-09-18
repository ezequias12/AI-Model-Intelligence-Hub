# ADR-0001: Modular monolith in one Next.js application

- Status: Accepted
- Date: 2026-09-18
- Deciders: implementation agent (autonomous phase)

## Context

The product spans four workspaces (Models, News, Harness Watch, World & Politics), an
ingestion pipeline with seven scheduled jobs and a database layer. The realistic scale is
an internal-quality tool: one primary audience, one deployment, modest traffic, and a
data volume measured in thousands of rows, not billions.

The pressure to split into services is easy to feel (adapters look like workers, the
repository looks like a data service) but the cost is real: multiple deploy targets,
cross-service contracts, distributed tracing, and duplicate validation. None of that is
justified at this scale, and all of it slows down the ability to change a metric
definition in one place.

At the same time, the code has genuinely distinct concerns that must not blur: domain
math, source adapters, persistence and presentation. A single undifferentiated
`src/lib` file tree would make the codebase harder to reason about than a set of services.

## Decision

Build one Next.js 15 App Router application, deployed as a single unit, with internal
module boundaries expressed as directories and enforced by import discipline:

- `src/lib/domain` holds the Zod schemas and all pure logic, and must not perform I/O or
  read `process.env`.
- `src/lib/analytics` holds the metric registry and the view structures, and must not
  re-implement domain math.
- `src/lib/adapters` talks to sources and returns the shared `AdapterResult` envelope.
- `src/lib/data` owns the repository contract and the mode decision.
- `src/lib/ingestion` and `src/lib/jobs` own execution and trigger verification.
- `src/app` and `src/features` own routes and rendering.

The dependency direction is one way: app and features depend on data and analytics;
data depends on domain; ingestion depends on adapters, data and domain; domain depends on
nothing internal.

## Consequences

Positive:

- One build, one deploy, one set of environment variables, no inter-service contracts.
- Domain logic is pure and unit-testable without a database or network.
- Changing a metric definition is a single-file change that propagates to the table,
  charts, rankings and the Methodology page through the registry.
- Mock mode works because the UI depends on an interface, not on a remote service.

Negative:

- The ingestion runner executes inside the web application's runtime. A slow adapter
  occupies a serverless invocation up to the configured `maxDuration` of 300 seconds on
  the job route.
- There is no process isolation between serving requests and ingesting data, so a
  runaway job consumes the same compute budget as page renders.
- Scaling the ingestion independently of the UI is not possible without extracting a
  worker later.
- Boundary discipline is enforced by review and convention, not by the compiler. A
  developer can import Supabase into a feature component; only the ESLint rules and
  code review stop it.

## Alternatives considered

1. **Separate worker service for ingestion.** Rejected for now. It would double the
   deployment surface and the credential handling, and the current job durations and
   volumes do not require independent scaling. The boundaries chosen here make a later
   extraction mechanical rather than a rewrite.
2. **Next.js for the UI plus a separate API service.** Rejected. It duplicates validation
   and the repository layer, and it adds latency without a benefit at this scale.
3. **A single flat `src/lib` directory with no module boundaries.** Rejected. It would
   make the pure-logic versus I/O distinction invisible, which is exactly the property
   that makes the domain testable and mock mode possible.
4. **Monorepo with shared packages.** Rejected as premature. There is one consumer of
   each module today, so a package boundary would add tooling overhead with no reuse
   benefit.
