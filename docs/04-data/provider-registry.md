# Provider registry

Provider metadata is curated, not inferred. It lives in `src/lib/fixtures/providers.ts`
(`PROVIDER_SEEDS`) and is seeded into `public.providers`.

## Grouping rules

`provider_group` has three values, matching the checked column in
`public.providers` and the `providerGroupSchema` Zod enum:

| Value | Meaning | UI label |
| --- | --- | --- |
| `mainstream_global` | Large, globally distributed commercial labs | Mainstream |
| `china_based` | Labs headquartered in China | China-based |
| `other` | Anything not classified above, including infrastructure and platform vendors | - |

The SQL column carries an explicit comment: "Geographic/structural classification only.
Never a quality judgement." ADR-0005 records the decision and the constraints that follow
from it:

- Grouping is never inferred from a metric payload. The Artificial Analysis adapter sets
  `group: "other"` for every discovered provider, and leaves `region` and `countryCode` as
  `null`.
- Grouping is never used as an ordering, a colour ranking or a score. It is only a filter.
- `openWeight` is a model property, not a provider property.

## Registered providers (fixture set)

| Slug | Name | Domain | Country | Region | Group |
| --- | --- | --- | --- | --- | --- |
| `openai` | OpenAI | openai.com | US | United States | `mainstream_global` |
| `anthropic` | Anthropic | anthropic.com | US | United States | `mainstream_global` |
| `google` | Google DeepMind | deepmind.google | US | United States | `mainstream_global` |
| `xai` | xAI | x.ai | US | United States | `mainstream_global` |
| `meta` | Meta | ai.meta.com | US | United States | `mainstream_global` |
| `mistral` | Mistral AI | mistral.ai | FR | European Union | `mainstream_global` |
| `cohere` | Cohere | cohere.com | CA | Canada | `mainstream_global` |
| `microsoft` | Microsoft | microsoft.com | US | United States | `other` |
| `amazon` | Amazon | aws.amazon.com | US | United States | `other` |
| `nvidia` | NVIDIA | nvidia.com | US | United States | `other` |
| `deepseek` | DeepSeek | deepseek.com | CN | China | `china_based` |
| `alibaba` | Alibaba Qwen | qwen.ai | CN | China | `china_based` |
| `moonshot` | Moonshot AI | moonshot.ai | CN | China | `china_based` |
| `minimax` | MiniMax | minimax.io | CN | China | `china_based` |
| `zhipu` | Z.ai (Zhipu) | z.ai | CN | China | `china_based` |
| `xiaomi` | Xiaomi | xiaomi.com | CN | China | `china_based` |

Each seed also defines a brand `color` used for chart markers and chart tooltips. Fixture
provider ids are `provider:<slug>`; `sourceId` is `internal:provider-registry` and
`updatedAt` is the fixture timestamp.

## Provider entity fields

From `providerSchema` in `src/lib/domain/schema.ts` and the `public.providers` table:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `provider:<slug>` convention |
| `slug` | kebab-case string | Unique |
| `name` | string | Display name |
| `domain` | string or null | Official domain |
| `countryCode` | 2-letter string or null | ISO 3166-1 alpha-2 when confidently known |
| `region` | string or null | Human-readable region label |
| `group` | enum | `mainstream_global` / `china_based` / `other` |
| `logoUrl` | URL or null | `null` in the fixture set |
| `color` | hex string or null | Validated as `#rrggbb`; used for chart marks |
| `active` | boolean | `true` in the fixture set |
| `sourceId` | string or null | Provenance |
| `updatedAt` | ISO date | |

## Where provider metadata is used

| Consumer | Use |
| --- | --- |
| `applyProviderScope` (`src/lib/domain/selection.ts`) | Filters models by group or by an explicit provider list |
| `resolveDefaultSelection` | Maps default-slot provider slugs (`openai`, `anthropic`, `google`, `google-deepmind`, `xai`, `deepseek`, `alibaba`, `qwen`, `moonshot`, `moonshot-ai`, `kimi`) to provider ids |
| `applyPreset` | `mainstream_western` (group `mainstream_global`) and `china_based` presets |
| `computeLandscapeChart` | Provider name and colour on every chart point |
| `buildSearchIndex` | A searchable provider entry per provider |
| `getProviderDeployments`-equivalent ranking scope | Provider group filtering inside ranking boards |

## Where provider metadata is missing

| Gap | Consequence |
| --- | --- |
| No admin or import path into `public.providers` in live mode | A fresh database has no providers until the Artificial Analysis adapter writes them, and that adapter writes `group: "other"`, `region: null`, `countryCode: null`, `color: null` |
| Group and region therefore need curation per deployment | The group filters and region chips are empty for adapter-discovered providers |
| `logoUrl` is `null` in the fixture set | The UI uses colour markers and text, not logos |
| No country filter | Only group filtering is exposed; `countryCode` is stored but not surfaced as a control |

## Alternative metadata sources

If an official catalogue is ever needed for logos, regions or open-weight flags, options are
recorded in `docs/08-research/alternatives/provider-metadata-sources.md`. None is integrated.

## Adding a provider

1. Add a `FixtureProviderSeed` to `PROVIDER_SEEDS` with the slug, name, domain, country,
   region, group and colour.
2. If the provider should appear in the default comparison set, add a slot to `DEFAULT_SLOTS`
   in `src/lib/domain/selection.ts` using the provider slug.
3. Add fixture models referencing the new slug in `src/lib/fixtures/models.ts`
   (`buildFixtureModels` throws if a seed references an unknown provider, so this is
   enforced).
4. Run `npm run test` to confirm the selection, analytics and neutrality suites still hold.
