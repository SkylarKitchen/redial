#!/usr/bin/env bash
# run-tasks.sh — Overnight autonomous task runner for Claude Code
# Processes a markdown checklist, one task per fresh claude invocation.
#
# Usage:
#   ./run-tasks.sh tasks.md
#   ./run-tasks.sh tasks.md --max-turns 50
#
# Each "- [ ]" item becomes a prompt to a fresh `claude` process.
# Progress is tracked in-place: [x] = done, [!] = failed.
# Resumable — rerun the same file to pick up where you left off.

set -euo pipefail

# --- Args ---
PRD_FILE="${1:?Usage: ./run-tasks.sh <tasks.md> [--max-turns N]}"
shift
EXTRA_FLAGS="${*:---max-turns 30}"

LOG_DIR="./task-logs"
TIMESTAMP_FMT='+%Y-%m-%d %H:%M:%S'

# --- Setup ---
mkdir -p "$LOG_DIR"

if [[ ! -f "$PRD_FILE" ]]; then
  echo "Error: $PRD_FILE not found"
  exit 1
fi

# --- Functions ---
get_next_task() {
  grep -n '^\s*- \[ \]' "$PRD_FILE" | head -1 || true
}

mark_done() {
  local line_num="$1"
  sed -i '' "${line_num}s/- \[ \]/- [x]/" "$PRD_FILE"
}

mark_failed() {
  local line_num="$1"
  sed -i '' "${line_num}s/- \[ \]/- [!]/" "$PRD_FILE"
}

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-50
}

# --- Main Loop ---
echo "========================================"
echo " Task Runner"
echo "========================================"
echo " PRD:   $PRD_FILE"
echo " Logs:  $LOG_DIR"
echo " Flags: -p --dangerously-skip-permissions $EXTRA_FLAGS"
echo " Start: $(date "$TIMESTAMP_FMT")"
echo "========================================"
echo ""

task_num=0

while true; do
  match=$(get_next_task)

  if [[ -z "$match" ]]; then
    echo ""
    echo "All tasks processed."
    break
  fi

  line_num=$(echo "$match" | cut -d: -f1)
  task_text=$(echo "$match" | sed 's/^[0-9]*:[[:space:]]*- \[ \] //')
  task_num=$((task_num + 1))
  slug=$(slugify "$task_text")
  logfile="${LOG_DIR}/task-${task_num}-${slug}-$(date '+%Y%m%d-%H%M%S').log"

  echo "--- Task $task_num ---"
  echo "  $task_text"
  echo "  Log: $logfile"
  echo "  Started: $(date "$TIMESTAMP_FMT")"

  # Each invocation is a fresh process = fresh context window
  if claude -p --dangerously-skip-permissions $EXTRA_FLAGS "$task_text" > "$logfile" 2>&1; then
    mark_done "$line_num"
    echo "  Result: DONE"
  else
    mark_failed "$line_num"
    echo "  Result: FAILED (exit code: $?)"
  fi

  echo "  Finished: $(date "$TIMESTAMP_FMT")"
  echo ""
done

# --- Summary ---
done_count=$(grep -c '^\s*- \[x\]' "$PRD_FILE" || echo 0)
failed_count=$(grep -c '^\s*- \[!\]' "$PRD_FILE" || echo 0)
remaining=$(grep -c '^\s*- \[ \]' "$PRD_FILE" || echo 0)

echo "========================================"
echo " Summary"
echo "========================================"
echo "  Done:      $done_count"
echo "  Failed:    $failed_count"
echo "  Remaining: $remaining"
echo "  Finished:  $(date "$TIMESTAMP_FMT")"
echo "========================================"
