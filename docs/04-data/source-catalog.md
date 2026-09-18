# Source catalog

Every source registered in the application. The registry is data, not code: it is declared
in `src/lib/fixtures/sources.ts` and seeded into `public.sources` by
`supabase/migrations/20260918000600_seed_source_registry.sql`. The job registry
(`src/lib/jobs/registry.ts`) selects sources by domain.

URLs are the ones currently in the registry. They must be re-verified before a source is
enabled in production; several point at real publishers and two are deliberately disabled
placeholders.

## Enabled sources

| ID | Domain | Type | Priority | Cadence (min) | URL | Attribution |
| --- | --- | --- | --- | --- | --- | --- |
| `artificial-analysis-api` | models | api | 1 | 30 | https://artificialanalysis.ai/data-api/docs | Artificial Analysis |
| `internal:provider-registry` | internal | manual | 1 | - | https://artificialanalysis.ai/data-api/docs | - |
| `command-code-pricing` | harness | official_pricing | 1 | 240 | https://commandcode.ai/pricing | Command Code |
| `command-code-go` | harness | official_docs | 1 | 360 | https://commandcode.ai/docs/plans/go | Command Code |
| `opencode-go` | harness | official_docs | 1 | 360 | https://opencode.ai/v2/docs/console/go | OpenCode |
| `kilo-pricing` | harness | official_pricing | 1 | 240 | https://kilo.ai/pricing | Kilo Code |
| `claude-pricing` | harness | official_pricing | 1 | 240 | https://claude.com/pricing | Anthropic |
| `freebuff` | harness | official_site | 1 | 360 | https://freebuff.ai/ | Freebuff |
| `cursor-pricing` | harness | official_pricing | 2 | 360 | https://cursor.com/pricing | Cursor |
| `windsurf-pricing` | harness | official_pricing | 2 | 360 | https://windsurf.com/pricing | Windsurf |
| `gemini-cli-releases` | harness | github_releases | 2 | 30 | https://github.com/google-gemini/gemini-cli/releases | Google |
| `openai-release-notes` | provider_news | official_changelog | 1 | 20 | https://openai.com/products/release-notes/ | OpenAI |
| `anthropic-news` | provider_news | html | 1 | 30 | https://www.anthropic.com/news | Anthropic |
| `google-blog-ai` | provider_news | atom | 1 | 30 | https://blog.google/technology/ai/rss/ | Google |
| `openai-blog-rss` | ai_news | rss | 1 | 30 | https://openai.com/blog/rss.xml | OpenAI |
| `huggingface-blog` | research | rss | 2 | 120 | https://huggingface.co/blog/feed.xml | Hugging Face |
| `arxiv-cs-ai` | research | atom | 2 | 360 | https://export.arxiv.org/rss/cs.AI | arXiv |
| `artificial-analysis-posts` | research | html | 2 | 720 | https://artificialanalysis.ai/methodology | Artificial Analysis |

## Disabled sources

| ID | Domain | Type | Priority | Cadence (min) | URL | Why disabled |
| --- | --- | --- | --- | --- | --- | --- |
| `x-monitored-accounts` | social | social_api | 2 | 60 | https://developer.x.com/en/docs/x-api | Requires authorized API access. Disabled until `X_BEARER_TOKEN` is configured. X HTML is never scraped as the foundation. |
| `world-primary-wire` | world_politics | json | 1 | 30 | https://example.com/world-wire-api | Requires a licensed provider. Disabled until `WORLD_NEWS_API_KEY` and `WORLD_NEWS_BASE_URL` are configured. The URL is a placeholder. |

## Which sources each job consumes

| Job | Domains | Sources selected |
| --- | --- | --- |
| `sync-models` | models | `artificial-analysis-api` |
| `sync-ai-news` | ai_news, provider_news, research | `openai-blog-rss`, `openai-release-notes`, `anthropic-news`, `google-blog-ai`, `huggingface-blog`, `arxiv-cs-ai`, `artificial-analysis-posts` |
| `sync-harness-pricing` | harness | `command-code-pricing`, `kilo-pricing`, `claude-pricing`, `freebuff`, `cursor-pricing`, `windsurf-pricing` |
| `sync-harness-changelogs` | harness | same harness set (the `github_releases` and `official_docs` entries) |
| `sync-social` | social | `x-monitored-accounts` (disabled) |
| `sync-world-news` | world_politics | `world-primary-wire` (disabled) |
| `cleanup-raw-ingestion` | none | maintenance job; no sources |

Note that `internal:provider-registry` has domain `internal`, which no job selects, so it is
a registry entry only. It exists so provider-provenance attribution has a named source.

## How each type is handled

| Type | Adapter path | Notes |
| --- | --- | --- |
| `api` | `fetchArtificialAnalysis` (models domain only) | Quota-aware, paginated, `x-api-key` |
| `rss`, `atom` | `feedToNewsItems` | Dependency-free RSS 2.0 / Atom parser |
| `official_pricing`, `official_site` | `extractHarnessPage` with a registered config | Requires a config in `src/lib/ingestion/harness-configs.ts`, otherwise the source fails with an explanatory message |
| `github_releases` | `feedToNewsItems` against `<url>.atom` | The `.atom` suffix is appended if absent |
| `social_api` | `fetchSocialPosts` | Bearer token; zero requests without it |
| `json` | `fetchWorldNews` when the domain is `world_politics` | Cursor pagination |
| `html` (news) | No adapter | Reported as `deferred`; see KI-6 in `docs/03-implementation/current/known-issues.md` |
| `official_docs`, `official_changelog`, `manual` | No direct adapter | `official_docs` harness entries are not fetched (the pricing-page config covers pricing); `openai-release-notes` is `official_changelog` with no adapter |

## Harness extraction coverage

Registered extraction configs (`configVersion` `2026.09.1`) exist for: `command-code-pricing`
(Go, GOAT), `opencode-go` (Go), `kilo-pricing` (Individual platform, Kilo Pass),
`claude-pricing` (Pro, Max), `freebuff` (ad-supported free tier), `cursor-pricing` (Pro),
`windsurf-pricing` (Pro). `tests/unit/adapters.test.ts` asserts that each of those source ids
has a config and that every plan declares at least one required field.

The selector patterns have not been verified against the current live pages. This is recorded
as `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`.

## Adding a source

1. Add the definition to `SOURCE_REGISTRY` in `src/lib/fixtures/sources.ts` with a domain,
   type, priority, cadence, attribution and licensing note.
2. Add the matching row to the seed migration so the database registry agrees with the code
   registry. The seed uses `on conflict (id) do update`, so it is safe to re-run.
3. If the type needs extraction (a pricing page), add a `PlanExtractionConfig` to
   `HARNESS_PAGE_CONFIGS` and a fixture-based test.
4. Confirm the domain is covered by a job in `src/lib/jobs/registry.ts`, or add one.
5. Verify the URL and terms before enabling the source.
