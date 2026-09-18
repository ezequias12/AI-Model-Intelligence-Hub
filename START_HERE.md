# AI Model Intelligence Hub — START HERE

This package is the authoritative product and implementation handoff for AI Model Intelligence Hub.

## What to do

Read these files in this exact order:

1. `CANONICAL_NAMING.md`
2. `MASTER_AGENT_PROMPT.md`
3. `PRODUCT_INFORMATION_ARCHITECTURE.md`
4. `UI_UX_SPECIFICATION.md`
5. `NEWS_AND_HARNESS_SPECIFICATION.md`
6. `DATA_SOURCES_AND_PIPELINES.md`
7. `REPOSITORY_AND_DOCUMENTATION_STANDARD.md`
8. `SEED_SOURCE_REGISTRY.json`

Then inspect the existing repository and begin implementation.

## Important direction change

The product is **not** a scroll-heavy marketing experience and **not** a generic admin dashboard.

It is a professional, information-dense **AI intelligence portal** with a disciplined app shell and several major workspaces.

The two core worlds are:

- **Models** — metrics, rankings, comparisons, model selection, Artificial Analysis data, cost-efficiency, provider segmentation.
- **News & Watch** — AI news, social/X signals, coding-harness subscriptions/pricing, CLI ecosystem changes, and a separate neutral world/politics feed.

The Models workspace is the primary product and should feel inspired by the usefulness of Artificial Analysis without cloning its visual identity.

## Autonomous-work rule

Do not stop just because the user is offline.

Continue implementing, testing, fixing, refining and documenting until:
- all requirements that do not depend on unavailable credentials are completed; or
- a genuine external blocker exists that cannot be safely bypassed with fixtures, mocks, adapters, documentation or local tooling.

Missing credentials are not a reason to stop.

If an external integration cannot be live-verified:
- implement the real adapter;
- add fixtures and contract tests;
- document the remaining credential step;
- continue with everything else.

Before ending, update project status and handoff documentation and run all checks.
