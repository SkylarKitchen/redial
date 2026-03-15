# Navigator Panel — PRD

## What We're Building

A floating DOM tree panel (left-anchored) that mirrors Webflow's Navigator. It shows every visual element on the page in a smart-filtered tree, supports bidirectional selection sync with the inspector, and allows drag-to-reorder to rearrange DOM elements.

## Why

The existing click-to-inspect workflow breaks down for:
- Deeply nested elements that are hard to target with a mouse
- Overlapping elements where `elementFromPoint` picks the wrong one
- Understanding page structure at a glance before diving into styles

A navigator gives users a complete structural map and a second selection pathway.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Panel placement | Separate floating panel, left side | Pairs with inspector on right; independent lifecycle |
| Tree scope | Smart filtered (full DOM, hide noise) | Full coverage without overwhelming; skip scripts, empty wrappers, invisible nodes |
| Node display | Minimal — tag name, class on hover | Fast scanning; avoids visual clutter |
| Selection model | Bidirectional sync | Click tree → highlights on page + opens in inspector. Click on page → tree scrolls to + highlights node |
| DOM mutation | Drag-to-reorder | Move elements in tree → reorders in actual DOM (Webflow parity) |
| Toggle | Hotkey + toolbar button | Discoverable (button) + fast (hotkey) |
| Structural editing | Read-write (drag-to-reorder) | Webflow parity; reordering is the most common structural edit |

## Scope

### In Scope
- Floating panel rendering (left-anchored, draggable)
- DOM tree traversal from `<body>` with smart filtering
- Expand/collapse subtrees
- Node display: tag name, class on hover tooltip
- Bidirectional selection sync (tree ↔ page ↔ inspector)
- Drag-to-reorder (rearrange siblings, move into/out of containers)
- Drop indicator (line between nodes / highlight on container)
- Hotkey toggle (suggest `N`) + toolbar button
- Scroll-into-view when selecting via page click
- Keyboard navigation within tree (arrow keys)

### Out of Scope (for now)
- Creating/deleting elements
- Renaming classes from the tree
- Multi-select
- Copy/paste elements
- Component boundary visualization (React fiber walk)
- Search/filter within the tree

## Smart Filtering Rules

Show a node if ANY of:
1. It's a semantic element (`main`, `section`, `article`, `nav`, `header`, `footer`, `aside`, `h1-h6`, `p`, `ul`, `ol`, `li`, `a`, `button`, `img`, `video`, `form`, `input`, `table`)
2. It has a class name or id
3. It has direct text content (not just whitespace)
4. It has more than one child element (structural container)
5. It has explicit styling (inline style attribute)

Hide a node if ALL of:
1. It's a generic element (`div`, `span`) with no class/id
2. It has zero or one child
3. It has no text content
4. It has no inline styles
- **Exception**: if hiding would create a gap in the tree (parent visible, child visible, middle node hidden), promote the hidden node to visible

Skip entirely:
- `<script>`, `<style>`, `<link>`, `<meta>`, `<noscript>`
- Elements with `display: none` or `visibility: hidden` (computed)
- Redial's own UI (`.__tuner-root`, `[data-agentation-root]`, etc.)

## Bidirectional Sync

### Tree → Page
1. Click node in tree
2. Set `selectedEl` in Overlay state (same mechanism as Selector.tsx)
3. Page element gets highlight outline
4. Inspector panel updates to show that element's styles

### Page → Tree
1. User clicks element on page (via existing Selector)
2. `selectedEl` updates
3. Navigator tree expands ancestors of selected node
4. Scrolls tree to show selected node
5. Highlights node row

## Drag-to-Reorder

### Interaction
1. Press and hold on a tree node (or grab a drag handle)
2. Drag vertically — drop indicator shows insertion point
3. Drop between siblings → `parentNode.insertBefore(dragged, reference)`
4. Drop onto a container (highlighted) → `container.appendChild(dragged)` or insert at position
5. DOM mutation fires, tree re-renders to reflect new order

### Constraints
- Cannot drag `<body>`, `<html>`, or `<head>`
- Cannot drop into void elements (`<img>`, `<input>`, `<br>`)
- Should integrate with undo stack (`apply.ts`) so Cmd+Z reverts the move

### Visual Feedback
- Dragged node: semi-transparent clone follows cursor
- Drop target: blue line between nodes (sibling insert) or blue highlight on container (append)
- Invalid drop: red indicator or snap-back animation

## Panel Layout

```
┌─────────────────────────────┐
│  Navigator          [−] [×] │  ← header: title, collapse, close
├─────────────────────────────┤
│  ▸ body                     │
│    ▸ main                   │
│      ▸ section.hero         │  ← expanded, class shown inline
│        h1                   │
│        p                    │
│        ▸ div.cta-group      │
│          a.btn              │
│          a.btn-secondary    │
│      ▾ section.features     │  ← collapsed
│      ▸ footer               │
├─────────────────────────────┤
│  12 elements                │  ← footer: count
└─────────────────────────────┘
```

- Width: `layout.panelWidth` (340px), matching inspector
- Max height: viewport height minus padding, scrollable
- Same visual treatment as inspector (backdrop blur, shadow, border radius)

## Technical Approach

### New Files
- `src/overlay/NavigatorPanel.tsx` — panel shell (header, scrollable tree, footer)
- `src/overlay/NavigatorTree.tsx` — recursive tree rendering + expand/collapse state
- `src/overlay/NavigatorNode.tsx` — single node row (tag, indent, arrow, hover class tooltip)
- `src/overlay/navigatorFilter.ts` — smart filtering logic (which nodes to show/hide)
- `src/overlay/navigatorDrag.ts` — drag-to-reorder logic (DOM mutation + undo integration)

### State Changes
- `Overlay.tsx`: add `showNavigator: boolean` to state, new hotkey handler
- `Overlay.tsx`: add `activePanel` value or parallel toggle (navigator is independent of inspector)
- Navigator subscribes to `selectedEl` changes for bidirectional sync
- Drag mutations push to undo stack in `apply.ts`

### Integration Points
- **Selector.tsx**: when selection happens, emit event/callback that navigator listens to
- **apply.ts**: DOM reorder operations added to undo stack as a new entry type
- **theme.ts**: navigator uses existing tokens (no new design tokens expected)
- **Toolbar.tsx**: add navigator toggle button

## Resolved Questions

1. **Hotkey**: `N` to toggle navigator
2. **MutationObserver**: Yes — debounced (~200ms) observer on `<body>` with `subtree: true, childList: true`. Preserves expand/collapse state across re-renders. Necessary for SPA navigation and React re-renders.
3. **Virtualization**: Yes — flat list of visible (expanded) nodes with indent levels, rendered in a fixed-height scrollable container. Only rows in viewport are mounted.
4. **Undo granularity**: Single undo entry per completed drag. Use `beginBatch()`/`endBatch()` pattern from `apply.ts`. Intermediate drag positions are visual-only, not committed.

## Next Steps

→ `/workflows:plan` for implementation breakdown and task ordering
