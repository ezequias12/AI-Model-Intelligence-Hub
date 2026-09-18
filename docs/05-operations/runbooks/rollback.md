# Runbook: rollback

**Severity:** depends on the trigger
**Typical signal:** a deployment or a migration caused an unintended behaviour change.

## Decide what you are rolling back

Three things can be rolled back, and they have different properties. Identify which one first.

| Layer | Reversible? | Method |
| --- | --- | --- |
| Application deployment | Yes | Vercel: promote a previous deployment, or redeploy a previous commit |
| Environment variables | Yes | Change the value and redeploy |
| Database schema | **Forward-only** | There are no down migrations. A rollback is a new forward migration. |
| Data written by ingestion | Not automatically | Data can be deleted by id, but there is no automatic undo |

## Symptom triage

| Symptom | Likely layer | First check |
| --- | --- | --- |
| Page renders but shows wrong or missing data | Application, or mode configuration | `/api/health` for `dataMode`, `degraded`, `degradedReason` |
| The shell says "Live mode - degraded" | Environment | `pendingCredentials` from `/api/health` |
| All data disappeared after a deploy | Environment | Whether `NEXT_PUBLIC_DATA_MODE` changed; remember `NEXT_PUBLIC_` values are inlined at build time |
| Jobs return 401 | Environment | `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` |
| Jobs return 500 | Environment | Signing keys missing while the mode is `live` |
| A column is missing or a query fails | Database | Whether a migration was applied and whether `src/lib/db/rows.ts` matches it |
| Build fails | Application | Build log: TypeScript or ESLint error |

## Immediate mitigation

### Application-only rollback

1. In Vercel, open the project's deployments and promote the last known-good deployment, or:
2. Revert the offending commit and redeploy:

```bash
git revert <commit>
git push
```

No database action is required for an application-only rollback.

Important: `NEXT_PUBLIC_*` values are compiled into the bundle. If the problem is a
`NEXT_PUBLIC_DATA_MODE` or `NEXT_PUBLIC_SUPABASE_URL` change, roll back by redeploying, not by
editing the environment variable alone.

### Environment rollback

1. Restore the previous values (see `docs/05-operations/environment-variables.md`).
2. Redeploy, because `NEXT_PUBLIC_` values are build-time.
3. Re-check `/api/health`.

### Database rollback

There are no down migrations in `supabase/migrations/`. Options, in order of preference:

1. **Revert forward.** Write a new migration that undoes the change, and apply it in order.
2. **Restore from a backup.** Supabase point-in-time recovery or a restoration from a snapshot.
   This loses everything written after the backup point, including ingested data.
3. **Manual repair** for a narrow, well-understood change. Never drop a table that holds
   snapshots or ingestion history unless you have confirmed the data is expendable.

If you must stop writes while the schema is inconsistent, disable the affected sources:

```sql
update public.sources set enabled = false where domain = 'harness';
```

## Verification after any rollback

- [ ] `GET /api/health` reports the expected `dataMode`, and `degraded` matches reality
- [ ] Whether `degraded` is `true`, the reason names the correct missing variables
- [ ] The Models workspace renders leader cards, boards and the table with rows
- [ ] The News, Harness and World workspaces render their expected datasets, or clearly labelled
      fixtures
- [ ] `npm run jobs:run sync-models --dry-run` reaches the endpoint and returns a job result
- [ ] A scheduled trigger is accepted (not 401) if QStash is configured
- [ ] Row-count sanity check on the main tables (`providers`, `models`, `model_snapshots`,
      `news_items`, `harness_plan_snapshots`)

## Data-specific notes

| Data | Note |
| --- | --- |
| Fixtures | Never persist. A rollback to mock mode simply serves the deterministic fixture bundle. |
| `models`, `providers` | Upserted by `id`, so a re-run repairs rather than duplicates. |
| `model_snapshots`, `harness_plan_snapshots` | Append-only. A bad batch must be deleted by `captured_at` range or by id. |
| `news_items`, `world_news_items` | Upserted on `(source_id, canonical_url)`; deleting the offending range is safe and a re-run will re-create current items. |
| `ingestion_runs` | A historical ledger. Do not delete rows to "clean up" unless the ledger itself is the problem. |
| `private.raw_ingestion_payloads` | Nothing writes to this table today, so there is nothing to roll back. |

## Prevention

- Verify locally before deploying: `npm run check` (format check, lint, typecheck, tests, build).
- Keep migrations additive and ordered; never edit an applied migration in place.
- Keep a record of the variables that were changed, and remember the `NEXT_PUBLIC_` build-time
  caveat.
- The CI workflow (`.github/workflows/ci.yml`) is committed but no CI run has executed yet, and
  there are no down migrations. The absence of down migrations is recorded in
  `docs/03-implementation/current/technical-debt.md`.

## Related

- Files: `supabase/migrations/**`, `next.config.ts`, `.env.example`
- Reference: `docs/05-operations/vercel-deployment.md`,
  `docs/05-operations/supabase-setup.md`, `docs/01-architecture/database-schema.md`
