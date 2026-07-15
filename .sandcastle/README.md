# `.sandcastle/`

Configuration for [sandcastle](https://github.com/mattpocock/sandcastle),
the sandboxed Claude Code orchestrator. This directory implements a
**four-phase issue loop**: plan → implement → review → merge, driven by
GitHub issues labeled `ready-for-agent`.

| File | What it is |
|---|---|
| `Dockerfile` | Container image the agents run inside — `node:22-bookworm` + `git`, `gh`, `jq`, and the Claude Code CLI. |
| `main.ts` | The four-phase orchestrator. Invoked by `npm run sandcastle`. |
| `runtime.ts` | Shared env bootstrap + sandbox/model config, used by `main.ts` and `scripts/run-tasks.ts`. |
| `plan-prompt.md` | Phase 1 — planner reads `ready-for-agent` issues, builds a dependency graph, emits a `<plan>` JSON of unblocked issues. |
| `implement-prompt.md` | Phase 2a — implementer works one issue on its own branch, RGR, gates green, commits. |
| `review-prompt.md` | Phase 2b — reviewer refines the implementer's branch against `CODING_STANDARDS.md` without changing behavior. |
| `merge-prompt.md` | Phase 3 — merger folds completed branches into the integration branch, gates green, comments on issues. |
| `CODING_STANDARDS.md` | The standards that bind implementers and reviewers. |

For prerequisites (Docker engine, Claude credentials, model pinning), see
[`../docs/sandcastle.md`](../docs/sandcastle.md).

## The loop

Each cycle: a planner (opus-class, see `SANDCASTLE_PLANNER_MODEL`) reads the
open `ready-for-agent` issues and picks the set that can be worked
**in parallel right now** (no mutual dependencies). Each selected issue gets
its own Docker sandbox + `sandcastle/issue-N-slug` branch, where an
implementer runs (≤8 iterations), then — only if it committed — a reviewer
refines the same branch. A merge agent folds every branch that produced
commits back into the branch you launched from. The loop repeats (default 4
cycles) so newly unblocked issues get picked up.

Agents never close issues — a human QAs the merged result and closes them.

## Quick start

```sh
# One-time: build the image (re-run if Dockerfile changes)
npm run sandcastle:build-image

# Never run from main — the merge phase commits to the current branch
# (main.ts refuses and tells you this too):
git switch -c sandcastle/integration-$(date +%F)

npm run sandcastle
```

Overnight backlog run: label the issues `ready-for-agent`, start the
integration branch, launch, go to bed. In the morning: QA the integration
branch, PR it to `main`, close the issues that pass.

## Knobs (`.sandcastle/.env`, gitignored)

See `.env.example` for the full list: auth token, planner/worker models,
max cycles, image name.

## Ad-hoc single tasks

The old single-prompt flow was retired with the four-phase port (see git
history for `prompt.md` / `prompt.template.md`). For one-off batch work
outside the issue tracker, the PRD checklist runner still exists:

```sh
npm run tasks -- tasks.md --workers 5
```
