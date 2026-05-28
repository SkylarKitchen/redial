# `.sandcastle/`

Configuration for [sandcastle](https://github.com/mattpocock/sandcastle),
the sandboxed Claude Code orchestrator.

| File | What it is |
|---|---|
| `Dockerfile` | Container image the agent runs inside — `node:22-bookworm` + `git`, `gh`, `jq`, and the Claude Code CLI. |
| `main.ts` | Default entry — one agent run, prompt sourced from `prompt.md`. Invoked by `npm run sandcastle`. |
| `prompt.md` | The default prompt. Edit this before running, or pass `PROMPT="…"` as an env var. |
| `prompt.template.md` | Redial-specific task template with repo context, ground rules, and quality gates. Copy into `prompt.md` when starting a new task. |

For the full how-to (OrbStack vs Docker, env vars, parallel runs over a
PRD checklist), see [`../docs/sandcastle.md`](../docs/sandcastle.md).

## Quick start

```sh
# One-time: build the image (re-run if Dockerfile changes)
npm run sandcastle:build-image

# Edit prompt.md, then:
npm run sandcastle

# Or pass the prompt inline:
PROMPT="Add JSDoc to every export in src/overlay/infer.ts" npm run sandcastle
```

## Parallel / overnight runs

```sh
npm run tasks -- tasks.md --workers 5
```

Same `- [ ]` / `- [x]` / `- [!]` PRD semantics as the existing
`run-tasks-parallel.sh`, except every task runs in an isolated Docker
sandbox and the host working tree is never touched.
