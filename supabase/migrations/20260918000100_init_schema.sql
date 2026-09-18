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
