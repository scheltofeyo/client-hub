---
description: Create a backlog ticket on GitHub Projects with user story (no plan yet — that happens in /work-ticket)
allowed-tools: Bash, Write, Read
argument-hint: <kort beschrijving van wat je wilt>
---

You are creating a new backlog ticket for the client-hub repo on GitHub. The ticket must end up as a GitHub issue, auto-added to the `Client Hub Backlog` project, with status `Backlog`.

User's request: $ARGUMENTS

The implementation plan is intentionally NOT written here — it gets created in `/work-ticket` when the ticket actually starts. This avoids spending tokens on plans for tickets that may never be picked up, and avoids stale plans for tickets that sit in the backlog for weeks.

## Steps

### 1. Refine the request
If the description is unclear or missing key context (which user is affected, scope, what "good enough" means), ask 1-2 focused clarifying questions and stop. Otherwise proceed without asking.

Do NOT search the codebase here. The goal is to capture intent + acceptance criteria, not design the implementation.

### 2. Generate slug + title
- **Title**: short imperative sentence, no trailing period (matches existing commit style: "Speed up client tasks tab", "Drop redundant template-settings popup")
- **Slug**: lowercase, hyphenated, max 40 chars, derived from title
- Example: title `Speed up client tasks tab` → slug `speed-up-client-tasks-tab`

### 3. Create the issue
Write the issue body to a temp file first (avoids quoting issues), then create the issue immediately. Do NOT pre-confirm with the user — the report in step 5 acts as the confirmation, and the user can edit/close the issue if it's wrong.

Body template:
```markdown
## User story
As a <role>, I want <capability>, so that <outcome>.

## Acceptance criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Plan
<!-- plan-pending: filled in by /work-ticket when this ticket is picked up -->
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

### 4. Set status to Backlog on the project board
```bash
bash .claude/scripts/set-project-status.sh "$ISSUE_NUMBER" backlog
```

### 5. Report
Output to the user:
- The proposed title
- The user story + acceptance criteria you used
- Issue URL
- Reminder: run `/work-ticket <number>` when ready to start (the implementation plan gets brainstormed and written then)

The user reviews the report — if anything is wrong they can edit the issue on GitHub or ask you to update it.

## Constraints
- Do NOT search the codebase or brainstorm an implementation plan in this command.
- Do NOT start implementation work. Only the ticket is created.
- Acceptance criteria stay short and outcome-focused. They are WHAT, not HOW.
