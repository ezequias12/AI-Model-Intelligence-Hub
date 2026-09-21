-- =============================================================================
-- 0012 — Seed the curated provider registry
--
-- Provider grouping is a geographic/structural classification, never a quality
-- judgement, and it is never inferred from a metric payload (ADR-0005). The
-- curator maintains it here; `sync-models` preserves these columns instead of
-- overwriting them with its deliberate `group: "other"` (KI-19).
--
-- Names, domains, regions and colours are curated metadata for the providers the
-- product tracks. Providers that appear only in a live payload stay `other`
-- until curated here.
--
-- Idempotent: upsert on `id`.
-- =============================================================================

insert into public.providers
  (id, slug, name, domain, country_code, region, provider_group, logo_url, color, active, source_id)
values
  ('provider:openai', 'openai', 'OpenAI', 'openai.com', 'US', 'United States', 'mainstream_global', null, '#10a37f', true, 'internal:provider-registry'),
  ('provider:anthropic', 'anthropic', 'Anthropic', 'anthropic.com', 'US', 'United States', 'mainstream_global', null, '#d97757', true, 'internal:provider-registry'),
  ('provider:google', 'google', 'Google DeepMind', 'deepmind.google', 'US', 'United States', 'mainstream_global', null, '#4285f4', true, 'internal:provider-registry'),
  ('provider:xai', 'xai', 'xAI', 'x.ai', 'US', 'United States', 'mainstream_global', null, '#1d1d1f', true, 'internal:provider-registry'),
  ('provider:meta', 'meta', 'Meta', 'ai.meta.com', 'US', 'United States', 'mainstream_global', null, '#0866ff', true, 'internal:provider-registry'),
  ('provider:mistral', 'mistral', 'Mistral AI', 'mistral.ai', 'FR', 'European Union', 'mainstream_global', null, '#fa520f', true, 'internal:provider-registry'),
  ('provider:cohere', 'cohere', 'Cohere', 'cohere.com', 'CA', 'Canada', 'mainstream_global', null, '#39594d', true, 'internal:provider-registry'),
  ('provider:microsoft', 'microsoft', 'Microsoft', 'microsoft.com', 'US', 'United States', 'other', null, '#00a4ef', true, 'internal:provider-registry'),
  ('provider:amazon', 'amazon', 'Amazon', 'aws.amazon.com', 'US', 'United States', 'other', null, '#ff9900', true, 'internal:provider-registry'),
  ('provider:nvidia', 'nvidia', 'NVIDIA', 'nvidia.com', 'US', 'United States', 'other', null, '#76b900', true, 'internal:provider-registry'),
  ('provider:deepseek', 'deepseek', 'DeepSeek', 'deepseek.com', 'CN', 'China', 'china_based', null, '#4d6bfe', true, 'internal:provider-registry'),
  ('provider:alibaba', 'alibaba', 'Alibaba Qwen', 'qwen.ai', 'CN', 'China', 'china_based', null, '#615ced', true, 'internal:provider-registry'),
  ('provider:moonshot', 'moonshot', 'Moonshot AI', 'moonshot.ai', 'CN', 'China', 'china_based', null, '#0b0b0f', true, 'internal:provider-registry'),
  ('provider:minimax', 'minimax', 'MiniMax', 'minimax.io', 'CN', 'China', 'china_based', null, '#e8543f', true, 'internal:provider-registry'),
  ('provider:zhipu', 'zhipu', 'Z.ai (Zhipu)', 'z.ai', 'CN', 'China', 'china_based', null, '#3859ff', true, 'internal:provider-registry'),
  ('provider:xiaomi', 'xiaomi', 'Xiaomi', 'xiaomi.com', 'CN', 'China', 'china_based', null, '#ff6900', true, 'internal:provider-registry')
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  domain = excluded.domain,
  country_code = excluded.country_code,
  region = excluded.region,
  provider_group = excluded.provider_group,
  color = excluded.color,
  active = excluded.active,
  source_id = excluded.source_id;
