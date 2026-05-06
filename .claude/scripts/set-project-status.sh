#!/usr/bin/env bash
# Set the Status field of a GitHub issue on the Client Hub Backlog project board.
# Usage: set-project-status.sh <issue-number> <status>
# Status values: backlog | in-progress
set -euo pipefail

ISSUE_NUMBER="${1:?issue number required}"
STATUS="${2:?status required (backlog|in-progress)}"

PROJECT_ID="PVT_kwHOBHbkTc4BW5wP"
FIELD_ID="PVTSSF_lAHOBHbkTc4BW5wPzhSKZd4"

case "$STATUS" in
  backlog)     OPTION_ID="d79b2061" ;;
  in-progress) OPTION_ID="63446ed8" ;;
  *)
    echo "Unknown status: $STATUS (expected: backlog|in-progress)" >&2
    exit 1
    ;;
esac

ISSUE_ID=$(gh api graphql -f query='
  query($n:Int!){
    repository(owner:"scheltofeyo",name:"client-hub"){
      issue(number:$n){id}
    }
  }' -F n="$ISSUE_NUMBER" --jq '.data.repository.issue.id')

# addProjectV2ItemById is idempotent: returns the existing item if already added,
# so no retry loop or pre-check is needed.
ITEM_ID=$(gh api graphql -f query='
  mutation($p:ID!,$c:ID!){
    addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}
  }' -f p="$PROJECT_ID" -f c="$ISSUE_ID" \
  --jq '.data.addProjectV2ItemById.item.id')

gh api graphql -f query='
  mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){
    updateProjectV2ItemFieldValue(input:{
      projectId:$p, itemId:$i, fieldId:$f,
      value:{singleSelectOptionId:$o}
    }){projectV2Item{id}}
  }' \
  -f p="$PROJECT_ID" \
  -f i="$ITEM_ID" \
  -f f="$FIELD_ID" \
  -f o="$OPTION_ID" >/dev/null

echo "Issue #$ISSUE_NUMBER set to $STATUS"
