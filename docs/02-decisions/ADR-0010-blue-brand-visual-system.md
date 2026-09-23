# ADR-0010: A blue brand on a Fina-light, Vercel-dark visual system

- Status: Accepted
- Date: 2026-09-23
- Deciders: project owner, implementation agent

## Context

The interface had a coherent system already: HSL semantic tokens in `src/app/globals.css`, a
role-based radius scale (`chip` / `control` / `panel` / `overlay`), native `<dialog>` overlays and
eight single-purpose UI primitives. What it did not have was an identity the owner recognised.

Three references were named. The dark theme should follow **Vercel** (pure neutral near-black,
1px hairlines, high contrast, developer-minimal). The light theme should follow **Fina**, an
existing product of the owner's (cool blue-tinted page background, white cards, brand blue
`#2b57f0`, near-invisible tinted shadows). A previous **GPT Astra** redesign existed as a
reference, but its own README scopes out World & Politics, Sources, ingestion, historical charts,
persistent lists and five of seven harness sub-pages, so it could not be adopted as a base.

Two constraints dominated. First, no functionality may be lost: every workspace, filter, metric,
ranking board, column, export and state has to survive. Second, the current brand accent was
**cyan-teal** (hue 192), and the code carried an explicit rationale for avoiding blue. The owner
asked for "the AI Hub blue", which does not exist yet as a token — so a brand decision had to be
made rather than inferred.

## Decision

The product has **one blue brand accent in both themes**, and neither theme is a recolour of the
other.

- **Light** takes its surfaces from Fina: page background `#f3f6fd` (blue-tinted, never neutral
  grey), white cards, borders `#e1e8f5`, brand blue `#2b57f0` as primary.
- **Dark** takes its surfaces from Vercel: background `#0a0a0a`, surface `#111111`, raised
  `#191919`, border `#2a2a2a`, text `#fafafa`. Neutrals carry no hue. Elevation is the hairline;
  the card shadow resolves to `none`.
- **The accent is an accent.** Blue is used for links, focus, active/selected states, chart series
  and small highlights. It is never painted across large surfaces, so dark does not become a blue
  theme.
- **Semantic text is darker than the reference palettes.** Badges render at 11px, so each semantic
  hue uses its own contrast-carrying ink rather than the brand tone of the hue.
- **Typography is self-hosted Geist** (Sans + Mono, via the `geist` package). No network font
  fetch, so offline builds behave as before.
- **Charts read one shared theme** (`src/components/charts/theme.ts`) so a series keeps its
  identity across views and a theme switch repaints without a React re-render.
- **Functionality is a guardrail, not a preference.** Salvable ideas from the Astra redesign were
  adopted as presentation only: a three-primary / five-secondary metric-leader hierarchy (all
  eight readings still render), progressive disclosure is avoided where the control set is already
  small, and the duplicate static chart legend was dropped where an interactive series toggle
  already carried the same labels.

## Consequences

Positive:

- Both themes are visibly designed rather than inverted, which was the original complaint.
- Colour is centralised: no component hardcodes a palette class, and the only remaining literals
  are third-party provider brand colours, which are data, not theme.
- The blueprint's page-level scope was preserved exactly. Nothing was removed to make a screen
  look cleaner.
- Two latent responsive defects were found and fixed while auditing (see Related): an
  unshrinkable segmented control and an absolutely-positioned visually-hidden span escaping a
  scroll container.

Negative:

- The accent change from cyan-teal to blue **reverses a documented design position**. The earlier
  rationale ("deliberately not the blue-violet every technology product reaches for") is gone; the
  product now opts into the more conventional choice deliberately.
- `geist` is a new runtime dependency, and Geist is the reference typeface of one of the two
  designs being followed — the result is closer to the references and less distinct from them.
- Semantic ink in light mode is darker than Fina's own palette, so a badge does not visually match
  Fina's equivalent badge. That divergence is intentional and required by WCAG AA.
- The token layer is now the single point of failure for the whole interface: a wrong value in
  `globals.css` propagates everywhere.

## Alternatives considered

1. **Keep the cyan-teal accent and treat it as "the blue".** Rejected: the owner asked for blue
   explicitly, and Fina's identity is blue, so keeping teal would have produced a light theme that
   matched neither reference.
2. **Adopt the Astra redesign as the new base.** Rejected: its own documentation states it omits
   World & Politics, Sources, ingestion, model history, persistent watchlists and most harness
   pages. Rebuilding from it would have meant re-implementing shipped functionality to gain a
   layout.
3. **Copy Vercel literally, including its accent-only palette.** Rejected: Vercel's system has no
   light mode of its own to speak of, and the brief asks for Fina in light. Something had to
   reconcile two systems; tokens do that, a copy does not.
4. **Use Fina's semantic colours verbatim in light mode.** Rejected on evidence: the axe audit
   failed 28 contrast assertions at badge size, so the ink was darkened until it passed.

## Related

- Files: `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`,
  `src/components/charts/theme.ts`, `src/components/ui/*`, `src/components/shell/app-shell.tsx`,
  `src/features/models/metric-leaders.tsx`, `src/features/compare/compare-view.tsx`,
  `src/features/models/filter-bar.tsx`
- Tests: `tests/e2e/axe.spec.ts` (14 routes × 2 viewports), `tests/e2e/accessibility.spec.ts`
- Supersedes: none (the earlier teal rationale lived only in code comments)
