# Webflow Designer Style Panel — UI Spec for Redial

> A section-by-section specification for recreating the Webflow Designer's CSS style panel as a Redial overlay. Each section is self-contained and can be implemented as a single iteration.

---

## Table of Contents

1. [Panel Shell & Chrome](#1-panel-shell--chrome)
2. [Selector & Class Manager](#2-selector--class-manager)
3. [Layout Section (Display)](#3-layout-section-display)
4. [Spacing Section (Box Model)](#4-spacing-section-box-model)
5. [Size Section](#5-size-section)
6. [Position Section](#6-position-section)
7. [Typography Section](#7-typography-section)
8. [Backgrounds Section](#8-backgrounds-section)
9. [Borders Section](#9-borders-section)
10. [Effects Section](#10-effects-section)
11. [Style Indicators (Inheritance Colors)](#11-style-indicators-inheritance-colors)
12. [Input Controls & Units](#12-input-controls--units)
13. [Keyboard & Interaction Patterns](#13-keyboard--interaction-patterns)

---

## 1. Panel Shell & Chrome

### Visual Structure
```
┌──────────────────────────────────────┐
│  Selector / Class Manager (top)      │  ← sticky header
├──────────────────────────────────────┤
│  Layout                              │  ← collapsible sections
│  Spacing                             │
│  Size                                │
│  Position                            │
│  Typography                          │
│  Backgrounds                         │
│  Borders                             │
│  Effects                             │
├──────────────────────────────────────┤
│  Footer (actions)                    │  ← sticky footer
└──────────────────────────────────────┘
```

### Spec
- **Width:** 300px fixed (Webflow uses ~280–300px)
- **Background:** `#1e1e1e` (dark charcoal), `backdrop-filter: blur(20px)`
- **Border radius:** 10px
- **Border:** `1px solid rgba(255,255,255,0.1)`
- **Shadow:** `0 8px 32px rgba(0,0,0,0.5)`
- **Max height:** 85vh, `overflow-y: auto`, thin custom scrollbar
- **Font stack:** `system-ui, -apple-system, 'SF Pro Display', sans-serif`
- **Monospace font:** `ui-monospace, 'SF Mono', monospace` (for values)
- **Section separator:** `1px solid rgba(255,255,255,0.06)` between each section
- **Each section** has a header row: label (13px, weight 500, `rgba(255,255,255,0.85)`) + optional expand/collapse chevron

### Redial Integration
- Already exists as `Overlay.tsx` panel container
- Section collapse state: use DialKit `_collapsed` flag or custom state per section

---

## 2. Selector & Class Manager

### Webflow Behavior
The top of the Style panel shows the currently selected element and its class chain. This is the most important piece — it determines **what you're styling**.

### Visual Layout
```
┌──────────────────────────────────────┐
│  Inheritance: Body > Section > Div   │  ← breadcrumb (ancestors)
├──────────────────────────────────────┤
│  Selector: ┌─────────────────────┐   │
│            │ .hero-heading       │   │  ← class input / tag display
│            └─────────────────────┘   │
│  Scope: ⬤ element  ○ .class        │  ← scope toggle pills
├──────────────────────────────────────┤
│  States: None ▾  (hover, focus...)  │  ← pseudo-class selector
└──────────────────────────────────────┘
```

### Properties & Controls

| Element | Control Type | Details |
|---------|-------------|---------|
| Breadcrumb | Clickable chain | `body › section › div.hero › h2` — click any ancestor to select it |
| Selector field | Text display / input | Shows current class name (e.g., `.hero-heading`). In Webflow this is an input for adding/removing classes. For Redial: display only, showing CSS-module class |
| Scope pills | Toggle buttons | `element` (default) / `.className` — matches existing Redial Header scope pills |
| States dropdown | Select dropdown | `None`, `Hover`, `Focus`, `Active`, `Visited`, `Focus-within`, `Focus-visible` |
| Source file | Text label | `components/Hero.tsx:42` — click to open in editor |

### Style Indicator Colors
- **Blue pill/dot** next to selector: styles applied directly to this class
- **Orange pill/dot**: inherited styles from parent or base class
- **Green pill**: state-specific styles (hover, focus, etc.)
- **Pink pill**: element-level styles (not saved to a class)

### Redial Mapping
- **Existing:** `Header.tsx` has breadcrumb, scope pills, source file
- **Add:** States dropdown (affects which pseudo-class CSS targets)
- **Add:** Inheritance indicator colors on section labels

---

## 3. Layout Section (Display)

### Webflow Behavior
Always visible. Shows display type selector. Reveals flex/grid sub-controls contextually.

### Visual Layout
```
┌─ Layout ──────────────────────────────┐
│                                        │
│  Display:  [Block ▾]  ← dropdown      │
│            or icon buttons:            │
│            ☐ Block  ⬛ Flex  ▦ Grid   │
│            ↕ Inline variants in ▾     │
│                                        │
│  ── Flex controls (if display=flex) ── │
│                                        │
│  Direction: [→ Row] [↓ Col]  ← toggle │
│                                        │
│  Align:    ┌───┬───┬───┐              │
│            │ ↖ │ ↑ │ ↗ │              │
│            ├───┼───┼───┤   ← 3×3 grid │
│            │ ← │ ● │ → │              │
│            ├───┼───┼───┤              │
│            │ ↙ │ ↓ │ ↘ │              │
│            └───┴───┴───┘              │
│                                        │
│  Wrap:     [No Wrap ▾]                │
│  Gap:      [─────●────] 16 px         │
│                                        │
│  ── Grid controls (if display=grid) ── │
│                                        │
│  Columns:  [1fr 1fr 1fr]  Edit ▾     │
│  Rows:     [auto]         Edit ▾     │
│  Gap:      [─────●────] 16 px         │
│  Align:    (3×3 grid, same as flex)   │
│                                        │
│  ── Flex child (if parent is flex) ─── │
│                                        │
│  Sizing:   [Shrink ▾]                 │
│  Grow:     [─────●────] 0             │
│  Shrink:   [─────●────] 1             │
│  Basis:    [─────●────] auto          │
│  Order:    [─────●────] 0             │
│  Align Self: [Auto ▾]                │
└────────────────────────────────────────┘
```

### Properties

| Property | Control | Values | Webflow UI |
|----------|---------|--------|------------|
| `display` | Select dropdown | `block`, `flex`, `inline-flex`, `grid`, `inline-grid`, `inline-block`, `inline`, `none` | Primary display selector with icon buttons for common types + dropdown for inline variants |
| `flex-direction` | Toggle buttons (2) | `row`, `column`, `row-reverse`, `column-reverse` | Two primary buttons (Row/Col) with reverse variants in sub-menu |
| `justify-content` | 3×3 align box (X axis) | `flex-start`, `center`, `flex-end`, `space-between`, `space-around`, `space-evenly` | Visual grid, highlight active cell |
| `align-items` | 3×3 align box (Y axis) | `stretch`, `flex-start`, `center`, `flex-end`, `baseline` | Visual grid, highlight active cell |
| `flex-wrap` | Select dropdown | `nowrap`, `wrap`, `wrap-reverse` | Dropdown |
| `gap` | Slider + input | `0` → `200px` | Linear slider with number input + unit selector |
| `row-gap` | Slider + input | `0` → `200px` | Separate from column-gap when unlocked |
| `column-gap` | Slider + input | `0` → `200px` | Separate from row-gap when unlocked |
| `grid-template-columns` | Text input | e.g., `1fr 1fr 1fr` | Editable track definition |
| `grid-template-rows` | Text input | e.g., `auto auto` | Editable track definition |
| `flex-grow` | Slider | `0` → `10` | Shown for flex children |
| `flex-shrink` | Slider | `0` → `10` | Shown for flex children |
| `flex-basis` | Slider + input | `auto`, `0` → `1200px` | With unit selector |
| `order` | Number input | `-10` → `100` | Simple number input |
| `align-self` | Select | `auto`, `flex-start`, `center`, `flex-end`, `stretch`, `baseline` | Dropdown |

### 3×3 Alignment Box Component (New)
This is the most distinctive Webflow control. It's a 3×3 grid of clickable cells where:
- **X axis** maps to `justify-content` (or `justify-items` for grid)
- **Y axis** maps to `align-items` (or `align-content`)
- Active cell is highlighted
- Each cell shows a small icon depicting alignment (dots clustered to that corner/edge)
- Clicking a cell sets both `justify-content` and `align-items` simultaneously

```
Implementation: custom React component
Props: justifyContent, alignItems, onChange(justify, align)
Visual: 9 cells, 32×32px each, border between cells, active = filled blue
```

### Redial Mapping
- **Existing:** `infer.ts` generates layout config with display, flex-direction, justify-content, align-items, flex-wrap, gap
- **Add:** 3×3 AlignBox component (custom, not DialKit)
- **Add:** Flex child controls (grow, shrink, basis, order, align-self)
- **Add:** Grid track editors (template-columns, template-rows)
- **Add:** Direction toggle buttons (replace dropdown for flex-direction)

---

## 4. Spacing Section (Box Model)

### Webflow Behavior
Visual nested-rectangle box model. Click any value to edit. Drag to adjust. Always visible.

### Visual Layout
```
┌─ Spacing ─────────────────────────────┐
│                                        │
│  ┌─── MARGIN ──────────────────────┐  │
│  │           [16]                    │  │  ← margin-top (click-to-edit)
│  │  [0] ┌─ PADDING ──────┐  [0]    │  │  ← margin-left, margin-right
│  │      │       [24]      │         │  │  ← padding-top
│  │      │ [12] ████ [12]  │         │  │  ← padding-left, content, padding-right
│  │      │       [24]      │         │  │  ← padding-bottom
│  │      └─────────────────┘         │  │
│  │           [16]                    │  │  ← margin-bottom
│  └──────────────────────────────────┘  │
│                                        │
│  ⟳ Reset spacing                       │
└────────────────────────────────────────┘
```

### Properties

| Property | Control | Range | Interactions |
|----------|---------|-------|-------------|
| `margin-top` | Editable value | `-200` → `200px` | Click to edit, arrow keys ±1, shift+arrow ±10, drag to scrub |
| `margin-right` | Editable value | `-200` → `200px` | Same |
| `margin-bottom` | Editable value | `-200` → `200px` | Same |
| `margin-left` | Editable value | `-200` → `200px` | Same |
| `padding-top` | Editable value | `0` → `200px` | Same (no negative for padding) |
| `padding-right` | Editable value | `0` → `200px` | Same |
| `padding-bottom` | Editable value | `0` → `200px` | Same |
| `padding-left` | Editable value | `0` → `200px` | Same |

### Interactions
- **Click value:** enters edit mode (input replaces text)
- **Arrow Up/Down:** increment/decrement by 1px (or 10 with Shift)
- **Alt+click side label:** applies value to both complementary sides (left+right or top+bottom)
- **Alt+click corner:** applies value to all 4 sides
- **Hover:** highlight the corresponding side of the box model diagram
- **Tab:** moves between values in order (top → right → bottom → left)

### Webflow Colors
- Margin area: slightly transparent warm tone
- Padding area: slightly transparent cool tone
- Content center: solid darker rectangle

### Redial Mapping
- **Existing:** `SpacingBoxModel.tsx` with `EditableValue` components
- **Enhance:** Add drag-to-scrub on values (mousedown + mousemove changes value)
- **Enhance:** Add complementary-side and all-sides shortcuts
- **Enhance:** Add color differentiation between margin/padding zones
- **Enhance:** Add hover highlighting for sides

---

## 5. Size Section

### Webflow Behavior
Controls element dimensions. Always visible. Shows min/max constraints.

### Visual Layout
```
┌─ Size ────────────────────────────────┐
│                                        │
│  Width     [─────●────] [auto] [px ▾] │
│  Height    [─────●────] [auto] [px ▾] │
│                                        │
│  Min W     [─────●────] [0]    [px ▾] │
│  Max W     [─────●────] [none] [px ▾] │
│  Min H     [─────●────] [0]    [px ▾] │
│  Max H     [─────●────] [none] [px ▾] │
│                                        │
│  Overflow  [Visible ▾]                │
│  (if media element:)                  │
│  Fit       [Cover ▾]                  │
└────────────────────────────────────────┘
```

### Properties

| Property | Control | Values | Unit Options |
|----------|---------|--------|-------------|
| `width` | Slider + input | `auto`, `0` → `1920` | `px`, `%`, `vw`, `em`, `rem`, `ch` |
| `height` | Slider + input | `auto`, `0` → `1200` | `px`, `%`, `vh`, `em`, `rem` |
| `min-width` | Slider + input | `0` → `1920` | `px`, `%`, `vw` |
| `max-width` | Slider + input | `none`, `0` → `1920` | `px`, `%`, `vw` |
| `min-height` | Slider + input | `0` → `1200` | `px`, `%`, `vh` |
| `max-height` | Slider + input | `none`, `0` → `1200` | `px`, `%`, `vh` |
| `overflow` | Select dropdown | `visible`, `hidden`, `scroll`, `auto` | — |
| `overflow-x` | Select dropdown | `visible`, `hidden`, `scroll`, `auto` | Shown when overflow unlocked per-axis |
| `overflow-y` | Select dropdown | `visible`, `hidden`, `scroll`, `auto` | Shown when overflow unlocked per-axis |
| `object-fit` | Select dropdown | `fill`, `contain`, `cover`, `none`, `scale-down` | Only for `img`, `video`, `canvas` |
| `object-position` | Text input / visual picker | e.g., `center`, `top left` | Only for media elements |
| `aspect-ratio` | Text input | e.g., `16 / 9`, `auto` | Only when explicitly set |

### Redial Mapping
- **Existing:** `infer.ts` generates size config with width, height, min/max, overflow, object-fit
- **Add:** Unit selector dropdown on each numeric input (currently all values are px)
- **Add:** `auto` and `none` as special keyword values
- **Add:** `object-position` for media elements
- **Add:** `aspect-ratio` control

---

## 6. Position Section

### Webflow Behavior
Collapsed when `position: static`. Expands to show offset controls when non-static.

### Visual Layout
```
┌─ Position ────────────────────────────┐
│                                        │
│  Position  [Static ▾]                 │
│                                        │
│  (if not static:)                     │
│                                        │
│  ┌───────────────────────┐            │
│  │        [top: 0]       │            │
│  │  [l: 0] ┌────┐ [r: 0]│  ← visual  │
│  │         │    │        │    offset   │
│  │        [bottom: 0]    │    diagram  │
│  └───────────────────────┘            │
│                                        │
│  Z-Index   [─────●────] [auto]        │
│                                        │
│  (if sticky/fixed:)                   │
│  Float     [None ▾]                   │
│  Clear     [None ▾]                   │
└────────────────────────────────────────┘
```

### Properties

| Property | Control | Values |
|----------|---------|--------|
| `position` | Select dropdown | `static`, `relative`, `absolute`, `fixed`, `sticky` |
| `top` | Input + slider | `auto`, `-200` → `200px` (or `%`, `vh`) |
| `right` | Input + slider | `auto`, `-200` → `200px` |
| `bottom` | Input + slider | `auto`, `-200` → `200px` |
| `left` | Input + slider | `auto`, `-200` → `200px` |
| `z-index` | Number input | `auto`, `-1` → `9999` |
| `float` | Select | `none`, `left`, `right` |
| `clear` | Select | `none`, `left`, `right`, `both` |

### Visual Offset Diagram
Similar to spacing box model but for position offsets. A small rectangle with clickable values on each side representing top/right/bottom/left. Only shown when position ≠ static.

### Redial Mapping
- **Existing:** `infer.ts` generates position config, collapsed when static
- **Add:** Visual offset diagram component (similar to SpacingBoxModel)
- **Add:** `float` and `clear` controls
- **Add:** Unit selector on offset values

---

## 7. Typography Section

### Webflow Behavior
Only visible for text-bearing elements. The richest section with many control types.

### Visual Layout
```
┌─ Typography ──────────────────────────┐
│                                        │
│  Font      [Inter ▾]        ← dropdown│
│  Weight    [Regular ▾] / [400 ▾]      │
│  Size      [─────●────] [16] [px ▾]  │
│  Height    [─────●────] [1.5] [─ ▾]  │  ← line-height (unitless default)
│  Spacing   [─────●────] [0]  [px ▾]  │  ← letter-spacing
│  Color     [■ #1a1a1a] ← swatch+hex  │
│                                        │
│  ── Alignment ──                       │
│  [⫷] [⫸] [≡] [⫹]    ← L/C/R/Justify│
│                                        │
│  ── Decoration ──                      │
│  [U̲] [S̶] [TT] [Tt] [tt]             │
│  underline / strike / upper / cap / lo│
│                                        │
│  ── Advanced (collapsed) ──            │
│  Word Spacing  [─────●────] [0]       │
│  White Space   [Normal ▾]             │
│  Text Indent   [─────●────] [0]       │
│  Word Break    [Normal ▾]             │
│  Hyphens       [Manual ▾]             │
│  Direction     [LTR ▾]               │
│  Columns       [─────●────] [1]       │
│  Column Gap    [─────●────] [0]       │
│  Text Shadow   [+ Add shadow]        │
└────────────────────────────────────────┘
```

### Properties

| Property | Control | Values | Notes |
|----------|---------|--------|-------|
| `font-family` | Dropdown / text | System fonts + Google Fonts | Searchable dropdown in Webflow |
| `font-weight` | Dropdown | `100`–`900` with labels (Thin, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black) | Labels depend on font family |
| `font-size` | Slider + input | `8` → `200px` | Unit selector: px, em, rem, vw, % |
| `line-height` | Slider + input | `0.8` → `3.0` (unitless) or `px` | Default unitless (multiplier). Toggle `-` for unitless |
| `letter-spacing` | Slider + input | `-5` → `20px` | Can also use `em` |
| `color` | Color swatch + picker | Hex, RGB, HSB | Click swatch to open full color picker |
| `text-align` | Icon button group (4) | `left`, `center`, `right`, `justify` | Mutually exclusive radio-style buttons |
| `text-decoration` | Icon button group | `none`, `underline`, `overline`, `line-through` | Can combine multiple |
| `text-transform` | Icon button group | `none`, `uppercase`, `capitalize`, `lowercase` | Mutually exclusive |
| `font-style` | Toggle | `normal` / `italic` | Icon button (I) |
| `word-spacing` | Slider + input | `0` → `20px` | Advanced section |
| `white-space` | Dropdown | `normal`, `nowrap`, `pre`, `pre-wrap`, `pre-line`, `break-spaces` | Advanced |
| `text-indent` | Slider + input | `0` → `100px` | Advanced |
| `word-break` | Dropdown | `normal`, `break-all`, `keep-all`, `break-word` | Advanced |
| `hyphens` | Dropdown | `none`, `manual`, `auto` | Advanced |
| `direction` | Dropdown | `ltr`, `rtl` | Advanced |
| `column-count` | Number input | `1` → `6` | Multi-column text |
| `column-gap` | Slider + input | `0` → `100px` | Multi-column gap |
| `text-shadow` | Shadow editor | X, Y, blur, color | "+ Add" button, multiple shadows |

### Icon Button Group Component (New)
Webflow uses icon-based toggle/radio groups for text-align, text-decoration, text-transform:
```
┌────┬────┬────┬────┐
│ ⫷  │ ≡  │ ⫸  │ ⫹  │  ← text-align icons
└────┴────┴────┴────┘
Active button: filled bg + blue border
Inactive: transparent bg
```

### Redial Mapping
- **Existing:** `infer.ts` generates typography config (font-size, font-weight, line-height, letter-spacing, color, font-family)
- **Add:** `text-align` icon button group
- **Add:** `text-decoration` icon button group
- **Add:** `text-transform` icon button group
- **Add:** `font-style` toggle
- **Add:** Advanced typography sub-section (collapsed)
- **Add:** Text shadow editor
- **Enhance:** Font family searchable dropdown (currently text input)
- **Enhance:** Font weight labeled dropdown (currently slider 100–900)

---

## 8. Backgrounds Section

### Webflow Behavior
Shows background layers. Each layer can be a color, gradient, or image. Multiple layers stack.

### Visual Layout
```
┌─ Backgrounds ─────────────────────────┐
│                                        │
│  [+ Add background]                   │
│                                        │
│  Layer 1: [■ #ffffff]  [Color ▾] [×]  │
│                                        │
│  (if color:)                          │
│  Color     [■ swatch] [#ffffff]       │
│  Opacity   [─────●────] [100%]        │
│                                        │
│  (if gradient:)                       │
│  Type      [Linear ▾] / [Radial ▾]   │
│  Angle     [─────●────] [180°]        │
│  Stops:    [●──────●──────●]          │
│            #f00     #00f    #0f0       │
│  [+ Add stop]                         │
│                                        │
│  (if image:)                          │
│  URL       [input or upload]          │
│  Size      [Cover ▾]                  │
│  Position  [Center ▾] / [x] [y]      │
│  Repeat    [No Repeat ▾]              │
│  Attachment [Scroll ▾]               │
│  Fixed     ☐                          │
│                                        │
│  Clip      [Border Box ▾]            │
│  Blend     [Normal ▾]                │
└────────────────────────────────────────┘
```

### Properties

| Property | Control | Values |
|----------|---------|--------|
| `background-color` | Color swatch + picker | Hex, RGB, HSB with opacity |
| `background-image` | URL input / gradient editor | `url()` or gradient |
| `background-size` | Select / inputs | `auto`, `cover`, `contain`, custom `[w] [h]` |
| `background-position` | Select / 2D picker | Presets: `center`, `top left`, etc. + custom X/Y |
| `background-repeat` | Select | `repeat`, `repeat-x`, `repeat-y`, `no-repeat` |
| `background-attachment` | Select | `scroll`, `fixed` |
| `background-clip` | Select | `border-box`, `padding-box`, `content-box`, `text` |
| `background-blend-mode` | Select | `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity` |

### Gradient Editor Sub-component
- Visual gradient bar with draggable color stops
- Click gradient bar to add a stop
- Each stop: color picker + percentage input
- Gradient type: `linear-gradient` / `radial-gradient` / `conic-gradient`
- Angle slider for linear (0°–360°)

### Redial Mapping
- **Existing:** `infer.ts` has basic `background-color` as a color config
- **Add:** Multi-layer background support (array of background layers)
- **Add:** Gradient editor component
- **Add:** Background image controls (size, position, repeat, attachment)
- **Add:** Clip and blend mode dropdowns
- **Add:** "+ Add background" button for stacking layers

---

## 9. Borders Section

### Webflow Behavior
Controls border style, width, color, and radius. Can style all sides or individual sides.

### Visual Layout
```
┌─ Borders ─────────────────────────────┐
│                                        │
│  ── Border ──                          │
│                                        │
│  ┌─────┬─────┬─────┬─────┬─────┐     │
│  │ All │ Top │ Rgt │ Btm │ Lft │     │  ← side selector tabs
│  └─────┴─────┴─────┴─────┴─────┘     │
│                                        │
│  Style    [Solid ▾]                   │
│  Width    [─────●────] [1]  [px ▾]   │
│  Color    [■ #e2e2e2]                 │
│                                        │
│  ── Radius ──                          │
│                                        │
│  ┌──────────────────────┐              │
│  │  [8]          [8]    │  ← TL / TR  │
│  │                      │              │
│  │  [8]          [8]    │  ← BL / BR  │
│  └──────────────────────┘              │
│                                        │
│  All      [─────●────] [8]  [px ▾]   │
│  🔗 Linked (toggle to edit corners    │
│     individually)                      │
└────────────────────────────────────────┘
```

### Properties

| Property | Control | Values |
|----------|---------|--------|
| `border-style` | Select | `none`, `solid`, `dashed`, `dotted`, `double`, `groove`, `ridge`, `inset`, `outset` |
| `border-width` | Slider + input | `0` → `20px` |
| `border-color` | Color swatch + picker | Hex, RGB with opacity |
| `border-top-style` | Select | Same as border-style (per-side) |
| `border-top-width` | Slider + input | `0` → `20px` (per-side) |
| `border-top-color` | Color swatch + picker | Per-side |
| `border-right-*` | Same | Per-side |
| `border-bottom-*` | Same | Per-side |
| `border-left-*` | Same | Per-side |
| `border-radius` | Slider + input | `0` → `500px` or `%` |
| `border-top-left-radius` | Input | `0` → `500px` (individual corner) |
| `border-top-right-radius` | Input | `0` → `500px` |
| `border-bottom-right-radius` | Input | `0` → `500px` |
| `border-bottom-left-radius` | Input | `0` → `500px` |

### Side Selector Tabs Component (New)
Tab bar with 5 options: All, Top, Right, Bottom, Left. When "All" is selected, changes apply to all sides. When a specific side is selected, shows controls only for that side.

### Radius Linked/Unlinked Toggle
- **Linked (default):** Single slider controls all 4 corners
- **Unlinked:** 4 individual inputs appear in a visual corner layout (TL, TR, BL, BR positioned like actual corners)

### Redial Mapping
- **Existing:** `infer.ts` has border-width, border-style, border-color, border-radius
- **Add:** Side selector tab component
- **Add:** Per-side border controls
- **Add:** Individual corner radius inputs
- **Add:** Linked/unlinked toggle for radius
- **Enhance:** Expand border-radius range to 500px

---

## 10. Effects Section

### Webflow Behavior
Contains shadows, opacity, blend modes, transforms, transitions, filters, backdrop filters, and cursor. Each sub-section is collapsible. Heavy use of "+ Add" buttons for stacking effects.

### Visual Layout
```
┌─ Effects ─────────────────────────────┐
│                                        │
│  ── Opacity ──                         │
│  Opacity   [─────●────] [100%]        │
│  Blend     [Normal ▾]                 │
│                                        │
│  ── Box Shadows ──                     │
│  [+ Add shadow]                       │
│  Shadow 1: [X:0] [Y:2] [B:4] [S:0]  │
│            [■ rgba(0,0,0,0.1)] [×]    │
│            Type: [Outer ▾]            │
│                                        │
│  ── Transforms ──                      │
│  [+ Add transform]                    │
│  ┌──────────────────────────────┐     │
│  │ Move  X [0]  Y [0]  Z [0]   │     │
│  │ Scale X [1]  Y [1]          │     │
│  │ Rotate  [0°]                │     │
│  │ Skew  X [0°] Y [0°]        │     │
│  └──────────────────────────────┘     │
│  Transform Origin: [Center ▾]        │
│  Perspective:      [─────●────]       │
│  Backface:         [Visible ▾]       │
│                                        │
│  ── Transitions ──                     │
│  [+ Add transition]                   │
│  Property  [all ▾]                    │
│  Duration  [─────●────] [300ms]       │
│  Easing    [ease ▾] / custom bezier  │
│  Delay     [─────●────] [0ms]        │
│                                        │
│  ── Filters ──                         │
│  [+ Add filter]                       │
│  Blur      [─────●────] [0px]        │
│  Brightness[─────●────] [100%]       │
│  Contrast  [─────●────] [100%]       │
│  Grayscale [─────●────] [0%]         │
│  Hue Rotate[─────●────] [0°]        │
│  Invert    [─────●────] [0%]         │
│  Saturate  [─────●────] [100%]       │
│  Sepia     [─────●────] [0%]         │
│                                        │
│  ── Backdrop Filters ──               │
│  [+ Add backdrop filter]             │
│  (same filter types as above)        │
│                                        │
│  ── Cursor ──                          │
│  Cursor    [Auto ▾]                   │
│                                        │
│  ── Interaction ──                     │
│  Pointer Events  [Auto ▾]            │
│  User Select     [Auto ▾]            │
│  Visibility      [Visible ▾]         │
└────────────────────────────────────────┘
```

### Properties

| Sub-section | Property | Control | Values |
|------------|----------|---------|--------|
| **Opacity** | `opacity` | Slider | `0` → `1` (displayed as 0%–100%) |
| **Blend** | `mix-blend-mode` | Select | `normal`, `multiply`, `screen`, `overlay`, etc. |
| **Shadows** | `box-shadow` | Multi-value editor | X offset, Y offset, blur, spread, color, inset toggle |
| **Transforms** | `transform: translate()` | 3 inputs | X, Y, Z in px |
| | `transform: scale()` | 2 inputs | X, Y as multipliers |
| | `transform: rotate()` | 1 input | Degrees (0°–360°) |
| | `transform: skew()` | 2 inputs | X°, Y° |
| | `transform-origin` | Select / 2D picker | `center`, `top left`, etc. + custom |
| | `perspective` | Slider + input | `0` → `2000px` |
| | `backface-visibility` | Select | `visible`, `hidden` |
| **Transitions** | `transition-property` | Select / text | `all`, specific properties |
| | `transition-duration` | Slider + input | `0` → `5000ms` |
| | `transition-timing-function` | Select / bezier | `ease`, `linear`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier()` |
| | `transition-delay` | Slider + input | `0` → `5000ms` |
| **Filters** | `filter: blur()` | Slider | `0` → `50px` |
| | `filter: brightness()` | Slider | `0%` → `200%` |
| | `filter: contrast()` | Slider | `0%` → `200%` |
| | `filter: grayscale()` | Slider | `0%` → `100%` |
| | `filter: hue-rotate()` | Slider | `0°` → `360°` |
| | `filter: invert()` | Slider | `0%` → `100%` |
| | `filter: saturate()` | Slider | `0%` → `200%` |
| | `filter: sepia()` | Slider | `0%` → `100%` |
| **Backdrop** | `backdrop-filter: blur()` | Slider | Same as filters |
| **Cursor** | `cursor` | Select | `auto`, `default`, `pointer`, `text`, `move`, `grab`, `grabbing`, `not-allowed`, `crosshair`, `help`, `wait`, `zoom-in`, `zoom-out`, `none` |
| **Interaction** | `pointer-events` | Select | `auto`, `none` |
| | `user-select` | Select | `auto`, `none`, `text`, `all` |
| | `visibility` | Select | `visible`, `hidden` |

### Shadow Editor Component (New)
Each shadow is a row with:
- **X offset:** number input (px)
- **Y offset:** number input (px)
- **Blur radius:** number input (px)
- **Spread radius:** number input (px)
- **Color:** swatch + picker (includes opacity)
- **Type toggle:** Outer / Inset
- **Delete button** (×)
- **Drag handle** for reordering
- Multiple shadows are displayed as a list

### Transform Editor Component (New)
Transform types are added via dropdown:
- `translate(X, Y, Z)` — 3 number inputs
- `scale(X, Y)` — 2 number inputs
- `rotate(angle)` — 1 angle input with degree unit
- `skew(X, Y)` — 2 angle inputs
- Each transform is a removable row
- Order matters (drag to reorder)

### Bezier Curve Editor (New)
For custom `transition-timing-function`:
- Visual cubic-bezier curve editor
- Draggable control points
- Presets: ease, ease-in, ease-out, ease-in-out, linear
- Real-time animation preview

### Redial Mapping
- **Existing:** `infer.ts` has opacity, visibility, pointer-events, cursor, spring transition
- **Add:** Box shadow editor (multi-shadow support)
- **Add:** Transform editor (translate, scale, rotate, skew)
- **Add:** Filter sliders (blur, brightness, contrast, etc.)
- **Add:** Backdrop filter sliders
- **Add:** Transition editor with bezier curve
- **Add:** Mix-blend-mode dropdown
- **Add:** User-select dropdown
- **Enhance:** Opacity slider display as percentage

---

## 11. Style Indicators (Inheritance Colors)

### Webflow Behavior
Colored dots/labels next to property names indicate the source of styling.

### Color System

| Color | Meaning | CSS Analogy | Visual |
|-------|---------|-------------|--------|
| **Blue** | Direct style on current class | `.hero-heading { color: blue; }` | Small blue dot left of property label |
| **Orange** | Inherited from parent/base class | Cascading from ancestor | Small orange dot left of property label |
| **Green** | State-specific style | `.hero-heading:hover { color: red; }` | Green dot, only when viewing a state |
| **Pink** | Element-level (not in a class) | Inline style equivalent | Pink dot |
| **No dot** | Using browser default | No custom style applied | No indicator |

### Implementation
Each property label in each section gets a small colored dot (4px circle) to its left:
```
● font-size    [16px]        ← blue dot = set on this class
● line-height  [1.5]         ← orange dot = inherited from parent
  letter-spacing [0]          ← no dot = browser default
```

### Redial Mapping
- **New system:** Add `StyleIndicator` component that wraps each property label
- **Detection:** Compare computed value to inherited value to determine source
- **For element scope:** All overrides show as pink
- **For class scope:** Overrides on this class show as blue, parent class as orange

---

## 12. Input Controls & Units

### Webflow Number Input Pattern
Every numeric input in Webflow follows this pattern:

```
┌─────────────────────────────────────┐
│  [Label]  [═══●═══] [value] [unit▾] │
└─────────────────────────────────────┘
```

Components:
1. **Label:** Property name (left-aligned, 13px, `rgba(255,255,255,0.7)`)
2. **Slider:** Linear track with draggable thumb
3. **Value input:** Editable number field (right of slider)
4. **Unit selector:** Dropdown for `px`, `%`, `em`, `rem`, `vw`, `vh`, etc.

### Unit Selector Component (New)

```
┌──────┐
│ px ▾ │
├──────┤
│  px  │
│  %   │
│  em  │
│  rem │
│  vw  │
│  vh  │
│  ch  │
│  —   │  ← unitless / auto
└──────┘
```

**Behavior:**
- Changing unit converts the value (e.g., `16px` → `1em` if root is 16px)
- Some properties only support certain units (opacity: unitless only)
- `—` represents auto/none/unitless depending on context

### Available Units by Property

| Context | Units |
|---------|-------|
| Font size | `px`, `em`, `rem`, `vw`, `%` |
| Width/Height | `px`, `%`, `vw`/`vh`, `em`, `rem`, `auto` |
| Spacing (margin/padding) | `px`, `%`, `em`, `rem`, `auto` (margin only) |
| Line height | unitless (multiplier), `px`, `em`, `%` |
| Letter spacing | `px`, `em` |
| Border radius | `px`, `%` |
| Border width | `px` |
| Position offsets | `px`, `%`, `vw`/`vh`, `auto` |
| Gap | `px`, `%`, `em`, `rem` |
| Filters | `px` (blur), `%` (others), `deg` (hue-rotate) |

### Color Picker Component

Webflow's color picker:
```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │    Saturation/Brightness  │  │  ← 2D picker area
│  │    gradient square        │  │
│  │           ●               │  │  ← draggable handle
│  │                           │  │
│  └───────────────────────────┘  │
│  [═══════●═══════════════════]  │  ← hue slider (0°–360°)
│  [═══════════════●═══════════]  │  ← opacity slider (0%–100%)
│                                  │
│  Mode: [HSB ▾] / [RGB] / [Hex] │
│  H [240] S [80] B [100]         │  ← value inputs
│  or: R [0] G [0] B [255]       │
│  or: [#0000ff]                  │
│                                  │
│  ── Swatches ──                  │
│  [■][■][■][■][■][■][■][■]      │  ← saved colors / variables
│  [+ Add to swatches]            │
└─────────────────────────────────┘
```

### Redial Mapping
- **Existing:** DialKit provides slider, color picker, select controls
- **Add:** Unit selector dropdown component (wrap DialKit inputs)
- **Enhance:** DialKit color picker with opacity slider and mode toggle
- **Add:** Color swatch/variable system

---

## 13. Keyboard & Interaction Patterns

### Global Shortcuts (Webflow-style)

| Key | Action | Context |
|-----|--------|---------|
| `` ` `` | Toggle selection mode | Global |
| `Esc` | Close panel / cancel selection | Panel open |
| `Cmd+Z` | Undo last change | Panel open |
| `Cmd+Shift+Z` | Redo | Panel open |
| `Arrow keys` | Navigate between sibling/parent/child elements | Panel open, no input focused |
| `Tab` | Move to next control | Within a section |
| `Shift+Tab` | Move to previous control | Within a section |
| `D` (hold) | Diff peek (strip overrides while held) | Panel open |
| `S` | Cycle scope | Panel open |
| `R` | Reset current element | Panel open |
| `Cmd+S` | Save to source | Panel open |
| `Cmd+C` | Copy CSS | Panel focused |

### Input Interactions

| Interaction | Behavior |
|------------|----------|
| Click value | Enter edit mode |
| Arrow Up | +1 step |
| Arrow Down | -1 step |
| Shift+Arrow Up | +10 steps |
| Shift+Arrow Down | -10 steps |
| Alt+Arrow Up | +0.1 step |
| Alt+Arrow Down | -0.1 step |
| Enter | Confirm edit |
| Escape | Cancel edit |
| Click+drag on label | Scrub value (Webflow signature interaction) |
| Double-click value | Select all text in input |

### Label-Drag Scrubbing (Webflow Signature)
This is the most distinctive Webflow interaction. Instead of using a slider, you can click and drag on the **property label** (e.g., the word "Width") and drag left/right to scrub the value up/down. The cursor changes to `ew-resize` on hover over labels.

```
Implementation:
- onMouseDown on label → capture startX and startValue
- onMouseMove → newValue = startValue + (e.clientX - startX) * step
- onMouseUp → commit value
- Shift held: 10x multiplier
- Alt held: 0.1x multiplier
```

### Redial Mapping
- **Existing:** Backtick toggle, Escape, Cmd+Z, arrow navigation, D for diff
- **Add:** Label-drag scrubbing on all numeric property labels
- **Add:** Alt+Arrow for fine-grained steps
- **Add:** Tab navigation between controls within sections

---

## Implementation Order (Loop Plan)

Each iteration produces a self-contained, testable improvement:

### Iteration 1: Unit Selector Component
Build the `UnitSelector` dropdown component. Wire it into existing Size and Spacing inputs. This unblocks accurate unit handling for all subsequent sections.

### Iteration 2: 3×3 Alignment Box
Build the `AlignBox` component. Replace the flex `justify-content` / `align-items` dropdowns in the Layout section with the visual 3×3 grid.

### Iteration 3: Typography Enhancements
Add `text-align` icon button group, `text-decoration` toggles, `text-transform` toggles, and `font-style` toggle. Add advanced typography sub-section.

### Iteration 4: Border Side Selector + Corner Radius
Add side selector tabs for borders. Add individual corner radius controls with linked/unlinked toggle.

### Iteration 5: Background Layers
Add multi-layer background support. Build gradient editor component. Add background image controls.

### Iteration 6: Shadow Editor
Build box-shadow multi-value editor. Add text-shadow controls to Typography section.

### Iteration 7: Transform Editor
Build transform type selector (translate, scale, rotate, skew). Add transform-origin visual picker.

### Iteration 8: Filter & Backdrop Filter Sliders
Add all filter type sliders. Add backdrop-filter section.

### Iteration 9: Transition Editor + Bezier Curve
Build transition property/duration/easing/delay editor. Build cubic-bezier visual editor.

### Iteration 10: Style Indicators
Implement the colored dot system for inheritance visualization (blue/orange/pink/green).

### Iteration 11: Label-Drag Scrubbing
Add the signature Webflow interaction: click+drag on property labels to scrub values.

### Iteration 12: States & Pseudo-classes
Add the States dropdown (hover, focus, active, etc.). Wire state-specific style application.

### Iteration 13: Polish Pass
Color picker enhancements (opacity slider, HSB/RGB/Hex modes). Swatch system. Flex child controls. Grid track editors. Position offset diagram.

---

## Appendix: Component Inventory

### New Components Needed

| Component | Type | Used In |
|-----------|------|---------|
| `AlignBox` | 3×3 clickable grid | Layout section |
| `UnitSelector` | Dropdown | All numeric inputs |
| `IconButtonGroup` | Radio-style icon buttons | Typography (align, decoration, transform) |
| `SideSelector` | Tab bar (All/T/R/B/L) | Borders section |
| `CornerRadiusEditor` | 4-corner visual layout | Borders section |
| `ShadowEditor` | Multi-value list editor | Effects section |
| `TransformEditor` | Type-based input group | Effects section |
| `FilterSliders` | Grouped sliders | Effects section |
| `GradientEditor` | Visual gradient bar + stops | Backgrounds section |
| `TransitionEditor` | Property/duration/easing/delay | Effects section |
| `BezierCurveEditor` | Visual curve editor | Transitions sub-section |
| `StyleIndicator` | Colored dot | All property labels |
| `LabelScrub` | Draggable label wrapper | All numeric inputs |
| `ColorPickerEnhanced` | Full picker with modes | All color properties |
| `BackgroundLayerList` | Stackable layer manager | Backgrounds section |
| `PositionOffsetDiagram` | Visual offset box | Position section |
| `StateSelector` | Dropdown | Selector area |

### Existing Components to Enhance

| Component | Enhancement |
|-----------|------------|
| `Panel.tsx` | Section ordering, collapse state management |
| `infer.ts` | All new properties, unit detection, state awareness |
| `Header.tsx` | States dropdown, enhanced breadcrumb |
| `Footer.tsx` | No changes needed |
| `SpacingBoxModel.tsx` | Drag-to-scrub, complementary-side shortcuts, color zones |
| `Overlay.tsx` | Label-scrub global handler, state management |

---

## Sources

- [Style panel overview – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview)
- [Meet the new style panel – Webflow Blog](https://webflow.com/blog/meet-the-new-style-panel)
- [New Style panel Layout section and controls – Webflow Updates](https://webflow.com/updates/style-panel-layout-improvements)
- [Webflow Designer API: Style Properties](https://developers.webflow.com/designer/reference/style-properties)
- [Display settings – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961293279763-Display-settings)
- [Effects – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961245810451-Effects)
- [Advanced borders on the web – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961270594067-Advanced-borders-on-the-web)
- [Classes – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961311094419-Classes)
- [Advanced web typography – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961334261779-Advanced-web-typography)
- [Flexbox – Webflow Help Center](https://help.webflow.com/hc/en-us/articles/33961260795155-Flexbox)
