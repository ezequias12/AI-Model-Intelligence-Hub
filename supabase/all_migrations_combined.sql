-- =============================================================================
-- 0001 — Schemas, extensions and shared helpers
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Public schema: everything the browser may read, always behind RLS.
-- Private schema: raw ingestion payloads, run logs and anything operational.
create schema if not exists private;

comment on schema private is
  'Operational data (raw ingestion payloads, debugging artefacts). Never exposed to the browser.';

-- Shared updated_at trigger.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Convenience: is the current request using the service role?
create or replace function private.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;
-- =============================================================================
-- 0002 — Core model intelligence tables
-- =============================================================================

create table if not exists public.providers (
  id text primary key,
  slug text not null unique,
  name text not null,
  domain text,
  country_code text,
  region text,
  provider_group text not null check (provider_group in ('mainstream_global', 'china_based', 'other')),
  logo_url text,
  color text,
  active boolean not null default true,
  source_id text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on column public.providers.provider_group is
  'Geographic/structural classification only. Never a quality judgement.';

create table if not exists public.models (
  id text primary key,
  slug text not null unique,
  name text not null,
  short_name text not null,
  provider_id text not null references public.providers (id) on delete restrict,
  release_date timestamptz,
  deprecated_at timestamptz,
  open_weight boolean not null default false,
  description text,
  official_url text,
  source_id text,
  source_version text,
  last_refreshed_at timestamptz,

  intelligence numeric,
  coding numeric,
  agentic numeric,
  math numeric,
  output_speed_tps numeric,
  ttft_seconds numeric,
  input_price_per_million numeric,
  output_price_per_million numeric,
  cache_read_price_per_million numeric,
  cache_write_price_per_million numeric,
  context_window bigint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.models is
  'Current model state. History lives in model_snapshots; this table is the latest known values.';

-- One row per observed state of a model. Snapshots are append-only.
create table if not exists public.model_snapshots (
  id text primary key,
  model_id text not null references public.models (id) on delete cascade,
  captured_at timestamptz not null,
  metrics jsonb not null,
  source_id text not null,
  source_version text,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  unique (model_id, captured_at, payload_hash)
);

comment on column public.model_snapshots.payload_hash is
  'Deterministic hash of the normalised payload. Used for idempotency and change detection.';

create table if not exists public.benchmark_definitions (
  id text primary key,
  key text not null unique,
  name text not null,
  description text,
  unit text,
  direction text not null check (direction in ('higher', 'lower')),
  category text not null check (category in ('capability', 'performance', 'cost', 'safety', 'other')),
  weights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.model_benchmark_values (
  model_id text not null references public.models (id) on delete cascade,
  benchmark_id text not null references public.benchmark_definitions (id) on delete cascade,
  value numeric not null,
  source_id text not null,
  captured_at timestamptz not null,
  primary key (model_id, benchmark_id, captured_at)
);

create trigger providers_set_updated_at
  before update on public.providers
  for each row execute function private.set_updated_at();

create trigger models_set_updated_at
  before update on public.models
  for each row execute function private.set_updated_at();
-- =============================================================================
-- 0003 — Sources, ingestion ledger and change events
-- =============================================================================

create table if not exists public.sources (
  id text primary key,
  domain text not null check (
    domain in ('models', 'ai_news', 'provider_news', 'research', 'social', 'harness', 'world_politics', 'internal')
  ),
  name text not null,
  type text not null check (
    type in (
      'api', 'rss', 'atom', 'json', 'html', 'official_pricing', 'official_docs',
      'official_site', 'official_changelog', 'github_releases', 'social_api', 'manual'
    )
  ),
  url text not null,
  enabled boolean not null default true,
  priority integer not null default 3 check (priority between 1 and 5),
  cadence_minutes integer check (cadence_minutes is null or cadence_minutes > 0),
  attribution text,
  licensing_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingestion_runs (
  id text primary key,
  source_id text not null references public.sources (id) on delete cascade,
  job_key text not null,
  status text not null check (status in ('running', 'success', 'partial', 'failed', 'skipped', 'rate_limited')),
  started_at timestamptz not null,
  finished_at timestamptz,
  items_seen integer not null default 0,
  items_written integer not null default 0,
  items_skipped integer not null default 0,
  rate_limit_remaining integer,
  rate_limit_reset_at timestamptz,
  error text,
  idempotency_key text,
  created_at timestamptz not null default now()
);

-- Idempotency: a retry with the same key must not duplicate the run.
create unique index if not exists ingestion_runs_idempotency_key_idx
  on public.ingestion_runs (idempotency_key)
  where idempotency_key is not null;

create table if not exists public.change_events (
  id text primary key,
  entity text not null check (entity in ('model', 'harness_plan', 'source', 'news')),
  entity_id text not null,
  event_type text not null,
  observed_at timestamptz not null,
  significance text not null check (significance in ('low', 'medium', 'high')),
  before_json jsonb,
  after_json jsonb,
  source_id text,
  summary text not null,
  created_at timestamptz not null default now()
);

-- Raw payloads are kept for debugging. They live in the private schema and are
-- bounded by a retention job.
create table if not exists private.raw_ingestion_payloads (
  id text primary key,
  source_id text not null,
  captured_at timestamptz not null,
  response_hash text not null,
  sanitized_payload jsonb not null,
  retained_until timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table private.raw_ingestion_payloads is
  'Sanitized raw source payloads for debugging parser breakage. Never exposed to the browser.';

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function private.set_updated_at();
-- =============================================================================
-- 0004 — News, social, harness and world-politics tables
-- =============================================================================

-- ---------------------------------------------------------------------------
-- News
-- ---------------------------------------------------------------------------

create table if not exists public.news_items (
  id text primary key,
  domain text not null check (domain in ('ai_general', 'provider', 'social', 'research', 'harness', 'world_politics')),
  category text not null check (
    category in (
      'model_release', 'pricing', 'benchmark', 'research', 'developer', 'product',
      'infrastructure', 'funding', 'acquisition', 'regulation', 'election',
      'geopolitics', 'economy', 'conflict', 'diplomacy', 'other'
    )
  ),
  title text not null,
  url text not null,
  canonical_url text not null,
  source_id text not null references public.sources (id) on delete cascade,
  source_name text not null,
  trust_tier smallint not null check (trust_tier between 1 and 3),
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  excerpt text,
  summary text,
  entities text[] not null default '{}',
  provider_ids text[] not null default '{}',
  official boolean not null default false,
  corroborated boolean not null default false,
  developing boolean not null default false,
  content_hash text not null,
  cluster_id text,
  created_at timestamptz not null default now()
);

comment on column public.news_items.excerpt is
  'Short permitted excerpt only. Full articles are never mirrored.';
comment on column public.news_items.trust_tier is
  '1 = official/primary, 2 = established reporting, 3 = social or uncorroborated. Never a viewpoint.';

-- Dedupe key: the same canonical URL may only appear once per source.
create unique index if not exists news_items_source_canonical_idx
  on public.news_items (source_id, canonical_url);

create table if not exists public.news_entities (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('company', 'model', 'person', 'benchmark', 'country', 'other')),
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------

create table if not exists public.monitored_social_accounts (
  id text primary key,
  handle text not null,
  display_name text not null,
  platform text not null check (platform in ('x', 'linkedin', 'youtube', 'blog', 'reddit')),
  account_category text not null check (
    account_category in (
      'model_provider', 'executive_researcher', 'benchmark_org',
      'coding_harness', 'coding_harness_founder', 'other'
    )
  ),
  provider_id text references public.providers (id) on delete set null,
  harness_product_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (platform, handle)
);

create table if not exists public.social_posts (
  id text primary key,
  account_id text not null references public.monitored_social_accounts (id) on delete cascade,
  handle text not null,
  display_name text not null,
  platform text not null check (platform in ('x', 'linkedin', 'youtube', 'blog', 'reddit')),
  post_id text not null,
  url text not null,
  text text not null,
  published_at timestamptz not null,
  metrics_json jsonb,
  entities text[] not null default '{}',
  corroborated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (platform, post_id)
);

comment on table public.social_posts is
  'Populated exclusively from authorized APIs. X HTML is never scraped as the foundation.';

-- ---------------------------------------------------------------------------
-- Harness
-- ---------------------------------------------------------------------------

create table if not exists public.harness_products (
  id text primary key,
  name text not null,
  slug text not null unique,
  vendor text not null,
  website text not null,
  docs_url text,
  pricing_url text,
  changelog_url text,
  open_source boolean not null default false,
  repo_url text,
  platforms text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.harness_plans (
  id text primary key,
  product_id text not null references public.harness_products (id) on delete cascade,
  canonical_plan_key text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column public.harness_plans.canonical_plan_key is
  'Stable key so a plan rename does not fork its history.';

create table if not exists public.harness_plan_snapshots (
  id text primary key,
  plan_id text not null references public.harness_plans (id) on delete cascade,
  captured_at timestamptz not null,
  monthly_price_usd numeric,
  annual_price_usd numeric,
  included_credits_usd numeric,
  estimated_requests integer,
  estimated_requests_source_url text,
  reset_period text not null check (reset_period in ('daily', 'weekly', 'monthly', 'rolling_5h', 'none')),
  overage_model text not null check (overage_model in ('hard_cap', 'pay_as_you_go', 'throttle', 'unknown')),
  byok boolean not null default false,
  models_json text[] not null default '{}',
  frontier_model_access boolean not null default false,
  platforms_json text[] not null default '{}',
  regions_json text[] not null default '{}',
  notes text,
  source_id text not null references public.sources (id) on delete cascade,
  source_url text not null,
  raw_source_hash text not null,
  created_at timestamptz not null default now(),
  unique (plan_id, captured_at, raw_source_hash)
);

comment on column public.harness_plan_snapshots.estimated_requests is
  'Only ever populated when the vendor documents it. Never inferred.';

create table if not exists public.harness_change_events (
  id text primary key,
  plan_id text not null references public.harness_plans (id) on delete cascade,
  product_id text not null references public.harness_products (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'plan_created', 'plan_removed', 'price_changed', 'credits_changed',
      'model_added', 'model_removed', 'limit_changed', 'cli_release',
      'feature_added', 'promotion_started', 'promotion_ended'
    )
  ),
  before_json jsonb,
  after_json jsonb,
  observed_at timestamptz not null,
  significance text not null check (significance in ('low', 'medium', 'high')),
  source_id text not null references public.sources (id) on delete cascade,
  summary text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- World & politics
-- ---------------------------------------------------------------------------

create table if not exists public.world_news_items (
  id text primary key,
  region text not null check (
    region in (
      'argentina', 'united_states', 'latin_america', 'world', 'economy',
      'regulation', 'geopolitics', 'elections', 'conflict_diplomacy'
    )
  ),
  category text not null check (
    category in (
      'model_release', 'pricing', 'benchmark', 'research', 'developer', 'product',
      'infrastructure', 'funding', 'acquisition', 'regulation', 'election',
      'geopolitics', 'economy', 'conflict', 'diplomacy', 'other'
    )
  ),
  headline text not null,
  summary text,
  source_id text not null references public.sources (id) on delete cascade,
  source_name text not null,
  trust_tier smallint not null check (trust_tier between 1 and 3),
  url text not null,
  canonical_url text not null,
  primary_source_url text,
  published_at timestamptz,
  event_at timestamptz,
  discovered_at timestamptz not null default now(),
  country_codes text[] not null default '{}',
  multiple_accounts boolean not null default false,
  developing boolean not null default false,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (source_id, canonical_url)
);

comment on table public.world_news_items is
  'Separate editorial domain. Never read by model or harness scoring code, and never used for user profiling.';
comment on column public.world_news_items.multiple_accounts is
  'True when sources disagree. The UI must show the sources, never a synthesized verdict.';

-- ---------------------------------------------------------------------------
-- Watchlists
-- ---------------------------------------------------------------------------

create table if not exists public.watchlists (
  id text primary key,
  owner_id uuid,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
  id text primary key,
  watchlist_id text not null references public.watchlists (id) on delete cascade,
  kind text not null check (kind in ('model', 'provider', 'harness_product', 'topic', 'news_query')),
  ref_id text not null,
  label text not null,
  added_at timestamptz not null default now()
);

create trigger harness_products_set_updated_at
  before update on public.harness_products
  for each row execute function private.set_updated_at();

create trigger watchlists_set_updated_at
  before update on public.watchlists
  for each row execute function private.set_updated_at();

alter table public.monitored_social_accounts
  add constraint monitored_social_accounts_harness_product_fk
  foreign key (harness_product_id) references public.harness_products (id) on delete set null;
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
-- =============================================================================
-- 0006 — Seed the source registry
--
-- The registry is data, not code: sources are enabled/disabled and their cadence
-- tuned without a deploy. URLs and terms must still be verified before enabling
-- a source in production.
-- =============================================================================

insert into public.sources (id, domain, name, type, url, enabled, priority, cadence_minutes, attribution, licensing_note, notes)
values
  ('artificial-analysis-api', 'models', 'Artificial Analysis Data API', 'api',
   'https://artificialanalysis.ai/data-api/docs', true, 1, 30, 'Artificial Analysis',
   'Attribution required. Respect quota; never scrape to bypass limits.',
   'Primary model metrics source.'),
  ('internal:provider-registry', 'internal', 'Internal provider registry', 'manual',
   'https://artificialanalysis.ai/data-api/docs', true, 1, null, null, null,
   'Maintained in-repo. Provider grouping is geographic, never a quality label.'),
  ('command-code-pricing', 'harness', 'Command Code Pricing', 'official_pricing',
   'https://commandcode.ai/pricing', true, 1, 240, 'Command Code', 'Public pricing page.',
   'Controlled HTML extraction with selector fixtures; fails loudly on shape change.'),
  ('command-code-go', 'harness', 'Command Code Go docs', 'official_docs',
   'https://commandcode.ai/docs/plans/go', true, 1, 360, 'Command Code', 'Public documentation.', null),
  ('opencode-go', 'harness', 'OpenCode Go', 'official_docs',
   'https://opencode.ai/v2/docs/console/go', true, 1, 360, 'OpenCode', 'Public documentation.', null),
  ('kilo-pricing', 'harness', 'Kilo Code Pricing', 'official_pricing',
   'https://kilo.ai/pricing', true, 1, 240, 'Kilo Code', 'Public pricing page.', null),
  ('claude-pricing', 'harness', 'Claude Pricing', 'official_pricing',
   'https://claude.com/pricing', true, 1, 240, 'Anthropic', 'Public pricing page.', null),
  ('freebuff', 'harness', 'Freebuff', 'official_site',
   'https://freebuff.ai/', true, 1, 360, 'Freebuff', 'Public site.',
   'Ad-supported offering; allowance may change without notice.'),
  ('cursor-pricing', 'harness', 'Cursor Pricing', 'official_pricing',
   'https://cursor.com/pricing', true, 2, 360, 'Cursor', 'Public pricing page.', null),
  ('windsurf-pricing', 'harness', 'Windsurf Pricing', 'official_pricing',
   'https://windsurf.com/pricing', true, 2, 360, 'Windsurf', 'Public pricing page.', null),
  ('gemini-cli-releases', 'harness', 'Gemini CLI releases', 'github_releases',
   'https://github.com/google-gemini/gemini-cli/releases', true, 2, 30, 'Google', 'GitHub releases feed.', null),
  ('openai-release-notes', 'provider_news', 'OpenAI Release Notes', 'official_changelog',
   'https://openai.com/products/release-notes/', true, 1, 20, 'OpenAI', 'Public release notes.', null),
  ('anthropic-news', 'provider_news', 'Anthropic News', 'html',
   'https://www.anthropic.com/news', true, 1, 30, 'Anthropic',
   'Public news index; store headline and link only.', null),
  ('google-blog-ai', 'provider_news', 'Google AI Blog', 'atom',
   'https://blog.google/technology/ai/rss/', true, 1, 30, 'Google', 'RSS feed.', null),
  ('openai-blog-rss', 'ai_news', 'OpenAI Blog', 'rss',
   'https://openai.com/blog/rss.xml', true, 1, 30, 'OpenAI', 'RSS feed; store excerpt only.', null),
  ('huggingface-blog', 'research', 'Hugging Face Blog', 'rss',
   'https://huggingface.co/blog/feed.xml', true, 2, 120, 'Hugging Face', 'RSS feed.', null),
  ('arxiv-cs-ai', 'research', 'arXiv cs.AI', 'atom',
   'https://export.arxiv.org/rss/cs.AI', true, 2, 360, 'arXiv',
   'arXiv terms apply; metadata and link only.', 'High volume — dedupe and cap items per run.'),
  ('artificial-analysis-posts', 'research', 'Artificial Analysis methodology', 'html',
   'https://artificialanalysis.ai/methodology', true, 2, 720, 'Artificial Analysis',
   'Attribution required.', null),
  ('x-monitored-accounts', 'social', 'X monitored accounts', 'social_api',
   'https://developer.x.com/en/docs/x-api', false, 2, 60, 'X',
   'Requires authorized API access. Never scrape X HTML as the foundation.',
   'Disabled until X_BEARER_TOKEN is configured.'),
  ('world-primary-wire', 'world_politics', 'World news primary wire', 'json',
   'https://example.com/world-wire-api', false, 1, 30, 'Wire service',
   'Requires a licensed provider. Headline, link and neutral summary only.',
   'Separate adapter group; never feeds model or harness ranking.')
on conflict (id) do update set
  domain = excluded.domain,
  name = excluded.name,
  type = excluded.type,
  url = excluded.url,
  priority = excluded.priority,
  cadence_minutes = excluded.cadence_minutes,
  attribution = excluded.attribution,
  licensing_note = excluded.licensing_note,
  notes = excluded.notes;
-- =============================================================================
-- 0007 — Seed the harness catalogue (products and plans)
--
-- The pricing job attaches a snapshot to a plan only when the extracted
-- `planKey` matches an existing `canonical_plan_key`. A fresh database has no
-- plans, so the job used to extract prices and write nothing (KI-9 / backlog
-- H1). This migration provides the rows it matches against.
--
-- The `canonical_plan_key` values below MUST stay identical to the `planKey`
-- declared in `src/lib/ingestion/harness-configs.ts`. When a config key changes,
-- change the seed in the same commit and bump that config's version.
--
-- Only products with a registered extraction config carry plan rows. Products
-- catalogued for context but with no extractor (OpenAI Codex, Gemini CLI) are
-- seeded without plans: no job could populate their prices, and an empty plan is
-- worse than an absent one.
--
-- Idempotent: safe to re-apply (upsert on the primary key).
-- =============================================================================

insert into public.harness_products
  (id, name, slug, vendor, website, docs_url, pricing_url, changelog_url, open_source, repo_url, platforms, active)
values
  ('harness:command-code', 'Command Code', 'command-code', 'Command Code',
   'https://commandcode.ai', 'https://commandcode.ai/docs', 'https://commandcode.ai/pricing',
   'https://commandcode.ai/changelog', false, null, array['cli', 'ide'], true),
  ('harness:opencode', 'OpenCode', 'opencode', 'OpenCode',
   'https://opencode.ai', 'https://opencode.ai/docs', 'https://opencode.ai/pricing',
   'https://opencode.ai/changelog', true, 'https://github.com/sst/opencode',
   array['cli', 'desktop', 'web'], true),
  ('harness:claude-code', 'Claude Code', 'claude-code', 'Anthropic',
   'https://claude.com/product/claude-code', 'https://docs.claude.com/en/docs/claude-code',
   'https://claude.com/pricing', 'https://docs.claude.com/en/release-notes/claude-code',
   false, null, array['cli', 'ide', 'web', 'desktop', 'cloud_agent'], true),
  ('harness:openai-codex', 'OpenAI Codex', 'openai-codex', 'OpenAI',
   'https://openai.com/codex', 'https://developers.openai.com/codex', 'https://openai.com/chatgpt/pricing',
   'https://openai.com/products/release-notes/', false, null,
   array['cli', 'ide', 'web', 'cloud_agent'], true),
  ('harness:gemini-cli', 'Gemini CLI', 'gemini-cli', 'Google',
   'https://github.com/google-gemini/gemini-cli', 'https://google-gemini.github.io/gemini-cli/',
   'https://ai.google.dev/pricing', 'https://github.com/google-gemini/gemini-cli/releases',
   true, 'https://github.com/google-gemini/gemini-cli', array['cli', 'ide'], true),
  ('harness:kilo-code', 'Kilo Code', 'kilo-code', 'Kilo Code',
   'https://kilo.ai', 'https://kilocode.ai/docs', 'https://kilo.ai/pricing',
   'https://github.com/Kilo-Org/kilocode/releases', true, 'https://github.com/Kilo-Org/kilocode',
   array['ide', 'cli'], true),
  ('harness:freebuff', 'Freebuff', 'freebuff', 'Freebuff',
   'https://freebuff.ai', null, 'https://freebuff.ai/pricing', null, false, null,
   array['web', 'cli'], true),
  ('harness:cursor', 'Cursor', 'cursor', 'Anysphere',
   'https://cursor.com', 'https://docs.cursor.com', 'https://cursor.com/pricing',
   'https://cursor.com/changelog', false, null, array['ide', 'cli', 'web', 'cloud_agent'], true),
  ('harness:windsurf', 'Windsurf', 'windsurf', 'Windsurf',
   'https://windsurf.com', 'https://docs.windsurf.com', 'https://windsurf.com/pricing',
   'https://windsurf.com/changelog', false, null, array['ide', 'web'], true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  vendor = excluded.vendor,
  website = excluded.website,
  docs_url = excluded.docs_url,
  pricing_url = excluded.pricing_url,
  changelog_url = excluded.changelog_url,
  open_source = excluded.open_source,
  repo_url = excluded.repo_url,
  platforms = excluded.platforms,
  active = excluded.active;

insert into public.harness_plans (id, product_id, canonical_plan_key, name, active)
values
  ('plan:command-code:go', 'harness:command-code', 'command-code-go', 'Go', true),
  ('plan:command-code:goat', 'harness:command-code', 'command-code-goat', 'GOAT', true),
  ('plan:opencode:go', 'harness:opencode', 'opencode-go', 'Go', true),
  ('plan:kilo-code:individual-free', 'harness:kilo-code', 'kilo-individual-free', 'Individual platform', true),
  ('plan:kilo-code:pass', 'harness:kilo-code', 'kilo-pass', 'Kilo Pass', true),
  ('plan:claude-code:pro', 'harness:claude-code', 'claude-pro', 'Claude Pro', true),
  ('plan:claude-code:max', 'harness:claude-code', 'claude-max', 'Claude Max', true),
  ('plan:freebuff:free', 'harness:freebuff', 'freebuff-free', 'Ad-supported free tier', true),
  ('plan:cursor:pro', 'harness:cursor', 'cursor-pro', 'Pro', true),
  ('plan:windsurf:pro', 'harness:windsurf', 'windsurf-pro', 'Pro', true)
on conflict (id) do update set
  product_id = excluded.product_id,
  canonical_plan_key = excluded.canonical_plan_key,
  name = excluded.name,
  active = excluded.active;
-- =============================================================================
-- 0008 — Seed the monitored social accounts
--
-- The social job reads `monitored_social_accounts` and passes those accounts to
-- the X adapter. A fresh database has none, so the adapter receives an empty
-- list and returns zero posts even with a valid token (KI-7 / backlog H3). This
-- migration defines the accounts to monitor.
--
-- The source itself (`x-monitored-accounts`) stays disabled until
-- `X_BEARER_TOKEN` is configured; seeding the targets is independent of that.
--
-- `provider_id` is left null on purpose: it references `public.providers`, which
-- is only populated once `sync-models` runs, so a foreign key here would fail on
-- a fresh database. The social adapter needs only handle, platform and enabled
-- state; provider linkage is a later, separate step.
--
-- Idempotent: safe to re-apply (upsert on the primary key).
-- =============================================================================

insert into public.monitored_social_accounts
  (id, handle, display_name, platform, account_category, provider_id, harness_product_id, enabled)
values
  ('social-account:openai', '@OpenAI', 'OpenAI', 'x', 'model_provider', null, null, true),
  ('social-account:anthropic', '@AnthropicAI', 'Anthropic', 'x', 'model_provider', null, null, true),
  ('social-account:googledeepmind', '@GoogleDeepMind', 'Google DeepMind', 'x', 'model_provider', null, null, true),
  ('social-account:xai', '@xai', 'xAI', 'x', 'model_provider', null, null, true),
  ('social-account:deepseek', '@deepseek_ai', 'DeepSeek', 'x', 'model_provider', null, null, true),
  ('social-account:alibaba-qwen', '@Alibaba_Qwen', 'Qwen', 'x', 'model_provider', null, null, true),
  ('social-account:moonshot', '@MoonshotAI', 'Moonshot AI', 'x', 'model_provider', null, null, true),
  ('social-account:artificialanalysis', '@ArtificialAnlys', 'Artificial Analysis', 'x', 'benchmark_org', null, null, true),
  ('social-account:commandcode', '@commandcode', 'Command Code', 'x', 'coding_harness', null, 'harness:command-code', true),
  ('social-account:opencode', '@opencode_ai', 'OpenCode', 'x', 'coding_harness', null, 'harness:opencode', true),
  ('social-account:kilo', '@kilocode', 'Kilo Code', 'x', 'coding_harness', null, 'harness:kilo-code', true),
  ('social-account:gemini-cli', '@geminicli', 'Gemini CLI', 'x', 'coding_harness', null, 'harness:gemini-cli', true)
on conflict (id) do update set
  handle = excluded.handle,
  display_name = excluded.display_name,
  platform = excluded.platform,
  account_category = excluded.account_category,
  harness_product_id = excluded.harness_product_id,
  enabled = excluded.enabled;
-- =============================================================================
-- 0009 — Extend the source `type` allow-list
--
-- The pivot replaces the paid X API with free, no-scrape sources (OpenRouter,
-- Hugging Face Hub, Bluesky, Hacker News, GDELT). The `sources.type` CHECK from
-- migration 0003 is a closed set; this migration widens it. Values are added
-- here once so later phases need no further type migration.
--
-- Idempotent: drop-then-add, safe to re-run.
-- =============================================================================

alter table public.sources drop constraint if exists sources_type_check;

alter table public.sources
  add constraint sources_type_check check (
    type in (
      'api', 'rss', 'atom', 'json', 'html', 'official_pricing', 'official_docs',
      'official_site', 'official_changelog', 'github_releases', 'social_api',
      'openrouter_models', 'huggingface_models', 'bluesky', 'hackernews', 'gdelt',
      'manual'
    )
  );
-- =============================================================================
-- 0010 — Add the Hugging Face popularity metrics to public.models
--
-- `hfDownloads` and `hfLikes` are popularity signals from the Hugging Face Hub,
-- never capability measures. They are nullable: a closed model has no Hub page
-- and renders as an em dash.
--
-- Idempotent: `add column if not exists`, safe to re-run.
-- =============================================================================

alter table public.models add column if not exists hf_downloads numeric;
alter table public.models add column if not exists hf_likes numeric;

comment on column public.models.hf_downloads is
  'Hugging Face 30-day download count. Popularity, not capability.';
comment on column public.models.hf_likes is
  'Hugging Face like count. Popularity, not capability.';
-- =============================================================================
-- 0011 — Seed the model-garden sources
--
-- OpenRouter (routed catalogue, context window) and the Hugging Face Hub
-- (popularity). Both are free, key-less and never scraped. They belong to the
-- `models` domain, so the existing `sync-models` job picks them up.
--
-- Idempotent: upsert on `id`.
-- =============================================================================

insert into public.sources
  (id, domain, name, type, url, enabled, priority, cadence_minutes, attribution, licensing_note, notes)
values
  ('openrouter-models', 'models', 'OpenRouter Models', 'openrouter_models',
   'https://openrouter.ai/api/v1/models', true, 2, 240, 'OpenRouter',
   'Public catalogue endpoint; no key required.',
   'Catalogue breadth and context window only. Price is routed per provider, not first-party, so it is never written over the Artificial Analysis price.'),
  ('huggingface-models', 'models', 'Hugging Face Hub', 'huggingface_models',
   'https://huggingface.co/api/models', true, 2, 240, 'Hugging Face',
   'Public API; no key required.',
   'Popularity only (downloads, likes). Enriches matched models; never adds a model and never overwrites capability.')
on conflict (id) do update set
  domain = excluded.domain,
  name = excluded.name,
  type = excluded.type,
  url = excluded.url,
  priority = excluded.priority,
  cadence_minutes = excluded.cadence_minutes,
  attribution = excluded.attribution,
  licensing_note = excluded.licensing_note,
  notes = excluded.notes;
-- =============================================================================
-- 0012 — Seed the curated provider registry
--
-- Provider grouping is a geographic/structural classification, never a quality
-- judgement, and it is never inferred from a metric payload (ADR-0005). The
-- curator maintains it here; `sync-models` preserves these columns instead of
-- overwriting them with its deliberate `group: "other"` (KI-19).
--
-- Names, domains, regions and colours are curated metadata for the providers the
-- product tracks. Providers that appear only in a live payload stay `other`
-- until curated here.
--
-- Idempotent: upsert on `id`.
-- =============================================================================

insert into public.providers
  (id, slug, name, domain, country_code, region, provider_group, logo_url, color, active, source_id)
values
  ('provider:openai', 'openai', 'OpenAI', 'openai.com', 'US', 'United States', 'mainstream_global', null, '#10a37f', true, 'internal:provider-registry'),
  ('provider:anthropic', 'anthropic', 'Anthropic', 'anthropic.com', 'US', 'United States', 'mainstream_global', null, '#d97757', true, 'internal:provider-registry'),
  ('provider:google', 'google', 'Google DeepMind', 'deepmind.google', 'US', 'United States', 'mainstream_global', null, '#4285f4', true, 'internal:provider-registry'),
  ('provider:xai', 'xai', 'xAI', 'x.ai', 'US', 'United States', 'mainstream_global', null, '#1d1d1f', true, 'internal:provider-registry'),
  ('provider:meta', 'meta', 'Meta', 'ai.meta.com', 'US', 'United States', 'mainstream_global', null, '#0866ff', true, 'internal:provider-registry'),
  ('provider:mistral', 'mistral', 'Mistral AI', 'mistral.ai', 'FR', 'European Union', 'mainstream_global', null, '#fa520f', true, 'internal:provider-registry'),
  ('provider:cohere', 'cohere', 'Cohere', 'cohere.com', 'CA', 'Canada', 'mainstream_global', null, '#39594d', true, 'internal:provider-registry'),
  ('provider:microsoft', 'microsoft', 'Microsoft', 'microsoft.com', 'US', 'United States', 'other', null, '#00a4ef', true, 'internal:provider-registry'),
  ('provider:amazon', 'amazon', 'Amazon', 'aws.amazon.com', 'US', 'United States', 'other', null, '#ff9900', true, 'internal:provider-registry'),
  ('provider:nvidia', 'nvidia', 'NVIDIA', 'nvidia.com', 'US', 'United States', 'other', null, '#76b900', true, 'internal:provider-registry'),
  ('provider:deepseek', 'deepseek', 'DeepSeek', 'deepseek.com', 'CN', 'China', 'china_based', null, '#4d6bfe', true, 'internal:provider-registry'),
  ('provider:alibaba', 'alibaba', 'Alibaba Qwen', 'qwen.ai', 'CN', 'China', 'china_based', null, '#615ced', true, 'internal:provider-registry'),
  ('provider:moonshot', 'moonshot', 'Moonshot AI', 'moonshot.ai', 'CN', 'China', 'china_based', null, '#0b0b0f', true, 'internal:provider-registry'),
  ('provider:minimax', 'minimax', 'MiniMax', 'minimax.io', 'CN', 'China', 'china_based', null, '#e8543f', true, 'internal:provider-registry'),
  ('provider:zhipu', 'zhipu', 'Z.ai (Zhipu)', 'z.ai', 'CN', 'China', 'china_based', null, '#3859ff', true, 'internal:provider-registry'),
  ('provider:xiaomi', 'xiaomi', 'Xiaomi', 'xiaomi.com', 'CN', 'China', 'china_based', null, '#ff6900', true, 'internal:provider-registry')
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  domain = excluded.domain,
  country_code = excluded.country_code,
  region = excluded.region,
  provider_group = excluded.provider_group,
  color = excluded.color,
  active = excluded.active,
  source_id = excluded.source_id;
-- =============================================================================
-- 0013 — Extend the social platform allow-lists
--
-- The community pivot replaces X with Bluesky and Hacker News, which need new
-- `platform` values on both `monitored_social_accounts` and `social_posts`. The
-- historical `'x'` value is kept so existing rows remain valid until migration
-- 0014 removes them.
--
-- Idempotent: drop-then-add, safe to re-run.
-- =============================================================================

alter table public.monitored_social_accounts
  drop constraint if exists monitored_social_accounts_platform_check;

alter table public.monitored_social_accounts
  add constraint monitored_social_accounts_platform_check check (
    platform in ('x', 'bluesky', 'hackernews', 'linkedin', 'youtube', 'blog', 'reddit')
  );

alter table public.social_posts drop constraint if exists social_posts_platform_check;

alter table public.social_posts
  add constraint social_posts_platform_check check (
    platform in ('x', 'bluesky', 'hackernews', 'linkedin', 'youtube', 'blog', 'reddit')
  );
-- =============================================================================
-- 0014 — Seed the community sources, remove X
--
-- X is out of scope: its API is paid and its HTML is never scraped. The
-- community signal comes from Bluesky (public AT Protocol AppView, key-less) and
-- Hacker News (Algolia, key-less). This migration registers both sources, seeds
-- the Bluesky accounts to monitor plus the synthetic Hacker News account, and
-- removes anything left over from the X era.
--
-- Runs after 0013, which widens the platform CHECK constraints.
-- Idempotent: upserts and deletes, safe to re-run.
-- =============================================================================

-- Remove the retired X source and any X-era rows.
delete from public.social_posts where platform = 'x';
delete from public.monitored_social_accounts where platform = 'x';
delete from public.sources where id = 'x-monitored-accounts';

-- Register the two community sources.
insert into public.sources
  (id, domain, name, type, url, enabled, priority, cadence_minutes, attribution, licensing_note, notes)
values
  ('bluesky-accounts', 'social', 'Bluesky monitored accounts', 'bluesky',
   'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed', true, 2, 60, 'Bluesky',
   'Public AT Protocol AppView. Key-less; no scraping.',
   'Community signal. Reads each monitored account''s public author feed.'),
  ('hackernews-stories', 'social', 'Hacker News stories', 'hackernews',
   'https://hn.algolia.com/api/v1/search_by_date', true, 3, 60, 'Hacker News (Algolia)',
   'Public, key-less search API. No scraping.',
   'Developer-community signal. Points -> likes, comments -> replies; reposts are always null.')
on conflict (id) do update set
  domain = excluded.domain,
  name = excluded.name,
  type = excluded.type,
  url = excluded.url,
  priority = excluded.priority,
  cadence_minutes = excluded.cadence_minutes,
  attribution = excluded.attribution,
  licensing_note = excluded.licensing_note,
  notes = excluded.notes;

-- Seed the accounts to monitor. `provider_id` is left null until `sync-models`
-- has created the provider rows; harness product ids reference the catalogue
-- seeded by migration 0007.
insert into public.monitored_social_accounts
  (id, handle, display_name, platform, account_category, provider_id, harness_product_id, enabled)
values
  ('social-account:openai', '@openai.bsky.social', 'OpenAI', 'bluesky', 'model_provider', null, null, true),
  ('social-account:anthropic', '@anthropic.bsky.social', 'Anthropic', 'bluesky', 'model_provider', null, null, true),
  ('social-account:googledeepmind', '@googledeepmind.bsky.social', 'Google DeepMind', 'bluesky', 'model_provider', null, null, true),
  ('social-account:xai', '@xai.bsky.social', 'xAI', 'bluesky', 'model_provider', null, null, true),
  ('social-account:deepseek', '@deepseek.bsky.social', 'DeepSeek', 'bluesky', 'model_provider', null, null, true),
  ('social-account:alibaba-qwen', '@qwen.bsky.social', 'Qwen', 'bluesky', 'model_provider', null, null, true),
  ('social-account:moonshot', '@moonshot.bsky.social', 'Moonshot AI', 'bluesky', 'model_provider', null, null, true),
  ('social-account:artificialanalysis', '@artificialanalysis.bsky.social', 'Artificial Analysis', 'bluesky', 'benchmark_org', null, null, true),
  ('social-account:commandcode', '@commandcode.bsky.social', 'Command Code', 'bluesky', 'coding_harness', null, 'harness:command-code', true),
  ('social-account:opencode', '@opencode.bsky.social', 'OpenCode', 'bluesky', 'coding_harness', null, 'harness:opencode', true),
  ('social-account:kilo', '@kilocode.bsky.social', 'Kilo Code', 'bluesky', 'coding_harness', null, 'harness:kilo-code', true),
  ('social-account:gemini-cli', '@geminicli.bsky.social', 'Gemini CLI', 'bluesky', 'coding_harness', null, 'harness:gemini-cli', true),
  ('social-account:hackernews', '@HackerNews', 'Hacker News', 'hackernews', 'other', null, null, true)
on conflict (id) do update set
  handle = excluded.handle,
  display_name = excluded.display_name,
  platform = excluded.platform,
  account_category = excluded.account_category,
  harness_product_id = excluded.harness_product_id,
  enabled = excluded.enabled;
-- =============================================================================
-- 0015 — Seed the GDELT sources
--
-- GDELT DOC 2.0 is free and key-less. It feeds the AI news workspace and the
-- isolated World & Politics workspace. The disabled `world-primary-wire` row
-- stays as an optional licensed alternative.
--
-- Idempotent: upsert on `id`.
-- =============================================================================

insert into public.sources
  (id, domain, name, type, url, enabled, priority, cadence_minutes, attribution, licensing_note, notes)
values
  ('gdelt-ai-news', 'ai_news', 'GDELT (AI news)', 'gdelt',
   'https://api.gdeltproject.org/api/v2/doc/doc', true, 2, 60, 'GDELT Project',
   'Free, key-less. Headline and link only.',
   'Global news query for AI coverage. Headline + link only; no scraping.'),
  ('gdelt-world-news', 'world_politics', 'GDELT (world news)', 'gdelt',
   'https://api.gdeltproject.org/api/v2/doc/doc', true, 1, 30, 'GDELT Project',
   'Free, key-less. Headline and link only.',
   'Isolated political domain; never feeds model or harness ranking.')
on conflict (id) do update set
  domain = excluded.domain,
  name = excluded.name,
  type = excluded.type,
  url = excluded.url,
  priority = excluded.priority,
  cadence_minutes = excluded.cadence_minutes,
  attribution = excluded.attribution,
  licensing_note = excluded.licensing_note,
  notes = excluded.notes;
