# QA Checklist

Browser-based QA for the Redial panel. Each scope is tested in one `/qa` run.
Tests are performed on `http://localhost:3000/demo` with Chrome automation.

---

## Resets

Every control that accepts a value should support modifying AND resetting (Alt+click label).

### Layout Section
- [ ] DisplayTabs — select "flex", Alt+click label → resets to computed
- [ ] SegmentedControl (Direction) — select "column", Alt+click → resets
- [ ] AlignBox — click alignment cell, Alt+click "Align" label → resets justify+align
- [ ] SliderRow (Gap) — drag to new value, Alt+click label → resets to computed
- [ ] SelectRow (Align Self) — select value, Alt+click → resets (flex child context)

### Spacing Section
- [ ] SpacingBoxModel (margin) — set all 4 sides, Alt+click each → resets individually
- [ ] SpacingBoxModel (padding) — set all 4 sides, Alt+click each → resets individually

### Size Section
- [ ] SizeInputCell (Width) — type "200px", Alt+click → resets to auto
- [ ] SizeInputCell (Height) — type "100px", Alt+click → resets
- [ ] SizeInputCell (Min W / Max W) — type values, Alt+click → resets
- [ ] SizeInputCell (Min H / Max H) — type values, Alt+click → resets
- [ ] WebflowSegmentedControl (Overflow) — select "hidden", verify change applies

### Position Section
- [ ] PositionSelector — select "relative", Alt+click → resets to static
- [ ] PositionOffsetDiagram (Top/Left) — type offsets, Alt+click → resets
- [ ] Z-Index input — type value, Alt+click → resets to auto
- [ ] IconButtonGroup (Float) — select "left", Alt+click → resets
- [ ] IconButtonGroup (Clear) — select "both", Alt+click → resets

### Typography Section
- [ ] SelectRow (Font) — select font, Alt+click → resets
- [ ] SelectRow (Weight) — select weight, Alt+click → resets
- [ ] TypoValueCell (Size) — adjust, Alt+click label → resets
- [ ] TypoValueCell (Height) — adjust, Alt+click label → resets
- [ ] ColorRow (Color) — pick color, Alt+click → resets
- [ ] IconButtonGroup (Align) — select "center", Alt+click → resets
- [ ] IconButtonGroup (Decoration) — toggle underline, Alt+click → resets

### Backgrounds Section
- [ ] ColorRow (Color) — pick color, Alt+click → resets
- [ ] SelectRow (Clipping) — select "text", Alt+click → resets

### Borders Section
- [ ] Radius slider + ValueInput — adjust, Alt+click "Radius" label → resets all 4 corners
- [ ] IconButtonGroup (Style) — select "dashed", Alt+click label → resets
- [ ] ValueInput (Width) — adjust via LabelScrub, Alt+click → resets
- [ ] ColorRow (Border Color) — pick color, Alt+click → resets

### Effects Section
- [ ] SelectRow (Blending) — select mode, Alt+click → resets
- [ ] SliderRow (Opacity) — drag to 50%, Alt+click → resets to 100%
- [ ] IconButtonGroup (Outline) — select style, Alt+click → resets
- [ ] SelectRow (Cursor) — select "pointer", Alt+click → resets

### Footer & Global
- [ ] Footer Reset — make 3+ changes across sections, click Reset → all revert, change count shows 0
- [ ] Section collapse memory — collapse a section, select new element → section stays collapsed
- [ ] Scope pills — switch scope (element ↔ class), values update accordingly

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
- [ ] ResetPopover — visible on modified label click, not clipped by panel
- [ ] VariablePicker — scrollable list, no overflow outside panel
- [ ] Clipboard dropdown (Footer) — opens upward, not clipped at bottom

### Long Values
- [ ] Long font family name — no horizontal overflow in SelectRow
- [ ] Long CSS variable name — truncates with ellipsis, no layout break
- [ ] Large numeric values — SizeInputCell handles 4+ digit numbers
- [ ] Long class name in Header breadcrumb — truncates, doesn't overflow panel width

### Sub-editors
- [ ] ShadowEditor — 3+ shadows, list scrollable, no overflow
- [ ] TransformEditor — 3+ transforms, controls don't overflow
- [ ] TransitionEditor — 3+ transitions, list contained within panel

---

## Visual

Hover states, transitions, indicators, and alignment consistency.

### Hover States
- [ ] Section header hover — background highlight appears (collapsed state)
- [ ] SliderRow track — hover brightening works
- [ ] SelectRow trigger — hover feedback visible
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
- [ ] SliderRow: label, track, value input baseline-aligned
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
- [ ] ResetPopover → Escape → closes
- [ ] UnitSelector dropdown → Escape → closes
- [ ] Clipboard dropdown (Footer) → Escape → closes
- [ ] TransitionOptionsMenu → Escape → closes

### Focus Management
- [ ] Focus rings visible on all interactive elements (tuner-focusable class)
- [ ] No focus trap inside dropdowns (can Tab out)
- [ ] After dropdown closes, focus returns to trigger element

### ARIA
- [ ] SegmentedControl: role="radiogroup", children role="radio", aria-checked
- [ ] Section headers: aria-expanded reflects collapse state
- [ ] Toolbar buttons: aria-label and aria-pressed present
- [ ] Slider: aria-valuemin, aria-valuemax, aria-valuenow
- [ ] Footer status message: role="status", aria-live="polite"

---

## Issues Found & Fixed

(Entries added by /qa as it runs)

| Date | Scope | Issue | Fix | Commit |
|------|-------|-------|-----|--------|
