---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, quality, consistency]
---

# ContextMenu + ShortcutsHelp Cleanup

## Problem Statement
1. ContextMenu.tsx — non-null assertion, dead "Open in Editor" stub
2. ShortcutsHelp.tsx — React.FC inconsistency with codebase

## Resolution
Agent fix in progress — safe optional chaining, removes/disables dead stub, converts to regular function.
