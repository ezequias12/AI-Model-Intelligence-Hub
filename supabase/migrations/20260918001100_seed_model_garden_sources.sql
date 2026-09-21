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
