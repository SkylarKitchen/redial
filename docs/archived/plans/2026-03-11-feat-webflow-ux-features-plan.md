---
title: "feat: Add Webflow UX features beyond CSS controls"
type: feat
date: 2026-03-11
---

# Add Webflow UX Features Beyond CSS Controls

## Overview

Redial's CSS property controls are complete (all 13 spec sections, 44 tasks through Phase H). This plan adds the **UX interaction layer** — the productivity features, visual feedback, and workflow shortcuts that make Webflow feel like a design tool rather than a property inspector.

## Problem Statement

The panel has full CSS property coverage but lacks the interaction patterns that make Webflow fast to use: quick element search, visual feedback on the canvas, context menus, spacing visualization, and keyboard-driven workflows. These UX features are what separate a property editor from a design tool.

## Proposed Solution

11 features across 3 tiers, implemented in priority order. DOM mutation features (wrap/unwrap/reorder/delete) are scoped as **session-only previews** since React reconciliation overwrites direct DOM changes on re-render. Breakpoints are deferred to a separate design phase due to data model complexity.

## Technical Approach

### Architecture

All new features plug into existing extension points:
- **Keyboard shortcuts** → `Overlay.tsx` `handleKeyDown` (capture phase on document)
- **Canvas overlays** → Follow `GridOverlay.tsx` pattern (getBoundingClientRect + RAF + ResizeObserver)
- **New UI panels** → Inline-styled React components rendered inside the Overlay portal
- **State** → Managed in `Overlay.tsx` (top-level) or new standalone components

### Shortcut Reference (existing + new)

| Shortcut | Action | Status |
|----------|--------|--------|
| `` ` `` | Toggle selection mode | Existing |
| `Esc` | Close panel / exit mode | Existing |
| `S` | Cycle scope | Existing |
| `R` | Reset element | Existing |
| `D` (hold) | Diff peek | Existing |
| `Cmd+Z` | Undo | Existing |
| `Cmd+Shift+Z` | Redo | Existing |
| `Cmd+S` | Save to source | Existing |
| `Cmd+C` | Copy CSS | Existing |
| `Cmd+Alt+C` | Copy styles | Existing |
| `Cmd+Alt+V` | Paste styles | Existing |
| Arrow keys | Element navigation | Existing |
| `Cmd+K` | Quick Find palette | **New** |
| `Cmd+Shift+X` | X-Ray mode toggle | **New** |
| `N` | Toggle Navigator | **New** |
| `Cmd+Up/Down` | Reorder element | **New** |
| `Cmd+Alt+G` | Wrap in div | **New** |
| `Cmd+Shift+G` | Unwrap container | **New** |

Note: Cmd+Shift+C/V NOT used (conflicts with browser DevTools). Existing Cmd+Alt+C/V retained for copy/paste styles.

### Implementation Phases

#### Phase 1: Visual Feedback (Canvas Overlays)

High impact, builds on existing GridOverlay pattern. No state model changes.

##### Task 1.1: Canvas Spacing Visualization
**File: `src/overlay/SpacingOverlay.tsx` (new)**

When an element is selected, render colored overlays on the actual page showing:
- **Margin zones**: warm semi-transparent orange (`rgba(255, 150, 50, 0.15)`) rectangles
- **Padding zones**: cool semi-transparent blue (`rgba(100, 150, 255, 0.15)`) rectangles
- Value labels on each side (e.g., "16px" centered on each zone)

Implementation:
- Read `getComputedStyle()` for all 8 margin/padding values
- Compute overlay positions from `getBoundingClientRect()` + margin/padding offsets
- Use RAF loop + ResizeObserver (same pattern as GridOverlay)
- Handle edge cases: negative margins (render on opposite side), `margin: auto` (show computed px value), collapsed margins (show actual rendered gap)
- Toggle via a button in the panel header or automatic on selection
- `pointer-events: none` on all overlay elements

```tsx
// SpacingOverlay.tsx sketch
interface SpacingOverlayProps {
  element: Element;
  refreshKey: number; // bumped when spacing values change
}
```

Acceptance criteria:
- [ ] Margin zones render as warm overlays around the selected element
- [ ] Padding zones render as cool overlays inside the element border
- [ ] Labels show computed pixel values on each side
- [ ] Overlays update in real-time when spacing is adjusted in the panel
- [ ] Overlays reposition correctly on scroll/resize
- [ ] `pointer-events: none` — does not interfere with page interaction
- [ ] Coexists with GridOverlay (different z-index layers)
- [ ] Handles negative margins, auto margins, zero values gracefully

##### Task 1.2: X-Ray Mode
**File: `src/overlay/XRayOverlay.tsx` (new)**

Toggle with `Cmd+Shift+X`. Visualizes page structure:
- Semi-transparent dark overlay (`rgba(0,0,0,0.3)`) with `backdrop-filter: grayscale(1) brightness(0.8)` on a `<div>` below the panel's z-index but above page content
- All elements get a subtle outline via injected `<style>` tag: `* { outline: 1px solid rgba(99,102,241,0.2) !important; }`
- On hover, show margin/padding zones for the hovered element (reuse SpacingOverlay logic)
- Click-to-select still works through the overlay

Implementation:
- **NOT** `filter: grayscale(1)` on root (breaks `position: fixed` stacking context)
- Use a `<div>` with `position: fixed; inset: 0; backdrop-filter: grayscale(1); pointer-events: none;` at a z-index below the panel
- Inject scoped `<style>` for element outlines under `.__tuner-xray-active`
- Hover tracking via `mousemove` on document, throttled to 16ms
- State: `xrayActive` boolean in Overlay.tsx
- Guard: X-Ray deactivates when panel closes

```tsx
// XRayOverlay.tsx sketch
interface XRayOverlayProps {
  active: boolean;
  onHoverElement?: (el: Element | null) => void;
}
```

Acceptance criteria:
- [ ] Cmd+Shift+X toggles X-Ray mode on/off
- [ ] Page content appears desaturated/dimmed
- [ ] All elements show subtle outlines
- [ ] Hovering an element highlights its margin/padding zones
- [ ] The panel itself is NOT affected by grayscale
- [ ] Click-to-select works through the X-Ray overlay
- [ ] X-Ray turns off when panel closes
- [ ] Coexists with GridOverlay (grid lines visible through X-Ray)

##### Task 1.3: Selection Highlight Overlay
**File: `src/overlay/SelectionHighlight.tsx` (new)**

When an element is selected, show a persistent blue outline + dimension label on the page:
- 2px solid `rgba(99,102,241,0.8)` border around the element
- Small label showing dimensions: `"320 × 48"` positioned at the top-right corner
- Tag + class label: `"div.hero-card"` positioned at the top-left
- Updates on resize/scroll via RAF

Acceptance criteria:
- [ ] Selected element has a visible blue outline on the canvas
- [ ] Dimensions label shows width × height
- [ ] Tag/class label shows element identity
- [ ] Outline updates on scroll, resize, and style changes
- [ ] Does not interfere with page interaction

---

#### Phase 2: Command Palette & Context Menu

High impact, self-contained new components.

##### Task 2.1: Quick Find / Command Palette (Cmd+K)
**File: `src/overlay/CommandPalette.tsx` (new)**

A modal search overlay for finding and selecting any element on the page:
- Triggered by `Cmd+K` (guard: not when a text input is focused in the PAGE, but OK if panel input is focused — Cmd+K always opens palette)
- Full-viewport semi-transparent backdrop
- Centered search input (480px wide max) with auto-focus
- Results categorized: **Tags** (h1, div, section), **Classes** (.hero, .card), **IDs** (#main), **Text Content** (first 60 chars)
- Fuzzy matching on tag name + class list + id + textContent
- Arrow keys navigate results, Enter selects (calls `handleSelect`)
- Escape closes palette
- Max 50 results, virtualized if needed
- Debounced search (100ms) to avoid jank on large DOMs

Element scanning strategy:
```ts
// Walk all visible elements, skip non-navigable
const elements = Array.from(document.querySelectorAll('*'))
  .filter(isNavigableElement)
  .map(el => ({
    el,
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList),
    id: el.id,
    text: el.textContent?.slice(0, 60) || '',
    path: buildBreadcrumb(el).join(' › ')
  }));
```

Acceptance criteria:
- [ ] Cmd+K opens palette from any state (no selection, selection active, selecting mode)
- [ ] Search input auto-focuses
- [ ] Results appear within 100ms of typing
- [ ] Results categorized by match type (tag, class, id, text)
- [ ] Arrow keys navigate, Enter selects, Escape closes
- [ ] Selected element is highlighted on the canvas as user navigates results
- [ ] Palette closes after selection; panel opens with the selected element
- [ ] Large DOMs (1000+ elements) do not cause visible jank
- [ ] Breadcrumb path shown for each result to disambiguate duplicates

##### Task 2.2: Right-Click Context Menu
**File: `src/overlay/ContextMenu.tsx` (new)**

Custom context menu on page elements (not inside the panel):
- Intercept `contextmenu` event on document
- Guard: `if (target.closest('.__tuner-root')) return` — let panel elements use native menu
- Guard: skip `<body>`, `<html>`, `<head>` for destructive actions

Menu items:
1. **Select Parent** → submenu showing ancestor chain (reuse breadcrumb data)
2. **Copy Styles** → same as Cmd+Alt+C
3. **Paste Styles** → same as Cmd+Alt+V
4. **Duplicate Element** → `el.parentNode.insertBefore(el.cloneNode(true), el.nextSibling)` ⚠️ session-only
5. **Delete Element** → `el.remove()` with confirmation ⚠️ session-only
6. **Wrap in `<div>`** → creates wrapper, moves element into it ⚠️ session-only
7. **Unwrap** → promotes children to parent, removes wrapper ⚠️ session-only
8. **Copy CSS** → same as Cmd+C
9. **Open in Editor** → same as source file link click

DOM mutation items (4-7) show a subtle "(session only)" label since they don't survive React re-renders.

Positioning: calculate menu position from click coordinates, flip up/left when near viewport edges.

```tsx
interface ContextMenuProps {
  x: number;
  y: number;
  element: Element;
  onSelect: (action: string) => void;
  onClose: () => void;
}
```

Acceptance criteria:
- [ ] Right-click on page elements shows custom context menu
- [ ] Right-click inside panel shows native browser menu
- [ ] "Select Parent" submenu shows full ancestor chain
- [ ] Copy/Paste styles work from context menu
- [ ] DOM mutation items labeled "(session only)"
- [ ] Confirmation dialog before Delete
- [ ] Menu repositions to avoid viewport overflow
- [ ] Click-outside or Escape closes menu
- [ ] Menu does not appear on `<body>` or `<html>` for destructive actions

---

#### Phase 3: Navigator & Enhanced Copy/Paste

##### Task 3.1: Mini Navigator / Element Tree
**File: `src/overlay/Navigator.tsx` (new)**

A toggleable tree view showing DOM hierarchy around the selected element:
- Toggle with `N` key or a button in the Header
- Renders ABOVE the panel sections (inside the scrollable area, before Layout section)
- Shows: ancestors (from body down) → selected element (highlighted) → children (1 level) → siblings
- Each node: tag name + first class name, truncated to fit 280px
- Click node → select that element
- Collapse/expand parents with chevron
- Max depth display: 8 levels of ancestors, 1 level of children
- Max sibling count: 20 (show "... and N more" for large lists)

```tsx
interface NavigatorProps {
  element: Element;
  onSelect: (el: Element) => void;
}
```

Acceptance criteria:
- [ ] `N` key toggles Navigator visibility
- [ ] Tree shows ancestor chain from body to selected element
- [ ] Selected element highlighted with indigo background
- [ ] Children (1 level deep) shown below selected element
- [ ] Siblings shown at the same indent level
- [ ] Click any node to select that element
- [ ] Large sibling lists truncated at 20 with "... and N more"
- [ ] Tree updates when selection changes
- [ ] Does not cause jank on pages with deep nesting
- [ ] Fits within 300px panel width (horizontal scroll for deep indent)

##### Task 3.2: Enhanced Style Clipboard
**File: update `src/overlay/apply.ts`**

Enhance the existing copy/paste styles with richer behavior:
- **Copy mode toggle**: "Overrides only" (current) vs "All computed" (new)
  - "All computed" serializes all non-default computed styles (compare against a hidden reference element)
  - Toggle via a small dropdown in Footer next to the Copy button
- **Paste preview**: before applying, show a toast listing what will change ("12 properties will be pasted")
- **Selective paste**: hold Shift while pasting to open a checklist of properties to paste

Acceptance criteria:
- [ ] Copy mode toggle in Footer (overrides / all computed)
- [ ] "All computed" copies meaningful non-default styles (not browser defaults)
- [ ] Paste shows preview toast with property count
- [ ] Shift+Cmd+Alt+V opens selective paste checklist
- [ ] Pasted styles go through `beginBatch()`/`endBatch()` for single undo entry
- [ ] Relative units preserved as-is (no conversion on paste)

---

#### Phase 4: Keyboard Productivity

##### Task 4.1: Element Reordering (Cmd+Up/Down)
**Files: `src/overlay/Overlay.tsx`, `src/overlay/apply.ts`**

Move the selected element among its siblings:
- `Cmd+Up` → `el.parentNode.insertBefore(el, el.previousElementSibling)`
- `Cmd+Down` → `el.parentNode.insertBefore(el.nextElementSibling, el)` (or appendChild)
- Guard: only when no input focused, element is not `<body>`/`<html>`
- Guard: skip non-navigable siblings (use `isNavigableElement`)
- Visual feedback: brief flash animation on the moved element
- **Session-only** — DOM change does not survive React re-render
- Add to DOM mutation undo stack (separate from CSS undo)

Acceptance criteria:
- [ ] Cmd+Up moves element before previous sibling
- [ ] Cmd+Down moves element after next sibling
- [ ] No-op at first/last sibling (no error)
- [ ] Guard against reordering body/html
- [ ] Brief visual flash on moved element
- [ ] Panel re-infers after move (breadcrumb updates)
- [ ] Toast warning: "DOM change — session only"

##### Task 4.2: Element Wrap/Unwrap
**Files: `src/overlay/Overlay.tsx`**

Structural editing shortcuts:
- `Cmd+Alt+G` → Wrap: create `<div>`, insert before selected element, move element inside
- `Cmd+Shift+G` → Unwrap: move all children of selected element to its parent, remove selected element
- Guard: don't unwrap `<body>`, `<html>`, or elements with no parent
- Guard: don't wrap `<body>`, `<html>`
- **Session-only** with toast warning
- After wrap: select the new wrapper div
- After unwrap: select the first promoted child

Acceptance criteria:
- [ ] Cmd+Alt+G wraps selected element in a new div
- [ ] Cmd+Shift+G unwraps (promotes children, removes container)
- [ ] Guards prevent wrapping/unwrapping body/html
- [ ] Selection updates to wrapper (wrap) or first child (unwrap)
- [ ] Toast: "Wrapped in div (session only)" / "Unwrapped (session only)"

---

#### Phase 5: Visual Undo Timeline

##### Task 5.1: Undo Timeline in SessionDrawer
**Files: `src/overlay/SessionDrawer.tsx`, `src/overlay/apply.ts`**

Add a chronological view alongside the existing element-grouped view:
- Tab bar at top of SessionDrawer: "By Element" (existing) | "Timeline" (new)
- Timeline entries: `{ timestamp, element, prop, from, to, description }`
  - Description auto-generated: `"font-size: 16px → 24px on h1.title"`
- Each entry is clickable → reverts to that point (pops undo stack entries until reaching that point)
- Forward entries moved to redo stack (preserving redo capability)
- Entries grouped by time proximity (changes within 2s collapsed into "N changes")
- Relative timestamps: "just now", "30s ago", "2m ago"

Enrich undo stack entries in `apply.ts`:
```ts
interface UndoEntry {
  el: Element;
  prop: string;
  prev: string;
  // New fields:
  timestamp: number;
  description: string; // human-readable
}
```

Acceptance criteria:
- [ ] SessionDrawer has "By Element" and "Timeline" tabs
- [ ] Timeline shows chronological list of all changes
- [ ] Each entry shows element tag, property, old→new value, relative time
- [ ] Click entry reverts to that point
- [ ] Forward entries preserved in redo stack
- [ ] Nearby changes (< 2s) grouped with expandable "N changes" row
- [ ] Timeline updates in real-time as user makes changes

---

## Alternative Approaches Considered

### Breakpoint / Responsive Bar
Deferred. Requires data model changes across apply.ts (breakpoint-keyed override map), commit.ts (media query generation), infer.ts (viewport-width-aware computed styles), and session persistence. Would need its own design document. The current `ViewportBar.tsx` shows viewport dimensions but doesn't scope styles.

### Full DOM Mutation Persistence
Deferred. React reconciliation overwrites direct DOM changes. Reliable DOM mutations require either (a) a JSX-aware commit system that can parse and modify React component source files, or (b) a React DevTools-level integration that modifies the component tree. Both are large efforts. Session-only DOM mutations are a practical compromise.

### Multi-Element Selection
Not implemented. Would require array-based override tracking and intersection-style property display (show only properties shared by all selected elements). Significant complexity for a v1 UX feature set.

## Acceptance Criteria

### Functional Requirements
- [ ] All 11 features implemented and functional
- [ ] No regressions to existing 44 spec items
- [ ] All new keyboard shortcuts documented in shortcut table
- [ ] Session-only features clearly labeled

### Non-Functional Requirements
- [ ] Command palette search responds within 100ms on pages with 1000+ elements
- [ ] Canvas overlays maintain 60fps RAF loop
- [ ] No layout thrashing from overlay repositioning
- [ ] Panel remains responsive during X-Ray mode

### Quality Gates
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (existing 176+ tests)
- [ ] New tests for: SpacingOverlay positioning, CommandPalette search/filter, ContextMenu positioning, Timeline data model
- [ ] Manual QA: test each feature with panel open, panel closed, during selection mode, during diff mode

## Dependencies & Prerequisites

- Existing `GridOverlay.tsx` pattern (RAF + ResizeObserver) — used by SpacingOverlay, XRayOverlay, SelectionHighlight
- Existing `isNavigableElement()` from `util.ts` — used by CommandPalette, Navigator, element reordering
- Existing `buildBreadcrumb()` from `util.ts` — used by CommandPalette results, ContextMenu ancestor submenu
- Existing undo/redo stack in `apply.ts` — extended with timestamps/descriptions for Timeline
- Existing `SessionDrawer.tsx` — extended with tab bar and Timeline view

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cmd+K conflicts with browser search bar | Medium | Only intercept when Redial overlay is mounted; `e.preventDefault()` only in that scope |
| X-Ray `backdrop-filter: grayscale(1)` not supported in all browsers | Low | Fallback to reduced opacity overlay without grayscale |
| Large DOM causes jank in CommandPalette | Medium | Debounce search, limit to 50 results, lazy scan with `requestIdleCallback` |
| DOM mutations (reorder/wrap/unwrap) cause React errors | High | Wrap in try/catch, toast warning, session-only labeling |
| Navigator tree stale after DOM mutations | Medium | Re-scan tree on every selection change + MutationObserver fallback |

## References

### Internal References
- Spec: `webflow-style-panel-spec.md` (13 sections, all implemented)
- Iteration log: `ITERATION_LOG.md` (39 iterations, Phases A-H complete)
- GridOverlay pattern: `src/overlay/GridOverlay.tsx`
- Keyboard handler: `src/overlay/Overlay.tsx:170-329`
- Undo system: `src/overlay/apply.ts`
- Session drawer: `src/overlay/SessionDrawer.tsx`

### External References
- [Webflow Quick Find](https://help.webflow.com/hc/en-us/articles/33961382093587-Quick-find)
- [Webflow Navigator](https://help.webflow.com/hc/en-us/articles/33961320786451-Navigator)
- [Webflow Keyboard Shortcuts](https://help.webflow.com/hc/en-us/articles/33961359609875-Keyboard-shortcuts-in-Webflow)
- [Webflow X-Ray Mode](https://webflow.com/glossary/x-ray-mode)
- [Webflow Right-Click Context Menu](https://webflow.com/updates/right-click-menu-in-the-designer)
- [Webflow Breakpoints](https://help.webflow.com/hc/en-us/articles/33961300305811-Breakpoints-overview)
