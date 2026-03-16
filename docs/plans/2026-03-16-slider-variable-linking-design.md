# SliderRow Variable Linking — Design

## Problem
Colors link to CSS variables but numeric values (gap, font-size, opacity, border-radius, etc.) don't. Users who define spacing/sizing tokens have no way to apply them from the panel.

## Solution
Add variable linking to SliderRow, matching ColorRow's pattern exactly.

## Two Modes

### Numeric mode (default)
Current behavior: label, slider, value input, unit selector. Plus a new link icon at the end of the row.

### Variable mode
When a variable is linked, the slider + value input + unit selector are replaced with:
- Variable name in blue text (e.g., `spacing-4`), truncated with ellipsis
- Unlink icon (resolves back to numeric)
- x reset icon (when indicator is "modified")
- Tooltip shows full `--spacing-4` + resolved value

## New Props

```typescript
onSelectVariable?: (varExpr: string) => void
activeVariable?: string | null
```

- `activeVariable` set → renders variable mode
- `onSelectVariable` provided → shows link icon
- Same pattern as ColorRow

## Link Flow
1. User clicks link icon
2. VariablePicker opens, filtered to `type="length"`
3. User selects a variable
4. `onSelectVariable("var(--spacing-4)")` fires
5. Section calls `apply("gap", "var(--spacing-4)")`

## Unlink Flow
1. User clicks unlink icon
2. Resolved computed value is read from the element
3. `onChange(resolvedNumber)` fires, switching back to numeric mode

## Section Integration
Each section tracks whether value is `var()` or numeric. The `apply()` call accepts both — `style.setProperty` handles var() natively.

## Files
- `src/overlay/controls/SliderRow.tsx` — variable mode rendering + new props
- All sections using SliderRow: Layout, Effects, Size, Spacing, Typography, Borders

## Not in scope
- SelectRow/DropdownRow variable linking
- Creating new variables from slider
