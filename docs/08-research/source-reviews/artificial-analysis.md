# Source review: Artificial Analysis Data API

- Date: 2026-09-18
- Author: documentation phase
- Status: Open (blocked on credentials)
- Related: ADR-0003, `docs/04-data/artificial-analysis-field-map.md`

## Question

Is the Artificial Analysis integration as implemented likely to work against the real API, and
what exactly remains unverified?

## Method

Read, in the repository:

- the registry entry and its terms in `src/lib/fixtures/sources.ts` and
  `supabase/migrations/20260918000600_seed_source_registry.sql`;
- the adapter in full: `src/lib/adapters/artificial-analysis.ts`, including the raw payload schema,
  the JSDoc field map, `mapArtificialAnalysisModel`, `providerFromMapped` and
  `toPersistenceRows`;
- the shared transport: `src/lib/adapters/http.ts` (quota guard, 429 handling, backoff, header
  capture);
- the contract tests: `tests/integration/adapters-contract.test.ts`;
- the declared requirements in `DATA_SOURCES_AND_PIPELINES.md`.

Not done: no request was made to the live API. No API key was available, and making an
unauthenticated request would not exercise the authenticated path. The documented endpoint
(https://artificialanalysis.ai/data-api/docs) was not fetched during this review.

## Findings

| Finding | Evidence |
| --- | --- |
| The adapter is API-only and has no scraping fallback | `fetchArtificialAnalysis` uses `client.request` against `{base}/data/llm/models` with an `x-api-key` header; there is no HTML path in the file |
| A missing key is reported, not worked around | Without `ARTIFICIAL_ANALYSIS_API_KEY` the function returns `NOT_CONFIGURED("Artificial Analysis Data API", "ARTIFICIAL_ANALYSIS_API_KEY")` with `retryable: false`; asserted by two contract tests |
| The field map in the comment and the mapping code agree, with one discrepancy | The comment mentions `max_context_tokens` as an alternative to `context_window`, but the raw schema declares only `context_window` and the mapper reads only that field |
| Pagination is bounded and stops on three conditions | `has_more`, `total_pages`, or a short page; `maxPages` defaults to 20 and `pageSize` to 100 |
| Quota is respected on two levels | A request cap per client instance, and a `minRemaining` guard that refuses to issue a request when the last seen `remaining` is below the requirement |
| Rate-limit headers are read across vendor spellings | `x-ratelimit-remaining`, `ratelimit-remaining`, `x-rate-limit-remaining` and the `limit` and `reset` counterparts |
| 429 handling honours `Retry-After` in both formats | `parseRetryAfter` accepts seconds or an HTTP date; the client retries up to `maxAttempts` (default 4) and then throws `RateLimitExceededError` |
| Unknown extra fields cannot break ingestion | Both the envelope and the row schema use `.passthrough()` |
| A missing metric becomes `null`, never zero | `asNumber` returns `null` for a non-numeric value; the contract test asserts `null` for absent coding and input price |
| Provider grouping is not guessed | `providerFromMapped` sets `group: "other"`, `region: null`, `countryCode: null`, `color: null` with an explicit comment |
| Evaluation fallbacks are tolerant of two shapes | `pickEvaluation` accepts a bare number or an object with a `score` property, for coding, agentic and math only |
| An envelope without `data` or `models` is treated as valid and yields zero rows | Asserted in the contract test; both fields are optional in the schema |
| Snapshot ids embed the capture timestamp and the payload hash is a 16-character `stableHash` | `toPersistenceRows`; `hashPayload` uses `stableHash` |
| `payloadHash` is documented as sha256 in the domain schema | `src/lib/domain/schema.ts` JSDoc; the implementation is FNV-1a (KI-3) |
| A quota-guard deferral is misclassified as a network error, then reported as `failed` | The adapter tests `/rate limited/i` against the message; `QuotaGuardError` says "Deferred request: ..." (KI-1) |

## Assessment

The adapter is a faithful implementation of the documented requirements: typed, paginated,
quota-aware, honest about a missing key, and strict about not inventing values. Confidence in the
structure is therefore reasonably high; confidence in the exact field names is not, because no live
response was ever parsed.

Specific areas where a live response is most likely to require a change:

1. **Field naming.** The mapping was written from a documented shape, not a captured response. A
   rename would silently produce `null` rather than an error, because missing fields map to `null`.
   The symptom would be a dashboard full of em dashes rather than a failure, which is the riskiest
   kind of drift.
2. **Envelope shape.** `data` and `models` are both accepted as the row array, and `pagination`
   fields are all optional. If the real envelope nests rows differently, the result would be zero
   rows with `ok: true`.
3. **Pagination defaults.** `pageSize` 100 and `maxPages` 20 are assumptions. If the real maximum
   page size is smaller, the loop still works but issues more requests; if it is larger with a hard
   total, the run could stop early.
4. **Quota header names and `Retry-After` units.** Multiple spellings are tolerated, but the exact
   ones the API sends are unverified.
5. **`deprecated` semantics.** `deprecated: true` currently maps to `deprecatedAt = capturedAt`,
   because the payload carries no date. That is an observation time presented in a date field, which
   is defensible but should be confirmed against the payload.

## Open questions

1. What does a real `/data/llm/models` response look like, field by field?
2. What is the real maximum page size, and how many pages does a full pass take?
3. Which rate-limit headers does the API send, and in what unit is the reset expressed?
4. Is `context_window` the field name, or is it `max_context_tokens`?
5. Does the payload expose a separate math index, or only through `evaluations`?
6. What is the documented quota, and what cadence does it support at the default page size?
7. Does the payload ever carry a deprecation date?
8. Are there additional endpoints (for example a leaderboard or benchmark resource) that would let
   the unused `benchmark_definitions` tables be populated?

## Recommendation

1. Capture one real response (any small page) and turn it into a fixture committed next to the
   contract test, replacing the hand-written stub.
2. Reconcile the field map against the response and correct the `max_context_tokens` discrepancy in
   either the comment or the schema.
3. Record the real rate-limit header names and quota in `docs/04-data/source-catalog.md`.
4. Only then move the capability from
   `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS` to verified.
5. While doing so, address KI-1 (quota-guard classification) so quota behaviour is observable
   correctly during the verification run.
