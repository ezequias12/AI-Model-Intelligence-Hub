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
