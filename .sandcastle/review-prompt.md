# TASK

Review the code changes on branch `{{BRANCH}}` and improve code clarity, consistency, and maintainability while preserving exact functionality.

# CONTEXT

## Branch diff

!`git diff {{TARGET_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent. Pull the referenced issue with `gh issue view` if the intent is unclear.

2. **Check correctness**:
   - Does the implementation match the issue's intent? Are edge cases handled?
   - Are new/changed behaviors covered by tests — and are those tests *behavioral* (mounted component, rendered-DOM assertions), per the testing policy in @.sandcastle/CODING_STANDARDS.md?
   - Any unsafe casts, `any`, non-null assertions papering over real cases?
   - Any injection risks, credential leaks, or secrets in code or logs?
   - Any hardcoded design values that should come from `src/overlay/theme.ts`?
   - Any unreleased Anthropic model identifiers written into tracked files? (Instant fail — fix immediately.)

3. **Analyze for improvements**:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve naming; consolidate related logic
   - Remove comments that describe obvious code
   - No nested ternaries — prefer switch or if/else chains
   - Clarity over brevity

4. **Maintain balance**: don't over-simplify into cleverness, don't merge unrelated concerns, don't remove abstractions that carry their weight, don't make debugging harder.

5. **Preserve functionality**: never change what the code does — only how it does it.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch
2. Run the gates, in order, fail-fast:
   - `npm run typecheck`
   - `npm test`
   - `npm run lint`
3. Commit with a `sandcastle:` prefix describing the refinements

If the code is already clean and well-structured, do nothing.

Once complete, output <promise>COMPLETE</promise>.
