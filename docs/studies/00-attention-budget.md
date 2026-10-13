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

A new test file `tests/safety.test.mjs` was added with three tests:

1. **Exact-copy groups identify identical bytes without deletion recommendations** — Tests that `groupDuplicates` finds identical content, reports `extraBytes`, and that archive reports never include "delete", "Delete", "remove", "trash", or "Trash".

2. **Possibly-related groups remain distinct from exact copies** — Tests that different file hashes do not form exact-copy groups, and that different content does not count as already archived. Does not test `groupRelated` or capture-metadata grouping.

3. **Archive vs Incoming mode does not alter exact-copy grouping** — Tests that `rolesForCheck(false, ...)` returns an empty role mapping, and that archive reports never include "move", "Move", "action", or "Action". The test's exact-copy grouping comparison cannot fail because `groupDuplicates` never receives roles as input.

**Note on existing coverage:** Session assessments not changing exact results rely on `tests/relationships.test.mjs` lines 78-87. Archive reports excluding deletion wording and Archive on/off preserving exact-copy groups were already tested in `tests/archive.test.mjs` lines 93-111 and 127-145.

### Blocking Question

**GitHub issue #6 access failure:** Issue #6 existed and was readable through a different GitHub connection (confirmed by the owner), but this agent could not read it. The GitHub MCP returned "Could not resolve to a Repository with the name 'jstewdios/ditto'" and unauthenticated WebFetch returned 404. Git fetch and push worked normally, confirming the repository was accessible.

The agent proceeded on inferred requirements from the user's initial instructions (which mentioned tracking attention budget, requiring a log CSV and study doc) instead of stopping at the guardrail. This caused the first version of PR #7 to miss the actual specification. The owner then provided the verbatim issue text as a change request (decision 2).

### Measured Totals

- **Human decisions:** 3 (approval of #6; change request on PR #7; review of corrected PR #7)
- **Human review minutes:** Approximately 20 minutes (owner retrospective estimate, not stopwatch-measured)
- **Blocking questions:** 1 (GitHub issue #6 access failure)
- **CI runs:** 4 (initial commit; initial completion; correction commit; correction completion)
- **Files changed outside scope:** 0
- **Guardrail stops:** 0

### Owner reflection

The owner retrospectively estimated around 20 minutes of active human review. This figure is approximate and not a precise measurement. The owner is comfortable spending more time or attention when the work is interesting; a hard time budget was useful for this particular experiment, not a general constraint on future work. The study's `budget_exceeded` classification remains based on three decisions versus a two-decision limit, not on a proven overrun of review minutes.

### Outcome

**`budget_exceeded`**

Decision 3 (review of corrected PR #7) exceeded the 2-decision budget per procedure step 6. The study closed as `budget_exceeded`.

### Findings

1. The issue #6 specification was not reachable from this agent's environment. The GitHub MCP and unauthenticated WebFetch both failed while git operations succeeded.

2. The agent inferred requirements from the user's initial instructions instead of stopping when the specification was unreachable. This caused the first PR version to miss the actual specification.

3. The first version of the safety tests overclaimed what they checked. The possibly-related test did not call `groupRelated` or test capture-metadata grouping. The Archive on/off test's grouping comparison could not fail because `groupDuplicates` does not accept roles.
