# ADR-0011: One documented exception to API-first, for the vendor's own published dataset

- Status: Accepted
- Date: 2026-09-23
- Deciders: project owner, implementation agent

## Context

ADR-0003 states that the Artificial Analysis integration is API-first and is never scraped, and
`AGENTS.md` carries the same rule as a hard constraint: never scrape a source that publishes an
API. The rule exists so the product never bypasses a vendor's quota, and so a metric is never read
from markup that the vendor did not intend as data.

The product needed two figures for its chart set: the cost per Intelligence Index task, and the
number of tokens consumed per task. After reading the vendor's current documentation and calling
the live endpoints, the situation turned out to be more specific than "the API does not have it":

- **Cost per task is on the free API tier.** `/api/v2/language/models/free` returns
  `artificial_analysis_intelligence_index_cost.cost_per_task.total_cost`. It was missing only
  because this repository was calling `/data/llms/models`, an undocumented legacy path that
  returns no cost object, no agentic index and no cache prices. That is a bug, fixed in the
  adapter rather than worked around.
- **The per-task token split is not.** `artificial_analysis_intelligence_index_token_counts` is a
  Pro-tier field. On the free tier it does not exist in any endpoint.
- **The vendor publishes the token split to the open web anyway**, as Schema.org `Dataset` blocks
  in `<script type="application/ld+json">` on its model comparison page, carrying their own
  `citation`, `license` and `isAccessibleForFree`. That is structured, self-describing data the
  vendor emits for machine consumption — not markup being mined for meaning.

The owner, told plainly that this would contradict ADR-0003, chose to take the token split from
that dataset.

## Decision

The project reads the Artificial Analysis web dataset for **exactly one figure: the per-task token
split**, under conditions that keep the exception narrow and auditable.

1. **The API remains the source of record.** Every other value about a model comes from the API.
   The web dataset contributes two columns, and the enrichment can never overwrite a figure the
   API published: the merge only fills gaps.
2. **The extraction target is the vendor's published dataset, not its markup.** The adapter parses
   `application/ld+json` blocks and selects the one named
   `Output Tokens per Intelligence Index Task`. It does not walk the DOM, and it does not follow
   links to model pages.
3. **The block is required and its absence is fatal.** If the dataset disappears or is renamed, the
   adapter fails loudly and writes nothing, so a vendor change surfaces as a failed run in
   `/sources` instead of a silently blank metric.
4. **It is a named, first-class source** (`artificial-analysis-web`) in the registry, with its own
   attribution, licensing note and a daily cadence, so it is visible and can be switched off
   without a deploy.
5. **Attribution is displayed**, as the vendor's terms require across all tiers, and the coverage
   limitation is stated in the interface rather than hidden: each dataset block carries only the
   models the page is displaying (a few dozen), so the token-per-task chart covers fewer models
   than the others.

## Consequences

Positive:

- The one figure the free tier cannot provide becomes available without buying a Pro tier.
- The extraction target is a documented structured format that states its own license, which is
  materially safer and more stable than scraping rendered HTML.
- The exception is visible in the source registry, bounded to two columns, and reversible.

Negative:

- **This contradicts ADR-0003 as written.** A reader who takes that ADR at face value will find the
  code doing something it forbids. This record is the amendment; ADR-0003's prohibition now holds
  "except as recorded in ADR-0011".
- It reads a commercial page rather than an API, so it is exposed to a change in the vendor's terms
  of use that this project cannot control. The owner accepted that risk knowingly.
- Coverage is a few dozen models, not the catalogue, and the chart says so.
- One more integration boundary to maintain: the dataset block name is a vendor-declared string
  that can be renamed, and when it is, ingestion fails until `AA_WEB_CONFIG.configVersion` is
  bumped.

## Alternatives considered

1. **Derive the token split from a stated token profile.** Rejected by the owner: the vendor
   publishes the real numbers, so estimating them would be a downgrade in fidelity for no gain in
   legality.
2. **Buy the Pro tier.** Not rejected on merit — it is the cleanest path and the adapter is
   written so that a Pro key would make this source unnecessary. It was declined on cost.
3. **Leave the token chart empty in live mode.** Rejected: three of the four requested charts would
   have worked and the fourth would have looked broken.
4. **Scrape the rendered HTML instead of the JSON-LD.** Rejected: it is strictly worse. Markup
   churns, the JSON-LD blocks do not carry a license when taken as markup, and the structured
   blocks already contain the same numbers keyed by model.

## Related

- Files: `src/lib/adapters/artificial-analysis-web.ts`, `src/lib/ingestion/runner.ts`,
  `src/lib/fixtures/sources.ts`,
  `supabase/migrations/20260923000200_seed_aa_web_dataset_source.sql`
- Tests: `tests/integration/adapters-contract.test.ts` ("Artificial Analysis web dataset adapter")
- Amends: ADR-0003 (API-first) — the prohibition now holds except where this record permits
