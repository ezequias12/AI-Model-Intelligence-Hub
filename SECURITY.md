# Security

## Reporting a vulnerability

This repository has no published security contact yet. Until the owner sets one,
report issues privately to the repository owner rather than opening a public issue
that includes exploit details, credentials or personal data.

Do not include real secrets in a report. Reference the variable name instead.

## Secret handling model

The rule is simple: **every secret is server-only, and the service-role key never
reaches the browser.**

| Variable | Where it is read | Exposure |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/data/supabase-repository.ts`, `src/lib/ingestion/writer.ts` | Server-only. Bypasses RLS. Never prefixed `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/data/supabase-repository.ts`, `src/lib/data/mode.ts` | Public by design; an endpoint URL is not a secret. |
| `ARTIFICIAL_ANALYSIS_API_KEY` | `src/lib/adapters/artificial-analysis.ts` | Server-only. |
| `QSTASH_TOKEN` | `scripts/jobs/create-schedules.mjs` | Server-only operational secret. |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | `src/lib/jobs/verify.ts` | Server-only. Used to verify inbound triggers. |
| `X_BEARER_TOKEN` | `src/lib/adapters/social.ts` | Server-only. |
| `WORLD_NEWS_API_KEY` | `src/lib/adapters/world.ts` | Server-only. |
| `LLM_SUMMARY_API_KEY` | Reported by `src/lib/data/mode.ts` only | Server-only. No client is implemented yet. |

Rules that follow from this:

1. No secret is read from a `NEXT_PUBLIC_` variable, because `NEXT_PUBLIC_` values
   are inlined into the client bundle at build time.
2. `.env.example` contains names and comments only, never values.
3. `.env`, `.env*.local` and `.env.production` are git-ignored. Committing a real
   key is a defect that must be treated as a leaked secret and rotated.
4. Secrets are never persisted to Engram, logs, fixtures or documentation.

## Database access model

The full model is documented in the header of
`supabase/migrations/20260918000500_indexes_and_rls.sql`. Summary:

- Every table in the `public` schema has row level security enabled.
- The `anon` and `authenticated` roles receive a `SELECT`-only policy
  (`using (true)`) on published content tables. There is no insert, update or
  delete policy for those roles, so writes are denied by default.
- Writes happen only through the server-side service role used by the ingestion
  pipeline.
- `public.watchlists` and `public.watchlist_items` are owner-scoped:
  `authenticated` users may only touch rows where `owner_id = auth.uid()`. Anonymous
  visitors are expected to use local storage; the shipped Watchlists screen does
  exactly that.
- The `private` schema holds raw ingestion payloads and operational artefacts. It is
  revoked from `anon` and `authenticated` entirely and granted only to
  `service_role`.
- `private.raw_ingestion_payloads` is intended to store sanitized source payloads for
  debugging parser breakage, with a `retained_until` retention column and a
  `raw_payloads_retention_idx` index. No code writes to it yet, and retention
  deletion is not implemented (see `docs/05-operations/runbooks/bad-source-payload.md`).

## Application-level protections

- `src/lib/jobs/verify.ts` verifies the Upstash signature on every inbound job
  request using `@upstash/qstash` `Receiver`. Without signing keys the endpoint
  refuses to run when `NEXT_PUBLIC_DATA_MODE=live`; the unverified path is allowed
  only in mock mode.
- `src/lib/adapters/types.ts` defines a single error envelope with a `code` field
  that distinguishes `not_configured`, `rate_limited`, `parse`, `schema` and
  `network`. A missing credential is never reported as a success.
- `src/lib/db/rows.ts` validates every database row with Zod before it becomes a
  domain object, so schema drift surfaces as a logged validation failure instead of
  a malformed object reaching the UI.
- `src/lib/services` does not exist; there is no user authentication, no file
  upload, no arbitrary server-side fetch from user input and no HTML rendering of
  source-provided markup. Source text is converted to plain text before storage or
  display (`src/lib/adapters/rss.ts`, `toPlainText`).
- The app sets `robots: { index: false, follow: false }` in `src/app/layout.tsx`
  because it is an internal-quality portal.

## Outbound network behaviour

- All outbound HTTP goes through `HttpClient` (`src/lib/adapters/http.ts`), which
  enforces a request cap, honours `Retry-After` on 429, retries 5xx with exponential
  backoff and refuses to issue a request when the reported quota remaining is below
  a required minimum (`QuotaGuardError`).
- Artificial Analysis is never scraped to bypass quota.
- X/Twitter HTML is never scraped as a foundation; the social adapter issues no
  request at all without a bearer token.

## Not implemented

These are gaps, not endorsements:

- No rate limiting on the Next.js routes themselves.
- No Content Security Policy or security headers are configured in
  `next.config.ts`.
- No dependency scanning or CI security job exists (there is no CI workflow).
- No authentication for the application UI; access control is expected to come from
  deployment-level protection (for example Vercel Authentication or a trusted
  network).
- No alerting on `not_configured` or failing sources beyond the in-app Sources view.
