# Mode Cell VariableField Redesign

## Problem

Mode value cells in the Variables panel don't match the style panel's variable-linked UX. The style panel shows a purple pill (`VariableField`) when a value references a CSS variable. Mode cells currently show raw `var(--name)` text with an inline `VariableLinkDot` — visually broken and inconsistent.

## Design

### Linked state: reuse VariableField

When a mode cell value is a `var()` reference (`parseVarRef(value)` returns non-null), render `<VariableField>` as the entire cell content. The cell becomes a purple pill identical to what SliderRow/SizeInputCell/ColorRow show.

**VariableField provides:**
- Purple pill (variableAlpha bg/border, color.variable text)
- Click pill → VariablePicker (switch variable or unlink)
- Hover → pencil icon → EditVariablePopover
- Unlink resolves var to computed value via `getComputedStyle`

**Remove from linked path:**
- VariableLinkDot (not needed — pill IS the linked affordance)
- Manual color swatch dot
- Manual VariableValue text
- Manual ColorPickerEnhanced portal

### Unlinked state: VariableLinkDot at corner

When a mode cell has a raw value or is empty, show `VariableLinkDot` at the top-left corner (absolute positioned, default mode — not `inline`).

**Keep for unlinked cells:**
- VariableLinkDot at top-left corner (position: absolute, top: -7, left: -7)
- Color swatch dot + VariableValue for raw values
- `+` / `–` for empty cells
- Inline text editing on click
- ColorPickerEnhanced for color-type raw values

**Clipping fix:** Add `padding-top: 8px` to variable rows and `overflow-y: visible` on the mode scroll container so the dot's negative offset isn't clipped.

### Panel auto-fit width

Remove horizontal scrolling. The panel expands to fit all mode columns.

- Each mode column: `flex: 1` with `minWidth: 120px` (not fixed `flex: 0 0 132px`)
- `panelWidth.ts` formula ensures panel is wide enough: `max(580, min(BASE + modes * PER_MODE, floor(vw * 0.8)))`
- PER_MODE stays at 136 (enough for VariableField pill + padding)
- No `overflowX: auto` on mode containers — columns flex to fill

### Files changed

| File | Change |
|------|--------|
| `CollectionDetail.tsx` | ModeValueCell: render VariableField when linked, VariableLinkDot (absolute) when not. Remove inline dot mode. Fix row padding for dot clipping. Mode cells flex: 1 + minWidth. |
| `CollectionDetail.tsx` | Column headers: match flex: 1 + minWidth pattern |
| `CollectionDetail.tsx` | Mode scroll container: remove overflowX: auto |
| `panelWidth.ts` | Verify formula fits all columns without scroll |

### Not changed

- `VariableField.tsx` — reused as-is
- `VariableLinkDot.tsx` — `inline` prop stays (used elsewhere potentially), but mode cells revert to default absolute positioning
- `VariablePicker.tsx` — reused as-is via VariableField
