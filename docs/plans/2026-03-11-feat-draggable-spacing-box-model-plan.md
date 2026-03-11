---
title: Draggable Spacing Box Model with Uniform Update & Hotkeys
type: feat
date: 2026-03-11
---

# Draggable Spacing Box Model with Uniform Update & Hotkeys

## Overview

Upgrade SpacingBoxModel to match Webflow's spacing controls: drag-to-scrub on values, Shift+drag for uniform all-4-sides update, hover zone highlighting, proper tab navigation, and polished visual 1:1 parity with Webflow's box model UI.

## Problem Statement

The current SpacingBoxModel only supports click-to-edit with arrow key stepping. Webflow's spacing box allows direct drag-scrubbing on any value, Shift+drag to update all sides uniformly, and hover highlighting of zones. These interactions are fundamental to the "feels like Webflow" goal.

## Proposed Solution

Merge LabelScrub-style drag behavior directly into EditableValue, add uniform-update logic to SpacingBoxModel, and implement zone hover highlighting. Key interaction model:

| Gesture | Behavior |
|---------|----------|
| **Drag** on value | Scrub single value, 1px per pixel |
| **Shift+Drag** on value | Scrub ALL 4 sides of that group uniformly |
| **Alt+Drag** | 0.1x fine-scrub multiplier (works with both normal and shift) |
| **Click** on value | Enter edit mode (existing) |
| **Alt+Click** on value | Apply value to all 4 sides of that group |
| **Arrow Up/Down** | ±1px (focused value) |
| **Shift+Arrow** | ±10px |
| **Alt+Arrow** | ±0.1px (new — matches PositionOffsetDiagram) |
| **Tab/Shift+Tab** | Cycle through all 8 values in visual order |
| **Hover** on value | Highlight corresponding zone strip |

## Design Decisions

### D1: Shift = Uniform (not 10x during drag)

Shift during drag means "update all 4 uniformly." This matches the user's request and Webflow's behavior. The 10x multiplier (used elsewhere in the panel) is sacrificed during drag, but spacing values have small ranges (-200 to 200px) where 10x jumps aren't useful. Shift+Arrow retains 10x for keyboard stepping.

### D2: 3px Dead Zone for Click vs. Drag

Mousedown starts tracking. If mouse moves >3px before mouseup → scrub. If mouseup within 3px → click-to-edit. Standard drag detection used by macOS, Figma, and Webflow itself.

### D3: Alt+Click → All 4 Sides (upgrade from pairs)

Currently Alt+click sets complementary pairs (top+bottom or left+right). Upgrade to set all 4 sides of the same group. This replaces the ambiguous "corner click" concept since there are no corner UI elements.

### D4: Undo Batching for Drag Gestures

Uniform drag fires 4 `onChange` calls per mousemove. Without batching, the undo stack grows 4× per frame. Solution: add `beginBatch()`/`endBatch()` to `apply.ts` that group all changes within a drag gesture into a single undo entry.

### D5: Tab Order = Visual Order, Not DOM Order

DOM order: top → left → [padding box] → right → bottom. Visual order: top → right → bottom → left. Use managed focus with `onKeyDown` Tab interception rather than `tabIndex` values, cycling: margin-top → margin-right → margin-bottom → margin-left → padding-top → padding-right → padding-bottom → padding-left.

### D6: Units Out of Scope

The interface already accepts unit props. Drag-to-scrub operates on the numeric value in the current unit. No unit conversion logic in this feature.

## Acceptance Criteria

### Drag-to-Scrub
- [ ] Dragging horizontally on any spacing value scrubs it in real-time
- [ ] Cursor shows `ew-resize` on hover over values
- [ ] Value text turns indigo (`#6366f1`) during active scrub
- [ ] 3px dead zone: short clicks still enter edit mode
- [ ] Text selection disabled during drag (`userSelect: none`)

### Uniform Update
- [ ] Shift+drag on any margin value updates all 4 margin values to match
- [ ] Shift+drag on any padding value updates all 4 padding values to match
- [ ] Visual feedback: all 4 values update live during drag
- [ ] Alt modifier works during shift+drag for 0.1x fine scrub

### Alt+Click All Sides
- [ ] Alt+clicking any margin value sets all 4 margins to that value
- [ ] Alt+clicking any padding value sets all 4 paddings to that value

### Keyboard
- [ ] Alt+Arrow Up/Down steps by 0.1px (new)
- [ ] Shift+Arrow Up/Down steps by 10px (existing, verify still works)
- [ ] Tab cycles through all 8 values in visual order (top→right→bottom→left per group)
- [ ] Shift+Tab reverses cycle direction

### Hover Highlighting
- [ ] Hovering a value highlights the corresponding zone strip in the diagram
- [ ] Margin zones highlight at `rgba(255, 152, 87, 0.16)` (2× base)
- [ ] Padding zones highlight at `rgba(87, 168, 255, 0.16)` (2× base)
- [ ] Highlight clears on mouse leave

### Undo
- [ ] Entire drag gesture (single value) is one undo entry
- [ ] Entire uniform drag gesture (4 values) is one undo entry
- [ ] Cmd+Z reverts the full gesture, not individual pixels

### Visual Polish
- [ ] Box model appearance matches Webflow's spacing diagram proportions
- [ ] Content placeholder centered with proper sizing
- [ ] Labels ("MARGIN", "PADDING") positioned top-left with muted styling
- [ ] Border colors and background opacities match dark theme spec

## Technical Approach

### File Changes

#### 1. `src/overlay/controls.tsx` — Enhance EditableValue with drag-to-scrub

**`EditableValue` gains scrub behavior directly** (no LabelScrub wrapper — they share the same element):

```tsx
// New props
interface EditableValueProps {
  value: number;
  onChange: (value: number) => void;
  onAltClick?: () => void;
  onScrubStart?: () => void;     // NEW: called on drag start
  onScrubEnd?: () => void;       // NEW: called on drag end
  onUniformDrag?: (delta: number) => void;  // NEW: shift+drag handler
  min?: number;                  // NEW: optional clamp
  max?: number;                  // NEW: optional clamp
  highlightZone?: () => void;    // NEW: hover zone callback
  clearHighlight?: () => void;   // NEW: hover zone callback
}
```

Implementation:
- `onMouseDown`: capture `startX`, `startValue`, set `scrubPending = true`
- `onMouseMove` (global, via useEffect): if `|dx| > 3px` → enter scrub mode
- During scrub: if `shiftKey` → call `onUniformDrag(delta)` instead of `onChange`
- `onMouseUp`: if never exceeded dead zone → fire click (enter edit / alt+click)
- Add `onMouseEnter`/`onMouseLeave` → call `highlightZone()`/`clearHighlight()`

#### 2. `src/overlay/SpacingBoxModel.tsx` — Wire uniform drag + zone highlighting

```tsx
// New internal state
const [highlightedZone, setHighlightedZone] = useState<string | null>(null);
// e.g. "margin-top", "padding-left", etc.

// Uniform drag handler for margin
const handleMarginUniform = useCallback((delta: number, startValue: number) => {
  const val = startValue + delta;
  onChange("margin-top", val, marginUnit);
  onChange("margin-right", val, marginUnit);
  onChange("margin-bottom", val, marginUnit);
  onChange("margin-left", val, marginUnit);
}, [onChange, marginUnit]);

// Each EditableValue gets zone highlight + uniform handlers:
<EditableValue
  value={margin.top}
  onChange={(v) => onChange("margin-top", v, marginUnit)}
  onAltClick={() => { /* set all 4 margins to margin.top */ }}
  onUniformDrag={(delta) => handleMarginUniform(delta, margin.top)}
  highlightZone={() => setHighlightedZone("margin-top")}
  clearHighlight={() => setHighlightedZone(null)}
/>
```

Zone highlight rendering: conditional background opacity boost on the strip `<div>` wrapping each value position.

#### 3. `src/overlay/SpacingBoxModel.tsx` — Tab navigation

Assign refs to all 8 EditableValue elements. Intercept `Tab`/`Shift+Tab` in `onKeyDown` to programmatically focus the next/previous in visual order:

```
const tabOrder = [
  marginTopRef, marginRightRef, marginBottomRef, marginLeftRef,
  paddingTopRef, paddingRightRef, paddingBottomRef, paddingLeftRef,
];
```

#### 4. `src/overlay/apply.ts` — Batch undo support

```tsx
let batchDepth = 0;
let batchEntries: UndoEntry[] = [];

export function beginBatch() { batchDepth++; }
export function endBatch() {
  batchDepth--;
  if (batchDepth === 0 && batchEntries.length > 0) {
    // Push a group marker — undo pops entire group
    undoStack.push({ type: 'batch', entries: batchEntries });
    batchEntries = [];
  }
}
```

Call `beginBatch()` from `onScrubStart`, `endBatch()` from `onScrubEnd`.

## Edge Cases

- **Negative margin during drag**: Allow freely. Visual diagram stays the same (no collapsing).
- **Padding clamped at 0**: Padding cannot go negative. Pass `min={0}` to EditableValue for padding values.
- **Auto margin**: Out of scope. `getComputedStyle` returns resolved px. No path to restore `auto` keyword.
- **Scrub during edit mode**: Scrub only activates on `<span>` (display mode). When `<input>` is shown (edit mode), normal text editing applies.
- **Focus ring during scrub**: Suppress focus ring during active drag to avoid visual noise.

## References

- `src/overlay/SpacingBoxModel.tsx` — component to enhance (149 lines)
- `src/overlay/controls.tsx:422` — EditableValue component
- `src/overlay/LabelScrub.tsx` — drag pattern to adopt
- `src/overlay/apply.ts:42` — applyInlineStyle + undo stack
- `src/overlay/Overlay.tsx:320` — handleSpacingChange callback
- `src/overlay/PositionOffsetDiagram.tsx` — sister component with Alt+Arrow support
- `webflow-style-panel-spec.md:195` — spacing section specification
