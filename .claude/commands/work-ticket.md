---
description: Start working on a backlog ticket — brainstorm plan (if pending), create branch + draft PR for preview, then enter plan mode
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, EnterPlanMode, ExitPlanMode
argument-hint: <issue-number>
---

You are starting work on backlog ticket #$ARGUMENTS.

## Steps

### 1. Fetch the issue
```bash
gh issue view $ARGUMENTS --json title,body,number,url
```
Read the title and body. The body always contains user story + acceptance criteria. The plan section may be a `<!-- plan-pending -->` marker (created by `/create-ticket`) or already filled in (legacy or re-run).

Derive the slug from the title: lowercase, hyphenated, max 40 chars.

### 2. Brainstorm + write the plan if pending
Check whether the issue body contains `<!-- plan-pending` (marker left by `/create-ticket`). If yes, you brainstorm the plan now. If no, the plan is already in the body — skip to step 3.

**When the plan is pending:**

Search the codebase as needed to understand the impacted area. Think through:
- Which files / components / endpoints are involved
- The simplest viable approach
- Any open questions, trade-offs, or risks

The plan should be specific enough that a future Claude with no context could implement it. Keep it concrete (file paths, function names) but not over-engineered. No imagined edge cases or future-proofing.

Write the plan to `.claude/plans/<slug>.md`:
```markdown
# <Title>

## Context
<why this matters, what triggered it>

## Approach
<step by step plan with specific file paths>

## Open questions
<if any, otherwise omit this section>
```

Then update the issue body, replacing the `<!-- plan-pending -->` marker with the full plan content. Use `gh issue edit` with a body file:
```bash
PLAN_FILE=".claude/plans/<slug>.md"
NEW_BODY_FILE=$(mktemp)

# Fetch current body and replace the plan-pending marker line with the plan content
gh issue view $ARGUMENTS --json body --jq '.body' > "$NEW_BODY_FILE.orig"

awk -v plan_file="$PLAN_FILE" '
  /<!-- plan-pending/ {
    while ((getline line < plan_file) > 0) print line
    close(plan_file)
    next
  }
  { print }
' "$NEW_BODY_FILE.orig" > "$NEW_BODY_FILE"

# Append local plan reference footer
printf '\n\n---\n*Local plan file: `%s`*\n' "$PLAN_FILE" >> "$NEW_BODY_FILE"

gh issue edit $ARGUMENTS --body-file "$NEW_BODY_FILE"
```

Do NOT commit `.claude/plans/<slug>.md` — it stays uncommitted as a working doc; the issue body is canonical.

### 3. Check working tree is clean
```bash
git status --porcelain
```
If there are uncommitted changes, **stop and ask the user** whether to stash, commit, or abort. Do not silently move work.

### 4. Sync main and create the branch
```bash
git checkout main
git pull --ff-only
git checkout -b ticket-$ARGUMENTS-<slug>
```

### 5. Open a draft PR with an empty commit
The empty commit is needed because GitHub won't open a PR with no diff. The deploy preview build kicks in as soon as the branch is pushed.

```bash
git commit --allow-empty -m "Start ticket #$ARGUMENTS"
git push -u origin ticket-$ARGUMENTS-<slug>

PR_URL=$(gh pr create --draft \
  --base main \
  --head ticket-$ARGUMENTS-<slug> \
  --title "<issue title>" \
  --body "Closes #$ARGUMENTS

See plan in the linked issue.")
echo "Draft PR: $PR_URL"
```

### 6. Set issue status to In Progress
```bash
bash .claude/scripts/set-project-status.sh $ARGUMENTS in-progress
```

### 7. Output the links and enter plan mode
Report to the user:
- Branch name
- Draft PR URL (Netlify preview appears in the PR checks within ~1 min)
- Issue URL (canonical plan lives in the issue body)
- Local plan file path: `.claude/plans/<slug>.md`

Then call `EnterPlanMode` and present the implementation plan (the one you just wrote, or the existing one from the issue body) as your plan, in a form the user can review and comment on. The user approves with `ExitPlanMode` (or sends back changes). **Do not begin implementation until plan mode is exited.**

## During implementation (after this command finishes)
- Push commits to the branch as you go. Each push refreshes the Netlify preview.
- When work is done and ready for review, run `gh pr ready <pr-number>`. The `pr-review-status` workflow will flip the linked issue to `Review` on the project board.
- Merging the PR auto-closes the issue (via `Closes #N`), and the `Item closed` project workflow moves it to `Done`.

## After implementation: auto-mark PR ready
Once you believe the implementation satisfies all acceptance criteria from the issue body and the final commit is pushed, **automatically run** `gh pr ready <pr-number>` without asking. Do not wait for the user to ask.

Trigger conditions (all must be true):
- Every checkbox in the issue's acceptance criteria can be ticked based on the code you just shipped
- The final code commit has been pushed (i.e., `git status` is clean and `git log origin/<branch>..HEAD` is empty)
- You have not just pushed a "WIP" or stub commit

If you are unsure whether a criterion is met (e.g., couldn't verify a UI change visually, a check is failing, the user mentioned more changes coming), do NOT auto-ready. Instead tell the user what's blocking the auto-ready and let them decide.

After successfully running `gh pr ready`:
- Tell the user the PR is ready for review and re-link the deploy preview URL
- Mention that the project board issue should now be on `Review` (the workflow handles this)

## Constraints
- Do NOT push directly to main, ever. Branch protection blocks it for non-admins and we don't bypass even though we technically could.
- Do NOT commit `.claude/plans/<slug>.md`.
