# Repository & Documentation Standard

## Root

- README.md
- AGENTS.md
- CONTRIBUTING.md
- SECURITY.md
- CHANGELOG.md
- .env.example
- package.json
- lockfile
- CI workflow

## Docs

docs/
  README.md

  00-overview/
    product-brief.md
    information-architecture.md
    scope.md
    glossary.md
    project-status.md

  01-architecture/
    system-context.md
    application-architecture.md
    data-flow.md
    database-schema.md
    ingestion-architecture.md
    security-architecture.md

  02-decisions/
    README.md
    ADR-0001-modular-monolith.md
    ADR-0002-model-selection-state.md
    ADR-0003-artificial-analysis-api-first.md
    ADR-0004-snapshot-history.md
    ADR-0005-provider-groups.md
    ADR-0006-news-domain-separation.md
    ADR-0007-harness-plan-snapshots.md
    ADR-0008-mock-live-modes.md

  03-implementation/
    current/
      implementation-status.md
      backlog.md
      known-issues.md
      technical-debt.md
    history/

  04-data/
    source-catalog.md
    provider-registry.md
    artificial-analysis-field-map.md
    scoring-methodology.md
    harness-plan-schema.md
    news-taxonomy.md
    data-quality.md
    attribution-and-licensing.md

  05-operations/
    local-development.md
    environment-variables.md
    supabase-setup.md
    qstash-schedules.md
    vercel-deployment.md
    observability.md
    runbooks/
      source-parser-breakage.md
      rate-limit-exhaustion.md
      stale-data.md
      bad-source-payload.md
      rollback.md

  06-quality/
    testing-strategy.md
    accessibility.md
    performance-budgets.md
    security-checklist.md
    definition-of-done.md

  07-product/
    models-workspace.md
    news-workspace.md
    harness-watch.md
    world-politics.md
    roadmap.md
    future-ideas.md

  08-research/
    tooling.md
    source-reviews/
    alternatives/

  09-handoffs/
    agent-handoff.md
    session-log.md

  _templates/
    ADR-template.md
    implementation-history-template.md
    research-note-template.md
    runbook-template.md

  archive/

## Implementation history

After every significant phase, add:
`docs/03-implementation/history/YYYY-MM-DD-<phase>.md`

It should state:
- what changed
- why
- files/systems
- tests
- trade-offs
- unresolved items

Do not fabricate history.

## AGENTS.md

Future agents must:
1. read project-status
2. read agent-handoff
3. inspect git status
4. search Engram if available
5. never commit secrets
6. use mock mode when credentials missing
7. use official docs for evolving integrations
8. run checks before claiming success
9. create ADRs for architecture decisions
10. update handoff before ending

## CI

At minimum:
- frozen install
- lint
- typecheck
- unit tests
- build

Prefer E2E as separate job.

## Testing

Unit:
- model selector resolver
- provider groups
- value metrics
- Pareto
- monthly cost
- snapshots
- change diff
- harness plan normalization
- harness change diff
- news dedupe
- political-domain separation
- rate-limit guard

Integration:
- adapters using fixtures
- repositories
- job idempotency

E2E:
- default model set
- add/remove model
- preset
- ranking filters
- chart metrics
- compare
- harness plan filtering
- news tabs
- world/politics source rendering
- mobile shell
