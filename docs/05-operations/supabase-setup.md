# Supabase setup

Persistence, snapshots, the ingestion ledger and change events live in Supabase Postgres. The
application never requires it: mock mode is the default. This guide covers applying the
migrations, verifying the security model and generating types.

The migrations in this repository have not been applied to a live project from this repository.
Treat every step below as unverified until you run it.

## 1. Create or select a project

Create a project in the Supabase dashboard, or use an existing one. Note the project ref and
the database password.

## 2. Set environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_DATA_MODE=live
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and must remain server-only. Never give it a
`NEXT_PUBLIC_` prefix.

## 3. Apply the migrations

Either with the CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

or by pasting each file from `supabase/migrations/` into the SQL editor, in filename order:

| Order | File | Creates |
| --- | --- | --- |
| 1 | `20260918000100_init_schema.sql` | `pgcrypto`, `pg_trgm`, the `private` schema, `private.set_updated_at()`, `private.is_service_role()` |
| 2 | `20260918000200_core_tables.sql` | `providers`, `models`, `model_snapshots`, `benchmark_definitions`, `model_benchmark_values`, two triggers |
| 3 | `20260918000300_sources_and_ingestion.sql` | `sources`, `ingestion_runs`, `change_events`, `private.raw_ingestion_payloads` |
| 4 | `20260918000400_news_social_harness_world.sql` | News, social, harness, world and watchlist tables, plus the harness-product foreign key on monitored accounts |
| 5 | `20260918000500_indexes_and_rls.sql` | Indexes, RLS policies, grants |
| 6 | `20260918000600_seed_source_registry.sql` | Seed rows for `public.sources` (upsert on `id`, safe to re-run) |
| 7 | `20260918000700_seed_harness_catalog.sql` | Seed rows for `public.harness_products` and `public.harness_plans` (upsert on `id`, safe to re-run) |
| 8 | `20260918000800_seed_monitored_social_accounts.sql` | Seed rows for `public.monitored_social_accounts` (upsert on `id`, safe to re-run) |

File order matters: later files add foreign keys and constraints to earlier tables.

## 4. Verify the schema

```sql
-- Tables
select table_schema, table_name
from information_schema.tables
where table_schema in ('public', 'private')
order by table_schema, table_name;

-- RLS should be enabled on every public table
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- Policies
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Seeded sources
select id, domain, type, enabled, priority, cadence_minutes from public.sources order by id;
```

Expected: 19 tables with RLS enabled in `public`, one table in `private`, `_public_read`
policies on the 17 published-content tables, `watchlists_owner_all` on `watchlists`, and
`watchlist_items_owner_all` on `watchlist_items`.

## 5. Verify the security model

As an anonymous client using the anon key:

1. `select` from `public.models` succeeds.
2. `insert` into `public.models` fails (no write policy exists).
3. `select` from `private.raw_ingestion_payloads` fails (the schema is revoked from `anon` and
   `authenticated`).

The second and third checks are the ones that matter. RLS is the only thing preventing a
client from writing, because the absence of a policy is what denies the write.

## 6. Generate types

```bash
npm run db:gen-types
```

This writes `src/lib/db/database.types.ts` using
`npx supabase gen types typescript --schema public --local`. The file is git-ignored from
Prettier and excluded from ESLint. Until it exists, the repository validates every row with the
Zod schemas in `src/lib/db/rows.ts`.

After generating the file, the hand-shaped client cast in
`src/lib/data/supabase-repository.ts` can be replaced with the generated types. That is
recorded as backlog item B2.

## 7. First data load

```bash
NEXT_PUBLIC_DATA_MODE=live npm run jobs:run sync-models
```

If `ARTIFICIAL_ANALYSIS_API_KEY` is not set, the run reports `not_configured` for that source
and writes nothing. If it is set, providers, models and snapshots are written and an
`ingestion_runs` row is recorded.

Confirm:

```sql
select count(*) from public.providers;
select count(*) from public.models;
select count(*) from public.model_snapshots;
select source_id, job_key, status, items_seen, items_written, started_at
from public.ingestion_runs order by started_at desc limit 20;
```

## 8. Known deployment gaps

| Gap | Consequence |
| --- | --- |
| Provider grouping is not curated for live providers | `sync-models` writes every provider with `group: "other"`, `region: null`. The Models provider-group filters have nothing to match (KI-19). |
| Nothing writes `private.raw_ingestion_payloads` | Raw payload capture is not implemented. |
| No retention job | Snapshot and payload tables grow without a cleanup step. |
| `private.is_service_role()` is unused by any policy | Write restriction relies on the absence of write policies, not on this helper. |

## 9. Useful queries

```sql
-- Newest snapshot per model with its change from the previous one
with ranked as (
  select model_id, captured_at, metrics,
         row_number() over (partition by model_id order by captured_at desc) as rn
  from public.model_snapshots
)
select model_id, captured_at, metrics
from ranked
where rn = 1
order by model_id;

-- Sources that have not reported a successful run recently
select s.id, s.name, max(r.started_at) as last_run, max(r.status) as last_status
from public.sources s
left join public.ingestion_runs r on r.source_id = s.id
group by s.id, s.name
order by last_run nulls first;

-- Rate-limited runs in the last day
select source_id, job_key, started_at, rate_limit_remaining, error
from public.ingestion_runs
where status = 'rate_limited' and started_at > now() - interval '1 day'
order by started_at desc;
```

## 10. Advisors

Run the Supabase security and performance advisors after applying the migrations. Anything the
advisors flag is not documented here; this repository has not run them. The expected findings
worth reviewing are the intentionally blank public read policies (`using (true)`) on published
content, which are correct for read-only data but will be reported as permissive.
