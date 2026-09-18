-- =============================================================================
-- 0007 — Seed the harness catalogue (products and plans)
--
-- The pricing job attaches a snapshot to a plan only when the extracted
-- `planKey` matches an existing `canonical_plan_key`. A fresh database has no
-- plans, so the job used to extract prices and write nothing (KI-9 / backlog
-- H1). This migration provides the rows it matches against.
--
-- The `canonical_plan_key` values below MUST stay identical to the `planKey`
-- declared in `src/lib/ingestion/harness-configs.ts`. When a config key changes,
-- change the seed in the same commit and bump that config's version.
--
-- Only products with a registered extraction config carry plan rows. Products
-- catalogued for context but with no extractor (OpenAI Codex, Gemini CLI) are
-- seeded without plans: no job could populate their prices, and an empty plan is
-- worse than an absent one.
--
-- Idempotent: safe to re-apply (upsert on the primary key).
-- =============================================================================

insert into public.harness_products
  (id, name, slug, vendor, website, docs_url, pricing_url, changelog_url, open_source, repo_url, platforms, active)
values
  ('harness:command-code', 'Command Code', 'command-code', 'Command Code',
   'https://commandcode.ai', 'https://commandcode.ai/docs', 'https://commandcode.ai/pricing',
   'https://commandcode.ai/changelog', false, null, array['cli', 'ide'], true),
  ('harness:opencode', 'OpenCode', 'opencode', 'OpenCode',
   'https://opencode.ai', 'https://opencode.ai/docs', 'https://opencode.ai/pricing',
   'https://opencode.ai/changelog', true, 'https://github.com/sst/opencode',
   array['cli', 'desktop', 'web'], true),
  ('harness:claude-code', 'Claude Code', 'claude-code', 'Anthropic',
   'https://claude.com/product/claude-code', 'https://docs.claude.com/en/docs/claude-code',
   'https://claude.com/pricing', 'https://docs.claude.com/en/release-notes/claude-code',
   false, null, array['cli', 'ide', 'web', 'desktop', 'cloud_agent'], true),
  ('harness:openai-codex', 'OpenAI Codex', 'openai-codex', 'OpenAI',
   'https://openai.com/codex', 'https://developers.openai.com/codex', 'https://openai.com/chatgpt/pricing',
   'https://openai.com/products/release-notes/', false, null,
   array['cli', 'ide', 'web', 'cloud_agent'], true),
  ('harness:gemini-cli', 'Gemini CLI', 'gemini-cli', 'Google',
   'https://github.com/google-gemini/gemini-cli', 'https://google-gemini.github.io/gemini-cli/',
   'https://ai.google.dev/pricing', 'https://github.com/google-gemini/gemini-cli/releases',
   true, 'https://github.com/google-gemini/gemini-cli', array['cli', 'ide'], true),
  ('harness:kilo-code', 'Kilo Code', 'kilo-code', 'Kilo Code',
   'https://kilo.ai', 'https://kilocode.ai/docs', 'https://kilo.ai/pricing',
   'https://github.com/Kilo-Org/kilocode/releases', true, 'https://github.com/Kilo-Org/kilocode',
   array['ide', 'cli'], true),
  ('harness:freebuff', 'Freebuff', 'freebuff', 'Freebuff',
   'https://freebuff.ai', null, 'https://freebuff.ai/pricing', null, false, null,
   array['web', 'cli'], true),
  ('harness:cursor', 'Cursor', 'cursor', 'Anysphere',
   'https://cursor.com', 'https://docs.cursor.com', 'https://cursor.com/pricing',
   'https://cursor.com/changelog', false, null, array['ide', 'cli', 'web', 'cloud_agent'], true),
  ('harness:windsurf', 'Windsurf', 'windsurf', 'Windsurf',
   'https://windsurf.com', 'https://docs.windsurf.com', 'https://windsurf.com/pricing',
   'https://windsurf.com/changelog', false, null, array['ide', 'web'], true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  vendor = excluded.vendor,
  website = excluded.website,
  docs_url = excluded.docs_url,
  pricing_url = excluded.pricing_url,
  changelog_url = excluded.changelog_url,
  open_source = excluded.open_source,
  repo_url = excluded.repo_url,
  platforms = excluded.platforms,
  active = excluded.active;

insert into public.harness_plans (id, product_id, canonical_plan_key, name, active)
values
  ('plan:command-code:go', 'harness:command-code', 'command-code-go', 'Go', true),
  ('plan:command-code:goat', 'harness:command-code', 'command-code-goat', 'GOAT', true),
  ('plan:opencode:go', 'harness:opencode', 'opencode-go', 'Go', true),
  ('plan:kilo-code:individual-free', 'harness:kilo-code', 'kilo-individual-free', 'Individual platform', true),
  ('plan:kilo-code:pass', 'harness:kilo-code', 'kilo-pass', 'Kilo Pass', true),
  ('plan:claude-code:pro', 'harness:claude-code', 'claude-pro', 'Claude Pro', true),
  ('plan:claude-code:max', 'harness:claude-code', 'claude-max', 'Claude Max', true),
  ('plan:freebuff:free', 'harness:freebuff', 'freebuff-free', 'Ad-supported free tier', true),
  ('plan:cursor:pro', 'harness:cursor', 'cursor-pro', 'Pro', true),
  ('plan:windsurf:pro', 'harness:windsurf', 'windsurf-pro', 'Pro', true)
on conflict (id) do update set
  product_id = excluded.product_id,
  canonical_plan_key = excluded.canonical_plan_key,
  name = excluded.name,
  active = excluded.active;
