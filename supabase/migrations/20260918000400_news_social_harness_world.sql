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
