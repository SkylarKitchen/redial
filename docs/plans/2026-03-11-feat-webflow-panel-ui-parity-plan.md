---
title: "feat: Complete Webflow Panel UI Parity"
type: feat
date: 2026-03-11
deepened: 2026-03-11
---

# Complete Webflow Panel UI Parity

## Enhancement Summary

**Deepened on:** 2026-03-11
**Agents used:** SpecFlow Analyzer, Code Simplicity Reviewer, TypeScript Reviewer, Performance Oracle, Architecture Strategist, Pattern Recognition, Frontend Races Reviewer, Best Practices Researcher

### Key Improvements from Deepening
1. **Removed 1 task**: Task 7 (auto/none keyword toggles) already implemented in codebase — state + handlers exist at lines 928-931 and 1136-1158, only JSX rendering needed
2. **Simplified Task 17**: StyleIndicator detection reduced from full cascade resolution to simple `isDirty` heuristic — checking `el.style.getPropertyValue(prop)` is sufficient for a tuning tool
3. **Identified 3 critical architectural gaps**: StateSelector has no effect on style application (inline styles can't target :hover), unit conversion is missing on already-shipped selectors, auto/none detection impossible via getComputedStyle alone
4. **Resolved 7 ambiguities**: flex-direction button count, order control type, offset diagram vs sliders, font list source, Tab navigation scope, alt+click targets, Cmd+S guard conditions
5. **Revised parallelization strategy**: WebflowPanel.tsx tasks split by section to avoid merge conflicts

### Critical Decisions Made
- **StateSelector wiring (pseudo-class styles)**: Deferred — requires `<style>` tag injection, fundamentally different from `applyInlineStyle()`. The dropdown UI is already shipped; wiring it to actually apply pseudo-class styles is a separate feature.
- **Unit conversion**: Deferred — keep numeric value unchanged when switching units, add TODO. Proper conversion requires knowing parent font-size (em), containing block (%), viewport width (vw).
- **Position offset diagram**: Replaces SliderRows entirely (not coexist).
- **Flex-direction**: 4 toggle buttons in one row (no sub-menu).
- **Tab navigation**: Natural browser Tab order with tabIndex, no section trapping.
- **StyleIndicator**: Simple heuristic only — pink dot for inline overrides, nothing else.

---

## Overview

Implement the remaining 13 UI gaps to achieve visual and interaction parity with Webflow's CSS style panel. The panel has all 8 sections with core controls, but needs secondary controls, keyboard interactions, and visual polish.

## Problem Statement

The panel works but feels incomplete compared to Webflow:
- Missing fine-grained input interactions (Alt+Arrow, font-family picker)
- Missing contextual controls (aspect-ratio, object-position, typography advanced)
- No visual override indicators (StyleIndicator dots)
- No keyboard-driven workflow (shortcuts, tab navigation)
- Spacing box model lacks warm/cool color zones

## Already Completed (Iterations 1-4)

- [x] LabelScrub on all SliderRow labels (drag-to-scrub)
- [x] UnitSelector on Size, Position, Typography sliders
- [x] Grid track editors (columns/rows text inputs)
- [x] Float/clear dropdowns in Position section
- [x] StateSelector dropdown in Header (UI only — pseudo-class application deferred)
- [x] Auto/none keyword state + handlers in Size section (state exists, needs JSX rendering)

## Implementation Phases

### Phase 1: Input Primitives (Zero dependencies, quick wins)

#### Task 3: Alt+Arrow fine-grained steps in ValueInput
- **File**: `src/overlay/WebflowPanel.tsx` — `ValueInput` component (~line 380-417)
- **Change**: Add `e.altKey` check in `handleKeyDown` for +-0.1 step
- **Spec ref**: Section 13 — Input Interactions table
- **Code**:
  ```tsx
  // In handleKeyDown, replace existing ArrowUp/Down logic:
  const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
  if (e.key === "ArrowUp") { e.preventDefault(); onChange(Math.round((value + step) * 10) / 10); }
  if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.round((value - step) * 10) / 10); }
  ```
- **Size**: ~5 lines changed

> **Research insight**: Use `Math.round(x * 10) / 10` to avoid floating-point artifacts like `0.30000000000000004` when incrementing by 0.1. Also apply this to SpacingBoxModel's `EditableValue` at line 164 for consistency.

> **Race condition note**: Alt+Arrow in ValueInput vs Alt modifier in LabelScrub are separate input modes (keyboard vs mouse drag) so they don't conflict. However, ensure `e.stopPropagation()` in ValueInput's keydown so the Overlay handler doesn't also process arrow keys.

#### Task 12: Font-family dropdown in Typography
- **File**: `src/overlay/WebflowPanel.tsx` — Typography section (~line 1165)
- **Change**: Add `fontFamily` state, read from `cs.fontFamily`, add SelectRow
- **Font list strategy**: Use `document.fonts` API to enumerate loaded page fonts, plus hardcoded fallbacks
- **Code**:
  ```tsx
  // Build font list from page's loaded fonts + fallbacks
  const FALLBACK_FONTS = ["system-ui", "Georgia", "Times New Roman", "Courier New", "monospace", "sans-serif", "serif"];
  const pageFonts: string[] = [];
  try { document.fonts.forEach(f => { if (!pageFonts.includes(f.family)) pageFonts.push(f.family); }); } catch {}
  const FONT_OPTIONS = [...new Set([...pageFonts, ...FALLBACK_FONTS])].map(f => ({ value: f, label: f }));
  ```
- **Size**: ~25 lines added

> **Research insight**: `document.fonts` is well-supported (baseline 2020+). Returns FontFace objects with `.family`. For the initial render, compute font list lazily since `document.fonts` may not be fully loaded — wrap in a `useEffect` with `document.fonts.ready.then(...)`.

### Phase 2: Layout + Size Controls (All independent, parallelizable)

#### Task 4: Flex-direction toggle buttons
- **File**: `src/overlay/WebflowPanel.tsx` — Layout section (~line 1088)
- **Change**: Replace `<SelectRow label="Direction" ...>` with `<IconButtonGroup>` + 4 arrow icon SVGs
- **Decision**: 4 buttons in one row (Row/Col/Row-Reverse/Col-Reverse), not 2+submenu
- **Code**:
  ```tsx
  const FLEX_DIR_ICONS = [
    { value: "row", title: "Row", icon: <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8M8 3l3 3-3 3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg> },
    { value: "column", title: "Column", icon: <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 2v8M3 8l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg> },
    { value: "row-reverse", title: "Row Reverse", icon: <svg width="12" height="12" viewBox="0 0 12 12"><path d="M10 6H2M4 3L1 6l3 3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg> },
    { value: "column-reverse", title: "Col Reverse", icon: <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 10V2M3 4l3-3 3 3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg> },
  ];
  // Replace SelectRow with:
  <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
    <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>Direction</span>
    <IconButtonGroup options={FLEX_DIR_ICONS} value={flexDirection} onChange={handleFlexDirectionChange} />
  </div>
  ```
- **Size**: ~25 lines

#### Task 6: Order control for flex children
- **File**: `src/overlay/WebflowPanel.tsx` — Flex child section (~line 1124)
- **Change**: Add `order` state + handler + ValueInput (not SliderRow — spec says "Number input")
- **Decision**: Plain number input, not a slider (order is discrete, range is unusual)
- **Code**:
  ```tsx
  const [order, setOrder] = useState(() => parseInt(cs.order) || 0);
  const handleOrderChange = useCallback((v: number) => { setOrder(v); apply("order", String(v)); }, [apply]);
  // In flex child section, after align-self:
  <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
    <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>Order</span>
    <ValueInput value={order} onChange={handleOrderChange} />
  </div>
  ```
- **Size**: ~10 lines

#### Task 7: Size auto/none keyword toggle JSX (state already exists)
- **File**: `src/overlay/WebflowPanel.tsx` — Size section (~line 1139-1147)
- **Change**: Add conditional rendering — if keyword is active, show pill instead of slider
- **Detection**: Check `el.style.getPropertyValue('width')` — if empty string, assume keyword (auto/none)
- **Code sketch**:
  ```tsx
  // For each size property, wrap SliderRow in a conditional:
  {widthKeyword === "auto" ? (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
      <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>Width</span>
      <button onClick={() => { setWidthKeyword(null); }} style={{ ...pillStyle, background: "#6366f1", color: "#fff" }}>auto</button>
    </div>
  ) : (
    <SliderRow label="Width" value={width} min={0} max={1920} step={1} unit="px" onChange={handleWidthChange} />
    // + small "auto" button to toggle back
  )}
  ```
- **Size**: ~30 lines (conditional rendering for 4-6 properties)

> **Research insight**: `getComputedStyle` resolves "auto" to pixels, so you cannot detect "auto" from computed style alone. Use `el.style.getPropertyValue(prop)` to check for inline overrides. If no inline override exists, check initial element characteristics (block elements default to auto width, max-width defaults to none).

#### Task 8: Aspect-ratio control
- **File**: `src/overlay/WebflowPanel.tsx` — Size section, after overflow
- **New state**: `aspectRatio` from `cs.aspectRatio`
- **Control**: TextRow (free-form text input) since values like "16 / 9" aren't numeric
- **Size**: ~12 lines

#### Task 9: Object-position for media elements
- **File**: `src/overlay/WebflowPanel.tsx` — Size section, conditional on media element
- **Detection**: `const isMedia = ["img", "video", "canvas"].includes(element.tagName.toLowerCase())`
- **Control**: SelectRow with presets (center, top left, etc.) — simpler than a 2D picker for v1
- **Size**: ~15 lines

### Phase 3: Position + Typography Enhancements (Independent)

#### Task 10: Position visual offset diagram
- **File**: New `src/overlay/PositionOffsetDiagram.tsx`
- **Decision**: Replaces the 4 SliderRows for top/right/bottom/left entirely
- **Component**: Follows SpacingBoxModel pattern exactly — nested rectangles, EditableValue on each side
- **Visual**: Single rectangle with top/right/bottom/left values positioned around a center "element" box
- **Props**: `top`, `right`, `bottom`, `left`, `onChange(prop, value)` — same signature as SpacingBoxModel
- **Key difference from SpacingBoxModel**: Only 1 layer of offsets (not 2 nested layers for margin/padding), and values can be negative
- **Size**: ~100 lines (simpler than SpacingBoxModel since it's single-layer)

> **Research insight**: Keep unit selectors on the values. Each EditableValue should accept an optional unit prop. Follow the existing pattern where handlers compose `${value}${unit}`.

#### Task 13: Typography Advanced collapsed sub-section
- **File**: `src/overlay/WebflowPanel.tsx` — Typography section, after font-style toggle
- **Change**: Add nested `<Section title="Advanced" collapsed>` with 5 controls
- **Visual tweak**: Use a lighter border and smaller title for the nested Section to differentiate from top-level sections
- **Controls**:
  - Word Spacing — SliderRow (0-20px)
  - White Space — SelectRow (normal, nowrap, pre, pre-wrap, pre-line)
  - Text Indent — SliderRow (0-100px)
  - Word Break — SelectRow (normal, break-all, keep-all, break-word)
  - Columns — SliderRow (1-6, step 1)
- **Omitted for v1**: Hyphens, direction, column-gap, text-shadow (text-shadow would need ShadowEditor modification to hide spread field)
- **Size**: ~50 lines (5 state vars + 5 handlers + 5 control rows)

### Phase 4: Spacing Polish (Visual-only, minimal risk)

#### Task 15: Spacing color zones
- **File**: `src/overlay/SpacingBoxModel.tsx` — background color values
- **Colors**:
  - Margin: `rgba(255, 152, 87, 0.08)` (warm orange)
  - Padding: `rgba(87, 168, 255, 0.08)` (cool blue)
  - Content: `rgba(255, 255, 255, 0.08)` (neutral)
- **Size**: 3 lines changed

#### Task 16: Spacing alt+click shortcuts
- **File**: `src/overlay/SpacingBoxModel.tsx` — EditableValue click handler
- **Target**: Alt+click on the value itself (not a separate label — SpacingBoxModel has no side labels)
- **Logic**: When entering edit mode via click, check `e.altKey`:
  - If alt+click on a top/bottom value → call `onChange` for both top and bottom with current value
  - If alt+click on a left/right value → call `onChange` for both left and right with current value
- **Code**:
  ```tsx
  // In EditableValue's click handler:
  const handleClick = (e: React.MouseEvent) => {
    if (e.altKey && onAltClick) {
      onAltClick(value); // parent provides the complementary-side logic
      return;
    }
    setEditing(true);
  };
  ```
- **Size**: ~20 lines

> **Race condition note**: Alt+click calls onChange multiple times (e.g., margin-top and margin-bottom). Since these are synchronous `el.style.setProperty` calls via `applyInlineStyle`, there's no batching concern — both apply immediately within the same frame.

### Phase 5: Cross-cutting Systems (Higher complexity)

#### Task 17: StyleIndicator colored dots (simplified)
- **File**: `src/overlay/WebflowPanel.tsx` — SliderRow, SelectRow, ColorRow label areas
- **Detection**: Simple `isDirty` heuristic only:
  ```tsx
  function getIndicatorType(el: Element, prop: string): "element" | "none" {
    return (el as HTMLElement).style.getPropertyValue(prop) !== "" ? "element" : "none";
  }
  ```
- **Integration**: Add `<StyleIndicator type={getIndicatorType(element, prop)} />` before label text in row components
- **Why simplified**: Full cascade resolution (blue/orange/green) requires CSSOM walking across potentially cross-origin stylesheets. For a tuning tool, "I changed this" (pink dot) vs "I didn't" (no dot) is the useful distinction.
- **Future**: Can enhance detection later to check matched CSS rules for blue/orange
- **Size**: ~20 lines

#### Task 18: Keyboard shortcuts
- **File**: `src/overlay/Overlay.tsx` — `handleKeyDown` function (~line 102-163)
- **New shortcuts**:
  - `S` → cycle scope: `onScopeChange(scope === "element" ? "class" : "element")`
  - `R` → reset: call existing `handleReset()`
  - `Cmd+S` → save: need to lift save action from Footer or expose via callback
  - `Cmd+C` → copy CSS: need to lift copy action from Footer or expose via callback
- **Guard rules**:
  - S and R: Only fire when focus is NOT in input/textarea/select AND NOT inside `.__tuner-root` (same as existing shortcuts). This means they work when user clicks on the page, not when interacting with the panel.
  - Cmd+S: Fire when `selectedEl` exists AND panel has changes (`totalOverrideCount() > 0`). Must `e.preventDefault()` to block browser save dialog.
  - Cmd+C: Fire when `selectedEl` exists. Must `e.preventDefault()` to block browser copy.
- **Wiring**: Lift `handleSave` and `handleCopyCss` from Footer.tsx into Overlay.tsx (or pass them down as props and also call them from the keyboard handler).
- **Size**: ~30 lines in Overlay.tsx + refactor of Footer action functions

> **Research insight**: For Cmd+S, place the check BEFORE the existing input guard (lines 121-124) — Cmd+S should work even when focus is in a panel input, similar to how Cmd+Z already bypasses the guard at line 107.

#### Task 19: Tab/Shift+Tab navigation
- **File**: `src/overlay/WebflowPanel.tsx` — all interactive controls
- **Approach**: Use natural browser Tab order via `tabIndex={0}` on all interactive controls. No custom focus trapping.
- **Changes**:
  1. Add `tabIndex={0}` to: ValueInput `<input>`, SelectRow `<button>`, ColorRow `<input>`, IconButtonGroup buttons, AlignBox cells
  2. Add focus ring style: `outline: none` + `boxShadow: "0 0 0 2px rgba(99,102,241,0.3)"` on `:focus-visible`
  3. Since these are inline styles, add `onFocus`/`onBlur` handlers to toggle the focus ring
- **Why not section trapping**: Section trapping breaks when user clicks between sections and requires complex ref management. Natural Tab order is simpler and more accessible.
- **Size**: ~30 lines (tabIndex + focus styling on existing components)

## Parallelization Strategy (Revised)

**7 parallel agents**, each touching different files or non-overlapping sections:

| Agent | Tasks | Primary File | Conflict Risk |
|-------|-------|-------------|---------------|
| Agent 1 | 3 (Alt+Arrow) | `WebflowPanel.tsx` — ValueInput only | None |
| Agent 2 | 4, 6 (flex-dir + order) | `WebflowPanel.tsx` — Layout section only | None |
| Agent 3 | 7, 8, 9 (size controls) | `WebflowPanel.tsx` — Size section only | None |
| Agent 4 | 12, 13 (font-family + typo advanced) | `WebflowPanel.tsx` — Typography section only | None |
| Agent 5 | 10 (offset diagram) | New `PositionOffsetDiagram.tsx` | None |
| Agent 6 | 15, 16 (spacing polish) | `SpacingBoxModel.tsx` | None |
| Agent 7 | 18 (shortcuts) | `Overlay.tsx` + `Footer.tsx` | None |

**Sequential after parallel** (touches many files):
- Task 17 (StyleIndicator) — touches SliderRow, SelectRow, ColorRow in WebflowPanel.tsx
- Task 19 (Tab nav) — touches all interactive components

**Why this split works**: Each agent operates on a distinct section of WebflowPanel.tsx or a separate file. No two agents modify the same lines. Run Agents 1-7 in parallel, then 17 and 19 sequentially after merge.

## Acceptance Criteria

### Functional
- [ ] Alt+Arrow increments values by 0.1 (with float rounding)
- [ ] Flex-direction shows as 4 icon toggle buttons
- [ ] Flex children show an Order number input
- [ ] Width/Height show auto/none pill when keyword is active
- [ ] Aspect-ratio text input in Size section
- [ ] Object-position dropdown for img/video/canvas
- [ ] Position offsets show as visual box diagram (replaces sliders)
- [ ] Font-family dropdown populated from page fonts + fallbacks
- [ ] Typography "Advanced" collapsed sub-section with 5 properties
- [ ] Spacing margin zone is warm-tinted, padding is cool-tinted
- [ ] Alt+click on spacing value sets complementary sides
- [ ] Pink dots appear next to properties with inline overrides
- [ ] S/R/Cmd+S/Cmd+C keyboard shortcuts work with proper guards
- [ ] All interactive controls have tabIndex and focus ring

### Quality Gates
- [ ] `npm run typecheck` passes after all changes
- [ ] No regressions in existing controls (test each section manually)
- [ ] All new controls follow the existing handler pattern (useState + useCallback + apply)
- [ ] Inline styles only, dark theme colors, monospace for values
- [ ] Float rounding on all 0.1-step increments

## Deferred Items

These require architectural changes beyond the current scope:

| Item | Reason Deferred | Dependency |
|------|----------------|-----------|
| StateSelector wiring | Inline styles can't target `:hover`. Needs `<style>` tag injection mechanism. | New apply mode in `apply.ts` |
| Unit conversion | Switching units should convert values (16px → 1em). Requires parent font-size, containing block dimensions, viewport width. | Conversion utility + integration in all unit handlers |
| Full StyleIndicator cascade | Blue (direct class) / orange (inherited) / green (state) detection requires CSSOM walking. | `getPropertySource()` utility with stylesheet parsing |
| Text-shadow in Advanced | Reusing ShadowEditor would show unused "spread" input. | ShadowEditor refactor to hide spread |

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Multiple agents editing WebflowPanel.tsx | Merge conflicts | Split by section — each agent only touches its section's lines |
| PositionOffsetDiagram complexity | Scope creep | Follow SpacingBoxModel pattern exactly, single-layer only |
| Cmd+S conflicts with browser save | Broken browser shortcut | Only preventDefault when panel has changes |
| Alt+click vs LabelScrub alt modifier | Gesture confusion | Different input modes (click vs drag) — no actual conflict |
| Font list from document.fonts | Empty on SSR/initial render | Use `document.fonts.ready` promise + fallback list |
| Floating-point artifacts from 0.1 steps | Values like 16.300000001 | Use `Math.round(x * 10) / 10` |

## References

- **Spec**: `/Users/skylar/code/redial/webflow-style-panel-spec.md` — Sections 3-13
- **Main panel**: `/Users/skylar/code/redial/src/overlay/WebflowPanel.tsx`
- **Overlay**: `/Users/skylar/code/redial/src/overlay/Overlay.tsx`
- **Spacing**: `/Users/skylar/code/redial/src/overlay/SpacingBoxModel.tsx`
- **StyleIndicator**: `/Users/skylar/code/redial/src/overlay/StyleIndicator.tsx`
- **StateSelector**: `/Users/skylar/code/redial/src/overlay/StateSelector.tsx`
- **Footer**: `/Users/skylar/code/redial/src/overlay/Footer.tsx`
- **Conventions**: `/Users/skylar/code/redial/.claude/CLAUDE.md`
