#!/usr/bin/env bash
# cleanup-workers.sh — Remove all worker worktrees and branches

set -euo pipefail

WORKTREE_DIR=".worktrees"

echo "Cleaning up worktrees..."

for wt_path in "$WORKTREE_DIR"/worker-*; do
  [[ -d "$wt_path" ]] || continue

  worker=$(basename "$wt_path")
  branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

  git worktree remove "$wt_path" --force 2>/dev/null || rm -rf "$wt_path"
  git branch -D "$branch" 2>/dev/null || true

  echo "  Removed $worker ($branch)"
done

rmdir "$WORKTREE_DIR" 2>/dev/null || true
rm -f .task-lock .task-lock.prd

echo "Done."
