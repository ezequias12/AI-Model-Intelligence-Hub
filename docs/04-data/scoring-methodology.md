# Scoring methodology

Every metric the product can rank, chart, filter or export is declared once in
`src/lib/analytics/metric-registry.ts`. The registries drive the table, the charts, the
ranking boards, the Compare view and the Methodology page, so a metric cannot mean two
different things in two screens.

This document reproduces that registry and the formulas behind it. It states the
assumptions explicitly, including the ones that are estimates.

## Metric catalogue

| Key | Label (short) | Group | Direction | Provenance | Unit | Accessor |
| --- | --- | --- | --- | --- | --- | --- |
| `intelligence` | Intelligence (Intel) | capability | higher is better | measured | - | `model.metrics.intelligence` |
| `coding` | Coding | capability | higher is better | measured | - | `model.metrics.coding` |
| `agentic` | Agentic / tool use (Agentic) | capability | higher is better | measured | - | `model.metrics.agentic` |
| `math` | Math | capability | higher is better | measured | - | `model.metrics.math` |
| `outputSpeedTps` | Output speed (Speed) | performance | higher is better | measured | tok/s | `model.metrics.outputSpeedTps` |
| `ttftSeconds` | Time to first token (TTFT) | performance | lower is better | measured | s | `model.metrics.ttftSeconds` |
| `contextWindow` | Context window (Context) | capability | higher is better | measured | tokens | `model.metrics.contextWindow` |
| `inputPricePerMillion` | Input price ($ in) | cost | lower is better | measured | USD / 1M tokens | `model.metrics.inputPricePerMillion` |
| `outputPricePerMillion` | Output price ($ out) | cost | lower is better | measured | USD / 1M tokens | `model.metrics.outputPricePerMillion` |
| `cacheReadPricePerMillion` | Cache read price ($ cache) | cost | lower is better | measured | USD / 1M tokens | `model.metrics.cacheReadPricePerMillion` |
| `blendedPrice` | Blended price (Blended) | cost | lower is better | **derived** | USD / 1M tokens | Context-level `blendedPrice` |
| `intelligencePerDollar` | Intelligence per dollar (Intel/$) | derived | higher is better | **derived** | index points per USD | `valueScore(mode: intelligence_per_dollar).score` |
| `codingPerDollar` | Coding per dollar (Coding/$) | derived | higher is better | **derived** | index points per USD | `valueScore(mode: coding_per_dollar).score` |
| `agenticPerDollar` | Agentic per dollar (Agentic/$) | derived | higher is better | **derived** | index points per USD | `valueScore(mode: agentic_per_dollar).score` |
| `weightedValue` | Weighted value (Weighted) | derived | higher is better | **derived** | normalised capability per USD | `valueScore(mode: weighted_value, population).score` |

`unit` is declared for display and export purposes. The two entries with `unit: null`
(intelligence and the other bare indices) are composite indices with no unit.

Registry descriptions, reproduced:

| Key | Description |
| --- | --- |
| `intelligence` | "Composite reasoning and general capability index as published by the metrics source." |
| `coding` | "Coding-specific index. Not a substitute for evaluating your own repository." |
| `agentic` | "Tool-use and long-horizon task index. Highly sensitive to the surrounding agent scaffold." |
| `math` | "Math benchmark index, where the source publishes it separately." |
| `outputSpeedTps` | "Median output tokens per second observed by the metrics source." |
| `ttftSeconds` | "Median time to first token. Lower is better." |
| `contextWindow` | "Maximum documented context window, in tokens." |
| `inputPricePerMillion` | "Published price for input tokens. Lower is better." |
| `outputPricePerMillion` | "Published price for output tokens. Lower is better." |
| `cacheReadPricePerMillion` | "Cached input read price. Reported separately because caching changes real workloads materially." |
| `blendedPrice` | "Derived: 75% input price + 25% output price. The weighting is an assumption and is labeled as such everywhere it appears." |
| `intelligencePerDollar` | "Derived: intelligence index divided by blended price." |
| `codingPerDollar` | "Derived: coding index divided by blended price." |
| `agenticPerDollar` | "Derived: agentic index divided by blended price." |
| `weightedValue` | "Derived: min-max normalised intelligence/coding/agentic (weights 0.5/0.3/0.2) divided by blended price." |

## Blended price

Formula, from `blendedPrice(metrics, weights)` in `src/lib/domain/metrics.ts`:

```text
blended_price = input_price_per_million * w_input
              + output_price_per_million * w_output
```

**Assumption: 75% input, 25% output.** This is declared as
`DEFAULT_BLENDED_PRICE_WEIGHTS = { input: 0.75, output: 0.25 }` in
`src/lib/domain/schema.ts`. The reasoning recorded in the code is that typical chat and agent
workloads are prompt-dominated.

**It is configurable, not fixed.** The weights are a parameter with a Zod schema
(`blendedPriceWeightsSchema`, each weight between 0 and 1). The function normalises weights
that do not sum to 1, and returns `null` for a degenerate weighting where the total is zero
or less. Wherever the blended price appears, the assumption is surfaced: the registry
description names the 75/25 split, and the ranking board definition for blended price
describes itself as "75% input + 25% output".

Behaviour:

- If either input or output price is `null`, the result is `null`. It is never partially
  computed.
- Weights are normalised before use: `w_i / (w_input + w_output)`.

## Monthly workload cost

Formula, from `monthlyWorkloadCost(metrics, workload)`:

```text
input_cost   = (input_millions - cached_millions) * input_price
             + cached_millions * (cache_read_price ?? input_price)
output_cost  = output_millions * output_price
cache_saving = cached_millions * max(0, input_price - cache_read_price)   (0 when no cache price)
total_cost   = input_cost + output_cost
cached_millions = input_millions * clamp01(cache_hit_rate)
```

Notes:

- `cacheHitRate` is clamped to `[0, 1]`; a value above 1 is treated as 1.
- The caching benefit is reported as an explicit `cacheSavings` field rather than silently
  discounting the total.
- If `cacheReadPricePerMillion` is `null`, the cached share is priced at the normal input
  price and the saving is `0` (not a guess).
- Returns `null` if either the input or the output price is missing.

This metric is not in the registry; it is available through the domain function and is used
where a workload is specified. It is documented here because it is part of the cost story.

## Value scores

Formula, from `valueScore(metrics, options, population)`:

```text
intelligence_per_dollar = intelligence / blended_price
coding_per_dollar       = coding        / blended_price
agentic_per_dollar      = agentic       / blended_price
weighted_value          = (0.5 * n_intelligence + 0.3 * n_coding + 0.2 * n_agentic) / blended_price
```

where `n_*` are min-max normalised components across the population:

```text
n_x = clamp01((x - min(population.x)) / (max(population.x) - min(population.x)))
```

and when `max === min`, `normalize()` returns `0.5`.

Rules:

- The result is `null` when the blended price is `null` or `<= 0`.
- A per-dollar mode returns `null` when its capability input is `null`.
- `weighted_value` returns `null` when the population has no finite values for any component,
  or when the model is missing any of intelligence, coding or agentic. It cannot normalise an
  absent component, and it does not substitute a zero.
- The default weights are `DEFAULT_WEIGHTED_VALUE_WEIGHTS = { intelligence: 0.5, coding: 0.3,
  agentic: 0.2, dearestIsWorst: true }`. They are a parameter, not a constant, and the
  components and weights are returned on the result so a caller can display them.
- The result carries `explanation`, a formula string, for example
  `weighted_value = (0.5·intelligence + 0.3·coding + 0.2·agentic) / blended_price`.
- There is deliberately no single universal score. Each mode is an explicit formula, and the
  cost-efficiency boards are labelled with the mode they use.

All four value metrics use the default 75/25 blended price through `blendedPrice(metrics)`
with no explicit weights argument.

## Minimum capability threshold

Cheap-but-weak models must not silently top a cost-efficiency board. `computeRankings`
accepts `minimumCapability` and increments `excludedBelowThreshold` for models whose
capability falls below it. The board's `methodology` string carries the metric description
and the result carries both `excludedBelowThreshold` and `excludedNoData`, so the UI can state
what was removed instead of hiding it.

Two precise behaviours to be aware of:

- The gate uses `intelligence` by default, overridable through
  `valueScore`'s `capabilityMetric` option for direct callers.
- A model whose capability is `null` is **not** excluded by the gate
  (`capability !== null && capability < threshold`). See KI-2 in
  `docs/03-implementation/current/known-issues.md`.
- `valueScore` still returns a score for a below-threshold model and sets
  `belowThreshold: true`; exclusion from a ranking is the caller's decision. This is asserted
  in `tests/unit/metrics.test.ts`.

## Ranking

`rankBy(items, getValue, direction, limit)`:

- Entries whose value is `null` are dropped, never ranked last by accident.
- Ties share the lower rank number (two entries tied at first are both rank 1, and the next
  is rank 3).
- `direction` is explicit, so lower-is-better metrics sort ascending.

Boards are limited to 10 rows each (`computeRankings` default `limit` is 10; the UI passes
10).

## Pareto frontier

`paretoFrontier(points, { xBetter, yBetter })`:

> A point is on the frontier when no other point is at least as good on both axes and strictly
> better on one.

- Non-finite coordinates are excluded.
- Directions are explicit, which is what makes a lower-is-better price axis correct: the
  comparison is flipped for that axis.
- `computeLandscapeChart` returns `onFrontier` per point plus a `frontierRule` string that
  names both axes and their directions, so the rule is visible in the UI. The rule text
  appears in `tests/unit/analytics.test.ts` as "no other model is at least as good".

## Metric groups used by the UI

| Constant | Contents | Used by |
| --- | --- | --- |
| `CHART_METRIC_KEYS` | `blendedPrice`, `intelligence`, `coding`, `agentic`, `outputSpeedTps`, `ttftSeconds`, `inputPricePerMillion`, `outputPricePerMillion`, `contextWindow`, `weightedValue` | Landscape chart axis selectors |
| `DEFAULT_TABLE_METRIC_KEYS` | `intelligence`, `coding`, `agentic`, `inputPricePerMillion`, `outputPricePerMillion`, `cacheReadPricePerMillion`, `outputSpeedTps`, `ttftSeconds`, `contextWindow` | Default visible columns in the model table |
| `LEADER_CARDS` | `intelligence`, `coding`, `agentic`, `outputSpeedTps`, `inputPricePerMillion`, `outputPricePerMillion`, `weightedValue`, plus a computed "Newest relevant model" | Dashboard metric leaders |
| `RANKING_BOARDS` | intelligence, coding, agentic, speed, lowest input price, lowest output price, lowest blended price, and four cost-efficiency boards | Rankings view |

## Stated limitations

| Limitation | Detail |
| --- | --- |
| `cacheWritePricePerMillion` is stored but not scored | It exists in the Zod model schema, the `models` table and the Artificial Analysis mapping, but it has no registry entry, so it cannot be ranked, charted or shown as a table column default. |
| Deltas are not computed for derived metrics | `computeLeaderCards` and `computeRankings` compute a delta only when the metric provenance is `measured`, because a derived value depends on the population, which a historical snapshot does not carry. Derived rows show no delta. |
| Value scores are population-relative | `weightedValue` normalisation depends on the current population, so the same model can score differently when the population changes. The score is not comparable across datasets. |
| Per-dollar scores are scale-dependent | Index points per USD depend on the index scale the source publishes. They are meaningful within a source version, not as an absolute quality measure. |
| Capability indices are source-provided composites | The product does not recompute intelligence, coding or agentic; it ranks what the source publishes, and the registry descriptions say so. |
| Cost-efficiency is not a recommendation | The boards rank a formula, not a preference. A cheap model with a high score is not "better" for a specific workload. |
| No benchmark-level breakdown | `benchmark_definitions` and `model_benchmark_values` exist in SQL but no code reads them, so per-benchmark weights cannot be adjusted in the app. |
