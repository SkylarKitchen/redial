---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, duplication, refactor]
dependencies: []
---

# Brace-Tracking Pattern Duplicated 7 Times in commit.ts

## Problem Statement
The `commit.ts` file has 7 near-identical brace-depth tracking loops across `searchClassBlock`, `searchPseudoClassBlock`, `searchNestedPseudoBlock`, `findClassBlockEnd`, `searchRootBlock`, `searchClassBlockFuzzy`, and the nested block in `searchNestedPseudoBlock`. Each follows the same pattern: iterate lines, count `{` and `}`, track depth, search within the block. This creates 29 separate `depth++/--` sites.

## Findings
- **Source**: Pattern Recognition Specialist (D4), Code Simplicity Reviewer
- Each function repeats: initialize depth=0, iterate lines, count braces, break at depth<=0
- The variation between functions is: what regex pattern opens the block, what condition matches within it
- Extracting a `findBlockRange(lines, startLine)` helper would reduce code by ~80 lines

## Proposed Solutions

### Option A: Extract `findBlockRange()` helper
- **Pros**: DRY, easier to reason about, ~80 LOC saved
- **Cons**: Slightly more abstract
- **Effort**: Medium
- **Risk**: Low (well-tested code)

### Option B: Leave as-is
- **Pros**: Each function is self-contained and readable
- **Cons**: Maintenance burden when changing the brace-tracking logic
- **Effort**: None
- **Risk**: None

## Recommended Action
_To be filled during triage_

## Technical Details
- **Affected files**: `src/server/commit.ts`

## Acceptance Criteria
- [ ] Brace-depth tracking extracted into a reusable helper
- [ ] All existing commit.test.ts tests pass without modification

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Pattern recognition and simplicity reviewers both flagged |

## Resources
- `src/server/commit.ts:188-233` — searchClassBlock (exemplar)
- `src/server/commit.ts:238-271` — searchPseudoClassBlock
- `src/server/commit.ts:277-332` — searchNestedPseudoBlock
