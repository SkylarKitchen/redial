---
status: complete
priority: p2
issue_id: "004"
tags: [code-review, quality, duplication]
dependencies: []
---

# Extract Duplicated Enrichment Logic from Overlay.tsx and Footer.tsx

## Problem Statement
The save logic in Overlay.tsx (handleSaveShortcut) and Footer.tsx (save handler) contain nearly identical code for enriching changes before commit. When enrichment logic changes, it must be updated in two places.

## Findings
- **Source**: TypeScript reviewer
- **Location**: `src/overlay/Overlay.tsx` lines ~280-300, `src/overlay/Footer.tsx` lines ~141-170

## Proposed Solutions

### Option A: Extract shared function
Create `enrichChangesForCommit(el, changes, { scope, activeClassName, activeState })` in a utility module.
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] Single function handles change enrichment for both save paths
- [ ] Both Overlay.tsx and Footer.tsx use the shared function
- [ ] Tests pass unchanged
