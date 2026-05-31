# Task template for redial sandcastle runs

Copy this file's contents into `.sandcastle/prompt.md`, fill in the
**Task** section, then run `npm run sandcastle`. Or pass directly via
the `PROMPT` env var for one-off invocations.

---

## Repo context

Redial is a Webflow-style CSS tuning panel for Next.js. Published
library code lives in `src/`; the dev playground is `test-app/`.
See [`ARCHITECTURE.md`](../ARCHITECTURE.md) for internals,
[`CONTEXT.md`](../CONTEXT.md) for vocabulary, and
[`CLAUDE.md`](../CLAUDE.md) for repo-wide rules.

## Ground rules

- The workspace at `/home/agent/workspace` is a bind-mounted git
  worktree. Edits commit to a temp branch and merge to HEAD on success
  (`branchStrategy: "merge-to-head"` in `.sandcastle/main.ts`).
- Keep changes minimal and scoped to the task below — no surrounding
  refactors, no speculative cleanup, no new abstractions for hypothetical
  future needs.
- Don't add comments unless the *why* is non-obvious (hidden invariant,
  workaround for a specific bug). Identifiers should carry the *what*.
- **Never** write unreleased Anthropic model identifiers (`claude-opus-4-N`,
  `claude-sonnet-4-N`, `claude-haiku-4-N` for unreleased N) into any
  tracked file. A global PreToolUse hook blocks this anyway — see
  [`tools/claude-hooks/README.md`](../tools/claude-hooks/README.md).

## Quality gates (run these before completing)

In order, fail-fast:

```sh
npm run typecheck
npm test
```

If a gate fails, fix it or revert your changes and document why the
task can't be completed. Do not declare success with red gates.

## Completion signal

Emit `<promise>COMPLETE</promise>` on a line by itself when you're done
(or when you've decided the task can't be completed and have documented
why). Sandcastle uses this as the iteration loop's exit signal.

---

## Task

<!--
  Replace this comment with the change you want the agent to make.
  Be specific:
    - Which files / which functions
    - Concrete acceptance criteria
    - Anything the agent should NOT touch
-->
