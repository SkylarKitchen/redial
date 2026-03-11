---
title: "Panel Polish: Tier 2-3 (Timing, Thumbs, Keyboard, ARIA, Toast, DnD, Swatches)"
type: feat
date: 2026-03-11
---

# Panel Polish: Tier 2-3

Seven cross-cutting polish features to bring the panel from functional to production-grade. Ordered by dependency chain — timing tokens first (enables clean implementation of everything else), visual polish next, then interaction and accessibility.

## Implementation Order & Dependency Chain

```
7. Timing tokens ──> 1. Slider thumb ──> 2. Toast animation
                 ──> 4+6. SelectRow KB + ARIA (together)
                 ──> 3. DnD improvements
                 ──> 5. Color picker swatches
```

Features 4 (SelectRow keyboard) and 6 (ARIA roles) are co-dependent — ARIA `listbox` roles require keyboard navigation to be meaningful. Implement together.

---

## Phase 1: Canonical Timing System

**Files:** New `src/overlay/timing.ts`, then refactor 15+ existing files

### Token Taxonomy

```typescript
// src/overlay/timing.ts
export const timing = {
  instant: 50,   // selector highlight
  micro:   60,   // dropdown option hover
  fast:    80,   // button/control hover background
  normal: 100,   // text feedback, state transitions
  expand: 150,   // section collapse/expand, chevron rotate
  layout: 200,   // drag displacement, focus ring transitions
  slow:   300,   // scrollbar fade, complex animations
} as const;

export type TimingKey = keyof typeof timing;

/** Convert number to CSS duration string: ms(80) → "80ms" */
export const ms = (n: number) => `${n}ms`;
```

### Refactor Scope (47 occurrences across 15+ files)

| Value | Files to update |
|-------|----------------|
| `60ms` | `controls.tsx`, `UnitSelector.tsx`, `StateSelector.tsx`, `layoutControls.tsx` |
| `80ms` | `IconButtonGroup.tsx`, `UnitSelector.tsx`, `StateSelector.tsx`, `controls.tsx`, `layoutControls.tsx`, `WebflowPanel.tsx`, `TransformEditor.tsx`, `Overlay.tsx` |
| `100ms` | `Footer.tsx`, `ShadowEditor.tsx`, `CornerRadiusEditor.tsx`, `SideSelector.tsx`, `SpacingBoxModel.tsx`, `ViewportBar.tsx`, `SizeInputCell.tsx`, `DragHandle.tsx`, `ColorPickerEnhanced.tsx`, `controls.tsx` |
| `150ms` | `controls.tsx` (x2), `Overlay.tsx`, `WebflowPanel.tsx` (x2) |
| `200ms` | `useDragReorder.ts` (x2), `Overlay.tsx` (x2) |
| `0.3s` | `Overlay.tsx` (scrollbar) |

### Rules
- Export numbers only; use `ms()` helper for CSS strings
- Preserve exact values — do not normalize (keep the one `50ms` as `timing.instant`)
- Template-interpolate into `dangerouslySetInnerHTML` CSS strings in `Overlay.tsx`
- No transition presets yet — just raw timing values

### Acceptance Criteria

- [ ] `timing.ts` exports the token object and `ms()` helper
- [ ] All 47 magic-number timing values replaced with token references
- [ ] `npm run typecheck` passes
- [ ] Zero behavior change — visual output identical before/after

---

## Phase 2: Slider Thumb Styling

**Files:** `src/overlay/Overlay.tsx` (global `<style>` injection), retire `SpacingValuePopover.tsx` scoped styles

### Approach

Add global CSS targeting `.__tuner-root input[type="range"]` in the existing `<style>` block in `Overlay.tsx` (line ~663, where scrollbar styles already live). This covers all 5 slider locations: SliderRow, GapRow, FilterSliders, TransitionEditor, SpacingValuePopover.

```css
.__tuner-root input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid rgba(255,255,255,0.9);
  box-shadow: 0 0 3px rgba(0,0,0,0.4);
  cursor: pointer;
  transition: transform <timing.fast>ms, box-shadow <timing.fast>ms;
}

.__tuner-root input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.25);
}

.__tuner-root input[type="range"]::-webkit-slider-thumb:active {
  transform: scale(1.1);
  background: #818cf8;
}

/* Firefox */
.__tuner-root input[type="range"]::-moz-range-thumb {
  /* Same styles, minus -webkit prefix */
}
```

### Rules
- Retire the scoped `<style>` in `SpacingValuePopover.tsx` — the global style covers it
- 12px diameter matches the existing SpacingValuePopover thumb size
- Active state: slightly brighter (`#818cf8`) and scaled down from hover

### Acceptance Criteria

- [ ] All range inputs in the panel show styled thumbs
- [ ] Hover: scale up + glow ring
- [ ] Active/pressed: brighter color
- [ ] Works in Chrome and Firefox
- [ ] SpacingValuePopover scoped `<style>` removed
- [ ] `npm run typecheck` passes

---

## Phase 3: Toast Feedback Animation

**Files:** `src/overlay/Footer.tsx`

### Approach

Use Motion (`AnimatePresence` + `motion.span`) since it's already a project dependency (used in `SessionDrawer.tsx`) and handles exit animations cleanly. CSS transitions can't animate `display: none` → visible.

### Implementation

```tsx
import { AnimatePresence, motion } from "motion/react";

// In the message area (currently line 139):
<AnimatePresence mode="wait">
  {(clipboardMessage || message) && (
    <motion.span
      key={clipboardMessage || message}  // triggers exit/enter on text change
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: timing.normal / 1000 }}  // 100ms
      style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}
    >
      {clipboardMessage || message}
    </motion.span>
  )}
</AnimatePresence>
```

### Decisions
- `mode="wait"` — old message exits before new enters (no overlap)
- Slide direction: up 4px on enter, up 4px on exit (feels like rising toast)
- `clipboardMessage` also animates (it appears/disappears when clipboard state changes)
- Layout stability: add `minHeight: "20px"` to the message container so Reset button doesn't jump
- Rapid clicks: `key` change triggers exit→enter cycle; if same text, no re-animation

### Accessibility
- Add `role="status"` and `aria-live="polite"` to the message container so screen readers announce messages

### Acceptance Criteria

- [ ] Messages fade-slide in when appearing
- [ ] Messages fade-slide out when disappearing
- [ ] Rapid copy clicks produce smooth transitions (no flicker)
- [ ] Reset button position is stable
- [ ] `role="status"` and `aria-live="polite"` on message container
- [ ] Uses timing tokens
- [ ] `npm run typecheck` passes

---

## Phase 4: SelectRow Keyboard Navigation + ARIA Roles

**Files:** `controls.tsx` (SelectRow), `UnitSelector.tsx`, `IconButtonGroup.tsx`, `layoutControls.tsx` (DisplayTabs)

These two features are implemented together because ARIA `listbox` roles require keyboard navigation to be meaningful.

### 4A: SelectRow Keyboard + ARIA

**ARIA pattern:** `combobox` trigger button + `listbox` popup

```tsx
// Button additions:
role="combobox"
aria-expanded={open}
aria-haspopup="listbox"
aria-activedescendant={open ? `${id}-opt-${highlightedIndex}` : undefined}

// Dropdown container:
role="listbox"

// Each option:
role="option"
id={`${id}-opt-${index}`}
aria-selected={opt.value === value}
```

**Keyboard behavior:**
| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open dropdown (if closed); select highlighted option (if open) |
| `ArrowDown` | Open dropdown + highlight next option (wraps) |
| `ArrowUp` | Open dropdown + highlight prev option (wraps) |
| `Escape` | Close dropdown, restore focus to button |
| `Tab` | Close dropdown, move focus to next control |
| `Home` | Jump to first option |
| `End` | Jump to last option |
| Type characters | Type-ahead: 500ms buffer, prefix-match against option labels |

**New state:** `highlightedIndex: number` (default: index of current value when opening)

**Scroll into view:** Call `el.scrollIntoView({ block: "nearest" })` when highlighted index changes and dropdown has `maxHeight: 180px`.

**Generate IDs:** Use `React.useId()` for unique prefix per SelectRow instance.

### 4B: UnitSelector ARIA

Same `listbox` pattern as SelectRow, with keyboard navigation.

### 4C: IconButtonGroup ARIA

**Single-select mode:** `role="radiogroup"` on container, `role="radio"` + `aria-checked` on each button.

**Multi-select mode:** `role="toolbar"` on container, `aria-pressed` on each button.

Add `aria-label` prop to the component (passed by parent to describe the group, e.g., "Text alignment").

### 4D: DisplayTabs ARIA

`role="tablist"` on container, `role="tab"` + `aria-selected` on each tab button.

Arrow key navigation between tabs (left/right).

### Acceptance Criteria

- [ ] SelectRow: full keyboard navigation (arrows, enter, escape, type-ahead, home/end)
- [ ] SelectRow: ARIA combobox + listbox pattern with activedescendant
- [ ] UnitSelector: keyboard navigation + listbox ARIA
- [ ] IconButtonGroup: radiogroup/toolbar roles + aria-checked/aria-pressed
- [ ] DisplayTabs: tablist/tab roles + aria-selected + arrow key nav
- [ ] All dropdowns: scroll-into-view on keyboard highlight
- [ ] Unique IDs via `useId()`
- [ ] `npm run typecheck` passes

---

## Phase 5: Shadow/Transform DnD Improvements

**Files:** `src/overlay/useDragReorder.ts`

### Approach: CSS-based settle animation

Add a `settling` phase to the hook's state machine: `idle → pending → dragging → settling → idle`

```
pointerdown → 3px dead zone → dragging → pointerup → settling (200ms) → idle
```

During `settling`:
- Reorder callback fires immediately (items move to final order)
- CSS `transition: transform <timing.layout>ms cubic-bezier(0.34, 1.56, 0.64, 1)` on all items
- The dragged item animates from its drag offset to `translateY(0)`
- Displaced items animate back to `translateY(0)`
- After 200ms timeout, clear the settling state

### Spring-like easing

Use `cubic-bezier(0.34, 1.56, 0.64, 1)` — a CSS approximation of a spring with slight overshoot. This avoids pulling in Motion's imperative `animate()` and keeps the hook vanilla React.

### Visual preview (already sufficient)

The current dragged-item style (zIndex 50, boxShadow, opacity 0.95) is already a good preview. No ghost/clone needed.

### DragHandle visibility fix

Verify that `DragHandle.tsx` opacity behavior works with inline styles. Currently relies on parent hover — ensure the parent row sets `onMouseEnter`/`onMouseLeave` to toggle handle visibility.

### Acceptance Criteria

- [ ] Drop animation: items spring-settle into place over 200ms
- [ ] Spring easing: slight overshoot via cubic-bezier
- [ ] No snap-to-position on drop
- [ ] Cancel (drop in same position): no settle animation needed
- [ ] Works for both ShadowEditor and TransformEditor
- [ ] DragHandle visible on row hover
- [ ] Uses timing tokens
- [ ] `npm run typecheck` passes

---

## Phase 6: Color Picker Swatch Palette

**Files:** New `src/overlay/useSwatches.ts`, modify `src/overlay/ColorPickerEnhanced.tsx`

### Storage: Module-level store + localStorage

```typescript
// src/overlay/useSwatches.ts
interface Swatch {
  hex: string;
  opacity: number;
}

const STORAGE_KEY = "__tuner_swatches";
const MAX_SWATCHES = 24;  // 3 rows of 8

// Module-level store with useSyncExternalStore
// Persists to localStorage with global key (not per-page)
```

This approach avoids a React context provider (which would need to wrap the entire Overlay) and works across all ColorPickerEnhanced instances (ColorRow, ShadowEditor, BackgroundLayerList).

### UI Layout

```
─── Swatches ──────────────────
[sq][sq][sq][sq][sq][sq][sq][sq]
[sq][sq][sq][sq][sq][sq][sq][+]
```

- Grid: 8 columns, ~24px squares with 4px gap
- Fits within the 216px canvas width (`CANVAS_W`)
- "+" button adds current color to swatches
- Hover on swatch shows small X delete button (top-right corner)
- Click swatch: applies hex + opacity, updates all picker state

### Decisions
- Swatches store `{ hex, opacity }` — preserves full color info
- Max 24 swatches; adding beyond max replaces oldest
- Starts empty (no preset colors)
- Duplicate prevention: skip if hex+opacity match exactly

### ARIA for swatches
- Grid: `role="grid"` with `aria-label="Saved color swatches"`
- Each swatch: `role="gridcell"` with `aria-label` describing the color (e.g., "#FF0000 at 100%")

### Acceptance Criteria

- [ ] Swatch grid renders below color mode inputs
- [ ] Click swatch applies color + opacity
- [ ] "+" button adds current color
- [ ] Hover shows X delete button
- [ ] Persists to localStorage across page reloads
- [ ] Shared across all picker instances
- [ ] Max 24 swatches with oldest-replacement
- [ ] Duplicate prevention
- [ ] ARIA roles on grid
- [ ] `npm run typecheck` passes

---

## Technical Considerations

### Performance
- Timing token refactor is zero-runtime-cost (same values, just imported from a module)
- Swatch `useSyncExternalStore` triggers re-renders only in mounted ColorPickerEnhanced instances
- DnD settle phase uses CSS transitions (GPU-accelerated), not JS animation loops

### Bundle Impact
- `timing.ts`: ~200 bytes (tree-shakeable)
- `useSwatches.ts`: ~400 bytes (only loaded when color picker opens)
- No new dependencies — Motion is already in the bundle

### Cross-browser
- Slider thumb: `::-webkit-slider-thumb` (Chrome/Safari/Edge) + `::-moz-range-thumb` (Firefox)
- `React.useId()` requires React 18+ (verify project version)
- `useSyncExternalStore` requires React 18+ (same)

## References

### Internal
- `src/overlay/controls.tsx:160-238` — SliderRow (thumb target)
- `src/overlay/controls.tsx:242-376` — SelectRow (keyboard + ARIA target)
- `src/overlay/Footer.tsx:34-38` — showMessage (toast target)
- `src/overlay/useDragReorder.ts:128-152` — drop logic (DnD target)
- `src/overlay/ColorPickerEnhanced.tsx:78-83` — picker interface (swatch target)
- `src/overlay/IconButtonGroup.tsx:17-89` — no ARIA (ARIA target)
- `src/overlay/layoutControls.tsx:235-341` — DisplayTabs (ARIA target)
- `src/overlay/Overlay.tsx:663-703` — global `<style>` injection (thumb CSS target)
- `src/overlay/SpacingValuePopover.tsx:176-198` — existing thumb pattern to retire

### Spec
- `webflow-style-panel-spec.md` line 740 — Section 12: Input Controls & Units
- `webflow-style-panel-spec.md` line 828 — Section 13: Keyboard & Interaction Patterns
- `webflow-style-panel-spec.md` line 794-824 — Color Picker + Swatches spec
