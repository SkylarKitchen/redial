# Sandcastle default prompt

Replace this file's contents with the task you want the agent to perform,
then run:

    npm run sandcastle

## Context for the agent

- The workspace at `/home/agent/workspace` is a bind-mounted git worktree
  of this repo. Edits go to a temp branch and merge back to HEAD on
  success (`branchStrategy: "merge-to-head"` in `.sandcastle/main.ts`).
- Run quality checks before finishing:
  - `npm run typecheck`
  - `npm test`
- Build sanity-check (optional, slower): `npm run build`
- Keep changes minimal and scoped to the task described below.

## Task

<!-- Describe the change you want the agent to make. -->
