# ADR-0009: Free, key-less community and news sources; X out of scope

- Status: Accepted
- Date: 2026-09-18
- Deciders: project owner, implementation agent

## Context

The product's second half was community and news signal. The original specification expected the
**X API v2** for Social Pulse. X's API is now pay-per-usage (`$0.005` per post read, `$0.010` per
user read, 24-hour dedup) and its HTML may not be scraped. ADR-0003 and a contract test forbid
scraping a source that publishes an API, and X's Terms of Service prohibit automated access
outside the API. Paying for X was judged not worth it for this project.

At the same time the model half lacked breadth and two signals Artificial Analysis does not
publish: an independent context window and open-weight popularity. Several free, key-less APIs
cover that gap: OpenRouter's public models catalogue, the Hugging Face Hub API, GDELT for news,
and the public Bluesky AppView and Hacker News Algolia API for community signal.

Adding more model sources raises one architectural question: several sources now write the same
`models` table and each knows only part of a model.

## Decision

- **X is out of scope.** The X adapter, its source row, its account seed and `X_BEARER_TOKEN` are
  removed. Nothing scrapes X or any other source that publishes an API.
- **Community Pulse** is served by the **public, key-less** Bluesky AppView (`getAuthorFeed` per
  monitored handle) and the **Hacker News** Algolia API. A post stores a short excerpt and a link;
  a Hacker News story maps points → likes, comments → replies, reposts → null.
- **News and World** are served by **GDELT DOC 2.0** (free, key-less), producing `news_items`
  (domain `ai_general`) or `world_news_items` (region `world`) by source domain. The licensed
  `world-primary-wire` row stays as a disabled alternative.
- **Model garden breadth and popularity**: **OpenRouter** (`/api/v1/models`) adds catalogue
  breadth and the context window; the **Hugging Face Hub** adds popularity only.
- **Field-level source precedence** governs every model write (`merge-models.ts`): Artificial
  Analysis wins capability, performance and first-party price; context window is filled by whoever
  supplies it; popularity (`hfDownloads`, `hfLikes`) comes from Hugging Face only. **A source never
  overwrites a non-null value with null**, so a second source can enrich a model but never blank
  it. Hugging Face only enriches a model already catalogued; an unmatched Hub model is skipped,
  never inserted. OpenRouter's routed price is **not** written over a first-party price.
- The **curated provider registry** is seeded (migration 0012) and the merge preserves its group,
  region and colour, so `sync-models`' deliberate `group: "other"` no longer clobbers curation.

## Consequences

Positive:

- No paid API, no scraping, and every new source needs no credential.
- The model garden gains breadth, an independent context window and a popularity signal that feed
  new "most-downloaded"/"most-liked" boards — the "top 10 most efficient" ranking the product is
  built around is unaffected and stays Artificial Analysis-backed.
- KI-19 (live providers all `group: "other"`) is resolved by the curated seed plus the merge.

Negative:

- **Popularity is not capability.** Hugging Face downloads and likes measure attention on one
  platform; they are labelled as popularity everywhere and must never be read as quality.
- **Bluesky and Hacker News coverage is thinner and different from X.** Some labs post less on
  Bluesky; Hacker News is discussion, not official announcements.
- **Matching Hugging Face models to the catalogue is fuzzy.** It is by normalised slug; a mismatch
  means a model silently gets no popularity, counted as `skipped` rather than guessed.
- **OpenRouter's routed price is not first-party** and is therefore not surfaced as a price in this
  phase; only its context window and breadth are used, so its catalogue entries can carry prices
  with no capability index.
- **GDELT queries are keyword-based**, so the news and world feeds are broad and depend on a query
  string per source rather than a curated publisher list. Country codes are not inferred.

## Alternatives considered

1. **Pay for the X API.** Rejected by the owner: cost without proportional value, and it would keep
   a paid dependency for a signal now available free elsewhere.
2. **Scrape X HTML.** Rejected: forbidden by ADR-0003 and by X's ToS, brittle, and it would break
   the product's promise never to present dubious data as real.
3. **Keep the interface fixture-only (no live community source).** Rejected: the product advertises
   a live path; a free, legal source exists.
4. **Merge OpenRouter/Hugging Face data blindly into `models`.** Rejected: without field
   precedence, a later source with null capability would blank Artificial Analysis values, and
   duplicate catalogue entries would appear.
5. **Add a separate popularity table and UI.** Rejected for now: more surface (schema, repository,
   new screens) than reusing the existing metric registry and ranking boards.

## Related

- Files: `src/lib/adapters/{bluesky,hackernews,gdelt,openrouter,huggingface,entities,model-identity}.ts`,
  `src/lib/ingestion/merge-models.ts`, `src/lib/ingestion/runner.ts`,
  `src/lib/analytics/metric-registry.ts`, `supabase/migrations/20260918000900..20260918001500*.sql`
- Tests: `tests/unit/{model-garden,gdelt}.test.ts`,
  `tests/integration/adapters-contract.test.ts`
- Supersedes: none (narrows ADR-0003's scope to Artificial Analysis and generalises "never scrape a
  source that publishes an API" to the community and news sources)
