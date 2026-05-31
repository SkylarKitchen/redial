#!/usr/bin/env bash
# block-unreleased-models.sh
#
# Claude Code PreToolUse hook. Blocks Write / Edit / NotebookEdit calls
# whose content contains an unreleased Anthropic model identifier
# (claude-{opus,sonnet,haiku}-4-[6-9]).
#
# Install globally on your Mac:
#   mkdir -p ~/.claude/hooks
#   cp tools/claude-hooks/block-unreleased-models.sh ~/.claude/hooks/
#   chmod +x ~/.claude/hooks/block-unreleased-models.sh
#
# Then add to ~/.claude/settings.json (see tools/claude-hooks/README.md
# for the full snippet) and restart Claude Code or open /hooks once.
#
# Exits 2 with a stderr message → blocks the tool call.

set -u

PATTERN='claude-(opus|sonnet|haiku)-4-[6-9]\b'

input=$(cat)

# Concatenate every relevant text field the tool might carry. Edit uses
# old_string/new_string, Write uses content, NotebookEdit uses new_source.
content=$(printf '%s' "$input" | jq -r '
  .tool_input
  | [ .content, .new_string, .old_string, .new_source ]
  | map(select(. != null))
  | join("\n")
' 2>/dev/null)

if printf '%s' "$content" | grep -iqP "$PATTERN"; then
  echo "Blocked: unreleased Anthropic model identifier in tool input. Move it to env vars / a gitignored config." >&2
  exit 2
fi

exit 0
