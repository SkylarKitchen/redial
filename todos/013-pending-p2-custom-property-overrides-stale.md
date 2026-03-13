---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, bug, simplification]
dependencies: []
---

# customPropertyOverrides Map Never Cleared on resetAll — Stale State Bug

## Problem Statement
`applyCustomProperty()` writes to both `customPropertyOverrides` AND `overrides` maps (dual tracking). However, `resetAll()` clears `overrides` and `clearedOverrides` but never clears `customPropertyOverrides`. This means after `resetAll()`, `isCustomPropertyDirty()` returns stale results from the previous session.

Additionally, the dual-tracking is unnecessary — `isCustomPropertyDirty(name)` could simply check the `overrides` map via the existing `isDirty(scope, name)` function.

## Findings
- **Source**: Code Simplicity Reviewer, Pattern Recognition Specialist (A3)
- `resetAll()` at line 458 clears: `overrides`, `clearedOverrides`, `dirtyCount`, undo/redo stacks, persisted session
- `resetAll()` does NOT clear: `customPropertyOverrides` (line 734)
- `customPropertyOverrides` duplicates data already in `overrides` (lines 761-774)
- Removing `customPropertyOverrides` entirely saves ~25 LOC and eliminates the bug

## Proposed Solutions

### Option A: Remove customPropertyOverrides entirely (recommended)
- **Pros**: Eliminates bug, removes redundant data structure, saves ~25 LOC
- **Cons**: Need to verify `isCustomPropertyDirty` callers can use `isDirty(scope, name)` instead
- **Effort**: Small
- **Risk**: Low

### Option B: Add customPropertyOverrides.clear() to resetAll()
- **Pros**: Quick fix
- **Cons**: Leaves redundant data structure in place
- **Effort**: Tiny
- **Risk**: None

## Recommended Action
_To be filled during triage_

## Technical Details
- **Affected files**: `src/overlay/apply.ts` (lines 728-787, 458-474)

## Acceptance Criteria
- [ ] `resetAll()` clears all custom property tracking state
- [ ] `isCustomPropertyDirty()` returns false after `resetAll()`
- [ ] No dual-tracking of custom property state (if Option A)
- [ ] Test: applyCustomProperty → resetAll → isCustomPropertyDirty returns false

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Found by simplicity reviewer comparing resetAll() to all mutable state |

## Resources
- `src/overlay/apply.ts:728-787` — customPropertyOverrides and applyCustomProperty
- `src/overlay/apply.ts:458-474` — resetAll (missing clear)
