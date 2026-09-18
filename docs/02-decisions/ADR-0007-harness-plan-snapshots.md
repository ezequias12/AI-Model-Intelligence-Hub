# ADR-0007: Harness plan snapshots with stable canonical plan keys

- Status: Accepted
- Date: 2026-09-18
- Deciders: implementation agent (autonomous phase)

## Context

Coding-agent subscriptions change constantly and quietly. A plan's price moves, its included
credit allocation is adjusted, a model family is added or removed from a curated list, a
fair-use limit is relaxed, a promotion starts or ends. These products also rename and
restructure their tiers.

Three specific hazards follow:

1. **A rename forks history.** If a plan is identified by its display name, "Go" becoming
   "Go Plus" creates what looks like a new plan, and the change feed reports a removal and a
   creation instead of a price change.
2. **Prices are read as permanent truth.** A scraped price presented without a capture time
   is a liability: it is right until it is wrong, and nobody can tell.
3. **Undocumented numbers get invented.** Vendors sometimes publish an approximate request
   allowance and sometimes do not. Deriving a request count from a price, or filling a
   missing number with zero, would produce authoritative-looking fiction.

There is also a structural question: harness plans are not models, and their metrics must
never be compared in the same schema as model metrics.

## Decision

1. **A stable key identifies a plan.** `harness_plans.canonical_plan_key` is unique and
   commented in SQL as "Stable key so a plan rename does not fork its history."
   `canonicalPlanKey(productSlug, planName)` derives it by slugifying the plan name.
2. **State is snapshotted, never overwritten.** `harness_plan_snapshots` holds one row per
   observed state with `captured_at`, the full observed field set and `raw_source_hash`. The
   unique constraint `(plan_id, captured_at, raw_source_hash)` is the upsert target, so a
   retried write is idempotent.
3. **Every value carries its provenance.** Each snapshot stores `source_id`, `source_url` and
   the raw page hash, so a rendered price can always be traced to the page it came from.
4. **Undocumented numbers are `null`, and derived values follow.** `estimated_requests` is
   commented in SQL as "Only ever populated when the vendor documents it. Never inferred."
   `estimatedRequestsSourceUrl` is set only when a value exists.
   `documentedRequestEstimatePerDollar` is `null` when either input is missing, and
   `deriveHarnessPlanMetrics()` returns `null` for every derived field when the price is
   unknown.
5. **Extraction fails loudly.** The pricing-page extractor declares `required` fields per
   plan; a required field that does not resolve fails the run with a reason stating that
   nothing was written. A missing number is never coerced to `0`. Configurations are
   versioned (`configVersion`) and the raw page hash is stored so a silent change is
   detectable.
6. **Changes are explicit events.** `harness_change_events` records one row per event with
   `eventType` from a fixed vocabulary (`plan_created`, `plan_removed`, `price_changed`,
   `credits_changed`, `model_added`, `model_removed`, `limit_changed`, `cli_release`,
   `feature_added`, `promotion_started`, `promotion_ended`), plus `before_json`,
   `after_json`, `observed_at`, `significance` and a summary.
7. **Cheapest views expose their formula.** `buildCheapestViews()` returns each category with
   a `formula` string (for example `included_credits_usd / monthly_price_usd`) and a
   `detail` string, so no cheapest option is an unexplained winner. Categories with no
   qualifying plan return `null` rather than an invented winner.
8. **Harness metrics never mix with model metrics.** The Compare workspace has two modes and
   `buildPlanComparisonRows()` defines a plan-specific row set. There is no shared comparison
   schema.

## Consequences

Positive:

- A plan rename changes the display name without creating a fake removal plus creation.
- Every rendered price can be traced to a URL and a capture time, and freshness thresholds
  for the harness domain are deliberately looser (aging at 2880 minutes) because pages change
  slowly while still being labelled.
- The change feed is meaningful: before/after values are stored, so the feed can show what
  moved rather than only that something did.
- The "no invented number" rule is enforced at three layers: the extractor, the domain
  derivation and the display formatting.

Negative:

- The canonical key is derived from the current display name, so the first rename after a
  configuration change still requires a mapping if the slugified name changes materially.
  The key is stable once assigned and stored, but nothing migrates it automatically.
- Extraction quality depends on regex patterns against live pages. The configurations are
  versioned and tested against fixtures, but the patterns have not been verified against the
  current live pages, so this capability is
  `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`.
- Snapshot rows store the full field set each time, so storage grows with capture frequency
  even when nothing changed. There is no retention policy for `harness_plan_snapshots`.
- A plan with no documented price yields `null` everywhere, so it appears in the plan board
  but never in a cheapest category. That is correct and also less useful.
- The pricing job writes snapshots only for plans whose `canonical_plan_key` already exists,
  and no job populates `harness_plans` itself. A fresh database therefore has no plans for
  the pricing job to attach to, which is a real gap recorded in the backlog.

## Alternatives considered

1. **Identify plans by display name.** Rejected. It forks history on the first rename and
   produces misleading change events.
2. **Store one current row per plan and update it in place.** Rejected. It removes the change
   feed and makes "what changed in the last week" unanswerable, which is the core value of
   this workspace.
3. **Infer the request allowance from the included credits.** Rejected. A credit value is not
   a request count; the conversion depends on token usage the vendor does not publish.
4. **Write `0` when a price cannot be extracted.** Rejected. A zero price is indistinguishable
   from a genuinely free plan and would corrupt the cheapest views. The extractor fails
   instead.
5. **Reuse the model comparison schema for plans.** Rejected. The fields do not overlap
   meaningfully, and mixing them invites comparing a monthly price against an intelligence
   index.
6. **Trust a single aggregated "best plan" verdict.** Rejected. Instead, categories are
   factual and each carries its formula, so a reader can disagree with the framing.
