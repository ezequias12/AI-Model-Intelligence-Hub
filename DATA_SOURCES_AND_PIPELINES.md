# Data Sources & Pipelines

## Artificial Analysis

Production model metrics should prefer the official Artificial Analysis Data API.

Requirements:
- server-side API key
- typed client
- pagination
- rate-limit headers
- 429 Retry-After
- exponential backoff for transient failures
- source attribution
- source version
- fixture contract tests
- ingestion run logging

Do not scrape Artificial Analysis to bypass quota.

## Provider metadata

Maintain `providers` with:
- name
- slug
- official domain
- region/country
- provider group
- logo
- active
- source metadata

Group examples:
- mainstream_global
- china_based
- other

Keep `open_weight` on model, not necessarily provider.

## Model snapshots

Never treat a current API response as the whole product.

Store:
- canonical model
- snapshot timestamp
- metrics
- pricing
- performance
- source
- version
- payload hash

Create change events.

## Official AI news

Source registry should support:
- rss
- atom
- json
- html
- github_releases
- social_api

Adapters must expose one normalized contract.

## Harness pages

Track official pricing/docs/changelog pages.
Run slower than news if appropriate.

Recommended:
- pricing: every 1–6 hours
- changelog: 15–60 minutes
- canonical daily reconciliation

## Political/world news

Use a separate adapter group.
Do not reuse political content for AI/harness ranking or user profiling.

## Raw payloads

Use bounded private raw ingestion storage for debugging:
- source
- captured_at
- response hash
- sanitized payload
- retention

Do not expose to browser.

## Database tables

Recommended:
- providers
- models
- model_snapshots
- benchmark_definitions
- model_benchmark_values
- sources
- ingestion_runs
- change_events
- news_items
- news_entities
- monitored_social_accounts
- social_posts
- harness_products
- harness_plans
- harness_plan_snapshots
- harness_change_events
- watchlists
- watchlist_items

## Supabase

- migrations
- RLS for exposed schemas
- private internal schema where practical
- no service secret in browser
- indexes
- security advisor
- performance advisor
- generated TS types

## QStash

Jobs:
- sync-models
- sync-ai-news
- sync-harness-pricing
- sync-harness-changelogs
- sync-social
- sync-world-news
- cleanup-raw-ingestion

Requirements:
- signature verification
- idempotency
- locking
- structured logs
- manual local scripts
- schedule creation script
