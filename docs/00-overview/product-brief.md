# Product brief

Canonical product name: **AI Model Intelligence Hub**

## What it is

An internal-quality intelligence portal for the AI ecosystem. It answers practical
questions quickly and shows the evidence behind every number:

- Which models are strongest, fastest, cheapest or best value?
- What changed in the last day, week or month?
- Which coding-agent subscription is cheapest right now, and what does it include?
- Which coding harness changed its plans, models or limits?
- What important AI-provider news happened?
- What important world or political news happened outside AI?

The product is built as a professional analytical tool: dense, compact, legible and
organised by product domain rather than by generic admin navigation.

## Who it is for

Technical colleagues who need a fast, trustworthy read on the model market, the
coding-agent market and the news around them. The assumed reader is comfortable with
words like tokens, TTFT, Pareto frontier and BYOK, and will check the methodology if
the numbers look surprising.

## The two core worlds

| World | Route root | What it covers |
| --- | --- | --- |
| Models | `/models` | Metrics, rankings, cost efficiency, provider segmentation, comparison, history |
| News & Watch | `/news`, `/harness`, `/world` | AI news, provider feeds, social pulse, research, coding-harness plans, neutral world news |

Models is the primary product.

## What it refuses to be

- Not a marketing landing page. The root route is a compact cross-domain command
  centre, not a hero section.
- Not a generic admin dashboard. There are no CRUD forms for arbitrary records; the
  data is sourced and read-only in the UI.
- Not a clone of Artificial Analysis. The interaction pattern of a selected
  comparison set is borrowed deliberately; branding, CSS, layout and visual identity
  are not.
- Not a black box. There is no mysterious universal score. Every derived number is an
  explicit formula with its inputs visible, and unknown values render as an em dash
  rather than a fabricated zero.
- Not a political product. The World & Politics workspace is descriptive,
  attribution-first and structurally isolated from model and harness scoring.

## Product principles

1. **Never invent a number.** A missing input yields `null` and an em dash.
2. **Always date the value.** Every "current" value carries a capture timestamp and a
   freshness state. Stale prices are not rendered as if they were live.
3. **Snapshot, do not overwrite.** History is what makes deltas and change feeds
   possible, so observed states are stored as snapshots and differences become change
   events.
4. **Show the formula.** Cost efficiency, cheapest options and the budget calculator
   all expose the calculation and the source.
5. **Mock mode is a first-class mode.** The product is fully usable with no
   credentials, and it labels that state visibly instead of pretending to be live.
6. **Grouping is not a judgement.** "Mainstream" and "China-based" are geographic and
   structural classifications. They are never framed as quality.
7. **Say what is not implemented.** Missing capability is documented in the status
   files, not hidden behind a placeholder screen.

## Data provenance summary

| Data | Source | Status |
| --- | --- | --- |
| Model metrics and pricing | Artificial Analysis Data API | Adapter implemented; live verification pending `ARTIFICIAL_ANALYSIS_API_KEY` |
| Provider metadata | In-repo provider registry and fixtures | Implemented |
| AI news | RSS/Atom/official changelog sources in the source registry | Parser implemented and tested; live fetch pending source enablement |
| Coding-harness plans and prices | Official pricing pages via a controlled HTML extractor | Extractor implemented and tested; selectors need live verification |
| Social pulse | X API v2 through the authorized adapter | Adapter implemented; disabled without `X_BEARER_TOKEN` |
| World and political news | Licensed wire provider through a separate adapter group | Adapter implemented; disabled without `WORLD_NEWS_API_KEY` and `WORLD_NEWS_BASE_URL` |
| Derived metrics | Computed in `src/lib/domain/metrics.ts` and `src/lib/analytics/metric-registry.ts` | Implemented and unit-tested |

## Explicit non-goals

- No electoral prediction, candidate ranking or ideological scoring of any kind.
- No scraping of X/Twitter HTML as a data foundation.
- No scraping of Artificial Analysis to bypass API quota.
- No user profiling from political content.
- No mirroring of full articles; excerpts and links only.
