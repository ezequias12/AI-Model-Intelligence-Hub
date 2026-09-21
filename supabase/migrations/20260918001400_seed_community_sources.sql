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
