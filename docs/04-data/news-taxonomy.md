# News taxonomy

Definitions come from `src/lib/domain/schema.ts` and are enforced as checked constraints in
`public.news_items` and `public.world_news_items`.

## News domains

`news_domain` has six values. They drive the tab structure of the News workspace and the
separation between editorial worlds.

| Domain | UI label | Contents |
| --- | --- | --- |
| `ai_general` | AI General | Launches, research, funding and acquisitions, AI-relevant regulation, infrastructure and chips, major product changes |
| `provider` | Model Providers | Provider-specific news (OpenAI, Anthropic, Google, xAI, Meta, Mistral, DeepSeek, Qwen and others) |
| `social` | Social Pulse | Posts from monitored accounts, gathered only through authorized APIs |
| `research` | Research & Benchmarks | Benchmark releases, evaluation changes, methodology notes, notable papers, the Hugging Face technical ecosystem |
| `harness` | Harness | Coding-harness pricing, plan, model-list and CLI release events |
| `world_politics` | World & Politics | Neutral world and political news, in a separate table with its own adapter |

`NEWS_DOMAIN_LABELS` in the schema module maps values to labels so the UI and the filter both
read the same strings.

## News categories

`news_category` has sixteen values, shared by news items and world items:

`model_release`, `pricing`, `benchmark`, `research`, `developer`, `product`, `infrastructure`,
`funding`, `acquisition`, `regulation`, `election`, `geopolitics`, `economy`, `conflict`,
`diplomacy`, `other`.

The fixture dataset exercises the full vocabulary. Live ingestion does not: the runner sets
the category from the source domain only (`research` for research sources, `other` otherwise),
because no content classifier is implemented. See KI-5.

## Trust tiers

| Tier | Meaning | Examples in the registry |
| --- | --- | --- |
| 1 | Official or primary source | Official provider pages, docs, changelogs; government and primary documents |
| 2 | Established reporting, reputable technical publications, Artificial Analysis, Hugging Face | Research and analysis sources |
| 3 | Social posts, community discussion, uncorroborated discovery signals | Social pulse items |

The SQL column comment states the rule: "1 = official/primary, 2 = established reporting,
3 = social or uncorroborated. **Never a viewpoint.**"

Trust tier is provenance quality. It is not a political axis, and it is not a measure of
accuracy. Live ingestion currently derives the tier from source priority: priority 1 sources
become tier 1 with `official: true`, everything else becomes tier 2. Tier 3 arrives from
social fixtures. This is a coarse rule; see KI-5.

## News item fields

| Field | Notes |
| --- | --- |
| `title` | Required |
| `url` | The original link |
| `canonicalUrl` | Tracking parameters, fragment, `www.` and trailing slash removed; host lowercased; remaining parameters sorted |
| `sourceId`, `sourceName` | Provenance displayed on the card |
| `trustTier` | 1, 2 or 3 |
| `publishedAt`, `discoveredAt` | Publication time and observation time, kept separate |
| `excerpt` | Short permitted excerpt only. Full articles are never mirrored. |
| `summary` | Optional structured summary. Always `null` from ingestion today because no summariser is implemented. |
| `entities` | Entity strings. Fixtures populate this; live ingestion leaves it empty. |
| `providerIds` | Provider references (`provider:<slug>`). Fixtures populate this; live ingestion leaves it empty. |
| `official` | Set for tier-1 sources |
| `corroborated` | Set when an official source confirmed the same claim |
| `developing` | Set when facts may change |
| `contentHash` | 16-character dedupe hash |
| `clusterId` | Anchor item id when this item is a secondary report of the same event |

## Deduplication

Two mechanisms, both deterministic:

1. **Canonical URL identity.** `canonicalizeUrl()` strips `utm_*`, `fbclid`, `gclid`, `msclkid`,
   `mc_cid`, `ref`, `source`, `spm`, `trk` and other tracking parameters, removes the fragment,
   lowercases the host, removes a leading `www.`, and sorts the surviving query parameters. The
   result is stored as `canonical_url`, and the unique index `(source_id, canonical_url)`
   enforces one row per canonical URL per source.
2. **Content hash.** `newsContentHash({ canonicalUrl, title, publishedAt })` hashes the
   canonical URL, the normalized title (lowercased, accents stripped, punctuation replaced by
   spaces, whitespace collapsed) and the publication day. It falls back to the canonical URL
   alone when no title or date is available, which still dedupes exact-URL repeats.

## Clustering

`clusterNewsItems(items, { similarityThreshold, windowHours })`:

- Items are sorted by trust tier ascending, then by publication time ascending, so the primary
  source is considered first.
- Two items cluster when their normalized-title token sets have a Jaccard similarity at or
  above the threshold **and** their publication times are within the window.
- The anchor is the first item that started the cluster, which is the highest-trust, earliest
  item.
- The anchor points at itself; members receive the anchor id.
- Defaults used by the app: `similarityThreshold: 0.62`, `windowHours: 48`
  (`clusterForDisplay` in `src/lib/data/workspace.ts`, and `clusterFixtureNews` in the fixture
  bundle).

Consequence worth stating: a low-tier item can anchor a cluster only if no higher-trust item
matches it first. The fixture set demonstrates a secondary report and an analysis piece both
attaching to an official launch item.

## World news specifics

World items add fields that news items do not have:

| Field | Notes |
| --- | --- |
| `region` | One of `argentina`, `united_states`, `latin_america`, `world`, `economy`, `regulation`, `geopolitics`, `elections`, `conflict_diplomacy` |
| `headline` | Replaces `title` |
| `primarySourceUrl` | Optional link to the primary document |
| `eventAt` | When the event happened, when different from publication |
| `countryCodes` | ISO alpha-2 codes |
| `multipleAccounts` | `true` when sources disagree; the UI shows the sources and does not adjudicate |
| `developing` | `true` when facts may change |

The neutrality gate runs on the summary: a summary that matches any forbidden pattern is
dropped and the drop reason is recorded, while the item itself is kept with its attribution.
See `docs/07-product/world-politics.md` and ADR-0006.

## Social items

`social_post` fields: `accountId`, `handle`, `displayName`, `platform` (`x`, `linkedin`,
`youtube`, `blog`, `reddit`), `postId`, `url`, `text` (capped at 600 characters), `publishedAt`,
`metrics` (likes, reposts, replies, each nullable), `entities`, `corroborated`.

Monitored accounts carry a category: `model_provider`, `executive_researcher`, `benchmark_org`,
`coding_harness`, `coding_harness_founder`, `other`.

Policy, stated in the adapter and in the SQL table comment: posts are populated exclusively
from authorized APIs, and X HTML is never scraped as the foundation. Without `X_BEARER_TOKEN`
the adapter issues zero requests and returns `not_configured`; the test suite asserts that no
request is made.

The fixture registry monitors twelve accounts (seven model providers, one benchmark
organisation and four coding harnesses). In live mode nothing seeds
`monitored_social_accounts`, so the adapter receives an empty account list. See KI-7.

## Field provenance in the UI

| Element | Source |
| --- | --- |
| Source name and tier badge | `sourceName`, `trustTier` |
| Official badge | `official` |
| Developing badge | `developing` |
| Multiple accounts badge | world items only, `multipleAccounts` |
| Corroborated indicator | `corroborated` |
| Time | `publishedAt`, or `eventAt` when it differs on world cards |
| Link | `url`, opening the original in a new tab with a screen-reader note |
