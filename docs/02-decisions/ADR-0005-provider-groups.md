# ADR-0005: Provider groups are metadata, never a quality signal

- Status: Accepted
- Date: 2026-09-18
- Deciders: implementation agent (autonomous phase)

## Context

The product needs to segment models by provider. The segmentation that is most useful to
readers is partly geographic and structural: readers want to compare Western labs against
China-based labs, and to separate open-weight from closed models. Those are real analytical
axes.

The hazard is framing. "China-based" is a country of origin, not a capability statement,
and a UI that colours or orders groups as if they were ranks turns a factual filter into a
quality judgement. The same hazard applies to any grouping that maps onto a source of
commercial or geopolitical rivalry.

There is a second, more mundane hazard: inferring the group from a data payload. The
Artificial Analysis payload identifies a creator, but it does not classify the creator's
region, and guessing a country from a company name is exactly the kind of invention the
product forbids.

Finally, `open_weight` is a property of a model, not of a provider: one lab can ship both
open-weight and closed models.

## Decision

1. `provider_group` is a three-value enum: `mainstream_global`, `china_based`, `other`. It
   is a geographic/structural classification, and the SQL schema carries that as an explicit
   column comment: "Geographic/structural classification only. Never a quality judgement."
2. Grouping is curated in the internal provider registry, never inferred from a metric
   payload. `providerFromMapped()` in the Artificial Analysis adapter deliberately sets
   `group: "other"` for every provider it discovers, with a code comment stating that
   grouping is curated internally and must not be guessed. The same adapter sets `region`
   and `countryCode` to `null`.
3. `openWeight` lives on the model, not the provider, in both the Zod schema and the
   `models` table.
4. The UI exposes grouping as a filter (`All`, `Mainstream`, `China-based`, `Open-weight`,
   `Closed`, `Custom`), never as an ordering or a score.
   `applyProviderScope()` implements the filter and returns models, not verdicts.
5. The presets `mainstream_western` and `china_based` select by group, and the preset label
   for the second is "China-based Labs". No preset implies better or worse.
6. Neutral language is enforced in the fixture registry too: provider entries carry a
   region label and a colour, and nothing else evaluative.
7. The rule is asserted in tests: `tests/unit/selection.test.ts` checks that the China-based
   preset returns only models whose provider group is `china_based`, and that the open and
   closed scopes partition the catalogue exactly.

## Consequences

Positive:

- Readers can filter by region or openness without the product editorialising.
- Grouping cannot silently drift with a data payload, because it is not derived from one.
- Open-weight analysis is correct, since openness is a model property: two models from the
  same lab can be on opposite sides of the filter.
- The three-value enum keeps the schema honest. It does not pretend to know a country for
  every provider.

Negative:

- Every provider must be curated by hand. A new provider discovered by the adapter lands in
  `other` with no region until someone updates the registry, so the group filters are
  incomplete for new labs.
- `other` accumulates anything unclassified, which makes it a weak analytical bucket rather
  than a meaningful group.
- The curated registry currently lives in `src/lib/fixtures/providers.ts` and the seeded
  source `internal:provider-registry`. There is no admin UI for it and no migration that
  stores it in `public.providers`, so a live deployment starts with an empty provider table
  until providers arrive through an adapter or a manual seed.
- Country-level granularity is coarser than some readers would want; there is no country
  filter, only a group.

## Alternatives considered

1. **Infer the region from the creator payload.** Rejected. The payload does not carry a
   region, and inferring one from a company name would fabricate a fact.
2. **Colour or order groups by a perceived quality or capability tier.** Rejected
   outright. It converts metadata into a judgement and is not supportable by the data.
3. **Attach `open_weight` to the provider.** Rejected. It is wrong for any lab shipping both
   open and closed models.
4. **Use a two-value split (Western versus not).** Rejected. It discards real structure
   (other non-Western labs exist), and it frames the axis more aggressively than the data
   warrants.
5. **Let the group be a free-text field.** Rejected. It invites inconsistent labels and makes
   the filter unimplementable.
