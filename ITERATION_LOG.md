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

### Iteration 18 — Custom scrollbar (Webflow-style auto-hide) (2026-03-11)
- Added scoped `<style>` tag with WebKit + Firefox scrollbar rules under `.__tuner-root`
- Scrollbar: 5px wide, fully transparent by default, fades to `rgba(255,255,255,0.15)` while scrolling or on hover
- Added `panelScrollRef` + scroll event listener that toggles `is-scrolling` class (800ms debounce)
- Extended rules to `.__tuner-root *` so inner scrollable containers (dropdowns, etc.) also get the thin auto-hide scrollbar
- Typecheck: PASS

### Iteration 19 — Code review bug fixes (2026-03-11)
- Removed dead "More" (`MoreHorizontal`) button on Typography Decor row (no `onClick` handler)
- Removed unused `MoreHorizontal` import from lucide-react
- Fixed `SizeInputCell` arrow key handlers: added `min`/`max` clamping to prevent values exceeding bounds
- Fixed `SizeInputCell` keyword trap: keyword text is now clickable to clear keyword and enter numeric editing
- Fixed `TypoValueCell` keyword trap: keyword text is now clickable to switch to editing mode
- Fixed `TypoValueCell` ArrowUp/ArrowDown: now updates `draft` state alongside `onChange` to prevent stale revert on blur
- Fixed missing `setTypoColumnGap` → uses existing `setColumnGap` (same CSS property)
- Removed phantom imports (`BG_CLIP_OPTIONS`, `USER_SELECT_OPTIONS`, `BACKFACE_OPTIONS`, `BOX_SIZING_OPTIONS`) that were never exported from `panelConstants.tsx`
- Typecheck: PASS

### Iteration 20 — Color picker HSB/RGB/Hex mode toggle (2026-03-11)
- Added `colorMode` state (`"hex" | "rgb" | "hsb"`) to `ColorPickerEnhanced`
- Clickable mode label cycles through modes (hex → hsb → rgb → hex)
- **Hex mode**: single text input for `#RRGGBB` (existing behavior)
- **RGB mode**: three inline inputs (R/G/B, 0–255) that update HSB state + canvas in real-time
- **HSB mode**: three inline inputs (H: 0–360°, S: 0–100%, B: 0–100%) for direct HSB editing
- Added `applyRgbChannel()` and `applyHsbChannel()` handlers with clamping
- Mode label shows hover highlight and "Click to switch color mode" tooltip
- Opacity display remains constant across all modes
- Typecheck: PASS

### Iteration 21 — Arrow key navigation + double-click select all (2026-03-11)
- **Arrow key navigation hardened** (items #29 + #30 from spec §13):
  - Added `isNavigableElement()` helper in `util.ts` — skips `<script>`, `<style>`, `<template>`, `<noscript>`, `<head>`, `<link>`, `<meta>`, `<base>`, `<title>`, tuner overlay elements, and `display:none` elements
  - ArrowDown now walks `nextElementSibling` to find first *visible* child (skips non-visual tags)
  - ArrowLeft/Right now walk siblings to skip non-visual elements
  - Moved `e.preventDefault()` after target validation — no longer consumes arrow keys when there's nowhere to navigate (preserves page scrolling)
- **Double-click select all** on value inputs:
  - Added shared `selectAllOnDoubleClick` handler exported from `controls.tsx`
  - Wired into: `ValueInput`, `EditableValue`, `TextRow`, `SizeInputCell`, `TypoValueCell`, `SpacingValuePopover` input
  - Native double-click selects only a "word" (stops at `.` or `-`); this override selects the full value for quick replacement
- Typecheck: PASS

### Iteration 22 — Panel Polish Phase (2026-03-11)

**Bug fixes:**
- **1C Unit detection**: Replaced all 20 `useState("px")` calls with `detectUnit()` which walks `document.styleSheets` to find the authored CSS unit (em, rem, %, vw, etc.). Added `extractUnit()` to `cssParsers.ts` with 11 tests.
- **1E Scroll preservation**: Wrapped `setPanelKey` to save `scrollTop` before remount, restore after via `useEffect`. Panel no longer jumps to top after undo/redo/save/paste.
- **1F Copy format unification**: Extracted `formatCSSDiff()` to `util.ts`. All 3 copy paths (Cmd+C, Footer Copy, Session Copy All) now produce identical output with selector and `/* was */` comments.
- **1B ShadowEditor color**: Replaced native `<input type="color">` with `ColorPickerEnhanced` popover (HSB canvas, opacity support).

**Polish:**
- **Section collapse animation**: CSS Grid `0fr/1fr` transition (150ms ease) replaces instant show/hide. Chevron rotates with toggle. Added `aria-expanded`.
- **Panel entrance animation**: 150ms fade+slide CSS keyframe animation on mount.

**Tests:**
- Added 33 tests for `apply.ts` (undo/redo, batch, diff, clipboard, strip/restore) using happy-dom environment.
- Total: 162 tests passing across 5 files.
- Typecheck: PASS

### Iteration 23 — Color picker swatches/saved colors system (2026-03-11)
- Added swatches section to `ColorPickerEnhanced` below the mode inputs (spec §12)
- Swatches persist via `localStorage` under `__tuner-color-swatches` key (max 16 colors)
- "+" button saves current color to swatches (prepends, deduplicates, caps at 16)
- Click swatch → applies that color to picker and emits change
- Right-click swatch → removes it from the saved list
- Active swatch highlighted with thicker white border
- Empty state shows italic hint: "Click + to save colors"
- Hover effect: scale(1.1) + brighter border for visual feedback
- Fixed pre-existing typecheck errors: added missing `ms` import from `timing.ts` to `controls.tsx` and `ViewportBar.tsx`
- Typecheck: PASS

### Iteration 24 — Font family: searchable dropdown with font preview (2026-03-11)
- Added `searchable` and `fontPreview` optional props to `SelectRow` in `controls.tsx`
- When `searchable` is true and dropdown is open, a sticky search input appears at the top
- Options are filtered in real-time by case-insensitive substring match
- "No matches" empty state when filter yields zero results
- Search input auto-focuses on open, clears on close
- ArrowUp/ArrowDown in search input delegates to list keyboard navigation, Enter selects
- When `fontPreview` is true, each option label renders in its own font-face
- The trigger button also renders in the selected font (font preview in collapsed state)
- Dropdown height increased to 240px when searchable (vs 180px default) for more visible results
- Wired `searchable fontPreview` onto the Typography font-family `SelectRow` in `WebflowPanel.tsx`
- Fixed pre-existing typecheck error: added missing `timing` import to `SessionDrawer.tsx`
- Typecheck: PASS

---

### Iteration 25 — Scroll-wheel-to-adjust on numeric inputs (2026-03-11)
- Created `useWheelAdjust` hook (`src/overlay/useWheelAdjust.ts`) — attaches a non-passive native wheel listener that increments/decrements the value when the element has focus
- Uses a ref-based pattern to avoid re-attaching the listener on every render
- Modifier keys match arrow-key convention: Shift=10×, Alt=0.1×, default=base step
- Wired into `ValueInput` (controls.tsx) — ref on the `<input>`, always active
- Wired into `SizeInputCell` (SizeInputCell.tsx) — ref on container div, disabled in keyword mode
- Wired into `TypoValueCell` (layoutControls.tsx) — ref on container div, disabled in keyword mode
- Typecheck: PASS

---

### Iteration 26 — Typography advanced: word-spacing + hyphens (2026-03-11)
- Added `HYPHENS_OPTIONS` constant (`panelConstants.tsx`): none, manual, auto
- Added `wordSpacing` state (parsed from `cs.wordSpacing`) and `hyphens` state (from `cs.hyphens`)
- Added `handleWordSpacingChange` → `apply("word-spacing", ...)` and `handleHyphensChange` → `apply("hyphens", ...)`
- Rendered `word-spacing` as a `TypoValueCell` with 0.5px step, "Normal" keyword at 0
- Rendered `hyphens` as a `MiniDropdown` with none/manual/auto options
- Both placed in the advanced typography sub-section between the letter-spacing/text-indent/columns row and the Italicize/Capitalize/Direction row
- Typecheck: PASS

---

### Iteration 27 — Typography advanced: column-gap (2026-03-11)
- Added `column-gap` TypoValueCell to typography advanced section, paired with existing `column-count`
- Reuses existing `columnGap` state and `handleColumnGapChange` handler from layout section
- Split the old 3-cell row (letter-spacing + text-indent + columns) into two rows for better spacing:
  - Row 1: Letter spacing + Text indent
  - Row 2: Columns + Column gap
- "Normal" keyword shown when gap is 0, 1px step
- Fills spec §7 line 411 gap — column-gap is now accessible for multi-column text (`display: block` + `column-count`)
- Typecheck: PASS

---

### Iteration 28 — StyleIndicator on section headers (2026-03-11)
- Added optional `indicator` prop to `Section` component (controls.tsx)
- Renders a `StyleIndicator` dot next to the section title when any property in that section has a non-"none" indicator
- Added `sectionInd()` helper in WebflowPanel that takes an array of CSS property names and returns the highest-priority indicator type (element > direct > state > inherited > none)
- Wired into all 8 sections: Layout, Spacing, Size, Position, Typography, Backgrounds, Borders, Effects
- Each section checks its representative properties — e.g., Typography checks font-family, font-weight, font-size, line-height, letter-spacing, color, text-align, text-decoration, text-transform
- Fills spec §2 "Inheritance indicator colors on section labels" requirement
- Typecheck: PASS

---

### Iteration 29 — Background image attachment control (2026-03-11)
- Added `attachment` field to `BackgroundLayer.image` interface (scroll/fixed/local)
- Added `ATTACHMENT_OPTIONS` constant and `Select` dropdown in expanded image layer controls
- Default value: `"scroll"` in `makeDefault()`
- Updated CSS generation in WebflowPanel: `background-attachment` applied as separate property when any layer uses non-scroll attachment
- Fills spec §8 line 483: `background-attachment` select with scroll/fixed options
- Typecheck: PASS

---

### Iteration 30 — Panel Polish Tier 2-3 Swarm (2026-03-11)
Implemented all remaining Tier 2-3 polish items via 6 parallel agents:
- **Phase 1 — Timing tokens**: Created `timing.ts` with 7 canonical tokens, replaced magic numbers in 26+ files
- **Phase 2 — Slider thumb styling**: Custom 12px indigo thumb with hover/active states in global `<style>` block
- **Phase 3 — Toast animation**: AnimatePresence enter/exit in Footer.tsx with monotonic key counter
- **Phase 4 — ARIA roles**: combobox/listbox on SelectRow, UnitSelector, MiniDropdown; radiogroup on IconButtonGroup, DisplayTabs; shared `useDropdownKeyboard` hook with type-ahead
- **Phase 5 — DnD settle**: Spring easing on shadow/transform reorder with rAF-separated settle state
- **Phase 6 — Color picker swatches**: Save/remove swatches (max 16), localStorage persistence
- **Review fixes**: Restored slider thumb CSS, MiniDropdown keyboard nav, AnimatePresence counter, DisplayTabs radiogroup, conditional column-gap
- 42 files changed, 663 insertions, 1615 deletions
- Typecheck: PASS, Tests: 176/176 PASS

---

### Iteration 31 — Grid AlignBox: justify-items / align-content (2026-03-11)
- Added `justifyItems` and `alignContent` state (read from `getComputedStyle`)
- Added `handleGridAlignChange` handler that applies `justify-items` and `align-content`
- Grid AlignBox now maps X-axis → `justify-items` and Y-axis → `align-content` (per spec §3 lines 174-175)
- Flex AlignBox unchanged — still maps to `justify-content`/`align-items`
- Added grid alignment properties to Layout section indicator
- Fills spec §3: "X axis maps to justify-items for grid, Y axis maps to align-content"
- Typecheck: PASS

---

### Iteration 32 — Effects section sub-headers + reorganization (2026-03-11)
- Added sub-section headers for Filter, Backdrop Filter, Cursor, and Interaction
- Moved Perspective and Backface Visibility from bottom of section into the Transform sub-section (per spec §10 lines 601-602)
- Effects section now matches spec §10 layout: Opacity → Blend → Box Shadow → Transform (with perspective/backface) → Transition → Filter → Backdrop Filter → Cursor → Interaction
- Typecheck: PASS

---

### Iteration 33 — Wire background-blend-mode CSS application (2026-03-11)
- The per-layer `blendMode` field already existed in `BackgroundLayer` data model and the UI dropdown in `BackgroundLayerList.tsx`
- However, it was never applied as actual `background-blend-mode` CSS — the value was silently discarded during CSS generation
- Added `blendModes[]` collector in `handleBgLayersChange` (parallel to existing `attachments[]` pattern)
- Collects blend mode from each gradient/image layer during the CSS generation loop
- Applies `background-blend-mode` as comma-separated list when any layer uses non-"normal" blend
- Clears property when all layers are "normal" or no layers exist
- Added `background-blend-mode` to Backgrounds section indicator property list
- Fills spec §8 line 485: `background-blend-mode` select with full blend mode list
- Typecheck: PASS

---

### Iteration 34 — Text-decoration multi-select (spec §7 line 401) (2026-03-11)
- Spec §7 says text-decoration "Can combine multiple" (e.g., underline + line-through simultaneously)
- The `IconButtonGroup` already supported `multi` mode, but text-decoration was not using it
- Added `multi` prop to text-decoration `IconButtonGroup` in WebflowPanel.tsx
- Fixed multi-mode "none" handling in `IconButtonGroup`: clicking "none" now clears all other values; clicking a real value removes "none" from the active set
- CSS `text-decoration-line` natively accepts combined values like `"underline line-through"`, so no handler changes needed
- Initialization already reads `cs.textDecorationLine` which returns space-separated combined values
- Typecheck: PASS

---

### Iteration 35 — Z-index "auto" keyword toggle (spec §6 line 339) (2026-03-11)
- Spec §6 lists z-index values as `auto`, `-1` → `9999`, but the panel only had a numeric SliderRow
- `parseInt("auto") || 0` was silently losing the auto keyword during initialization
- Added `zIndexAuto` boolean state, initialized from `cs.zIndex === "auto"`
- Added `handleZIndexAutoToggle` that switches between `z-index: auto` and numeric value
- Replaced bare SliderRow with a row containing: label (with StyleIndicator), "auto" pill toggle, and conditionally visible SliderRow
- Auto pill styled with indigo highlight when active (matching existing keyword pill pattern)
- Reset handler now restores to auto state
- Numeric changes automatically clear auto mode
- Typecheck: PASS

---

### Iteration 36 — Background image custom size W/H inputs (spec §8 line 480) (2026-03-11)
- Spec §8 says `background-size` supports `custom [w] [h]` but the "custom" dropdown option emitted the literal string "custom" as CSS — which is invalid
- Split `SIZE_KEYWORDS` (`auto`, `cover`, `contain`) from `SIZE_OPTIONS` for proper display mapping
- Dropdown now shows "custom" when the current size isn't a keyword (e.g., "200px 100px" → "custom")
- Selecting "custom" initializes to `"100% auto"` as a sensible default
- Added inline W/H text inputs below the size dropdown when custom is active
- Inputs parse the current size into two parts and compose `"W H"` on change
- Supports any CSS length unit (px, %, em, etc.) — user types directly
- Typecheck: PASS

---

### Iteration 37 — Background image custom position X/Y inputs (spec §8 line 481) (2026-03-11)
- Spec §8 says `background-position` supports presets + custom X/Y, but the dropdown only had keyword presets
- Added "custom" option to `POSITION_OPTIONS` (split `POSITION_KEYWORDS` for display mapping, same pattern as background-size)
- Dropdown shows "custom" when position is a non-keyword value (e.g., "50% 20px")
- Selecting "custom" initializes to `"50% 50%"` (equivalent to `center`)
- Added inline X/Y text inputs below the position dropdown when custom is active
- Inputs parse current position into two space-separated parts and compose `"X Y"` on change
- Supports any CSS position value (px, %, em, keywords like `left 10px`)
- Typecheck: PASS

---

### Iteration 38 — CSS Variables / Custom Properties panel (2026-03-11)
- Created `CSSVariablesSection.tsx` — new "CSS Variables" section in the panel
- Discovery: walks `document.styleSheets` for `:root`/`html` rules and rules matching the element, checks inline styles, walks ancestor inline styles
- Each variable classified by source: "Element" (set on element), "Inherited" (from ancestor), "Root" (from :root)
- Type detection: regex-based classification of values as color (hex/rgb/hsl/named), length (number+unit), number, or string
- Color-type variables show an inline color swatch (16×16 rounded square)
- Editing: text input commits on blur/Enter via `applyCustomProperty()` from apply.ts (existing undo system)
- Groups displayed with sub-headers showing count: "Element (3)", "Inherited (5)", "Root (12)"
- StyleIndicator dots show dirty state (element dot) vs source (direct/inherited/none)
- Empty state: "No custom properties" italic hint when no variables found
- Integrated into WebflowPanel.tsx after Effects section
- Typecheck: PASS, Tests: 176/176 PASS

---

### Iteration 39 — Visual Grid Overlay (2026-03-11)
- Created `GridOverlay.tsx` — renders semi-transparent grid visualization over CSS Grid containers
- Only activates when selected element has `display: grid` or `display: inline-grid`
- Parses `getComputedStyle().gridTemplateColumns/Rows` for resolved pixel track sizes
- Calculates grid line positions accounting for `column-gap`, `row-gap`, padding, and border
- Visual elements: dashed grid lines (indigo), gap bands (subtle fill), column/row number labels, container outline
- Positioning: `getBoundingClientRect()` + `requestAnimationFrame` loop + `ResizeObserver` for real-time sync
- Added toggle button ("Show/Hide") with Grid3x3 icon in the Layout section's grid controls
- Grid overlay state managed in Overlay.tsx, resets on new element selection
- `refreshKey` prop triggers recalculation when grid properties change in the panel
- All overlay elements have `pointer-events: none` for click-through
- Typecheck: PASS, Tests: 176/176 PASS

---

### Task 1 — isConnected guard in applyInlineStyle (2026-03-11)
- Added `if (!(el as HTMLElement).isConnected) return;` at the top of `applyInlineStyle()` in `apply.ts`
- Prevents orphaned overrides when HMR disconnects elements mid-drag (old element removed from DOM while pointer events still fire)
- Without this guard, overrides get recorded for a disconnected element that can never be committed or reset
- Typecheck: PASS

---

## Done
