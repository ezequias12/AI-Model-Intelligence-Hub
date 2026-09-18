# Harness plan schema

The shape of a coding-harness plan snapshot, its validation, and the derived metrics built
from it. Sources: `src/lib/domain/schema.ts` (Zod), `supabase/migrations/20260918000400_news_social_harness_world.sql`
(SQL), `src/lib/domain/harness-metrics.ts` (derived values).

## Entities

| Entity | Keys | Purpose |
| --- | --- | --- |
| `harness_products` | `id`, `slug` (unique) | A product: Command Code, OpenCode, Claude Code, OpenAI Codex, Gemini CLI, Kilo Code, Freebuff, Cursor, Windsurf |
| `harness_plans` | `id`, `canonical_plan_key` (unique), `product_id` | A subscribable tier. The canonical key is stable across renames. |
| `harness_plan_snapshots` | `id`, unique `(plan_id, captured_at, raw_source_hash)` | The observed state of a plan at a capture time |
| `harness_change_events` | `id` | A recorded change with `before_json` / `after_json` |

## harness_products

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Display name |
| `slug` | kebab-case string | Unique |
| `vendor` | string | Company behind the product |
| `website` | URL | |
| `docsUrl` | URL or null | |
| `pricingUrl` | URL or null | Also used as the snapshot `sourceUrl` when present |
| `changelogUrl` | URL or null | |
| `openSource` | boolean | The client is open source (for example OpenCode, Gemini CLI, Kilo Code) |
| `repoUrl` | URL or null | |
| `platforms` | array of `cli`, `desktop`, `ide`, `web`, `cloud_agent` | Product-level platforms |
| `active` | boolean | |

## harness_plans

| Field | Type | Notes |
| --- | --- | --- |
| `productId` | string | Foreign key to `harness_products` |
| `canonicalPlanKey` | string | Unique, stable, derived by `canonicalPlanKey(productSlug, planName)`. Commented in SQL: "Stable key so a plan rename does not fork its history." |
| `name` | string | Display name, which may change |
| `active` | boolean | |

## harness_plan_snapshots

| Field | Type | Nullable | Notes |
| --- | --- | --- | --- |
| `planId` | string | no | Foreign key to `harness_plans` |
| `capturedAt` | ISO date | no | Observation time |
| `monthlyPriceUsd` | number | yes | `null` when not documented |
| `annualPriceUsd` | number | yes | `null` when not documented |
| `includedCreditsUsd` | number | yes | Documented bundled credit value |
| `estimatedRequests` | integer | yes | Commented in SQL: "Only ever populated when the vendor documents it. Never inferred." |
| `estimatedRequestsSourceUrl` | URL | yes | Set only when `estimatedRequests` exists |
| `resetPeriod` | enum | no | `daily`, `weekly`, `monthly`, `rolling_5h`, `none` |
| `overageModel` | enum | no | `hard_cap`, `pay_as_you_go`, `throttle`, `unknown` |
| `byok` | boolean | no | Bring your own key supported |
| `models` | string array | no | Model families or tiers reachable on the plan |
| `frontierModelAccess` | boolean | no | `true` only when a frontier-tier model is documented |
| `platforms` | array of `cli`, `desktop`, `ide`, `web`, `cloud_agent` | no | Plan-level platforms |
| `regions` | string array | no | Region notes |
| `notes` | string | yes | Free text from the page or the fixture |
| `sourceId` | string | no | Foreign key to `sources` |
| `sourceUrl` | URL | no | The page the values came from |
| `rawSourceHash` | string | no | `stableHash` of the fetched page, so a silent change is detectable |

`harness_change_events`:

| Field | Type | Notes |
| --- | --- | --- |
| `planId`, `productId` | string | Foreign keys |
| `eventType` | enum | `plan_created`, `plan_removed`, `price_changed`, `credits_changed`, `model_added`, `model_removed`, `limit_changed`, `cli_release`, `feature_added`, `promotion_started`, `promotion_ended` |
| `before`, `after` | JSON or null | The observed values |
| `observedAt` | ISO date | |
| `significance` | enum | `low`, `medium`, `high` |
| `sourceId` | string | |
| `summary` | string | Human-readable line for the feed |

## Derived metrics

From `deriveHarnessPlanMetrics(snapshot)` in `src/lib/domain/harness-metrics.ts`. Every
derived value is `null` when an input is missing. Nothing is inferred.

| Derived field | Formula | Null when |
| --- | --- | --- |
| `effectiveMonthlyPriceUsd` | `monthlyPriceUsd ?? annualPriceUsd / 12` (rounded to 2 decimals) | Both prices are `null` |
| `entryPriceUsd` | `monthlyPriceUsd ?? effectiveMonthlyPriceUsd` | Both are `null` |
| `includedCreditsUsd` | Copied from the snapshot | `null` |
| `includedCreditPerDollar` | `includedCreditsUsd / entryPriceUsd` (rounded to 4 decimals) | Either input is `null`, or the price is not `> 0` |
| `documentedRequestEstimatePerDollar` | `estimatedRequests / entryPriceUsd` (rounded to 2 decimals) | Either input is `null`, or the price is not `> 0` |
| `includedValueOverPriceUsd` | `includedCreditsUsd - entryPriceUsd` (rounded to 2 decimals) | Either input is `null` |
| `isFree` | `entryPriceUsd === 0` or (`entryPriceUsd` is `null` and `includedCreditsUsd` is not) | Never |
| `byok`, `frontierModelAccess`, `platforms`, `resetPeriod` | Copied | Never |
| `modelCount` | `models.length` | Never |
| `verifiedFrom` | Copied `sourceUrl` | Never |

`documentedRequestEstimatePerDollar` is the field the product is most careful about: if a
vendor does not publish a request allowance, it stays `null` and the UI shows an em dash with
a link to the numbers that do exist, rather than deriving an estimate from credits.

## Cheapest views

`buildCheapestViews(contexts, { premiumThresholdUsd = 20, openModelMatchers })` returns one
entry per category, each with a `formula` and `detail` string so nothing is an unexplained
winner. Categories with no qualifying plan return `null` (or an empty array for `free`).

| Category | Selection rule | Formula string |
| --- | --- | --- |
| `free` | `isFree`, sorted by value | `monthly_price_usd == 0` |
| `lowestPaidEntryUsd` | Minimum `entryPriceUsd` over paid plans | `min(monthly_price_usd) over paid plans` |
| `highestCreditPerDollar` | Maximum `includedCreditPerDollar` | `included_credits_usd / monthly_price_usd` |
| `premiumUnderThreshold` | Cheapest paid plan with `frontierModelAccess` and price `<= premiumThresholdUsd` | `min(monthly_price_usd) where frontier_model_access and price <= $X` |
| `openModelsUnderThreshold` | Cheapest paid plan whose model list matches an open-weight hint | `min(monthly_price_usd) where plan lists an open-weight model family` |
| `byokFriendly` | Cheapest plan with `byok` | `min(monthly_price_usd) where byok == true` |
| `highestDocumentedAllowance` | Maximum `documentedRequestEstimatePerDollar` | `documented_estimated_requests / monthly_price_usd` |

Open-weight hints used for matching (`OPEN_MODEL_HINTS`): `llama`, `qwen`, `deepseek`, `glm`,
`kimi`, `mistral`, `gpt-oss`, `mimo`, `granite`. Matching is a case-insensitive substring test
against the plan's model list, and it is a heuristic, not a classification.

## Plan comparison rows

`buildPlanComparisonRows(contexts)` returns 15 rows, each with a format and an optional
`betterDirection`:

| Key | Label | Format | Better direction |
| --- | --- | --- | --- |
| `price` | Monthly price | currency | lower |
| `credits` | Included credits | currency | higher |
| `creditPerDollar` | Credit per USD | number | higher |
| `usage` | Reset period | text | - |
| `overage` | Overage / PAYG | text | - |
| `models` | Included models | list | - |
| `byok` | BYOK | boolean | - |
| `frontier` | Frontier models | boolean | - |
| `cli` | CLI | boolean | - |
| `desktop` | Desktop | boolean | - |
| `ide` | IDE | boolean | - |
| `cloud` | Cloud agents | boolean | - |
| `regions` | Regions | list | - |
| `verified` | Last verified | text | - |
| `notes` | Notes | text | - |

Only price and credits declare a better direction; everything else is presented factually.
A missing value is `null` and renders as an em dash, never as `0`.

## Budget calculator

`recommendPlans(input, contexts)` scores plans between 0 and 100 and returns only plans with
no disqualifiers, sorted by score then by price.

Inputs: `monthlyBudgetUsd`, `codingHoursPerDay`, `preferOpen`, `requiresByok`, `requiresCli`,
`requiresCloudAgents`, `requiresIde`, optional `preferredModelMatch`.

Scoring, from the implementation:

| Condition | Effect |
| --- | --- |
| Base | `fit = 50` |
| Price within budget | `fit += headroom * 20`, where `headroom = (budget - price) / max(1, budget)` |
| Price above budget | `fit -= 40` and a disqualifier is added |
| `includedCreditPerDollar >= 1` | `fit += min(20, creditPerDollar * 4)` |
| `preferOpen` and the plan lists an open-weight family | `fit += 15` |
| `preferOpen` and the plan is closed-focused with fewer than two models | `fit -= 10` and a reason is recorded |
| `preferredModelMatch` present in the model list | `fit += 20` |
| `preferredModelMatch` absent | A disqualifier is added |
| Plan is free | `fit += 10` |
| Each disqualifier | `fit -= 25` |

Disqualifiers: missing BYOK when required, missing CLI/IDE/cloud agents when required, no
documented price, price above budget, and no model matching the preferred term. Every result
returns its `reasons` and `disqualifiers` so the score is decomposable. The score is clamped to
`[0, 100]`.

`codingHoursPerDay` is accepted as an input and displayed, but it does not currently affect the
score: no plan snapshot carries an hours-based allowance, so the implementation does not invent
a conversion. This is a deliberate gap, not an oversight.

## Fixture values

`src/lib/fixtures/harness.ts` contains nine products, fifteen plans and one snapshot per plan,
plus seven change events. Fixture values mirror what the pricing pages documented at
specification time. They are labelled as fixtures in the UI and are never presented as current
truth.

Fixture change events: `Command Code GOAT credits changed` (high, 50 to 60 credits),
`Command Code Go price changed` (high, $3 to $1), `OpenCode Go added a model to its curated
list` (medium), `Claude Code Pro usage limit changed` (medium, monthly to rolling 5h),
`Freebuff changed its daily allowance` (medium, rolling 5h to daily), `Kilo Pass bonus-credit
promotion started` (low), `Cursor Pro monthly credit allocation changed` (high, $15 to $20).

## Verification status

Extraction from live pricing pages is `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`:
the code paths, required-field gate and configuration versioning exist and are unit-tested
against fixtures, but the selector patterns have not been checked against the current pages.
There is no credential to set for this source class; the pending step is manual verification.
