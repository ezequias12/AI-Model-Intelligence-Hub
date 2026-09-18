# Accessibility

Target: WCAG 2.2 AA fundamentals. This document records what is implemented in the code, what
is reviewed manually, and what is not verified. No audit has been run. Automated coverage is
limited to the structural assertions in `tests/e2e/accessibility.spec.ts`; no axe dependency is
installed, so there is no full WCAG scan.

## Implemented

| Capability | Implementation |
| --- | --- |
| Skip link | `src/components/shell/app-shell.tsx` renders a "Skip to content" link that is `sr-only` until focused, targeting `#workspace-content` on the `<main>` element |
| Landmarks | `<aside>` for the rail, `<header>`, `<main id="workspace-content">`, `<footer>`, and three `<nav>` elements |
| Navigation labelling | The workspace sub-navigation has `aria-label="{workspace} sections"`, the mobile drawer has `aria-label="Mobile navigation"`, and the bottom tab bar has `aria-label="Primary"` |
| Current location | Active rail items, sub-navigation items and bottom tabs set `aria-current="page"` |
| Decorative icons | Every `lucide-react` icon that carries no meaning sets `aria-hidden="true"` |
| Icon-only controls | Toggle and icon buttons carry `aria-label` ("Toggle navigation", "Collapse navigation", "Expand navigation", "Open command palette", "Delete {name}", "Remove {label}") |
| Disclosure state | The mobile navigation toggle exposes `aria-expanded={mobileOpen}` |
| Focus visibility | `:focus-visible` applies a two-pixel ring with an offset (`globals.css`) |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` collapses animation and transition durations to 0.001ms and disables smooth scrolling |
| Text zoom | `-webkit-text-size-adjust: 100%` on `html` |
| Table semantics | Data tables use `<table>` with a `<caption className="sr-only">`, for example "Model comparison across every registered metric", "Harness plan comparison", and per-view captions in the sources, landscape and methodology views |
| Link affordance | External links include an `sr-only` note such as "(opens in a new tab)" in the world, news, social and sources views |
| Keyboard command palette | Cmd/Ctrl+K opens the palette from anywhere; the palette is built on a native `<dialog>` element with a backdrop |
| Tabular numerals | A `.tabular` class sets `font-variant-numeric: tabular-nums` so numeric columns align |
| Colour is not the only signal | Freshness, mode and status are conveyed with text labels ("Mock data", "Live mode - degraded", "Never synced", tier badges, "Developing", "Multiple accounts"); colour is supplementary |
| Theme contrast intent | Light and dark tokens are defined separately with a near-black dark background and elevated surfaces rather than a naive inversion |

## Manual review checklist

Run through this when adding or changing a screen. It is a checklist, not an automated test.

- [ ] Every interactive element is reachable by `Tab` in a sensible order.
- [ ] Focus is always visible; nothing sets `outline: none` without a replacement ring.
- [ ] Icon-only buttons have an accessible name.
- [ ] Charts have a text alternative. The landscape charts expose a caption and a table view;
      confirm the numbers are readable without the visual.
- [ ] A data table has a caption and header cells use `<th>` with a `scope` where relevant.
- [ ] Error and empty states are announced as text, not only as colour or an icon.
- [ ] New external links either announce that they open a new tab or are otherwise unambiguous.
- [ ] A new colour token meets 4.5:1 for body text and 3:1 for large text and UI boundaries in
      both themes.
- [ ] Motion added respects the reduced-motion media query.
- [ ] Zoom to 200% does not clip content or hide controls.
- [ ] The mobile layout keeps the bottom tabs reachable and the model chip scroller scrollable.

## Known gaps

| Gap | Detail |
| --- | --- |
| Structural checks only | `tests/e2e/accessibility.spec.ts` asserts a single `h1` per route, a `main` landmark, no unlabelled interactive control, skip-link focus, table column headers and table captions. No axe dependency (`@axe-core/playwright` or similar) is installed, so there is no full WCAG rule-by-rule audit |
| Limited keyboard-only coverage | The suite asserts skip-link focus and drives the command palette by keyboard; the wider keyboard journeys are still verified manually |
| No colour contrast measurement | Token values are chosen deliberately but have not been measured against the AA ratios |
| No screen reader verification | Nothing has been tested with NVDA, JAWS or VoiceOver |
| Chart text alternatives are partly visual | Charts render a caption and a companion table, but the scatter plots themselves are SVG; confirm the companion data is complete for each chart |
| Live regions | The command palette and filter changes do not announce result counts; there is no `aria-live` region anywhere in `src` |
| Focus trapping | The command palette and drawers use a native `<dialog>`; confirm the browser's focus containment behaves as required across targets |
| No `lang` variation | `src/app/layout.tsx` sets `lang="en"`; there is no multi-language content, but source headlines in other languages inherit that value |

## How to add accessibility coverage

1. Add `@axe-core/playwright` as a dev dependency. (Not started; no axe dependency is installed.)
2. Extend the Playwright specs to run an axe scan on each route. The suite already exists and
   asserts structural fundamentals across fourteen routes.
3. Fail the check on `serious` and `critical` violations, and review `moderate` findings
   per page.
4. Add the accessibility scan to the CI `e2e` job (`.github/workflows/ci.yml`).

## Related

- Known issues: KI-13 (no component tests, no axe accessibility automation)
- Files: `src/components/shell/app-shell.tsx`, `src/components/shell/command-palette.tsx`,
  `src/components/ui/{overlay,primitives,button,input,badge,card}.tsx`, `src/app/globals.css`,
  `src/features/models/landscape-charts.tsx`
- Reference: `docs/06-quality/testing-strategy.md`
