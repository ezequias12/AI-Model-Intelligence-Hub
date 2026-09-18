# Future ideas

Speculative. Nothing here is committed work, nothing here is implemented, and none of it is
referenced by the roadmap. Ideas are recorded so they are not lost, with the constraint each would
have to respect.

## Models workspace

| Idea | Value | Constraint it must respect |
| --- | --- | --- |
| Per-workload cost estimator | A reader brings their own token mix and gets a cost per model | Must expose the assumption (token mix, cache hit rate) rather than a single number |
| Retrieval-augmented corpus profiles | Compare models on the kinds of documents the reader actually uses | Cannot claim a benchmark the source did not publish |
| Latency curves at varying prompt lengths | TTFT and throughput as functions of prompt size | The source publishes medians; anything else is an estimate and must be labelled |
| Regional availability and data-residency matrix | Which models are reachable from which region | Provider metadata is curated; must not be inferred |
| Deprecation impact view | Which tracked models are being retired and when | Deprecation dates are scarce in the source payload; the adapter currently uses the observation time |
| Saved comparison sets as first-class objects | Named, shareable sets beyond a URL | Needs a persistence surface; local storage is the honest interim |
| Diff view between two snapshots of the same model | Field-by-field comparison of history | Already computable from `diffSnapshots`; needs a UI |

## News and research

| Idea | Value | Constraint it must respect |
| --- | --- | --- |
| Timeline view per event cluster | One story, its evolution and all corroborating reports | The anchor and members already exist; must still show each source |
| Named entity graph | Which organisations and people appear together | Entity extraction is currently conservative and fixture-only |
| "What changed in the source's methodology" tracker | Detects evaluation changes that shift all scores | Requires parsing change notes; must never infer a cause |
| Personal digest of watched topics | A periodic summary of watched entities | Needs persistence and a notification channel; may not summarise with unsupported facts |
| Paper-to-model linkage | Which models a paper evaluated | Ambiguous in most papers; would need explicit extraction, not guessing |

## Harness Watch

| Idea | Value | Constraint it must respect |
| --- | --- | --- |
| Effective cost per coding hour | Turns plan prices into a comparable unit | No vendor publishes hours; the model would have to be explicit that it is an estimate with stated assumptions |
| Allowance decay curves | Shows how a rolling window behaves over a month | Requires understanding each reset model, which differs per product |
| Promotion history chart | Shows how generous promotions have been | Events already exist; must distinguish promotion from permanent price change |
| BYOK effective-cost calculator | Combines plan price with the reader's own provider spend | Requires the reader's token mix; again an explicit assumption |
| Plan-level change alerts | Notify when a tracked plan changes | Needs a notification channel |
| Cross-plan model coverage matrix | Which frontier models are reachable on which plans | Depends on plan model lists, which are free text today |

## World & Politics

| Idea | Value | Constraint it must respect |
| --- | --- | --- |
| Primary-document diffing | Shows what changed in an official document | Requires fetching and versioning documents; must stay descriptive |
| Region-specific source registries | More local sources per region for better coverage | Each source must be evaluated for reliability and terms |
| "Both accounts side by side" layout | Makes disagreement first-class rather than a badge | Must not synthesize a resolution |
| Event timeline per developing story | How a story evolved | Must keep event time separate from publication time, as the schema already does |
| Language coverage | Non-English reporting | The neutrality scanner is English-only; extending it means extending the guardrails first |

## Platform and tooling

| Idea | Value | Constraint it must respect |
| --- | --- | --- |
| Public read-only API | Lets other tools consume the derived metrics | Attribution requirements apply to every consumer |
| Embeddable widgets | A model card or a ranking board in another page | Same attribution requirement |
| Personal alert rules | "Tell me when a model passes 75 intelligence under $2" | Needs a rules engine and a channel; must not become a recommendation engine |
| Export bundles | A snapshot of the current dataset for offline work | Must carry provenance and timestamps with the data |
| Provider-submitted plans | Vendors publish their own pricing through a form | Requires a trusted write path, which conflicts with the read-only model; would need an approval workflow |
| Anonymous usage analytics | Understand which boards are actually used | Privacy: no political content may ever be used for profiling, and no user profiling exists today |

## Explicitly rejected ideas

Recorded so they are not re-proposed.

| Idea | Why rejected |
| --- | --- |
| A single universal "best model" score | The product exposes four explicit cost-efficiency modes precisely because one number hides the assumption |
| Political leaning score per source | Not supportable, and directly contradicts ADR-0006 |
| Scraping a source that publishes an API | ADR-0003 |
| Fabricating a request allowance from credits | ADR-0007; a wrong number is worse than a missing one |
| Inferring provider region from a company name | ADR-0005 |
| Removing mock mode to force live configuration | ADR-0008 |

## How an idea becomes work

1. Record it here or as a research note under `docs/08-research/`.
2. If it changes architecture, write an ADR first: `docs/02-decisions/` using
   `docs/_templates/ADR-template.md`.
3. Only then add it to `docs/03-implementation/current/backlog.md` with the concrete files
   involved.
4. Only then add it to `docs/07-product/roadmap.md` with its stage and exit criteria.
