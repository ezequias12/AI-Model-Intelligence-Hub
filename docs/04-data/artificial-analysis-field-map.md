# Artificial Analysis field map

This document reproduces the mapping actually implemented in
`src/lib/adapters/artificial-analysis.ts`, reconciled against a live response on 2026-09-18.
It is a description of the code as written, not a specification of what the vendor
guarantees.

Two sources of truth exist in that file: the JSDoc field map above
`artificialAnalysisModelSchema`, and the mapping code in `mapArtificialAnalysisModel`.
Both are reproduced below.

## Live verification (2026-09-18)

A read-only `GET https://artificialanalysis.ai/api/v2/data/llms/models` with a real API key
returned HTTP 200 and **652 rows in a single response**. Observed shape:

- Top-level keys: `status`, `prompt_options`, `data`.
- **No `pagination` block.** The endpoint returns the whole model set at once; `?page=` and
  `?page_size=` are accepted but do not change the response.
- **No rate-limit headers** were present on this endpoint (`x-ratelimit-remaining`,
  `x-ratelimit-limit`, `x-ratelimit-reset` all absent). The published limit is 1,000
  requests/day.
- Row keys: `id`, `name`, `slug`, `model_creator`, `release_date`, `evaluations`, `pricing`,
  `median_output_tokens_per_second`, `median_time_to_first_token_seconds`,
  `median_time_to_first_answer_token`.
- `evaluations` keys include `artificial_analysis_intelligence_index`,
  `artificial_analysis_coding_index`, `artificial_analysis_math_index`, plus raw benchmarks
  (`gpqa`, `hle`, `mmlu_pro`, `livecodebench`, `scicode`, `math_500`, `aime`, `aime_25`,
  `ifbench`, `lcr`, `tau2`, `tau_banking`, `terminalbench_hard`, `terminalbench_v2_1`).
- `pricing` keys: `price_1m_input_tokens`, `price_1m_output_tokens`,
  `price_1m_blended_3_to_1`.

The endpoint is `/data/llms/models` (plural). Before this verification the adapter called
`/data/llm/models` (singular), which returns the site's 404 HTML page — so no live model row
had ever been parsed.

## JSDoc field map (verbatim from the source file)

```text
evaluations.artificial_analysis_intelligence_index -> metrics.intelligence
evaluations.artificial_analysis_coding_index       -> metrics.coding
evaluations.artificial_analysis_math_index         -> metrics.math
median_output_tokens_per_second                    -> metrics.outputSpeedTps
median_time_to_first_token_seconds                 -> metrics.ttftSeconds
pricing.price_1m_input_tokens                      -> metrics.inputPricePerMillion
pricing.price_1m_output_tokens                     -> metrics.outputPricePerMillion
```

## Implemented mapping

From `mapArtificialAnalysisModel(raw, capturedAt)`:

| Source field | Domain field | Transformation |
| --- | --- | --- |
| `name` | `model.name` | Copied as-is (required by the raw schema) |
| `name` | `model.shortName` | Copied as-is. No abbreviation is derived. |
| `slug` | `model.slug` | Used when present; otherwise derived from `name` by lowercasing and replacing non-alphanumeric runs with `-`, trimming leading and trailing hyphens |
| `release_date` | `model.releaseDate` | Copied (the live payload supplies `"YYYY-MM-DD"`), or `null` |
| `deprecated` | `model.deprecatedAt` | `deprecated === true` maps to `capturedAt`; otherwise `null`. **The free API does not expose this field**, so it is always `null` live. |
| `open_weights` ?? `open_weight` | `model.openWeight` | `Boolean(...)`; either spelling is accepted. **The free API does not expose this field**, so it is always `false` live. |
| `intelligence_index` ?? `evaluations.artificial_analysis_intelligence_index` ?? `evaluations.intelligence_index` | `metrics.intelligence` | `asNumber` of the top-level field, else `pickEvaluation`, else `null` |
| `coding_index` ?? `evaluations.artificial_analysis_coding_index` ?? `evaluations.coding_index` | `metrics.coding` | Same fallback chain |
| `agentic_index` ?? `evaluations.artificial_analysis_agentic_index` ?? `evaluations.agentic_index` | `metrics.agentic` | Same fallback chain. **The free API exposes no agentic index**, so this is `null` live. `tau2`/`tau_banking` are 0-1 fractions and are deliberately not mapped into a 0-100 index. |
| `math_index` ?? `evaluations.artificial_analysis_math_index` ?? `evaluations.math_index` | `metrics.math` | Same fallback chain |
| `median_output_tokens_per_second` | `metrics.outputSpeedTps` | `asNumber`, else `null` |
| `median_time_to_first_token_seconds` | `metrics.ttftSeconds` | `asNumber`, else `null` |
| `pricing.price_1m_input_tokens` | `metrics.inputPricePerMillion` | `asNumber`, else `null` |
| `pricing.price_1m_output_tokens` | `metrics.outputPricePerMillion` | `asNumber`, else `null` |
| `pricing.price_1m_cache_hit_tokens` | `metrics.cacheReadPricePerMillion` | `asNumber`, else `null`. **The free API does not expose cache prices**, so this is `null` live. |
| `pricing.price_1m_cache_write_tokens` | `metrics.cacheWritePricePerMillion` | `asNumber`, else `null`. Same limitation. |
| `context_window` | `metrics.contextWindow` | `asNumber`, else `null`. **The free API does not expose a context window**, so this is `null` live. |
| `model_creator` ?? `creator` | provider name and slug | `name` defaults to `"Unknown provider"`; `slug` is taken from the payload or derived from the name |
| (constant) | `model.sourceId` | `"artificial-analysis-api"` |
| (constant) | `model.sourceVersion` | `null` |
| (parameter) | `model.lastRefreshedAt` | The `capturedAt` value passed to the mapper |
| (constant) | `model.description`, `model.officialUrl` | `null` |

Fields the free API does not expose (mapped to `null`/`false`, never to a guessed value):
`agentic`, `contextWindow`, `cacheReadPricePerMillion`, `cacheWritePricePerMillion`,
`openWeight`, `deprecatedAt`. In live mode those render as an em dash. `pricing` also carries
`price_1m_blended_3_to_1`, which is **not** mapped: the product computes its own blended price
with configurable weights (see the Methodology page).

## Envelope handling

| Envelope field | Behaviour |
| --- | --- |
| `data` or `models` | Rows are taken from `data` when present, otherwise `models`. Both are `unknown[]` in the raw schema. The live payload uses `data`. |
| `pagination` | When the block is **absent**, the adapter treats the response as the complete set and stops after the first page. This is the live behaviour and prevents re-fetching the same 652 rows on every page. |
| `pagination.has_more` | When the block is present and `true`, pagination continues. |
| `pagination.total_pages` | Pagination stops when `page >= total_pages`. |
| Short page | With a pagination block present, pagination also stops when the row count is below `pageSize` and `has_more` is not true. |
| Unknown extra fields | Tolerated at both envelope and row level (`.passthrough()`), per the declared policy that an unknown extra field must not break ingestion. |
| Row that fails the row schema | Counted in `skipped` and dropped; the run continues. |
| Envelope that fails `artificialAnalysisResponseSchema` | The adapter returns `schema` failure with the first Zod issue message, keeping any items already collected. |

An envelope without `data` and without `models` passes the schema (both fields are optional)
and yields zero rows with `ok: true`.

## Provider mapping

`providerFromMapped(mapped, updatedAt)` produces:

| Field | Value |
| --- | --- |
| `id` | `provider:<creatorSlug>` |
| `slug` | The creator slug |
| `name` | The creator name, or `"Unknown provider"` |
| `domain` | `null` |
| `countryCode` | `null` |
| `region` | `null` |
| `group` | `"other"` (deliberate; see ADR-0005) |
| `logoUrl` | `null` |
| `color` | `null` |
| `active` | `true` |
| `sourceId` | `"artificial-analysis-api"` |
| `updatedAt` | The supplied timestamp |

The source comment states the reason for the nulls and the `other` group: grouping is
curated in the internal provider registry, never inferred from the metric payload, because
region is not a quality signal and must not be guessed.

## Persistence rows

`toPersistenceRows(items, now)`:

| Output | Construction |
| --- | --- |
| `providers` | One per distinct creator slug, first occurrence wins |
| `models` | `id = model:<slug>`, `providerId = provider:<creatorSlug>` |
| `snapshots` | `id = model-snapshot:<slug>:<capturedAt>`, `metrics` copied from the model, `payloadHash = hashPayload({ index, slug, metrics })` |

The snapshot id embeds the capture timestamp, and the snapshot `payloadHash` is a 16-character
`stableHash` value (FNV-1a based, not cryptographic). The `payload_hash` column and the unique
constraint `(model_id, captured_at, payload_hash)` make a repeated write of the same payload
idempotent.

## Verification status

The mapping was executed against a live response on 2026-09-18 and reconciled. The contract
test in `tests/integration/adapters-contract.test.ts` now feeds a trimmed real sample and
asserts:

- the adapter calls `/data/llms/models`, not `/data/llm/models`;
- a response with no pagination block produces exactly one request, even when the row count
  exceeds `pageSize`;
- `intelligence`, `coding`, `math` and input/output pricing map from the real field names;
- `math: null`, `contextWindow: null` and `openWeight: false` are preserved, not fabricated;
- `providerFromMapped` never guesses a group (`other`) or a region (`null`);
- persistence rows use stable ids and a payload hash of at least 16 characters;
- a quota-guard refusal is classified as a retryable `rate_limited` deferral (KI-1);
- `not_configured` is returned without a key, and a transport failure is a retryable
  `network` error.

Status: the adapter and field map are **verified against the live API**. Persistence of the
result is still unverified: it has never been written to a Supabase project from this
repository. Required variable: `ARTIFICIAL_ANALYSIS_API_KEY`; optional base URL override:
`ARTIFICIAL_ANALYSIS_BASE_URL` (default `https://artificialanalysis.ai/api/v2`).
