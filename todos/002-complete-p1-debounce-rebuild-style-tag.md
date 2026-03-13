---
status: complete
priority: p1
issue_id: "002"
tags: [code-review, performance, state-preview]
dependencies: []
---

# Debounce rebuildStyleTag() to Prevent Per-Frame Style Rewrites

## Problem Statement
`rebuildStyleTag()` is called synchronously from `applyStateStyle()`. During slider drag at 60fps, this rewrites the entire `<style>` tag 60 times/sec, forcing full style recalculation each time. Combined with the dual-write path (statePreview + applyInlineStyle), this creates two forced style recalcs per frame.

## Findings
- **Source**: Performance oracle
- **Location**: `src/overlay/statePreview.ts` line 82 (rebuildStyleTag), line 147 (called from applyStateStyle)
- **Evidence**: Setting `tag.textContent` on a `<style>` element forces browser to re-parse entire stylesheet

## Proposed Solutions

### Option A: Debounce with requestAnimationFrame
- Set a dirty flag, schedule rAF, rebuild once per frame
- **Pros**: Simple, guaranteed single rebuild per frame
- **Cons**: One frame delay on visual update
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] rebuildStyleTag runs at most once per animation frame during scrubbing
- [ ] Visual updates still appear responsive during drag
