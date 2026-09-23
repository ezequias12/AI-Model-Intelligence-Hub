-- Task economics: cost and token counts per Artificial Analysis Intelligence Index task.
--
-- Both values are vendor observations, not figures this product recomputes:
-- `cost_per_task` is published on the Artificial Analysis free API tier, and the
-- answer/reasoning token split is published in the web dataset (their API exposes
-- it on the Pro tier only). They are stored per model so the cost-per-task and
-- tokens-per-task charts can read them directly.
--
-- Additive and nullable: existing rows keep working and render an em dash until
-- the next sync populates them.

alter table public.models
  add column if not exists cost_per_task_usd numeric,
  add column if not exists answer_tokens_per_task numeric,
  add column if not exists reasoning_tokens_per_task numeric;

comment on column public.models.cost_per_task_usd is
  'Weighted average cost in USD to run one Artificial Analysis Intelligence Index task. Vendor figure.';
comment on column public.models.answer_tokens_per_task is
  'Weighted average answer tokens per Intelligence Index task. Vendor figure, web dataset.';
comment on column public.models.reasoning_tokens_per_task is
  'Weighted average reasoning tokens per Intelligence Index task. Vendor figure, web dataset.';
