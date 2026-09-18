# ADR-0003: Artificial Analysis integration is API-first, never scraped

- Status: Accepted
- Date: 2026-09-18
- Deciders: implementation agent (autonomous phase)

## Context

Artificial Analysis is the primary source for model metrics and pricing. It publishes a
web interface and a documented Data API with a server-side API key, pagination and
rate-limit headers.

The temptation is obvious: the web interface is public, so a scraper would produce data
immediately, with no key, no quota accounting and no dependency on a signup process.
That path has several problems, only some of which are technical:

- **Terms and attribution.** The source's terms govern how the data may be retrieved and
  redistributed. Scraping to bypass a quota is a terms violation, not a clever workaround.
- **Quota is a real constraint, and it is the point.** The API exists to make retrieval
  bounded. A scraper removes the bound, which makes traffic patterns abusive rather than
  merely inconvenient.
- **Structure.** An API returns a documented shape that can be validated and versioned. A
  page layout changes without notice and without a contract, so a scraper silently
  produces wrong numbers rather than failing.
- **Failure semantics.** With an API we can distinguish `429` from `5xx` from an auth
  failure and act differently. With HTML we get "the layout changed", which is not
  actionable at 3am.
- **Honesty to the user.** The product promises every number is attributable and dated. An
  undocumented scrape undermines that promise.

The counter-argument is availability: without a key, the model workspace has no live data.
That is a real cost, and it must be answered without violating the source's terms.

## Decision

The Artificial Analysis integration is API-first and only API-based.

1. `src/lib/adapters/artificial-analysis.ts` is the only code path that reaches the
   source. It uses `x-api-key` against `${ARTIFICIAL_ANALYSIS_BASE_URL}/data/llm/models`
   (default base URL `https://artificialanalysis.ai/api/v2`).
2. Without `ARTIFICIAL_ANALYSIS_API_KEY` the adapter returns
   `adapterFailure(NOT_CONFIGURED("Artificial Analysis Data API",
   "ARTIFICIAL_ANALYSIS_API_KEY"))`. It does not attempt an alternative retrieval route.
3. Pagination is explicit (`page`, `page_size`, `maxPages` default 20, page size default
   100) and stops on `has_more: false`, on `total_pages`, or on a short page.
4. Quota discipline lives in the shared `HttpClient`: rate-limit headers are captured,
   HTTP 429 is honoured with `Retry-After` and exponential backoff, 5xx is retried, and a
   request is refused outright when the reported remaining quota is below `minRemaining`
   (default 1).
5. `providerFromMapped()` sets `group: "other"` deliberately: grouping is curated
   internally and never inferred from the metric payload (see ADR-0005).
6. Attribution is carried in the source registry (`attribution: "Artificial Analysis"`,
   `licensingNote: "Attribution required. Respect quota; never scrape to bypass limits."`).
7. **The gap is answered with fixtures, not with scraping.** Mock mode ships a full
   deterministic model catalogue so every screen works without a key, and the credential
   gap is documented as `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`.

## Consequences

Positive:

- Retrieval stays within the provider's terms and inside a bounded quota.
- The client is typed and validated: an unknown extra field is tolerated
  (`.passthrough()`), but a missing field becomes `null` rather than a fabricated zero.
- Failure modes are distinguishable and actionable: `not_configured`, `rate_limited`,
  `schema`, `network`.
- The product is fully usable without a key, because mock mode is a first-class mode.

Negative:

- Without a key there is no live model data, so the app depends on fixtures until the
  owner configures the integration.
- The response schema is inferred from the documented shape and the contract tests' stub
  payload, not from a captured live response. The mapping is therefore
  `IMPLEMENTED - LIVE VERIFICATION PENDING CREDENTIALS`; a field rename on the provider
  side would need a code change, and it has not been observed yet.
- Pagination defaults are a guess that will need tuning once real page counts are known.
- The adapter only knows one endpoint family. Additional endpoints (for example a
  dedicated benchmark or leaderboard resource) would each need their own typed client.
- A quota guard can defer work. That is intentional and is reported as `deferred`, but it
  means a run can legitimately do nothing.

## Alternatives considered

1. **Scrape the public web interface.** Rejected. It violates the terms, removes the quota
   bound and produces silent wrong values when the layout changes.
2. **Use a third-party mirror or aggregator.** Rejected. It adds an unaccountable
   intermediary, weakens attribution and creates a second schema to maintain for a
   source that already publishes an API.
3. **Run a headless browser against the site.** Rejected. It is scraping with more
   dependencies and more CPU, and it does not solve the structure or terms problem.
4. **Ship with no model data at all until a key exists.** Rejected. The Models workspace
   is the primary product; leaving it empty would make the rest of the repository
   unverifiable.
5. **Hard-code a snapshot of today's metrics as the fallback.** Rejected. It would present
   stale values as if they were live. Fixtures are labelled as fixtures; a frozen real
   snapshot would not be.
