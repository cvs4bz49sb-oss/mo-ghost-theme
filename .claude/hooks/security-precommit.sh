#!/bin/bash
# Pre-commit security gate — invoked by Claude Code via PreToolUse on
# Bash. Reads the tool input (a JSON blob) from stdin; if the command
# is a `git commit`, runs scripts/security-precommit.mjs and blocks
# the commit if any mechanical check fails.
#
# To bypass for a known-safe edge case, add `SECURITY-OVERRIDE: <reason>`
# to the commit message and the agent will pass it. (Detection of the
# override is at the LLM-driven /security-check level; the mechanical
# script doesn't read commit messages.)

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(echo "$INPUT" | jq -r '.tool_input.command // ""')"

# Only gate `git commit` invocations. `git commit --amend` and `git
# commit -m '...'` both match. `git commit-tree`, `git reset`, etc.
# do not.
if [[ ! "$COMMAND" =~ ^[[:space:]]*git[[:space:]]+commit([[:space:]]|$) ]]; then
  # Not a commit. Allow through silently.
  exit 0
fi

# Skip if the commit message includes SECURITY-OVERRIDE. The override
# logs a note for later review but doesn't block.
if echo "$COMMAND" | grep -q "SECURITY-OVERRIDE:"; then
  jq -n '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "SECURITY-OVERRIDE present in commit message"}}'
  exit 0
fi

REPO_ROOT="$(git -C "$(pwd)" rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPT="$REPO_ROOT/scripts/security-precommit.mjs"

if [[ ! -f "$SCRIPT" ]]; then
  # No script in this repo — allow.
  exit 0
fi

# Run the mechanical checks.
OUTPUT="$(cd "$REPO_ROOT" && node "$SCRIPT" 2>&1)" && EXIT=0 || EXIT=$?

if [[ "$EXIT" -ne 0 ]]; then
  REASON=$(echo "$OUTPUT" | tail -50)
  jq -n --arg reason "Security agent blocked the commit. Fix the issue and re-stage, or run /security-check for the LLM-driven review.

$REASON" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi

# Pass.
exit 0
