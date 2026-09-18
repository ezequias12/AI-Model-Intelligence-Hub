# Alternative note: provider metadata sources

- Date: 2026-09-18
- Author: documentation phase
- Status: Open
- Related: ADR-0005, `docs/04-data/provider-registry.md`

## Question

Where should provider metadata (region, country, official domain, brand colour, logo) come from,
given that the metric payload deliberately does not carry it?

## Why this matters

`providerFromMapped()` in the Artificial Analysis adapter sets `group: "other"`, `region: null`,
`countryCode: null` and `color: null`, with an explicit comment that grouping is curated internally
and must never be inferred. That is the right behaviour, and it leaves a gap: on a fresh live
database, providers arrive unclassified, so the group filters, region chips and chart colours are
empty until someone curates them.

Metadata is also low-churn and high-context: a provider is registered once and rarely changes. The
question is where the register lives and how it gets populated.

## Options considered

Nothing below was verified during this review. No external catalogue was fetched, and no terms were
read. Treat each option as a hypothesis to check, not as a finding.

### Option 1 - Curated in-repo registry (current)

Where it lives today: `PROVIDER_SEEDS` in `src/lib/fixtures/providers.ts`, with 16 providers, each
carrying slug, name, domain, country code, region, group and colour. The registry is also referenced
by a seeded source row (`internal:provider-registry`).

| Aspect | Assessment |
| --- | --- |
| Accuracy | Highest. Region and grouping are a judgement call that a human should make, which is exactly what ADR-0005 requires. |
| Coverage | Only what is written down. A new lab discovered by the adapter is unclassified. |
| Maintenance | A code change and a deploy per new provider, unless it is seeded into the database separately. |
| Terms | No third-party dependency. |
| Gap | Nothing writes these rows into `public.providers` on a fresh deployment, so live mode starts unclassified. |

### Option 2 - The model creator payload

The adapter already reads `model_creator` / `creator` for a name and slug.

| Aspect | Assessment |
| --- | --- |
| Accuracy | Names are reliable; nothing else is present. |
| Coverage | Automatic for any provider the API knows. |
| Gap | No region, country, domain, colour or logo. Grouping would have to be inferred, which ADR-0005 forbids. |
| Verdict | Necessary as a source of new provider identities, insufficient as a metadata source. |

### Option 3 - Provider official documentation and site

Provider docs pages are already a registered source *type* (`official_docs`, `official_site`), and
several are registered for harness products.

| Aspect | Assessment |
| --- | --- |
| Accuracy | High for the official domain. |
| Coverage | Manual per provider; no structured field for region. |
| Cost | One entry per provider, and pages change. |
| Terms | Public pages; check per provider before automated fetching. |
| Verdict | The best available source for the official domain and logo, at the cost of manual work. |

### Option 4 - A community or aggregated model catalogue

Categories of candidate: model leaderboard sites, inferred-catalogue projects, and community
maintained lists (for example a well-known community model index). None is integrated, and none was
inspected.

| Aspect | Assessment |
| --- | --- |
| Accuracy | Unknown. These catalogues vary in how they determine region and openness. |
| Coverage | Potentially broad and automatic. |
| Terms | Unknown; must be read before use, and attribution may be required. |
| Risk | A catalogue's region or quality assumptions could import exactly the framing ADR-0005 forbids. |
| Verdict | Would require a documented review per candidate, including its terms and its method for assigning a region. Not recommended without that review. |

### Option 5 - Open structured data (Wikidata or similar)

| Aspect | Assessment |
| --- | --- |
| Accuracy | Variable per entity; requires curation to be trustworthy. |
| Coverage | Broad for companies, sparse for regional classification of AI labs. |
| Cost | Matching provider names to entities is fuzzy and would need a manual mapping table anyway. |
| Terms | Open licences apply, usually with attribution. |
| Verdict | Adds a dependency and a fuzzy join without removing the need for human review. Low priority. |

### Option 6 - Provider-submitted metadata

Vendors publish their own plan and provider data through a submission flow.

| Aspect | Assessment |
| --- | --- |
| Accuracy | High for factual fields the vendor owns. |
| Cost | Requires a write path, an approval workflow and abuse handling, in a product that is otherwise read-only. |
| Verdict | Contradicts the current read-only model. Recorded in `docs/07-product/future-ideas.md` as speculative. |

## Assessment

Option 1 remains the right default, because grouping and region are judgement calls and ADR-0005
requires them to be curated rather than inferred. Its only real weakness is operational: the registry
is a code constant, so nothing populates `public.providers` in a live deployment.

The smallest useful improvement is therefore not a new data source at all. It is to seed the
curated registry into the database, either by a migration that inserts the providers or by a job
that upserts them, so a live deployment starts from the same classification the product documents.
That is backlog item H1's sibling concern and is recorded in the roadmap.

## Open questions

1. Should the curated registry live in a migration, a seed script or a first-run job?
2. What is the process for classifying a provider discovered at runtime: where does a human review
   it, and what happens to the model rows in the meantime?
3. Is a per-provider logo needed, or is a colour marker plus the name sufficient? The current UI uses
   colour and text, and `logoUrl` is `null` everywhere.
4. Do any of the candidate catalogues in option 4 include an explicit licence and a documented method
   for assigning a region? If one does, it is worth a proper source review.
5. Should `countryCode` be surfaced as a filter, or is the group filter sufficient?

## Recommendation

1. Do not integrate an external catalogue. Keep the curated registry.
2. Seed the curated providers into `public.providers` so live mode starts classified.
3. When a runtime-discovered provider appears with `group: "other"`, treat it as a curation task, not
   a data bug.
4. If a catalogue is ever considered, open a source review under `docs/08-research/source-reviews/`
   covering its terms, its method and its region and openness definitions before any integration.
