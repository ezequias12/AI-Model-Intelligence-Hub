# Runbook: bad source payload

**Severity:** medium to high (a hostile or malformed upstream payload reaches the ingestion
path)
**Typical signal:** a spike in `skipped` items; a schema failure; a row-validation failure log;
unexpected text or entities stored from a source; a feed that returns an unexpected payload type.

## Symptoms

- A job outcome reports `failed` with a `schema` code, or `ok` with an unusually high `skipped`.
- Server logs contain `[supabase] row failed validation in "<table>"`.
- Stored text contains markup that should have been stripped, or an entity list is absurdly
  large.
- A feed that normally parses returns `Payload is neither an RSS nor an Atom feed.`
- A world news item arrives with a summary that the neutrality gate drops (the drop reason is
  recorded).

## What the system already defends against

| Defence | Behaviour |
| --- | --- |
| Zod validation per boundary | A payload that does not match the envelope returns a `schema` failure; unmappable rows are counted in `skipped` and dropped |
| Plain-text reduction | `toPlainText()` decodes entities, removes `<script>`, `<style>` and all tags, and collapses whitespace before anything is stored or displayed |
| No HTML rendering of source markup | The UI renders stored strings as text; source markup is never injected |
| Excerpt caps | Feed summaries are truncated at 320 characters; social post text at 600 |
| Entity extraction is conservative | Only `@handle`, `#tag` and exact known entity names are extracted, and only in the social adapter |
| Neutrality gate | A non-neutral world summary is dropped while the attributable item is kept |
| Required-field gate | Harness extraction fails rather than writing a wrong or zero price |
| Dedupe | Canonical URL plus content hash prevents payload-driven duplication |

## Likely causes

| Cause | How to confirm quickly |
| --- | --- |
| The vendor changed field types or semantics | Compare the live payload against the adapter's Zod schema |
| A field that was a number is now a string (or vice versa) | `asNumber` accepts numeric strings; a non-numeric string becomes `null`, so a value silently disappears rather than erroring |
| The feed is now a JSON API or a challenge page | Fetch the payload and inspect the first bytes |
| An adversarial or spam entry in a feed | Look for extreme lengths, unusual characters or an unexpected link host |
| A very large page | Harness extraction reads the whole page; a redirect to a large index could match unintended text |
| Character encoding issues | The decoded text contains replacement characters or mojibake |

## Immediate mitigation

1. Identify the scope before changing anything:

```sql
-- Items written by the affected source, newest first
select id, title, url, source_id, discovered_at, length(coalesce(excerpt,'')) as excerpt_len
from public.news_items
where source_id = '<source-id>'
order by discovered_at desc
limit 50;
```

2. Stop the bleeding by disabling the source so it stops writing:

```sql
update public.sources set enabled = false where id = '<source-id>';
```

3. Remove offending rows if they are clearly invalid. Delete narrowly, by id, and prefer
   disabling over deleting while you are still diagnosing:

```sql
delete from public.news_items where id in ('<id>', '<id>');
```

## Diagnosis

```bash
# Inspect the raw payload
curl -sL '<source-url>' | head -c 4000
```

Then:

1. Validate the payload against the adapter schema by extracting the mapping into a scratch test
   (a temporary file under the session scratchpad, not the repository).
2. Check `skipped` in the newest run: a high `skipped` with `ok: true` means rows were dropped by
   design, which is usually correct, while a `schema` failure means the envelope itself is wrong.
3. For a row-validation failure, read the logged Zod error: it names the table and the failing
   field. Note that the repository logs and skips the row, so one bad row does not blank a page.
4. For encoding problems, confirm the HTTP `content-type` charset and whether the body declares a
   different encoding.

## Fix

| Situation | Action |
| --- | --- |
| Envelope change | Update the adapter schema and mapping; add a fixture; run the adapter test |
| Field type change | Update `asNumber` usage or the schema; confirm the field is not now a nested object that needs `pickEvaluation`-style handling |
| New payload type | Add an adapter for the type (for example an `html` news index, backlog H3) or disable the source |
| Text that should have been stripped | Check the parser path; `toPlainText` is the single normalizer and should cover it |
| Adversarial entry | The size caps and required-field gates handle most cases; if not, add an explicit guard in the adapter |
| Wrong price extracted | Treat as parser breakage: the required-field gate should have failed. Fix the pattern and bump `configVersion`. |

Restore the source when the fix is verified:

```sql
update public.sources set enabled = true where id = '<source-id>';
```

## Verification

- [ ] A re-run reports `ok` with a `skipped` count you can explain
- [ ] Stored rows for the source validate against the row schemas (no new validation log lines)
- [ ] Sample rows render as plain text with a sensible excerpt length
- [ ] For world items, no summary violates the neutrality gate

## Prevention

- Adapter schemas use `.passthrough()` where a vendor may add fields, so an addition does not
  break ingestion, while a missing field becomes `null` rather than a fabricated value.
- Feeds fail loudly on a non-feed payload instead of returning an empty success.
- Harness extraction requires declared fields, so a silently wrong price is not written.
- Row schemas catch drift at the database boundary and log it.
- Not implemented: raw payload capture into `private.raw_ingestion_payloads`. The table and a
  retention index exist, nothing writes to it, and no cleanup deletes from it. Had it existed,
  this runbook's diagnosis step would start from the stored sanitized payload instead of
  re-fetching the source.
- Not implemented: a validation-failure counter, so failures are log lines rather than a figure
  you can watch.

## Related

- Known issues: KI-3 (`payloadHash` documented as sha256), KI-4, KI-5
- Files: `src/lib/adapters/rss.ts`, `src/lib/adapters/{artificial-analysis,social,world,harness-html}.ts`,
  `src/lib/db/rows.ts`, `src/lib/data/supabase-repository.ts`,
  `supabase/migrations/20260918000300_sources_and_ingestion.sql`
- Reference: `docs/01-architecture/security-architecture.md`, `docs/04-data/data-quality.md`
