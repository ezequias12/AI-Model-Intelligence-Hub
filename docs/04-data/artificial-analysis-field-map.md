# Artificial Analysis field map

This document reproduces the mapping actually implemented in
`src/lib/adapters/artificial-analysis.ts`. It is not a specification of what the vendor
guarantees; it is a description of the code as written.

Two sources of truth exist in that file: the JSDoc field map above
`artificialAnalysisModelSchema`, and the mapping code in `mapArtificialAnalysisModel`.
Both are reproduced below.

## JSDoc field map (verbatim from the source file)

```text
intelligence_index            -> metrics.intelligence
coding_index                  -> metrics.coding
agentic_index / tau_bench     -> metrics.agentic
math_index / aime             -> metrics.math
median_output_tokens_per_second -> metrics.outputSpeedTps
median_time_to_first_token_seconds -> metrics.ttftSeconds
pricing.{price_1m_input_tokens, price_1m_output_tokens,
         price_1m_cache_hit_tokens, price_1m_cache_write_tokens}
context_window / max_context_tokens -> metrics.contextWindow
```

## Implemented mapping

From `mapArtificialAnalysisModel(raw, capturedAt)`:

| Source field | Domain field | Transformation |
| --- | --- | --- |
| `name` | `model.name` | Copied as-is (required by the raw schema) |
| `name` | `model.shortName` | Copied as-is. No abbreviation is derived. |
| `slug` | `model.slug` | Used when present; otherwise derived from `name` by lowercasing and replacing non-alphanumeric runs with `-`, trimming leading and trailing hyphens |
| `release_date` | `model.releaseDate` | Copied, or `null` |
| `deprecated` | `model.deprecatedAt` | `deprecated === true` maps to `capturedAt`; otherwise `null`. The vendor does not supply a deprecation date, so the observation time is used. |
| `open_weights` ?? `open_weight` | `model.openWeight` | `Boolean(...)`; either spelling is accepted, `open_weights` wins |
| `intelligence_index` | `metrics.intelligence` | `asNumber` (number or numeric string), else `null` |
| `coding_index` | `metrics.coding` | `asNumber`, falling back to `pickEvaluation(evaluations, ["coding", "swe_bench"])`, else `null` |
| `agentic_index` | `metrics.agentic` | `asNumber`, falling back to `pickEvaluation(evaluations, ["agentic", "tau_bench", "tool_use"])`, else `null` |
| `math_index` | `metrics.math` | `asNumber`, falling back to `pickEvaluation(evaluations, ["math", "aime", "math_500"])`, else `null` |
| `median_output_tokens_per_second` | `metrics.outputSpeedTps` | `asNumber`, else `null` |
| `median_time_to_first_token_seconds` | `metrics.ttftSeconds` | `asNumber`, else `null` |
| `pricing.price_1m_input_tokens` | `metrics.inputPricePerMillion` | `asNumber`, else `null` |
| `pricing.price_1m_output_tokens` | `metrics.outputPricePerMillion` | `asNumber`, else `null` |
| `pricing.price_1m_cache_hit_tokens` | `metrics.cacheReadPricePerMillion` | `asNumber`, else `null` |
| `pricing.price_1m_cache_write_tokens` | `metrics.cacheWritePricePerMillion` | `asNumber`, else `null` |
| `context_window` | `metrics.contextWindow` | `asNumber`, else `null` |
| `model_creator` ?? `creator` | provider name and slug | `name` defaults to `"Unknown provider"`; `slug` is taken from the payload or derived from the name |
| (constant) | `model.sourceId` | `"artificial-analysis-api"` |
| (constant) | `model.sourceVersion` | `null` |
| (parameter) | `model.lastRefreshedAt` | The `capturedAt` value passed to the mapper |
| (constant) | `model.description`, `model.officialUrl` | `null` |

Not mapped, even though the JSDoc comment mentions them:

| Field | Note |
| --- | --- |
| `max_context_tokens` | The JSDoc mentions it as an alternative to `context_window`, but the raw schema declares only `context_window`, and `raw.max_context_tokens` is never read. An unknown extra field is tolerated by `.passthrough()` but ignored. |
| `evaluations` keys as source of truth | Only used as a fallback for coding, agentic and math when the dedicated index fields are absent or non-numeric. `pickEvaluation` accepts either a number or an object with a `score` property. |

## Envelope handling

| Envelope field | Behaviour |
| --- | --- |
| `data` or `models` | Rows are taken from `data` when present, otherwise `models`. Both are `unknown[]` in the raw schema. |
| `pagination.has_more` | When `true`, pagination continues. |
| `pagination.total_pages` | Pagination stops when `page >= total_pages`. |
| Short page | Pagination also stops when the returned row count is below `pageSize` and `has_more` is not true. |
| Unknown extra fields | Tolerated at both envelope and row level (`.passthrough()`), per the declared policy that an unknown extra field must not break ingestion. |
| Row that fails the row schema | Counted in `skipped` and dropped; the run continues. |
| Envelope that fails `artificialAnalysisResponseSchema` | The adapter returns `schema` failure with the first Zod issue message, keeping any items already collected. |

Note that an envelope without `data` and without `models` passes the schema (both fields are
optional) and yields zero rows with `ok: true`. The contract test asserts that behaviour.

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

The mapping has never been executed against a live response from this repository. It is
covered by `tests/integration/adapters-contract.test.ts`, which feeds a stub payload and
asserts:

- `not_configured` is returned without a key, and the adapter is not retryable in that case;
- a payload maps into domain models while an unusable row is counted as skipped;
- an unknown extra field does not break mapping;
- missing metrics map to `null`, never to `0`;
- `providerFromMapped` never guesses a group (`other`) or a region (`null`);
- persistence rows use stable ids and a payload hash of at least 16 characters;
- transport failure produces a retryable `network` error.

Status: `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`. The required variable is
`ARTIFICIAL_ANALYSIS_API_KEY`; the optional base URL override is
`ARTIFICIAL_ANALYSIS_BASE_URL` (default `https://artificialanalysis.ai/api/v2`).
