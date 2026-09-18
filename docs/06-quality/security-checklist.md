# Security checklist

A review checklist for changes to this repository. The model is documented in `SECURITY.md`
(root) and `docs/01-architecture/security-architecture.md`. Items marked
**NOT SATISFIED** are known gaps, not oversights.

## Secrets

- [ ] No secret is read from a `NEXT_PUBLIC_` variable. `NEXT_PUBLIC_` values are inlined into
      the client bundle.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is read only in server-side modules
      (`src/lib/data/supabase-repository.ts`, `src/lib/ingestion/writer.ts`).
- [ ] `.env.example` contains names and comments only; no values.
- [ ] No secret appears in a fixture, a test, a snapshot, documentation or Engram.
- [ ] `.env`, `.env*.local` and `.env.production` remain git-ignored.
- [ ] A newly committed secret is treated as leaked and rotated, not merely removed.

## Database

- [ ] Every new table has RLS enabled.
- [ ] A new published-content table gets a `SELECT`-only policy for `anon` and `authenticated`
      (mirroring the `do $$ ... _public_read ... $$` block in migration 0005).
- [ ] No insert, update or delete policy exists for `anon` or `authenticated` on sourced data.
- [ ] Owner-scoped tables (`watchlists`, `watchlist_items`) restrict all operations to
      `auth.uid()`.
- [ ] Raw payload storage goes into the `private` schema, and the schema stays revoked from
      `anon` and `authenticated`.
- [ ] New unique keys used for idempotency are actually unique constraints or unique indexes.
- [ ] New indexes have a named query pattern behind them; do not add speculative indexes.

## Inbound requests

- [ ] The job route verifies the Upstash signature before doing work.
- [ ] `allowUnverifiedInMock` is not widened, and the mock bypass still requires a non-live mode.
- [ ] Missing signing keys cause a refusal (HTTP 500) in live mode, not an acceptance.
- [ ] The job key is validated against the registry before dispatch.
- **NOT SATISFIED:** no rate limiting on application routes, including the job endpoint beyond
  signature verification.

## Outbound requests

- [ ] Adapters do not call `fetch` directly; all outbound HTTP goes through `HttpClient`.
- [ ] An adapter that needs a credential returns `not_configured` naming the variable, and
      issues **zero** requests without it.
- [ ] No scraping path exists for a source that publishes an API (specifically Artificial
      Analysis), and X HTML is never scraped.
- [ ] Pagination and request counts are capped.
- [ ] 429 handling honours `Retry-After`; the quota guard is respected.
- [ ] A new source records `attribution` and `licensingNote` in the registry before being
      enabled.

## Input validation

- [ ] Every new payload is parsed with Zod before use.
- [ ] Vendor-added fields do not break ingestion (`.passthrough()` where a vendor may evolve the
      shape), while missing fields become `null`.
- [ ] Source markup is reduced to plain text before storage or display; no source HTML is
      rendered, and no `dangerouslySetInnerHTML` is introduced for source content.
- [ ] A parser that cannot match its input fails loudly rather than writing a wrong or zero value.
- [ ] A new database column is reflected in `src/lib/db/rows.ts` in the same change as the
      migration.
- [ ] An invalid row is logged and skipped, never rendered.

## Output and rendering

- [ ] Unknown values render as an em dash, not as `0` or `N/A`.
- [ ] No fixture data is presented as live data; the mode banner and `repository.meta` reflect
      reality.
- [ ] Degraded live mode names the missing variables.
- [ ] Political content never reaches model or harness scoring.
- [ ] No sentiment, ideology or political-actor scoring is introduced.
- **NOT SATISFIED:** no Content Security Policy or custom security headers in `next.config.ts`.
  Confirm any new inline script is justified; the theme init script is currently the only one and
  it is deliberately inline to prevent a flash of the wrong theme.

## Authentication and authorisation

- [ ] No assumption is made that a request is authenticated. There is no auth layer at all.
- **NOT SATISFIED:** the UI has no authentication. Access control is expected from
  deployment-level protection; if the deployment is public, that is a real exposure.

## Dependencies and supply chain

- [ ] New dependencies are pinned to exact versions, matching the existing style in
      `package.json`.
- [ ] A new dependency does not duplicate an existing capability (the RSS parser and the hash
      functions are deliberately dependency-free).
- **NOT SATISFIED:** no dependency scanning, secret scanning or container scanning; the CI
  workflow (`.github/workflows/ci.yml`) runs `quality` and `e2e` jobs only, with no scanning job.

## Operations

- [ ] `/api/health` still reports `degraded` and `pendingCredentials` accurately.
- [ ] A new failure mode is visible in the Sources workspace or in the job response.
- [ ] Logs do not contain secrets or raw payload contents.
- [ ] Retention expectations are documented for any new stored payload.
- **NOT SATISFIED:** no alerting on `not_configured`, failing sources, or stale data.
- **NOT SATISFIED:** raw payload capture and retention deletion are not implemented, so payload
  sanitization and retention are designed but unexercised.

## Before a public deployment

1. Set a license (`LICENSE` is a placeholder and grants nothing).
2. Enable deployment protection or place the app behind a trusted network.
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is marked sensitive in the platform and never exposed.
4. Verify the migrations' RLS by attempting an anonymous write (it must fail) and by confirming
   the `private` schema is unreachable from a client role.
5. Review the third-party terms in `docs/04-data/attribution-and-licensing.md`.
6. Add security headers (backlog M9).
7. Add dependency and secret scanning to CI.

## Related

- `SECURITY.md` - policy statement and the RLS and secret-handling model
- `docs/01-architecture/security-architecture.md` - the architecture behind the controls
- `docs/01-architecture/database-schema.md` - tables, policies and grants
- `docs/03-implementation/current/known-issues.md` - defects, including KI-12 (a direct mode
  comparison in signature verification)
