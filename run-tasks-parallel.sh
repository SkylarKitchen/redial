#!/usr/bin/env bash
# run-tasks-parallel.sh — Parallel task runner using git worktrees
# Each worker gets an isolated repo copy. File locking prevents duplicate claims.
#
# Usage:
#   ./run-tasks-parallel.sh tasks.md 10
#   ./run-tasks-parallel.sh tasks.md 5 --max-turns 50
#
# Args:
#   $1 = PRD file (markdown checklist)
#   $2 = number of workers (default: 10)
#   $3+ = extra claude flags (default: --max-turns 30)

set -euo pipefail

PRD_FILE="${1:?Usage: ./run-tasks-parallel.sh <tasks.md> [workers] [--max-turns N]}"
NUM_WORKERS="${2:-10}"
shift 2 2>/dev/null || shift 1
EXTRA_FLAGS="${*:---max-turns 30}"

TIMESTAMP_FMT='+%Y-%m-%d %H:%M:%S'
LOG_DIR="./task-logs-parallel"
WORKTREE_DIR=".worktrees"
LOCK_FILE=".task-lock"
MAIN_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# --- Setup ---
mkdir -p "$LOG_DIR"

if [[ ! -f "$PRD_FILE" ]]; then
  echo "Error: $PRD_FILE not found"
  exit 1
fi

# Extract all tasks upfront (line_num:task_text)
TASK_FILE=$(mktemp)
grep -n '^\s*- \[ \]' "$PRD_FILE" > "$TASK_FILE" || true
TOTAL_TASKS=$(wc -l < "$TASK_FILE" | tr -d ' ')

if [[ "$TOTAL_TASKS" -eq 0 ]]; then
  echo "No pending tasks found in $PRD_FILE"
  rm -f "$TASK_FILE"
  exit 0
fi

# Adjust workers if fewer tasks than workers
if [[ "$NUM_WORKERS" -gt "$TOTAL_TASKS" ]]; then
  NUM_WORKERS="$TOTAL_TASKS"
fi

# Task counter file (atomic claim via flock)
COUNTER_FILE=$(mktemp)
echo "0" > "$COUNTER_FILE"

# Results tracking
RESULTS_DIR=$(mktemp -d)

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-50
}

# macOS-compatible spinlock using mkdir (atomic on all POSIX systems)
lock() {
  while ! mkdir "$1" 2>/dev/null; do
    sleep 0.05
  done
}

unlock() {
  rmdir "$1" 2>/dev/null || true
}

# --- Create worktrees ---
echo "========================================"
echo " Parallel Task Runner"
echo "========================================"
echo " PRD:      $PRD_FILE"
echo " Workers:  $NUM_WORKERS"
echo " Tasks:    $TOTAL_TASKS"
echo " Logs:     $LOG_DIR"
echo " Flags:    -p --dangerously-skip-permissions $EXTRA_FLAGS"
echo " Start:    $(date "$TIMESTAMP_FMT")"
echo "========================================"
echo ""

echo "Creating $NUM_WORKERS worktrees..."
mkdir -p "$WORKTREE_DIR"

for i in $(seq 1 "$NUM_WORKERS"); do
  wt_path="${WORKTREE_DIR}/worker-${i}"
  branch_name="worker-${i}-$(date +%Y%m%d-%H%M%S)"

  if [[ -d "$wt_path" ]]; then
    git worktree remove "$wt_path" --force 2>/dev/null || true
  fi

  git worktree add "$wt_path" -b "$branch_name" HEAD --quiet
  echo "  Worker $i: $wt_path ($branch_name)"
done
echo ""

# --- Worker function ---
worker() {
  local worker_id=$1
  local wt_path="${WORKTREE_DIR}/worker-${worker_id}"

  while true; do
    # Atomic claim: lock, read counter, increment, unlock
    local task_idx
    lock "${LOCK_FILE}.counter"
    task_idx=$(cat "$COUNTER_FILE")
    echo $((task_idx + 1)) > "$COUNTER_FILE"
    unlock "${LOCK_FILE}.counter"

    # Check if we've exhausted all tasks
    if [[ "$task_idx" -ge "$TOTAL_TASKS" ]]; then
      break
    fi

    # Get task details (0-indexed line from TASK_FILE)
    local line
    line=$(sed -n "$((task_idx + 1))p" "$TASK_FILE")
    local line_num
    line_num=$(echo "$line" | cut -d: -f1)
    local task_text
    task_text=$(echo "$line" | sed 's/^[0-9]*:[[:space:]]*- \[ \] //')
    local task_num=$((task_idx + 1))
    local slug
    slug=$(slugify "$task_text")
    local logfile="${LOG_DIR}/w${worker_id}-task-${task_num}-${slug}-$(date '+%Y%m%d-%H%M%S').log"

    echo "[W${worker_id}] Task $task_num/$TOTAL_TASKS: $(echo "$task_text" | cut -c1-70)..."

    # Run claude in the worktree directory
    if (cd "$wt_path" && claude -p --dangerously-skip-permissions $EXTRA_FLAGS "$task_text") > "$logfile" 2>&1; then
      echo "[W${worker_id}] Task $task_num: DONE"
      echo "done:${line_num}:${task_num}:${worker_id}" >> "${RESULTS_DIR}/results.log"

      # Atomic PRD update
      lock "${LOCK_FILE}.prd"
      sed -i '' "${line_num}s/- \[ \]/- [x]/" "$PRD_FILE"
      unlock "${LOCK_FILE}.prd"
    else
      echo "[W${worker_id}] Task $task_num: FAILED"
      echo "fail:${line_num}:${task_num}:${worker_id}" >> "${RESULTS_DIR}/results.log"

      lock "${LOCK_FILE}.prd"
      sed -i '' "${line_num}s/- \[ \]/- [!]/" "$PRD_FILE"
      unlock "${LOCK_FILE}.prd"
    fi
  done

  echo "[W${worker_id}] No more tasks. Exiting."
}

# --- Launch workers ---
echo "Launching $NUM_WORKERS workers..."
echo ""

pids=()
for i in $(seq 1 "$NUM_WORKERS"); do
  worker "$i" &
  pids+=($!)
done

# Wait for all workers
echo "All workers launched. Waiting for completion..."
echo "(Use ./dashboard-parallel.sh to monitor progress)"
echo ""

for pid in "${pids[@]}"; do
  wait "$pid" 2>/dev/null || true
done

# --- Summary ---
done_count=$(grep -c '^\- \[x\]' "$PRD_FILE" || echo 0)
fail_count=$(grep -c '^\- \[!\]' "$PRD_FILE" || echo 0)
remaining=$(grep -c '^\- \[ \]' "$PRD_FILE" || echo 0)

echo ""
echo "========================================"
echo " All workers finished"
echo "========================================"
echo "  Done:      $done_count"
echo "  Failed:    $fail_count"
echo "  Remaining: $remaining"
echo "  Finished:  $(date "$TIMESTAMP_FMT")"
echo "========================================"
echo ""

# --- List worktree branches for merge ---
echo "Worker branches to merge:"
for i in $(seq 1 "$NUM_WORKERS"); do
  wt_path="${WORKTREE_DIR}/worker-${i}"
  if [[ -d "$wt_path" ]]; then
    branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD)
    changes=$(git -C "$wt_path" diff --stat HEAD | tail -1)
    if [[ -n "$changes" ]]; then
      echo "  $branch: $changes"
    else
      echo "  $branch: (no changes)"
    fi
  fi
done

echo ""
echo "To merge all workers into $MAIN_BRANCH:"
echo "  ./merge-workers.sh"
echo ""
echo "To clean up worktrees:"
echo "  ./cleanup-workers.sh"

# --- Cleanup temp files ---
rm -f "$TASK_FILE" "$COUNTER_FILE"
rmdir "${LOCK_FILE}.counter" "${LOCK_FILE}.prd" 2>/dev/null || true
rm -rf "$RESULTS_DIR"
