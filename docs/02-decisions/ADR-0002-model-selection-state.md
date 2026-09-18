# ADR-0002: Model selection as explicit, shareable state

- Status: Accepted
- Date: 2026-09-18
- Deciders: implementation agent (autonomous phase)

## Context

The Models workspace is a comparison tool. Almost every screen - metric leaders,
ranking boards, landscape charts, the dense table, Compare - is more useful when scoped
to a chosen set of models. Three questions follow immediately:

1. What is selected when a user first arrives?
2. Where does the selection live (component state, context, URL, storage, server)?
3. How does a selection survive as models rotate, get renamed or get deprecated?

Hard-coding today's flagship model names answers (1) for a week and then rots. Keeping
selection in component state answers (2) cheaply but makes views unshareable. Storing it
only in local storage makes links from a colleague useless.

There is also a correctness concern: a shared URL may reference a model id that no longer
exists, and an unbounded selection makes charts unreadable.

## Decision

Selection is explicit state with four properties.

1. **The default set is resolved, not hard-coded.** `resolveDefaultSelection()` reads
   `DEFAULT_SLOTS` (one slot per major lab plus a best-value open slot), filters to
   active models, picks the highest-metric representative per slot and, for the
   best-value slot, the cheapest open-weight model above the population median
   intelligence. It is deterministic for a given input, and it accepts `fallbackIds` so
   mock mode always returns something.
2. **Selection lives in the `?models=` query parameter and in local storage.**
   `encodeSelection` / `decodeSelection` handle the URL form,
   `SELECTION_STORAGE_KEY = "amih.models.selection.v1"` holds the last-used set, and
   `SELECTION_SOURCE_KEY` records whether the current set came from defaults, a preset or
   a manual change so the UI can label it.
3. **Invalid references degrade instead of failing.** `reconcileSelection()` drops unknown
   ids and de-duplicates while preserving order, so a stale shared link renders the
   subset that still exists.
4. **The selection is bounded.** `MAX_COMPARISON_MODELS = 8`, applied by
   `clampSelection()`. Presets default to 6 models.

Presets are explicit keys (`frontier`, `best_value`, `fast`, `coding`, `agentic`,
`open_weight`, `mainstream_western`, `china_based`, `custom`) resolved by
`applyPreset()`, and provider scope is a separate control (`applyProviderScope`) so
"which models" and "which providers" stay independent.

## Consequences

Positive:

- A URL reproduces a view exactly, which makes findings shareable without screenshots.
- The default set stays useful as models rotate, because it is derived from provider
  metadata and current metrics rather than names.
- Deliberately invalid input (unknown ids, duplicates, oversized lists) has defined
  behaviour and is covered by tests in `tests/unit/selection.test.ts`.
- Charts and tables stay legible because the selection is capped.

Negative:

- Selection logic is more code than `useState(defaultNames)`, and it must be understood
  before changing defaults.
- The default set is only as good as the provider registry: a slot whose provider slug is
  missing is silently skipped rather than reported. Slots that resolve to nothing produce
  a shorter selection without a warning.
- Query parameters change on selection, so client-side navigation replaces history
  entries (`window.history.replaceState`) and back-button behaviour is intentionally mild.
- Local storage and the URL can disagree if a user opens a shared link; the URL wins
  because it is read first, and the storage value is only used when the URL is empty.
- There is no server-side persistence of a selection, so two devices do not share it.

## Alternatives considered

1. **Hard-code a default list of model names.** Rejected. It becomes wrong as soon as a
   new flagship ships, and it silently degrades to a stale comparison.
2. **Server-side selection per user.** Rejected for now: there is no application
   authentication, so there is no user to key on. The URL plus local storage is the
   honest equivalent until auth exists.
3. **Unlimited selection.** Rejected. Charts and comparison tables stop being readable,
   and scatter plots become a solid mass.
4. **Selection stored only in React context.** Rejected. It loses shareability and
   survives a reload only by accident.
5. **Automatic selection from the current filter state.** Rejected. It makes the selected
   set unpredictable and conflicts with the requirement that add/remove is explicit and
   persistent.
