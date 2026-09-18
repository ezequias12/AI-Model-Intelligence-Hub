# Glossary

Definitions are fixed. Where the product uses a term in a narrower sense than common
usage, the narrow sense applies.

| Term | Definition |
| --- | --- |
| **AI Model Intelligence Hub** | The canonical product name. Never abbreviated in titles or documentation. |
| **Harness / coding harness** | A coding-agent product or CLI (Command Code, OpenCode, Claude Code, Codex, Gemini CLI, Kilo Code, Freebuff, Cursor, Windsurf) that is subscribed to rather than called per token. |
| **Plan** | A purchasable subscription tier of a harness product. Identified by a stable `canonicalPlanKey` so a rename does not fork its history. |
| **Snapshot** | An observed state of an entity at a capture time. `model_snapshots` holds model metric states; `harness_plan_snapshots` holds plan states. Snapshots are append-only. |
| **Change event** | A recorded difference between two snapshots, or an observed event such as a CLI release or a promotion. Stored in `change_events` and `harness_change_events` with before/after JSON. |
| **Measured metric** | A metric taken from a source payload (for example `intelligence` or `outputSpeedTps`). |
| **Derived metric** | A metric computed in this repository from measured inputs (for example `blendedPrice` or `weightedValue`). |
| **Blended price** | USD per 1M tokens computed as `inputPrice * w_input + outputPrice * w_output`, defaulting to 75% input / 25% output. The weighting is an explicit, configurable assumption. |
| **Value score** | Capability units per blended dollar. Four modes exist: `intelligence_per_dollar`, `coding_per_dollar`, `agentic_per_dollar` and `weighted_value`. There is no universal score. |
| **Weighted value** | Value mode using min-max normalized intelligence (0.5), coding (0.3) and agentic (0.2) divided by blended price. Components are returned so the UI can show them. |
| **Minimum capability threshold** | A floor applied before cost-efficiency ranking so cheap-but-weak models cannot silently top a board. |
| **Pareto frontier** | The set of points where no other point is at least as good on both axes and strictly better on one. Directions are explicit, so a lower-is-better price axis is handled correctly. |
| **Freshness** | The age of a value, classified `fresh`, `aging`, `stale` or `unknown` against per-domain thresholds. Unknown values are never presented as fresh. |
| **Data mode** | `mock` (deterministic fixtures, no credentials) or `live` (real adapters). Resolved from `NEXT_PUBLIC_DATA_MODE`; anything unrecognised falls back to `mock`. |
| **Degraded live mode** | A state where live mode was requested but a required integration (Supabase) is missing. Fixtures are served with a visible "Live mode - degraded" label and the reason. |
| **Adapter** | A module that turns a source payload into domain objects and returns the shared `AdapterResult` envelope. |
| **Ingestion run** | One execution of a job against one source, recorded in `ingestion_runs` with counts, rate-limit state, error and an idempotency key. |
| **Idempotency key** | A stable key (`{sourceId}:{jobKey}:{hour}`) that makes a repeated run record the same row instead of duplicating it. |
| **Trust tier** | Provenance quality of a news item. Tier 1 official/primary, tier 2 established reporting, tier 3 social or uncorroborated. Never a political viewpoint. |
| **News domain** | One of `ai_general`, `provider`, `social`, `research`, `harness`, `world_politics`. |
| **Canonical URL** | A URL after tracking parameters, fragment, `www.` prefix and trailing slash are removed and the host is lowercased. Used as the dedupe identity of a story. |
| **Cluster** | A group of news items reporting the same event. The anchor is the highest-trust item, tie-broken by earliest publication. |
| **Provider group** | `mainstream_global`, `china_based` or `other`. A geographic/structural classification. Never a quality judgement. |
| **Open weight** | Whether model weights are publicly available. Stored on the model, not the provider. |
| **BYOK** | Bring your own key: the plan lets the user supply their own provider credentials instead of using bundled inference. |
| **Frontier model access** | `true` only when a plan documents access to a frontier-tier model. Never inferred from price. |
| **Included credits** | The USD value of inference bundled into a plan's price, as documented by the vendor. |
| **Credit per dollar** | Derived: `includedCreditsUsd / monthlyPriceUsd`. `null` when either input is missing. |
| **Documented request estimate** | A vendor-published request allowance. Never inferred; when the vendor does not publish one, the derived per-dollar figure is `null`. |
| **Neutrality guardrail** | A code-level rule in `src/lib/domain/world.ts` that rejects advocacy, prediction, unattributed verdicts, ideological scoring, dehumanizing language and ranking of political actors. |
| **`multipleAccounts`** | Set on a world news item when sources disagree. The UI shows the sources instead of a synthesized verdict. |
| **`developing`** | Set when facts may change. Rendered as a badge, not as a conclusion. |
| **Command palette** | The client-side search overlay over a serialised index of pages, models, providers, plans, sources and recent news. |
| **Selection tray** | The persistent chip row at the top of the Models workspace showing the current comparison set. |
| **Default comparison set** | The selection resolved dynamically from provider metadata and current metrics by `resolveDefaultSelection`, not hard-coded model names. |
| **Preset** | A named selection strategy: Frontier, Best Value, Fast, Coding, Agentic, Open / Open-weight, Mainstream Providers, China-based Labs, Custom. |
