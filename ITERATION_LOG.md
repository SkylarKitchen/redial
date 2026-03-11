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

---

## Next Up

**Phase B-10:** Position visual offset diagram
