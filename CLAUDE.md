# CLAUDE.md

Project memory for the `redial` repo.

## Repo basics

Redial is a Webflow-style CSS tuning panel for Next.js — see
[README.md](README.md) for the user-facing description and
[ARCHITECTURE.md](ARCHITECTURE.md) for the internals.

The published library code lives in `src/`. The Next.js dev playground
is in `test-app/`. Sandcastle integration (sandboxed autonomous Claude
runs) lives in `.sandcastle/`, `scripts/run-tasks.ts`, and
[`docs/sandcastle.md`](docs/sandcastle.md).

## Rules

### Never write unreleased Anthropic model identifiers into tracked files

The repo is public open-source. Do not write
`claude-opus-4-N`, `claude-sonnet-4-N`, or `claude-haiku-4-N` for any
version that isn't publicly released into anything that gets committed —
including code, configs, docs, tests, comments, or commit messages.

The live model identifier for sandcastle lives in `.sandcastle/.env`
(gitignored). If you need to reference "the model the user is using"
in committed prose, refer to it abstractly ("the configured opus
release", "whatever's in `SANDCASTLE_MODEL`").

A defensive `PreToolUse` hook is available at
[`tools/claude-hooks/block-unreleased-models.sh`](tools/claude-hooks/README.md)
that catches this automatically when installed globally.

### Concurrent sessions use worktrees

Interactive agent sessions should start via `scripts/new-session.sh`, which
gives each session its own worktree on a `session/<name>` branch. This is
the resolution of issue #63: the global auto-commit Stop hook refuses to
commit on `main`/`master`, and a PreToolUse guard blocks
`git commit`/`push`/`merge` while `main` is checked out — so work lands on
branches and reaches `main` through PRs.

### Testing policy (issue #105)

Behavior and accessibility tests must mount the component (happy-dom) and
assert rendered DOM — ARIA attributes, dispatched events, focus movement.
Source-text assertions (`readFileSync` + regex) are reserved for true
convention audits (`noShadcnInOverlay`, `themeCompliance`, `variableAudit`);
never use them for behavior — they pass when runtime behavior breaks and
fail on harmless renames. When touching a file that has source-text behavior
tests, migrate them to behavioral in the same change (accessibility audits
first). Exemplar migrations: `dropdownAccessibility.test.tsx`,
`fontPreview.test.tsx`.

### Source of truth

- Glossary / vocabulary: [`CONTEXT.md`](CONTEXT.md)
- Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- QA checklist: [`QA_CHECKLIST.md`](QA_CHECKLIST.md)
- Sandcastle integration: [`docs/sandcastle.md`](docs/sandcastle.md)
- Handoff between sessions: [`docs/sandcastle-handoff.md`](docs/sandcastle-handoff.md)
