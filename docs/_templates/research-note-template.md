# Research note template

Research notes are non-normative: they record what was investigated, what was found, and what
remains uncertain. They do not change the architecture. If a note leads to a decision, write an
ADR and link to the note.

Note that a research note must not contain findings you did not verify.

## <Title>

- Date: <YYYY-MM-DD>
- Author: <who>
- Status: <Open | Concluded | Superseded>
- Related: <ADR-NNNN or implementation history link>

## Question

<What was being investigated, phrased as a question.>

## Method

<How the answer was sought: which documents were read, which endpoints were called, which
version was inspected. State clearly what was **not** verified.>

## Findings

| Finding | Evidence |
| --- | --- |
| <Finding> | <Where it was observed> |

## Assessment

<What the findings imply for this project. Be explicit about confidence.>

## Open questions

- <Question that remains unanswered>
- <Question that requires a credential or an account to answer>

## Recommendation

<What should happen next, if anything. Keep it optional: this note does not bind the project.>
