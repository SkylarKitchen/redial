# Browser Test Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a test fixture page and execute ~190 functional browser tests verifying every panel control applies CSS, undoes, and resets correctly.

**Architecture:** A single `test-fixture/page.tsx` with purpose-built elements covers all 8 sections. Tests run via Claude in Chrome MCP tools — navigate to the page, select elements via `tuner:select` custom event, interact with controls, and read `getComputedStyle` to verify.

**Tech Stack:** Next.js (test-app), Claude in Chrome MCP (browser automation), JavaScript evaluation via `mcp__claude-in-chrome__javascript_tool`

**PRD:** `docs/plans/2026-03-15-browser-test-prd.md`

---

### Task 1: Create the test fixture page

**Files:**
- Create: `test-app/app/test-fixture/page.tsx`

**Step 1: Write the fixture page**

```tsx
"use client";

import { useEffect } from "react";

export default function TestFixturePage() {
  useEffect(() => {
    // Auto-select fixture-block on mount
    const timer = setTimeout(() => {
      const target = document.querySelector("[data-testid='fixture-block']");
      if (target) {
        document.dispatchEvent(
          new CustomEvent("tuner:select", { detail: target })
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", gap: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Test Fixture Page</h1>

      {/* Flex container — Layout flex controls */}
      <div
        data-testid="fixture-flex"
        style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 16, background: "#f0f4f8", border: "1px solid #cbd5e1", borderRadius: 8 }}
      >
        <div
          data-testid="fixture-flex-child"
          style={{ width: 80, height: 60, background: "#93c5fd", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#1e3a5f" }}
        >
          Flex Child
        </div>
        <div style={{ width: 80, height: 60, background: "#a5b4fc", borderRadius: 4 }} />
        <div style={{ width: 80, height: 60, background: "#c4b5fd", borderRadius: 4 }} />
      </div>

      {/* Grid container — Layout grid controls */}
      <div
        data-testid="fixture-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 16, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}
      >
        <div style={{ height: 50, background: "#6ee7b7", borderRadius: 4 }} />
        <div style={{ height: 50, background: "#6ee7b7", borderRadius: 4 }} />
        <div style={{ height: 50, background: "#6ee7b7", borderRadius: 4 }} />
        <div style={{ height: 50, background: "#6ee7b7", borderRadius: 4 }} />
      </div>

      {/* Block div — Spacing, Size, Borders, general Effects */}
      <div
        data-testid="fixture-block"
        style={{
          position: "relative",
          padding: 20,
          width: 200,
          height: 100,
          background: "#eeeeee",
          border: "1px solid #cccccc",
          borderRadius: 4,
          // CSS variables for the CSS Variables section
          "--test-color": "#3b82f6",
          "--test-spacing": "16px",
          "--test-radius": "8px",
          "--test-opacity": "0.8",
        } as React.CSSProperties}
      >
        Block
      </div>

      {/* Heading — Typography controls */}
      <h2
        data-testid="fixture-text"
        style={{ fontSize: 24, fontWeight: 600 }}
      >
        Typography Test Heading
      </h2>

      {/* Image — object-fit, object-position, aspect-ratio */}
      <img
        data-testid="fixture-img"
        src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop"
        alt="Test fixture image"
        style={{ width: 200, height: 150, objectFit: "cover", borderRadius: 4 }}
      />

      {/* Positioned parent + child — Position controls */}
      <div
        data-testid="fixture-pos-parent"
        style={{ position: "relative", width: 300, height: 200, background: "#f5f5f5", border: "1px dashed #aaa", borderRadius: 8 }}
      >
        <span style={{ position: "absolute", top: 4, left: 8, fontSize: 10, color: "#888" }}>Position parent</span>
        <div
          data-testid="fixture-positioned"
          style={{ position: "absolute", top: 10, left: 10, width: 80, height: 80, background: "#fbbf24", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}
        >
          Positioned
        </div>
      </div>

      {/* Background div — Backgrounds controls */}
      <div
        data-testid="fixture-bg"
        style={{ width: 200, height: 100, background: "linear-gradient(135deg, #ff0000, #0000ff)", borderRadius: 8 }}
      />

      {/* Effects div — Shadows, transforms, transitions, filters */}
      <div
        data-testid="fixture-effects"
        style={{ width: 200, height: 100, background: "#e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", opacity: 0.9, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#475569" }}
      >
        Effects
      </div>
    </div>
  );
}
```

**Step 2: Verify the page loads**

Run: `cd /Users/skylar/code/redial/test-app && npx next dev` (if not already running)
Navigate to: `http://localhost:3000/test-fixture`
Expected: Page renders all 9 fixture elements with labels. Panel auto-opens on `fixture-block`.

**Step 3: Commit**

```bash
git add test-app/app/test-fixture/page.tsx
git commit -m "feat: add test fixture page for browser testing"
```

---

### Task 2: Test Layout Section — Display + Flex controls

**Fixture elements:** `fixture-flex`, `fixture-block`

**Step 1: Navigate and select fixture-flex**

```
Navigate to http://localhost:3000/test-fixture
Execute JS: document.dispatchEvent(new CustomEvent("tuner:select", { detail: document.querySelector("[data-testid='fixture-flex']") }))
Wait 500ms for panel to render
```

**Step 2: Test Display tabs**

The Layout section should be visible. Find the Display SegmentedControl (4 tabs: block, flex, grid, none).

For each display value, the test loop is:
1. Read baseline: `getComputedStyle(el).display`
2. Click the tab
3. Assert: `getComputedStyle(el).display === expectedValue`
4. Cmd+Z to undo
5. Assert: `getComputedStyle(el).display === baseline`
6. Re-click the tab, then click Footer "Reset" button
7. Assert: `getComputedStyle(el).display === baseline`

Test values:
- Click "block" tab → `display: block`
- Click "grid" tab → `display: grid`
- Click "none" tab → `display: none`
- Click "flex" tab → `display: flex` (restore)

**Step 3: Test Flex Direction**

With `fixture-flex` selected (display: flex):
- Click "column" in Direction SegmentedControl → `flex-direction: column`
- Undo → `flex-direction: row`
- Re-apply, Reset → `flex-direction: row`
- Click "row" to restore

**Step 4: Test Align (align-items)**

Click each segment in the Align SegmentedControl:
- "center" → `align-items: center`, undo, reset
- "flex-end" → `align-items: flex-end`, undo, reset
- "stretch" → `align-items: stretch`, undo, reset
- "baseline" → `align-items: baseline`, undo, reset
- "flex-start" → restore

**Step 5: Test Justify (justify-content)**

Click each segment in the Justify SegmentedControl:
- "center" → `justify-content: center`, undo, reset
- "space-between" → `justify-content: space-between`, undo, reset
- "space-around" → `justify-content: space-around`, undo, reset
- "flex-start" → restore

**Step 6: Test Gap slider**

- Drag Gap SliderRow to ~20px or type "20" in the input
- Assert: `getComputedStyle(el).gap === "20px"`
- Undo → original gap
- Re-apply, Reset → original gap

**Step 7: Test Wrap**

- Click "wrap" in Children SegmentedControl → `flex-wrap: wrap`
- Undo, Reset
- Click "nowrap" → `flex-wrap: nowrap`

---

### Task 3: Test Layout Section — Flex Child + Grid controls

**Step 1: Select fixture-flex-child**

```
Execute JS: document.dispatchEvent(new CustomEvent("tuner:select", { detail: document.querySelector("[data-testid='fixture-flex-child']") }))
```

**Step 2: Test flex child controls**

The Layout section should show flex-child controls (Grow, Shrink, Basis, Order, Align Self):
- Type "1" in Grow input → `flex-grow: 1`, undo, reset
- Type "0" in Shrink input → `flex-shrink: 0`, undo, reset
- Type "100" in Basis input → `flex-basis: 100px`, undo, reset
- Type "2" in Order input → `order: 2`, undo, reset
- Select "center" in Align Self dropdown → `align-self: center`, undo, reset

**Step 3: Select fixture-grid for grid controls**

```
Execute JS: document.dispatchEvent(new CustomEvent("tuner:select", { detail: document.querySelector("[data-testid='fixture-grid']") }))
```

**Step 4: Test grid controls**

- Click "column" in grid Direction SegmentedControl → `grid-auto-flow: column`, undo, reset
- Click center cell in AlignBox → `align-items: center` / `justify-items: center`, undo, reset
- Drag grid Gap SliderRow → `gap` changes, undo, reset
- Click gear icon → GridSettingsPopup opens (visual check only)

---

### Task 4: Test Spacing Section

**Fixture:** `fixture-block`

**Step 1: Select fixture-block**

```
Execute JS: document.dispatchEvent(new CustomEvent("tuner:select", { detail: document.querySelector("[data-testid='fixture-block']") }))
```

**Step 2: Open Spacing section if collapsed**

Click the "Spacing" section header to expand it.

**Step 3: Test all 8 spacing values in the SpacingBoxModel**

For each of the 8 zones (padding-top, padding-right, padding-bottom, padding-left, margin-top, margin-right, margin-bottom, margin-left):

1. Click the zone in the box model diagram to open SpacingValuePopover
2. Type the test value (e.g., "24" for padding-top)
3. Press Enter
4. Assert: `getComputedStyle(el).paddingTop === "24px"`
5. Cmd+Z → assert original
6. Re-apply, Reset → assert original

Test values from PRD:
- padding-top: 24px
- padding-right: 16px
- padding-bottom: 24px
- padding-left: 16px
- margin-top: 12px
- margin-right: auto (type "auto")
- margin-bottom: 12px
- margin-left: auto

---

### Task 5: Test Size Section

**Fixture:** `fixture-block` (general), `fixture-img` (object-fit)

**Step 1: With fixture-block selected, open Size section**

**Step 2: Test size inputs**

Each SizeInputCell: click, clear, type value, press Enter.

- Width: type "300" → `width: 300px`, undo, reset
- Height: type "150" → `height: 150px`, undo, reset
- Min W: type "100" → `min-width: 100px`, undo, reset
- Min H: type "50" → `min-height: 50px`, undo, reset
- Max W: type "500" → `max-width: 500px`, undo, reset
- Max H: type "400" → `max-height: 400px`, undo, reset

**Step 3: Test Overflow segmented control**

- Click "hidden" → `overflow: hidden`, undo, reset
- Click "scroll" → `overflow: scroll`, undo, reset
- Click "auto" → `overflow: auto`, undo, reset

**Step 4: Test Aspect Ratio**

- Type "16 / 9" in Aspect TextRow → `aspect-ratio: 16 / 9`, undo, reset

**Step 5: Select fixture-img for image controls**

```
Execute JS: document.dispatchEvent(new CustomEvent("tuner:select", { detail: document.querySelector("[data-testid='fixture-img']") }))
```

**Step 6: Test Object Fit and Position**

- Select "contain" from Fit dropdown → `object-fit: contain`, undo, reset
- Select "fill" from Fit dropdown → `object-fit: fill`, undo, reset
- Select "top" from Obj Position dropdown → `object-position: top`, undo, reset
- Select "center" from Obj Position dropdown → `object-position: center`, undo, reset

---

### Task 6: Test Position Section

**Fixture:** `fixture-positioned`

**Step 1: Select fixture-positioned**

```
Execute JS: document.dispatchEvent(new CustomEvent("tuner:select", { detail: document.querySelector("[data-testid='fixture-positioned']") }))
```

**Step 2: Open Position section**

**Step 3: Test position type selector**

Click each position icon in the PositionSelector grid:
- Click "relative" → `position: relative`, undo, reset
- Click "fixed" → `position: fixed`, undo, reset
- Click "sticky" → `position: sticky`, undo, reset
- Click "absolute" → `position: absolute` (restore)

**Step 4: Test offset values in PositionOffsetDiagram**

Each offset is an EditableValue in the diagram:
- Click top value, type "20" → `top: 20px`, undo, reset
- Click right value, type "15" → `right: 15px`, undo, reset
- Click bottom value, type "20" → `bottom: 20px`, undo, reset
- Click left value, type "15" → `left: 15px`, undo, reset

**Step 5: Test Z-Index**

- Type "10" in z-index input → `z-index: 10`, undo, reset

**Step 6: Test Float and Clear**

- Click "left" in Float IconButtonGroup → `float: left`, undo, reset
- Click "right" in Float IconButtonGroup → `float: right`, undo, reset
- Click "both" in Clear IconButtonGroup → `clear: both`, undo, reset

---

### Task 7: Test Typography Section

**Fixture:** `fixture-text`

**Step 1: Select fixture-text**

```
Execute JS: document.dispatchEvent(new CustomEvent("tuner:select", { detail: document.querySelector("[data-testid='fixture-text']") }))
```

**Step 2: Test Font Family**

- Click the Font SelectRow dropdown, search "Georgia", select it
- Assert: `getComputedStyle(el).fontFamily` contains "Georgia"
- Undo, reset

**Step 3: Test Font Weight**

- Click Weight SelectRow, select "700 - Bold" → `font-weight: 700`, undo, reset

**Step 4: Test Font Size and Line Height**

- Click Size TypoValueCell, clear, type "32", Enter → `font-size: 32px`, undo, reset
- Click Height TypoValueCell, clear, type "1.5", Enter → line-height changes, undo, reset

**Step 5: Test Color**

- Click the Color swatch to open ColorPickerEnhanced
- Type "#ff0000" in the hex input
- Assert: `getComputedStyle(el).color === "rgb(255, 0, 0)"`, undo, reset

**Step 6: Test Text Align**

- Click "center" icon → `text-align: center`, undo, reset
- Click "right" icon → `text-align: right`, undo, reset
- Click "justify" icon → `text-align: justify`, undo, reset

**Step 7: Test Style (Italic + Decoration)**

- Click "italic" icon → `font-style: italic`, undo, reset
- Click "underline" icon → `text-decoration` contains "underline", undo, reset
- Click "line-through" icon → `text-decoration` contains "line-through", undo, reset

**Step 8: Expand "More type options"**

Click "More type options" button to expand advanced controls.

**Step 9: Test advanced typography**

- Letter spacing: type "2" → `letter-spacing: 2px`, undo, reset
- Text indent: type "20" → `text-indent: 20px`, undo, reset
- Columns: type "2" → `column-count: 2`, undo, reset
- Word spacing: type "4" → `word-spacing: 4px`, undo, reset
- Case: click "uppercase" → `text-transform: uppercase`, undo, reset
- Case: click "capitalize" → `text-transform: capitalize`, undo, reset
- Direction: click "rtl" → `direction: rtl`, undo, reset
- Wrap: select "No Wrap" → `white-space: nowrap`, undo, reset
- Hyphens: select "auto" → `hyphens: auto`, undo, reset

---

### Task 8: Test Backgrounds Section

**Fixture:** `fixture-bg`

**Step 1: Select fixture-bg**

```
Execute JS: document.dispatchEvent(new CustomEvent("tuner:select", { detail: document.querySelector("[data-testid='fixture-bg']") }))
```

**Step 2: Test Background Color**

- Click Color swatch, type "#00ff00" in hex input
- Assert: `getComputedStyle(el).backgroundColor === "rgb(0, 255, 0)"`, undo, reset

**Step 3: Test Clipping**

- Select "padding-box" from Clipping dropdown → `background-clip: padding-box`, undo, reset

**Step 4: Test background layer controls**

- Click "+" on Image & gradient SubSectionHeader → new layer added to `background-image`
- Verify layer appears in BackgroundLayerList
- Click visibility eye → layer excluded
- Click eye again → layer included
- Click X → layer removed, undo, reset

**Step 5: Test background positioning dropdowns**

- Select "cover" from Size dropdown → `background-size: cover`, undo, reset
- Select "center" from Position dropdown → `background-position: center`, undo, reset
- Select "no-repeat" from Repeat dropdown → `background-repeat: no-repeat`, undo, reset
- Select "fixed" from Attachment dropdown → `background-attachment: fixed`, undo, reset

---

### Task 9: Test Borders Section

**Fixture:** `fixture-block`

**Step 1: Select fixture-block, open Borders section**

**Step 2: Test Side Selector**

- Click center (all sides) → controls target all borders
- Click top segment → controls target top border only

**Step 3: Test Border Style**

- Click "solid" icon → `border-style: solid`, undo, reset
- Click "dashed" icon → `border-style: dashed`, undo, reset
- Click "dotted" icon → `border-style: dotted`, undo, reset

**Step 4: Test Border Width**

- Clear width input, type "3" → `border-width: 3px`, undo, reset

**Step 5: Test Border Color**

- Click Color swatch, type "#ff0000"
- Assert: `getComputedStyle(el).borderColor` contains `rgb(255, 0, 0)`, undo, reset

**Step 6: Test Corner Radius (CornerRadiusEditor)**

- Type "8" in linked radius input → `border-radius: 8px`, undo, reset
- Click unlink icon → 4 individual inputs appear
- Type "12" in top-left → `border-top-left-radius: 12px`, undo, reset
- Type "4" in top-right → `border-top-right-radius: 4px`, undo, reset

---

### Task 10: Test Effects Section — Top-level controls

**Fixture:** `fixture-effects`

**Step 1: Select fixture-effects**

```
Execute JS: document.dispatchEvent(new CustomEvent("tuner:select", { detail: document.querySelector("[data-testid='fixture-effects']") }))
```

**Step 2: Test Blending**

- Select "multiply" from Blending dropdown → `mix-blend-mode: multiply`, undo, reset

**Step 3: Test Opacity**

- Drag Opacity slider to ~50 or type "50" in input → `opacity: 0.5`, undo, reset

**Step 4: Test Outline Style**

- Click "solid" in Outline IconButtonGroup → `outline-style: solid`, undo, reset

**Step 5: Test Other dropdowns**

- Cursor: select "pointer" → `cursor: pointer`, undo, reset
- Pointer: select "none" → `pointer-events: none`, undo, reset
- Visibility: select "hidden" → `visibility: hidden`, undo, reset
- Selection: select "none" → `user-select: none`, undo, reset

---

### Task 11: Test Effects Section — ShadowEditor

**Fixture:** `fixture-effects`

**Step 1: Add a new shadow**

- Click "+" on "Box shadows" SubSectionHeader
- Assert: `getComputedStyle(el).boxShadow` is not `none`

**Step 2: Test shadow numeric inputs**

With the new shadow expanded:
- Type "5" in X input → box-shadow X offset changes
- Type "5" in Y input → box-shadow Y offset changes
- Type "10" in Blur input → box-shadow blur changes
- Type "2" in Spread input → box-shadow spread changes
- For each: undo, reset

**Step 3: Test shadow color**

- Click shadow color swatch, type "#ff0000" → shadow color changes, undo, reset

**Step 4: Test shadow visibility and remove**

- Click eye icon → shadow excluded from box-shadow
- Click eye again → shadow included
- Click X → shadow removed, undo (shadow returns)

---

### Task 12: Test Effects Section — TransformEditor

**Fixture:** `fixture-effects`

**Step 1: Add a transform**

- Click "+" on "2D & 3D transforms" SubSectionHeader
- Assert: `getComputedStyle(el).transform` is not `none`

**Step 2: Test transform type switching**

- Default is "translate" — drag X axis slider → translate X changes
- Click "rotate" segment → `transform` contains `rotate()`, undo, reset
- Click "scale" segment → `transform` contains `scale()`, undo, reset
- Click "skew" segment → `transform` contains `skew()`, undo, reset

**Step 3: Test axis sliders**

With translate selected:
- Type "50" in X slider/input → `transform` includes `translateX(50px)`, undo, reset
- Type "30" in Y slider/input → `transform` includes `translateY(30px)`, undo, reset

**Step 4: Test transform settings**

- Click "hidden" in Backface visibility → `backface-visibility: hidden`, undo, reset
- Drag Perspective slider to ~500 → `perspective: 500px`, undo, reset

**Step 5: Test transform origin**

- Click top-left cell in TransformOriginPicker → `transform-origin: 0% 0%`, undo, reset

**Step 6: Remove transform**

- Click X → transform removed, undo (restored)

---

### Task 13: Test Effects Section — TransitionEditor + FilterSliders

**Fixture:** `fixture-effects`

**Step 1: Add a transition**

- Click "+" on "Transitions" SubSectionHeader
- Assert: `getComputedStyle(el).transition` is non-empty

**Step 2: Test transition fields**

- Type "opacity" in Property field → `transition-property` includes `opacity`, undo, reset
- Type "300" in Duration field → duration changes, undo, reset
- Select "ease-in-out" from Easing dropdown → `transition-timing-function: ease-in-out`, undo, reset
- Type "100" in Delay field → delay changes, undo, reset

**Step 3: Test transition visibility and remove**

- Click eye → transition excluded
- Click X → transition removed, undo

**Step 4: Add a filter**

- Click "+" on "Filters" SubSectionHeader
- Select "Blur" from categorized dropdown
- Assert: `getComputedStyle(el).filter` contains `blur`

**Step 5: Test filter value**

- Drag blur radius slider to ~5px or type "5" → `filter: blur(5px)`, undo, reset

**Step 6: Test other filter types**

- Add brightness filter, adjust slider → `filter` contains `brightness(...)`, undo, remove
- Add grayscale filter, adjust slider → `filter` contains `grayscale(...)`, undo, remove

**Step 7: Test filter visibility and remove**

- Click eye on a filter → filter excluded from computed value
- Click X → filter removed, undo

**Step 8: Test backdrop filter**

- Click "+" on "Backdrop filters" SubSectionHeader
- Select "Blur" → `backdrop-filter` contains `blur`, undo, reset

---

### Task 14: Test CSS Variables Section

**Fixture:** `fixture-block` (has inline `--test-color`, `--test-spacing`, etc.)

**Step 1: Select fixture-block, open CSS Variables section**

**Step 2: Test color variable**

- Find `--test-color` ColorRow, click swatch, change to "#ff0000"
- Assert: `getComputedStyle(el).getPropertyValue("--test-color")` changed, undo, reset

**Step 3: Test numeric variable**

- Find `--test-spacing` or `--test-opacity` SliderRow, drag to new value
- Assert: computed property value changed, undo, reset

**Step 4: Test group collapse**

- Click group header (Element/Inherited/Root) → group collapses
- Click again → group expands

---

### Task 15: Test Shell — Header, Footer, Keyboard Shortcuts

**Step 1: Test Header controls**

With any element selected:
- Click a breadcrumb parent segment → panel switches to parent element (verify by reading element tag)
- Click pin icon → verify pinned state (panel stays open when clicking outside)
- Click X → panel closes

**Step 2: Re-open panel and test Footer**

- Select fixture-block, make a change (e.g., width → 250px)
- Click Footer "Reset" button → all changes reverted
- Make a change again
- Click Copy dropdown chevron → dropdown appears
- Select "CSS" → clipboard contains CSS (verify via console)

**Step 3: Test Keyboard Shortcuts**

- Press backtick (`) → selector overlay appears
- Press Escape → selector closes
- Select an element, make a change
- Cmd+Z → undo
- Cmd+Shift+Z → redo
- Cmd+K → command palette appears
- Escape → palette closes

---

### Task 16: Test Cross-cutting Control Behaviors

**Step 1: Test UnitSelector**

- Select fixture-block, open Size section
- Click unit badge next to Width (should show "px")
- Select "rem" → width value converts to rem, undo, reset
- Select "%" → width value converts to %, undo, reset

**Step 2: Test ValueInput math**

- In a Size input, type "20+5" and press Enter → value becomes 25, undo, reset

**Step 3: Test Alt-click reset**

- Make a change to any property (so indicator dot appears)
- Alt+click the property label → property resets to original

**Step 4: Test mouse wheel adjustment**

- Focus a numeric input (e.g., border width)
- Scroll up → value increases
- Scroll down → value decreases

**Step 5: Test Color Picker full interaction**

- Click any color swatch → picker opens
- Drag on HSB canvas → color changes
- Drag hue slider → hue changes
- Drag opacity slider → alpha changes
- Type hex value → color updates
- Click outside → picker closes

---

### Task 17: Final verification and summary

**Step 1: Tally results**

Count pass/fail across all tasks. Each test case has 3 assertions (apply, undo, reset).

**Step 2: Document any failures**

For each failure, note:
- Section and control name
- Expected vs actual value
- Whether it's a test issue or a real bug

**Step 3: Commit test fixture**

```bash
git add test-app/app/test-fixture/page.tsx
git commit -m "feat: add browser test fixture page with all element types"
```
