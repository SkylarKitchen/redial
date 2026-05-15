---
status: filed
github_issue: 20
priority: p3
issue_id: "012"
tags: [code-review, performance, correctness]
dependencies: []
---

# Add Debug-Mode dirtyCount Consistency Assertion

## Problem Statement
The `dirtyCount` O(1) counter is maintained by 18 separate increment/decrement sites across 8 functions in `apply.ts`. While no drift has been identified, a single missed decrement would cause a permanent off-by-one that is invisible until the user notices the override count badge is wrong. A debug-mode assertion that cross-checks the counter against a full iteration would catch regressions immediately during development.

## Findings
- **Source**: Architecture Strategist, Performance Oracle, Code Simplicity Reviewer
- 18 separate `dirtyCount++/--` sites across the file
- No existing mechanism to detect counter drift
- `touchedElementCount()` at line 659 already demonstrates the full-iteration pattern

## Proposed Solutions

### Option A: Add `assertDirtyCount()` helper behind NODE_ENV check
- **Pros**: Catches drift bugs immediately in development, zero production cost
- **Cons**: ~10 lines of code, slightly slower dev builds
- **Effort**: Small
- **Risk**: None

## Recommended Action
_To be filled during triage_

## Technical Details
- **Affected files**: `src/overlay/apply.ts`

## Acceptance Criteria
- [ ] Debug-only function that recomputes dirtyCount via iteration and asserts match
- [ ] Called at the end of each mutation function (only in development)
- [ ] Stripped from production builds via dead code elimination

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Three agents independently recommended this |

## Resources
- `src/overlay/apply.ts:113` — dirtyCount declaration
- `src/overlay/apply.ts:659-667` — touchedElementCount (iteration pattern)
