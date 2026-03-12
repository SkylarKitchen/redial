---
status: complete
priority: p1
issue_id: "002"
tags: [code-review, react, async, stale-closure]
---

# Stale Closure in Async Handlers

## Problem Statement
`handleSaveShortcut` and `handleCSSImport` in Overlay.tsx capture `selectedEl` in closure. Since both run across async boundaries (fetch, clipboard API), the element reference can go stale if user selects a different element during the operation.

## Findings
- File: `src/overlay/Overlay.tsx`
- `handleSaveShortcut` uses selectedEl after await fetch()
- `handleCSSImport` uses selectedEl after await clipboard.readText()

## Resolution
Agent fix in progress — adds selectedElRef synced via useEffect, async handlers read from ref.
