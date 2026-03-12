---
title: "Complete Webflow Panel Phases B & C"
type: feat
date: 2026-03-11
---

# Complete Webflow Panel Phases B & C

## Overview

Finish all 12 remaining tasks from the Redial iteration plan: 7 Phase B controls and 5 Phase C cross-cutting polish features. Each task is scoped to a single file change (mostly `WebflowPanel.tsx`) with a clear pattern to follow. Tasks are grouped into 4 parallel work streams by independence.

## Work Streams (Parallelizable)

### Stream 1: Size & Position Controls (Tasks 10, 12, 13, 14)

Independent controls in the Size and Position sections.

#### Task 10: Position visual offset diagram
**File:** `src/overlay/WebflowPanel.tsx` (render section, ~line 1420)
**Pattern:** Similar to `SpacingBoxModel.tsx` but for position offsets (top/right/bottom/left).
**Implementation:**
- Create an inline `PositionOffsetBox` component inside `WebflowPanel.tsx` (not a separate file — keep it simple)
- Nested rectangle showing top/right/bottom/left offset values
- Outer box = offset area, inner box = element
- Each value is an `EditableValue` (reuse pattern from `SpacingBoxModel.tsx:140-241`)
- Wire to existing `handleTopChange`, `handleRightChange`, `handleBottomChange`, `handleLeftChange`
- Show only when `position !== "static"`, placed above the slider rows
- Use position-themed color: `rgba(147, 130, 255, 0.08)` background (purple tint)

#### Task 12: Size auto/none keyword toggles
**File:** `src/overlay/WebflowPanel.tsx` (render section, ~line 1409)
**Pattern:** State + handlers already exist (`widthAuto`/`heightAuto`/`maxWidthNone`/`maxHeightNone` at lines 948-951, handlers at lines 1165-1187). Just need JSX toggle buttons.
**Implementation:**
- Add a small toggle button next to each Size slider: "auto" for width/height, "none" for max-width/max-height
- When active, the toggle is highlighted (#6366f1), the slider is visually disabled (opacity 0.35, pointer-events none)
- Toggle button: `<button>` with text "auto" or "none", 28px height, inline with the slider row
- Place after each SliderRow or integrate into the row's right side

#### Task 13: Size aspect-ratio control
**File:** `src/overlay/WebflowPanel.tsx`
**Implementation:**
- Add state: `const [aspectRatio, setAspectRatio] = useState(() => cs.aspectRatio === "auto" ? "" : cs.aspectRatio)`
- Add handler: `handleAspectRatioChange` applying `aspect-ratio` CSS property
- Add `TextRow` (like grid track editors) in the Size section after Max H
- Label: "Ratio", placeholder: "e.g. 16/9"
- Parse: accept "16/9", "1.5", "auto"

#### Task 14: Size object-position for media elements
**File:** `src/overlay/WebflowPanel.tsx`
**Implementation:**
- Gate: only show for `<img>`, `<video>`, `<canvas>`, `<object>` elements
- Add derived flag: `const isMedia = ["IMG", "VIDEO", "CANVAS", "OBJECT"].includes(element.tagName)`
- Add state: `objectFit` (SelectRow), `objectPosition` (TextRow)
- `OBJECT_FIT_OPTIONS`: fill, contain, cover, none, scale-down
- Place after Overflow in Size section, guarded by `{isMedia && (...)}`

### Stream 2: Spacing Enhancements (Tasks 15, 16)

Modifications to `SpacingBoxModel.tsx`.

#### Task 15: Spacing color zones
**File:** `src/overlay/SpacingBoxModel.tsx`
**Implementation:**
- Margin box (outer): warm tones — `rgba(255, 165, 80, 0.08)` background, `rgba(255, 165, 80, 0.2)` border
- Padding box (inner): cool tones — `rgba(80, 165, 255, 0.08)` background, `rgba(80, 165, 255, 0.2)` border
- Margin label color: `rgba(255, 165, 80, 0.5)`
- Padding label color: `rgba(80, 165, 255, 0.5)`
- Content placeholder: keep neutral `rgba(255,255,255,0.06)`
- 6 total style changes in existing JSX — just color swaps

#### Task 16: Spacing alt+click shortcuts
**File:** `src/overlay/SpacingBoxModel.tsx`
**Implementation:**
- In `EditableValue`'s click handler (line 216-219), detect `e.altKey`
- Alt+click on top/bottom: apply value to both top AND bottom
- Alt+click on left/right: apply value to both left AND right
- Need to know which side the value belongs to — add a `side` prop to `EditableValue`
- When `altKey` detected: call `onChange` for both complementary sides
- Update `SpacingBoxModelProps.onChange` or pass a separate `onAltClick` callback

### Stream 3: Keyboard & Navigation (Tasks 21, 22)

Changes to `Overlay.tsx` and `WebflowPanel.tsx`.

#### Task 21: Keyboard shortcuts
**File:** `src/overlay/Overlay.tsx` (lines 105-167, `handleKeyDown`)
**Implementation:**
Add after the existing arrow key block (line 166):
```typescript
// S — cycle scope (element → class → element)
if (e.key === "s" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
  e.preventDefault();
  const nextScope = scope === "element" ? "class" : "element";
  handleScopeChange(nextScope, cssClasses[0]);
}

// R — reset current element
if (e.key === "r" && !e.metaKey && !e.ctrlKey && selectedEl && !selecting) {
  e.preventDefault();
  handleReset();
}

// Cmd+S — save to source
if (e.key === "s" && (e.metaKey || e.ctrlKey) && selectedEl) {
  e.preventDefault();
  // Need to expose save from Footer or lift it up
  footerSaveRef.current?.();
}

// Cmd+C — copy CSS (only when panel is active, not text selected)
if (e.key === "c" && (e.metaKey || e.ctrlKey) && selectedEl && !window.getSelection()?.toString()) {
  e.preventDefault();
  footerCopyRef.current?.();
}
```
- Need to lift `handleSave` and `handleCopy` out of Footer.tsx via refs or callbacks passed to Overlay
- Add `scope`, `handleScopeChange`, `cssClasses` to the `handleKeyDown` dependency array

#### Task 22: Tab/Shift+Tab navigation
**File:** `src/overlay/WebflowPanel.tsx`
**Implementation:**
- Add `tabIndex={0}` to all interactive control inputs (SliderRow input, SelectRow trigger, ColorRow swatch, TextRow input)
- In `SliderRow`, `SelectRow`, `ColorRow`, `TextRow` — add `tabIndex={0}` to the primary interactive element
- No custom key handler needed — browser Tab focus traversal works with `tabIndex`
- Style focus ring: `outline: "1px solid rgba(99,102,241,0.5)"` on `:focus-visible` (via inline `onFocus`/`onBlur` state)

### Stream 4: Style Intelligence (Tasks 18, 19, 20)

New detection logic and integration of `StyleIndicator.tsx`.

#### Task 18: Unit conversion logic
**File:** `src/overlay/WebflowPanel.tsx`
**Implementation:**
- When a `UnitSelector` changes units, convert the current numeric value
- Conversion table (relative to element's computed font-size):
  - `px → em`: `value / computedFontSize`
  - `px → rem`: `value / rootFontSize` (16 typically)
  - `px → %`: requires knowing the reference dimension (parent width/height)
  - `em → px`: `value * computedFontSize`
  - `rem → px`: `value * rootFontSize`
- Add a `convertUnit(value, fromUnit, toUnit, context)` helper function
- Modify each `onUnitChange` handler to also convert the numeric value
- Context object: `{ computedFontSize: number, rootFontSize: number, parentWidth: number, parentHeight: number }`
- Read context from `getComputedStyle(element)` and `getComputedStyle(document.documentElement)`

#### Task 19: StyleIndicator detection logic
**File:** `src/overlay/StyleIndicator.tsx` (expand existing file)
**Implementation:**
- Add `detectIndicatorType(el: Element, prop: string, scope: Scope): IndicatorType`
- Logic:
  1. If scope === "class" and the class has this property → `"direct"`
  2. If element has inline style for this property → `"element"`
  3. If property is inherited (check parent chain) → `"inherited"`
  4. If property only exists on a pseudo-state → `"state"`
  5. Otherwise → `"none"`
- Use `el.style.getPropertyValue(prop)` to check inline
- Use `window.getComputedStyle(el.parentElement)` to detect inheritance
- Export the function for use in WebflowPanel

#### Task 20: StyleIndicator integration
**File:** `src/overlay/WebflowPanel.tsx`
**Implementation:**
- Import `StyleIndicator` and `detectIndicatorType`
- Add `<StyleIndicator>` dot before each label in `SliderRow`, `SelectRow`, `ColorRow`, `TextRow`
- Compute indicator type using the element + CSS property name
- Only compute when the component renders (derived, no extra state)
- Add indicator to `Section` title for section-level status (any property in section is non-default → show dot)

## Acceptance Criteria

- [ ] All 12 tasks pass `npm run typecheck`
- [ ] Each task's checkbox is marked in `.claude/CLAUDE.md`
- [ ] `ITERATION_LOG.md` has entries for all iterations
- [ ] No regressions in existing controls (slider, select, color, text rows all still work)
- [ ] Position offset diagram renders for positioned elements
- [ ] Size toggles correctly switch between auto/none and numeric values
- [ ] Spacing box model shows warm/cool color zones
- [ ] Keyboard shortcuts S, R, Cmd+S, Cmd+C all function
- [ ] StyleIndicator dots appear next to property labels

## Dependencies & Risks

- **Task 21 (keyboard shortcuts)** depends on lifting save/copy callbacks from `Footer.tsx` to `Overlay.tsx` — moderate refactor
- **Task 18 (unit conversion)** needs careful math for %, vw, vh conversions — may require context object passed through props
- **Task 19 (StyleIndicator detection)** is heuristic — inheritance detection isn't perfect for all CSS properties
- **Task 20** depends on Task 19 being complete

## Parallel Execution Strategy

```
Stream 1 (Size+Position)  ──┐
Stream 2 (Spacing)         ──┼── all independent, run in parallel
Stream 3 (Keyboard)        ──┤
Stream 4a (Tasks 18, 19)   ──┘
                              │
Stream 4b (Task 20)        ──── depends on Task 19, run after Stream 4a
```

## References

- Spec: `webflow-style-panel-spec.md` (sections 3-7, 12)
- Existing components: `StyleIndicator.tsx:28`, `SpacingBoxModel.tsx:26`, `Overlay.tsx:105`
- State/handlers already wired: `WebflowPanel.tsx:948-951` (auto/none), `WebflowPanel.tsx:1165-1187` (toggle handlers)
