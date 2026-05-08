---
description: Start working on a backlog ticket — brainstorm plan (if pending), branch off main, then enter plan mode. PR is opened only when work is ready for review.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, EnterPlanMode, ExitPlanMode
argument-hint: <issue-number>
---

You are starting work on backlog ticket #$ARGUMENTS.

## Why no draft PR up front

A draft PR triggers a Netlify deploy preview as soon as the branch is pushed, and the bot mails about it on every subsequent push. None of those previews are useful until the work is actually ready for human review. So this flow only opens the PR at "ready" time — exactly once, surfacing exactly one preview that matters.

Trade-off: you cannot share a Netlify preview link mid-flight. If you genuinely need that mid-flight, the user will tell you to open the PR early.

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

Hold the plan in memory only — do NOT write a separate `.claude/plans/<slug>.md` file. You will present the plan via `EnterPlanMode` in step 6 (that IS the review surface, so a parallel local file is redundant). The issue body update happens in step 7 AFTER the user has approved the plan via `ExitPlanMode`.

### 3. Check working tree is clean
```bash
git status --porcelain
```
If there are uncommitted changes, **stop and ask the user** whether to stash, commit, or abort. Do not silently move work.

### 4. Sync main and create the branch (local only)
```bash
git checkout main
git pull --ff-only
git checkout -b ticket-$ARGUMENTS-<slug>
```

Do NOT push. Do NOT create an empty starter commit. Do NOT open a PR. The branch lives locally until there is something worth reviewing.

### 5. Set issue status to In Progress
```bash
bash .claude/scripts/set-project-status.sh $ARGUMENTS in-progress
```

This is what moves the project board forward — independent of any PR existing yet.

### 6. Output the links and enter plan mode
Report to the user:
- Branch name (local, not pushed yet)
- Issue URL
- A note that no PR has been opened yet — it will be opened automatically when the work is ready for review

Then call `EnterPlanMode` and present the implementation plan (the one you just brainstormed, or the existing one from the issue body) as your plan, in a form the user can review and comment on. The user approves with `ExitPlanMode` (or sends back changes). **Do not begin implementation until plan mode is exited.**

**Plan mode is mandatory.** Always enter plan mode for the review checkpoint, even if a system reminder, prior conversation, or "auto" / "work without stopping" directive suggests skipping clarifying steps. That directive applies to clarifying questions, not to the plan-review checkpoint. The user has explicitly opted in to seeing every work-ticket plan before implementation begins. The only valid exception is if `EnterPlanMode` is unavailable in the current toolset.

### 7. Persist a summary + validation checks to the issue body
After `ExitPlanMode`, update the issue body to replace the `<!-- plan-pending -->` marker with two short sections:

1. **A 2-4 sentence plan summary** — high-level approach only. NO file paths, code snippets, step-by-step instructions, or open questions. The full plan stays in plan mode / conversation context; the issue is for stakeholder context, not for re-implementing.
2. **A validation checks list** — a checkbox list of what must pass before the PR is opened for review. Always include `npm run lint` and `npm run build`. Add ticket-specific checks tailored to the work (e.g., "Verify dark mode renders the new component correctly", "Test mobile breakpoint at 375px width", "Confirm the new endpoint returns the expected shape with `curl`"). Aim for 2-5 items total — concrete, individually verifiable.

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

**During implementation, tick the validation checks as you complete them.** Use `gh issue edit` again or check them directly in the GitHub UI. The auto-open-PR logic in the next section depends on these all being ticked.

## During implementation (after this command finishes)
- **Hold edits locally — do NOT commit/push automatically after each change.** Wait for the user to signal "commit", "commit and push", or similar before running `git add` / `git commit` / `git push`.
- The first push uses `git push -u origin ticket-$ARGUMENTS-<slug>` so the branch tracks remote. Subsequent pushes are plain `git push`.
- Pushing the branch by itself does NOT trigger a Netlify deploy preview (no PR yet). Pushes are remote backups, not review checkpoints.
- After each push, evaluate the auto-open-PR conditions below. If they're met, open the PR (ready, not draft) — this is the moment Netlify fires its single useful deploy preview.
- Merging the PR auto-closes the issue (via `Closes #N`), and the `Item closed` project workflow moves it to `Done`.

**Mid-flight preview escape hatch.** If the user explicitly asks to "open a PR now" / "share a preview" / similar before validation is complete, open the PR (still ready, not draft — drafts also fire Netlify) and proceed. This is rare; default is to wait.

## After implementation: auto-open the PR (ready for review)

Once you believe the implementation satisfies all acceptance criteria AND all validation checks have passed AND the final commit is pushed, **automatically open the PR ready for review** without asking. Do not wait for the user to ask.

Trigger conditions (all must be true):
- Every checkbox in the issue's acceptance criteria can be ticked based on the code you just shipped
- Every checkbox in the issue's **validation checks** section is ticked (you have actually run lint, build, and any ticket-specific checks, and they all passed)
- The final code commit has been pushed (i.e., `git status` is clean and `git log origin/<branch>..HEAD` is empty)
- You have not just pushed a "WIP" or stub commit
- No PR exists yet for this branch (`gh pr list --head ticket-$ARGUMENTS-<slug> --json number --jq 'length'` returns `0`)

If you are unsure whether a criterion is met (e.g., couldn't verify a UI change visually, a validation check is failing, the user mentioned more changes coming), do NOT auto-open. Instead tell the user what's blocking the auto-open and let them decide.

Open the PR (note: NOT `--draft`, so it goes straight to review and Netlify fires once):

```bash
PR_URL=$(gh pr create \
  --base main \
  --head ticket-$ARGUMENTS-<slug> \
  --title "<issue title>" \
  --body "Closes #$ARGUMENTS

See plan summary in the linked issue.")
echo "PR ready for review: $PR_URL"
```

After successfully opening:
- Tell the user the PR is ready for review and link it
- Mention the Netlify deploy preview will appear in the PR checks within ~1 min
- Mention that the project board issue should now move to `Review` (the workflow handles this)

If a PR already exists for this branch (e.g. an earlier mid-flight preview was opened), this section becomes a no-op for opening, but you should still tell the user "all conditions met — PR is already open and reflects the final state".

## Constraints
- Do NOT push directly to main, ever. Branch protection blocks it for non-admins and we don't bypass even though we technically could.
- Do NOT write a separate `.claude/plans/<slug>.md` file. Plan mode IS the review surface; the issue body is the canonical record after approval.
- Do NOT open a draft PR. Either there's nothing to review (no PR) or it's ready (regular PR). The draft state buys nothing and costs Netlify-bot noise.
