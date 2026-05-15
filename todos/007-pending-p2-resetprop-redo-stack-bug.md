---
status: filed
github_issue: 15
priority: p2
issue_id: "007"
tags: [code-review, bug, undo-redo]
dependencies: []
---

# resetProp Does Not Clean redoStack — Stale Redo Bug

## Problem Statement
`resetProp()` cleans up `undoStack` entries for the reset property (lines 686-694 in apply.ts) but does NOT clean up the `redoStack`. After `resetProp("color")`, a subsequent `redo()` could re-apply a color change that has already been reset, creating an inconsistent state. By comparison, `reset(el)` (line 443) correctly cleans both stacks.

## Findings
- **Source**: Pattern Recognition Specialist (TC5)
- `reset(el)` iterates both `undoStack` and `redoStack` at line 443
- `resetProp(el, prop)` only iterates `undoStack` at line 686
- This can cause `dirtyCount` drift if `redo()` re-applies a property that was already reset
- **Evidence**: No test covers `resetProp` followed by `redo()`

## Proposed Solutions

### Option A: Mirror the undoStack cleanup for redoStack
- **Pros**: Simple, consistent with `reset()` pattern
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

### Option B: Skip — monitor for user reports
- **Pros**: No code change
- **Cons**: Bug remains, dirtyCount can drift
- **Effort**: None
- **Risk**: Medium — silent data corruption

## Recommended Action
_To be filled during triage_

## Technical Details
- **Affected files**: `src/overlay/apply.ts` (lines 675-697)
- **Components**: resetProp, redo, dirtyCount

## Acceptance Criteria
- [ ] `resetProp(el, "color")` also removes matching entries from `redoStack`
- [ ] Test: resetProp followed by redo returns null / no-ops for that property
- [ ] dirtyCount remains accurate after resetProp + redo sequence

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Found by pattern recognition agent comparing reset() and resetProp() |

## Resources
- `src/overlay/apply.ts:675-697` — resetProp implementation
- `src/overlay/apply.ts:429-456` — reset (correct) implementation for comparison
