# AI Model Intelligence Hub - documentation

Canonical product name: **AI Model Intelligence Hub**
Canonical repository: `AI-Model-Intelligence-Hub`

This is the map of the documentation set. Everything here describes the code in this
repository. Where something is not implemented, the document says so explicitly
rather than describing an intended design as if it existed.

No test result, benchmark or coverage number is claimed anywhere in these documents.
Run the suite (`npm run test`) to see results on your machine.

## Where to start

| If you want to know... | Read |
| --- | --- |
| What the product is | [`00-overview/product-brief.md`](00-overview/product-brief.md) |
| What is actually done | [`00-overview/project-status.md`](00-overview/project-status.md) |
| What this phase delivered | [`03-implementation/history/2026-09-18-initial-implementation.md`](03-implementation/history/2026-09-18-initial-implementation.md) |
| What to do next | [`09-handoffs/agent-handoff.md`](09-handoffs/agent-handoff.md) |
| How everything connects | [`01-architecture/system-context.md`](01-architecture/system-context.md) |
| Why a decision was made | [`02-decisions/README.md`](02-decisions/README.md) |

## Index

### 00-overview

- [`product-brief.md`](00-overview/product-brief.md) - what the product is, for whom, and what it refuses to be.
- [`information-architecture.md`](00-overview/information-architecture.md) - navigation, workspaces and deep-link structure.
- [`scope.md`](00-overview/scope.md) - in scope, out of scope, and explicitly deferred items.
- [`glossary.md`](00-overview/glossary.md) - project vocabulary, fixed definitions.
- [`project-status.md`](00-overview/project-status.md) - the honest status checklist.

### 01-architecture

- [`system-context.md`](01-architecture/system-context.md) - boundaries, external systems and trust zones.
- [`application-architecture.md`](01-architecture/application-architecture.md) - module layout and rendering strategy.
- [`data-flow.md`](01-architecture/data-flow.md) - adapters to ingestion to repository to UI.
- [`database-schema.md`](01-architecture/database-schema.md) - every table, column, index and RLS policy.
- [`ingestion-architecture.md`](01-architecture/ingestion-architecture.md) - jobs, adapter contract, idempotency.
- [`security-architecture.md`](01-architecture/security-architecture.md) - RLS, secret handling, request verification.

### 02-decisions

- [`README.md`](02-decisions/README.md) - ADR index and conventions.
- `ADR-0001` to `ADR-0008` - see the index for the list.

### 03-implementation

- [`current/implementation-status.md`](03-implementation/current/implementation-status.md) - feature-by-feature status.
- [`current/backlog.md`](03-implementation/current/backlog.md) - ordered next work.
- [`current/known-issues.md`](03-implementation/current/known-issues.md) - defects and rough edges.
- [`current/technical-debt.md`](03-implementation/current/technical-debt.md) - deliberate shortcuts.
- [`history/2026-09-18-initial-implementation.md`](03-implementation/history/2026-09-18-initial-implementation.md) - the initial phase record.

### 04-data

- [`source-catalog.md`](04-data/source-catalog.md) - every registered source.
- [`provider-registry.md`](04-data/provider-registry.md) - provider metadata and grouping rules.
- [`artificial-analysis-field-map.md`](04-data/artificial-analysis-field-map.md) - source field to domain field mapping.
- [`scoring-methodology.md`](04-data/scoring-methodology.md) - every metric, direction, provenance and formula.
- [`harness-plan-schema.md`](04-data/harness-plan-schema.md) - plan snapshot fields and derived metrics.
- [`news-taxonomy.md`](04-data/news-taxonomy.md) - domains, categories, trust tiers, dedupe.
- [`data-quality.md`](04-data/data-quality.md) - validation, missing-value policy, freshness.
- [`attribution-and-licensing.md`](04-data/attribution-and-licensing.md) - attribution obligations and terms.

### 05-operations

- [`local-development.md`](05-operations/local-development.md)
- [`environment-variables.md`](05-operations/environment-variables.md)
- [`supabase-setup.md`](05-operations/supabase-setup.md)
- [`qstash-schedules.md`](05-operations/qstash-schedules.md)
- [`vercel-deployment.md`](05-operations/vercel-deployment.md)
- [`observability.md`](05-operations/observability.md)
- [`runbooks/`](05-operations/runbooks/) - source-parser-breakage, rate-limit-exhaustion, stale-data, bad-source-payload, rollback.

### 06-quality

- [`testing-strategy.md`](06-quality/testing-strategy.md)
- [`accessibility.md`](06-quality/accessibility.md)
- [`performance-budgets.md`](06-quality/performance-budgets.md)
- [`security-checklist.md`](06-quality/security-checklist.md)
- [`definition-of-done.md`](06-quality/definition-of-done.md)

### 07-product

- [`models-workspace.md`](07-product/models-workspace.md)
- [`news-workspace.md`](07-product/news-workspace.md)
- [`harness-watch.md`](07-product/harness-watch.md)
- [`world-politics.md`](07-product/world-politics.md)
- [`roadmap.md`](07-product/roadmap.md)
- [`future-ideas.md`](07-product/future-ideas.md)

### 08-research

- [`tooling.md`](08-research/tooling.md)
- [`source-reviews/artificial-analysis.md`](08-research/source-reviews/artificial-analysis.md)
- [`alternatives/provider-metadata-sources.md`](08-research/alternatives/provider-metadata-sources.md)

### 09-handoffs

- [`agent-handoff.md`](09-handoffs/agent-handoff.md)
- [`session-log.md`](09-handoffs/session-log.md)

### _templates

- [`ADR-template.md`](_templates/ADR-template.md)
- [`implementation-history-template.md`](_templates/implementation-history-template.md)
- [`research-note-template.md`](_templates/research-note-template.md)
- [`runbook-template.md`](_templates/runbook-template.md)

## Conventions used in this documentation set

- Status markers: `IMPLEMENTED`, `IMPLEMENTED - LIVE VERIFICATION PENDING
  CREDENTIALS`, `PARTIAL`, `NOT IMPLEMENTED`.
- Markdown only, English, no emojis.
- Tables are preferred over long prose.
- Every code fence carries a language tag.
- File paths are relative to the repository root.
