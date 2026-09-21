-- =============================================================================
-- 0010 — Add the Hugging Face popularity metrics to public.models
--
-- `hfDownloads` and `hfLikes` are popularity signals from the Hugging Face Hub,
-- never capability measures. They are nullable: a closed model has no Hub page
-- and renders as an em dash.
--
-- Idempotent: `add column if not exists`, safe to re-run.
-- =============================================================================

alter table public.models add column if not exists hf_downloads numeric;
alter table public.models add column if not exists hf_likes numeric;

comment on column public.models.hf_downloads is
  'Hugging Face 30-day download count. Popularity, not capability.';
comment on column public.models.hf_likes is
  'Hugging Face like count. Popularity, not capability.';
