# Sandcastle: sandboxed autonomous runs

[sandcastle](https://github.com/mattpocock/sandcastle) orchestrates Claude
Code in an isolated Docker container, with each run scoped to its own git
worktree and branch. It replaces the host-side worktree dance in
`scripts/run-tasks-parallel.sh` with a container-based sandbox — the host working
tree is never touched until you merge.

## When to use what

| Tool | Use it when |
|---|---|
| `npm run sandcastle` | AFK runs over the issue backlog. Four-phase loop (plan → implement → review → merge) over open `ready-for-agent` issues. See [`.sandcastle/README.md`](../.sandcastle/README.md). |
| `npm run tasks -- tasks.md` | Overnight / parallel runs over a markdown checklist (no issue tracker involved). Replaces `scripts/run-tasks-parallel.sh`. |
| `./scripts/run-tasks-parallel.sh` (existing) | Still works — kept around for runs you want to do without containers. |

## Prerequisites

### Docker engine

You need a Docker engine the `docker` CLI can talk to. On **macOS**,
[OrbStack](https://orbstack.dev) is recommended over Docker Desktop:

- Bind mounts are several × faster (the bottleneck for any `npm install` /
  `tsc` / `vitest` loop the agent runs).
- Idle cost is ~100 MB vs Docker Desktop's multi-GB VM.
- Container startup is roughly 1 s vs several seconds for Docker Desktop.

Sandcastle uses Docker's standard CLI and socket, so OrbStack is a true
drop-in — no config change. On Linux, use native `docker`. Sandcastle's
`podman()` provider is a separate code path; stay on `docker()`.

### Claude credentials inside the container

The agent uses your Claude subscription via a long-lived OAuth token,
injected into the sandbox as an env var. **Bind-mounting `~/.claude`
does not work on macOS** — the OAuth token lives in the Keychain, not
in the directory — so token-via-env is the only path that works on Mac.

One-time setup on the host:

```sh
claude setup-token
# Paste the printed token into .sandcastle/.env:
#   CLAUDE_CODE_OAUTH_TOKEN=<token>
```

Sandcastle's env resolver injects every key declared in `.sandcastle/.env`
into the sandbox at launch, so the containerized agent authenticates
with your subscription.

To use an API key instead (lower blast radius if compromised, but
requires separate billing setup), put this in `.sandcastle/.env`
instead of the OAuth token:

```sh
ANTHROPIC_API_KEY=<key>
```

The host `~/.npm` cache is bind-mounted into the sandbox so first-run
`npm ci` is fast:

```ts
mounts: [{ hostPath: "~/.npm", sandboxPath: "/home/agent/.npm" }],
```

### Model + local overrides (`.sandcastle/.env`)

The committed default model is `claude-opus-4-5`. To pin a different
model — e.g. a newer opus or sonnet release — copy
`.sandcastle/.env.example` to `.sandcastle/.env` and set:

```sh
SANDCASTLE_MODEL=claude-opus-4-5     # or whatever you want
```

`.sandcastle/.env` is gitignored. Both `npm run sandcastle` and
`npm run tasks` auto-load it before reading `process.env`. You can also
override per invocation:

```sh
SANDCASTLE_MODEL=claude-sonnet-4-5 npm run sandcastle
npm run tasks -- tasks.md --model claude-sonnet-4-5
```

## First run

```sh
# 1. Install the dev dep (one-time)
npm install

# 2. Build the agent image (re-run if .sandcastle/Dockerfile changes)
npm run sandcastle:build-image

# 3. Label the issues you want worked with `ready-for-agent`

# 4. Start an integration branch — main.ts refuses to run from main,
#    because the merge phase commits to the current branch and main
#    only moves through PRs (issue #63):
git switch -c sandcastle/integration-$(date +%F)

# 5. Launch:
npm run sandcastle
```

Each cycle, a planner picks the unblocked issues, each issue runs in its own
container on a `sandcastle/issue-N-slug` branch (implementer, then reviewer),
and a merge agent folds the branches that produced commits back into your
integration branch. In the morning: QA the integration branch, PR it to
`main`, close the issues that pass. Agents never close issues.

### Branch strategy

Issue branches (`sandcastle/issue-N-slug`) persist after the run — the merge
agent merges them into the integration branch but doesn't delete them, so
you can inspect any branch individually with
`git diff <integration>...sandcastle/issue-N-slug`.

The parallel runner (`scripts/run-tasks.ts`) always uses
`{ type: "branch", branch: "sandcastle/<slug>-<ts>" }` — every task
gets a per-task branch regardless, because auto-merging N concurrent
agent branches into one HEAD without review is a recipe for chaos.
That's what `npm run sandcastle:merge` is for.

## Parallel runs from a PRD

Same checklist format as the existing flow:

```md
## Tasks

- [ ] Add JSDoc comments to every exported function in src/overlay/core/infer.ts.
- [ ] Audit color tokens in src/overlay/theme.ts for WCAG AA contrast.
```

Run:

```sh
npm run tasks -- tasks.md --workers 5
```

Each task gets its own sandbox + branch (`sandcastle/<slug>-<ts>`). The
PRD is updated in place: `- [ ]` → `- [x]` on success, `- [!]` on
failure.

After the fleet finishes, merge the resulting branches back:

```sh
npm run sandcastle:merge -- --dry-run    # show what would happen
npm run sandcastle:merge                 # actually merge
npm run sandcastle:merge -- --branch sandcastle/foo  # one branch
```

Skips branches with no new commits, skips already-merged branches,
reports conflicts without leaving the working tree mid-merge.

Fast-fail-on-auth (< 15 s) aborts the whole fleet and leaves
the line as `- [ ]` so you can rerun.

`./scripts/dashboard.sh tasks.md 3` still works for live monitoring — it only
reads the PRD checkbox state, doesn't care how tasks are dispatched.

## Configuration

| Env var | Default | What it does |
|---|---|---|
| `SANDCASTLE_MODEL` | `claude-opus-4-5` | Base model passed to `claudeCode(...)`. |
| `SANDCASTLE_PLANNER_MODEL` | `$SANDCASTLE_MODEL` | Model for the phase-1 planner (opus-class recommended). |
| `SANDCASTLE_WORKER_MODEL` | `claude-sonnet-4-5` | Model for implementer / reviewer / merger. |
| `SANDCASTLE_MAX_CYCLES` | `4` | Plan → execute → merge cycles per `npm run sandcastle`. |
| `SANDCASTLE_IMAGE` | `redial-sandcastle:local` | Docker image name. |
| `GH_TOKEN` | host keyring via `gh auth token` | GitHub token injected into sandboxes for `gh`. |

All of these can live in `.sandcastle/.env` (gitignored) so you don't
have to re-export them every shell.

CLI flags for `scripts/run-tasks.ts`:

```sh
--workers N      # default: 5
--model NAME     # default: $SANDCASTLE_MODEL or claude-opus-4-5
```

## Differences from `scripts/run-tasks-parallel.sh`

| | bash runner | sandcastle runner |
|---|---|---|
| Isolation | git worktree on host | Docker container + worktree |
| `--dangerously-skip-permissions` blast radius | Your real disk | Container only |
| Per-task setup hook | none — agent runs against unbuilt deps | `npm ci` on sandbox ready |
| Auto-commit | `scripts/merge-workers.sh` after the fact | `branchStrategy` commits as it goes |
| Status ledger | `[ ]`/`[x]`/`[!]` (sed `-i ''` mac-only) | Same, but portable (Node `fs`) |
| Fast-fail-on-auth | per-worker break | aborts the whole fleet via `AbortController` |
| Concurrency primitive | `mkdir` spinlock | `Promise.all` + semaphore |

## Cleanup

```sh
# List sandcastle branches
git branch --list 'sandcastle/*'

# Delete merged ones
git branch --list 'sandcastle/*' --merged | xargs -n1 git branch -d

# Drop the image (e.g. before rebuilding from scratch)
docker rmi redial-sandcastle:local
```

## Why not just keep using `scripts/run-tasks-parallel.sh`?

You should, when:

- You trust the prompts and don't need container isolation.
- You want sub-second per-task startup (the bash runner has no Docker overhead).
- You're iterating on prompts and want to read the agent's transcript in `./task-logs/`.

Use sandcastle when:

- You're running prompts you haven't fully vetted.
- You want `npm ci` / typecheck / test to run before "DONE" is recorded.
- You want clean per-task branches without polluting your worktree.
