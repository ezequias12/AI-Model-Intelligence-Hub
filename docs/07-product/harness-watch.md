# Harness Watch

A first-class workspace, not a news tag. It tracks the coding-agent subscription market: what each
plan costs, what it includes, which models it reaches, and what changed.

"Artificial Analysis for coding-agent subscriptions" is the intent, but every claim here is a
snapshot with a timestamp and a source URL, never a standing verdict.

## Sub-navigation

| Route | Purpose |
| --- | --- |
| `/harness` | Overview: monitored products, latest plan change, cheapest paid entry, free option count, last verification |
| `/harness/plans` | Every active plan with price, credits, model access, platform support and last checked |
| `/harness/compare` | Select plans and compare them side by side |
| `/harness/cheapest` | Factual cheapest views, each with its formula |
| `/harness/changes` | Chronological plan and price change feed with before/after values |
| `/harness/news` | Harness ecosystem news |
| `/harness/calculator` | "What should I pay for?" with transparent fit scoring |

There is also a dedicated comparison mode in the global Compare workspace (`/compare` -> "Harness
plans"), which mirrors the selection pattern. Model metrics and plan metrics are never mixed in
one schema (ADR-0007).

## Monitored products

Nine products are modelled in the fixture set. The list is not permanent.

| Product | Vendor | Open source | Platforms | Plans |
| --- | --- | --- | --- | --- |
| Command Code | Command Code | No | CLI, IDE | Go, GOAT |
| OpenCode | OpenCode | Yes | CLI, desktop, web | Free (BYOK), Go |
| Claude Code | Anthropic | No | CLI, IDE, web, desktop, cloud agent | Pro, Max 5x, Max 20x |
| OpenAI Codex | OpenAI | No | CLI, IDE, web, cloud agent | ChatGPT Plus (Codex included), Pro |
| Gemini CLI | Google | Yes | CLI, IDE | Free tier, API key (BYOK) |
| Kilo Code | Kilo Code | Yes | IDE, CLI | Individual platform, Kilo Pass |
| Freebuff | Freebuff | No | Web, CLI | Ad-supported free tier |
| Cursor | Anysphere | No | IDE, CLI, web, cloud agent | Hobby, Pro |
| Windsurf | Windsurf | No | IDE, web | Free, Pro |

Extraction configurations exist for the pricing pages of seven of these
(`command-code-pricing`, `opencode-go`, `kilo-pricing`, `claude-pricing`, `freebuff`,
`cursor-pricing`, `windsurf-pricing`).

## Plan board

A strong table/card hybrid. Each row shows product, plan, monthly price, billing period, included
credits, model access summary, BYOK, open source, platforms and last checked.

Sortable by price, included credit, credit per USD, product and freshness.

Plan fields are documented in `docs/04-data/harness-plan-schema.md`.

## Cheapest views

Never a single unexplained winner. Seven factual categories, each with its formula and source:

| Category | Rule |
| --- | --- |
| Free | `monthly_price_usd == 0` |
| Lowest paid entry | `min(monthly_price_usd)` over paid plans |
| Highest included credit per USD | `included_credits_usd / monthly_price_usd` |
| Premium models under $X | cheapest plan with documented frontier access at or below the threshold (default $20) |
| Open models under $X | cheapest plan listing an open-weight model family |
| BYOK-friendly | cheapest plan with `byok` |
| Highest documented allowance | `documented_estimated_requests / monthly_price_usd` |

A category with no qualifying plan returns nothing rather than a fabricated winner. The
open-weight category is a heuristic substring match against a hint list
(`llama`, `qwen`, `deepseek`, `glm`, `kimi`, `mistral`, `gpt-oss`, `mimo`, `granite`) and is
labelled as such.

## Plan comparison

A selected-plan tray mirrors the model selector:

- add and remove plans;
- 3 to 6 plans;
- `?plans=` query parameter plus local storage (`amih.harness.selection.v1`);
- 15 comparison rows covering price, credits, credit per USD, reset period, overage model,
  included models, BYOK, frontier access, CLI, desktop, IDE, cloud agents, regions, last verified
  and notes.

Only price and credits declare a better direction; everything else is presented factually. Missing
values render as an em dash.

## Change feed

Events come from `harness_change_events` (live) and from deterministic fixture events (mock). Each
event carries a type, before/after values, an observation time and a significance.

Event types: `plan_created`, `plan_removed`, `price_changed`, `credits_changed`, `model_added`,
`model_removed`, `limit_changed`, `cli_release`, `feature_added`, `promotion_started`,
`promotion_ended`.

Significance defaults, from `diffSnapshots`: price and credit fields are `high`; model lists,
request estimates, reset period, overage model, BYOK, frontier access, deprecation and active flags
are `medium`; everything else is `low`.

Fixture examples: `Command Code GOAT credits changed` ($50 to $60 credits, high),
`Command Code Go price changed` ($3 to $1, high), `OpenCode Go added a model to its curated list`
(medium), `Claude Code Pro usage limit changed` (monthly to rolling 5h, medium),
`Freebuff changed its daily allowance` (medium), `Kilo Pass bonus-credit promotion started` (low),
`Cursor Pro monthly credit allocation changed` ($15 to $20, high).

In live mode, no job writes change events, so the feed is empty until backlog item H2 is done
(KI-8).

## Budget calculator

Inputs: monthly budget, coding hours per day, open-weight preference, BYOK requirement, CLI
requirement, cloud agents requirement, IDE requirement, optional preferred model.

Output: plans that satisfy every hard constraint, ranked by a fit score between 0 and 100, each with
its reasons and disqualifiers. The scoring table is in `docs/04-data/harness-plan-schema.md`.

Every score is decomposable: a reader can see exactly which conditions added or removed points.
Plans with any disqualifier are excluded from the ranking rather than silently down-scored.

`codingHoursPerDay` is accepted and displayed but does not affect the score, because no plan
snapshot carries an hours-based allowance and the implementation does not invent a conversion. This
is a stated gap, not an oversight.

## Freshness

The harness domain has deliberately looser thresholds than models: `aging` begins at 2880 minutes
(48 hours), because pricing pages change slowly. Every plan still carries a `capturedAt` and a
source URL, and the board shows last-checked time.

Seed values in the specification (Command Code Go at $1 with $10 credits and a vendor estimate of
roughly 15K requests; GOAT at $10; OpenCode Go at $5 for the first month then $10; Kilo Code free
platform with Kilo Pass from $19; Claude Pro at $20 with Max from $100; Freebuff advertising a free
ad-supported tier) appear in the fixture set as examples, not as permanent truth. The application is
designed to fetch and timestamp the canonical values before showing them as current.

## Not implemented

| Item | Detail |
| --- | --- |
| Seeding of `harness_products` and `harness_plans` | No job populates them; the pricing job only writes snapshots for plans whose canonical key already exists (KI-9, backlog H1) |
| Change-event persistence | The writer methods exist but no job calls them (KI-8) |
| Live selector verification | Seven extraction configs exist and are unit-tested against fixtures, but the patterns have not been checked against the current pages |
| CSV export for the plan board | CSV exists only in the model table |
| Notifications on price changes | No digest or alert channel |
| `codingHoursPerDay` effect on the calculator | Accepted but unused |

## Related

- Schema: `docs/04-data/harness-plan-schema.md`
- Decision record: ADR-0007
- Known issues: KI-8, KI-9
- Runbooks: `docs/05-operations/runbooks/source-parser-breakage.md`,
  `docs/05-operations/runbooks/stale-data.md`
