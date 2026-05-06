---
description: Start working on a backlog ticket — creates branch + draft PR for preview, then enters plan mode
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, EnterPlanMode, ExitPlanMode
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

### 6. Set issue status to In Progress
Get the project item ID for the issue and set Status to `In Progress`:

```bash
ISSUE_ID=$(gh api graphql -f query='
  query($n:Int!){
    repository(owner:"scheltofeyo",name:"client-hub"){
      issue(number:$n){id}
    }
  }' -F n=$ARGUMENTS --jq '.data.repository.issue.id')

ITEM_ID=$(gh api graphql -f query='
  query($id:ID!){
    node(id:$id){... on Issue{
      projectItems(first:10){nodes{id project{id}}}
    }}
  }' -f id="$ISSUE_ID" \
  --jq '.data.node.projectItems.nodes[] | select(.project.id == "PVT_kwHOBHbkTc4BW5wP") | .id')

gh api graphql -f query='
  mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){
    updateProjectV2ItemFieldValue(input:{
      projectId:$p, itemId:$i, fieldId:$f,
      value:{singleSelectOptionId:$o}
    }){projectV2Item{id}}
  }' \
  -f p="PVT_kwHOBHbkTc4BW5wP" \
  -f i="$ITEM_ID" \
  -f f="PVTSSF_lAHOBHbkTc4BW5wPzhSKZd4" \
  -f o="63446ed8" >/dev/null
```

### 7. Output the links and enter plan mode
Report to the user:
- Branch name
- Draft PR URL (Netlify preview appears in the PR checks within ~1 min)
- **Issue URL** (canonical plan lives in the issue body)
- **Local plan file path** if `.claude/plans/<slug>.md` exists

Then call `EnterPlanMode` and present the implementation plan from the issue body / local plan file as your plan, in a form the user can review and comment on. The user approves with `ExitPlanMode` (or sends back changes). **Do not begin implementation until plan mode is exited.**

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
