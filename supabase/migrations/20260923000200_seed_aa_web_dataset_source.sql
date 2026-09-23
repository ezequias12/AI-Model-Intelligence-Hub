-- Seed the Artificial Analysis web-dataset source.
--
-- This source exists for exactly one figure the vendor's free API does not
-- expose: the answer/reasoning token split per Intelligence Index task. It reads
-- the Schema.org Dataset blocks the vendor publishes inside the page, which carry
-- their own citation and license, rather than scraping markup.
--
-- It runs daily: the page lists only the models it is displaying (a few dozen),
-- so it supplements the API instead of competing with it. Attribution is
-- displayed in the interface.
--
-- See ADR-0011 for why an API-first project accepts this one exception.

-- The type is new, so the column's check constraint has to admit it before the
-- row can be inserted. Recreated rather than relaxed, so the allowed set stays
-- explicit.
alter table public.sources drop constraint if exists sources_type_check;
alter table public.sources add constraint sources_type_check check (type = any (array[
  'api', 'rss', 'atom', 'json', 'html', 'official_pricing', 'official_docs', 'official_site',
  'official_changelog', 'github_releases', 'social_api', 'openrouter_models', 'huggingface_models',
  'artificial_analysis_web', 'bluesky', 'hackernews', 'gdelt', 'manual'
]));

insert into public.sources (id, domain, name, type, url, enabled, priority, cadence_minutes, attribution, licensing_note, notes)
values
  ('artificial-analysis-web', 'models', 'Artificial Analysis web dataset', 'artificial_analysis_web',
   'https://artificialanalysis.ai/models', true, 3, 1440, 'Artificial Analysis',
   'Reads the Schema.org Dataset blocks the vendor publishes in the page for machine consumption, which carry their own citation and license. Attribution is displayed. The vendor''s Terms of Use apply.',
   'Supplements the API with the per-task token split, which the free API tier does not expose. Each dataset block lists only the models the page displays, so coverage is a few dozen models rather than the whole catalogue.')
on conflict (id) do update set
  domain = excluded.domain,
  name = excluded.name,
  type = excluded.type,
  url = excluded.url,
  enabled = excluded.enabled,
  priority = excluded.priority,
  cadence_minutes = excluded.cadence_minutes,
  attribution = excluded.attribution,
  licensing_note = excluded.licensing_note,
  notes = excluded.notes;
