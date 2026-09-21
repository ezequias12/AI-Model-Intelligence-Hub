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
