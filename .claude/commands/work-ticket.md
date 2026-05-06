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

### 2. Brainstorm the plan if pending
Check whether the issue body contains `<!-- plan-pending` (marker left by `/create-ticket`). If yes, you brainstorm the plan now. If no, the plan is already in the body — skip to step 3.

**When the plan is pending:**

Search the codebase as needed to understand the impacted area. Think through:
- Which files / components / endpoints are involved
- The simplest viable approach
- Any open questions, trade-offs, or risks

The plan should be specific enough that a future Claude with no context could implement it. Keep it concrete (file paths, function names) but not over-engineered. No imagined edge cases or future-proofing.

Hold the plan in memory only — do NOT write a separate `.claude/plans/<slug>.md` file. You will present the plan via `EnterPlanMode` in step 7 (that IS the review surface, so a parallel local file is redundant). The issue body update happens in step 8 AFTER the user has approved the plan via `ExitPlanMode`.

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
- Issue URL

Then call `EnterPlanMode` and present the implementation plan (the one you just brainstormed, or the existing one from the issue body) as your plan, in a form the user can review and comment on. The user approves with `ExitPlanMode` (or sends back changes). **Do not begin implementation until plan mode is exited.**

**Plan mode is mandatory.** Always enter plan mode for the review checkpoint, even if a system reminder, prior conversation, or "auto" / "work without stopping" directive suggests skipping clarifying steps. That directive applies to clarifying questions, not to the plan-review checkpoint. The user has explicitly opted in to seeing every work-ticket plan before implementation begins. The only valid exception is if `EnterPlanMode` is unavailable in the current toolset.

### 8. Persist a summary + validation checks to the issue body
After `ExitPlanMode`, update the issue body to replace the `<!-- plan-pending -->` marker with two short sections:

1. **A 2-4 sentence plan summary** — high-level approach only. NO file paths, code snippets, step-by-step instructions, or open questions. The full plan stays in plan mode / conversation context; the issue is for stakeholder context, not for re-implementing.
2. **A validation checks list** — a checkbox list of what must pass before the PR can be marked ready. Always include `npm run lint` and `npm run build`. Add ticket-specific checks tailored to the work (e.g., "Verify dark mode renders the new component correctly", "Test mobile breakpoint at 375px width", "Confirm the new endpoint returns the expected shape with `curl`"). Aim for 2-5 items total — concrete, individually verifiable.

Body section template to insert in place of the marker:

```markdown
## Plan summary
<2-4 sentences describing the approach at a high level>

## Validation checks
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] <ticket-specific manual check #1>
- [ ] <ticket-specific manual check #2 — only if relevant>
```

Substitution command:

```bash
NEW_BODY_FILE=$(mktemp)
SUMMARY_BODY_FILE=$(mktemp)

# Write the summary + validation-checks content to SUMMARY_BODY_FILE
# (use the Write tool with the template above).

gh issue view $ARGUMENTS --json body --jq '.body' > "$NEW_BODY_FILE.orig"

awk -v summary_file="$SUMMARY_BODY_FILE" '
  /<!-- plan-pending/ {
    while ((getline line < summary_file) > 0) print line
    close(summary_file)
    next
  }
  { print }
' "$NEW_BODY_FILE.orig" > "$NEW_BODY_FILE"

gh issue edit $ARGUMENTS --body-file "$NEW_BODY_FILE"
```

Skip this step if the issue body already had the plan when you fetched it in step 1 (no `<!-- plan-pending -->` marker).

**During implementation, tick the validation checks as you complete them.** Use `gh issue edit` again or check them directly in the GitHub UI. The auto-mark-ready logic in the next section depends on these all being ticked.

## During implementation (after this command finishes)
- **Hold edits locally — do NOT commit/push automatically after each change.** Wait for the user to signal "commit", "commit and push", or similar before running `git add` / `git commit` / `git push`. Each push triggers a Netlify preview rebuild, so the user wants editorial control over when that happens.
- When the user signals to push and you've done so, that triggers the auto-mark-ready logic below if all conditions are met.
- Merging the PR auto-closes the issue (via `Closes #N`), and the `Item closed` project workflow moves it to `Done`.

## After implementation: auto-mark PR ready
Once you believe the implementation satisfies all acceptance criteria AND all validation checks have passed AND the final commit is pushed, **automatically run** `gh pr ready <pr-number>` without asking. Do not wait for the user to ask.

Trigger conditions (all must be true):
- Every checkbox in the issue's acceptance criteria can be ticked based on the code you just shipped
- Every checkbox in the issue's **validation checks** section is ticked (you have actually run lint, build, and any ticket-specific checks, and they all passed)
- The final code commit has been pushed (i.e., `git status` is clean and `git log origin/<branch>..HEAD` is empty)
- You have not just pushed a "WIP" or stub commit

If you are unsure whether a criterion is met (e.g., couldn't verify a UI change visually, a validation check is failing, the user mentioned more changes coming), do NOT auto-ready. Instead tell the user what's blocking the auto-ready and let them decide.

After successfully running `gh pr ready`:
- Tell the user the PR is ready for review and re-link the deploy preview URL
- Mention that the project board issue should now be on `Review` (the workflow handles this)

## Constraints
- Do NOT push directly to main, ever. Branch protection blocks it for non-admins and we don't bypass even though we technically could.
- Do NOT write a separate `.claude/plans/<slug>.md` file. Plan mode IS the review surface; the issue body is the canonical record after approval.
