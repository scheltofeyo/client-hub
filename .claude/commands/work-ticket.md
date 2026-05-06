---
description: Start working on a backlog ticket — creates branch + draft PR for preview
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
argument-hint: <issue-number>
---

You are starting work on backlog ticket #$ARGUMENTS.

## Steps

### 1. Fetch the issue
```bash
gh issue view $ARGUMENTS --json title,body,number,url
```
Read the title and body. The body contains the user story, acceptance criteria, and full plan.

### 2. Try to load the local plan
Derive the slug from the title (lowercase, hyphenated, max 40 chars) and read `.claude/plans/<slug>.md` if it exists. If not, the plan is in the issue body — that's fine.

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

### 6. Summarize and hand off
Report to the user:
- Branch name
- Draft PR URL
- Netlify preview will appear in the PR checks within ~1 min

Then summarize the plan from the issue/local plan in 3-5 bullets and ask which part to start with. **Do not begin implementation until the user confirms direction.**

## During implementation (after this command finishes)
- Push commits to the branch as you go. Each push refreshes the Netlify preview.
- When work is done and ready for review, run `gh pr ready <pr-number>`. The `pr-review-status` workflow will flip the linked issue to `Review` on the project board.
- Merging the PR auto-closes the issue (via `Closes #N`), and the `Item closed` project workflow moves it to `Done`.

## Constraints
- Do NOT push directly to main, ever. Branch protection blocks it for non-admins and we don't bypass even though we technically could.
- Do NOT mark the PR ready in this command. That happens manually when work is complete.
