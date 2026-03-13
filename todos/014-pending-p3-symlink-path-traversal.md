---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, security]
dependencies: []
---

# Symlink Path Traversal Not Fully Mitigated in findFileRecursive

## Problem Statement
`findFileRecursive()` in `commit.ts` uses `normalize()` to check that resolved paths stay within the search directory. However, `normalize()` only performs string operations — it does NOT resolve symlinks. A symlink named `innocent-dir` pointing to `/etc` would pass the check because `normalize("/project/innocent-dir")` starts with `normalize("/project")`.

## Findings
- **Source**: Security Sentinel (Finding 2)
- `normalize()` on lines 77-79 only resolves `.` and `..` in the string, not the filesystem
- `assertWithinRoot()` on line 111 runs on the initial `resolve()` call but not on results from `findFileRecursive`
- After `findFileRecursive` returns, results go directly to `readFile`/`writeFile`
- Impact is limited: requires a pre-existing symlink inside the project root pointing outside it, and the attacker must know the target filename

## Proposed Solutions

### Option A: Use fs.realpath() on results before read/write
- **Pros**: Resolves symlinks, fully prevents traversal
- **Cons**: Additional async I/O per result
- **Effort**: Small
- **Risk**: Low

### Option B: Run assertWithinRoot() on findFileRecursive results
- **Pros**: Defense in depth
- **Cons**: Doesn't actually resolve symlinks (normalize-based)
- **Effort**: Tiny
- **Risk**: Low

## Recommended Action
_To be filled during triage_

## Technical Details
- **Affected files**: `src/server/commit.ts` (lines 65-90, 121-133)

## Acceptance Criteria
- [ ] Paths returned by findFileRecursive are validated via realpath before use
- [ ] Test: symlink pointing outside project root is rejected

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Security sentinel traced data flow from findFileRecursive to writeFile |

## Resources
- `src/server/commit.ts:65-90` — findFileRecursive
- `src/server/commit.ts:25-31` — assertWithinRoot
