---
title: "Complete Remaining Webflow Panel Spec Items (Phase B + C)"
type: feat
date: 2026-03-11
---

# Complete Remaining Webflow Panel Spec Items (Phase B + C)

## Overview

14 remaining spec items across Phase B (missing controls) and Phase C (cross-cutting polish). Item 7 (flex-direction toggles) is already done. These items complete the Webflow-style CSS panel to full spec parity.

## Remaining Items

### Phase B — Missing Controls (9 items)

| # | Item | Section | Complexity | Files |
|---|------|---------|-----------|-------|
| 8 | Flex child `order` control | Layout | S | `WebflowPanel.tsx` |
| 9 | Typography advanced sub-section | Typography | M | `WebflowPanel.tsx` |
| 10 | Position visual offset diagram | Position | M | New: `PositionOffsetDiagram.tsx`, `WebflowPanel.tsx` |
| 12 | Size auto/none keyword toggles (UI only — state exists) | Size | S | `WebflowPanel.tsx` |
| 13 | `aspect-ratio` control | Size | S | `WebflowPanel.tsx` |
| 14 | `object-position` for media elements | Size | S | `WebflowPanel.tsx` |
| 15 | Spacing color zones (warm margin, cool padding) | Spacing | S | `SpacingBoxModel.tsx` |
| 16 | Spacing alt+click shortcuts | Spacing | M | `SpacingBoxModel.tsx` |

### Phase C — Cross-Cutting Polish (6 items)

| # | Item | Section | Complexity | Files |
|---|------|---------|-----------|-------|
| 18 | Unit conversion logic (px→em, etc.) | All numeric | M | `UnitSelector.tsx`, `WebflowPanel.tsx` |
| 19 | StyleIndicator detection logic | Cross-cutting | L | New: `detectStyleSource.ts`, `StyleIndicator.tsx` |
| 20 | StyleIndicator integration into sections | Cross-cutting | M | `WebflowPanel.tsx` |
| 21 | Keyboard shortcuts (S, R, Cmd+S, Cmd+C) | Cross-cutting | M | `Overlay.tsx` |
| 22 | Tab/Shift+Tab navigation within sections | Cross-cutting | M | `WebflowPanel.tsx` or new focus manager |

## Implementation Plan

### Work Unit 1: Size Section Completion (Items 12, 13, 14) — PARALLEL

Three small, independent additions to the Size section in `WebflowPanel.tsx`.

#### 12. Auto/None Keyword Toggles

State and handlers already exist (`widthAuto`, `heightAuto`, `maxWidthNone`, `maxHeightNone` + toggle handlers). Need to render toggle buttons in the Size section JSX.

```tsx
// src/overlay/WebflowPanel.tsx — Size section
// Add a small toggle button next to each SliderRow
// Pattern: pill button that reads "auto" or "none", toggles keyword
<SliderRow label="Width" ... disabled={widthAuto} />
// Add: <KeywordToggle label="auto" active={widthAuto} onClick={handleWidthAutoToggle} />
```

- Add `KeywordToggle` inline component (small pill button, ~15 lines)
- Render next to Width, Height (auto), Max W, Max H (none)
- When active: disable slider, show keyword text in value position

#### 13. Aspect Ratio Control

```tsx
// src/overlay/WebflowPanel.tsx
// New state:
const [aspectRatio, setAspectRatio] = useState(() => cs.aspectRatio || "auto");

// New handler:
const handleAspectRatioChange = useCallback((v: string) => {
  setAspectRatio(v);
  apply("aspect-ratio", v);
}, [apply]);

// Render: TextRow or SelectRow with common presets
// Options: "auto", "1 / 1", "16 / 9", "4 / 3", "3 / 2", "custom"
```

#### 14. Object Position for Media Elements

```tsx
// src/overlay/WebflowPanel.tsx
// Detect media: const isMedia = element.tagName === 'IMG' || element.tagName === 'VIDEO' || element.tagName === 'CANVAS';
// New state:
const [objectPosition, setObjectPosition] = useState(() => cs.objectPosition || "center");

// Render: SelectRow with position presets (center, top, bottom, left, right, top left, etc.)
// Only render when isMedia is true
```

### Work Unit 2: Layout Order Control (Item 8) — PARALLEL

Small addition to the flex child section.

```tsx
// src/overlay/WebflowPanel.tsx — Layout section, inside parentIsFlex block
// New state:
const [order, setOrder] = useState(() => parseInt(cs.order) || 0);

// New handler:
const handleOrderChange = useCallback((v: number) => {
  setOrder(v);
  apply("order", String(v));
}, [apply]);

// Render: SliderRow label="Order" value={order} min={-10} max={100} step={1} unit=""
// Add after Align Self in the flex child section
```

### Work Unit 3: Typography Advanced Sub-section (Item 9) — PARALLEL

Collapsed sub-section within Typography with 7 controls.

```tsx
// src/overlay/WebflowPanel.tsx — Typography section
// New state:
const [wordSpacing, setWordSpacing] = useState(() => parseNum(cs.wordSpacing));
const [whiteSpace, setWhiteSpace] = useState(() => cs.whiteSpace);
const [textIndent, setTextIndent] = useState(() => parseNum(cs.textIndent));
const [wordBreak, setWordBreak] = useState(() => cs.wordBreak || "normal");
const [columnCount, setColumnCount] = useState(() => parseInt(cs.columnCount) || 1);
const [columnGap, setColumnGap] = useState(() => parseNum(cs.columnGap));

// Add collapsed section using existing Section pattern with collapsed prop
// Use a sub-header row with toggle chevron, starting collapsed:
// ── Advanced ── ▸ (click to expand)
//   Word Spacing  [slider] [0] [px]
//   White Space   [dropdown]
//   Text Indent   [slider] [0] [px]
//   Word Break    [dropdown]
//   Columns       [slider] [1]
//   Column Gap    [slider] [0] [px]
```

Constants needed:
```tsx
const WHITE_SPACE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "nowrap", label: "No Wrap" },
  { value: "pre", label: "Pre" },
  { value: "pre-wrap", label: "Pre Wrap" },
  { value: "pre-line", label: "Pre Line" },
  { value: "break-spaces", label: "Break Spaces" },
];

const WORD_BREAK_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "break-all", label: "Break All" },
  { value: "keep-all", label: "Keep All" },
  { value: "break-word", label: "Break Word" },
];
```

### Work Unit 4: Position Offset Diagram (Item 10)

New component similar to `SpacingBoxModel.tsx` but for position offsets.

```
// New file: src/overlay/PositionOffsetDiagram.tsx
// Pattern: mirror SpacingBoxModel structure
// ┌───────────────────────┐
// │        [top: 0]       │
// │  [l: 0] ┌────┐ [r: 0]│
// │         │    │        │
// │        [bottom: 0]    │
// └───────────────────────┘

interface PositionOffsetDiagramProps {
  top: number;
  right: number;
  bottom: number;
  left: number;
  onChange: (side: string, value: number) => void;
}
```

- Reuses `EditableValue` pattern from SpacingBoxModel
- Single nested box with clickable values on each edge
- Only shown when position !== static (already gated in WebflowPanel)
- Replace the 4 SliderRows for top/right/bottom/left with this diagram

### Work Unit 5: Spacing Enhancements (Items 15, 16) — PARALLEL

#### 15. Color Zones

```tsx
// src/overlay/SpacingBoxModel.tsx
// Margin box: background: "rgba(255, 152, 0, 0.06)" (warm orange tint)
// Padding box: background: "rgba(59, 130, 246, 0.06)" (cool blue tint)
// Content center: keep "rgba(255,255,255,0.06)"
// Hover highlights: same colors but higher opacity (0.15)
```

#### 16. Alt+Click Shortcuts

```tsx
// src/overlay/SpacingBoxModel.tsx — EditableValue
// On click: check if altKey is held
// altKey + click on a side value → apply to complementary side too
//   e.g., click margin-left with alt → also set margin-right
// altKey + click on a corner → apply to all 4 sides
//
// Implementation:
// - Pass `altKey` context from click event
// - EditableValue onClick handler checks e.altKey
// - If alt: call onChange for complementary sides
// Need to pass prop: onAltClick?: (value: number, sides: string[]) => void
```

### Work Unit 6: Unit Conversion Logic (Item 18) — SEQUENTIAL (after Unit 1)

When user changes units in `UnitSelector`, convert the current value.

```tsx
// src/overlay/UnitSelector.tsx or new utility: src/overlay/unitConversion.ts
// Conversion functions:
// px → em: value / parentFontSize (or rootFontSize for rem)
// px → %: (value / parentDimension) * 100
// px → vw: (value / viewportWidth) * 100
// em → px: value * parentFontSize
// etc.

// Need element context to compute conversions
// UnitSelector gets optional `element` prop for computing parent/root sizes

function convertUnit(value: number, fromUnit: string, toUnit: string, context: {
  parentFontSize: number;
  rootFontSize: number;
  parentWidth: number;
  parentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}): number
```

- Add `onUnitChangeWithConversion` callback to SliderRow
- When unit changes: compute new value, update both unit and numeric value

### Work Unit 7: StyleIndicator System (Items 19, 20) — SEQUENTIAL

#### 19. Detection Logic

New file: `src/overlay/detectStyleSource.ts`

```tsx
// Determine whether a CSS property value is:
// - "direct" (set on current element's inline/class styles)
// - "inherited" (cascading from parent)
// - "state" (pseudo-class specific)
// - "element" (inline override, element scope)
// - "none" (browser default)

function detectStyleSource(
  element: Element,
  property: string,
  scope: "element" | "class",
  activeState: string | null,
): IndicatorType {
  const computed = getComputedStyle(element);
  const value = computed.getPropertyValue(property);
  const defaultValue = getDefaultValue(property);

  // If element scope → any non-default is "element" (pink)
  if (scope === "element") {
    return value !== defaultValue ? "element" : "none";
  }

  // If a state is active → green for state-specific
  if (activeState && activeState !== "none") {
    // Compare computed with vs without pseudo
    return "state";
  }

  // Check if parent has same value (inherited)
  const parent = element.parentElement;
  if (parent) {
    const parentValue = getComputedStyle(parent).getPropertyValue(property);
    if (value === parentValue && isInheritableProperty(property)) {
      return "inherited";
    }
  }

  // If different from parent/default → direct
  return value !== defaultValue ? "direct" : "none";
}
```

#### 20. Integration

- Wrap each property label in SliderRow/SelectRow/ColorRow with StyleIndicator
- Pass detection result as `type` prop
- Need to thread `element`, `scope`, and `activeState` into inner components
- SliderRow/SelectRow get optional `indicatorType` prop

### Work Unit 8: Keyboard Shortcuts (Item 21) — PARALLEL

Add to existing `handleKeyDown` in `Overlay.tsx`:

```tsx
// src/overlay/Overlay.tsx — inside handleKeyDown
// New shortcuts (only when panel is open, no input focused):

// S → cycle scope (element → class → element)
if (e.key === "s" && !insideInput) {
  // cycle scope state
}

// R → reset current element
if (e.key === "r" && !insideInput) {
  // call restoreAllOverrides()
}

// Cmd+S → save to source
if ((e.metaKey || e.ctrlKey) && e.key === "s") {
  e.preventDefault();
  // trigger save action from Footer
}

// Cmd+C → copy CSS (when panel focused)
if ((e.metaKey || e.ctrlKey) && e.key === "c" && !insideInput) {
  // copy computed overrides as CSS text to clipboard
}
```

### Work Unit 9: Tab Navigation (Item 22) — SEQUENTIAL (after Unit 7)

Focus management within sections.

```tsx
// Approach: each interactive control gets tabIndex={0}
// Section component manages focus group
// Tab → next control in section
// Shift+Tab → previous control
// ArrowDown/Up → next/previous section

// Implementation in WebflowPanel.tsx:
// - Add tabIndex={0} to SliderRow inputs, SelectRow selects, ColorRow swatches
// - Use data-section attribute on section containers
// - Add onKeyDown handler at section level that intercepts Tab
//   and moves focus to next/previous focusable child
```

## Execution Order for Swarm

### Parallel Batch 1 (7 agents, all independent):

1. **Agent: Size Completion** → Items 12, 13, 14 in `WebflowPanel.tsx`
2. **Agent: Layout Order** → Item 8 in `WebflowPanel.tsx`
3. **Agent: Typography Advanced** → Item 9 in `WebflowPanel.tsx`
4. **Agent: Position Offset Diagram** → Item 10, new `PositionOffsetDiagram.tsx` + wire into `WebflowPanel.tsx`
5. **Agent: Spacing Colors** → Item 15 in `SpacingBoxModel.tsx`
6. **Agent: Spacing Alt-Click** → Item 16 in `SpacingBoxModel.tsx`
7. **Agent: Keyboard Shortcuts** → Item 21 in `Overlay.tsx`

### Sequential Batch 2 (after Batch 1):

8. **Agent: Unit Conversion** → Item 18, `UnitSelector.tsx` + `WebflowPanel.tsx`

### Sequential Batch 3 (after Batch 2):

9. **Agent: StyleIndicator Detection** → Item 19, new `detectStyleSource.ts`
10. **Agent: StyleIndicator Integration** → Item 20, `WebflowPanel.tsx`

### Sequential Batch 4 (after Batch 3):

11. **Agent: Tab Navigation** → Item 22, `WebflowPanel.tsx`

## Acceptance Criteria

- [ ] All 14 items pass `npm run typecheck`
- [ ] No regressions to existing sections (Layout, Size, Position, Typography, Spacing, Borders, Effects, Backgrounds)
- [ ] StyleIndicator dots visible next to property labels, correct colors
- [ ] Keyboard shortcuts S/R/Cmd+S/Cmd+C functional when panel open
- [ ] Tab navigation cycles through controls within a section
- [ ] Unit conversion preserves visual value when switching units (e.g., 16px → 1em)
- [ ] Position offset diagram matches SpacingBoxModel visual style
- [ ] Typography advanced section starts collapsed, expands on click
- [ ] Spacing box model shows warm (orange) margin zones, cool (blue) padding zones

## Technical Considerations

- **WebflowPanel.tsx is 1500+ lines**: Each agent modifying it should work on clearly separated sections to minimize merge conflicts
- **State count**: Already ~50 state variables. Items 9+19 add ~10 more. Consider grouping related state into reducer pattern in a follow-up
- **Performance**: `detectStyleSource` calls `getComputedStyle` per property — cache per render cycle
- **Existing patterns**: All UI is inline-styled React, dark theme colors, monospace values, 300px panel width — maintain consistency

## References

- Spec: `webflow-style-panel-spec.md` (sections 3-7, 11-13)
- Existing components: `SpacingBoxModel.tsx:26`, `StyleIndicator.tsx:28`, `UnitSelector.tsx`, `Overlay.tsx:105`
- Constants: `WebflowPanel.tsx:833` (FLEX_DIRECTION_ICONS pattern for toggle buttons)
