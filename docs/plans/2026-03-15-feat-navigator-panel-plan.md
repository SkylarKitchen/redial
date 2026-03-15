---
title: "feat: Navigator Panel — DOM tree view with bidirectional sync"
type: feat
date: 2026-03-15
---

# Navigator Panel — DOM Tree View with Bidirectional Sync

## Overview

A floating DOM tree panel (left-anchored, 300px wide) that mirrors Webflow's Navigator. It shows every visual element on the page in a smart-filtered tree, supports bidirectional selection sync with the inspector, keyboard navigation, and live DOM mutation tracking.

The navigator is a **separate floating panel** that coexists with the inspector (right-anchored). It has an independent lifecycle — opening/closing it doesn't affect the inspector.

**PRD**: `docs/2026-03-15-navigator-panel-prd.md`

## Problem Statement / Motivation

The click-to-inspect workflow breaks down for:
- Deeply nested elements that are hard to target with a mouse
- Overlapping elements where `elementFromPoint` picks the wrong one
- Understanding page structure at a glance before diving into styles

The only current selection pathway is click-to-inspect with breadcrumb (max 4 ancestors). A full tree view lets users find deeply nested or hard-to-click elements.

## Proposed Solution

4-phase implementation building from static tree → interactive sync → keyboard nav → live DOM observation.

**Scope**: Phases 1–6. Core tree (1-4) → Virtualization (5) → Drag-to-reorder (6).

## Technical Approach

### Architecture

The navigator uses its own `showNavigator: boolean` state in Overlay.tsx, independent of the `ActivePanel` discriminated union. This lets the navigator coexist with any inspector/variables/session panel state.

Key design decisions:
- Panel width: 300px (matches inspector's actual rendered width)
- Hotkey: `N` (no modifier, doesn't require `selectedEl`)
- Toolbar: "Navigator" button between "Select" and "Variables"
- All UI is inline-styled with `theme.ts` tokens
- Drag positioning mirrors existing `handleDragStart` pattern from `Overlay.tsx:864`

### Partially Implemented Files

Two files were created in a prior session and need verification but not rewriting:
- `src/overlay/navigatorFilter.ts` — Tree building + smart filter logic (complete)
- `src/overlay/NavigatorNode.tsx` — Single tree row component (complete)

### Implementation Phases

#### Phase 1: Smart Filtering + Static Tree

**Goal**: Render a filtered DOM tree from `<body>` with expand/collapse. No interaction beyond toggling nodes.

**Files to create:**

| File | Description |
|------|-------------|
| `src/overlay/NavigatorPanel.tsx` | Panel shell: header, scrollable tree, footer, drag handle, own position state |
| `src/overlay/__tests__/navigatorFilter.test.ts` | Unit tests for smart filter + gap prevention |

**Files to modify:**

| File | Changes |
|------|---------|
| `src/overlay/Overlay.tsx:96` | Add `showNavigator: boolean` state |
| `src/overlay/Overlay.tsx:617` | Add `N` hotkey handler (pattern: `e.key === "n"`, no modifiers, no `selectedEl` required) |
| `src/overlay/Overlay.tsx:1538` | Render `<NavigatorPanel>` in its own `AnimatePresence` block |
| `src/overlay/Toolbar.tsx:200` | Add "Navigator" `ToolButton` between "Select" and "Variables" |

**NavigatorPanel.tsx spec:**
- Header: "Navigator" title, element count badge, close button (×), drag handle (grip dots pattern from `Header.tsx`)
- Body: scrollable tree container, renders `NavigatorNode` for each visible node
- Footer: element count (`12 elements`)
- Own drag state: `navPos` (default: `{ x: 16, y: 80 }`), mirrors `handleDragStart` from `Overlay.tsx:864`
- Local state: `expandedNodes: Set<Element>` — which nodes are expanded
- Default: auto-expand first 2 levels on mount
- Same visual treatment as inspector: `color.background`, `shadow.panel`, `layout.panelRadius`, `backdropFilter: "blur(20px)"`

**Smart filter test cases (`navigatorFilter.test.ts`):**
- Semantic elements (`main`, `section`, `h1`, `button`) pass `shouldShowNode`
- Bare `<div>` with no class/id/text/children fails `shouldShowNode`
- `<div class="hero">` passes (has class)
- `<div id="app">` passes (has id)
- `<div>text</div>` passes (has text content)
- `<div>` with 2+ children passes
- `<script>`, `<style>`, `display: none` elements pass `shouldSkipEntirely`
- `.__tuner-root` elements pass `shouldSkipEntirely`
- Gap prevention: hidden middle node promoted when parent and child both visible
- SVG root elements shown
- `flattenTree` respects expanded set
- `countNodes` counts recursively
- `getAncestorsInTree` returns correct ancestor chain

**Toolbar changes:**
- New props on `ToolbarProps`: `onToggleNavigator: () => void`, `navigatorOpen: boolean`
- New `ToolButton` with label "Navigator", active when `navigatorOpen`
- Position: between "Select" and "Variables" in the expanded tool row

**Overlay.tsx hotkey pattern** (insert after the backtick toggle at line ~617):
```typescript
// N to toggle navigator (no modifier, no selectedEl required)
if (e.key === "n" && !e.metaKey && !e.ctrlKey && !selecting) {
  e.preventDefault();
  setShowNavigator((v) => !v);
  return;
}
```

#### Phase 2: Bidirectional Selection Sync

**Goal**: Click tree node → selects on page + inspector. Click on page → tree scrolls to node.

**Changes to NavigatorPanel.tsx:**
- `onSelectElement` callback prop calls `handleSelect` in Overlay.tsx (same mechanism as Selector.tsx)
- When `selectedEl` prop changes (page → tree direction):
  - Compute ancestor chain via `getAncestorsInTree(tree, selectedEl)`
  - Add all ancestors to `expandedNodes`
  - Scroll selected node's row into view (`scrollIntoView({ block: "nearest" })`)
- Selected node row gets highlight styling (already in NavigatorNode via `isSelected` prop)

**Changes to NavigatorNode.tsx:**
- `isSelected` prop: `node.el === selectedEl` (already implemented)
- Click handler calls `onSelect` (not toggle — toggle is the chevron only) (already implemented)

**Changes to Overlay.tsx:**
- Pass `selectedEl` to `<NavigatorPanel>`
- Pass `onSelectElement` callback (reuse existing `handleSelect` from line ~714)

**Test: ancestor expansion logic**
- Given a deeply nested element, `getAncestorsInTree` returns the correct ancestor elements
- After setting selectedEl, all ancestors get added to expandedNodes

#### Phase 3: Keyboard Navigation

**Goal**: Arrow keys navigate the tree when navigator is focused.

**Changes to NavigatorPanel.tsx:**
- Track `focusedIndex: number` in local state
- `onKeyDown` handler on the panel's scrollable container:
  - `ArrowDown` / `ArrowUp`: move focus through visible (expanded) flat nodes
  - `ArrowRight`: expand focused node (or move to first child if already expanded)
  - `ArrowLeft`: collapse focused node (or move to parent if already collapsed)
  - `Enter`: select focused node (triggers bidirectional sync)
- Focus trap: keyboard events only captured when navigator panel has focus (container has `tabIndex={0}` and `onKeyDown`)
- Visible focus ring on focused row (distinct from selected highlight) — already in NavigatorNode via `isFocused`

**Key interaction concern:** Existing arrow key navigation in Overlay.tsx (line ~649) moves between page elements. The navigator's arrow keys should only fire when the navigator panel itself has focus. The existing handler already checks `!insidePanel` (line 649: `el.closest(".__tuner-root")`), so the navigator's `__tuner-root` class will naturally exclude it.

**Changes to NavigatorNode.tsx:**
- `isFocused` prop for keyboard focus indicator (already implemented)
- `tabIndex={0}` on focused row, `-1` on others (already implemented)

#### Phase 4: MutationObserver for Live DOM Sync

**Goal**: Tree stays in sync as the page DOM changes (SPA navigation, React re-renders).

**Changes to NavigatorPanel.tsx:**
- Create `MutationObserver` on mount, observe `<body>` with `{ childList: true, subtree: true }`
- Debounce rebuild: 200ms (use `timing.layout` token)
- On rebuild: re-run `buildFilteredTree()`, preserve `expandedNodes` set (elements that are still connected)
- Clean up disconnected elements from `expandedNodes`: filter out elements where `el.isConnected === false`
- Dispose observer on unmount

**Edge cases:**
- If `selectedEl` is removed from DOM during a mutation, the tree will simply not highlight it (it won't appear in the rebuilt tree). The inspector handles this separately via HMR re-resolution (Overlay.tsx line ~1118).
- Rapid mutations (React re-renders) are coalesced by the 200ms debounce

**Test: expandedNodes cleanup**
- When an element is removed from DOM, it's cleaned from expandedNodes on next rebuild

#### Phase 5: Virtualized Rendering

**Goal**: Only render tree rows visible in the scroll viewport. Prevents perf degradation on pages with 200+ filtered nodes.

**New file: `src/overlay/useVirtualTree.ts`**
- Custom hook: `useVirtualTree({ flatNodes, rowHeight, containerHeight, scrollTop })`
- Returns `{ visibleNodes, totalHeight, offsetY }` — the slice of `FlatNode[]` to render, total scrollable height, and top padding
- `ROW_HEIGHT` (26px) is already defined in `NavigatorNode.tsx` — export it
- Overscan: render 5 extra rows above/below viewport to avoid flash during fast scroll

**Changes to NavigatorPanel.tsx:**
- Replace direct map over `flatNodes` with `useVirtualTree` output
- Scrollable container: `onScroll` handler updates `scrollTop` state
- Outer div: `height: totalHeight` (creates correct scrollbar)
- Inner div: `transform: translateY(${offsetY}px)` (positions visible slice)

**Changes to NavigatorNode.tsx:**
- Export `ROW_HEIGHT` constant (currently local `const ROW_HEIGHT = 26`)

**Test cases (`useVirtualTree.test.ts`):**
- 100 flat nodes, container 260px (10 visible) → returns ~20 nodes (10 + overscan)
- scrollTop = 0 → first 15 nodes returned
- scrollTop = 2600 (bottom) → last 15 nodes returned
- Empty list → returns empty

#### Phase 6: Drag-to-Reorder

**Goal**: Drag tree nodes to rearrange siblings or move into/out of containers. DOM mutations integrate with the undo stack.

**New file: `src/overlay/navigatorDrag.ts`**

Core exports:
```typescript
export interface DragState {
  draggedEl: Element;
  draggedNode: TreeNode;
  dropTarget: DropTarget | null;
}

export type DropTarget =
  | { type: "between"; parent: Element; before: Element | null } // insert before sibling (null = append)
  | { type: "into"; container: Element }; // append to container

export function canDrop(dragged: Element, target: DropTarget): boolean;
export function executeDrop(dragged: Element, target: DropTarget): { undo: () => void };
```

**`canDrop` rules:**
- Cannot drag `<body>`, `<html>`, `<head>`
- Cannot drop into void elements (`<img>`, `<input>`, `<br>`, `<hr>`, `<area>`, `<col>`, `<embed>`, `<source>`, `<track>`, `<wbr>`)
- Cannot drop an element into itself or its own descendants
- Cannot drop into Redial's own UI (`.__tuner-root`)

**`executeDrop` logic:**
1. Save original position: `{ parent: el.parentElement, nextSibling: el.nextElementSibling }`
2. Execute DOM mutation: `target.parent.insertBefore(el, target.before)` or `target.container.appendChild(el)`
3. Return `undo` closure that restores original position

**Undo integration with `apply.ts`:**
- Add new undo entry type: `DomMoveUndoEntry = { type: "dom-move"; el: Element; undo: () => void; redo: () => void }`
- Extend `UndoEntry` union in `apply.ts` to include `DomMoveUndoEntry`
- `beginBatch()`/`endBatch()` wraps the drag so it's a single undo entry
- After drop, push entry to undo stack + notify listeners

**Changes to NavigatorNode.tsx:**
- Add `draggable` attribute and drag handle affordance (grip dots, similar to panel header)
- `onDragStart`: set `DragState` in parent
- Drag handle only on left side (before chevron), keeps click-to-select on the row itself

**Changes to NavigatorPanel.tsx:**
- Local state: `dragState: DragState | null`
- During drag: render drop indicator (blue line between rows / blue highlight on container row)
- `onDragOver` on each row computes drop target based on cursor Y position:
  - Top third of row → insert before this node
  - Bottom third → insert after this node
  - Middle third → drop into this node (if it can have children)
- `onDrop`: call `executeDrop`, push undo entry, clear `dragState`
- `onDragEnd`: clear `dragState` if drop didn't occur (cancelled)
- MutationObserver will pick up the DOM change and rebuild tree automatically (200ms debounce)

**Edge case: drag during MutationObserver rebuild:**
- Suppress MutationObserver rebuilds while `dragState !== null`
- Resume observer after drop completes

**Visual feedback:**
- Drop indicator: 2px horizontal line, `color.primary`, positioned between rows
- Container highlight: `primaryAlpha(0.08)` background on target container row
- Dragged row: `opacity: 0.4` on the original position
- Invalid drop: no indicator shown (cursor stays `not-allowed`)

**Test cases (`navigatorDrag.test.ts`):**
- `canDrop`: body/html/head rejected, void elements rejected, self-drop rejected, descendant-drop rejected
- `executeDrop` between siblings: DOM order changes correctly
- `executeDrop` into container: element appended correctly
- `executeDrop` undo: original position restored
- `executeDrop` redo: mutation re-applied

## Acceptance Criteria

### Functional Requirements

- [ ] `N` key toggles navigator panel open/close
- [ ] Toolbar shows "Navigator" button that toggles the panel
- [ ] Tree displays all visible elements with smart filtering (semantic, class, id, text, multi-child)
- [ ] Scripts, styles, invisible elements, and Redial UI are hidden
- [ ] Gap prevention: hidden middle nodes promoted when needed
- [ ] Chevron click expands/collapses subtrees
- [ ] First 2 levels auto-expanded on open
- [ ] Click tree node → page element highlights + inspector opens with that element
- [ ] Click page element → tree scrolls to + highlights corresponding node, ancestors auto-expand
- [ ] Arrow keys navigate tree when navigator is focused
- [ ] Enter key selects focused node
- [ ] ArrowRight expands, ArrowLeft collapses
- [ ] Tree rebuilds when DOM changes (SPA navigation, React re-renders)
- [ ] Panel is draggable with snap-to-edge behavior
- [ ] Navigator can coexist with inspector (both open simultaneously)
- [ ] Element count shown in footer
- [ ] Virtualized rendering: only rows in viewport are mounted
- [ ] Smooth scrolling with overscan (no flash on fast scroll)
- [ ] Drag tree node to reorder siblings
- [ ] Drag tree node into/out of containers
- [ ] Drop indicator shows valid insertion point
- [ ] Cannot drag body/html/head or drop into void elements
- [ ] Drag-to-reorder integrates with Cmd+Z undo
- [ ] MutationObserver paused during active drag

### Non-Functional Requirements

- [ ] All design tokens from `theme.ts` — no hardcoded hex colors
- [ ] All timing from `timing.ts` — no hardcoded durations
- [ ] Panel width: 300px
- [ ] MutationObserver debounce: 200ms
- [ ] No TypeScript errors (`npm run build`)
- [ ] All existing + new tests pass (`npm test`)
- [ ] Virtualized tree handles 500+ nodes without jank

## Dependencies & Prerequisites

- `navigatorFilter.ts` ← already created (needs tests)
- `NavigatorNode.tsx` ← already created
- `util.ts` ← `getDisplayClass()`, `isNavigableElement()` (existing)
- `timing.ts` ← `timing.layout` for debounce, `ms()`, `springConfig()` (existing)
- `theme.ts` ← all styling tokens (existing)
- `motion/react` ← `AnimatePresence`, `motion` (existing dependency)

## Key Files Summary

| File | Action | Phase |
|------|--------|-------|
| `src/overlay/navigatorFilter.ts` | Verify (already created) | 1 |
| `src/overlay/NavigatorNode.tsx` | Verify (already created), modify for drag | 1, 6 |
| `src/overlay/NavigatorPanel.tsx` | **Create** | 1, 2, 3, 4, 5, 6 |
| `src/overlay/__tests__/navigatorFilter.test.ts` | **Create** | 1 |
| `src/overlay/useVirtualTree.ts` | **Create** | 5 |
| `src/overlay/__tests__/useVirtualTree.test.ts` | **Create** | 5 |
| `src/overlay/navigatorDrag.ts` | **Create** | 6 |
| `src/overlay/__tests__/navigatorDrag.test.ts` | **Create** | 6 |
| `src/overlay/Overlay.tsx` | **Modify** | 1, 2 |
| `src/overlay/Toolbar.tsx` | **Modify** | 1 |
| `src/overlay/apply.ts` | **Modify** (extend UndoEntry union) | 6 |

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| MutationObserver performance on large DOMs | High | 200ms debounce + only observe childList (not attributes) |
| Arrow key conflict with existing nav | Medium | Navigator keyboard only fires when panel has focus (`.__tuner-root` exclusion already exists) |
| Stale expandedNodes references | Low | Filter `el.isConnected` on every rebuild |
| SVG/iframe elements in tree | Low | SVG roots shown, iframe contents skipped (cross-origin) |
| Drag-during-mutation race | Medium | Suppress MutationObserver rebuilds while dragState is active |
| Undo stack type extension | Low | New `DomMoveUndoEntry` type added to existing discriminated union — backwards compatible |
| Virtualization scroll jank | Low | 5-row overscan + fixed row height (26px) ensures smooth rendering |

## Verification

1. **Build**: `npm run build` — no TypeScript errors
2. **Tests**: `npm test` — all existing + new tests pass
3. **Manual**: Open test-app (`npm run dev` in test-app), press `N`:
   - Tree shows all visible elements with smart filtering
   - Click tree node → page element highlights + inspector opens
   - Click page element → tree scrolls to + highlights node
   - Arrow keys navigate tree
   - Works with SPA navigation (tree rebuilds on route change)
   - Scroll performance smooth on large pages (virtualization active)
   - Drag a node between siblings → DOM order changes, undo reverts it
   - Drag a node into a container → element moves, tree updates

## References

### Internal References

- PRD: `docs/2026-03-15-navigator-panel-prd.md`
- Drag handling pattern: `src/overlay/Overlay.tsx:864` (`handleDragStart`)
- Hotkey registration pattern: `src/overlay/Overlay.tsx:351-693`
- Panel rendering pattern: `src/overlay/Overlay.tsx:1538-1736`
- Toolbar button pattern: `src/overlay/Toolbar.tsx:200-219`
- Theme tokens: `src/overlay/theme.ts`
- Timing tokens: `src/overlay/timing.ts`
- Element filtering: `src/overlay/util.ts:185` (`isNavigableElement`)
- Class display: `src/overlay/util.ts:32` (`getDisplayClass`)
