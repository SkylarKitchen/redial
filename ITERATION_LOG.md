# Redial — Iteration Log

Tracks progress through the Webflow UI spec implementation. Each entry records what was done in a single iteration.

---

## Completed

### Iteration 1 — LabelScrub + UnitSelector in SliderRow (2026-03-11)
- Wrapped SliderRow label text with `<LabelScrub>` so every numeric slider label is now drag-to-scrub
- Added optional `units` and `onUnitChange` props to SliderRow for UnitSelector dropdown
- When `units` is provided, renders `<UnitSelector>` instead of a static unit label
- Typecheck: PASS

### Iteration 2 — UnitSelector wired into Size + Position sections (2026-03-11)
- Added per-property unit state: `widthUnit`, `heightUnit`, `minWidthUnit`, `maxWidthUnit`, `minHeightUnit`, `maxHeightUnit`, `topUnit`, `rightUnit`, `bottomUnit`, `leftUnit`
- All Size sliders now show UnitSelector dropdown (px, %, vw/vh, em, rem, ch)
- All Position offset sliders now show UnitSelector dropdown (px, %, vw, vh)
- Handlers compose value + unit dynamically (`${v}${unit}`)
- Added `SIZE_UNITS_W`, `SIZE_UNITS_H`, `POSITION_UNITS`, `TYPO_SIZE_UNITS` constants
- Typecheck: PASS

### Iteration 3 — Typography units + Grid track editors (2026-03-11)
- Added `fontSizeUnit`, `letterSpacingUnit` state to Typography section
- Font-size and letter-spacing sliders now show UnitSelector (px/em/rem)
- Added `TextRow` component for text input fields
- Added `gridCols`, `gridRows` state + handlers for grid track definitions
- Grid section now shows Columns and Rows text inputs above AlignBox
- Typecheck: PASS

### Iteration 4 — Position float/clear + Header StateSelector (2026-03-11)
- Added `float_` and `clear_` state + handlers to Position section with FLOAT_OPTIONS, CLEAR_OPTIONS
- Float/Clear dropdowns always visible in Position section (not gated by static)
- Wired StateSelector into Header.tsx (optional `state`/`onStateChange` props)
- Added `activeState` state in Overlay.tsx, passed to Header
- StateSelector shows green text when non-base state is active
- Typecheck: PASS

### Iteration 5 — Flex-direction toggle buttons (2026-03-11)
- Replaced `FLEX_DIRECTION_OPTIONS` (SelectRow dropdown) with `FLEX_DIRECTION_ICONS` (IconButtonGroup)
- Added arrow SVG icons for all 4 directions: row (→), column (↓), row-reverse (←), column-reverse (↑)
- Layout section now shows 4 toggle buttons instead of a dropdown for flex-direction
- Handler guards against deselecting to "none" — falls back to "row"
- Matches existing IconButtonGroup pattern from Typography (text-align, decoration, transform)
- Typecheck: PASS

### Iteration 6 — Flex child order control (2026-03-11)
- Added `flexOrder` state initialized from `cs.order`
- Added `handleFlexOrderChange` handler applying `order` CSS property
- Added SliderRow for Order (range -10 to 100, step 1) in Flex Child sub-section
- Placed after Align Self dropdown, matching the spec's property table order
- Typecheck: PASS

### Iteration 7 — Typography advanced collapsed sub-section (2026-03-11)
- Added collapsible "Advanced" sub-section with disclosure triangle (▶/▼) inside Typography
- Added state for: `wordSpacing`, `whiteSpace`, `textIndent`, `wordBreak`, `columnCount`, `showTypoAdvanced`
- Added `WHITE_SPACE_OPTIONS` (6 values) and `WORD_BREAK_OPTIONS` (4 values) constants
- Controls: word-spacing slider (0–20px), white-space dropdown, text-indent slider (0–100px), word-break dropdown, column-count slider (1–6)
- Sub-section starts collapsed by default, separated by a thin border-top
- Typecheck: PASS

### Iteration 8 — Parallel agent batch: 6 tasks (2026-03-11)
- Alt+Arrow fine-grained steps (0.1) in ValueInput with `e.stopPropagation()`
- Size keyword toggles: auto/none pills on width/height/maxWidth/maxHeight, aspect-ratio TextRow, object-fit/position for media
- Position visual offset diagram (`PositionOffsetDiagram.tsx`) replacing 4 individual SliderRows
- Font-family dropdown with page font detection via `document.fonts.ready`
- Spacing color zones: warm orange margins, cool blue padding, alt+click for both-sides
- Keyboard shortcuts: S (scope), R (reset), Cmd+S (save), Cmd+C (copy CSS) in Overlay.tsx
- StyleIndicator pink dots on all key property rows (inline override detection)
- Typecheck: PASS

### Iteration 9 — Tab/Shift+Tab focus rings (2026-03-11)
- Added `FOCUS_RING` constant (`0 0 0 2px rgba(99,102,241,0.3)`) and `onFocusRing`/`onBlurRing` helpers in controls.tsx
- Section headers: `tabIndex={0}`, `role="button"`, Enter/Space keyboard toggle
- ValueInput + TextRow: `boxShadow` focus ring via existing `focused` state
- SliderRow range input: `onFocus`/`onBlur` direct style manipulation
- SelectRow button: focus ring on keyboard focus
- EditableValue span: `tabIndex={0}`, Enter to start editing, focus ring
- IconButtonGroup buttons: focus ring, `outline: none`
- AlignBox cells: `tabIndex={0}`, `role="button"`, Enter/Space to click, focus ring
- Typecheck: PASS

### Iteration 10 — Review fixes: CSS focus ring + DisplayTabs polish (2026-03-11)
- Replaced all DOM mutation focus ring handlers (`onFocusRing`/`onBlurRing`) with single CSS `<style>` tag using `:focus-visible`
- Injected in Overlay.tsx: `.__tuner-root *:focus-visible { box-shadow: 0 0 0 2px rgba(99,102,241,0.3); }`
- Removed ~30 lines of scattered `onFocus`/`onBlur` handlers across controls.tsx, AlignBox.tsx, IconButtonGroup.tsx, WebflowPanel.tsx
- Removed unused `inputRef` in EditableValue (dead code from SpacingBoxModel extraction)
- Simplified DisplayTabs capitalize: CSS `textTransform: "capitalize"` handles it, removed redundant JS
- Added Escape key handler to DisplayTabs dropdown (close on Escape)
- Changed DisplayTabs dropdown items from `<div>` to `<button>` (accessibility)
- SpacingBoxModel + CornerRadiusEditor: unit support wired in by background agents
- Typecheck: PASS

### Iteration 11 — Unit conversion wired into all unit selectors (2026-03-11)
- Created `unitConversion.ts` with `buildConversionContext()` and `convertUnit()` (px as pivot)
- Supports px↔em, px↔rem, px↔%, px↔vw/vh conversions using element/parent/viewport dimensions
- Wired `convertUnit()` into all 17 `onUnitChange` handlers across Size, Layout, Typography, Borders
- Line-height conversion guards against "—" (auto) unit
- Max-width/max-height handle 0 → "none" edge case
- Fixed `WebflowPanelProps.onSpacingChange` signature to include unit parameter
- Added missing unit/units/onUnitChange props to CornerRadiusEditor JSX
- Removed broken `hooks/` directory (orphaned from partial Phase 0 extraction)
- Typecheck: PASS, Tests: 24/24 PASS

### Iteration 12 — Complete unit selector JSX wiring (2026-03-11)
- Wired remaining SliderRow `unit`/`units`/`onUnitChange` props for: word-spacing, text-indent, border-width, line-height
- Line-height now has dynamic min/max/step based on unit ("—": 0.8–3, px: 8–200, %: 80–300)
- Confirmed zero hardcoded `unit="px"` remaining (all length controls use state-driven units)
- Typecheck: PASS, Tests: 24/24 PASS

### Iteration 13 — Swarm merge: 10 parallel agents (2026-03-11)
Merged outputs from 10 parallel worktree agents into WebflowPanel.tsx:
- **Tab navigation**: `:focus-visible` CSS injection + `tuner-focusable` className on all interactive controls
- **Gap lock**: locked/unlocked row-gap/column-gap pattern in grid section with sync toggle buttons
- **Size enhancements**: per-axis overflow lock, box-sizing toggle, collapsible "More size options"
- **Effects**: user-select, perspective (0-2000px), backface-visibility controls
- **Typography**: hyphens, direction, column-gap, text-shadow (reusing ShadowEditor)
- **Background-clip**: border-box/padding-box/content-box/text with webkit compat
- **StyleIndicator**: enhanced getIndicatorType with INHERITABLE_PROPERTIES + parent comparison
- **Color picker**: standalone `ColorPickerEnhanced.tsx` (HSB 2D canvas, hue/opacity sliders)
- **Bezier editor**: standalone `BezierEditor.tsx` (cubic-bezier canvas, presets, animation preview)
- **apply.ts**: added `captureInitials()` for batched property reads
- Replaced all `getIndicatorType(element, ...)` calls with `ind(...)` shorthand
- Typecheck: PASS

### Iteration 14 — ColorPickerEnhanced wired into ColorRow (2026-03-11)
- Replaced native `<input type="color">` in `ColorRow` with `ColorPickerEnhanced` popover
- Swatch click toggles HSB color picker (2D canvas, hue slider, opacity slider, hex input)
- Keyboard accessible: Enter/Space to toggle, click-outside to dismiss
- Import added to `controls.tsx` (where `ColorRow` now lives after extraction)
- Removed stale `ColorPickerEnhanced` import from `WebflowPanel.tsx`
- Typecheck: PASS

### Iteration 15 — BezierEditor wired into TransitionEditor (2026-03-11)
- Replaced 4 raw numeric `BezierInput` fields with full visual `BezierEditor` component
- Custom cubic-bezier easing now shows: draggable 200x200 canvas, preset buttons, animation preview
- Simplified `handleBezierChange` from per-index to single tuple callback
- Removed dead `BezierInput` component (~75 lines)
- Kept `BezierPreview` (small 40x40 non-interactive canvas) next to easing dropdown
- Typecheck: PASS, Tests: 24/24 PASS

### Iteration 16 — Redo support (Cmd+Shift+Z) (2026-03-11)
- Added `redoStack` in `apply.ts` alongside existing `undoStack`
- `undo()` now captures forward state onto `redoStack` before restoring
- Added `redo()` function: pops from `redoStack`, re-applies the change, pushes undo entry
- Both single and batch entries fully supported in redo
- New actions (`applyInlineStyle`) clear `redoStack` (standard undo/redo invalidation)
- `reset()` and `resetAll()` clear both stacks
- Wired `Cmd+Shift+Z` / `Ctrl+Shift+Z` in `Overlay.tsx` (checks shift before the undo handler)
- Typecheck: PASS, Tests: 24/24 PASS

### Iteration 17 — GradientEditor wired into Backgrounds section (2026-03-11)
- Replaced static gradient preview bar in `BackgroundLayerList` with full inline `GradientEditor`
- Gradient layers now show: type selector (linear/radial/conic), angle slider, draggable stop bar, per-stop color + position controls
- `GradientEditor.onChange` routes through `updateLayer()` to update the layer's gradient data and trigger CSS re-apply
- Removed unused `onEditGradient` prop from `BackgroundLayerListProps` (editor is now inline, no external callback needed)
- Typecheck: PASS, Tests: 24/24 PASS

---

## Done
