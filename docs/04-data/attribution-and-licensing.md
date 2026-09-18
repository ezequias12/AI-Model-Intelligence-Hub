# Attribution and licensing

Attribution obligations attached to the data this product consumes, and the licensing state
of the repository itself. Nothing here is legal advice; it records what the code enforces and
what the owner must decide.

## Repository license

`LICENSE` contains a placeholder: the license is undecided and must be set by the repository
owner before publication. Until then the contents are all rights reserved by default. A
three-file change is required: replace `LICENSE`, add a `"license"` field to `package.json`,
and keep the note in `README.md` consistent.

## Source-level obligations

The registry stores two attribution fields per source: `attribution` (who must be credited)
and `licensingNote` (the constraint). Both are declared in
`src/lib/fixtures/sources.ts` and seeded into `public.sources` by
`supabase/migrations/20260918000600_seed_source_registry.sql`.

| Source | Attribution | Licensing note |
| --- | --- | --- |
| `artificial-analysis-api` | Artificial Analysis | Attribution required. Respect quota; never scrape to bypass limits. |
| `internal:provider-registry` | - | (no note) |
| `command-code-pricing` | Command Code | Public pricing page. |
| `command-code-go` | Command Code | Public documentation. |
| `opencode-go` | OpenCode | Public documentation. |
| `kilo-pricing` | Kilo Code | Public pricing page. |
| `claude-pricing` | Anthropic | Public pricing page. |
| `freebuff` | Freebuff | Public site. Ad-supported offering; allowance may change without notice. |
| `cursor-pricing` | Cursor | Public pricing page. |
| `windsurf-pricing` | Windsurf | Public pricing page. |
| `gemini-cli-releases` | Google | GitHub releases feed. |
| `openai-release-notes` | OpenAI | Public release notes. |
| `anthropic-news` | Anthropic | Public news index; store headline and link only. |
| `google-blog-ai` | Google | RSS feed. |
| `openai-blog-rss` | OpenAI | RSS feed; store excerpt only. |
| `huggingface-blog` | Hugging Face | RSS feed. |
| `arxiv-cs-ai` | arXiv | arXiv terms apply; metadata and link only. High volume, dedupe and cap items per run. |
| `artificial-analysis-posts` | Artificial Analysis | Attribution required. |
| `x-monitored-accounts` | X | Requires authorized API access. Never scrape X HTML as the foundation. |
| `world-primary-wire` | Wire service | Requires a licensed provider. Headline, link and neutral summary only. |

## What the code enforces

| Rule | Enforcement |
| --- | --- |
| Attribution for model metrics | `sourceId` and `sourceName` are stored on every model row; the registry carries the attribution string; the Models header is designed to show Artificial Analysis attribution |
| No scraping to bypass an API quota | Only the API path exists in `src/lib/adapters/artificial-analysis.ts`; there is no HTML path for that source |
| Excerpt only, never a full article | `feedToNewsItems` stores a summary field capped at 320 characters and a link; the SQL column is commented "Short permitted excerpt only. Full articles are never mirrored." |
| Headline and link only for HTML news indexes | Registry note on `anthropic-news` |
| Metadata and link only for arXiv | Registry note on `arxiv-cs-ai` |
| Authorized API only for social | `fetchSocialPosts` issues zero requests without a bearer token, and the test suite asserts no request is made when it is unconfigured |
| Licensed provider only for world news | `fetchWorldNews` returns `not_configured` without both `WORLD_NEWS_API_KEY` and `WORLD_NEWS_BASE_URL`; the source stays disabled |

## What the code does not enforce

- There is no attribution footer or "source" line rendered for every model metric in the UI.
  Attribution is stored and surfaced in the Sources and Methodology views and in the source
  metadata on model detail, but there is no global credit banner.
- There is no per-source rate-limit ceiling beyond the shared `HttpClient` request cap and the
  quota guard. A source's documented limits are not modelled individually.
- There is no robots.txt check, no crawl delay and no user-agent per source; all outbound
  requests use the shared agent string `AI-Model-Intelligence-Hub/0.1 (...)`.
- There is no automated check that a stored plan price still matches its source page.
- The `world-primary-wire` URL in the registry is a placeholder
  (`https://example.com/world-wire-api`) and must be replaced by a licensed provider.

## Third-party redistribution considerations

Points the owner should resolve before publishing data beyond an internal audience:

1. **Artificial Analysis data.** The API terms and the required attribution govern whether
   derived values (blended price, value scores, rankings) may be redistributed and how the
   source must be credited. Check the current terms.
2. **Harness pricing pages.** Prices are public and factual, but republishing an extracted
   table at scale may be governed by each vendor's terms. The registry records a licensing
   note per source; keep it accurate.
3. **News headlines and excerpts.** The product stores a short excerpt and a link. If the
   excerpt length or storage policy needs to change, it is a single constant
   (`summarize(raw, maxLength = 320)` in `src/lib/adapters/rss.ts`).
4. **Social content.** Post text is capped at 600 characters and stored with a link. Platform
   terms govern retention and display; treat the current policy as provisional.
5. **World and political news.** A licensed provider agreement is required before enabling the
   source. The current adapter stores headline, link and a neutral summary only.
6. **Fixture data.** Fixture values are synthetic, but fixture news items use real publisher
   URLs as link targets and fixture headlines are placeholders. Do not present fixture content
   as reporting.

## Attribution in the UI

| Location | What it shows |
| --- | --- |
| Sources workspace | Source name, domain, type, enabled state, priority, cadence, attribution, licensing note, last run, freshness, rate-limit state, error |
| Methodology workspace | Metric-level statements about provenance and limits |
| Model detail, source metadata section | Source id, source version, last refresh, payload context |
| News and world cards | Source name, trust tier, publication time, external link |
| Harness plan board and cheapest views | Source URL and last-verified time per plan |
| Shell header | Data mode and dataset capture time |
| `GET /api/health` | Capability list with configuration state |

## Adding a source

The registry requires `attribution` and `licensingNote` fields on every source. A new source
without them is incomplete. Verify the URL, the terms and the data shape before enabling it,
as the seed registry file itself instructs.
