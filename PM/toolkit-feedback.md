# Project Toolkit feedback: solo-developer workflow trial

## Purpose and status

Owner-requested field report for [Ignyos/project-toolkit](https://github.com/Ignyos/project-toolkit),
based on its use in [Ignyos/solitaire](https://github.com/Ignyos/solitaire).
Snapshot: 2026-10-22. This is feedback, not a new workflow specification, task
index, or authorization to change either repository.

The owner deliberately used Solitaire to test a PM workflow adopted from another
project. They want a clean repository and useful continuity without excessive
administration. They are reconsidering whether solo-developer and team workflows
should share one set of defaults.

## Trial context and limits

- One developer working with an AI assistant in VS Code; no multi-developer
  coordination was tested.
- Full Profile, Greenfield setup using `vanilla-js-github-pages-spa`.
- Generated-file provenance identifies toolkit commit
  [`0c9e12c7b9fd60e297e690b5a3943edabe8dc868`](https://github.com/Ignyos/project-toolkit/tree/0c9e12c7b9fd60e297e690b5a3943edabe8dc868),
  with initial generation on 2026-10-12.
- Optional branch discipline was enabled. The owner also chose PR-based
  integration; that choice is not evidence that every toolkit user must use PRs.
- Work to date has largely covered scaffolding, requirements, deployments, and
  workflow refinement. Gameplay is not implemented. The process has not yet been
  evaluated through a playable product feature.
- Findings are qualitative: no controlled comparison, timing study, approval
  count, or measured productivity gain is claimed.
- This evaluates the adopted baseline and local adaptations, not an audit of
  current upstream HEAD. The toolkit generates tailored project files rather
  than installing an identical runtime workflow everywhere.

## Observed findings

| Finding | Evidence from this trial | Interpretation |
|---|---|---|
| Prompt mechanics caused avoidable friction. | The owner requested clipboard handoff of the release-notes directive and a short Release/Cancel choice. Implemented in [Ignyos/solitaire#3](https://github.com/Ignyos/solitaire/pull/3). | Make the safe path easy to use; explicit approval does not require a long typed phrase or manual copying. |
| Shorter answers did not resolve the underlying checkpoint burden. | [Ignyos/solitaire#4](https://github.com/Ignyos/solitaire/pull/4) shortened candidate choices but retained mandatory evidence. The owner subsequently asked what the evidence prompt meant, then requested its removal. | Distinguish interaction improvements from simplifying the process itself. |
| Mandatory per-item deployment evidence did not fit this owner's needs. | The owner explicitly said they did not want an audit trail for this checkpoint. [Ignyos/solitaire#5](https://github.com/Ignyos/solitaire/pull/5) removed the evidence and candidate-decision prompts. | Evidence logging should be a deliberate workflow policy, not an assumed universal requirement. This is not a request to remove tests or all technical release records. |
| Deployment authorization and item verification were coupled. | The adopted checkpoint required decisions on every dev candidate inside the publish script. The owner chose a single publish confirmation and explicitly chose to leave candidates unchanged. | Authorizing a deployment, verifying a feature, and updating its PM state are separate decisions. |
| State terminology and ownership needed explanation. | The owner asked how a release candidate becomes completed, where tasks should be created, and who handles implementation review and integration. | Clarify the meaning of Done, the deployment state, and the division of responsibility between developer and AI. |
| Human interaction is an execution constraint. | An earlier assistant-run dev publish stopped at `Read-Host` in a noninteractive environment before mutation. | Document which steps require the owner's interactive terminal. Do not make the assistant simulate live approvals. |
| Code integration does not keep PM status current automatically. | At the 2026-10-22 snapshot, PR #5 was merged but its item still said Active in [chore-005](release-candidate-dev/chore-005.md). | Explicit PM transitions create a separate maintenance obligation. This was subsequently reconciled with owner approval on 2026-10-23. |

These observations do not establish that the same process is unsuitable for
teams. They show a mismatch between some current defaults and this solo trial.

## Changes made and what is actually verified

1. **Release handoff and confirmation:** clipboard copying with a visible manual
   fallback, plus case-insensitive Release/Cancel input. See
   [chore-003](release-candidate/chore-003.md) and
   [Ignyos/solitaire#3](https://github.com/Ignyos/solitaire/pull/3).
2. **Intermediate checkpoint simplification:** single-letter promotion,
   demotion, and cancellation inputs, retaining evidence and pre-mutation
   decision collection. See [chore-004](release-candidate-dev/chore-004.md)
   and [Ignyos/solitaire#4](https://github.com/Ignyos/solitaire/pull/4).
3. **Policy simplification:** one default-No Yes/No confirmation; no per-item
   evidence, item edits, or lifecycle transitions during dev publishing.
   See [chore-005](release-candidate-dev/chore-005.md) and
   [Ignyos/solitaire#5](https://github.com/Ignyos/solitaire/pull/5), merged
   on 2026-10-22 at `25fac2cb986e926711a47423998f36dff47500bb`.

PowerShell parsing, build validation, and focused checks were performed for these
changes. The latest confirmation change was exercised in a disposable local Git
clone for WhatIf, No, empty input, invalid input, and Yes with `-NoPush`.
Candidate content and the PM index remained unchanged; successful publishing
committed only deployed assets. No live publish was run for that verification.
Merge and fixture success are not evidence of improved long-term usability or a
successful hosted deployment.

On 2026-10-23, the owner approved preserving this report and reconciling the PM
records. Chore-005 moved to the dev-candidate stage, and chore-004 was marked as
superseded without rewriting its original criteria. A subsequent dev-publish
commit is present, but this report does not treat that alone as proof of hosted
deployment success.

## Safeguards worth retaining

Recommended shared foundations, rather than claims about measured benefits:

- Clear work scope and observable acceptance criteria.
- Validation proportionate to the change.
- Developer control over consequential AI actions, with approval scope made
  explicit rather than repeatedly inferred or requested.
- Clean-tree checks, deployment lane isolation, cache/version consistency, and
  explicit publishing confirmation.
- Read-only rehearsals and cancellation before mutation where feasible.
- Clear failure reporting and bounded verification rather than retry loops.
- Provenance and concise context sufficient to resume work.

The requested simplification concerns administrative overhead, not silent
publishing, unvalidated changes, or unrestricted AI authority.

## Recommendations for upstream consideration

These are proposals, not adopted or validated behavior:

1. **Offer Solo and Team operating modes independently of technology profiles.**
   Start with a small shared safety baseline, then add coordination rules where
   needed. Do not assume a Team mode must require every optional control.
2. **Consider a smaller solo lifecycle:** Backlog -> Active -> Done, with Done
   meaning implemented, validated, and accepted. Track deployment/release
   separately instead of requiring every task to traverse deployment folders.
3. **Make coordination overhead opt-in for solo use:** mandatory PRs, separate
   PM housekeeping commits, per-item evidence logs, and extra approval stages.
   Preserve deliberate review without requiring the owner to repeatedly approve
   the same already-defined scope.
4. **Keep publishing independent of PM transitions.** A deploy confirmation
   should authorize deployment, not imply that every candidate was verified.
   If candidate promotion remains supported, provide an explicit separate action.
5. **Define actor responsibilities and approval boundaries at setup.** State
   what the AI may prepare, what the owner reviews, and which actions still
   require confirmation. Make interactive-terminal requirements clear.
6. **Prefer easy, conservative prompts.** Use short, case-insensitive choices,
   a visible default, and clear cancellation effects. Retain safeguards around
   the operation rather than relying on difficult input as the safeguard.

Relevant upstream baseline:
[workflow rules](https://github.com/Ignyos/project-toolkit/blob/0c9e12c7b9fd60e297e690b5a3943edabe8dc868/shared/project-management/workflow.md)
and [optional branching guidance](https://github.com/Ignyos/project-toolkit/blob/0c9e12c7b9fd60e297e690b5a3943edabe8dc868/shared/project-management/branching.md).
Mandatory non-empty evidence and exact prompt mechanics also came through the
generated local scripts; do not attribute every local implementation choice to
the shared PM rules alone.

## Suggested next experiment

Agree on a bounded solo baseline, then use it for one real product slice rather
than continuing to refine PM infrastructure in isolation. Record:

- Whether the owner can identify the current work and next action.
- Any repeated approval that adds no new information or authority.
- Manual steps required to keep implementation and PM state aligned.
- Whether validation and publishing remain safe without mandatory audit prose.
- Whether the developer can resume after a break without reconstructing intent.

Revisit the baseline after that slice. A Team mode needs separate testing with
multiple contributors before drawing conclusions about collaboration.

## Upstream handoff

This report can accompany an upstream issue or design discussion. It has not
been posted to project-toolkit and does not request an automatic upstream change.
The central feedback is: **keep technical safeguards shared, but make coordination
and administrative defaults fit the operating model.**
