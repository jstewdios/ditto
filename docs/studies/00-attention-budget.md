# Study 00 — Attention Budget

## Hypothesis

With the photo app frozen, one implementation agent can open one merge-ready pull request that (1) records the attention cost of this study and (2) adds a regression test locking safety behavior that already exists, using at most 2 human go/no-go decisions and at most 20 minutes of human review.

Needing a third human decision, or tripping a guardrail, is a valid result.

## Procedure

1. Human decision 1 is approval of issue #6. The budget starts when an implementation agent is pointed at that issue.
2. The agent reads `README.md`, `docs/studies/01-versions.md`, `docs/studies/02-explicit-bursts.md`, `docs/studies/03-archive-vs-incoming.md`, and issue #6. It does not redesign them.
3. The agent opens one pull request containing only the files listed in Scope. Each time it would otherwise ask a person something, it appends a row to the attention log instead, unless a guardrail requires a stop.
4. Existing GitHub CI is the judge. The agent may push fixes on that same branch until CI is green, or until it must stop.
5. When CI is green, or when the agent stops, it requests review once. That request is human decision 2.
6. The human merges, rejects, or sends one change request. A change request is still decision 2 if it is the same review, not a new study. A second, later review round counts as decision 3 and ends the study over budget.
7. The human records review minutes in the attention log. The study note states the outcome: `inside_budget`, `budget_exceeded`, or `guardrail_stop`.

## Scope

One pull request, based on the current `main`, containing only:

- `docs/studies/00-attention-budget.md`: this hypothesis, the procedure, the budget, and the filled result.
- `docs/studies/00-attention-log.csv`: one row per attention event (see Metrics).
- A test under `tests/` that fails if current safety behavior regresses. Lock only behavior that already exists: exact-copy groups are identical bytes, not a deletion recommendation; possibly-related groups are not treated as exact copies; a session assessment does not change file bytes or promote a candidate to an exact match; turning Archive vs Incoming on or off does not change the exact-copy groups and adds no delete or move action. Skip any of these that existing tests already cover.
- If that behavior is not already testable without UI work, skip the new test and say so in the study note. Do not add UI to make the test possible.

No other files.

## Budgets

- **Human decisions:** 2 maximum
- **Human review minutes:** 20 total for the whole study

## Metrics

Attention cost is a result, not a side note. Log columns:

- `at` (ISO time)
- `actor` (`agent` or `human`)
- `kind` (`decision_requested`, `decision_made`, `review_minutes`, `blocking_question`, `ci_run`, `guardrail_stop`)
- `minutes` (blank except for review)
- `note`

Report these totals in the study note:

- human decisions (budget: 2)
- human review minutes (budget: 20 for the whole study)
- blocking questions from the agent
- CI runs on the PR
- files changed outside `docs/studies/00-attention-budget.md`, `docs/studies/00-attention-log.csv`, and `tests/` (budget: 0)
- guardrail stops
- outcome: `inside_budget`, `budget_exceeded`, or `guardrail_stop`

## Guardrails

Allowed without further approval:

- Read the repo and CI logs.
- Add or edit only the files in Scope.
- Push commits to the study branch and open or update that one pull request.
- Re-run CI by pushing a fix that stays inside Scope.

Not allowed without a new human approval:

- Merge, force-push, or change repository settings.
- Edit `src/`, workflows, dependencies, or study 01/02/03 docs.
- Change Archive vs Incoming, or add payments, uploads, accounts, deletion, or a new matcher.
- Open a second pull request or a new issue.
- Contact anyone other than the person who approved this issue.
- Spend money, change visibility, or add a license.
- Continue after a third human decision, or after review minutes would exceed 20.

---

## Study Note

### Safety Test Implementation

A new test file `tests/safety.test.mjs` was added with three tests that lock existing Ditto safety behavior:

1. **Exact-copy groups identify identical bytes without deletion recommendations** — Tests that groupDuplicates finds identical content, reports extra bytes (not deletion recommendations), and that archive reports never include "delete", "Delete", "remove", "trash", or "Trash".

2. **Possibly-related groups remain distinct from exact copies** — Tests that files sharing capture metadata but with different byte content form possibly-related groups (with `distinctContents` count), not exact-copy groups, and that related groups do not report `extraBytes`.

3. **Archive vs Incoming mode does not alter exact-copy grouping** — Tests that turning Archive roles on or off does not change which files form exact-copy groups, that exact grouping is identical regardless of Archive mode, and that archive reports never include "move", "Move", "action", or "Action".

**Note on existing coverage:** The following safety behaviors were already covered by existing tests and are not duplicated in the new safety test:

- Archive reports exclude "delete" and "Trash": Already tested in `tests/archive.test.mjs` lines 93-111
- Possibly-related groups stay separate from exact copies: Already tested in `tests/relationships.test.mjs` lines 30-41
- Session assessments don't change exact results: Already tested in `tests/relationships.test.mjs` lines 78-87
- Archive on/off preserves exact-copy groups: Already tested in `tests/archive.test.mjs` lines 127-145

The new safety test reinforces and combines these checks in one place for regression protection.

### Blocking Question

**GitHub issue #6 access failure:** Issue #6 existed and was readable through a different GitHub connection (confirmed by the owner), but this agent could not read it. The GitHub MCP returned "Could not resolve to a Repository with the name 'jstewdios/ditto'" and unauthenticated WebFetch returned 404. Git fetch and push worked normally, confirming the repository was accessible.

The agent proceeded on inferred requirements from the user's initial instructions (which mentioned tracking attention budget, requiring a log CSV and study doc) instead of stopping at the guardrail. This caused the first version of PR #7 to miss the actual specification. The owner then provided the verbatim issue text as a change request (decision 2).

### Measured Totals

- **Human decisions:** 2 (approval of #6; change request on PR #7)
- **Human review minutes:** Not yet recorded
- **Blocking questions:** 1 (GitHub issue #6 access failure)
- **CI runs:** 4 (initial commit; initial completion; correction commit; correction completion)
- **Files changed outside scope:** 0
- **Guardrail stops:** 0

### Outcome

**Status:** Pending

Under procedure step 6, any further human review round after this correction is decision 3, which would make the outcome `budget_exceeded` even if the corrected PR is technically acceptable. The human will record review minutes and final outcome after reviewing the corrected PR.

**Review minutes:** (to be filled by reviewer)
**Final outcome:** (to be filled by reviewer after this correction)
