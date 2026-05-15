---
status: filed
github_issue: 16
priority: p2
issue_id: "008"
tags: [code-review, security]
dependencies: []
---

# No Server-Side Validation on Commit POST Body

## Problem Statement
The `handleCommit()` function in `commit.ts` receives `CommitChange[]` from the client but does not validate that `change.prop`, `change.to`, or `change.className` contain safe values before using them in file search and write operations. While `escapeRegex()` prevents regex injection and the file is only written within the project root, malformed inputs could cause unexpected file modifications.

## Findings
- **Source**: Security Sentinel
- `change.prop` is used directly in regex patterns via `escapeRegex()` — safe for regex but not validated as a real CSS property
- `change.to` is written directly to source files — could contain multi-line content or arbitrary text
- `change.className` is used in regex patterns — not validated against CSS class naming rules
- The server endpoint runs only in development (NODE_ENV guard), limiting blast radius
- No Zod/ajv schema validation on the POST body

## Proposed Solutions

### Option A: Add isValidCSSProp-style validation server-side
- **Pros**: Prevents garbled writes, consistent with client-side validation
- **Cons**: Small code addition
- **Effort**: Small
- **Risk**: Low

### Option B: Full Zod schema validation on POST body
- **Pros**: Comprehensive, catches type mismatches too
- **Cons**: Adds a dependency, more code
- **Effort**: Medium
- **Risk**: Low

## Recommended Action
_To be filled during triage_

## Technical Details
- **Affected files**: `src/server/commit.ts`
- **Components**: handleCommit, CommitChange type

## Acceptance Criteria
- [ ] `change.prop` validated against CSS property name pattern before use
- [ ] `change.className` validated against CSS class name pattern before use
- [ ] `change.to` sanitized (no multi-line injection, no closing braces)
- [ ] Invalid inputs produce clear failure messages

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Security sentinel identified missing input validation |

## Resources
- `src/server/commit.ts` — handleCommit function
- `src/overlay/statePreview.ts:61-63` — isValidCSSProp reference implementation
