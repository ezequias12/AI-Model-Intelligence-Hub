# News workspace

Routes under `/news`. News is deliberately not one undifferentiated feed: each domain has its own
tab, and the World & Politics feed is a separate workspace entirely
(`docs/07-product/world-politics.md`).

## Tabs

| Route | Tab | Contents |
| --- | --- | --- |
| `/news` | Overview | High-signal cross-category summary with search |
| `/news/ai` | AI General | Launches, research, funding and acquisitions, AI-relevant regulation, infrastructure, product changes |
| `/news/providers` | Providers | Provider-specific feeds |
| `/news/social` | Social Pulse | Monitored accounts, through authorized APIs only |
| `/news/research` | Research | Benchmarks, methodology, evaluation changes, notable papers |

## Overview

The overview leads with high-signal items rather than burying them in a chronological list. It
composes the domains so a reader gets one screen of what matters, with the ability to search
across everything.

## Search and saved searches

`src/features/news/news-search.tsx` provides a search field over title, excerpt, source name and
entities, with saved searches persisted locally. `NewsQuery` in `src/lib/data/repository.ts`
defines the filter shape: `domain`, `category`, `providerId`, `sourceId`, `search`, `limit`.

Live-ingested items are less filterable than fixtures: provider ids and entities are empty, and
the category is `other` unless the source is research. See KI-4 and KI-5.

## Card anatomy

| Element | Source field |
| --- | --- |
| Source name and trust tier | `sourceName`, `trustTier` |
| Official badge | `official` (tier-1 sources) |
| Developing badge | `developing` |
| Time | `publishedAt`, formatted relatively |
| Headline | `title`, linked to the original with a screen-reader note about the new tab |
| Summary | `summary` when present; otherwise the permitted excerpt |
| Entities and providers | `entities`, `providerIds` |
| Category | `category` |

The product stores a short permitted excerpt (capped at 320 characters in the feed parser) and a
link. Full articles are never mirrored. That constraint is recorded in the SQL column comment for
`news_items.excerpt`.

## Cross-source clustering

Secondary reports of the same event attach to a primary-source anchor rather than appearing as
independent stories. `clusterNewsItems` uses normalized-title token Jaccard similarity within a
48-hour window (threshold 0.62), and the anchor is the highest-trust item, tie-broken by earliest
publication. A cluster shows the anchor with its members.

Dedupe runs before clustering: canonical URL identity plus a content hash over the canonical URL,
the normalized title and the publication day.

## Social Pulse

A dense timeline of monitored accounts. Each row shows the account and platform, the time, a short
post excerpt (capped at 600 characters), detected entities, a corroboration status and a link to
the original.

Policy, stated in the adapter and the table comment: social content is populated exclusively from
authorized APIs, and X HTML is never scraped as the foundation. Without `X_BEARER_TOKEN` the
adapter returns `not_configured` and issues **zero** requests; the test suite asserts that no
request is made.

Monitored accounts are categorised (`model_provider`, `executive_researcher`, `benchmark_org`,
`coding_harness`, `coding_harness_founder`, `other`). The fixture registry monitors twelve
accounts. In live mode, nothing seeds the account table, so the adapter receives an empty list
(KI-7).

Entity extraction is intentionally conservative: only `@handle`, `#tag` and exact matches of a
known entity list are extracted, so a mention of a model name is captured exactly rather than
fuzzily.

## Research

Covers benchmark releases, methodology changes, evaluation changes, notable papers and the
Hugging Face technical ecosystem. Artificial Analysis methodology posts are registered as a
research source with a 12-hour cadence because the content changes slowly.

## Trust tiers in the news UI

| Tier | Meaning | Presentation |
| --- | --- | --- |
| 1 | Official or primary source | Tier badge, plus an "Official" badge when the source is flagged official |
| 2 | Established reporting, technical publications, Artificial Analysis, Hugging Face | Tier badge |
| 3 | Social posts, community discussion, uncorroborated discovery | Tier badge, and the `corroborated` status is shown explicitly |

Trust tier describes provenance and is never a political viewpoint. The SQL comment states this.

## Empty and degraded states

| State | Behaviour |
| --- | --- |
| Mock mode | Fixture news renders; the shell banner states the values are fixtures |
| Live mode without Supabase | Degraded banner with the reason; fixtures render |
| Social credentials missing | The source is disabled; the adapter is not called |
| No items for a filter | An explicit empty state, not a blank region |
| Summary missing | The excerpt is shown; nothing is generated |

## Not implemented

| Item | Detail |
| --- | --- |
| LLM summaries | No summariser client exists, so `summary` is always `null` from ingestion |
| Content-based categories | Live items are `other` or `research` only |
| Provider links and entities for live items | Empty arrays from the feed path |
| `html` news sources | No adapter, so `anthropic-news` never produces items |
| Server-side entity persistence | `news_entities` exists in SQL but nothing writes to it |
| Cross-domain search with World & Politics | Separate tables, no union query |
| Notification of new items | No digest, webhook or alert channel |

## Related

- Taxonomy: `docs/04-data/news-taxonomy.md`
- Source registry: `docs/04-data/source-catalog.md`
- Concentration of the political domain: `docs/07-product/world-politics.md`, ADR-0006
- Known issues: KI-4, KI-5, KI-6, KI-7
