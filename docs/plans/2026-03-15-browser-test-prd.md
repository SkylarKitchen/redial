# PRD: Functional Browser Testing via Claude in Chrome

> **Goal**: Interact with every control in the Redial CSS panel and verify: (1) the CSS property is applied to the target element, (2) undo reverts it, (3) reset restores the original value.
>
> **Method**: Claude in Chrome MCP tools against a dedicated test fixture page.
>
> **Structure**: Section-first hierarchy matching the panel's DOM order.

---

## 1. Test Fixture Page

**Path**: `test-app/app/test-fixture/page.tsx`

A page with purpose-built elements, each with a `data-testid` for reliable selection. The page auto-opens the panel via `tuner:select` custom event.

| Element | `data-testid` | Purpose | Pre-styling |
|---------|--------------|---------|-------------|
| `<div>` flex container | `fixture-flex` | Layout flex controls | `display:flex; gap:16px; flex-wrap:wrap` |
| `<div>` grid container | `fixture-grid` | Layout grid controls | `display:grid; grid-template-columns:1fr 1fr` |
| `<div>` block | `fixture-block` | Spacing, Size, Borders, general Effects | `position:relative; padding:20px; width:200px; height:100px; background:#eeeeee; border:1px solid #ccc` |
| `<h2>` heading | `fixture-text` | Typography (all text controls) | Default browser styling |
| `<img>` | `fixture-img` | Size (object-fit, object-position, aspect-ratio) | `width:200px; height:150px; object-fit:cover` |
| `<div>` positioned | `fixture-positioned` | Position offsets, z-index | `position:absolute; top:10px; left:10px; width:80px; height:80px; background:#ddd` |
| `<div>` with background | `fixture-bg` | Backgrounds (color, gradient, layers) | `background:linear-gradient(#ff0000, #0000ff); width:200px; height:100px` |
| `<div>` flex child | `fixture-flex-child` | Flex item controls (grow, shrink, basis, order, align-self) | Child inside `fixture-flex` |
| `<div>` with effects | `fixture-effects` | Shadows, transforms, transitions, filters, opacity | `box-shadow:0 2px 4px rgba(0,0,0,0.2); opacity:0.9; width:200px; height:100px` |
| `<div>` positioned parent | `fixture-pos-parent` | Wraps `fixture-positioned` | `position:relative; width:300px; height:200px; background:#f5f5f5` |

---

## 2. Verification Protocol

Every control test follows this sequence:

1. **Record baseline** — read `getComputedStyle(element).getPropertyValue(prop)` before interaction
2. **Interact** — click, drag, or type into the control to set a new value
3. **Assert APPLY** — re-read computed style, confirm property changed to expected value
4. **Assert UNDO** — trigger Cmd+Z, confirm property reverted to baseline
5. **Assert RESET** — re-apply the change, then click the footer "Reset" button, confirm property matches baseline

For sub-editor lists (shadows, transforms, transitions, filters):
- **Add item** → verify the CSS property includes the new item
- **Remove item** → verify the CSS property no longer includes it
- **Toggle visibility** → verify the item is excluded/included in the computed value

---

## 3. Test Matrix by Section

### 3.1 Layout Section

**Fixture**: `fixture-flex` (flex), `fixture-grid` (grid), `fixture-block` (block)

#### Display Controls
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Display tabs | SegmentedControl | Click "flex" tab | `display` | `flex` |
| Display tabs | SegmentedControl | Click "grid" tab | `display` | `grid` |
| Display tabs | SegmentedControl | Click "block" tab | `display` | `block` |
| Display tabs | SegmentedControl | Click "none" tab | `display` | `none` |

#### Flex Controls (when display=flex on `fixture-flex`)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Direction | SegmentedControl | Click "column" | `flex-direction` | `column` |
| Direction | SegmentedControl | Click "row" | `flex-direction` | `row` |
| Align (align-items) | SegmentedControl | Click "center" | `align-items` | `center` |
| Align (align-items) | SegmentedControl | Click "flex-start" | `align-items` | `flex-start` |
| Align (align-items) | SegmentedControl | Click "flex-end" | `align-items` | `flex-end` |
| Align (align-items) | SegmentedControl | Click "stretch" | `align-items` | `stretch` |
| Align (align-items) | SegmentedControl | Click "baseline" | `align-items` | `baseline` |
| Justify (justify-content) | SegmentedControl | Click "center" | `justify-content` | `center` |
| Justify (justify-content) | SegmentedControl | Click "space-between" | `justify-content` | `space-between` |
| Justify (justify-content) | SegmentedControl | Click "space-around" | `justify-content` | `space-around` |
| Gap | SliderRow | Drag to ~20 | `gap` | `20px` |
| Row Gap | SliderRow | Drag to ~10 | `row-gap` | `10px` |
| Col Gap | SliderRow | Drag to ~10 | `column-gap` | `10px` |
| Children (flex-wrap) | SegmentedControl | Click "wrap" | `flex-wrap` | `wrap` |
| Children (flex-wrap) | SegmentedControl | Click "nowrap" | `flex-wrap` | `nowrap` |

#### Flex Child Controls (select `fixture-flex-child`)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Grow | NumberInput | Type "1" | `flex-grow` | `1` |
| Shrink | NumberInput | Type "0" | `flex-shrink` | `0` |
| Basis | ValueInput | Type "100px" | `flex-basis` | `100px` |
| Order | NumberInput | Type "2" | `order` | `2` |
| Align Self | SelectRow | Select "center" | `align-self` | `center` |

#### Grid Controls (when display=grid on `fixture-grid`)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Direction (grid-auto-flow) | SegmentedControl | Click "column" | `grid-auto-flow` | `column` |
| Align (justify-items) | AlignBox | Click center cell | `justify-items` | `center` |
| Align (align-items) | AlignBox | Click center cell | `align-items` | `center` |
| Gap | SliderRow | Drag to ~16 | `gap` | `16px` |
| Grid Settings popup | Button | Click gear icon → opens GridSettingsPopup | — | Popup visible |

---

### 3.2 Spacing Section

**Fixture**: `fixture-block`

| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Padding-top | EditableValue (box model) | Click + type "24" | `padding-top` | `24px` |
| Padding-right | EditableValue (box model) | Click + type "16" | `padding-right` | `16px` |
| Padding-bottom | EditableValue (box model) | Click + type "24" | `padding-bottom` | `24px` |
| Padding-left | EditableValue (box model) | Click + type "16" | `padding-left` | `16px` |
| Margin-top | EditableValue (box model) | Click + type "12" | `margin-top` | `12px` |
| Margin-right | EditableValue (box model) | Click + type "auto" | `margin-right` | `auto` |
| Margin-bottom | EditableValue (box model) | Click + type "12" | `margin-bottom` | `12px` |
| Margin-left | EditableValue (box model) | Click + type "auto" | `margin-left` | `auto` |

**Note**: The SpacingBoxModel renders an interactive box diagram. Each zone (padding/margin per side) is an `EditableValue` that opens a `SpacingValuePopover` on click.

---

### 3.3 Size Section

**Fixture**: `fixture-block` (general), `fixture-img` (object-fit/position)

| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Width | SizeInputCell | Type "300" | `width` | `300px` |
| Height | SizeInputCell | Type "150" | `height` | `150px` |
| Min W | SizeInputCell | Type "100" | `min-width` | `100px` |
| Min H | SizeInputCell | Type "50" | `min-height` | `50px` |
| Max W | SizeInputCell | Type "500" | `max-width` | `500px` |
| Max H | SizeInputCell | Type "400" | `max-height` | `400px` |
| Overflow | WebflowSegmentedControl | Click "hidden" | `overflow` | `hidden` |
| Overflow | WebflowSegmentedControl | Click "scroll" | `overflow` | `scroll` |
| Overflow | WebflowSegmentedControl | Click "auto" | `overflow` | `auto` |
| Aspect Ratio | TextRow | Type "16 / 9" | `aspect-ratio` | `16 / 9` |

#### Image-specific (select `fixture-img`)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Object Fit | SelectRow | Select "contain" | `object-fit` | `contain` |
| Object Fit | SelectRow | Select "fill" | `object-fit` | `fill` |
| Object Position | SelectRow | Select "top" | `object-position` | `top` |
| Object Position | SelectRow | Select "center" | `object-position` | `center` |

---

### 3.4 Position Section

**Fixture**: `fixture-positioned`

| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Position type | PositionSelector (icon grid) | Click "absolute" | `position` | `absolute` |
| Position type | PositionSelector | Click "relative" | `position` | `relative` |
| Position type | PositionSelector | Click "fixed" | `position` | `fixed` |
| Position type | PositionSelector | Click "sticky" | `position` | `sticky` |
| Top | EditableValue (offset diagram) | Type "20" | `top` | `20px` |
| Right | EditableValue (offset diagram) | Type "15" | `right` | `15px` |
| Bottom | EditableValue (offset diagram) | Type "20" | `bottom` | `20px` |
| Left | EditableValue (offset diagram) | Type "15" | `left` | `15px` |
| Z-Index | NumberInput | Type "10" | `z-index` | `10` |
| Float | IconButtonGroup | Click "left" | `float` | `left` |
| Float | IconButtonGroup | Click "right" | `float` | `right` |
| Clear | IconButtonGroup | Click "both" | `clear` | `both` |

---

### 3.5 Typography Section

**Fixture**: `fixture-text`

#### Core Controls
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Font | SelectRow (searchable) | Search + select "Georgia" | `font-family` | `Georgia` (or system match) |
| Weight | SelectRow | Select "700 - Bold" | `font-weight` | `700` |
| Size | TypoValueCell | Type "24" | `font-size` | `24px` |
| Line Height | TypoValueCell | Type "1.5" | `line-height` | matches `1.5` ratio |
| Color | ColorRow | Click swatch → pick `#ff0000` | `color` | `rgb(255, 0, 0)` |
| Align | IconButtonGroup | Click "center" | `text-align` | `center` |
| Align | IconButtonGroup | Click "right" | `text-align` | `right` |
| Align | IconButtonGroup | Click "justify" | `text-align` | `justify` |
| Style (italic) | IconButtonGroup | Click "italic" | `font-style` | `italic` |
| Decoration | IconButtonGroup | Click "underline" | `text-decoration` | contains `underline` |
| Decoration | IconButtonGroup | Click "line-through" | `text-decoration` | contains `line-through` |

#### More Type Options (expanded)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Letter spacing | TypoValueCell | Type "2" | `letter-spacing` | `2px` |
| Text indent | TypoValueCell | Type "20" | `text-indent` | `20px` |
| Columns | TypoValueCell | Type "2" | `column-count` | `2` |
| Column gap | TypoValueCell | Type "16" (when columns > 1) | `column-gap` | `16px` |
| Word spacing | TypoValueCell | Type "4" | `word-spacing` | `4px` |
| Hyphens | MiniDropdown | Select "auto" | `hyphens` | `auto` |
| Case | IconButtonGroup | Click "uppercase" | `text-transform` | `uppercase` |
| Case | IconButtonGroup | Click "capitalize" | `text-transform` | `capitalize` |
| Direction | IconButtonGroup | Click "rtl" | `direction` | `rtl` |
| Wrap | SelectRow | Select "No Wrap" | `white-space` | `nowrap` |
| Text shadows | SubSectionHeader + Add | Click "+" → adds shadow | `text-shadow` | non-`none` value |

---

### 3.6 Backgrounds Section

**Fixture**: `fixture-bg`

| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Color | ColorRow | Pick `#00ff00` | `background-color` | `rgb(0, 255, 0)` |
| Clipping | SelectRow | Select "padding-box" | `background-clip` | `padding-box` |
| Image & gradient: Add layer | SubSectionHeader + button | Click "+" | `background-image` | new gradient or image layer |
| Size | SelectRow | Select "cover" | `background-size` | `cover` |
| Size | SelectRow | Select "contain" | `background-size` | `contain` |
| Position | SelectRow | Select "center" | `background-position` | `center` |
| Repeat | SelectRow | Select "no-repeat" | `background-repeat` | `no-repeat` |
| Attachment | SelectRow | Select "fixed" | `background-attachment` | `fixed` |

#### GradientEditor (opened from a gradient layer)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Gradient type toggle | SegmentedControl | Click "radial" | `background-image` | contains `radial-gradient` |
| Color stop swatch | Color picker | Change stop color | `background-image` | updated color in gradient |
| Angle input | NumberInput | Type "90" | `background-image` | gradient angle = 90deg |

#### BackgroundLayerList
| Control | Type | Interaction | CSS Property |
|---------|------|------------|-------------|
| Visibility toggle | VisibilityToggle (eye icon) | Click | Layer excluded from `background-image` |
| Remove layer | EditorRemoveButton (X) | Click | Layer removed from `background-image` |
| Drag reorder | DragHandle | Drag up/down | Layer order changes in `background-image` |

---

### 3.7 Borders Section

**Fixture**: `fixture-block`

| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Side selector | SideSelector | Click "all" (default) | Targets all sides | — |
| Side selector | SideSelector | Click "top" | Targets top only | — |
| Style | IconButtonGroup | Click "solid" | `border-style` | `solid` |
| Style | IconButtonGroup | Click "dashed" | `border-style` | `dashed` |
| Style | IconButtonGroup | Click "dotted" | `border-style` | `dotted` |
| Width | ValueInput + LabelScrub | Type "3" | `border-width` | `3px` |
| Width unit | UnitSelector | Switch to "rem" | `border-width` | value in `rem` |
| Color | ColorRow | Pick `#ff0000` | `border-color` | `rgb(255, 0, 0)` |

#### CornerRadiusEditor
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| All corners (linked) | ValueInput | Type "8" | `border-radius` | `8px` |
| Unlink corners | Toggle button | Click unlink icon | — | 4 individual inputs appear |
| Top-left | ValueInput | Type "12" | `border-top-left-radius` | `12px` |
| Top-right | ValueInput | Type "4" | `border-top-right-radius` | `4px` |
| Bottom-right | ValueInput | Type "12" | `border-bottom-right-radius` | `12px` |
| Bottom-left | ValueInput | Type "4" | `border-bottom-left-radius` | `4px` |

---

### 3.8 Effects Section

**Fixture**: `fixture-effects`

#### Top-level Controls
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Blending | SelectRow | Select "multiply" | `mix-blend-mode` | `multiply` |
| Opacity | SliderRow | Drag to ~50% | `opacity` | `0.5` |
| Outline style | IconButtonGroup | Click "solid" | `outline-style` | `solid` |
| Cursor | SelectRow | Select "pointer" | `cursor` | `pointer` |
| Pointer | SelectRow | Select "none" | `pointer-events` | `none` |
| Visibility | SelectRow | Select "hidden" | `visibility` | `hidden` |
| Selection | SelectRow | Select "none" | `user-select` | `none` |

#### ShadowEditor (add via "+" on Box shadows)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Add shadow | SubSectionHeader "+" | Click | `box-shadow` | new shadow added |
| X offset | NumericInput | Type "5" | `box-shadow` | x=5px in value |
| Y offset | NumericInput | Type "5" | `box-shadow` | y=5px in value |
| Blur | NumericInput | Type "10" | `box-shadow` | blur=10px in value |
| Spread | NumericInput | Type "2" | `box-shadow` | spread=2px in value |
| Color | ColorPicker | Pick `#ff0000` | `box-shadow` | color in value |
| Inset toggle | Toggle | Click | `box-shadow` | `inset` keyword present |
| Visibility | VisibilityToggle | Click eye | `box-shadow` | shadow excluded |
| Remove | EditorRemoveButton | Click X | `box-shadow` | shadow removed |

#### TransformEditor (add via "+" on 2D & 3D transforms)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Add transform | SubSectionHeader "+" | Click | `transform` | new transform function |
| Type selector | SegmentedControl | Click "rotate" | `transform` | contains `rotate()` |
| Type selector | SegmentedControl | Click "scale" | `transform` | contains `scale()` |
| Type selector | SegmentedControl | Click "translate" | `transform` | contains `translate()` |
| Type selector | SegmentedControl | Click "skew" | `transform` | contains `skew()` |
| X axis | AxisSliderRow | Drag/type value | `transform` | X param changes |
| Y axis | AxisSliderRow | Drag/type value | `transform` | Y param changes |
| Z axis (3D) | AxisSliderRow | Drag/type value | `transform` | Z param changes |
| Scale lock | Toggle | Click lock icon | — | X and Y scale in sync |
| Backface visibility | SegmentedControl | Click "hidden" | `backface-visibility` | `hidden` |
| Perspective distance | SliderRow | Drag to ~500 | `perspective` | `500px` |
| Transform origin | TransformOriginPicker | Click grid position | `transform-origin` | e.g. `0% 0%` |
| Remove | EditorRemoveButton | Click X | `transform` | function removed |

#### TransitionEditor (add via "+" on Transitions)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Add transition | SubSectionHeader "+" | Click | `transition` | new transition added |
| Property | Text/Select | Type or select "opacity" | `transition-property` | `opacity` |
| Duration | NumberInput | Type "300" | `transition-duration` | `300ms` or `0.3s` |
| Easing | Select + BezierEditor | Select "ease-in-out" | `transition-timing-function` | `ease-in-out` |
| Delay | NumberInput | Type "100" | `transition-delay` | `100ms` or `0.1s` |
| BezierEditor | Canvas interaction | Drag control points | `transition-timing-function` | `cubic-bezier(...)` |
| Visibility | VisibilityToggle | Click eye | `transition` | transition excluded |
| Remove | EditorRemoveButton | Click X | `transition` | transition removed |

#### FilterSliders (add via "+" on Filters / Backdrop filters)
| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Add filter (blur) | Categorized dropdown | Select "Blur" | `filter` | `blur(0px)` |
| Add filter (brightness) | Categorized dropdown | Select "Brightness" | `filter` | `brightness(100%)` |
| Add filter (contrast) | Categorized dropdown | Select "Contrast" | `filter` | `contrast(100%)` |
| Add filter (hue-rotate) | Categorized dropdown | Select "Hue Rotate" | `filter` | `hue-rotate(0deg)` |
| Add filter (saturate) | Categorized dropdown | Select "Saturate" | `filter` | `saturate(100%)` |
| Add filter (grayscale) | Categorized dropdown | Select "Grayscale" | `filter` | `grayscale(0%)` |
| Add filter (invert) | Categorized dropdown | Select "Invert" | `filter` | `invert(0%)` |
| Add filter (sepia) | Categorized dropdown | Select "Sepia" | `filter` | `sepia(0%)` |
| Add filter (drop-shadow) | Categorized dropdown | Select "Drop Shadow" | `filter` | `drop-shadow(...)` |
| Filter value slider | Slider per param | Drag to new value | `filter` | updated function value |
| Drop-shadow color | ColorPicker | Pick color | `filter` | updated drop-shadow color |
| Expand/collapse | Click summary row | Click | — | Expanded editor visible |
| Visibility | VisibilityToggle | Click eye | `filter` | filter excluded |
| Remove | EditorRemoveButton | Click X | `filter` | filter removed |
| Backdrop: Add filter | Same as above | Select any type | `backdrop-filter` | filter function added |

---

### 3.9 CSS Variables Section

**Fixture**: Any element with CSS custom properties (add `--test-color: #ff0000; --test-size: 16px` to `fixture-block`)

| Control | Type | Interaction | CSS Property | Test Value |
|---------|------|------------|-------------|------------|
| Color variable | ColorRow | Pick new color | Custom property | Updated value |
| Numeric variable | SliderRow | Drag to new value | Custom property | Updated value |
| Group headers | Collapsible | Click to expand/collapse | — | Group toggles |

---

## 4. Shell / Chrome Controls

These are not per-section but should be verified once:

### Header
| Control | Interaction | Verification |
|---------|------------|--------------|
| Breadcrumb navigation | Click parent segment | Panel switches to parent element |
| Scope pills (element/class) | Click "class" pill | Panel targets class instead of element |
| State selector (:hover/:focus) | Select ":hover" | Panel shows hover-state styles |
| Pin toggle | Click pin icon | Panel stays open on outside click |
| Close button | Click X | Panel closes |
| Drag handle | Drag header | Panel repositions |

### Footer
| Control | Interaction | Verification |
|---------|------------|--------------|
| Save button | Click after changes | Changes written to source (server response) |
| Reset button | Click after changes | All changes reverted to baseline |
| Copy dropdown | Click chevron | Dropdown appears with format options |
| Copy CSS | Select "CSS" from dropdown | CSS string in clipboard |
| Copy Tailwind | Select "Tailwind" | Tailwind classes in clipboard |
| Paste styles | Click paste (when clipboard has styles) | Styles applied from clipboard |

### Keyboard Shortcuts
| Shortcut | Action | Verification |
|----------|--------|--------------|
| Backtick (`) | Open element selector | Selector overlay appears |
| Cmd+Z | Undo | Last change reverted |
| Cmd+Shift+Z | Redo | Last undo re-applied |
| Cmd+K | Command palette | Palette overlay appears |
| Escape | Close panel / deselect | Panel closes or context dismissed |

---

## 5. Shared Control Behaviors (Cross-cutting)

These apply to many controls and should be spot-checked across sections:

| Behavior | How to Test | Where |
|----------|------------|-------|
| LabelScrub (drag label to adjust) | Click-drag on a label like "Width" | Borders width, SliderRow labels |
| UnitSelector (px/rem/em/%) | Click unit badge, select new unit | Size, Typography, Borders, Position |
| ValueInput math expressions | Type "20+5" then press Enter | Any ValueInput (Size, Borders) |
| Alt-click reset | Alt+click a label | Any control with indicator dot |
| Right-click context menu | Right-click a control row | Any control with `onContextMenu` |
| Computed tooltip | Hover a control | Controls with `computedProp` |
| Color picker (full) | Click any color swatch | Typography color, Border color, BG color |
| Color picker opacity slider | Drag opacity in picker | Any ColorRow |
| Variable linking | Click link icon in ColorRow | Typography color, BG color |
| Mouse wheel adjustment | Scroll on a numeric input | SizeInputCell, SliderRow, CornerRadiusEditor |

---

## 6. Test Fixture Element CSS Variables

Add these to `fixture-block` to ensure CSS Variables section has content:

```css
--test-color: #3b82f6;
--test-spacing: 16px;
--test-radius: 8px;
--test-opacity: 0.8;
```

---

## 7. Summary

| Section | Controls | Estimated Test Cases |
|---------|----------|---------------------|
| Layout | Display, Flex, Grid, AlignBox, Gap, Wrap, Flex child | ~30 |
| Spacing | 8 sides (padding + margin) | ~8 |
| Size | Width, Height, Min/Max, Overflow, Aspect, Obj Fit/Pos | ~14 |
| Position | Type, 4 offsets, Z-index, Float, Clear | ~12 |
| Typography | Font, Weight, Size, Height, Color, Align, Style, Decoration, Advanced | ~25 |
| Backgrounds | Color, Clipping, Layers, Gradient editor, Size/Pos/Repeat/Attach | ~15 |
| Borders | Side selector, Style, Width, Color, Corner radius | ~12 |
| Effects | Blend, Opacity, Outline, Shadows, Transforms, Transitions, Filters, Other | ~45 |
| CSS Variables | Color vars, Numeric vars | ~4 |
| Shell | Header, Footer, Keyboard shortcuts | ~15 |
| Cross-cutting | LabelScrub, Units, Math, Alt-click, Context menu, Wheel | ~10 |
| **Total** | | **~190 test cases** |

Each test case includes 3 verification steps (apply, undo, reset), giving **~570 individual assertions**.
