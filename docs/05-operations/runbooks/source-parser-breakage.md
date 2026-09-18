# Runbook: source parser breakage

**Severity:** high (data stops flowing for one source class)
**Typical signal:** a source reports `failed` with a `parse` or `schema` message; harness plans
resolve fewer fields than before; `items_written` drops to zero for a source that normally
writes rows.

## Symptoms

- A job response outcome shows `"outcome": "failed"` with a message such as
  `Required fields did not resolve: monthlyPriceUsd, includedCreditsUsd. Page shape likely
  changed; nothing was written.`
- An `ingestion_runs` row has `status = 'failed'` and a non-null `error`.
- For news feeds: `Payload is neither an RSS nor an Atom feed.` or `HTTP 404 from <url>`.
- For the model source: `Artificial Analysis response did not match the expected envelope: ...`
- The Sources workspace shows the affected source as stale.

## Likely causes

| Cause | How to confirm quickly |
| --- | --- |
| The page or feed layout changed (harness pricing especially) | Fetch the URL and compare the text against the configured regex patterns |
| A vendor renamed a JSON field | Compare the live envelope against the adapter's Zod schema |
| The URL moved or was retired | `curl -I <url>` and check the status code |
| The response is now script-rendered HTML with no text | Fetch the page and look for whether the values are present as text |
| The site returned a bot-challenge page | The fetched body contains a challenge or interstitial, not the expected content |
| A feed returns valid XML but no items | Parse the payload and count entries |

## Immediate mitigation

Do not "fix" it by relaxing a required field: that writes nothing useful and hides the break.
Two safe options exist.

1. Disable the source so the run stops reporting failures:

```sql
update public.sources set enabled = false where id = '<source-id>';
```

Also set `enabled: false` for the same id in `src/lib/fixtures/sources.ts` so the code registry
agrees with the database.

2. Re-run a single source to confirm the failure is deterministic:

```bash
npm run jobs:run sync-harness-pricing --source=<source-id>
```

## Diagnosis

```bash
# Confirm the raw payload shape
curl -sL '<source-url>' | head -c 2000
```

For harness pages:

1. Read the configuration for the source in `src/lib/ingestion/harness-configs.ts`.
2. Convert the fetched page to plain text the same way the adapter does
   (`toPlainTextSafe`), then test each `pattern` against it.
3. Identify which required field no longer matches.

For feeds:

1. Confirm the root element. The parser accepts an RSS channel or an Atom feed; anything else
   yields `kind: "unknown"` and a `parse` failure.
2. Check whether items carry a `<link>` and a `<title>`; entries missing either are skipped, not
   failed.

For the model API:

1. Confirm the envelope contains `data` or `models`.
2. Confirm the field names against `artificialAnalysisModelSchema` and the field map in
   `docs/04-data/artificial-analysis-field-map.md`.

## Fix

1. Update the extractor or schema:

| Breakage | Fix location |
| --- | --- |
| Harness page selectors | `HARNESS_PAGE_CONFIGS` in `src/lib/ingestion/harness-configs.ts`; bump `configVersion` |
| Feed shape | `parseFeed` in `src/lib/adapters/rss.ts` |
| Model envelope or fields | `src/lib/adapters/artificial-analysis.ts` (schema and `mapArtificialAnalysisModel`) |
| Social or world envelope | `src/lib/adapters/social.ts`, `src/lib/adapters/world.ts` |

2. Add or update a fixture so the new shape is covered by a test, then run:

```bash
npm run test -- tests/unit/adapters.test.ts
```

3. Restore the source:

```sql
update public.sources set enabled = true where id = '<source-id>';
```

4. Run the job again and confirm `outcome: "ok"` with a non-zero `items_written`:

```bash
npm run jobs:run sync-harness-pricing --source=<source-id>
```

## Verification

- [ ] The job response reports `ok` for the source
- [ ] `items_written` is greater than zero, or the run legitimately found no new items
- [ ] A new `ingestion_runs` row has `status = 'success'` and `error is null`
- [ ] The unit test for the new shape passes
- [ ] The Sources workspace no longer marks the source as failing

## Prevention

- Harness configurations are versioned and require at least one required field per plan
  (`tests/unit/adapters.test.ts` asserts this). When a page changes, bump `configVersion`.
- The raw page hash is stored on every snapshot, so a silent page change is detectable by
  comparing consecutive hashes.
- Feeds fail loudly on a non-feed payload rather than returning an empty success.
- Backlog H3 notes that `html` news sources (`anthropic-news`) have no adapter at all, so they
  report `deferred` rather than failing; do not mistake that for parser breakage.

## Related

- Known issues: KI-6 (`html` news sources have no adapter)
- Files: `src/lib/ingestion/harness-configs.ts`, `src/lib/adapters/rss.ts`,
  `src/lib/adapters/artificial-analysis.ts`, `src/lib/ingestion/runner.ts`
- Reference: `docs/04-data/artificial-analysis-field-map.md`,
  `docs/04-data/source-catalog.md`
