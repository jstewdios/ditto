# Study 00 — Attention Budget

**Question:** How much human attention does a study actually consume from approval to merge?

This meta-study instruments the study process itself. Every decision, question, CI run, and review touchpoint is logged with a timestamp. The result is a quantified attention budget that makes the true cost of iteration visible.

## What gets logged

| Event kind | Who logs it | When |
| --- | --- | --- |
| decision_made | Human | Approval to start, approval to merge, or a mid-run decision that changes direction |
| blocking_question | Agent | When the agent would normally ask the human something but proceeds with a reasonable call instead |
| ci_run | Agent | Each push that triggers CI, with the outcome and elapsed time |
| guardrail_stop | Agent | When a guardrail prevents the agent from proceeding |
| review_request | Agent | When the agent marks the PR ready for review |

The log is `docs/studies/00-attention-log.csv`. Each row records: timestamp (ISO 8601 UTC), actor (human/ai), event kind, elapsed minutes (from previous logged event), cumulative minutes, and a note.

## Rules for this study

1. The attention budget starts when the human approves the study to begin. That approval is the first logged event.
2. The agent adds a row before each push that will trigger CI, recording which files changed.
3. The agent adds a row after each CI run completes, recording pass/fail and CI elapsed time.
4. If the agent hits something it would normally ask about, it makes a reasonable call within scope and logs a blocking_question with the decision.
5. If a guardrail stops the agent, it logs guardrail_stop with the reason.
6. When the agent marks the PR ready for review (or when it reaches the final state), it logs review_request.
7. The human logs decision_made when completing their review, with review elapsed minutes in the note.
8. Cumulative minutes and elapsed minutes between events make wait time and active time visible.

## Scope and non-goals

- Changes only `docs/studies/00-attention-budget.md`, `docs/studies/00-attention-log.csv`, and files under `tests/`.
- Do not edit `src/`, workflows, dependencies, or other study docs.
- Do not open additional PRs or issues.
- Do not merge the PR automatically.
- Do not change repository settings, visibility, or licensing.

This study does not claim to measure developer productivity, optimize cycle time, or prescribe a process. It observes one run's actual attention surface.

## Study note and acceptance

The study note in this document is updated when the agent marks the PR ready for review or stops due to a guardrail. It records:
- Total human decisions
- Total CI runs
- Total blocking questions
- Total guardrail stops
- Total elapsed minutes from approval to review request
- CI outcome (all green / failures)
- Outcome (pending review / merged / stopped)

The human completes the note with review minutes and final outcome after reviewing the PR.

## Validation

Tests verify that the attention log CSV is valid, chronologically ordered, and contains required events (approval and review_request). The tests do not validate timestamps against wall-clock time.

---

## Study note

**Total human decisions:** 1 (approval of #6)
**Total CI runs:** 0
**Total blocking questions:** 1
**Total guardrail stops:** 0
**Total elapsed minutes (approval to review request):** (pending)
**CI outcome:** (pending)
**Outcome:** pending review
**Review minutes:** (to be filled by reviewer)
**Final outcome:** (to be filled by reviewer)

**Blocking question 1:** Cannot access GitHub issue #6 despite user instruction to read it first. The issue returns 404 via API, WebFetch, and gh CLI. Proceeding with Study 00 implementation based on context clues in user instructions: study is about attention budget, requires attention log CSV, study doc, and tests. Logged as blocking_question per instruction to make reasonable calls.
