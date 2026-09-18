# Product Information Architecture

## Navigation philosophy

AI Model Intelligence Hub needs the order of a dashboard, but the hierarchy should come from the product domains, not from generic admin navigation.

### Primary left rail

**Core**
- Overview
- Models
- Compare

**Intelligence**
- News
- Harness Watch
- World & Politics

**Personal**
- Watchlists

**System**
- Sources
- Methodology

The rail may collapse to icons but should expand on hover/click.
Use clear iconography and restrained separators.

## Overview

The Overview is a compact cross-domain command center, not the full product.

Blocks:
1. Market pulse
2. Today’s model changes
3. Top value models
4. Important AI news
5. Harness plan changes
6. World headline strip
7. Source freshness

Every block deep-links into the corresponding workspace.

Do not overload Overview with every chart.

---

# Models

Subnavigation inside page:
- Dashboard
- Rankings
- Landscape
- Table
- Releases

Persistent selected-model tray remains visible when useful.

### Dashboard
Fast summary.

### Rankings
All Top 10 boards in an organized grid.

### Landscape
Large configurable charts.

### Table
Dense research table.

### Releases
Chronological model release/change view.

---

# Compare

Dedicated full-width comparison workspace.

Supports:
- models;
- optionally harness plans through a separate mode.

Never mix model metrics and harness-plan metrics in one comparison schema.

---

# News

Tabs:
- Overview
- AI General
- Providers
- Social Pulse
- Research

Search and saved filters.

---

# Harness Watch

Tabs:
- Overview
- Plans
- Compare
- Cheapest
- Changes
- News

This should feel like “Artificial Analysis for coding-agent subscriptions”.

---

# World & Politics

Tabs:
- Top
- Argentina
- US
- Latin America
- World
- Economy
- Regulation

Independent source policy.

---

# Watchlists

Users can save:
- model groups;
- providers;
- harness products;
- topics;
- news queries.

Initial version can use local storage.
Design persistence interface so Supabase user preferences can be added later.

---

# Sources

Operational transparency:
- source
- type
- enabled
- last successful sync
- freshness
- rate-limit state
- adapter status
- errors
- attribution/licensing note

---

# Methodology

Sections:
- Model data
- Cost efficiency
- Provider groups
- News trust tiers
- Harness plan comparison
- Political-news neutrality
- Historical snapshots
- Data freshness
