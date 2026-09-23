# 2026-09-23 - Interface redesign: Fina light, Vercel dark, one blue brand

**Scope:** a full visual redesign of every workspace, driven by three references (Vercel for dark,
the owner's Fina project for light, a prior GPT Astra mockup for salvageable ideas), with
functionality treated as a hard guardrail. No domain logic, data source, route or capability was
added or removed.

**What was done**

1. **Token layer rewritten** (`src/app/globals.css`, `tailwind.config.ts`). Light mode adopts
   Fina's surfaces: page background `#f3f6fd`, white cards, borders `#e1e8f5`, brand blue
   `#2b57f0`, a barely-there blue-tinted card shadow. Dark mode adopts Vercel's: background
   `#0a0a0a`, surface `#111111`, raised `#191919`, border `#2a2a2a`, text `#fafafa`, pure neutral
   (no hue in the neutrals), elevation carried by the hairline. Added `border-strong`, `shadow-card`
   and `chart-1..6` tokens. The brand accent moved from cyan-teal (hue 192) to blue.
2. **Self-hosted Geist** (`geist` package) wired in `src/app/layout.tsx` with the system stack kept
   as a fallback, so offline builds behave as before. `themeColor` updated to the new surfaces.
3. **Shared chart theme** (`src/components/charts/theme.ts`): one series palette, shared axis,
   grid, tooltip and legend definitions, a tick formatter and a deterministic accent helper.
   `model-history-chart.tsx`, `landscape-charts.tsx`, `plan-board.tsx` and the analytics
   provider-colour fallback now read from it instead of carrying literals.
4. **Two chart defects fixed while theming.** The Recharts legend wrapper was overriding the
   default `width: 100%`, so legend entries stacked on top of each other; and axis ticks rendered
   raw floats (`0.35000000000000003`). The redundant in-chart X axis label on the landscape charts
   was dropped (the card header already states the axis mapping, and it collided with the legend),
   and the duplicate static legend on the snapshot history chart was dropped because the
   interactive series toggles above it already carry every label.
5. **Metric leaders restructured** (`src/features/models/metric-leaders.tsx`) into three primary
   readings (highest intelligence, best weighted value, fastest output) and five compact
   secondary ones. All eight readings still render; the tier is hierarchy, not a filter.
6. **Shell and primitives aligned** to the blue accent: `app-shell.tsx` active states, button
   hover/active, input and select hover borders, panel elevation, segmented control selection.
7. **Two responsive defects found and fixed during the visual audit.**
   - `filter-bar.tsx`: the six-option Provider segmented control could not shrink, forcing the
     document 36px wider than a 390px viewport. It now scrolls inside its own box.
   - `compare-view.tsx`: a visually-hidden span inside a table cell is absolutely positioned, and
     with no containing block in the scroll wrapper it resolved against a distant ancestor and
     stretched the document by 323px. The wrapper is now `relative`.
8. **Accessibility regression caught and corrected.** The first pass used Fina's semantic colours
   verbatim; the axe audit failed 28 contrast assertions at badge size. Light-mode semantic ink was
   darkened until AA was restored, keeping Fina's surfaces.

**Verified**

- `npm run format`, then `npm run check` exits 0: format, lint (no warnings), typecheck, 267 tests
  across 13 files, and a 26-route production build.
- `npm run test:e2e` (Playwright, desktop and mobile projects, mock mode): **205 passed, 5 skipped,
  0 failed**, including all 28 axe audits.
- Visual sweep with a Playwright script, not only by reading code: **96 combinations** (24 routes ×
  light/dark × 1440px/390px). Final result: 96/96 HTTP 200, 96/96 with no horizontal overflow, and
  zero uncaught page errors. The only console output on 18 of them is Next.js' dev-mode
  "Failed to fetch RSC payload ... Falling back to browser navigation" prefetch cancellation, which
  cannot occur in a production build. Two real overflows were found this way and fixed.
- The theme toggle was exercised by a real click (light → dark → light): the `dark` class, inline
  `color-scheme` and persisted `amih.theme.v1` all follow, with body backgrounds `rgb(242,246,253)`
  and `rgb(10,10,10)` respectively.

**Open**

- No dark-mode contrast audit exists in the suite: `tests/e2e/axe.spec.ts` runs in the Playwright
  default colour scheme, which is light. Dark-mode contrast was reviewed visually only.
- The untracked `supabase/all_migrations_combined.sql` predates this work and was left untouched.
