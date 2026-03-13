---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, correctness, state-preview]
dependencies: []
---

# Undo/Redo Does Not Synchronize statePreview.ts Style Tag

## Problem Statement
When `apply.ts` performs `undo()` or `redo()` on a state-keyed entry (e.g., `"hover::color"`), it correctly skips inline style mutation for state entries. However, it does NOT call back into `statePreview.ts` to update or remove the injected CSS rule. The visual state becomes stale after undo.

## Findings
- **Source**: TypeScript reviewer (Kieran)
- **Location**: `src/overlay/apply.ts` (undo/redo functions, lines 224-360), `src/overlay/statePreview.ts`
- **Evidence**: The forward path (WebflowPanel.apply callback) correctly calls both `applyStateStyle` and `applyInlineStyle`, but the undo/redo path has no mechanism to propagate changes back to statePreview.

## Proposed Solutions

### Option A: Import statePreview in apply.ts and call directly
- **Pros**: Simple, direct
- **Cons**: Creates circular dependency risk
- **Effort**: Small
- **Risk**: Low

### Option B: Add a listener/callback pattern
- **Pros**: Clean separation, no import coupling
- **Cons**: Slightly more code
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] Undo on a state-keyed property updates the `<style>` tag
- [ ] Redo on a state-keyed property updates the `<style>` tag
- [ ] Test covers undo/redo state sync
