# AI Model Intelligence Hub — MASTER AUTONOMOUS IMPLEMENTATION PROMPT

## Mission

You are the lead product engineer, architect, frontend engineer, data engineer, QA engineer and technical writer responsible for implementing **AI Model Intelligence Hub**.

The user will be offline for an extended period. Work autonomously and continuously.

Your goal is not to produce a sketch. Your goal is to leave behind a professional repository that is as close as possible to:
- connect Supabase;
- add API keys;
- connect Vercel/QStash;
- deploy.

## NON-STOP EXECUTION RULE

Once implementation starts, keep working.

Your loop is:

1. inspect;
2. plan the next concrete slice;
3. implement it;
4. run tests/checks;
5. debug failures;
6. improve the implementation;
7. document what changed;
8. identify the next incomplete requirement;
9. continue.

Do **not** stop after:
- scaffolding;
- one page;
- the frontend;
- the schema;
- one successful build;
- creating TODOs;
- writing docs;
- installing tools.

Keep going until every requirement in this package that can be implemented without a destructive/billable/user-authenticated external action has been completed and verified.

You may stop only when:
A. all non-credential-dependent acceptance criteria are satisfied; or
B. a real external blocker prevents further safe progress.

If blocked by credentials, implement the integration boundary, fixtures, tests and docs, then move to another phase.

Do not ask routine questions while the user is away. Make reasonable professional decisions and record them in ADRs.

Never perform billable, destructive or irreversible account operations without explicit authorization.

---

# 1. Product

AI Model Intelligence Hub is an internal-quality intelligence portal for understanding:

- AI models;
- benchmarks and performance;
- cost efficiency;
- providers;
- model releases and pricing changes;
- AI news;
- social/X signals;
- coding-agent / CLI / harness ecosystem;
- subscriptions and usage plans for coding agents;
- world/political news as a separate neutral feed.

The product must be useful to technical colleagues who want a fast answer to:
- Which models are strongest?
- Which are fastest?
- Which are cheapest?
- Which offer the best cost/capability trade-off?
- What changed recently?
- Which models should I compare?
- Which coding-agent subscription is cheap right now?
- Which coding harness changed plans/models/limits?
- What important AI-provider news did I miss?
- What important world/political news happened outside AI?

---

# 2. High-level product shell

Use an ordered portal/app layout.

Recommended shell:

- compact, polished left navigation;
- content header for the active workspace;
- optional top command/search bar;
- responsive mobile navigation;
- dense but clean information layout.

The shell should feel closer to:
- professional market intelligence;
- financial/technical research tools;
- polished enterprise data products;

and less like:
- generic SaaS admin templates;
- shadcn demo dashboards;
- marketing landing pages;
- neon “AI” sites.

The left navigation is acceptable and desired because it creates order, but it must be refined and purposeful.

Primary navigation:

1. Overview
2. Models
3. Compare
4. News
5. Harness Watch
6. World & Politics
7. Watchlists
8. Sources
9. Methodology

Optional nested navigation is allowed.

---

# 3. Workspaces

## Models — primary workspace

This is the centerpiece.

It must support:
- persistent model selection;
- sensible default model set;
- add/remove models;
- provider groups;
- top rankings for several metrics;
- cost efficiency rankings;
- configurable charts;
- detailed table;
- model detail view;
- model snapshots/history;
- source freshness.

The UX should take inspiration from the useful interaction pattern of Artificial Analysis:
- a selected comparison set;
- default models present on load;
- add/remove models without navigating away;
- multi-model charts;
- metric switching;
- clear provider identity.

Do not copy branding, CSS, exact layout or proprietary visual design.

## News

Contains:
- AI General
- Model Providers
- Social Pulse
- Research / Benchmarks
- Saved

## Harness Watch

A specialized product within AI Model Intelligence Hub.

Tracks coding-agent ecosystems such as:
- Command Code
- OpenCode
- Claude Code
- OpenAI Codex
- Gemini CLI
- Kilo Code
- Freebuff
- Cursor
- Windsurf
- other meaningful CLI/agent products discovered later.

Track:
- plans;
- prices;
- included credits;
- usage limits;
- available model families;
- BYOK;
- open-source status;
- supported environments;
- regional constraints;
- changelogs;
- plan changes;
- model additions/removals;
- promotions;
- current cheapest options.

## World & Politics

A separate news workspace for relevant non-AI current affairs.

This workspace must be:
- politically neutral;
- descriptive rather than persuasive;
- explicitly sourced;
- timestamped;
- careful with disputed claims;
- free of ideological scoring/ranking;
- separated from AI/model recommendation logic.

Potential filters:
- Argentina
- United States
- Latin America
- Geopolitics
- Economy
- Regulation
- Elections
- Conflict / diplomacy

Do not infer user political preferences.
Do not recommend parties/candidates.
Do not rank political actors.
For contested claims, show source attribution.

---

# 4. Models UX requirements

## Persistent selected-model tray

At the top of the Models workspace, provide a compact selected-model control.

Behavior:
- models appear as removable chips/cards;
- `+ Add models` opens a searchable command palette;
- multiple models can be selected;
- model selection persists in URL query params;
- also persist last-used selection in local storage;
- shareable URLs recreate the same view;
- support `Reset to defaults`.

### Default selection logic

Do not hard-code stale exact model names forever.

Create a resolver that chooses the latest active representative model per default slot, for example:

- OpenAI flagship reasoning/general;
- Anthropic flagship;
- Google flagship;
- xAI flagship;
- DeepSeek flagship;
- Alibaba/Qwen flagship;
- Moonshot/Kimi flagship when available;
- one strong low-cost/open model.

The default set should stay useful as models rotate.

Fallback to fixture defaults in mock mode.

## Model-selection presets

Provide quick presets:

- Frontier
- Best Value
- Fast
- Coding
- Agentic
- Open / Open-weight
- Mainstream Western Providers
- China-based Labs
- Custom

Provider group classification is metadata, not a quality judgment.

### Suggested region/provider grouping

Mainstream / global:
- OpenAI
- Anthropic
- Google
- xAI
- Meta
- Mistral
- Cohere

China-based labs:
- DeepSeek
- Alibaba / Qwen
- Moonshot / Kimi
- MiniMax
- Zhipu / GLM
- Xiaomi / MiMo
- other verified China-based providers

Allow groups to evolve from provider metadata rather than hard-coded UI arrays.

---

# 5. Models overview layout

## A. Header

Contains:
- title `Models`;
- last successful data sync;
- selected-data source;
- Artificial Analysis attribution where required;
- global search;
- selected-model tray.

## B. Metric leaders

A compact row/grid answering immediately:

- Highest Intelligence
- Best Coding
- Best Agentic / tool use
- Fastest Output
- Lowest Input Price
- Lowest Output Price
- Best Weighted Value
- Newest Relevant Model

Each card:
- model;
- provider;
- metric;
- small delta if historical snapshot exists;
- click to focus model.

## C. Ranking boards

Create independent Top 10 boards.

Required boards:
- Top 10 Intelligence
- Top 10 Coding
- Top 10 Agentic
- Top 10 Speed
- Top 10 Lowest Input Price
- Top 10 Lowest Output Price
- Top 10 Cost Efficient

Each board must support:
- Selected models only / all models;
- provider-group filter;
- quality threshold;
- clear methodology;
- metric source + freshness.

Cost Efficiency must have several modes:
- Intelligence per dollar
- Coding per dollar
- Agentic per dollar
- Weighted value

Avoid cheap weak models automatically dominating by offering a minimum capability threshold and showing raw metrics next to the derived score.

## D. Interactive charts

Do not use one fixed chart.

Provide chart cards with configurable:
- X metric
- Y metric
- optional bubble-size metric
- selected/all models
- provider group
- highlight Pareto frontier
- log scale where meaningful
- labels on/off

Suggested default charts:
1. Intelligence vs blended price
2. Coding vs blended price
3. Speed vs Intelligence
4. Output price vs Intelligence

Support provider colors.

## E. Provider segmentation

A visible filter control must allow:
- All
- Mainstream
- China-based
- Open-weight
- Closed
- Custom provider selection

Also allow provider-specific filters:
- OpenAI
- Anthropic
- Google
- xAI
- DeepSeek
- Qwen
- etc.

Do not frame region as quality.

## F. Full model table

Columns should include when source data exists:
- Model
- Provider
- Release date
- Intelligence
- Coding
- Agentic
- Input price
- Output price
- Cache pricing
- Output speed
- TTFT
- Context
- open-weight indicator
- last refreshed

Features:
- sort;
- multi-filter;
- hide/show columns;
- selected-only mode;
- pin rows;
- compare;
- quick add/remove;
- CSV export if simple;
- URL-state persistence.

## G. Model detail drawer/page

Open a side drawer for quick inspect and a full route for deep detail.

Must contain:
- provider;
- release;
- active/deprecated status;
- metrics;
- price;
- performance;
- benchmark version;
- source lineage;
- latest source time;
- historical snapshots;
- meaningful change events;
- related models;
- recent news about that model.

---

# 6. Derived model metrics

## Blended price

Default assumption:
- 75% input
- 25% output

But make this configurable and label it.

## Monthly workload cost

`input_millions * input_price + output_millions * output_price`

## Value score

No mysterious universal score.

Implement explicit modes:
- `intelligence_per_dollar`
- `coding_per_dollar`
- `agentic_per_dollar`
- `weighted_value`

For weighted value:
- normalize user-selected metrics;
- invert lower-is-better metrics;
- apply visible weights;
- apply optional minimum capability threshold;
- display components.

## Pareto frontier

Implement and unit-test.

---

# 7. News Hub

News must not be one undifferentiated feed.

Create tabs/routes:

### News Overview
High-signal cross-category summary.

### AI General
General AI ecosystem news:
- major launches;
- research;
- funding/acquisitions when relevant;
- regulation relevant to AI;
- infrastructure/chips;
- major product changes.

### Model Providers
Provider-specific:
- OpenAI
- Anthropic
- Google
- xAI
- Meta
- Mistral
- DeepSeek
- Qwen
- etc.

### Social Pulse
Important monitored social posts, especially X/Twitter.

Do not scrape X HTML as the foundation.
Use authorized APIs when credentials exist.
Until then use fixtures and adapter interfaces.

Each item:
- author/account;
- platform;
- timestamp;
- short excerpt or metadata consistent with platform terms;
- original link;
- entities;
- category;
- trust level;
- whether corroborated by an official source.

### Research & Benchmarks
- Artificial Analysis methodology/posts;
- benchmark releases;
- evaluation changes;
- notable papers;
- Hugging Face technical ecosystem.

---

# 8. Harness Watch

This is a first-class workspace, not a news tag.

Create sub-sections:

## A. Plan board

Show active plans in comparable cards/table.

Fields:
- Product
- Plan
- Monthly price
- Annual price if relevant
- included credits
- effective included value if documented
- request estimates when vendor documents them
- included models
- premium-model access
- BYOK
- open-source
- CLI/Desktop/IDE/Web
- country/region notes
- reset behavior
- overage / PAYG
- last verified
- source URL

## B. Cheapest options

Create factual sortable views, not unexplained editorial winners:

- Lowest monthly entry price
- Most included credit per USD
- Free options
- Cheapest plan with premium models
- Cheapest open-model plan
- BYOK-friendly tools
- Highest documented usage allowance

Always show the formula/source.

## C. Plan comparison

User selects plans the same way models are selected.

Allow:
- add/remove plan;
- 3–6 plan compare;
- price;
- included credits;
- included models;
- usage/reset style;
- BYOK;
- platform availability;
- open-source;
- notes.

## D. Harness change feed

Track events such as:
- new plan;
- price change;
- credits changed;
- model added/removed;
- fair-use limit changed;
- CLI major release;
- new feature;
- promotion started/ended.

## E. Harness ecosystem news

Examples of tracked products:
- Command Code
- OpenCode
- Claude Code
- Codex
- Gemini CLI
- Kilo Code
- Freebuff
- Cursor
- Windsurf

Do not assume this list is permanent.

## F. “What should I pay for?” calculator

Optional but valuable.

Inputs:
- monthly budget;
- coding hours/day;
- preference for open vs frontier;
- BYOK available?
- need terminal CLI?
- need cloud agents?
- need IDE?
- preferred model/provider.

Output:
- plans matching constraints;
- estimated fit;
- factual explanation.

This is non-political and can provide ranked results as long as methodology is transparent.

---

# 9. Current harness seed facts — verify before storing

The implementation should seed source definitions, NOT freeze these values as permanent truth.

At specification time:

- Command Code Go is documented at $1/month with $10 credits and a vendor estimate of ~15K requests.
- Command Code GOAT is shown at $10/month on current pricing.
- OpenCode Go is documented at $5 for first month then $10/month.
- Kilo Code individual platform is free; Kilo Pass begins at $19/month, with higher tiers.
- Claude Pro is $20 monthly and includes Claude Code; Max tiers begin at $100.
- Freebuff advertises a $0 ad-supported coding-agent offering.

These are examples of why the product needs snapshots and `last_verified_at`.

Never render stale prices without freshness metadata.

---

# 10. World & Politics

Keep this workspace visually integrated but logically isolated.

Suggested internal tabs:
- Top
- Argentina
- US
- Latin America
- World
- Economy
- Regulation

Card requirements:
- headline;
- source;
- publication time;
- event time when different;
- country/region;
- short neutral summary;
- original article;
- optional `primary source` link;
- `Developing` badge if facts are changing.

For politically contested stories:
- attribute claims;
- avoid loaded language;
- do not write an AI-generated political verdict;
- use multiple reliable sources where needed;
- do not compute ideological sentiment.

Do not mix political ranking with model/harness scoring.

---

# 11. Data architecture

Use a modular monolith.

Preferred stack:
- Next.js App Router
- TypeScript strict
- Tailwind
- shadcn/ui
- TanStack Table
- Recharts
- Supabase/Postgres
- QStash
- Zod
- Vitest
- Playwright
- axe

Domain modules:
- models
- providers
- benchmarks
- model-selection
- model-scoring
- news
- social
- harnesses
- plans
- world-news
- sources
- ingestion
- snapshots
- change-events

---

# 12. Ingestion schedules

Keep source-specific cadence.

Artificial Analysis:
- respect API rate limits;
- paginate properly;
- capture rate-limit headers;
- default around 30m on Free if current page count still makes that safe;
- dynamically skip/defer when remaining quota is low.

Official provider feeds:
- 10–30m depending on source.

Harness pricing pages:
- 1–6h is sufficient for most;
- also run daily canonical verification.

Harness changelogs:
- 10–30m if feed exists.

Social:
- based on authorized API quota.

World/political news:
- frequent enough for freshness, but respect chosen provider quotas.

Use `ingestion_runs` and `change_events`.

---

# 13. Tooling

Install and use useful agent tooling where current environment supports it:
- Superpowers
- Gentleman Programming Engram
- Vercel MCP / skills
- Supabase MCP / skills
- Playwright
- Vitest
- axe
- GitHub tooling
- official documentation search

Use Engram throughout the project:
- search project memory at start;
- persist architecture decisions;
- persist handoffs;
- never persist secrets.

Do not blindly install untrusted third-party MCP servers.
Artificial Analysis production integration should use its official API unless an official MCP is discovered and verified.

---

# 14. Repository quality

Must include:
- README
- AGENTS.md
- CONTRIBUTING.md
- SECURITY.md
- CHANGELOG.md
- `.env.example`
- strict CI
- docs structure
- ADRs
- implementation history
- runbooks
- source registry
- tests
- fixture data
- handoff file

See `REPOSITORY_AND_DOCUMENTATION_STANDARD.md`.

---

# 15. Required implementation modes

## mock
No credentials required.
All major screens work with deterministic fixtures.
Clearly labeled.

## live
Adapters use real sources.
Missing optional integrations degrade gracefully.

Do not fake a live state.

---

# 16. Quality requirements

Before declaring completion, run:
- formatter
- lint
- typecheck
- unit tests
- integration tests
- production build
- Playwright smoke suite
- accessibility checks

Fix failures.

No `TODO` should substitute for work that can be completed now.

---

# 17. Final autonomous exit criteria

Do not stop until all practical criteria below are met:

- polished app shell;
- Models workspace implemented;
- model selector with defaults/presets;
- ranking boards;
- cost-efficiency logic;
- configurable charts;
- provider grouping;
- full table;
- model detail;
- News Hub;
- Social adapter abstraction;
- Harness Watch;
- plan comparison;
- harness change history;
- World & Politics workspace;
- source registry;
- database migrations;
- RLS/security design;
- Artificial Analysis adapter;
- official-news adapters;
- harness source adapters;
- QStash job layer;
- mock fixtures;
- tests;
- CI;
- docs;
- final passing build;
- final handoff.

If live keys are unavailable, mark those items:
`IMPLEMENTED — LIVE VERIFICATION PENDING CREDENTIALS`

Then continue to the next item.

---

# 18. Final report

Before ending:
- update project-status;
- update implementation history;
- update changelog;
- update agent handoff;
- update Engram if available;
- state checks run and results;
- list credentials/configuration still needed;
- list exact commands for the user to run next.

Begin by reading every specification file in this package, then inspect the repo and work continuously.
