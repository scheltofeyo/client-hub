---
description: Create a backlog ticket on GitHub Projects with user story and plan
allowed-tools: Bash, Write, Read, Glob, Grep
argument-hint: <kort beschrijving van wat je wilt>
---

You are creating a new backlog ticket for the client-hub repo on GitHub. The ticket must end up as a GitHub issue, auto-added to the `Client Hub Backlog` project, with status `Backlog`.

User's request: $ARGUMENTS

## Steps

### 1. Refine the request
If the description is unclear or missing key context (which user is affected, scope, what "good enough" means), ask 1-2 focused clarifying questions and stop. Otherwise proceed without asking.

### 2. Brainstorm the implementation plan
Search the codebase as needed to understand the impacted area. Think through:
- Which files / components / endpoints are involved
- The simplest viable approach
- Any open questions, trade-offs, or risks

The plan should be specific enough that a future Claude with no context could implement it.

### 3. Generate slug + title
- **Title**: short imperative sentence, no trailing period (matches existing commit style: "Speed up client tasks tab", "Drop redundant template-settings popup")
- **Slug**: lowercase, hyphenated, max 40 chars, derived from title
- Example: title `Speed up client tasks tab` → slug `speed-up-client-tasks-tab`

### 4. Save the plan locally
Write to `.claude/plans/<slug>.md` using this format:

```markdown
# <Title>

## Context
<why this matters, what triggered it>

## Approach
<step by step plan with specific file paths>

## Open questions
<if any, otherwise omit this section>
```

### 5. Show the proposed issue to the user
Present the title and the full issue body (see template in step 6) and ask for confirmation. If pushback, iterate.

### 6. Create the issue
Write the issue body to a temp file first (avoids quoting issues), then create the issue.

Body template:
```markdown
## User story
As a <role>, I want <capability>, so that <outcome>.

## Acceptance criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Plan
<paste the full plan content from step 4 here>

---
*Local plan file: `.claude/plans/<slug>.md`*
```

Commands:
```bash
BODY_FILE=$(mktemp)
cat > "$BODY_FILE" <<'EOF'
<paste body here>
EOF

ISSUE_URL=$(gh issue create --title "<title>" --body-file "$BODY_FILE")
echo "Created: $ISSUE_URL"
ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
```

### 7. Set status to Backlog on the project board
The Auto-add to project workflow takes a moment. Retry until the project item exists, then set Status:

```bash
ISSUE_ID=$(gh api graphql -f query='
  query($n:Int!){
    repository(owner:"scheltofeyo",name:"client-hub"){
      issue(number:$n){id}
    }
  }' -F n=$ISSUE_NUMBER --jq '.data.repository.issue.id')

ITEM_ID=""
for i in 1 2 3 4 5 6; do
  ITEM_ID=$(gh api graphql -f query='
    query($id:ID!){
      node(id:$id){... on Issue{
        projectItems(first:10){nodes{id project{id}}}
      }}
    }' -f id="$ISSUE_ID" \
    --jq '.data.node.projectItems.nodes[] | select(.project.id == "PVT_kwHOBHbkTc4BW5wP") | .id')
  if [ -n "$ITEM_ID" ]; then break; fi
  sleep 2
done

if [ -z "$ITEM_ID" ]; then
  echo "Auto-add did not fire; adding manually"
  ITEM_ID=$(gh api graphql -f query='
    mutation($p:ID!,$c:ID!){
      addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}
    }' -f p="PVT_kwHOBHbkTc4BW5wP" -f c="$ISSUE_ID" \
    --jq '.data.addProjectV2ItemById.item.id')
fi

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
  -f o="d79b2061" >/dev/null

echo "Issue #$ISSUE_NUMBER set to Backlog"
```

### 8. Report
Output to the user:
- Issue URL
- Plan path: `.claude/plans/<slug>.md`
- Reminder: run `/work-ticket <number>` when ready to start

## Constraints
- Keep the plan concrete (file paths, function names) but not over-engineered. No imagined edge cases or future-proofing.
- Do NOT commit the plan file. It stays uncommitted as a working doc, the issue body has the canonical plan.
- Do NOT start implementation work in this command. Only the ticket is created.
