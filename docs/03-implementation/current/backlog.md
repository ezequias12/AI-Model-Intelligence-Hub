# Backlog

Ordered next work, highest value first. Each item states the concrete outcome and the
files involved, so it can be started without re-deriving context.

The first section is blocked on credentials or live pages; the rest is unblocked.

## Blocked on credentials or live pages

| # | Item | Outcome | Files |
| --- | --- | --- | --- |
| B2 | Apply the migrations and generate Supabase types | Replace the hand-shaped client cast with generated types | `supabase/migrations/**`, `npm run db:gen-types`, `src/lib/data/supabase-repository.ts` |
| B3 | Verify harness pricing selectors against the current pages | Either confirm `configVersion` `2026.09.1` or bump it and fix the patterns; add a captured fixture per page | `src/lib/ingestion/harness-configs.ts`, `tests/unit/adapters.test.ts` |
| B4 | Create the QStash schedules and confirm signature verification end to end | One successful scheduled run per job recorded in `ingestion_runs` | `scripts/jobs/create-schedules.mjs`, `src/lib/jobs/verify.ts` |
| B6 | Verify the world news provider envelope | Confirm `items` / `next_cursor` and the region and country-code fields | `src/lib/adapters/world.ts` |

## Unblocked, high value

| # | Item | Outcome | Files |
| --- | --- | --- | --- |
| H3 | Add an HTML news-index adapter | Sources registered as `type: "html"` (for example `anthropic-news`) currently report `deferred` | `src/lib/adapters/` (new module), `src/lib/ingestion/runner.ts` |
| H4 | Populate `providerIds` and `entities` for ingested news | Provider filtering and entity chips work outside mock mode | `src/lib/ingestion/runner.ts` (pass `providerSlugs`), entity extraction from `src/lib/adapters/social.ts` |
| H5 | Derive news categories from content | Ingested news is currently always `other` (or `research`) | `src/lib/ingestion/runner.ts`, new classifier |
| H6 | Implement raw payload capture with sanitization and retention | `private.raw_ingestion_payloads` becomes useful for debugging parser breakage | `src/lib/ingestion/writer.ts`, new maintenance SQL |
| H7 | Implement the retention cleanup query | Make `cleanup-raw-ingestion` actually delete expired rows | `src/lib/ingestion/runner.ts`, new migration or SQL file |
| H10 | Add component tests | axe is now automated; Testing Library is still installed but unused | `tests/**` |

## Recently completed

| # | Item | Evidence |
| --- | --- | --- |
| B1 | Verify the Artificial Analysis response shape and pagination against the live API | `src/lib/adapters/artificial-analysis.ts` (endpoint `/data/llms/models`, nested `evaluations.*`, single-shot when no pagination), contract test built on a captured real response |
| H1 | Add a persisted seed for harness products and plans | `supabase/migrations/20260918000700_seed_harness_catalog.sql` |
| H2 | Persist change events from diffs | `src/lib/ingestion/change-events.ts`, wired in `src/lib/ingestion/runner.ts` |
| KI-7 | Seed monitored social accounts | `supabase/migrations/20260918000800_seed_monitored_social_accounts.sql` |
| M1 | Fix the quota-guard error classification | `isDeferralError` in `src/lib/adapters/http.ts`; runner records a `rate_limited` run |
| H8 | Add a CI workflow | `.github/workflows/ci.yml` (`quality` and `e2e` jobs) |
| H9 | Add Playwright E2E specs | `tests/e2e/**` covering shell, models, news, harness, world/system and accessibility fundamentals |
| H10 | Add automated accessibility auditing with axe (second half of H10) | `tests/e2e/axe.spec.ts`, `@axe-core/playwright` |
| — | Model garden: OpenRouter breadth + context window, Hugging Face popularity, field-precedence merge | `src/lib/adapters/{openrouter,huggingface}.ts`, `src/lib/ingestion/merge-models.ts` (ADR-0009) |
| — | Community Pulse: Bluesky + Hacker News replace X | `src/lib/adapters/{bluesky,hackernews,entities}.ts` (ADR-0009) |
| — | News + World via GDELT (free, key-less) | `src/lib/adapters/gdelt.ts` (ADR-0009) |
| KI-19 | Curated provider registry seeded; the merge preserves it | `supabase/migrations/20260918001200_seed_provider_registry.sql` |

## Unblocked, medium value

| # | Item | Outcome | Files |
| --- | --- | --- | --- |
| M2 | Correct the `payloadHash` comment | It says `sha256`; the implementation is a 16-character FNV-1a hash | `src/lib/domain/schema.ts`, `src/lib/domain/hash.ts` |
| M3 | Remove or use dead exports | `previousSnapshot()` in fixtures and `signingKeysConfigured()` in verify are unused | `src/lib/fixtures/snapshots.ts`, `src/lib/jobs/verify.ts` |
| M4 | Distinguish `null` capability from below-threshold in rankings | Models with `null` intelligence are currently kept by the capability gate | `src/lib/analytics/index.ts` |
| M5 | Add `harness_plan_snapshots` retention or partitioning | Snapshot storage currently grows unbounded | new migration |
| M6 | Add structured JSON logging behind `LOG_LEVEL` | `LOG_LEVEL` is declared in `.env.example` but read nowhere | new logging module, `src/lib/**` |
| M7 | Wire `NEXT_PUBLIC_SITE_URL` into metadata | It is declared but never read; canonical and Open Graph URLs are currently relative | `src/app/layout.tsx`, `src/app/**` metadata |
| M8 | Connect `NEXT_PUBLIC_SUPABASE_ANON_KEY` or remove it | It is declared but no code path reads it | `.env.example`, `src/lib/data/supabase-repository.ts` |
| M9 | Add security headers / CSP | Currently no custom headers are set | `next.config.ts` |
| M10 | Add harness CSV export | Model table has CSV export; the harness plan board does not | `src/features/harness/plan-board.tsx` |
| M11 | Store watchlists in Supabase for authenticated users | The owner-scoped RLS policies already exist and are unused | `src/features/watchlists/watchlist-manager.tsx`, auth layer |
| M12 | Add an LLM summariser behind `LLM_SUMMARY_API_KEY` | News summaries stay `null` without it; must be structured, attributed and optional | new adapter, `src/lib/ingestion/runner.ts` |

## Unblocked, lower value

| # | Item | Outcome |
| --- | --- | --- |
| L1 | Add per-model comparison export | Export the current comparison as a table |
| L2 | Add cross-domain search (AI news plus world news) | One query across both tables |
| L3 | Add a sources "retry now" control | Trigger a single source without waiting for cron |
| L4 | Add an in-app alert when a source is `not_configured` or failing repeatedly | Surface the state without opening the Sources page |
| L5 | Extend `news_entities` usage | Populate entity rows and use them for trending entities server-side |
| L6 | Add a `benchmark_definitions` ingestion path | The tables exist and are unused |
| L7 | Tune the default Artificial Analysis page size | Current defaults (100 per page, max 20 pages) are an assumption |
| L8 | Add a public roadmap page in the app | Mirror `docs/07-product/roadmap.md` |
