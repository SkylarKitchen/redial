---
title: Draggable Spacing Box Model with Uniform Update & Hotkeys
type: feat
date: 2026-03-11
deepened: 2026-03-11
---

# Draggable Spacing Box Model with Uniform Update & Hotkeys

## Enhancement Summary

**Deepened on:** 2026-03-11
**Agents used:** Frontend Races Reviewer, Performance Oracle, Code Simplicity Reviewer, Pattern Recognition Specialist, Architecture Strategist, TypeScript Reviewer, Best Practices Researcher

### Key Improvements from Research
1. **Compose, don't merge** — wrap EditableValue in LabelScrub instead of merging them (~75 LOC vs ~250)
2. **Attach listeners synchronously** — fixes a critical React state gap that loses initial mousemove events
3. **Use PointerEvent + setPointerCapture** — eliminates global listener management, fixes cursor flicker
4. **Ref-based zone highlighting** — zero React re-renders for a purely visual hover effect
5. **Template literal types** — `SpacingProperty` and `SpacingUnit` types catch typos at compile time

### Critical Race Conditions Discovered
- React `useState` + `useEffect` for global listeners creates a 1-frame gap (existing bug in LabelScrub.tsx)
- No mutual exclusion between editing/scrubbing states → simultaneous mode bugs
- Window blur during drag leaves ghost listeners
- Stale `onChange` closures during drag cause jank

---

## Overview

Upgrade SpacingBoxModel to match Webflow's spacing controls: drag-to-scrub on values, Shift+drag for uniform all-4-sides update, hover zone highlighting, proper tab navigation, and polished visual 1:1 parity with Webflow's box model UI.

## Problem Statement

The current SpacingBoxModel only supports click-to-edit with arrow key stepping. Webflow's spacing box allows direct drag-scrubbing on any value, Shift+drag to update all sides uniformly, and hover highlighting of zones. These interactions are fundamental to the "feels like Webflow" goal.

## Proposed Solution

Compose LabelScrub around EditableValue in SpacingBoxModel, add uniform-update logic to SpacingBoxModel's callbacks, and implement zone hover highlighting via direct DOM mutation. Key interaction model:

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

Shift during drag means "update all 4 uniformly." This matches the user's request. The 10x multiplier (used elsewhere in the panel) is sacrificed during drag, but spacing values have small ranges (-200 to 200px) where 10x jumps aren't useful. Shift+Arrow retains 10x for keyboard stepping.

> **Research note:** Industry convention (Figma, Webflow, Chrome DevTools) uses Shift=10x during drag. Linked/uniform values typically use a toggle icon. However, the user explicitly requested Shift for uniform, so we honor that. If future feedback indicates this is confusing, consider a link-toggle icon instead.

### D2: 3px Dead Zone for Click vs. Drag

Mousedown starts tracking. If pointer moves >3px before mouseup → scrub. If mouseup within 3px → click-to-edit. Standard drag detection used by macOS, Figma, and Webflow. Base UI uses 2px (`pixelSensitivity`).

> **Research note (Steve Ruiz / tldraw):** Use a 3-state machine: Idle → Pointing → Dragging. Calculate delta from the *original* pointerdown position, not the dead-zone exit point, to prevent a visible jump at drag start.

### D3: Alt+Click → All 4 Sides (upgrade from pairs)

Currently Alt+click sets complementary pairs (top+bottom or left+right). Upgrade to set all 4 sides of the same group. This replaces the ambiguous "corner click" concept.

### D4: Undo Batching for Drag Gestures

Uniform drag fires 4 `onChange` calls per mousemove. Without batching, the undo stack grows 4× per frame. Solution: snapshot values on drag start, commit a single batch undo entry on drag end.

> **Research note:** Every major design tool (Figma, Sketch, Webflow, Photoshop) treats one drag gesture as one atomic undo entry. The pattern: save "before" on pointerdown, commit delta on pointerup.

### D5: Tab Order via CSS `order` + Data Attributes

DOM order doesn't match visual order. Rather than managing 8 refs and intercepting Tab, restructure DOM so children render in visual tab order (top → right → bottom → left) and use CSS `order` for visual positioning. One container ref + `data-spacing-index` attributes enables a single `onKeyDown` handler (~10 lines vs ~30).

### D6: Units Out of Scope

The interface already accepts unit props. Drag-to-scrub operates on the numeric value in the current unit. No unit conversion logic in this feature.

### D7: Compose LabelScrub, Don't Merge (NEW)

Wrap each EditableValue in LabelScrub inside SpacingBoxModel. This keeps both components unchanged and reusable. EditableValue doesn't need to know about scrubbing. SpacingBoxModel handles the composition.

> **Agent consensus:** All 4 reviewing agents (simplicity, architecture, pattern recognition, TypeScript) agreed: merging creates a god component. Composition cuts implementation from ~250 lines to ~75.

### D8: PointerEvent + setPointerCapture (NEW)

Migrate from MouseEvent + global `document.addEventListener` to PointerEvent + `setPointerCapture`. Benefits:
- Events route to captured element regardless of cursor position — no global listeners needed
- Eliminates cursor flickering when pointer moves fast
- Unified mouse/touch/pen support
- No `document.body.style.cursor` hack — element's own cursor stays active

### D9: Synchronous Listener Attachment (NEW — Critical Bug Fix)

The existing LabelScrub has a 1-frame gap between `setScrubbing(true)` and the `useEffect` that attaches global listeners. During this gap, initial mousemove events are lost, causing a visible value jump. Fix: attach listeners **synchronously** in the pointerdown handler, never via useEffect.

> **Race condition severity: Critical.** This affects the existing LabelScrub.tsx too and should be fixed there.

## Acceptance Criteria

### Drag-to-Scrub
- [ ] Dragging horizontally on any spacing value scrubs it in real-time
- [ ] Cursor shows `ew-resize` on hover over values
- [ ] Value text turns indigo (`#6366f1`) during active scrub
- [ ] 3px dead zone: short clicks still enter edit mode
- [ ] Text selection disabled during drag (`userSelect: none`)
- [ ] No visible value jump at drag start (dead zone delta calculated from original position)

### Uniform Update
- [ ] Shift+drag on any margin value updates all 4 margin values to match
- [ ] Shift+drag on any padding value updates all 4 padding values to match
- [ ] Visual feedback: all 4 values update live during drag
- [ ] Alt modifier works during shift+drag for 0.1x fine scrub
- [ ] Shift state locked at drag start (pressing Shift mid-drag does not switch modes)

### Alt+Click All Sides
- [ ] Alt+clicking any margin value sets all 4 margins to that value
- [ ] Alt+clicking any padding value sets all 4 paddings to that value

### Keyboard
- [ ] Alt+Arrow Up/Down steps by 0.1px (new — matches PositionOffsetDiagram)
- [ ] Shift+Arrow Up/Down steps by 10px (existing, verify still works)
- [ ] Tab cycles through all 8 values in visual order (top→right→bottom→left per group)
- [ ] Shift+Tab reverses cycle direction

### Hover Highlighting
- [ ] Hovering a value highlights the corresponding zone strip in the diagram
- [ ] Margin zones highlight at `rgba(255, 152, 87, 0.16)` (2× base)
- [ ] Padding zones highlight at `rgba(87, 168, 255, 0.16)` (2× base)
- [ ] Highlight clears on mouse leave
- [ ] Highlight suppressed during active scrub (no flicker on pointer leave)

### Undo
- [ ] Entire drag gesture (single value) is one undo entry
- [ ] Entire uniform drag gesture (4 values) is one undo entry
- [ ] Cmd+Z reverts the full gesture, not individual pixels

### Robustness
- [ ] Window blur / tab switch during drag ends the gesture cleanly
- [ ] No orphaned global listeners after component unmount
- [ ] No stale closure bugs during drag (callbacks stored in refs)

### Visual Polish
- [ ] Box model appearance matches Webflow's spacing diagram proportions
- [ ] Content placeholder centered with proper sizing
- [ ] Labels ("MARGIN", "PADDING") positioned top-left with muted styling
- [ ] Border colors and background opacities match dark theme spec

## Technical Approach

### Type Safety (NEW)

Add shared types to `src/overlay/types.ts` (or top of controls.tsx):

```tsx
type SpacingSide = 'top' | 'right' | 'bottom' | 'left';
type SpacingProperty = `margin-${SpacingSide}` | `padding-${SpacingSide}`;
type SpacingUnit = 'px' | '%' | 'em' | 'rem' | 'vw' | 'vh';
```

Update `SpacingBoxModelProps`:
```tsx
interface SpacingBoxModelProps {
  margin: Record<SpacingSide, number>;
  padding: Record<SpacingSide, number>;
  onChange: (prop: SpacingProperty, value: number, unit: SpacingUnit) => void;
  marginUnit: SpacingUnit;
  paddingUnit: SpacingUnit;
  marginUnits: readonly SpacingUnit[];
  paddingUnits: readonly SpacingUnit[];
  onMarginUnitChange: (unit: SpacingUnit) => void;
  onPaddingUnitChange: (unit: SpacingUnit) => void;
}
```

### File Changes

#### 1. `src/overlay/LabelScrub.tsx` — Fix critical race + migrate to PointerEvent

**This is a prerequisite.** The existing LabelScrub has two bugs that must be fixed first:

**Bug 1: React state gap (Critical)**
Replace `useState(scrubbing)` + `useEffect` with synchronous listener attachment:

```tsx
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  if (e.button !== 0) return;
  e.preventDefault();

  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);

  startXRef.current = e.clientX;
  startValueRef.current = latestRef.current;
  isDraggingRef.current = false;

  // Listeners attached synchronously — zero gap
  const handleMove = (me: PointerEvent) => { /* ... */ };
  const handleUp = (me: PointerEvent) => {
    el.releasePointerCapture(me.pointerId);
    el.removeEventListener("pointermove", handleMove);
    el.removeEventListener("pointerup", handleUp);
    window.removeEventListener("blur", handleUp);
    // ... cleanup cursor/userSelect
    onScrubEnd?.();
  };

  el.addEventListener("pointermove", handleMove);
  el.addEventListener("pointerup", handleUp);
  window.addEventListener("blur", handleUp); // ghost drag safety net

  onScrubStart?.();
}, []);
```

**Bug 2: Stale onChange closure**
Store `onChange` in a ref:
```tsx
const onChangeRef = useRef(onChange);
onChangeRef.current = onChange;
// In handleMove: onChangeRef.current(clamp(rounded));
```

**New props:**
```tsx
export interface LabelScrubProps {
  children: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  onScrubStart?: () => void;    // NEW
  onScrubEnd?: () => void;      // NEW
  step?: number;
  min?: number;
  max?: number;
  deadZone?: number;            // NEW (default 3)
}
```

#### 2. `src/overlay/controls.tsx` — Add Alt+Arrow to EditableValue

Minimal change — add `altKey` support to arrow key handler (consistency with PositionOffsetDiagram):

```tsx
// In handleKeyDown:
const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
```

Optionally wrap with `React.memo` using value-only comparison:
```tsx
export const EditableValue = React.memo(
  function EditableValue(props: EditableValueProps) { /* existing */ },
  (prev, next) => prev.value === next.value
);
```

#### 3. `src/overlay/SpacingBoxModel.tsx` — Main integration

This is where all the new behavior lives (~75 new lines):

**3a. Compose LabelScrub around each EditableValue:**
```tsx
<LabelScrub
  value={margin.top}
  onChange={(v) => handleMarginChange("margin-top", v)}
  onScrubStart={() => beginBatch()}
  onScrubEnd={() => endBatch()}
  deadZone={3}
>
  <EditableValue
    value={margin.top}
    onChange={(v) => handleMarginChange("margin-top", v)}
    onAltClick={() => setAllMargins(margin.top)}
  />
</LabelScrub>
```

**3b. Shift-key uniform update in SpacingBoxModel's handler:**
```tsx
const shiftHeldRef = useRef(false);

// Capture shift state on pointer down (lock for duration of drag)
const handleScrubStart = useCallback((side: SpacingSide, group: 'margin' | 'padding') => {
  // shiftHeld is read from the most recent pointerdown event
  beginBatch();
}, []);

const handleMarginChange = useCallback((prop: SpacingProperty, value: number) => {
  if (shiftHeldRef.current) {
    onChange("margin-top", value, marginUnit);
    onChange("margin-right", value, marginUnit);
    onChange("margin-bottom", value, marginUnit);
    onChange("margin-left", value, marginUnit);
  } else {
    onChange(prop, value, marginUnit);
  }
}, [onChange, marginUnit]);
```

**3c. Zone highlighting via direct DOM mutation (zero re-renders):**
```tsx
const marginZoneRef = useRef<HTMLDivElement>(null);
const paddingZoneRef = useRef<HTMLDivElement>(null);

// On mouseEnter of any margin value:
const highlightMargin = () => {
  if (marginZoneRef.current)
    marginZoneRef.current.style.background = "rgba(255, 152, 87, 0.16)";
};
const clearMargin = () => {
  if (marginZoneRef.current)
    marginZoneRef.current.style.background = "rgba(255, 152, 87, 0.08)";
};
```

**3d. Tab navigation with data attributes:**
```tsx
const containerRef = useRef<HTMLDivElement>(null);

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const idx = Number((e.target as HTMLElement).dataset.spacingIndex);
  const next = e.shiftKey ? (idx + 7) % 8 : (idx + 1) % 8;
  containerRef.current
    ?.querySelector<HTMLElement>(`[data-spacing-index="${next}"]`)
    ?.focus();
};

// Each EditableValue span gets: data-spacing-index={0..7}
```

#### 4. `src/overlay/apply.ts` — Batch undo support

```tsx
let batchDepth = 0;
const batchSnapshots: Map<string, string> = new Map(); // prop → initial value

export function beginBatch(): void {
  batchDepth++;
}

export function endBatch(): void {
  batchDepth--;
  if (batchDepth === 0) {
    batchSnapshots.clear();
  }
}

// In applyInlineStyle, during batch:
// - First touch of each prop saves to batchSnapshots
// - Don't push individual undo entries
// - On endBatch, push one compound entry
```

Also add `captureInitials` to prevent layout thrashing on first uniform drag:
```tsx
export function captureInitials(el: Element, props: string[]): void {
  if (!overrides.has(el)) overrides.set(el, new Map());
  const elOverrides = overrides.get(el)!;
  // Batch all reads (single layout computation)
  const values: [string, string][] = [];
  for (const prop of props) {
    if (!elOverrides.has(prop)) {
      values.push([prop, getComputedStyle(el).getPropertyValue(prop).trim()]);
    }
  }
  // Then set all (no interleaved reads/writes)
  for (const [prop, initial] of values) {
    if (!elOverrides.has(prop)) {
      elOverrides.set(prop, { initial, current: initial });
    }
  }
}
```

## Edge Cases

- **Negative margin during drag**: Allow freely. Visual diagram unchanged.
- **Padding clamped at 0**: Pass `min={0}` to LabelScrub for padding values.
- **Auto margin**: Out of scope. `getComputedStyle` returns resolved px.
- **Scrub during edit mode**: LabelScrub wraps the EditableValue span — when input is shown (edit mode), LabelScrub's children change but LabelScrub does not interfere with input events.
- **Window blur during drag**: `window.blur` listener force-ends the gesture, calls `endBatch()`.
- **Component unmount during drag**: `releasePointerCapture` + listener cleanup in the pointerup path. Add a useEffect cleanup that force-ends any active drag.
- **Shift pressed mid-drag**: Ignored — Shift state locked at drag start for predictable undo.
- **Focus ring during scrub**: Suppress via mode check in EditableValue's focus handlers.
- **Hover flicker during scrub**: Guard `onMouseEnter`/`onMouseLeave` with scrub mode check.
- **Stale closures**: All callbacks stored in refs, updated every render.

## Implementation Order

1. **Fix LabelScrub.tsx** — PointerEvent migration + synchronous listeners + dead zone + onScrubStart/End (prerequisite, benefits all existing SliderRow usage)
2. **Add types** — SpacingSide, SpacingProperty, SpacingUnit
3. **Add Alt+Arrow to EditableValue** — one-line change in controls.tsx
4. **Compose in SpacingBoxModel** — wrap EditableValues in LabelScrub, add shift-uniform logic
5. **Zone highlighting** — ref-based DOM mutation
6. **Tab navigation** — data attributes + single keydown handler
7. **Undo batching** — beginBatch/endBatch in apply.ts
8. **captureInitials** — layout thrashing prevention

## References

### Internal
- `src/overlay/SpacingBoxModel.tsx` — component to enhance (149 lines)
- `src/overlay/controls.tsx:422` — EditableValue component
- `src/overlay/LabelScrub.tsx` — drag pattern to fix and compose with
- `src/overlay/apply.ts:42` — applyInlineStyle + undo stack
- `src/overlay/Overlay.tsx:320` — handleSpacingChange callback
- `src/overlay/PositionOffsetDiagram.tsx` — sister component with Alt+Arrow

### External
- [Dead Zone Dragging — Steve Ruiz (tldraw)](https://www.steveruiz.me/posts/dead-zone)
- [setPointerCapture for Drag Interactions — r0b blog](https://blog.r0b.io/post/creating-drag-interactions-with-set-pointer-capture-in-java-script/)
- [ARIA spinbutton role — MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/spinbutton_role)
- [Base UI NumberField.ScrubArea](https://base-ui.com/react/components/number-field) — reference implementation
- [reddojs — Command coalescing for undo](https://github.com/eihabkhan/reddojs)
- `webflow-style-panel-spec.md:195` — spacing section specification
