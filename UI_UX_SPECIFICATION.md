# UI / UX Specification

## Visual direction

The design must be:
- professional;
- analytical;
- compact;
- modern;
- slightly editorial;
- highly legible.

It must NOT look like:
- a default shadcn admin template;
- a marketing landing page;
- a crypto dashboard;
- a neon AI site.

Reference mood:
- Linear precision;
- Vercel restraint;
- modern market/financial intelligence tools;
- clean Bloomberg-like density without visual clutter.

## App shell

### Left navigation
Width:
- expanded: ~220–248 px
- collapsed: ~64–72 px

Visual:
- same background family as content;
- subtle right border;
- no giant dark sidebar unless dark mode;
- clear active item;
- compact section labels.

### Global top area
Inside content, not another giant navbar.

Include:
- workspace title;
- global search / command palette;
- freshness state;
- optional theme;
- optional quick add.

### Content width
Use the full available desktop width intelligently.
Dense tables and charts should be allowed to expand.
Avoid narrow centered landing-page columns.

---

# Models UI

## Selected model tray

Position:
- directly below Models page header;
- sticky within Models workspace if it remains unobtrusive.

Structure:
- selected model chips/cards;
- provider color marker;
- model short name;
- remove icon;
- `+ Add model`;
- presets;
- reset.

Interaction:
- `+ Add model` opens Cmd-K style selector;
- search;
- provider groups;
- checkboxes;
- recent models;
- selected count;
- Apply.

Do not force one model at a time.

## Default model logic UI

Show a subtle label:
`Default comparison set`

When user modifies:
`Custom comparison set`

Reset action:
`Restore defaults`

## Provider group filter

Segmented control:
`All | Mainstream | China-based | Open-weight | Custom`

Second-level provider chips appear only when needed.

The phrase “China-based” is a geographic provider classification, never a quality label.

---

# Metric leaders

Use one horizontal strip of compact cards.

Card anatomy:
- small metric name;
- provider dot/logo;
- model name;
- big metric;
- tiny delta;
- source freshness.

Avoid massive KPI numbers.

---

# Rankings

Grid layout:
Desktop: 2–3 columns.
Tablet: 2.
Mobile: 1.

Each Top 10 card:
- title;
- methodology icon;
- selected/all toggle;
- provider filter;
- list 1–10.

Row:
- rank;
- model;
- provider;
- metric;
- optional delta;
- add/remove selection star/button.

The Cost Efficiency card is visually emphasized but not sensationalized.

---

# Landscape charts

Use large charts, not tiny dashboard thumbnails.

Each chart card has a compact toolbar:
- X
- Y
- bubble size
- scope
- provider group
- Pareto
- labels
- fullscreen

Tooltip:
- model
- provider
- selected metrics
- cost
- freshness
- source

Selected models get stronger opacity.
Unselected context models may be faint if “show market context” is enabled.

---

# Full model table

Use TanStack Table.

Sticky header.
Compact rows.
Resizable/optional columns if practical.

First column:
- selection checkbox
- provider indicator
- model
- pin

Right-click or overflow menu:
- Add to compare
- Open detail
- Watch model
- Copy link

Use horizontal scrolling gracefully.

---

# Model detail

Desktop:
- right drawer for quick inspect;
- full page for deep dive.

Drawer width ~480–560px.

Sections:
- identity
- headline metrics
- pricing
- latency/speed
- snapshot deltas
- latest news
- source metadata

Full page adds historical charts.

---

# News UI

## News Overview

Layout:
- high-signal lead story;
- compact latest feed;
- provider filter;
- trending entities;
- social pulse;
- harness changes.

Avoid newspaper-style huge images everywhere.
This is an intelligence product.

## Feed cards

Card anatomy:
- source logo/name
- trust tier
- time
- headline
- short summary
- provider/entities
- category
- external-link icon

Primary-source cards can have a subtle `Official` badge.

## Social Pulse

Dense timeline.

Row:
- avatar/logo;
- account;
- platform;
- time;
- short post excerpt;
- detected entities;
- “corroborated” status;
- original-link button.

Do not fake embeds.

---

# Harness Watch UI

## Overview header

Show:
- monitored products;
- latest plan change;
- cheapest active paid entry point;
- number of free options;
- last verification time.

## Plans board

This should be a strong, table/card hybrid.

Each plan:
- product logo
- plan name
- price
- billing period
- included credits/value
- model access summary
- BYOK
- open-source
- platforms
- last checked

Allow sorting by:
- price
- included credit
- credit/USD
- product
- freshness

## Cheapest section

Do not show one unexplained “winner”.

Use categories:
- Free
- Lowest paid entry
- Highest included credit/USD
- Premium models under $X
- Open models under $X
- BYOK-friendly

Each card links to methodology and source.

## Harness comparison

Selected-plan tray mirrors model selector UX.

Comparison table:
- price
- credits
- usage
- models
- BYOK
- CLI
- desktop
- IDE
- cloud
- open source
- notes
- verified date

## Changes

Chronological event feed.

Examples:
- `Command Code GOAT credits changed`
- `OpenCode Go added model`
- `Claude Code plan limit changed`
- `Freebuff changed daily allowance`

Each event stores before/after.

---

# World & Politics UI

It must visually belong to AI Model Intelligence Hub but be clearly labeled as a different editorial domain.

No red/blue partisan color scheme.

Use:
- neutral typography;
- country tags;
- source badges;
- publication/event timestamps.

For developing stories, show:
`Developing`

For conflicting claims:
`Multiple accounts`
and show sources rather than a synthesized verdict.

No politician scorecards.
No ideology meters.
No “best candidate”.

---

# Mobile

Bottom navigation can replace rail.

Primary mobile tabs:
- Models
- News
- Harnesses
- World
- More

Model selector becomes a horizontal chip scroller.

Tables become:
- horizontal scroll; or
- card projection for selected columns.

Charts must preserve tooltip/tap usability.

---

# Dark mode

Must be first-class.
Do not simply invert colors.

Use:
- near-black neutral background;
- elevated dark surfaces;
- subtle borders;
- provider colors carefully;
- high contrast text.

---

# Motion

Subtle only:
- drawer
- command palette
- tab transitions
- chart state changes

Respect reduced motion.

---

# Accessibility

WCAG AA fundamentals:
- keyboard nav
- focus
- semantic labels
- no color-only meaning
- accessible data alternative for charts
- responsive zoom
