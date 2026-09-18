# Models workspace

The primary product. Routes under `/models`, with a selected-model tray that stays visible across
the workspace sub-routes.

## Sub-navigation

| Route | Purpose |
| --- | --- |
| `/models` | Dashboard: metric leaders and a fast read on the market |
| `/models/rankings` | All Top 10 boards in one grid |
| `/models/landscape` | Large configurable scatter charts with a Pareto frontier |
| `/models/table` | Dense research table with sorting, filtering, column selection, pinning and CSV export |
| `/models/releases` | Chronological releases, deprecations and metric change events |
| `/models/[slug]` | Per-model detail with snapshot history and related signal |

## Selected-model tray

Rendered once by `ModelsShell` (`src/features/models/models-shell.tsx`) so it persists across
sub-routes with a single source of selection state.

| Behaviour | Detail |
| --- | --- |
| Chips per model | Provider colour marker, short name, remove control |
| Add models | A searchable selector with provider grouping, recent models and a selected count |
| Presets | Frontier, Best Value, Fast, Coding, Agentic, Open / Open-weight, Mainstream Providers, China-based Labs, Custom |
| Reset | Restore the resolved default comparison set |
| Labelling | "Default comparison set" when untouched; "Custom comparison set" after a manual change |
| Persistence | `?models=` query parameter plus local storage (`amih.models.selection.v1`, `amih.models.selectionSource.v1`) |
| Bound | 8 models maximum |

## Default comparison set

Resolved, not hard-coded. `resolveDefaultSelection()` in `src/lib/domain/selection.ts` reads
`DEFAULT_SLOTS`:

| Slot | Provider slugs | Metric | Constraint |
| --- | --- | --- | --- |
| OpenAI flagship | `openai` | intelligence | - |
| Anthropic flagship | `anthropic` | intelligence | - |
| Google flagship | `google`, `google-deepmind` | intelligence | - |
| xAI flagship | `xai` | intelligence | - |
| DeepSeek flagship | `deepseek` | intelligence | - |
| Alibaba/Qwen flagship | `alibaba`, `qwen` | intelligence | - |
| Moonshot/Kimi flagship | `moonshot`, `moonshot-ai`, `kimi` | intelligence | - |
| Best-value open model | any | intelligence | open weights only, cheapest above the population median intelligence |

Deprecated models are excluded. A slot with no eligible model is skipped rather than filled with
a substitute. If nothing resolves at all, the caller's `fallbackIds` are used, which is the mock
mode guarantee. The result is deterministic for a given input, which keeps fixtures and any
future E2E suite stable.

## Provider segmentation

A segmented control offers `All | Mainstream | China-based | Open-weight | Closed | Custom`.

- "Mainstream" maps to `provider_group = mainstream_global`; "China-based" maps to
  `china_based`. Both are geographic/structural classifications and are presented as such. The
  workspace footer and the Methodology page state it explicitly.
- "Open-weight" and "Closed" filter on the model's `openWeight` flag, because openness is a model
  property.
- "Custom" accepts an explicit provider id list; an empty list falls back to all models.

## Metric leaders

Eight cards in a strip, each answering one question: highest intelligence, best coding, best
agentic, fastest output, lowest input price, lowest output price, best weighted value, and the
newest relevant model (the most recent release that is not deprecated).

A card shows the metric name, provider, model, the value, a delta when a previous snapshot
exists, and the source freshness. Deltas are computed only for measured metrics
(`percentChange(previous, current)`); derived metrics show no delta, because a derived value
depends on the population that a historical snapshot does not carry.

## Ranking boards

Eleven boards, each limited to ten rows, each with a selected/all scope toggle, a provider-group
filter and a methodology note:

| Board | Metric | Direction |
| --- | --- | --- |
| Top 10 Intelligence | `intelligence` | higher |
| Top 10 Coding | `coding` | higher |
| Top 10 Agentic | `agentic` | higher |
| Top 10 Speed | `outputSpeedTps` | higher |
| Top 10 Lowest Input Price | `inputPricePerMillion` | lower |
| Top 10 Lowest Output Price | `outputPricePerMillion` | lower |
| Top 10 Lowest Blended Price | `blendedPrice` | lower |
| Top 10 Cost Efficient - Intelligence | `intelligencePerDollar` | higher |
| Top 10 Cost Efficient - Coding | `codingPerDollar` | higher |
| Top 10 Cost Efficient - Agentic | `agenticPerDollar` | higher |
| Top 10 Cost Efficient - Weighted | `weightedValue` | higher |

Each result reports `excludedBelowThreshold`, `excludedNoData` and `populationSize`, so a board
can state what it removed. The minimum capability threshold exists so cheap-but-weak models do
not silently dominate cost-efficiency boards; raw metrics sit next to the derived score.

Cost-efficiency boards are visually emphasised but not sensationalised: they are labelled with
the mode they use, and the formula lives in `docs/04-data/scoring-methodology.md`.

## Landscape charts

Chart cards with a toolbar for X metric, Y metric, optional bubble metric, selected/all scope,
provider group, Pareto frontier, labels and a larger view.

| Default chart | Axes |
| --- | --- |
| Intelligence vs blended price | x `blendedPrice` (lower better), y `intelligence` |
| Coding vs blended price | x `blendedPrice`, y `coding` |
| Speed vs intelligence | x `outputSpeedTps`, y `intelligence` |
| Output price vs intelligence | x `outputPricePerMillion`, y `intelligence` |

Points carry the provider colour and name. Points missing either axis are dropped. The frontier
rule is described in the chart so a reader can see why a model is on the frontier. Charts expose a
caption and a companion table for accessibility.

## Table

Default columns: intelligence, coding, agentic, input price, output price, cache read price,
output speed, TTFT, context window, plus identity columns (model, provider, release date,
open-weight indicator, last refreshed).

Features: sorting, filtering, column show/hide, selected-only mode, pinning, quick add/remove,
CSV export and local persistence of column and sort state. Export writes
`ai-model-intelligence-hub-models.csv` from the browser.

## Model detail

Sections: identity (provider, release, deprecation state), headline metrics, pricing, latency and
speed, snapshot deltas, historical snapshots with a trend chart, change events, related models and
related news. Source metadata (source id, version, last refresh) is shown so a value can be
traced.

## Releases

A chronological view combining three row kinds: `release` (from `releaseDate`), `deprecation`
(from `deprecatedAt`) and `change` (from `change_events` for the `model` entity), sorted newest
first and tagged with significance.

## Signals that carry limitations

| Element | Limitation |
| --- | --- |
| Deltas on derived metrics | Not computed; shown as absent |
| Capability threshold | A model with `null` intelligence is not excluded by the gate (KI-2) |
| Charts | No decimation; all usable points render |
| Snapshots | Fixture history is synthetic; live history depends on polling frequency |
| CSV export | Client-side only, bounded by the serialised dataset |

## Not implemented

| Item | Detail |
| --- | --- |
| Live model metrics | The Artificial Analysis adapter is `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`; without `ARTIFICIAL_ANALYSIS_API_KEY` the workspace renders the fixture catalogue |
| Deltas for derived metrics | Not computed; the rows show no delta |
| Benchmark-level breakdown | `benchmark_definitions` and `model_benchmark_values` exist in SQL but no code reads them |
| Server-side export | CSV is generated in the browser only |
| Saved comparison sets beyond a URL | Selection persists per browser, not per account, because there is no authentication |
| Alerts on releases or price changes | No notification channel exists |

## Verification status

Model metrics come from the Artificial Analysis adapter, which is
`IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`. Without
`ARTIFICIAL_ANALYSIS_API_KEY` the workspace renders the fixture catalogue and the mode banner says
so.
