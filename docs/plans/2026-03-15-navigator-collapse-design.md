# Navigator Collapse & Auto-Open Redesign

## Problem

The bottom toolbar has a "Navigator" button that's redundant — the navigator already auto-opens on element selection. The button wastes toolbar space and adds confusion about when the navigator is available. Additionally, once open, the navigator has no way to minimize without fully closing it (losing tree state).

## Changes

### 1. Remove Navigator from Toolbar

Remove the "Navigator" `ToolButton` from `Toolbar.tsx`. The toolbar becomes: × | Select | Variables | AI | Changes.

Remove `onToggleNavigator` and `navigatorOpen` props from `ToolbarProps`.

### 2. Navigator Auto-Opens on Element Selection (already done)

Line 812 of Overlay.tsx already calls `setShowNavigator(true)` when an element is selected. No change needed — just confirming this stays.

The `N` keyboard shortcut (line 547) also stays as a manual toggle for power users.

### 3. Add Collapse Button to Navigator Header

Add a collapse/chevron-left button to the NavigatorPanel header, next to the existing × close button:
- **×** = fully close the navigator (current behavior, clears state)
- **chevron-left** = collapse to thin tab (preserves tree state)

### 4. Collapsed State: Thin Vertical Tab

When collapsed, the navigator panel animates down to a thin vertical tab pinned to the left edge:
- **Size**: ~28px wide × ~80px tall
- **Content**: Layers/tree icon, optional element count badge
- **Position**: Left edge, vertically centered or at the panel's previous Y position
- **Interaction**: Click to expand back to full panel
- **State**: Tree expansion state, scroll position, and selected node are all preserved across collapse/expand cycles

### Animation

- Collapse: panel width animates from 300px → 28px, content fades out, tab icon fades in
- Expand: reverse — tab grows to 300px, tree content fades in
- Use existing `springConfig("panelOpen")` or similar from `timing.ts`

## What Doesn't Change

- Navigator still closes fully with × or when deselecting all elements
- Navigator still syncs selection bidirectionally with the inspector
- Drag-to-reposition of the full panel is unaffected
- `N` hotkey still toggles the navigator
