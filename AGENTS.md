# AGENTS.md

Mandatory rules for any agent (human or automated) working in this repository.
These ten rules are non-negotiable.

## The ten rules

1. **Read project status first.** Before changing anything, read
   `docs/00-overview/project-status.md`. It states what is implemented, what is
   pending credentials and what is not implemented at all.
2. **Read the agent handoff.** Then read `docs/09-handoffs/agent-handoff.md` for the
   current first task, open threads and known pitfalls.
3. **Inspect git status.** Run `git status` (and `git log` when history exists)
   before editing, so you do not build on top of uncommitted or unexpected changes.
   At the time of writing the repository has no commits yet and every file is
   untracked.
4. **Search project memory if available.** If Engram (or any memory tool) is
   configured, search it for prior decisions on this project before inventing a new
   approach.
5. **Never commit secrets.** No API key, service-role key, token or connection
   string may be committed. Use `.env.local` (git-ignored) and `.env.example` for
   placeholders. `SUPABASE_SERVICE_ROLE_KEY`, `QSTASH_TOKEN`, `QSTASH_*_SIGNING_KEY`,
   `X_BEARER_TOKEN`, `WORLD_NEWS_API_KEY`, `LLM_SUMMARY_API_KEY` and
   `ARTIFICIAL_ANALYSIS_API_KEY` are server-only.
6. **Use mock mode when credentials are missing.** Do not stub a live path, and do
   not present fixture data as live. Missing credentials are not a reason to stop:
   implement the adapter, add fixtures and contract tests, document the pending
   variable, then move on.
7. **Use official documentation for evolving integrations.** API shapes change.
   Verify Artificial Analysis, Supabase, QStash and provider endpoints against their
   current official documentation rather than trusting a comment in the code.
8. **Run checks before claiming success.** Run `npm run typecheck`, `npm run test`
   and `npm run build` (or `npm run check`) and report the exact result. Never claim
   a test, benchmark or build passed without running it.
9. **Create an ADR for architecture decisions.** Non-trivial structural decisions go
   into `docs/02-decisions/` using `docs/_templates/ADR-template.md`.
10. **Update the handoff before ending.** Update
    `docs/09-handoffs/agent-handoff.md` and `docs/09-handoffs/session-log.md`, and
    refresh `docs/03-implementation/current/` if status changed.

## Scope boundaries

- Do not fabricate documentation. Read the code, the migrations and the tests, and
  describe what is actually there.
- Do not modify `src/`, `tests/`, `supabase/` or `scripts/` when the task is
  documentation-only. Documentation changes belong in `docs/` and the root markdown
  files.
- Do not perform billable, destructive or irreversible operations (domain
  purchases, plan upgrades, `supabase projects delete`, force pushes to shared
  branches) without explicit authorization.
- Do not reintroduce the old working name. The canvas name is **AI Model
  Intelligence Hub** (see `CANONICAL_NAMING.md`).

## Check commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run check` chains all five. `npm run test:e2e` runs the Playwright suite in
`tests/e2e` against the `chromium-desktop` and `chromium-mobile` projects; it
builds and starts the app on port 3100 in mock mode first, so a clean run takes a
couple of minutes.

`npm run dev` goes through `scripts/dev.mjs`, which pins `NODE_ENV=development`.
A machine with a globally exported `NODE_ENV=production` otherwise makes Next.js
compile in production mode and break the CSS pipeline. The same variable also
makes `npm install` omit devDependencies, so use `npm ci --include=dev`.
