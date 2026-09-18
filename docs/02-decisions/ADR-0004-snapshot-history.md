# ADR-0004: Snapshot history instead of overwriting current values

- Status: Accepted
- Date: 2026-09-18
- Deciders: implementation agent (autonomous phase)

## Context

A metric table that only shows the current state answers "what is true now" but not "what
changed", which is the question that matters most in an intelligence product. Prices move,
benchmark scores are revised, models are deprecated, and a plan's credit allocation is
adjusted quietly.

Storing only current values also loses the ability to render a delta: a `+3.1` next to an
intelligence score requires knowing the previous value. Deriving that from any single row
is impossible.

The alternative - a full event-sourced system with replayable state - is heavier than this
product needs and would make the read path a projection problem for every screen.

There is a third consideration: idempotency. An ingestion job that runs every 30 minutes
writes the same values most of the time. Without a content identity, a naive writer either
duplicates rows on retry or writes a new row on every poll and turns history into noise.

## Decision

Observed states are stored as append-only snapshots, and differences between snapshots
become explicit change events.

1. `model_snapshots` stores one row per observed model state with `captured_at`, a `metrics`
   JSONB payload, the source and `payload_hash`. The unique constraint
   `(model_id, captured_at, payload_hash)` makes a retried write idempotent.
2. `public.models` keeps the latest known values for fast reads, and this duplication is
   deliberate: the table is documented in SQL as "Current model state. History lives in
   `model_snapshots`; this table is the latest known values." Snapshots are for history,
   not for the primary read path.
3. `diffSnapshots(before, after)` in `src/lib/domain/diff.ts` compares two states field by
   field and returns `{ changed, changes, significance }`. Significance defaults are
   business-driven: price and credit fields are `high`, model lists and limit fields are
   `medium`, everything else is `low`.
4. An empty diff means nothing is written. `describeChange()` turns a change into the
   human-readable line used by the Releases and Changes feeds.
5. Deltas shown in the UI come from the previous snapshot, resolved by
   `previousMetricsByModel()` and passed to the client as `previousByModelId`.
6. `change_events` records model-level changes; `harness_change_events` records plan-level
   events with an explicit `eventType` vocabulary.

Snapshot volume is bounded deliberately: history is capped at 12 snapshots per model when
serialised (`groupSnapshotsByModel`) and fixtures generate six offsets (120, 90, 60, 30, 7
and 0 days in the past).

## Consequences

Positive:

- Deltas, change feeds and the trend chart are possible without recomputing history from an
  event log.
- The unique constraint makes ingestion idempotent, so a retry cannot fork history.
- The metric table stays simple: it reads the current row, and takes the previous value from
  the snapshot map.
- A change feed can be significance-ordered, so a price move outranks a description tweak.

Negative:

- Two sources of truth for current values (`models` and the newest snapshot). They can
  disagree if a snapshot write succeeds and the current-row write fails. The writer
  reports per-table summaries and the runner marks the run `partial` or `failed`, but the
  reconciliation is manual.
- Snapshot storage grows linearly with poll frequency. At a 30-minute cadence the growth is
  modest, but there is no partitioning or retention policy for `model_snapshots` yet.
- Deltas are computed against the previous snapshot, not against a fixed window. If polling
  is irregular, a "delta" can span a day or an hour without the UI qualifying it beyond the
  snapshot timestamp.
- Fixture snapshots are generated deterministically from a seed, which exercises the
  machinery but is not a substitute for real history.
- Serialising history to the client is a payload cost, which is why it is capped.

## Alternatives considered

1. **Store only the current value.** Rejected. It makes deltas, the Releases view and the
   change feed impossible, which removes a core reason for the product to exist.
2. **Full event sourcing with replay.** Rejected as disproportionate. Every read would need
   a projection, and the product needs a small number of well-defined diffs, not arbitrary
   state reconstruction.
3. **Write a snapshot on every poll regardless of content.** Rejected. It would triple
   storage for no information and would drown the change feed in no-op rows.
4. **Compute history on read from the current values plus an audit table.** Rejected. It
   couples the read path to retention and makes the unique-key idempotency guarantee harder
   to reason about.
5. **Keep history only for price fields.** Rejected. Intelligence and speed revisions are
   exactly the kind of quiet change the product is meant to surface.
