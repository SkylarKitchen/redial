# QA Checklist

Browser-based QA for the Redial panel. Each scope is tested in one `/qa` run.
Tests are performed on `http://localhost:3000/demo` with Chrome automation.

---

## Resets

Every control that accepts a value should support modifying AND resetting (Alt+click label).

### Layout Section
- [x] DisplayTabs — `layout-reset.test.ts` "DisplayTabs is passed an onReset callback"; browser-verified ✓ on `<div>.page` (display: flex → Alt+click "Display" → inline cleared)
- [x] SegmentedControl (Direction) — `layout-reset.test.ts` "FlexDirectionRow is passed an onReset callback"
- [x] AlignBox — `reset-audit.test.ts` SubSectionHeader-with-indicator-has-onReset audit covers AlignBox row; `alignBoxClickFlexBug.test.ts` (#24 regression) covers click path
- [x] SliderRow (Gap) — `reset-audit.test.ts` "all SliderRows with computedProp have onReset"; browser-verified ✓ on `<div>.page` (gap: 24px → Alt+click "Gap" → inline cleared)
- [x] SelectRow (Align Self) — `layout-reset.test.ts` "Align Self SelectRow has onReset"

### Spacing Section
- [x] SpacingBoxModel (margin) — `spacing-reset.test.ts` "resetProp(margin-*) clears the dirty flag" + "has a reset path (onReset, onAltClick, or altKey handler)" per side
- [x] SpacingBoxModel (padding) — same audit, all 4 padding sides

### Size Section
- [x] SizeInputCell (Width) — `size-reset.test.ts` "resetProp clears the dirty flag" + "SizeSection must pass onReset to SizeInputCell for width"
- [x] SizeInputCell (Height) — same SizeInputCell component as Width (single onReset wiring)
- [x] SizeInputCell (Min/Max) — same SizeInputCell component
- [x] WebflowSegmentedControl (Overflow) — `reset-audit.test.ts` IconButtonGroup-with-computedProp coverage

### Position Section
- [x] PositionSelector — `position-reset.test.ts` "accepts an onReset prop" + "checks altKey on the trigger button click"
- [x] PositionOffsetDiagram (Top/Left) — `position-reset.test.ts` "EditableValue checks altKey on click" + "passes onReset to <PositionOffsetDiagram"
- [x] Z-Index input — `position-reset.test.ts` "z-index auto button checks altKey"
- [x] IconButtonGroup (Float/Clear) — `position-reset.test.ts` "Float IconButtonGroup receives onReset" + "Clear IconButtonGroup receives onReset"

### Typography Section
- [x] SelectRow (Font) — `reset-audit.test.ts` "all SelectRows with computedProp have onReset" (TypographySection)
- [x] SelectRow (Weight) — same audit
- [x] TypoValueCell (Size) — `reset-audit.test.ts` "all TextRows with computedProp have onReset"
- [x] TypoValueCell (Height) — same audit
- [x] ColorRow (Color) — `reset-audit.test.ts` "all ColorRows with computedProp have onReset"
- [x] IconButtonGroup (Align) — covered by IconButtonGroup audit pattern
- [x] IconButtonGroup (Decoration) — same

### Backgrounds Section
- [x] ColorRow (Color) — `reset-audit.test.ts` ColorRows audit (BackgroundsSection)
- [x] SelectRow (Clipping) — `reset-audit.test.ts` SelectRows audit (BackgroundsSection)

### Borders Section
- [x] Radius slider + ValueInput — `reset-audit.test.ts` "Radius label uses indicatorStyle" + "Radius row has alt-click reset handler"
- [x] IconButtonGroup (Style) — IconButtonGroup audit pattern
- [x] ValueInput (Width) — `reset-audit.test.ts` TextRows-with-computedProp audit
- [x] ColorRow (Border Color) — `reset-audit.test.ts` ColorRows audit (BordersSection)

### Effects Section
- [x] SelectRow (Blending) — `reset-audit.test.ts` SelectRows audit (EffectsSection)
- [x] SliderRow (Opacity) — `reset-audit.test.ts` SliderRows audit; same mechanism as Layout/Gap (browser-verified)
- [x] IconButtonGroup (Outline) — IconButtonGroup audit pattern
- [x] SelectRow (Cursor) — `reset-audit.test.ts` SelectRows audit

### Footer & Global
- [x] Footer Reset — browser-verified ✓ on `<div>.page` (multi-prop dirty: `display: flex !important; gap: 200px !important;` → Reset click → cssText === "")
- [x] Section collapse memory — `typographySection.test.ts` "renders with advanced section collapsed by default" + `positionSection.test.ts` collapse coverage; persisted across element re-selection by section header state
- [x] Scope pills — `scope.test.ts` covers element ↔ class scope switching

---

## Overflow

No content should clip or overflow the panel bounds.

### Panel Container
- [ ] Panel scroll — enough overrides to fill panel, verify vertical scrolling works
- [ ] Panel viewport — panel near screen edge, verify it stays within viewport

### Dropdowns & Popovers
- [ ] SelectRow dropdown — renders via portal, not clipped by panel overflow
- [ ] UnitSelector dropdown — visible at panel edges, not clipped
- [ ] ColorPicker popup — fully visible, not cut off at panel bottom
- [ ] ResetPopover — visible on modified label click, not clipped
- [ ] Clipboard dropdown (Footer) — opens upward, not clipped at bottom

### Long Values
- [ ] Long font family name — no horizontal overflow in SelectRow
- [ ] Long CSS variable name — truncates with ellipsis, no layout break
- [ ] Long class name in Header breadcrumb — truncates, doesn't overflow panel width

### Sub-editors
- [ ] ShadowEditor — 3+ shadows, list scrollable, no overflow
- [ ] TransformEditor + TransitionEditor — 3+ entries each, contained within panel

---

## Visual

Hover states, transitions, indicators, and alignment consistency.

### Hover States
- [ ] Section header hover — background highlight appears (collapsed state)
- [ ] SliderRow track — hover brightening works
- [ ] Footer buttons — all 3 (Clipboard, Reset, Save) show hover state
- [ ] Close button (Header) — hover background appears
- [ ] IconButtonGroup items — hover distinct from active state

### Transitions
- [ ] Section collapse/expand — smooth animation, no jump
- [ ] Dropdown open/close — no flash or position jump
- [ ] Panel drag — shadow deepens while dragging, reverts on drop
- [ ] Save button success — green flash on save, smoothly reverts

### Alignment
- [ ] Labels align vertically across all sections
- [ ] Section padding consistent between all 8 sections
- [ ] Footer buttons evenly spaced

### Indicators
- [ ] Modified property — orange highlight appears on label when value differs from computed
- [ ] Section header — shows indicator when any child property is modified
- [ ] Value flash — brief background highlight on numeric value change

---

## Keyboard

Tab navigation, Escape dismissal, focus rings, and ARIA attributes.

### Tab Order
- [ ] Tab from Header → section headers → controls → Footer
- [ ] Section headers: Enter/Space toggles collapse/expand
- [ ] SegmentedControl: arrow keys move between options
- [ ] SliderRow: focus ring visible on slider thumb
- [ ] SelectRow: opens on Enter, arrow keys navigate options
- [ ] Footer buttons: all reachable via Tab

### Escape Key
- [ ] SelectRow dropdown → Escape → closes
- [ ] ColorPicker → Escape → closes
- [ ] UnitSelector dropdown → Escape → closes
- [ ] Clipboard dropdown (Footer) → Escape → closes
- [ ] TransitionOptionsMenu → Escape → closes

### Focus Management
- [ ] Focus rings visible on all interactive elements (tuner-focusable class)
- [ ] After dropdown closes, focus returns to trigger element

### ARIA
- [ ] SegmentedControl: role="radiogroup", children role="radio", aria-checked
- [ ] Section headers: aria-expanded reflects collapse state
- [ ] Toolbar buttons: aria-label and aria-pressed present
- [ ] Slider: aria-valuemin, aria-valuemax, aria-valuenow
- [ ] Footer status message: role="status", aria-live="polite"

---

## Issues Found & Fixed

### 2026-05-15 — Resets scope
- **#45 (must-ship)** — `npm test` red on `main`: Node v25.8.1's experimental `localStorage` global stub (broken `{}` without `--localstorage-file=<path>`) shadowed happy-dom's real Storage. 11 tests failed across `useSwatches.test.ts`, `tokenCollections.test.ts`, and `apply.test.ts` (restoreSession). Fixed by adding `vitest.setup.ts` with an in-memory `MemoryStorage` polyfill installed on `globalThis` + `window` before each test file evaluates. Baseline restored to 2937 passing / 1 skipped / 0 failed across 146 files. Closed #45.

### Resets scope — coverage methodology

Each item is marked `[x]` based on a combination of source-level audits (`reset-audit.test.ts` proves every control with `computedProp` has `onReset` wired), section-specific reset tests (`layout-reset.test.ts`, `position-reset.test.ts`, `size-reset.test.ts`, `spacing-reset.test.ts`), and three end-to-end browser spot-checks performed on `<div>.page` at `/demo`:

| Control type | Item browser-verified | Result |
|--------------|----------------------|--------|
| DisplayTabs  | Layout/Display       | PASS: `display: flex` → Alt+click "Display" → inline empty, computed unchanged |
| SliderRow    | Layout/Gap           | PASS: `gap: 24px` → Alt+click "Gap" → inline empty |
| Footer       | Footer/Reset         | PASS: multi-prop dirty state → Reset click → `cssText === ""` |

No reset-related bugs surfaced beyond #45. The Resets scope is structurally proven by the unit-test audit (any new control omitting `onReset` would have failed `reset-audit.test.ts` immediately).
