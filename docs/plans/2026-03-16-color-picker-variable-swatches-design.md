# Color Picker Variable Swatches — Design

## Problem
The VARIABLES section in ColorPickerEnhanced shows a flat grid of 22px color squares with no grouping. Clicking applies `var(--name)` correctly, but the layout doesn't communicate which variables exist or how they relate. Separate SWATCHES section saves raw hex values — redundant when variables are the primary workflow.

## Solution
Replace the flat swatch grid with a Figma-style grouped list. Remove the SWATCHES section entirely.

## Layout (top to bottom)
1. Color canvas (sat/brightness) — unchanged
2. Hue slider — unchanged
3. Opacity slider — unchanged
4. Hex/RGB/HSB inputs — unchanged
5. **VARIABLES section** — grouped list (this redesign)

## VARIABLES Section

### Header row
`Variables` label + eyedropper button + create variable (+) button. Unchanged from current.

### Grouped list
- Auto-group by variable name prefix using `inferSubgroups()` from `autoCollections.ts`
- Group header: slash-separated prefix path (e.g., `color/primary`)
- Row: 14px color circle + leaf name (prefix stripped)
- Active variable: blue text + `primaryAlpha(0.1)` background
- Max-height ~160px, overflow-y scroll
- Clicking a row applies `var(--variable-name)` — element stays bound

### Grouping examples
| Variable | Group header | Row label |
|---|---|---|
| `--color-primary-50` | color/primary | 50 |
| `--color-primary-100` | color/primary | 100 |
| `--bg-surface` | bg | surface |
| `--font-size-sm` | (not shown — not a color) | — |

### Create variable (+)
Unchanged. Opens inline form to name a new variable from the current picker color.

## Removed
- Entire SWATCHES section (saved hex colors)
- `useSwatches` hook import
- Flat 22px swatch grid

## Unchanged
- Picking a color from canvas/sliders/hex applies a raw color (no variable)
- Eyedropper samples colors from the page
- `onSelectVariable` callback wiring

## Files touched
- `src/overlay/controls/ColorPickerEnhanced.tsx` — replace swatch grid with grouped list, remove SWATCHES section
- No new files needed — reuses `inferSubgroups()` from `autoCollections.ts` and `ColorVariable` from `colorVariables.ts`
