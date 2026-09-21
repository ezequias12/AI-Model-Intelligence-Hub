# Architecture Decision Records

One file per decision. Each record follows
`docs/_templates/ADR-template.md`: Status, Context, Decision, Consequences,
Alternatives considered.

Records are immutable in substance. When a decision changes, add a new record and mark
the old one `Superseded by ADR-XXXX` rather than rewriting history.

## Index

| ID | Title | Status | File |
| --- | --- | --- | --- |
| ADR-0001 | Modular monolith in one Next.js application | Accepted | `ADR-0001-modular-monolith.md` |
| ADR-0002 | Model selection as explicit, shareable state | Accepted | `ADR-0002-model-selection-state.md` |
| ADR-0003 | Artificial Analysis integration is API-first, never scraped | Accepted | `ADR-0003-artificial-analysis-api-first.md` |
| ADR-0004 | Snapshot history instead of overwriting current values | Accepted | `ADR-0004-snapshot-history.md` |
| ADR-0005 | Provider groups are metadata, never a quality signal | Accepted | `ADR-0005-provider-groups.md` |
| ADR-0006 | News domains are separated, with a political domain that cannot score models | Accepted | `ADR-0006-news-domain-separation.md` |
| ADR-0007 | Harness plan snapshots with stable canonical plan keys | Accepted | `ADR-0007-harness-plan-snapshots.md` |
| ADR-0008 | Mock mode is a first-class mode; degraded live mode is surfaced | Accepted | `ADR-0008-mock-live-modes.md` |
| ADR-0009 | Free, key-less community and news sources; X out of scope | Accepted | `ADR-0009-free-community-and-news-sources.md` |

## Conventions

- Status is one of `Proposed`, `Accepted`, `Superseded by ADR-XXXX`, `Deprecated`.
- The Context section states the forces at play, not the solution.
- The Decision section states what was decided in the present tense.
- The Consequences section lists both positive and negative outcomes.
- The Alternatives section states what was rejected and why.
- File names are `ADR-NNNN-short-slug.md` with a four-digit number.

## Related artefacts

- Status of the resulting implementation:
  `docs/00-overview/project-status.md`
- Implementation phase record:
  `docs/03-implementation/history/2026-09-18-initial-implementation.md`
