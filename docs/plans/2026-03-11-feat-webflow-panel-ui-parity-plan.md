---
title: "feat: Complete Webflow Panel UI Parity"
type: feat
date: 2026-03-11
---

# Complete Webflow Panel UI Parity

## Overview

Implement the remaining 14 UI gaps to achieve full visual and interaction parity with Webflow's CSS style panel. The Redial panel currently has all 8 sections (Layout, Spacing, Size, Position, Typography, Backgrounds, Borders, Effects) with core controls, but is missing secondary controls, keyboard interactions, and visual polish that make Webflow's panel distinctive.

## Problem Statement

The panel works but feels incomplete compared to Webflow:
- Missing fine-grained input interactions (Alt+Arrow, font-family picker)
- Missing contextual controls (aspect-ratio, object-position, typography advanced)
- No visual hierarchy indicators (StyleIndicator dots)
- No keyboard-driven workflow (shortcuts, tab navigation)
- Spacing box model lacks the warm/cool color differentiation that makes it scannable

## Already Completed (Iterations 1-4)

- [x] LabelScrub on all SliderRow labels (drag-to-scrub)
- [x] UnitSelector on Size, Position, Typography sliders
- [x] Grid track editors (columns/rows text inputs)
- [x] Float/clear dropdowns in Position section
- [x] StateSelector dropdown in Header for pseudo-class targeting

## Implementation Phases

### Phase 1: Input Primitives (No dependencies, enables everything else)

These enhance the core ValueInput/SliderRow components used by every section.

#### Task 3: Alt+Arrow fine-grained steps in ValueInput
- **File**: `src/overlay/WebflowPanel.tsx` — `ValueInput` component (~line 380-417)
- **Change**: Add `e.altKey` check in `handleKeyDown` for +-0.1 step
- **Spec ref**: Section 13 — Input Interactions table
- **Code sketch**:
  ```tsx
  // In handleKeyDown:
  const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
  if (e.key === "ArrowUp") onChange(value + step);
  if (e.key === "ArrowDown") onChange(value - step);
  ```
- **Size**: ~5 lines changed

#### Task 12: Font-family dropdown in Typography
- **File**: `src/overlay/WebflowPanel.tsx` — Typography section (~line 1165)
- **Change**: Add `fontFamily` state, read from `cs.fontFamily`, add SelectRow with common web fonts
- **New state**: `fontFamily`, `handleFontFamilyChange`
- **Options**: Inter, system-ui, Georgia, Times New Roman, Courier New, monospace, sans-serif, serif
- **Spec ref**: Section 7 — font-family row (searchable dropdown, but SelectRow sufficient for v1)
- **Size**: ~20 lines added

### Phase 2: Layout + Size Controls (Independent of each other)

#### Task 4: Flex-direction toggle buttons
- **File**: `src/overlay/WebflowPanel.tsx` — Layout section (~line 1088)
- **Change**: Replace `<SelectRow label="Direction" ...>` with `<IconButtonGroup>` using direction arrow icons
- **Icons**: Row (→), Column (↓), Row-Reverse (←), Col-Reverse (↑) as inline SVGs
- **Spec ref**: Section 3 — "Direction: [→ Row] [↓ Col] ← toggle"
- **Size**: ~30 lines (4 SVG icon definitions + IconButtonGroup wiring)

#### Task 6: Order control for flex children
- **File**: `src/overlay/WebflowPanel.tsx` — Flex child section (~line 1124)
- **Change**: Add `order` state initialized from `cs.order`, add handler, add SliderRow
- **New state**: `order`, `handleOrderChange`
- **Spec ref**: Section 3 — "Order: [─────●────] 0"
- **Size**: ~8 lines added

#### Task 7: Size auto/none keyword toggles
- **File**: `src/overlay/WebflowPanel.tsx` — Size section (~line 1139-1147)
- **Change**: Add keyword toggle buttons beside width/height/max-width/max-height sliders
- **UI**: Small "auto"/"none" pill button that, when active, hides the slider and shows the keyword
- **New state**: `widthKeyword`, `heightKeyword`, etc. (or fold into existing state by checking for "auto"/"none")
- **Approach**: Add a `KeywordToggle` inline component: if keyword is active, show pill; if not, show SliderRow
- **Spec ref**: Section 5 — width/height values include "auto", max-width/max-height include "none"
- **Size**: ~40 lines (KeywordToggle component + 6 instances)

#### Task 8: Aspect-ratio control
- **File**: `src/overlay/WebflowPanel.tsx` — Size section (~line 1147)
- **Change**: Add `aspectRatio` state from `cs.aspectRatio`, add TextRow for free-form input
- **Values**: "auto", "16 / 9", "4 / 3", "1 / 1", custom
- **Spec ref**: Section 5 — "aspect-ratio: e.g., 16 / 9, auto"
- **Size**: ~12 lines added

#### Task 9: Object-position for media elements
- **File**: `src/overlay/WebflowPanel.tsx` — Size section (~line 1147)
- **Change**: Detect media elements (img, video, canvas), show object-position TextRow
- **Condition**: `isMediaElement(element)` — check tag name
- **Values**: "center", "top left", "bottom right", or custom "50% 50%"
- **Spec ref**: Section 5 — "Only for img, video, canvas"
- **Size**: ~15 lines added

### Phase 3: Position + Typography Enhancements (Independent of each other)

#### Task 10: Position visual offset diagram
- **File**: New component or inline in `WebflowPanel.tsx` — Position section (~line 1152)
- **Change**: Replace 4 SliderRows (top/right/bottom/left) with a visual box diagram similar to SpacingBoxModel
- **Component**: `PositionOffsetDiagram` — nested rectangles with clickable/editable values on each side
- **Visual**: Outer rectangle with [top], [right], [bottom], [left] values positioned around a center box
- **Reuse**: Follow SpacingBoxModel's EditableValue pattern for click-to-edit + arrow key increment
- **Spec ref**: Section 6 — visual offset diagram
- **Size**: ~120 lines (new component, similar structure to SpacingBoxModel)

#### Task 13: Typography Advanced collapsed sub-section
- **File**: `src/overlay/WebflowPanel.tsx` — Typography section (~after line 1218)
- **Change**: Add a nested `<Section title="Advanced" collapsed>` inside Typography with new controls
- **New state variables**: `wordSpacing`, `whiteSpace`, `textIndent`, `wordBreak`, `columnCount`
- **New handlers**: 5 handlers following the existing pattern
- **Controls**:
  - Word Spacing — SliderRow (0-20px)
  - White Space — SelectRow (normal, nowrap, pre, pre-wrap, pre-line)
  - Text Indent — SliderRow (0-100px)
  - Word Break — SelectRow (normal, break-all, keep-all, break-word)
  - Columns — SliderRow (1-6, step 1)
- **Spec ref**: Section 7 — Advanced typography sub-section
- **Size**: ~50 lines (5 state vars + 5 handlers + 5 control rows)

### Phase 4: Spacing Polish (Independent, visual-only)

#### Task 15: Spacing color zones
- **File**: `src/overlay/SpacingBoxModel.tsx` — lines 33-36 (margin bg) and 70-73 (padding bg)
- **Change**: Replace neutral backgrounds with warm/cool tints
- **Colors per spec**:
  - Margin: `rgba(255, 165, 80, 0.06)` (warm orange tint)
  - Padding: `rgba(100, 180, 255, 0.06)` (cool blue tint)
  - Content center: `rgba(255, 255, 255, 0.08)` (slightly brighter neutral)
- **Spec ref**: Section 4 — "Margin area: slightly transparent warm tone, Padding area: slightly transparent cool tone"
- **Size**: ~3 lines changed

#### Task 16: Spacing alt+click shortcuts
- **File**: `src/overlay/SpacingBoxModel.tsx` — EditableValue click handler (~line 216)
- **Change**: Check `e.altKey` on click. If alt+click on a side value, set complementary sides. If alt+click on a corner, set all 4 sides.
- **Logic**:
  - Alt+click margin-top → also set margin-bottom to same value
  - Alt+click margin-left → also set margin-right to same value
  - Alt+click on corner of margin box → set all 4 margins
  - Same for padding
- **Spec ref**: Section 4 — "Alt+click side label: applies value to both complementary sides"
- **Size**: ~20 lines added

### Phase 5: Cross-cutting Systems (Depend on understanding all sections)

#### Task 17: StyleIndicator colored dots
- **File**: `src/overlay/WebflowPanel.tsx` — SliderRow, SelectRow, ColorRow label areas
- **File**: `src/overlay/StyleIndicator.tsx` — already built (4px colored dot with type prop)
- **Change**:
  1. Add detection function `getIndicatorType(element, prop)` that compares:
     - Element's inline style (pink = element-level)
     - Computed style vs. parent's computed style (orange = inherited)
     - Whether a class rule sets this property (blue = direct)
     - Whether current pseudo-state has this property (green = state)
  2. Add `<StyleIndicator type={...} />` before label text in SliderRow, SelectRow, ColorRow
- **Complexity**: Detection logic is the hard part — comparing computed values between element and parent, checking for inheritance
- **Spec ref**: Section 11 — Style Indicators table
- **Size**: ~60 lines (detection utility + integration in 3 row components)

#### Task 18: Keyboard shortcuts
- **File**: `src/overlay/Overlay.tsx` — `handleKeyDown` function (~line 102-163)
- **New shortcuts** (added to the existing keydown handler):
  - `S` → cycle scope (element → class → element)
  - `R` → reset current element (call existing `handleReset`)
  - `Cmd+S` → save to source (call existing save flow in Footer)
  - `Cmd+C` → copy CSS (call existing copy flow in Footer)
- **Guard**: All new shortcuts must respect the existing guard (skip in inputs/textareas)
- **Wiring**: `handleReset` already exists. Save/Copy need to be lifted from Footer to Overlay or exposed via ref/callback.
- **Spec ref**: Section 13 — Global Shortcuts table
- **Size**: ~30 lines added to handleKeyDown + possible refactor of Footer actions

#### Task 19: Tab/Shift+Tab navigation within sections
- **File**: `src/overlay/WebflowPanel.tsx` — all row components
- **Change**: Add `tabIndex={0}` to all interactive controls (sliders, inputs, selects, buttons)
- **Behavior**: Tab moves focus to the next control within the same section. Shift+Tab goes backwards. Focus styling: indigo ring (`box-shadow: 0 0 0 2px rgba(99,102,241,0.3)`)
- **Approach**: Each Section component manages a focus group. Add `onKeyDown` at the Section level to intercept Tab and cycle focus within children.
- **Spec ref**: Section 13 — "Tab: Move to next control"
- **Size**: ~40 lines (focus management in Section + tabIndex on controls)

## Dependency Graph

```
Phase 1 (no deps):  [3: Alt+Arrow]  [12: font-family]
                          |
Phase 2 (no deps):  [4: flex-dir toggles]  [6: order]  [7: auto/none]  [8: aspect-ratio]  [9: object-pos]
                          |
Phase 3 (no deps):  [10: offset diagram]  [13: typo advanced]
                          |
Phase 4 (no deps):  [15: color zones]  [16: alt+click]
                          |
Phase 5 (cross-cutting): [17: StyleIndicator]  [18: shortcuts]  [19: tab nav]
```

All phases are actually independent — no task blocks another. The phases are ordered by impact and complexity:
- Phase 1-2: Quick wins, high user impact
- Phase 3: Medium complexity, good UX improvements
- Phase 4: Visual polish, small changes
- Phase 5: System-level features, highest complexity

## Parallelization Strategy

**Maximum parallelism**: Tasks within each phase can all run simultaneously. Tasks across phases can also run in parallel since there are no true dependencies.

**Recommended agent grouping** (by file touched):

| Agent | Tasks | Primary File |
|-------|-------|-------------|
| Agent A | 3, 4, 6, 7, 8, 9, 12, 13 | `WebflowPanel.tsx` — but different sections, so can be split further |
| Agent B | 10 | New `PositionOffsetDiagram` component |
| Agent C | 15, 16 | `SpacingBoxModel.tsx` |
| Agent D | 17 | `StyleIndicator.tsx` + row components |
| Agent E | 18 | `Overlay.tsx` |
| Agent F | 19 | Section focus management |

**Conflict risk**: Multiple agents editing `WebflowPanel.tsx` simultaneously. Mitigate by splitting Agent A into sub-agents that each touch a different section (Layout, Size, Typography).

## Acceptance Criteria

### Functional
- [ ] Alt+Arrow increments values by 0.1
- [ ] Flex-direction shows as icon toggle buttons, not dropdown
- [ ] Flex children show an Order slider
- [ ] Width/Height have auto/none keyword toggles
- [ ] Aspect-ratio text input works on all elements
- [ ] Object-position shows for img/video/canvas elements
- [ ] Position offsets show as visual box diagram (not sliders)
- [ ] Font-family dropdown with common web fonts
- [ ] Typography Advanced sub-section with 5 properties
- [ ] Spacing margin zone is warm-tinted, padding is cool-tinted
- [ ] Alt+click on spacing value sets complementary sides
- [ ] Colored dots appear next to modified property labels
- [ ] S/R/Cmd+S/Cmd+C keyboard shortcuts work
- [ ] Tab/Shift+Tab cycles focus within sections

### Quality Gates
- [ ] `npm run typecheck` passes after all changes
- [ ] No regressions in existing controls
- [ ] All new controls follow the existing handler pattern (useState + useCallback + apply)
- [ ] Inline styles only, dark theme colors, monospace for values

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Multiple agents editing WebflowPanel.tsx | Merge conflicts | Split by section, use worktrees |
| PositionOffsetDiagram complexity | Scope creep | Follow SpacingBoxModel pattern exactly |
| StyleIndicator detection accuracy | False positives | Start with simple inline-style check, iterate |
| Keyboard shortcuts conflict with host app | Broken shortcuts | Use same guard logic as existing shortcuts |
| Tab navigation breaks native browser tab | Accessibility | Only intercept within .__tuner-root |

## References

- **Spec**: `/Users/skylar/code/redial/webflow-style-panel-spec.md` — Sections 3-13
- **Main panel**: `/Users/skylar/code/redial/src/overlay/WebflowPanel.tsx`
- **Overlay (shortcuts)**: `/Users/skylar/code/redial/src/overlay/Overlay.tsx`
- **Spacing**: `/Users/skylar/code/redial/src/overlay/SpacingBoxModel.tsx`
- **StyleIndicator**: `/Users/skylar/code/redial/src/overlay/StyleIndicator.tsx`
- **Conventions**: `/Users/skylar/code/redial/.claude/CLAUDE.md`
