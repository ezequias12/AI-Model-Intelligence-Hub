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
