# Implementation Plan: 2 New Features

## Feature 1: CSS Variables / Custom Properties Panel

### What
A new "Variables" section in WebflowPanel that discovers all CSS custom properties (`--*`) affecting the selected element, groups them by source, and allows live editing with type-aware controls (color swatches for colors, sliders for lengths, text inputs for others).

### Why
CSS custom properties are used extensively in modern frameworks (Tailwind v4, MUI, Radix, Chakra, shadcn/ui) and design systems. Currently, the panel can only edit individual CSS properties — it cannot see or modify the underlying variables that drive them. This is one of the biggest gaps vs. Chrome DevTools.

### Design
```
┌─ Variables ──────────────────────────┐
│                                       │
│  ── Element (3) ──                   │
│  --card-bg     [■ #1e293b]          │  ← color swatch
│  --card-radius [────●───] 8 [px ▾]  │  ← slider + unit
│  --card-pad    16px                  │  ← text input
│                                       │
│  ── Inherited (5) ──                 │
│  --primary     [■ #6366f1]          │
│  --font-sans   Inter, sans-serif    │
│  --radius-md   [────●───] 6 [px ▾]  │
│  --spacing-4   1rem                  │
│  --transition  150ms ease           │
│                                       │
│  [+ Add variable]                    │
└───────────────────────────────────────┘
```

### Implementation Steps

1. **Create `CSSVariablesSection.tsx`** — New component:
   - Scan `getComputedStyle(element)` for all `--*` properties
   - Walk `document.styleSheets` to find which rules define each variable and where
   - Classify each variable: "element" (set on this element or matched rule), "inherited" (from ancestor)
   - Detect value type: color (hex/rgb/hsl patterns), length (px/em/rem/%), number, or string
   - Render type-appropriate control: `ColorRow` for colors, `SliderRow` for lengths, `TextRow` for strings
   - On change, apply via `element.style.setProperty('--var-name', value)`
   - Wire into `apply.ts` undo system

2. **Integrate into `WebflowPanel.tsx`**:
   - Add Variables section after Effects (or as first section for prominence)
   - Pass element ref, wire change handlers through existing `applyInlineStyle` pattern
   - Add StyleIndicator for section header

3. **Variable discovery logic**:
   - `getComputedStyle` returns all custom properties on the element
   - Filter to only `--*` prefixed properties
   - Walk up the DOM to determine inheritance source
   - Group by: "element" (directly set), "inherited" (from ancestor), "root" (from :root)

### Files to Create/Modify
- **Create:** `src/overlay/CSSVariablesSection.tsx`
- **Modify:** `src/overlay/WebflowPanel.tsx` (add section)
- **Modify:** `src/overlay/apply.ts` (support custom property undo)

---

## Feature 2: Visual Grid Overlay

### What
When a grid container is selected, render a semi-transparent overlay directly on the page showing grid lines, column/row numbers, gap visualization, and grid area labels. The overlay updates in real-time as grid properties are edited in the panel.

### Why
Webflow's grid editor is one of its most distinctive features. Seeing the grid structure overlaid on the actual content makes editing dramatically more intuitive. Currently, grid editing in the panel is "blind" — you type `1fr 1fr 1fr` and hope it looks right.

### Design
```
┌──────────────────────────────────────────┐
│  1        2        3                      │  ← column numbers
│  ┌──────┬──────┬──────┐                  │
│  │      │      │      │ 1                │  ← row numbers
│  │  A   │  B   │  C   │                  │
│  │      │      │      │                  │
│  ├──────┼──────┼──────┤                  │
│  │      │      │      │ 2                │
│  │  D   │  E   │  F   │                  │
│  │      │      │      │                  │
│  └──────┴──────┴──────┘                  │
│                                           │
│  ─── = grid lines (dashed, semi-opaque)  │
│  gaps shown as highlighted bands          │
│  numbers in small labels at edges         │
└───────────────────────────────────────────┘
```

### Implementation Steps

1. **Create `GridOverlay.tsx`** — New component rendered in `Overlay.tsx`:
   - Takes the selected element as prop
   - Only renders when `display` is `grid` or `inline-grid`
   - Uses `getBoundingClientRect()` + computed grid properties to calculate line positions
   - Reads `grid-template-columns`, `grid-template-rows` from computed style
   - Parses track sizes via `getComputedStyle().gridTemplateColumns` (returns resolved px values)
   - Draws: dashed grid lines, gap bands (semi-transparent highlight), column/row number labels
   - Updates on scroll, resize, and panel property changes via `ResizeObserver` + `MutationObserver`

2. **Grid line calculation**:
   - `getComputedStyle(el).gridTemplateColumns` returns resolved values like `"200px 200px 200px"`
   - Parse into array of track sizes
   - Account for `column-gap` and `row-gap` between tracks
   - Position lines absolutely relative to the element's bounding rect
   - Handle scroll offset (element may be scrolled)

3. **Integrate into `Overlay.tsx`**:
   - Render `GridOverlay` when element is selected and is a grid container
   - Pass element ref and a refresh signal (triggers re-calc when grid props change in panel)
   - Toggle visibility with a small button in the Layout section header

4. **Visual treatment**:
   - Grid lines: `1px dashed rgba(99, 102, 241, 0.5)` (indigo, matching focus ring)
   - Gap areas: `rgba(99, 102, 241, 0.08)` fill
   - Column/row labels: small `10px` monospace labels at top/left edges
   - Container outline: `1px solid rgba(99, 102, 241, 0.3)`
   - All absolutely positioned, pointer-events: none (click-through)

### Files to Create/Modify
- **Create:** `src/overlay/GridOverlay.tsx`
- **Modify:** `src/overlay/Overlay.tsx` (render overlay when grid)
- **Modify:** `src/overlay/WebflowPanel.tsx` (toggle button in Layout section)

---

## Verification

After implementation:
1. `npm run typecheck` — must pass
2. `npm test` — must pass
3. Manual test: select a grid container → see overlay lines appear
4. Manual test: select any element → see Variables section with detected custom properties
5. Edit a variable → see live CSS update
6. Edit grid tracks → see overlay lines update in real-time
