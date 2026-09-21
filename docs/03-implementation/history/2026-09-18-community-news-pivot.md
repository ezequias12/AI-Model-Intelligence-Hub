# 2026-09-18 - Community/news pivot: free sources, no X

Phase record for the pivot recorded in ADR-0009. X was dropped, the community and news signal
moved to free, key-less APIs, and the model garden gained two sources.

## What changed

**X removed**

`src/lib/adapters/social.ts` deleted; the `x-monitored-accounts` source, its account seed and
`X_BEARER_TOKEN` removed from the registry, `.env.example` and `.env.local`. The `social_api`
source type survives only in the SQL CHECK constraint so historical rows remain valid.

**Community Pulse (Free, key-less)**

- `src/lib/adapters/bluesky.ts`: public AppView `getAuthorFeed` per monitored handle; maps uri to
  a `bsky.app` link; issues no request when no account is monitored.
- `src/lib/adapters/hackernews.ts`: Algolia `search_by_date`; points → likes, comments → replies,
  reposts always null.
- `src/lib/adapters/entities.ts`: the entity extractor moved out of the deleted X adapter.
- Fixtures and seeds rewritten to Bluesky accounts plus a synthetic Hacker News account.

**News + World (Free, key-less)**

- `src/lib/adapters/gdelt.ts`: GDELT DOC 2.0, producing `news_items` (ai_news) or
  `world_news_items` (world_politics) by source domain. The licensed `world-primary-wire` row stays
  disabled as an alternative.

**Model garden**

- `src/lib/adapters/openrouter.ts`: `/api/v1/models` for catalogue breadth and the context window.
  Routed price is deliberately not written.
- `src/lib/adapters/huggingface.ts`: Hub popularity (`hfDownloads`, `hfLikes`), enriching matched
  models only.
- `src/lib/adapters/model-identity.ts` and `src/lib/ingestion/merge-models.ts`: slug normalisation
  and field-level source precedence, so a source never overwrites a non-null value with null.
- Two new metrics with a `popularity` group in the registry, two ranking boards
  ("Most-downloaded open models", "Most-liked open models") and a Popularity section on the model
  detail page (hidden when empty).

**KI-19 resolved**

`20260918001200_seed_provider_registry.sql` seeds curated providers; `mergeProviders` preserves an
existing group, region and colour.

**Migrations 0009–0015**

Widen `sources.type` and the social platform checks, add the popularity columns, seed the
model-garden sources, the provider registry, the community sources and accounts, and the GDELT
sources.

## Why

X's API is pay-per-usage and its HTML may not be scraped, so the original Social Pulse plan was
not viable without cost. Free, key-less APIs cover the same ground legally, and the model half
needed breadth and the two signals Artificial Analysis does not publish.

## Verified

- `npm run check` exits 0: format, lint, typecheck, **267 unit and integration tests**, 26-route
  build.
- `npm run test:e2e` passes **205 tests**, skips 5, across both viewports including the 28 axe cases.

## Not done

- No live call was made to Bluesky, Hacker News, GDELT, OpenRouter or Hugging Face from this
  repository; the adapters are covered by contract tests with stubs only.
- Migrations 0009–0015 have not been applied to a Supabase project from here.
- The GDELT queries are first-guess keywords and want tuning.

## Unresolved items

- Popularity is one platform's attention, not quality; it must stay labelled as such.
- The Hugging Face slug match is fuzzy, so a model may silently receive no popularity.
- OpenRouter contributes no capability index and its routed price is unused.
