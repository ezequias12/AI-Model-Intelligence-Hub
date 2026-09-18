# Security architecture

The full policy statement for contributors is `SECURITY.md` at the repository root.
This document explains the architecture behind it.

## Threat model

| Asset | Threat | Control |
| --- | --- | --- |
| Service-role key | Leaking to the browser bundle | Read only from `SUPABASE_SERVICE_ROLE_KEY`, never a `NEXT_PUBLIC_` variable; only used in `src/lib/data/supabase-repository.ts` and `src/lib/ingestion/writer.ts` |
| Source API keys | Leaking via logs, fixtures or commits | Server-only reads inside adapters; `.env*.local` is git-ignored; `.env.example` holds names only |
| Database contents | Unauthorised writes from a client | RLS enabled on every `public` table; read-only policies for `anon`/`authenticated`; no write policy for those roles |
| Raw source payloads | Exposure to the browser | `private` schema revoked from `anon`/`authenticated`; reserved for server-side debugging |
| Inbound job triggers | Forged requests causing quota burn or writes | Upstash signature verification before any work; unverified path only in mock mode |
| Upstream payloads | Malformed or hostile input reaching the UI | Zod validation at every boundary; source text reduced to plain text; no HTML rendering of source markup |
| Outbound quota | A single source exhausting its allowance | `HttpClient` quota guard, request cap, backoff |

## Secret handling

| Variable | Read at | Server-only | Notes |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/data/supabase-repository.ts`, `src/lib/ingestion/writer.ts` | Yes | Bypasses RLS. Used by the writer and by reads in live mode. |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/data/supabase-repository.ts`, `src/lib/data/mode.ts` | No (public by design) | An endpoint URL is not a secret. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Nowhere in code | No | Declared in `.env.example` but not read. Client reads use the service role today. |
| `ARTIFICIAL_ANALYSIS_API_KEY` | `src/lib/adapters/artificial-analysis.ts` | Yes | Sent as the `x-api-key` header. |
| `ARTIFICIAL_ANALYSIS_BASE_URL` | `src/lib/adapters/artificial-analysis.ts` | Yes | Defaults to `https://artificialanalysis.ai/api/v2`. |
| `QSTASH_TOKEN` | `scripts/jobs/create-schedules.mjs` | Yes | Scheduling only; never used at runtime. |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | `src/lib/jobs/verify.ts` | Yes | Receiver construction and verification. |
| `QSTASH_TARGET_BASE_URL` | `scripts/jobs/create-schedules.mjs` | Yes | Destination for schedule callbacks; not a secret but operationally sensitive. |
| `QSTASH_URL` | Nowhere in code | Yes | Declared in `.env.example`; the Upstash client uses its default endpoint. |
| `X_BEARER_TOKEN` | `src/lib/adapters/social.ts` | Yes | Bearer token for `api.x.com`. |
| `WORLD_NEWS_API_KEY` | `src/lib/adapters/world.ts` | Yes | Bearer token for the wire provider. |
| `WORLD_NEWS_BASE_URL` | `src/lib/adapters/world.ts` | Yes | Provider base URL; required alongside the key. |
| `LLM_SUMMARY_API_KEY`, `LLM_SUMMARY_MODEL` | Capability reporting only (`src/lib/data/mode.ts`) | Yes | No summariser client exists. |
| `NEXT_PUBLIC_DATA_MODE`, `NEXT_PUBLIC_SITE_URL`, `LOG_LEVEL` | `src/lib/data/mode.ts` for the mode; the others nowhere | No | Not secrets. `NEXT_PUBLIC_SITE_URL` and `LOG_LEVEL` are declared but not read. |

Rules:

1. No secret is read from a `NEXT_PUBLIC_` variable. Values with that prefix are
   inlined into the client bundle at build time.
2. Secrets never appear in fixtures, tests, documentation or Engram.
3. A committed secret must be treated as leaked and rotated, not just deleted.

## Database security model

Mirrored from the header comment of
`supabase/migrations/20260918000500_indexes_and_rls.sql`:

- Every table in `public` has RLS enabled.
- Anonymous and authenticated roles may only `SELECT` published content, through
  `{table}_public_read` policies with `using (true)`.
- There is no insert, update or delete policy for those roles, so writes are denied by
  default and can only happen through the service role used by the server-side
  ingestion pipeline.
- The `private` schema holds raw ingestion payloads and is not granted to anonymous or
  authenticated roles at all.
- Watchlists are owner-scoped so a future Supabase-backed preference store is safe by
  construction: `watchlists_owner_all` and `watchlist_items_owner_all` restrict all
  operations to `auth.uid()`.

Table-by-table detail, grants and the full index list are in
`docs/01-architecture/database-schema.md`.

One caveat worth stating plainly: `private.is_service_role()` is defined in the first
migration but is not referenced by any policy, so it is not currently an active control.
Write restriction relies on the absence of write policies plus the grant model, which is
the correct pattern regardless.

## Request verification

`src/lib/jobs/verify.ts`:

1. `createReceiver()` returns `null` unless both `QSTASH_CURRENT_SIGNING_KEY` and
   `QSTASH_NEXT_SIGNING_KEY` are set.
2. Without a receiver, the request is accepted only when
   `allowUnverifiedInMock` is set **and** `NEXT_PUBLIC_DATA_MODE !== "live"`. Otherwise
   the result is `{ ok: false, status: 500 }` with a message naming the two variables.
3. With a receiver, a missing `Upstash-Signature` header returns `401`, an invalid
   signature returns `401`, and a verification exception returns `401` with the error
   message.
4. `src/app/api/jobs/[job]/route.ts` passes `allowUnverifiedInMock: true`, so local
   development in mock mode works without signing keys while a live deployment refuses
   unauthenticated triggers.

## Input validation

| Boundary | Validation |
| --- | --- |
| Domain entities | Zod schemas in `src/lib/domain/schema.ts`; types inferred from them |
| Database rows | Zod schemas in `src/lib/db/rows.ts`, applied per row before mapping; an invalid row is logged and skipped rather than thrown |
| Adapter payloads | Zod schemas per adapter (for example `artificialAnalysisModelSchema.passthrough()`, `xTimelineResponseSchema`, `worldWireResponseSchema`) |
| Feed XML | A narrow, dependency-free parser that reports `unknown` for non-feed payloads instead of returning an empty success |
| Harness HTML | Regex extraction with a required-field gate; a page shape change fails the run |
| Source text | `toPlainText()` strips script/style/markup and entity-decodes before storage or display |

`.passthrough()` is used where a vendor may add fields, so an unknown extra field cannot
break ingestion. A missing field maps to `null`, never to a fabricated value.

## Immediate output-limit considerations

- The Artificial Analysis adapter caps pagination at `maxPages` (default 20) and page
  size at 100, so a pagination bug cannot loop forever.
- `HttpClient` caps requests per client instance.
- The social adapter caps accounts per run (`maxAccounts`).
- The world adapter caps pages (`maxPages`, default 10) and page size (50).
- The command palette index includes only the 60 most recent news items to bound the
  serialised payload.
- Snapshot history is capped at 12 snapshots per model for serialisation.

## Not implemented

- No security headers or Content Security Policy in `next.config.ts`.
- No rate limiting on the application routes themselves, including the job endpoint
  beyond signature verification.
- No application authentication or session handling; no role model in the UI.
- No audit log of administrative actions (there are no administrative actions).
- No dependency scanning, secret scanning or container scanning; the CI workflow
  (`.github/workflows/ci.yml`) runs `quality` and `e2e` jobs only, with no scanning job.
- No alerting when an integration is `not_configured` or a source starts failing; the
  only surface is the Sources workspace and `GET /api/health`.
- Raw payload capture is not implemented, so payload sanitization and retention are
  designed but not exercised.
