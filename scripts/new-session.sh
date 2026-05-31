#!/usr/bin/env bash
#
# new-session.sh — launch an isolated Claude session in its own git worktree.
#
# WHY THIS EXISTS
# --------------
# A global "Stop" hook (~/.claude/hooks/auto-commit-push.sh) runs
# `git add -A && git commit && git push` after every turn. With several
# Claude sessions in ONE working tree, that stages every session's
# half-finished edits together and pushes the mash-up to `main`.
#
# A worktree gives each session its own directory + branch, so the hook's
# `git add -A` only ever sees that session's files. Work lands on
# `session/<name>`, isolated, and you merge to `main` when it's green.
#
# Sessions stay separate from sandcastle, which uses `.sandcastle/worktrees/`
# with `sandcastle/*` branches; interactive sessions use `.worktrees/` with
# `session/*` branches.
#
# USAGE
#   scripts/new-session.sh [NAME]        create a session worktree (NAME optional)
#   scripts/new-session.sh list          list active session worktrees
#   scripts/new-session.sh remove NAME   remove a session worktree (must be clean)
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WT_DIR="$ROOT/.worktrees"   # already gitignored

case "${1:-}" in
  list)
    echo "Session worktrees:"
    git worktree list | grep -F "$WT_DIR" || echo "  (none)"
    exit 0
    ;;
  remove|rm)
    name="${2:?usage: new-session.sh remove NAME}"
    # `git worktree remove` refuses if the worktree has uncommitted changes,
    # which protects against nuking in-flight work. Add --force yourself if sure.
    git worktree remove "$WT_DIR/$name"
    echo "Removed worktree '$name'. Branch session/$name kept (delete once merged with:"
    echo "    git branch -d session/$name )"
    exit 0
    ;;
esac

# --- create (default) ---
name="${1:-session-$(date +%H%M%S)}"
branch="session/$name"
path="$WT_DIR/$name"

if [ -e "$path" ]; then
  echo "Worktree already exists: $path" >&2
  exit 1
fi

echo "Creating worktree '$name' on branch '$branch' (off main)…"
git worktree add "$path" -b "$branch" main

# Share the main checkout's node_modules (528MB) instead of reinstalling.
# Relative link so it resolves from inside .worktrees/<name>/.
if [ -d "$ROOT/node_modules" ] && [ ! -e "$path/node_modules" ]; then
  ln -s ../../node_modules "$path/node_modules"
  echo "  linked node_modules -> shared main install"
fi

cat <<EOF

✅ Isolated workspace ready: $path
   Branch: $branch  (auto-commits land here, never on main)

Start a Claude session in it:
    cd "$path" && claude

When the work is green, merge it back from a main-checkout session:
    git -C "$ROOT" merge --no-ff $branch
    scripts/new-session.sh remove $name

Notes:
 - Shared node_modules is read-only-safe. If THIS session changes
   dependencies, run \`rm node_modules && npm install\` in the worktree first
   so you don't write into the main install.
 - Baseline tests are intentionally skipped here (main is CI-gated). Run
   \`npm test\` in the worktree if you want to confirm before starting.
EOF
