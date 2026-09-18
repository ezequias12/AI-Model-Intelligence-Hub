-- =============================================================================
-- 0008 — Seed the monitored social accounts
--
-- The social job reads `monitored_social_accounts` and passes those accounts to
-- the X adapter. A fresh database has none, so the adapter receives an empty
-- list and returns zero posts even with a valid token (KI-7 / backlog H3). This
-- migration defines the accounts to monitor.
--
-- The source itself (`x-monitored-accounts`) stays disabled until
-- `X_BEARER_TOKEN` is configured; seeding the targets is independent of that.
--
-- `provider_id` is left null on purpose: it references `public.providers`, which
-- is only populated once `sync-models` runs, so a foreign key here would fail on
-- a fresh database. The social adapter needs only handle, platform and enabled
-- state; provider linkage is a later, separate step.
--
-- Idempotent: safe to re-apply (upsert on the primary key).
-- =============================================================================

insert into public.monitored_social_accounts
  (id, handle, display_name, platform, account_category, provider_id, harness_product_id, enabled)
values
  ('social-account:openai', '@OpenAI', 'OpenAI', 'x', 'model_provider', null, null, true),
  ('social-account:anthropic', '@AnthropicAI', 'Anthropic', 'x', 'model_provider', null, null, true),
  ('social-account:googledeepmind', '@GoogleDeepMind', 'Google DeepMind', 'x', 'model_provider', null, null, true),
  ('social-account:xai', '@xai', 'xAI', 'x', 'model_provider', null, null, true),
  ('social-account:deepseek', '@deepseek_ai', 'DeepSeek', 'x', 'model_provider', null, null, true),
  ('social-account:alibaba-qwen', '@Alibaba_Qwen', 'Qwen', 'x', 'model_provider', null, null, true),
  ('social-account:moonshot', '@MoonshotAI', 'Moonshot AI', 'x', 'model_provider', null, null, true),
  ('social-account:artificialanalysis', '@ArtificialAnlys', 'Artificial Analysis', 'x', 'benchmark_org', null, null, true),
  ('social-account:commandcode', '@commandcode', 'Command Code', 'x', 'coding_harness', null, 'harness:command-code', true),
  ('social-account:opencode', '@opencode_ai', 'OpenCode', 'x', 'coding_harness', null, 'harness:opencode', true),
  ('social-account:kilo', '@kilocode', 'Kilo Code', 'x', 'coding_harness', null, 'harness:kilo-code', true),
  ('social-account:gemini-cli', '@geminicli', 'Gemini CLI', 'x', 'coding_harness', null, 'harness:gemini-cli', true)
on conflict (id) do update set
  handle = excluded.handle,
  display_name = excluded.display_name,
  platform = excluded.platform,
  account_category = excluded.account_category,
  harness_product_id = excluded.harness_product_id,
  enabled = excluded.enabled;
