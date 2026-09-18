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
