# TASK

Fix issue #{{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue with `gh issue view {{TASK_ID}} --comments`. If it references a spec, parent issue, or ADR, pull that in too.

Work on branch {{BRANCH}}. Only work on this issue.

# ORIENTATION

Read, in order, before writing any code:

1. `CLAUDE.md` — repo-wide rules
2. `CONTEXT.md` — vocabulary (use these terms in code and commits)
3. `src/overlay/DIRECTORY.md` — the file map; navigate from here

Consult `ARCHITECTURE.md` when internals are unclear. The coding standards
in @.sandcastle/CODING_STANDARDS.md bind everything you write.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with information relevant to the task. Pay extra attention to test files that touch the relevant parts of the code.

# EXECUTION

Use RGR where applicable:

1. RED: write one failing test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR

Testing policy (issue #105): behavior and accessibility tests must mount the component (happy-dom) and assert rendered DOM — ARIA attributes, dispatched events, focus movement. Never assert on source text for behavior. If you touch a file that has source-text behavior tests, migrate them to behavioral in the same change.

# QUALITY GATES

Before every commit, in order, fail-fast:

```sh
npm run typecheck
npm test
npm run lint
```

All three must be green before you commit. Do not declare success with red gates.

# COMMIT

Commit messages start with `sandcastle:` and include:

1. What was completed + issue reference (`#{{TASK_ID}}`)
2. Key decisions made
3. Blockers or notes for the next iteration, if any

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the issue describing what was done and what remains.

Do not close the issue — a human closes it after QA.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

- ONLY WORK ON A SINGLE TASK.
- Never write unreleased Anthropic model identifiers into tracked files.
- Design tokens come from `src/overlay/theme.ts` — no hardcoded hex values in components.
