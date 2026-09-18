# World & Politics

A separate editorial workspace for non-AI current affairs. It looks like part of the product and is
logically isolated from it. The isolation is enforced in code and asserted by tests, not left to
editorial care.

## Tabs

Region tabs, ordered by `WORLD_TAB_ORDER` in `src/lib/domain/world.ts`:

Top, Argentina, United States, Latin America, World, Economy, Regulation, Geopolitics, Elections,
Conflict / Diplomacy.

`Top` is not a region: it returns everything, which the repository query implements by ignoring the
region filter when the value is `top`.

## Card anatomy

| Element | Source field |
| --- | --- |
| Headline | `headline`, linked to the original with a screen-reader note |
| Source and tier | `sourceName`, `trustTier` |
| Publication time | `publishedAt` |
| Event time | `eventAt`, shown when it differs from publication |
| Country tags | `countryCodes`, resolved to names |
| Summary | `summary`, neutral and attribution-first, or absent |
| Primary source link | `primarySourceUrl`, when the item cites a document |
| `Developing` badge | `developing` |
| `Multiple accounts` badge | `multipleAccounts` |

## Neutrality guardrails

Implemented in `src/lib/domain/world.ts`. These are code and tests, not guidance.

### Forbidden output patterns

`FORBIDDEN_PATTERNS` declares six rule families, each with an identifier, a regular expression and a
stated reason:

| Rule id | Reason | Matches on |
| --- | --- | --- |
| `endorsement` | Endorsement or voting advice | "we endorse", "our endorsement", "should vote for", "best candidate", "vote for" |
| `prediction` | Electoral prediction | "will win", "is certain to win", "guaranteed to win", "will lose the election" |
| `verdict` | Unattributed verdict | "the truth is", "obviously lying", "clearly the culprit", "proven guilty of", "undeniably" |
| `ideology_score` | Ideological scoring | "ideology score", "partisan score", "left-wing score", "right-wing score", "extremism index" |
| `dehumanizing` | Dehumanizing language | "subhuman", "vermin", "animals who", "infestation of" |
| `ranking_actors` | Ranking political actors | "best president", "worst president", "best party", "worst party", "ranking of politicians" |

`findNeutralityViolations(text)` returns every match with its rule id and reason. `isNeutral(text)`
is the boolean form.

### Enforcement at the adapter boundary

`mapWorldWireItem()` in `src/lib/adapters/world.ts` runs every summary through `isNeutral`:

- a neutral summary is kept as-is;
- a non-neutral summary is **dropped** (set to `null`) while the item itself is kept with its
  attribution, and the drop reason is recorded as
  `"Non-neutral summary dropped; item kept with attribution only."`;
- a missing summary stays missing.

Nothing rewrites a summary into something acceptable. The product either shows what the source
said or shows nothing but the headline and the link.

### Attribution-first summaries

`buildAttributionSummary({ headline, claims, multipleAccounts, developing })` composes a
descriptive summary in which:

- the headline is restated;
- every claim is prefixed with `"<source> reports: <claim>"`;
- if accounts differ, the text states that "Accounts differ; sources are listed individually and
  the app does not adjudicate between them.";
- if the story is developing, it is labelled as such.

There is no synthesis step and no conclusion.

## Political content never feeds model or harness scoring

This is the structural guarantee, and it is asserted by tests in
`tests/unit/world-neutrality.test.ts`:

1. **`assertNoPoliticalMetrics(metricKeys)`** rejects any metric key containing `political`,
   `ideolog` or `partisan`. The test runs it over the real metric catalogue
   (`metricCatalog()`), which lists every key in the metric registry, and asserts the result is
   `ok` with no offending keys. It then injects `political_lean` and asserts it **is** detected,
   so the guard itself is tested.
2. **Ranking independence.** The test builds the real fixture model catalogue, builds model
   contexts and runs `computeRankings` over every board, then asserts that each board's
   `definition.metricKey` is a registered metric and that no key contains `political` or `ideolog`.
3. **Domain identification.** `isPoliticalDomain("world_politics")` is asserted `true` and
   `isPoliticalDomain("ai_general")` is asserted `false`, so the domain marker is meaningful.
4. **Data separation.** World items live in `public.world_news_items`, which is commented in SQL as
   a separate editorial domain that is never read by model or harness scoring code and never used
   for user profiling. There is no code path from that table into scoring: the model and harness
   analytics modules read models, providers and plans only.

The practical consequence: adding a political input to a model ranking would require changing the
metric registry, which the test would fail.

## Fixture dataset

`src/lib/fixtures/world.ts` provides 22 items across all nine regions and multiple categories
(economy, regulation, election, geopolitics, conflict, diplomacy, infrastructure, other). Six are
flagged `multipleAccounts` and six `developing`.

The fixture summaries are deliberately descriptive. The test suite asserts that **every** fixture
summary passes the guardrails, so a fixture that drifted into advocacy would fail the suite.

One fixture states the policy in its own summary: a polling aggregate "lists the individual
published polls and their field dates. The app does not produce forecasts or predictions."

## What this workspace does not do

| Not done | Detail |
| --- | --- |
| Candidate or party recommendations | Never produced, and represented by a forbidden pattern |
| Electoral predictions | Never produced, and represented by a forbidden pattern |
| Ideological sentiment scoring | No sentiment field exists in the schema at all |
| Ranking of political actors | No such ranking feature exists |
| Inferring user political preferences | No profiling exists; watchlists are local and explicit |
| Public opinion synthesis | A polling aggregate is displayed as a range of published estimates, not a projection |
| Adjudicating contested claims | `multipleAccounts` shows the disagreement and the sources instead |
| Cross-domain search | World items are not searchable together with AI news |

## Status and limitations

- Neutrality enforcement is `IMPLEMENTED` and covered by `tests/unit/world-neutrality.test.ts`.
- The pattern scan is regex-based and English-only. It catches the declared categories and will miss
  paraphrases, other languages and subtle framing. It is a floor.
- The world news provider is `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`. The source
  (`world-primary-wire`) is disabled and its registry URL is a placeholder; without
  `WORLD_NEWS_API_KEY` and `WORLD_NEWS_BASE_URL` the adapter returns `not_configured` and the
  workspace renders fixtures.
- Country name resolution is a curated map; an unknown code falls back to the code itself.
- The workspace footer and the Methodology page state that grouping and classification are never
  quality judgements.

## Related

- Decision record: ADR-0006
- Taxonomy: `docs/04-data/news-taxonomy.md`
- Guardrail source: `src/lib/domain/world.ts`, `src/lib/adapters/world.ts`
- Test: `tests/unit/world-neutrality.test.ts`
