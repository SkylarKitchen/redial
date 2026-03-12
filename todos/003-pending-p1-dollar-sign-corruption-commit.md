---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, security, data-integrity]
---

# $ in CSS Values Corrupts File Writes

## Problem Statement
In `src/server/commit.ts`, CSS values containing `$` (e.g., CSS custom properties, calc expressions) corrupt file writes because `String.prototype.replace()` treats `$` as a special replacement pattern (`$1`, `$&`, etc.).

## Findings
- File: `src/server/commit.ts:~391`
- Fix: Escape `$` in replacement string with `change.to.replace(/\$/g, '$$$$')`

## Resolution
Deferred — server-side file, lower blast radius for current dev-only usage. Will fix in next pass.
