---
status: complete
priority: p2
issue_id: "005"
tags: [code-review, performance]
dependencies: []
---

# Replace totalOverrideCount() Iteration with O(1) Counter

## Problem Statement
`totalOverrideCount()` iterates all Map entries comparing initial vs current values. Called via `useSyncExternalStore` on every React notification cycle, including during drag operations.

## Findings
- **Source**: Performance oracle
- **Location**: `src/overlay/apply.ts` lines 582-590

## Proposed Solutions

### Option A: Maintain running counter
Increment/decrement counter as overrides are added/removed/modified.
- **Effort**: Small
- **Risk**: Low — counter must stay in sync with map

## Acceptance Criteria
- [ ] `totalOverrideCount()` returns in O(1)
- [ ] Counter stays in sync after apply, undo, redo, reset operations
- [ ] Existing tests pass unchanged
