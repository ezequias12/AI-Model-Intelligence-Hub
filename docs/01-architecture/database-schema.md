# Database schema

Derived from the SQL in `supabase/migrations/`. Nothing here is invented: every table,
column, constraint and index below appears in a migration file. Tables that exist in SQL
but are not used by application code are marked as such.

## Migrations

| File | Contents |
| --- | --- |
| `20260918000100_init_schema.sql` | Extensions (`pgcrypto`, `pg_trgm`), the `private` schema, `private.set_updated_at()`, `private.is_service_role()` |
| `20260918000200_core_tables.sql` | `providers`, `models`, `model_snapshots`, `benchmark_definitions`, `model_benchmark_values` + two `updated_at` triggers |
| `20260918000300_sources_and_ingestion.sql` | `sources`, `ingestion_runs`, `change_events`, `private.raw_ingestion_payloads` |
| `20260918000400_news_social_harness_world.sql` | `news_items`, `news_entities`, `monitored_social_accounts`, `social_posts`, `harness_products`, `harness_plans`, `harness_plan_snapshots`, `harness_change_events`, `world_news_items`, `watchlists`, `watchlist_items` |
| `20260918000500_indexes_and_rls.sql` | Indexes, row level security policies and grants |
| `20260918000600_seed_source_registry.sql` | Seed rows for `public.sources` (upsert on `id`) |

All types below are from the `public` schema unless prefixed `private.`.

## Tables

### public.providers

Columns: `id` text PK, `slug` text not null unique, `name` text not null, `domain` text,
`country_code` text, `region` text, `provider_group` text not null check in
(`mainstream_global`, `china_based`, `other`), `logo_url` text, `color` text, `active`
boolean not null default true, `source_id` text, `updated_at` timestamptz not null
default now(), `created_at` timestamptz not null default now().

Note: `provider_group` is commented in SQL as "Geographic/structural classification
only. Never a quality judgement."

### public.models

Columns: `id` text PK, `slug` text not null unique, `name` text not null, `short_name`
text not null, `provider_id` text not null references `providers(id)` on delete
restrict, `release_date` timestamptz, `deprecated_at` timestamptz, `open_weight` boolean
not null default false, `description` text, `official_url` text, `source_id` text,
`source_version` text, `last_refreshed_at` timestamptz, `intelligence` numeric, `coding`
numeric, `agentic` numeric, `math` numeric, `output_speed_tps` numeric, `ttft_seconds`
numeric, `input_price_per_million` numeric, `output_price_per_million` numeric,
`cache_read_price_per_million` numeric, `cache_write_price_per_million` numeric,
`context_window` bigint, `created_at` timestamptz not null default now(), `updated_at`
timestamptz not null default now().

Note: this table holds the latest known state only; history lives in
`model_snapshots`.

### public.model_snapshots

Columns: `id` text PK, `model_id` text not null references `models(id)` on delete
cascade, `captured_at` timestamptz not null, `metrics` jsonb not null, `source_id` text
not null, `source_version` text, `payload_hash` text not null, `created_at` timestamptz
not null default now(), and `unique (model_id, captured_at, payload_hash)`.

Note: `payload_hash` is documented as the deterministic hash of the normalized payload,
used for idempotency and change detection.

### public.benchmark_definitions

Columns: `id` text PK, `key` text not null unique, `name` text not null, `description`
text, `unit` text, `direction` text not null check in (`higher`, `lower`), `category`
text not null check in (`capability`, `performance`, `cost`, `safety`, `other`),
`weights` jsonb not null default `'{}'`, `created_at` timestamptz not null default now().

Status: table exists; no application code reads or writes it.

### public.model_benchmark_values

Columns: `model_id` text not null references `models(id)` on delete cascade,
`benchmark_id` text not null references `benchmark_definitions(id)` on delete cascade,
`value` numeric not null, `source_id` text not null, `captured_at` timestamptz not null,
primary key (`model_id`, `benchmark_id`, `captured_at`).

Status: table exists; no application code reads or writes it.

### public.sources

Columns: `id` text PK, `domain` text not null check in (`models`, `ai_news`,
`provider_news`, `research`, `social`, `harness`, `world_politics`, `internal`), `name`
text not null, `type` text not null check in (`api`, `rss`, `atom`, `json`, `html`,
`official_pricing`, `official_docs`, `official_site`, `official_changelog`,
`github_releases`, `social_api`, `manual`), `url` text not null, `enabled` boolean not
null default true, `priority` integer not null default 3 check between 1 and 5,
`cadence_minutes` integer check (`null` or `> 0`), `attribution` text,
`licensing_note` text, `notes` text, `created_at` timestamptz not null default now(),
`updated_at` timestamptz not null default now().

### public.ingestion_runs

Columns: `id` text PK, `source_id` text not null references `sources(id)` on delete
cascade, `job_key` text not null, `status` text not null check in (`running`,
`success`, `partial`, `failed`, `skipped`, `rate_limited`), `started_at` timestamptz not
null, `finished_at` timestamptz, `items_seen` integer not null default 0, `items_written`
integer not null default 0, `items_skipped` integer not null default 0,
`rate_limit_remaining` integer, `rate_limit_reset_at` timestamptz, `error` text,
`idempotency_key` text, `created_at` timestamptz not null default now().

Note: the runner writes `success`, `partial` or `failed`. The `running`, `skipped` and
`rate_limited` values are permitted by the constraint and used by fixture data.

### public.change_events

Columns: `id` text PK, `entity` text not null check in (`model`, `harness_plan`,
`source`, `news`), `entity_id` text not null, `event_type` text not null, `observed_at`
timestamptz not null, `significance` text not null check in (`low`, `medium`, `high`),
`before_json` jsonb, `after_json` jsonb, `source_id` text, `summary` text not null,
`created_at` timestamptz not null default now().

### private.raw_ingestion_payloads

Columns: `id` text PK, `source_id` text not null, `captured_at` timestamptz not null,
`response_hash` text not null, `sanitized_payload` jsonb not null, `retained_until`
timestamptz not null, `created_at` timestamptz not null default now().

Note: commented in SQL as "Sanitized raw source payloads for debugging parser breakage.
Never exposed to the browser." Nothing writes to this table yet, and no cleanup deletes
from it.

### public.news_items

Columns: `id` text PK, `domain` text not null check in (`ai_general`, `provider`,
`social`, `research`, `harness`, `world_politics`), `category` text not null check in
(`model_release`, `pricing`, `benchmark`, `research`, `developer`, `product`,
`infrastructure`, `funding`, `acquisition`, `regulation`, `election`, `geopolitics`,
`economy`, `conflict`, `diplomacy`, `other`), `title` text not null, `url` text not
null, `canonical_url` text not null, `source_id` text not null references `sources(id)`
on delete cascade, `source_name` text not null, `trust_tier` smallint not null check
between 1 and 3, `published_at` timestamptz, `discovered_at` timestamptz not null
default now(), `excerpt` text, `summary` text, `entities` text[] not null default `'{}'`,
`provider_ids` text[] not null default `'{}'`, `official` boolean not null default
false, `corroborated` boolean not null default false, `developing` boolean not null
default false, `content_hash` text not null, `cluster_id` text, `created_at` timestamptz
not null default now().

Notes: `excerpt` is documented as "Short permitted excerpt only. Full articles are
never mirrored." `trust_tier` is documented as "1 = official/primary, 2 = established
reporting, 3 = social or uncorroborated. Never a viewpoint." `summary` is always `null`
from the ingestion path because no summariser is implemented.

### public.news_entities

Columns: `id` text PK, `name` text not null, `kind` text not null check in (`company`,
`model`, `person`, `benchmark`, `country`, `other`), `slug` text not null unique,
`created_at` timestamptz not null default now().

Status: table exists; entities are currently stored as a text array on `news_items`,
and nothing writes rows to `news_entities`.

### public.monitored_social_accounts

Columns: `id` text PK, `handle` text not null, `display_name` text not null, `platform`
text not null check in (`x`, `linkedin`, `youtube`, `blog`, `reddit`), `account_category`
text not null check in (`model_provider`, `executive_researcher`, `benchmark_org`,
`coding_harness`, `coding_harness_founder`, `other`), `provider_id` text references
`providers(id)` on delete set null, `harness_product_id` text (FK added in migration
0004 referencing `harness_products(id)` on delete set null), `enabled` boolean not null
default true, `created_at` timestamptz not null default now(), `unique (platform,
handle)`.

### public.social_posts

Columns: `id` text PK, `account_id` text not null references
`monitored_social_accounts(id)` on delete cascade, `handle` text not null, `display_name`
text not null, `platform` text not null check in (`x`, `linkedin`, `youtube`, `blog`,
`reddit`), `post_id` text not null, `url` text not null, `text` text not null,
`published_at` timestamptz not null, `metrics_json` jsonb, `entities` text[] not null
default `'{}'`, `corroborated` boolean not null default false, `created_at` timestamptz
not null default now(), `unique (platform, post_id)`.

Note: commented as "Populated exclusively from authorized APIs. X HTML is never scraped
as the foundation."

### public.harness_products

Columns: `id` text PK, `name` text not null, `slug` text not null unique, `vendor` text
not null, `website` text not null, `docs_url` text, `pricing_url` text, `changelog_url`
text, `open_source` boolean not null default false, `repo_url` text, `platforms` text[]
not null default `'{}'`, `active` boolean not null default true, `created_at` timestamptz
not null default now(), `updated_at` timestamptz not null default now().

### public.harness_plans

Columns: `id` text PK, `product_id` text not null references `harness_products(id)` on
delete cascade, `canonical_plan_key` text not null unique, `name` text not null, `active`
boolean not null default true, `created_at` timestamptz not null default now().

Note: `canonical_plan_key` is commented as "Stable key so a plan rename does not fork
its history."

### public.harness_plan_snapshots

Columns: `id` text PK, `plan_id` text not null references `harness_plans(id)` on delete
cascade, `captured_at` timestamptz not null, `monthly_price_usd` numeric,
`annual_price_usd` numeric, `included_credits_usd` numeric, `estimated_requests` integer,
`estimated_requests_source_url` text, `reset_period` text not null check in (`daily`,
`weekly`, `monthly`, `rolling_5h`, `none`), `overage_model` text not null check in
(`hard_cap`, `pay_as_you_go`, `throttle`, `unknown`), `byok` boolean not null default
false, `models_json` text[] not null default `'{}'`, `frontier_model_access` boolean not
null default false, `platforms_json` text[] not null default `'{}'`, `regions_json`
text[] not null default `'{}'`, `notes` text, `source_id` text not null references
`sources(id)` on delete cascade, `source_url` text not null, `raw_source_hash` text not
null, `created_at` timestamptz not null default now(), `unique (plan_id, captured_at,
raw_source_hash)`.

Note: `estimated_requests` is commented as "Only ever populated when the vendor
documents it. Never inferred."

### public.harness_change_events

Columns: `id` text PK, `plan_id` text not null references `harness_plans(id)` on delete
cascade, `product_id` text not null references `harness_products(id)` on delete cascade,
`event_type` text not null check in (`plan_created`, `plan_removed`, `price_changed`,
`credits_changed`, `model_added`, `model_removed`, `limit_changed`, `cli_release`,
`feature_added`, `promotion_started`, `promotion_ended`), `before_json` jsonb,
`after_json` jsonb, `observed_at` timestamptz not null, `significance` text not null
check in (`low`, `medium`, `high`), `source_id` text not null references `sources(id)` on
delete cascade, `summary` text not null, `created_at` timestamptz not null default now().

### public.world_news_items

Columns: `id` text PK, `region` text not null check in (`argentina`, `united_states`,
`latin_america`, `world`, `economy`, `regulation`, `geopolitics`, `elections`,
`conflict_diplomacy`), `category` text not null check in the same 16-value list as
`news_items`, `headline` text not null, `summary` text, `source_id` text not null
references `sources(id)` on delete cascade, `source_name` text not null, `trust_tier`
smallint not null check between 1 and 3, `url` text not null, `canonical_url` text not
null, `primary_source_url` text, `published_at` timestamptz, `event_at` timestamptz,
`discovered_at` timestamptz not null default now(), `country_codes` text[] not null
default `'{}'`, `multiple_accounts` boolean not null default false, `developing` boolean
not null default false, `content_hash` text not null, `created_at` timestamptz not null
default now(), `unique (source_id, canonical_url)`.

Notes: the table is commented as "Separate editorial domain. Never read by model or
harness scoring code, and never used for user profiling." `multiple_accounts` is
commented as "True when sources disagree. The UI must show the sources, never a
synthesized verdict."

### public.watchlists

Columns: `id` text PK, `owner_id` uuid, `name` text not null, `created_at` timestamptz
not null default now(), `updated_at` timestamptz not null default now().

### public.watchlist_items

Columns: `id` text PK, `watchlist_id` text not null references `watchlists(id)` on
delete cascade, `kind` text not null check in (`model`, `provider`, `harness_product`,
`topic`, `news_query`), `ref_id` text not null, `label` text not null, `added_at`
timestamptz not null default now().

## Unique indexes and constraints used for idempotency

| Object | Key | Purpose |
| --- | --- | --- |
| `ingestion_runs_idempotency_key_idx` (unique, partial `where idempotency_key is not null`) | `idempotency_key` | A retry with the same key must not duplicate the run |
| `model_snapshots` unique constraint | `(model_id, captured_at, payload_hash)` | Snapshot upsert target |
| `harness_plan_snapshots` unique constraint | `(plan_id, captured_at, raw_source_hash)` | Plan snapshot upsert target |
| `news_items_source_canonical_idx` (unique) | `(source_id, canonical_url)` | News dedupe and upsert target |
| `world_news_items` unique constraint | `(source_id, canonical_url)` | World dedupe and upsert target |
| `social_posts` unique constraint | `(platform, post_id)` | Post dedupe and upsert target |
| `monitored_social_accounts` unique constraint | `(platform, handle)` | Account identity |
| `providers.slug`, `models.slug`, `harness_products.slug`, `benchmark_definitions.key`, `harness_plans.canonical_plan_key`, `news_entities.slug` | unique | Stable natural keys |
| `model_benchmark_values` primary key | `(model_id, benchmark_id, captured_at)` | Value identity |

## Other indexes (migration 0005)

| Index | Table and columns |
| --- | --- |
| `models_provider_id_idx` | `models(provider_id)` |
| `models_open_weight_idx` | `models(open_weight)` |
| `models_release_date_idx` | `models(release_date desc nulls last)` |
| `models_intelligence_idx` | `models(intelligence desc nulls last)` |
| `models_name_trgm_idx` | `models` gin on `name` (`gin_trgm_ops`) |
| `model_snapshots_model_captured_idx` | `model_snapshots(model_id, captured_at desc)` |
| `news_items_domain_published_idx` | `news_items(domain, published_at desc nulls last)` |
| `news_items_source_idx` | `news_items(source_id)` |
| `news_items_cluster_idx` | `news_items(cluster_id)` |
| `news_items_content_hash_idx` | `news_items(content_hash)` |
| `news_items_provider_ids_idx` | `news_items` gin on `provider_ids` |
| `news_items_entities_idx` | `news_items` gin on `entities` |
| `social_posts_published_idx` | `social_posts(published_at desc)` |
| `social_posts_account_idx` | `social_posts(account_id)` |
| `harness_plans_product_idx` | `harness_plans(product_id)` |
| `harness_plan_snapshots_plan_captured_idx` | `harness_plan_snapshots(plan_id, captured_at desc)` |
| `harness_change_events_observed_idx` | `harness_change_events(observed_at desc)` |
| `harness_change_events_plan_idx` | `harness_change_events(plan_id)` |
| `world_news_region_published_idx` | `world_news_items(region, published_at desc nulls last)` |
| `world_news_country_codes_idx` | `world_news_items` gin on `country_codes` |
| `change_events_observed_idx` | `change_events(observed_at desc)` |
| `change_events_entity_idx` | `change_events(entity, entity_id)` |
| `ingestion_runs_source_started_idx` | `ingestion_runs(source_id, started_at desc)` |
| `raw_payloads_retention_idx` | `private.raw_ingestion_payloads(retained_until)` |

## Helpers and triggers

| Object | Definition |
| --- | --- |
| `private.set_updated_at()` | `plpgsql` trigger function setting `new.updated_at = now()` |
| `private.is_service_role()` | `sql` stable function returning whether `request.jwt.claim.role` is `service_role` |
| `providers_set_updated_at` | before update on `public.providers` |
| `models_set_updated_at` | before update on `public.models` |
| `sources_set_updated_at` | before update on `public.sources` |
| `harness_products_set_updated_at` | before update on `public.harness_products` |
| `watchlists_set_updated_at` | before update on `public.watchlists` |

`private.is_service_role()` is defined in SQL but is not referenced by any current
policy. Treat it as available for future policies, not as an active control.

## Row level security model

This mirrors the header comment of
`supabase/migrations/20260918000500_indexes_and_rls.sql`:

- Every table in `public` has RLS enabled (19 tables are listed in the `alter table ...
  enable row level security` block).
- `anon` and `authenticated` may only `SELECT` published content. A `select` policy
  named `{table}_public_read` with `using (true)` is created for: `providers`, `models`,
  `model_snapshots`, `benchmark_definitions`, `model_benchmark_values`, `sources`,
  `ingestion_runs`, `change_events`, `news_items`, `news_entities`,
  `monitored_social_accounts`, `social_posts`, `harness_products`, `harness_plans`,
  `harness_plan_snapshots`, `harness_change_events`, `world_news_items`.
- There is **no** insert, update or delete policy for those roles, so writes are denied
  by default and can only happen through the service role used by the server-side
  ingestion pipeline. The service-role key never reaches the browser.
- The `private` schema is not granted to `anon` or `authenticated` at all: the migration
  runs `revoke all on schema private from anon, authenticated` and the same for all
  tables in the schema.
- Watchlists are owner-scoped. `watchlists_owner_all` allows `authenticated` all
  operations where `owner_id = auth.uid()`. `watchlist_items_owner_all` allows all
  operations when the parent watchlist belongs to `auth.uid()`.
- Grants: `usage` and `select on all tables` in `public` to `anon` and `authenticated`;
  `all` on `public` and `private` to `service_role`.

Note the practical consequence: the shipped Watchlists screen uses local storage, so it
works for anonymous visitors, and the owner-scoped policies are in place for a future
Supabase-backed preference store.

## Applying the migrations

```bash
npx supabase link --project-ref <ref>
npx supabase db push
npm run db:gen-types
```

The migrations have not been applied to a live project from this repository; see
`docs/05-operations/supabase-setup.md`.
