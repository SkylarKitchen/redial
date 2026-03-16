# Dynamic Variables Panel Width

## Problem

Panel width is hardcoded to 580px. Mode columns overflow when >2 modes exist (e.g., BASE + DARK + DARK SYSTEM). The "DARK (SYST..." header and values get clipped.

## Design

### Width Formula

```
BASE = 380px  (sidebar 170 + icon 14 + name 130 + actions 40 + gaps ~26)
PER_MODE = 140px
panelWidth = max(580, min(BASE + modes * PER_MODE, viewportWidth * 0.8))
```

| Modes | Computed | Capped (1440px screen) |
|-------|----------|------------------------|
| 1     | 580 (min floor) | 580 |
| 2     | 660 | 660 |
| 3     | 800 | 800 |
| 5     | 1080 | 1080 |
| 7     | 1360 | 1152 (80vw) |

### Scroll Behavior

When width hits the 80vw cap, mode columns scroll horizontally. Name column + icon stay pinned left (frozen-column pattern, like Figma).

Layout per row:
```
[icon + name (fixed ~144px)] | [mode cells (overflow-x: auto, synced scroll)]
```

Scroll sync: shared `scrollLeft` ref. One `onScroll` handler on any scrollable container propagates to header + all rows.

### Width Source

New pure function:
```ts
function getVariablesPanelWidth(modeCount: number): number
```

Called in all 4 places in Overlay.tsx that currently hardcode `580`:
- Line 944: `PANEL_WIDTH` for drag snapping
- Line 1166: resize handler
- Line 1182: panel type switch repositioning
- Line 1648: inline `style.width`

Mode count flows from `GlobalVariablesPanel` to `Overlay.tsx` via callback prop.

### Frozen Column Implementation

CollectionDetail column headers:
```
[icon spacer + name (fixed)] [mode headers container (overflow-x: auto)]
```

DetailVariableRow:
```
[icon + name cell (fixed)] [mode value cells container (overflow-x: auto, scroll-synced)]
```

Scroll containers share a ref; `onScroll` on any one sets `scrollLeft` on all others.
