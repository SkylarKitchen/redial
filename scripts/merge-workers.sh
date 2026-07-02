#!/usr/bin/env bash
# merge-workers.sh — Merge all worker branches back into main
# Reviews each branch, attempts merge, reports conflicts.
# Usage (run from the repo root): ./scripts/merge-workers.sh

set -euo pipefail

WORKTREE_DIR=".worktrees"
MAIN_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "========================================"
echo " Merging worker branches into $MAIN_BRANCH"
echo "========================================"
echo ""

merged=0
skipped=0
conflicted=0

for wt_path in "$WORKTREE_DIR"/worker-*; do
  [[ -d "$wt_path" ]] || continue

  worker=$(basename "$wt_path")
  branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD)

  # Check if worker has changes
  changes=$(git -C "$wt_path" diff --stat HEAD 2>/dev/null | tail -1)
  if [[ -z "$changes" ]]; then
    echo "  $worker ($branch): no changes — skipping"
    skipped=$((skipped + 1))
    continue
  fi

  echo "  $worker ($branch): $changes"

  # Commit uncommitted changes in the worktree
  uncommitted=$(git -C "$wt_path" status --porcelain 2>/dev/null)
  if [[ -n "$uncommitted" ]]; then
    (cd "$wt_path" && git add -A && git commit -m "auto-commit: $worker task results" --no-verify) > /dev/null 2>&1
  fi

  # Attempt merge
  if git merge "$branch" --no-edit -m "merge: $worker task results" 2>/dev/null; then
    echo "    -> merged successfully"
    merged=$((merged + 1))
  else
    echo "    -> CONFLICT — resolve manually, then: git merge --continue"
    conflicted=$((conflicted + 1))
    git merge --abort 2>/dev/null || true
    break
  fi
done

echo ""
echo "========================================"
echo " Merge Summary"
echo "========================================"
echo "  Merged:     $merged"
echo "  Skipped:    $skipped"
echo "  Conflicted: $conflicted"
echo "========================================"

if [[ "$conflicted" -gt 0 ]]; then
  echo ""
  echo "Some branches had conflicts. Remaining branches:"
  for wt_path in "$WORKTREE_DIR"/worker-*; do
    [[ -d "$wt_path" ]] || continue
    branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD)
    is_merged=$(git branch --merged "$MAIN_BRANCH" | grep -c "$branch" || echo 0)
    if [[ "$is_merged" -eq 0 ]]; then
      echo "  git merge $branch"
    fi
  done
fi

echo ""
echo "When done, run: ./scripts/cleanup-workers.sh"
