-- =============================================================================
-- 0005 — Indexes, row level security and grants
-- =============================================================================
--
-- Security model
-- --------------
--  * Every table in `public` has RLS enabled.
--  * Anonymous and authenticated roles may only SELECT published content.
--  * There is NO insert/update/delete policy for those roles, so writes are
--    denied by default and can only happen through the service role used by the
--    server-side ingestion pipeline. The service-role key never reaches the
--    browser (it is read from a non-NEXT_PUBLIC_ environment variable).
--  * The `private` schema holds raw ingestion payloads and is not granted to
--    anonymous or authenticated roles at all.
--  * Watchlists are owner-scoped so a future Supabase-backed preference store is
--    safe by construction.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists models_provider_id_idx on public.models (provider_id);
create index if not exists models_open_weight_idx on public.models (open_weight);
create index if not exists models_release_date_idx on public.models (release_date desc nulls last);
create index if not exists models_intelligence_idx on public.models (intelligence desc nulls last);
create index if not exists models_name_trgm_idx on public.models using gin (name gin_trgm_ops);

create index if not exists model_snapshots_model_captured_idx
  on public.model_snapshots (model_id, captured_at desc);

create index if not exists news_items_domain_published_idx
  on public.news_items (domain, published_at desc nulls last);
create index if not exists news_items_source_idx on public.news_items (source_id);
create index if not exists news_items_cluster_idx on public.news_items (cluster_id);
create index if not exists news_items_content_hash_idx on public.news_items (content_hash);
create index if not exists news_items_provider_ids_idx on public.news_items using gin (provider_ids);
create index if not exists news_items_entities_idx on public.news_items using gin (entities);

create index if not exists social_posts_published_idx on public.social_posts (published_at desc);
create index if not exists social_posts_account_idx on public.social_posts (account_id);

create index if not exists harness_plans_product_idx on public.harness_plans (product_id);
create index if not exists harness_plan_snapshots_plan_captured_idx
  on public.harness_plan_snapshots (plan_id, captured_at desc);
create index if not exists harness_change_events_observed_idx
  on public.harness_change_events (observed_at desc);
create index if not exists harness_change_events_plan_idx on public.harness_change_events (plan_id);

create index if not exists world_news_region_published_idx
  on public.world_news_items (region, published_at desc nulls last);
create index if not exists world_news_country_codes_idx
  on public.world_news_items using gin (country_codes);

create index if not exists change_events_observed_idx on public.change_events (observed_at desc);
create index if not exists change_events_entity_idx on public.change_events (entity, entity_id);

create index if not exists ingestion_runs_source_started_idx
  on public.ingestion_runs (source_id, started_at desc);

create index if not exists raw_payloads_retention_idx
  on private.raw_ingestion_payloads (retained_until);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.providers enable row level security;
alter table public.models enable row level security;
alter table public.model_snapshots enable row level security;
alter table public.benchmark_definitions enable row level security;
alter table public.model_benchmark_values enable row level security;
alter table public.sources enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.change_events enable row level security;
alter table public.news_items enable row level security;
alter table public.news_entities enable row level security;
alter table public.monitored_social_accounts enable row level security;
alter table public.social_posts enable row level security;
alter table public.harness_products enable row level security;
alter table public.harness_plans enable row level security;
alter table public.harness_plan_snapshots enable row level security;
alter table public.harness_change_events enable row level security;
alter table public.world_news_items enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;

-- Read-only policies for published content.
do $$
declare
  target text;
  read_only_tables text[] := array[
    'providers', 'models', 'model_snapshots', 'benchmark_definitions',
    'model_benchmark_values', 'sources', 'ingestion_runs', 'change_events',
    'news_items', 'news_entities', 'monitored_social_accounts', 'social_posts',
    'harness_products', 'harness_plans', 'harness_plan_snapshots',
    'harness_change_events', 'world_news_items'
  ];
begin
  foreach target in array read_only_tables loop
    execute format('drop policy if exists %I on public.%I', target || '_public_read', target);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      target || '_public_read', target
    );
  end loop;
end;
$$;

-- Watchlists are owner-scoped. Anonymous users are expected to use local
-- storage; authenticated users get a durable, isolated store.
drop policy if exists watchlists_owner_all on public.watchlists;
create policy watchlists_owner_all on public.watchlists
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists watchlist_items_owner_all on public.watchlist_items;
create policy watchlist_items_owner_all on public.watchlist_items
  for all to authenticated
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id and w.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

-- The private schema and its contents are never granted to client roles.
revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

-- Service role (server-side ingestion) keeps full access.
grant all on schema private to service_role;
grant all on all tables in schema private to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
