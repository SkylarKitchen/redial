# Claude Code hooks for redial

Small `PreToolUse` hooks that intercept `Write` / `Edit` / `NotebookEdit`
tool calls before they hit disk. Goal: catch leaks the model's
self-policing misses, so they never reach the working tree.

## `block-unreleased-models.sh`

Blocks any tool call whose content matches the regex
`claude-(opus|sonnet|haiku)-4-[6-9]\b` — i.e. an unreleased Anthropic
opus / sonnet / haiku version. Use env vars / gitignored config (e.g.
`.sandcastle/.env`) for those.

### Install (one-time, per machine)

```sh
# Copy the hook and make it executable
mkdir -p ~/.claude/hooks
cp tools/claude-hooks/block-unreleased-models.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/block-unreleased-models.sh
```

Then add to `~/.claude/settings.json` (merge with whatever's there):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/block-unreleased-models.sh"
          }
        ]
      }
    ]
  }
}
```

If `~/.claude/settings.json` already has hooks, merge the array entry
above into the existing `PreToolUse` list — don't replace.

### Activate

Either:
- Restart Claude Code, or
- Open the `/hooks` menu once (it reloads config).

The settings file watcher only watches directories that contained a
settings file at session start, so a brand-new `~/.claude/settings.json`
doesn't take effect until a reload.

### Verify it works

In a Claude Code session, ask Claude to write a file whose contents
include an unreleased opus or sonnet identifier (anything matching
`claude-(opus|sonnet|haiku)-4-[6-9]`). The hook should refuse with:

```
Blocked: unreleased Anthropic model identifier in tool input.
Move it to env vars / a gitignored config.
```

### Test the script directly

The test strings below are constructed at runtime via `printf`, so the
literal patterns never appear in this file (the hook would otherwise
block this README from being edited).

```sh
# Should BLOCK (exit 2):
PAT=$(printf 'claude-opus-4-%d' 7)
echo "{\"tool_name\":\"Write\",\"tool_input\":{\"content\":\"$PAT\"}}" \
  | ~/.claude/hooks/block-unreleased-models.sh; echo "exit=$?"

# Should PASS (exit 0):
PAT=$(printf 'claude-opus-4-%d' 5)
echo "{\"tool_name\":\"Write\",\"tool_input\":{\"content\":\"$PAT\"}}" \
  | ~/.claude/hooks/block-unreleased-models.sh; echo "exit=$?"
```

### Uninstall

Remove the matcher entry from `~/.claude/settings.json`, or set
`"disableAllHooks": true` to disable everything globally. The script
itself is harmless at rest.

### A note on editing this file

If you ever want to edit this README, the hook will (correctly) refuse
writes containing literal unreleased identifiers. That's the whole
point. Either:
- only edit text that doesn't contain those patterns,
- temporarily disable the hook via `/hooks` while editing, or
- use `printf` / shell substitution to construct the strings at runtime
  (the pattern used throughout this file).
