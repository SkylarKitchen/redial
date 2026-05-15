---
status: filed
github_issue: 17
priority: p3
issue_id: "009"
tags: [code-review, architecture, duplication]
dependencies: []
---

# VALID_STATES Set Duplicated Between Client and Server

## Problem Statement
The `VALID_STATES` set of allowed pseudo-class names exists in two places:
- `src/overlay/statePreview.ts` line 23 (client, exported)
- `src/server/commit.ts` line 16 (server, private)

Both are currently identical, but they could drift if one is updated without the other. This was flagged by 3 review agents (Security, Architecture, Pattern Recognition).

## Findings
- **Source**: Security Sentinel, Architecture Strategist, Pattern Recognition Specialist
- Both sets contain: hover, focus, active, visited, focus-within, focus-visible, first-child, last-child
- The client version is exported (used in tests), the server version is module-private
- Client validates on input (applyStateStyle), server validates on write (handleCommit)

## Proposed Solutions

### Option A: Extract to shared module `src/shared/validStates.ts`
- **Pros**: Single source of truth, impossible to drift
- **Cons**: Creates a cross-boundary import (overlay → shared ← server)
- **Effort**: Small
- **Risk**: Low

### Option B: Leave as-is, add a test asserting equality
- **Pros**: No import complexity, still catches drift
- **Cons**: Drift detected at test time, not compile time
- **Effort**: Small
- **Risk**: Low

## Recommended Action
_To be filled during triage_

## Technical Details
- **Affected files**: `src/overlay/statePreview.ts`, `src/server/commit.ts`

## Acceptance Criteria
- [ ] VALID_STATES is defined in exactly one place, or a test verifies both sets match

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Flagged independently by 3 review agents |

## Resources
- `src/overlay/statePreview.ts:23-26` — client VALID_STATES
- `src/server/commit.ts:16-19` — server VALID_STATES
