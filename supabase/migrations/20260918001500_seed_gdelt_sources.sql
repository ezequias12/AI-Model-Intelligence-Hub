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
