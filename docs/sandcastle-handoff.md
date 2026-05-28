# Sandcastle integration — handoff

**Purpose.** Pick up sandcastle integration work in a local Claude Code
session. This doc is what a fresh assistant needs to know to continue
without re-deriving context.

---

## State of the world

**Branch:** `claude/sweet-carson-ULSYj` (pushed to origin).

**Two commits, in order:**

1. `fc71def` — initial scaffold. Created `.sandcastle/` (Dockerfile,
   main.ts, prompt.md, README), `scripts/run-tasks.ts`,
   `docs/sandcastle.md`. Added `@ai-hero/sandcastle@^0.6.4` and
   `tsx@^4.20.0` to `devDependencies`. Wired four npm scripts:
   `sandcastle`, `sandcastle:init`, `sandcastle:build-image`, `tasks`.
2. `c97134a` — auth + local-overrides. Defaulted auth to bind-mounting
   `~/.claude` (uses host Claude subscription / OAuth login, not API
   key). Added `.sandcastle/.env` auto-load to both `main.ts` and
   `scripts/run-tasks.ts` via a small inline KEY=VALUE parser.
   Committed `.sandcastle/.env.example` as the template.

**Nothing has been runtime-tested yet.** All changes are static — the
remote session this work happened in has no Docker engine, so the image
has never actually built and no agent run has actually executed. Local
smoke test is step one.

---

## Decisions already made (don't relitigate)

| Decision | Choice | Why |
|---|---|---|
| Sandbox provider | `docker()` | OrbStack-compatible drop-in; faster bind mounts on macOS than Docker Desktop. |
| Auth path | bind-mount `~/.claude` | Skylar uses Claude subscription, not API key. |
| Model default in committed code | `claude-opus-4-5` | Skylar wants a newer opus release than this, but that identifier can't be in tracked source for this public repo. |
| Live model identifier | `.sandcastle/.env` (gitignored) | One-line edit, never committed. Skylar set it locally to the opus release he's using; update the same line when a newer one ships. |
| Bash flow (`run-tasks-parallel.sh` etc.) | Kept alongside | Sandcastle adds an option, doesn't replace. |
| Concurrency in `scripts/run-tasks.ts` | Node semaphore + `AbortController` | Matches bash semantics including the <15s fast-fail-on-auth heuristic. |
| `branchStrategy` default | `merge-to-head` | Successful runs auto-merge to HEAD. Open question whether to flip to `branch` for review-before-merge — see below. |

---

## What to do right now (on the Mac)

```sh
# 1. Pull the branch
cd path/to/redial
git fetch origin
git checkout claude/sweet-carson-ULSYj
npm install                                 # installs @ai-hero/sandcastle + tsx

# 2. OrbStack (if not already installed)
brew install orbstack
open -a OrbStack

# 3. Pin the model locally (gitignored)
cp .sandcastle/.env.example .sandcastle/.env
# Then edit .sandcastle/.env to a single line:
#   SANDCASTLE_MODEL=<your preferred opus release ID>

# 4. Build the agent image (~2 min first time, much faster on rebuilds)
npm run sandcastle:build-image

# 5. Smoke test — replace prompt.md with something harmless first
cat > .sandcastle/prompt.md <<'EOF'
Print a one-line summary of what this repo does. Make no file changes.
EOF
npm run sandcastle
```

Expected: container spins up, mounts the worktree, runs `npm ci`,
agent prints the summary, container tears down, no file changes on
host. If anything errors, paste the output to the local session and
the assistant can diagnose against the files in `.sandcastle/`.

---

## After smoke test passes

### Real one-off task
Drop a real task into `.sandcastle/prompt.md` and `npm run sandcastle`.
Suggested first real task — something low-risk and well-scoped:

```
Add JSDoc comments to every exported function in src/overlay/infer.ts
describing parameters and return values. Run `npm run typecheck` before
finishing. Do not change any logic.
```

### Parallel checklist run
Create a `tasks.md` (same format `run-tasks-parallel.sh` uses):

```md
## Tasks

- [ ] Add JSDoc to exports in src/overlay/infer.ts.
- [ ] Add JSDoc to exports in src/overlay/apply.ts.
```

Run:

```sh
npm run tasks -- tasks.md --workers 3
```

PRD lines flip to `[x]` or `[!]` in place. Branches land as
`sandcastle/<slug>-<unix-ts>`. Review with `git log <branch>` and
`git diff main..<branch>`, then merge whichever look good.

---

## Open questions / next-tier work

These were offered at the end of the remote session and not yet done.
Address whichever matter once the smoke test confirms the baseline
works.

1. **`branchStrategy: "branch"` vs `"merge-to-head"`.**
   Current default auto-merges successful runs to HEAD. If you want
   review-before-merge, flip to:
   ```ts
   branchStrategy: { type: "branch", branch: "agent/<name>" }
   ```
   in `.sandcastle/main.ts` and `scripts/run-tasks.ts`. The parallel
   runner already uses per-task branches; this only affects the
   single-task entry.

2. **Quality gates as completion criteria.** Currently `npm run tasks`
   marks a task `[x]` whenever the agent exits cleanly. The approach
   taken is in `.sandcastle/prompt.template.md`: tell the agent to run
   `npm run typecheck && npm test` before signaling completion, and
   not to declare success with red gates. (Sandcastle exposes
   `hooks.host.onSandboxReady`, `hooks.host.onWorktreeReady`, and
   `hooks.sandbox.onSandboxReady` — but no "post-agent" hook. Verified
   against `node_modules/@ai-hero/sandcastle/dist/SandboxLifecycle.d.ts`.)
   If you want deterministic gates from the host side, run the checks
   after `sandbox.run()` returns in a future runner enhancement.

3. **TS replacement for `merge-workers.sh`.** Done —
   `scripts/sandcastle-merge.ts` handles `sandcastle/*` branches.
   Targets only that naming convention, so the bash runner's
   `worker-*` flow is unaffected. Run `npm run sandcastle:merge`.

4. **CI integration.** Nothing here is wired into CI yet. If you ever
   want sandcastle to run in GitHub Actions, you'd need a self-hosted
   runner with Docker access (GitHub-hosted runners have Docker, but
   bind-mount perf is mediocre and auth gets gnarlier).

5. **API-key alternative.** If you ever stop using the subscription and
   switch to an API key, the swap is one block in `.sandcastle/main.ts`:
   replace the `~/.claude` mount with
   `env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! }`.

---

## Files to know about

```
.sandcastle/
├── Dockerfile          # node:22-bookworm + git/gh/jq + claude CLI
├── main.ts             # single-task entry. `npm run sandcastle` runs this.
├── prompt.md           # default prompt — edit before single-task runs
├── README.md           # file-level cheatsheet
├── .env.example        # template; cp to .env (gitignored) for SANDCASTLE_MODEL etc
└── .gitignore          # ignores .env, state/, .cache/, sessions/, *.log

scripts/
└── run-tasks.ts        # parallel PRD runner; `npm run tasks -- tasks.md`

docs/
└── sandcastle.md       # user-facing integration doc — read this first
```

Coexists with:
- `run-tasks-parallel.sh` — original host-side worker flow. Still works.
- `merge-workers.sh`, `cleanup-workers.sh`, `dashboard.sh` — also still
  work. `dashboard.sh` is provider-agnostic (just reads the PRD).

---

## Gotchas the next assistant should know

1. **The remote session that created this can't run the code.** No
   Docker engine, no `~/.claude`. All testing has to happen on the Mac.
2. **Unreleased Anthropic model identifiers cannot go in committed code
   on this repo.** The repo is public open-source. Put live model IDs
   in `.sandcastle/.env` (gitignored) only — including in any docs you
   commit (this doc included).
3. **`await using` is used in `scripts/run-tasks.ts`** for sandbox
   teardown. Requires Node ≥ 20.4. Redial's `engines.node` is `>=18`
   for the published library, but the runner is a dev-time script —
   bumping the runner-only Node floor is fine if needed.
4. **`branchStrategy: "merge-to-head"` will auto-merge into your
   currently-checked-out branch on success.** Be aware of which branch
   is checked out before `npm run sandcastle`. The parallel runner
   uses explicit named branches so this isn't an issue there.
5. **The Dockerfile pins `node:22-bookworm`.** If a sandcastle update
   ever requires Node 24+, rebuild the image after editing.

---

## Where the source of truth lives

| Topic | File |
|---|---|
| What sandcastle is + how it integrates | `docs/sandcastle.md` |
| Container image | `.sandcastle/Dockerfile` |
| Single-task agent config | `.sandcastle/main.ts` |
| Parallel PRD runner | `scripts/run-tasks.ts` |
| This handoff | `docs/sandcastle-handoff.md` (you are here) |
