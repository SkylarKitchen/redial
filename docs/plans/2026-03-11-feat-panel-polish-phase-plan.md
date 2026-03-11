---
title: "feat: Panel Polish Phase — Bugs, Spec Gaps, and Quality"
type: feat
date: 2026-03-11
---

# Panel Polish Phase

All 22 spec checklist items are complete (iterations 1–18). This plan addresses bugs, spec gaps, interaction polish, and code health discovered during review.

## Tier 1 — Blocking Bugs (Fix First)

These are data-loss or broken-feature issues. Must be resolved before other work.

### 1A. ColorRow drops opacity value

**File:** `src/overlay/controls.tsx:433`
**Bug:** `ColorPickerEnhanced` emits `onChange(hex, opacity)` but `ColorRow` passes only `onChange={(hex) => onChange(hex)}`. The opacity parameter is silently lost — rgba colors never work.
**Fix:** Change `ColorRow`'s `onChange` to emit a single rgba/hex string. When opacity < 1, emit `rgba(r,g,b,a)`. When opacity === 1, emit hex. Update all `ColorRow` consumers in `WebflowPanel.tsx`.

### 1B. ShadowEditor uses native `<input type="color">`

**File:** `src/overlay/ShadowEditor.tsx:202-219`
**Bug:** Shadow color uses the native OS color picker instead of `ColorPickerEnhanced`. No opacity support, visually inconsistent.
**Fix:** Replace hidden `<input type="color">` with `ColorPickerEnhanced` popover, same pattern as `ColorRow`.

### 1C. Unit state defaults to "px" regardless of authored unit

**File:** `src/overlay/WebflowPanel.tsx` (20+ `useState("px")` calls)
**Bug:** If element has `width: 50%`, panel shows `px`. Saving overwrites `%` with `px`.
**Fix:** Add `detectUnit(el, prop)` in `infer.ts` that reads `element.style[prop]` first, then walks matching stylesheet rules, defaults to `"px"`. Call it from `WebflowPanel` to initialize unit state.

### 1D. Escape in ValueInput closes entire panel

**File:** `src/overlay/controls.tsx` (ValueInput) + `src/overlay/Overlay.tsx:244`
**Bug:** Pressing Escape while editing a value propagates to `Overlay.tsx` which interprets it as "close panel". User loses their editing context.
**Fix:** Add `e.stopPropagation()` in ValueInput's Escape handler. Same for `EditableValue`.

### 1E. Panel scroll position resets on every change

**File:** `src/overlay/Overlay.tsx` (panelKey increments on re-infer)
**Bug:** `panelKey` increments on every undo/change, causing full remount. Scroll jumps to top mid-edit.
**Fix:** Save `scrollTop` from `panelScrollRef.current` before re-infer, restore via `useLayoutEffect` after remount.

### 1F. Cmd+C and Footer copy produce different output formats

**Files:** `src/overlay/Overlay.tsx:138-146`, `src/overlay/Footer.tsx:27-39`
**Bug:** Footer copy includes selector + comments showing old values. Cmd+C shortcut produces bare `{ prop: value; }`. Inconsistent.
**Fix:** Extract shared `formatCSSDiff()` utility, use from both paths.

## Tier 2 — Spec Completeness (Parallelizable)

Independent features that fill spec gaps. Can be built by parallel agents.

### 2A. Section collapse/expand animation

**File:** `src/overlay/controls.tsx` (Section component, line 31-68)
**Current:** Hard mount/unmount via `{open && ...}`.
**Fix:** Wrap section content in a `div` with CSS `max-height` + `overflow: hidden` transition. Use `ref` to measure content height for accurate animation. ~150ms ease-out.

### 2B. Slider thumb custom styling

**File:** `src/overlay/Overlay.tsx` (injected `<style>` tag)
**Current:** `appearance: none` on track but default browser thumb.
**Fix:** Add `::-webkit-slider-thumb` rules to the existing injected `<style>` tag. 12px circle, `#6366f1` background, 2px white border, hover glow.

### 2C. SelectRow keyboard navigation

**File:** `src/overlay/controls.tsx` (SelectRow, line 211-345)
**Current:** Click-only, no arrow key navigation, no Escape to close.
**Fix:** Add `onKeyDown` handler: ArrowUp/Down to navigate options, Enter to select, Escape to close. Add `aria-expanded`, `role="listbox"`, `aria-activedescendant`. Track `highlightedIndex` state.

### 2D. ColorPicker Escape key + ARIA

**File:** `src/overlay/ColorPickerEnhanced.tsx`
**Fix:** Add `onKeyDown` for Escape to close popover. Add `role="dialog"`, `aria-label="Color picker"`.

### 2E. Double-click to select all in ValueInput

**File:** `src/overlay/controls.tsx` (ValueInput)
**Fix:** Add `onDoubleClick` handler that calls `inputRef.current.select()`.

### 2F. Panel entrance animation

**File:** `src/overlay/Overlay.tsx` (panel container div)
**Fix:** Add CSS transition on mount: `opacity: 0 → 1`, `transform: translateY(4px) → 0` over 150ms. Use a `mounted` state that flips after first render via `requestAnimationFrame`.

### 2G. Cmd+C visual feedback toast

**File:** `src/overlay/Overlay.tsx`
**Fix:** Add `copiedFlash` state. On Cmd+C, set true, auto-clear after 1.5s. Render a small "Copied!" badge at bottom of panel (same style as Footer's existing pattern).

### 2H. Shadow/Transform reorder buttons

**Files:** `src/overlay/ShadowEditor.tsx`, `src/overlay/TransformEditor.tsx`
**Fix:** Add up/down arrow buttons on each row. Swap array items and re-emit `onChange`. Simple approach — drag-to-reorder can be a future enhancement.

### 2I. ARIA attributes on interactive elements

**Files:** Multiple — `controls.tsx`, `IconButtonGroup.tsx`, `AlignBox.tsx`, `Header.tsx`
**Fix:**
- Panel container: `role="dialog"`, `aria-label="CSS Inspector"`
- Section headers: `aria-expanded={open}`
- IconButtonGroup buttons: `aria-pressed={active}`
- AlignBox cells: `aria-label` with descriptive text (e.g., "Align top-left")
- Header close button: `aria-label="Close"`
- Session badge: `aria-label="View session changes"`

## Tier 3 — Advanced Features (Sequential, After Tier 1-2)

### 3A. StyleIndicator "direct" type

**File:** `src/overlay/WebflowPanel.tsx` (getIndicatorType)
**Current:** Only detects "element" (inline) and "inherited".
**Fix:** Walk `document.styleSheets` to find if property is declared on the element's matching class rules. If so, return "direct" (blue dot).

### 3B. Color picker HSB/RGB/Hex mode toggle

**File:** `src/overlay/ColorPickerEnhanced.tsx`
**Fix:** Add mode toggle button (HSB → RGB → Hex, cycling). Show 3 number inputs for HSB or RGB mode, single hex input for Hex mode. Swatches row below (saved to localStorage).

### 3C. Background image layer editing verification

**File:** `src/overlay/BackgroundLayerList.tsx`, `src/overlay/WebflowPanel.tsx`
**Fix:** Verify that image layer `onChange` properly reconstitutes `background-image`, `background-size`, `background-position`, `background-repeat` longhand properties and calls `applyInlineStyle()`. Wire any missing connections.

## Tier 4 — Code Health

### 4A. Extract shared utilities

**Current duplicates:**
- `rgbToHex` — 3 copies (infer.ts, WebflowPanel.tsx, ColorPickerEnhanced.tsx)
- `parseNum` — 2 copies (infer.ts, WebflowPanel.tsx)
- `isTextBearing` / `TEXT_TAGS` — 2 copies (infer.ts, WebflowPanel.tsx)

**Fix:** Create `src/overlay/colorUtils.ts` and `src/overlay/cssUtils.ts`. Move shared functions there, update imports.

### 4B. Unit tests for overlay code

**Priority test targets:**
- `apply.ts` — applyInlineStyle, undo, redo, reset, diff, batch mode
- `unitConversion.ts` — convertUnit for all unit pairs
- `colorUtils.ts` — hexToRgb, rgbToHex, rgbToHsb, hsbToRgb (after extraction)
- CSS parsers — parseBoxShadow, parseFilter, parseTransform, parseTransitions

## Out of Scope (Deferred)

- **StateSelector functional implementation** — Architecturally complex (crosses infer, apply, scope). Requires stylesheet parsing for pseudo-class rules and a new pseudo-class-scoped style application path. Deferred to a dedicated iteration.
- **StyleIndicator "state" type** — Depends on StateSelector being functional.
- **Scope "class" mode fully functional** — Currently decorative. Requires dedicated architecture work.
- **Tab navigation wrapping within sections** — Current cross-section tabbing is acceptable UX.
- **GapRow linked/unlinked toggle** — Visual-only state, minor.

## Acceptance Criteria

- [ ] All rgba colors from color picker apply correctly (opacity preserved)
- [ ] Shadow colors use ColorPickerEnhanced with opacity
- [ ] Unit selectors initialize from authored CSS unit, not hardcoded "px"
- [ ] Escape in value inputs stops propagation (doesn't close panel)
- [ ] Scroll position preserved across panel re-infers
- [ ] Copy output consistent between Cmd+C and Footer button
- [ ] Sections animate open/close (~150ms)
- [ ] Slider thumbs are custom-styled (indigo circle)
- [ ] SelectRow navigable via arrow keys + Escape
- [ ] Color picker closeable via Escape
- [ ] Panel fades in on mount
- [ ] "Copied!" toast on Cmd+C
- [ ] Shadow/transform rows have reorder buttons
- [ ] Key ARIA attributes present on interactive elements
- [ ] Shared utilities deduplicated into colorUtils.ts / cssUtils.ts
- [ ] 30+ new unit tests for overlay code
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all existing + new tests)

## Implementation Strategy

**Tier 1** items are sequential (dependency chain: 4A dedup → 1A color → 1B shadow color → 1C units → 1D/1E/1F small fixes).

**Tier 2** items are fully parallelizable — each touches a different file/component with no overlap.

**Tier 3** items depend on Tier 1 being complete (color pipeline must work before adding modes/swatches).

**Tier 4** should bookend the work: 4A (dedup) first to reduce conflict surface, 4B (tests) last to lock in behavior.
