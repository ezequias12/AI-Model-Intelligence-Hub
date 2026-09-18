# Information architecture

The navigation model is defined in `src/lib/nav.ts` and is the single source of truth
for the shell, the command palette index and the mobile tabs.

## Primary left rail

Four sections, in this order.

| Section | Items |
| --- | --- |
| Core | Overview (`/`), Models (`/models`), Compare (`/compare`) |
| Intelligence | News (`/news`), Harness Watch (`/harness`), World & Politics (`/world`) |
| Personal | Watchlists (`/watchlists`) |
| System | Sources (`/sources`), Methodology (`/methodology`) |

Items with `matchPrefix: true` (Models, News, Harness Watch) stay highlighted on their
nested routes. `isActivePath()` and `workspaceForPath()` implement that matching;
`workspaceForPath` sorts by descending path length so `/models/table` resolves to the
Models workspace rather than to a shorter prefix.

Compact labels are available when horizontal space is constrained: Models, News,
Harness, World. The canonical product name is never shortened in a title or document.

## Workspaces and sub-navigation

`WORKSPACES` in `src/lib/nav.ts` declares the sub-navigation rendered inside a
workspace.

| Workspace | Base path | Sub-navigation |
| --- | --- | --- |
| Models | `/models` | Dashboard, Rankings, Landscape, Table, Releases |
| News | `/news` | Overview, AI General, Providers, Social Pulse, Research |
| Harness Watch | `/harness` | Overview, Plans, Compare, Cheapest, Changes, News, Calculator |

World & Politics (`/world`) uses region tabs rather than a workspace definition. The
tab order comes from `WORLD_TAB_ORDER` in `src/lib/domain/world.ts`: Top, Argentina,
United States, Latin America, World, Economy, Regulation, Geopolitics, Elections,
Conflict / Diplomacy.

## Route inventory

| Route | Kind | Purpose |
| --- | --- | --- |
| `/` | Page | Cross-domain overview: market pulse, model changes, top value, news, harness changes, world strip, freshness |
| `/models` | Page | Metric leaders and a fast market read |
| `/models/rankings` | Page | All Top 10 boards in one grid |
| `/models/landscape` | Page | Configurable scatter charts with Pareto frontier |
| `/models/table` | Page | Dense research table, sorting, column selection, pinning, CSV export |
| `/models/releases` | Page | Chronological releases, deprecations and change events |
| `/models/[slug]` | Page | Model detail: identity, headline metrics, pricing, speed, snapshots, change events, related models, news |
| `/compare` | Page | Full-width comparison with a Models mode and a Harness plans mode |
| `/news` | Page | News overview with search and saved searches |
| `/news/ai` | Page | AI General |
| `/news/providers` | Page | Provider-specific feeds |
| `/news/social` | Page | Social pulse from authorized APIs |
| `/news/research` | Page | Benchmarks, methodology and evaluation changes |
| `/harness` | Page | Monitored products and recent plan changes |
| `/harness/plans` | Page | Every active plan with price, credits and model access |
| `/harness/compare` | Page | Selected-plan comparison |
| `/harness/cheapest` | Page | Factual cheapest-option views, each with its formula |
| `/harness/changes` | Page | Chronological plan/price change feed |
| `/harness/news` | Page | Harness ecosystem news |
| `/harness/calculator` | Page | "What should I pay for?" with transparent fit scoring |
| `/world` | Page | Neutral world and political feed with region tabs |
| `/watchlists` | Page | Locally persisted watchlists |
| `/sources` | Page | Source registry, adapter status, freshness, rate limits, errors |
| `/methodology` | Page | How every derived number is produced and what it does not claim |
| `/not-found` | Page | 404 |
| `/error` | Page | Error boundary |
| `GET /api/health` | Route handler | Data mode, degraded state, configured capabilities |
| `POST /api/jobs/[job]` | Route handler | Signature-verified ingestion job endpoint |
| `GET /api/jobs/[job]` | Route handler | Lists the registered jobs and their crons |

## Shell chrome

Rendered by `src/app/layout.tsx` through `AppShell`:

- workspace title and description for the active route;
- command palette search over pages, models, providers, harness plans, sources and the
  60 most recent news items (`src/lib/search/index.ts`);
- a freshness label computed from the dataset capture time with model-domain
  thresholds;
- a data-mode label ("Mock data" or "Live") and a banner when mock or degraded;
- theme toggle with a pre-hydration init script.

## Deep links and shareable state

Selection state is encoded in query parameters so a URL reproduces a view.

| Workspace | Parameter | Storage key |
| --- | --- | --- |
| Models | `?models=id,id,...` | `amih.models.selection.v1`, `amih.models.selectionSource.v1` |
| Compare (models) | same as Models | same as Models |
| Compare (harness plans) | `?plans=id,id,...` | `amih.harness.selection.v1` |
| Harness plan compare | `?plans=` | `amih.harness.selection.v1` |
| Model table | column choice and sorting | local storage in `model-table.tsx` |
| Watchlists | none (local only) | `amih.watchlists.v1` |
| News saved searches | none (local only) | saved-search key in `news-search.tsx` |

`reconcileSelection()` drops ids that no longer exist, so a stale shared link degrades
gracefully rather than erroring.

## Mobile

`MOBILE_TABS` in `src/lib/nav.ts` replaces the rail with five tabs: Models, News,
Watch, World, More. `Playwright` is configured with `chromium-desktop` and `chromium-mobile`
(Pixel 7) projects, and the smoke specs live under `tests/e2e`.
