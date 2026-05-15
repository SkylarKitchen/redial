---
status: filed
github_issue: 19
priority: p3
issue_id: "011"
tags: [code-review, testing]
dependencies: []
---

# Missing Test Coverage for Key Functions

## Problem Statement
Several important functions have zero test coverage:
1. `applyCustomProperty()` — dual-tracks overrides + custom property map, maintains dirtyCount
2. `restoreSession()` — deserializes localStorage, re-resolves elements by selector, re-applies inline styles
3. `commitUtils.ts` `enrichChangesForCommit()` — shared enrichment logic used by both save flows

## Findings
- **Source**: Pattern Recognition Specialist (TC1, TC2, TC3)
- `applyCustomProperty()` has complex dual-map tracking that could hide dirtyCount bugs
- `restoreSession()` silently swallows parse errors and does not guard against double-calls (could cause dirtyCount drift per Performance Oracle)
- `enrichChangesForCommit()` is a new module with 2 consumers — should have unit tests

## Proposed Solutions

### Option A: Add targeted unit tests
- **Pros**: Catches regressions, validates dirtyCount accuracy
- **Cons**: Time investment
- **Effort**: Medium
- **Risk**: None

## Recommended Action
_To be filled during triage_

## Technical Details
- **Affected files**: `src/overlay/__tests__/apply.test.ts`, `src/overlay/__tests__/commitUtils.test.ts` (new)

## Acceptance Criteria
- [ ] applyCustomProperty: test that dirtyCount is accurate after applying, modifying, and resetting custom properties
- [ ] restoreSession: test serialization roundtrip, test element re-resolution, test double-call safety
- [ ] enrichChangesForCommit: test enrichment with element scope, class scope, and state-active

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Pattern recognition specialist identified coverage gaps |

## Resources
- `src/overlay/apply.ts:740-787` — applyCustomProperty
- `src/overlay/apply.ts:854-882` — restoreSession
- `src/overlay/commitUtils.ts` — enrichChangesForCommit
