# Spacing Variable Linking — Design

> Add Webflow-style variable linking to the spacing box model (margin/padding).

## Flow

1. Click spacing value → SpacingValuePopover opens (existing: slider + presets)
2. Purple VariableLinkDot sits at top-right of the value input area
3. Click dot → popover expands downward with inline Connect panel:
   - Search field
   - Variables grouped by collection
   - Filtered to `type="length"` only
4. Click a variable → applies `var(--name)` to that spacing property, popover closes
5. When linked, box model diagram shows **variable name in purple** instead of number

## Components

### SpacingValuePopover.tsx (modify)
- Add VariableLinkDot next to value input
- Add expandable inline variable list below slider row (reuse VariablePicker content)
- New props: `element`, `activeVariable`, `onSelectVariable`, `onUnlink`
- When linked: slider row hidden, replaced with purple variable name + unlink button

### SpacingBoxModel.tsx (modify)
- Accept `cssVars` map: `Record<string, string | null>` (prop → variable name or null)
- `renderValue()`: when `cssVars[prop]` is set, show variable name in purple (theme `color.variable`) instead of numeric value
- Click linked value → opens popover in variable mode (shows variable name, allows switching/unlinking)
- Drag-to-scrub disabled when variable-linked (value comes from variable)

### SpacingSection.tsx (modify)
- Track per-property variable state: `Record<string, string | null>`
- Detect initial variable values from `getComputedStyle` / authored values
- Pass `cssVars` + handlers down to SpacingBoxModel
- On variable select: call `apply(prop, "var(--name)")`
- On unlink: resolve computed value, call `apply(prop, resolvedValue)`

## What stays the same
- Drag-to-scrub on non-linked values
- Preset grid in popover
- Unit selector
- Alt+click complementary/all-sides shortcuts
- VariableLinkDot component (reused)

## Scope exclusions
- CSS functions (calc/clamp/max/min) — deferred
- LabelScrub variable linking (border-width) — separate task
