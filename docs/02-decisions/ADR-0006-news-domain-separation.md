# ADR-0006: News domains are separated, and the political domain cannot score models

- Status: Accepted
- Date: 2026-09-18
- Deciders: implementation agent (autonomous phase)

## Context

The product carries five kinds of current-affairs signal: general AI news, provider-specific
news, social posts, research and benchmark signal, and coding-harness news. It also carries
world and political news as an explicitly requested separate feed.

Presenting those as one undifferentiated feed has two problems. First, it is unusable: a
research paper, a pricing change and a political headline demand different reading and
different freshness expectations. Second, and more seriously, mixing political content into
the same store as model and harness data creates the possibility - by accident, through a
later feature - that political material influences model or harness recommendations, or that
the product develops a view about a political story.

The product must be able to describe a contested political event without adjudicating it,
and it must never compute an ideological sentiment, recommend a candidate or party, or rank
political actors. Those are not stylistic preferences; they are correctness requirements,
and "we will be careful" is not an implementation.

## Decision

1. **Domains are explicit and typed.** `news_domain` is one of `ai_general`, `provider`,
   `social`, `research`, `harness`, `world_politics`, and it is a checked column in both
   `news_items` and the Zod schema. `news_category` is a separate 16-value enum.
2. **Political content has its own table and its own adapter group.** World items live in
   `public.world_news_items` with their own columns (`region`, `event_at`,
   `primary_source_url`, `country_codes`, `multiple_accounts`, `developing`), and enter the
   system only through `src/lib/adapters/world.ts`. The table is commented in SQL:
   "Separate editorial domain. Never read by model or harness scoring code, and never used
   for user profiling."
3. **Neutrality is enforced in code, not in intent.** `src/lib/domain/world.ts` defines
   `FORBIDDEN_PATTERNS`, six rule families with a reason each: endorsement/voting advice,
   electoral prediction, unattributed verdict, ideological scoring, dehumanizing language,
   and ranking of political actors. `findNeutralityViolations()` and `isNeutral()` apply
   them. The world adapter runs each summary through the gate and drops a non-neutral
   summary while keeping the attributable item, recording the drop reason.
4. **Summaries are attribution-first.** `buildAttributionSummary()` prefixes every claim
   with its source, states explicitly that accounts differ and that the app does not
   adjudicate, and labels developing stories.
5. **Contested claims are flagged, not resolved.** `multiple_accounts` is set on the item
   and the UI shows the sources. `developing` is a badge.
6. **Structural isolation is asserted in tests.** `assertNoPoliticalMetrics()` rejects any
   metric key containing `political`, `ideolog` or `partisan`, and
   `tests/unit/world-neutrality.test.ts` asserts that every ranking board metric key is a
   registered non-political metric, that guardrail patterns fire on advocacy and prediction
   text, that they do not fire on descriptive attributed reporting, and that every fixture
   summary passes the guardrail.
7. **Trust tiers describe provenance, not viewpoint.** Tier 1 official/primary, tier 2
   established reporting, tier 3 social or uncorroborated. The SQL comment states: "Never a
   viewpoint."

## Consequences

Positive:

- Political content cannot reach model or harness scoring through a shared code path: there
  is no such path, and a test asserts the metric namespace is clean.
- The neutrality rules are reviewable and testable, so a regression is a failing test rather
  than a judgement call.
- The Workspace tabs (Top, Argentina, United States, Latin America, World, Economy,
  Regulation, Geopolitics, Elections, Conflict / Diplomacy) map to a typed `region` column,
  so filtering is honest.
- Readers can see disagreement. A story with conflicting accounts shows both rather than a
  synthesized conclusion.

Negative:

- The forbidden-pattern scan is regex-based and English-only. It catches the obvious
  categories and will miss paraphrases, other languages and subtle framing. It is a floor,
  not a guarantee.
- A non-neutral summary is dropped rather than rewritten, so an item can arrive with a
  headline and a link but no summary. That is the intended trade-off, but it degrades the
  reading experience for affected items.
- World and AI news cannot be searched in one query, because they live in different tables.
  A cross-domain search would require an explicit union, which has not been built.
- Adding a political category means changing a checked constraint in two tables and two Zod
  enums, which is deliberately friction.
- `country_codes` is bounded by a curated `COUNTRY_NAMES` map; an unknown code falls back to
  the raw code rather than being resolved.

## Alternatives considered

1. **One shared news table with a `domain` column only.** Rejected. It puts political items in
   the same store as model data, which makes accidental coupling a matter of discipline
   rather than structure, and it cannot express the world-specific fields.
2. **Score political sentiment.** Rejected explicitly. It is not supportable, it invites
   partisan outcomes, and the product has no mandate to characterise viewpoints.
3. **Summarize political stories with an LLM and publish the result.** Rejected as the
   default. The gate exists because a generated political summary can assert things no
   source said. If summarisation is ever added for this domain, it must be constrained to
   attribution and pass the same gate.
4. **Use a shared trust-tier chart that includes ideological leaning.** Rejected. Trust tier is
   provenance; a leaning axis is exactly the kind of scoring the product refuses.
5. **Stylistic guidance in documentation only.** Rejected. Documentation does not fail a build.
   The guardrails are code plus tests precisely so that "be careful" is not the control.
