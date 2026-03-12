---
title: "Complete Remaining Webflow Panel Spec Items (Phase B + C)"
type: feat
date: 2026-03-11
deepened: 2026-03-11
---

# Complete Remaining Webflow Panel Spec Items (Phase B + C)

## Enhancement Summary

**Deepened on:** 2026-03-11
**Agents used:** TypeScript reviewer, Performance oracle, Simplicity reviewer, Architecture strategist, Pattern recognition specialist, Frontend races reviewer, Best practices researcher, Framework docs researcher

### Key Improvements
1. **Added Phase 0 (prerequisite refactoring)** — extract WebflowPanel.tsx into sections, hooks, controls, and utilities before adding features. All 8 agents independently identified this as critical.
2. **Simplified StyleIndicator** — track user modifications via existing `apply.ts` override map instead of unreliable DOM archaeology. Eliminates ~160 LOC of fragile detection logic.
3. **Simplified unit conversion** — only px↔em and px↔rem using px as pivot unit. Skip full conversion matrix (YAGNI).
4. **Eliminated Item 22** (Tab navigation) — browser defaults with `tabIndex={0}` suffice. Custom focus interception fights the browser.
5. **Reduced agent count** — 5 agents (down from 11) grouped by file ownership to prevent merge conflicts.

### Critical Findings
- `getComputedStyle()` returns a **live** object — must snapshot into plain object at mount
- 7 duplicate editable-input implementations across codebase — extract shared `NumericInput`
- Alt+click in SpacingBoxModel must check `e.altKey` BEFORE `setEditing(true)` to avoid race
- `Cmd+C` shortcut must not steal native copy from focused text inputs
- `parentIsFlex` derivation calls `getComputedStyle(parent)` on every render — needs `useMemo`

---

## Overview

13 remaining spec items across Phase B (missing controls) and Phase C (cross-cutting polish), plus a prerequisite refactoring phase. Item 7 (flex-direction toggles) is already done. Item 22 (Tab navigation) eliminated as YAGNI.

## Remaining Items

### Phase B — Missing Controls (8 items)

| # | Item | Section | Complexity | Files |
|---|------|---------|-----------|-------|
| 8 | Flex child `order` control | Layout | S | `useLayoutState.ts` |
| 9 | Typography advanced sub-section | Typography | M | `useTypographyState.ts` |
| 10 | Position visual offset diagram | Position | M | Inline in Position JSX (reuse exported `EditableValue`) |
| 12 | Size auto/none keyword toggles (UI only — state exists) | Size | S | `useSizeState.ts` |
| 13 | `aspect-ratio` control | Size | S | `useSizeState.ts` |
| 14 | `object-position` for media elements | Size | S | `useSizeState.ts` |
| 15 | Spacing color zones (warm margin, cool padding) | Spacing | S | `SpacingBoxModel.tsx` |
| 16 | Spacing alt+click shortcuts | Spacing | M | `SpacingBoxModel.tsx` |

### Phase C — Cross-Cutting Polish (5 items)

| # | Item | Section | Complexity | Files |
|---|------|---------|-----------|-------|
| 18 | Unit conversion (px↔em, px↔rem only) | All numeric | S | `unitConversion.ts`, section hooks |
| 19 | StyleIndicator detection (override-tracking) | Cross-cutting | S | `apply.ts` (extend), `StyleIndicator.tsx` |
| 20 | StyleIndicator integration into sections | Cross-cutting | M | `controls.tsx` (SliderRow/SelectRow) |
| 21 | Keyboard shortcuts (S, R, Cmd+S, Cmd+C) | Cross-cutting | M | `Overlay.tsx` |
| ~~22~~ | ~~Tab/Shift+Tab navigation~~ | ~~Cross-cutting~~ | ~~ELIMINATED~~ | ~~YAGNI~~ |

---

## Phase 0: Prerequisite Refactoring (MUST DO FIRST)

All 8 review agents independently identified this as critical. WebflowPanel.tsx at 1533 lines with ~57 useState calls cannot absorb 5 parallel agents without merge conflicts. Extract first, then add features.

### 0a. Extract Utilities → `src/overlay/cssHelpers.ts`

Move from WebflowPanel.tsx lines 36-217:
- `rgbToHex`, `parseNum`, `parseBoxShadow`, `parseFilter`, `parseTransform`
- `shadowToCSS`, `filterToCSS`, `transformToCSS`, `parseTransitions`, `transitionsToCSS`

These are pure functions with zero React dependency. Also deduplicate `rgbToHex` and `parseNum` which exist in both `infer.ts` and `WebflowPanel.tsx`.

### 0b. Extract Controls → `src/overlay/controls.tsx`

Move from WebflowPanel.tsx lines 348-707:
- `Section`, `ValueInput`, `SliderRow`, `SelectRow`, `ColorRow`, `TextRow`
- Export `EditableValue` from `SpacingBoxModel.tsx` (currently file-private, needed by Position offset diagram)

### Research Insights

**Pattern recognition finding:** There are **7 independent implementations** of the click-to-edit numeric input pattern (`EditableValue`, `NumericInput`, `RadiusInput`, `ValueInput`, `AxisInput`, + 2 in TransitionEditor). Extract a shared component to `controls.tsx` to prevent an 8th copy.

**Imperative hover bug:** 58+ instances use `onMouseEnter`/`onMouseLeave` with inconsistent `e.target` vs `e.currentTarget`. The `e.target` version (older components) is buggy when the element has children. Standardize on `e.currentTarget` during extraction.

### 0c. Extract Constants → `src/overlay/constants.ts`

Move all option arrays from WebflowPanel.tsx lines 709-883:
- `DISPLAY_OPTIONS`, `FONT_WEIGHT_OPTIONS`, `OVERFLOW_OPTIONS`, `POSITION_OPTIONS`, etc.
- `FLEX_DIRECTION_ICONS`, `TEXT_ALIGN_OPTIONS`, `TEXT_DECORATION_OPTIONS`, etc.
- `SIZE_UNITS_W`, `SIZE_UNITS_H`, `POSITION_UNITS`, `TYPO_SIZE_UNITS`

### 0d. Extract Section Hooks → `src/overlay/hooks/`

One hook per section. Each takes `(element: Element, apply: (prop: string, value: string) => void)` and returns `{ state, handlers }`.

```
src/overlay/hooks/useLayoutState.ts    — display, flexDirection, gap, gridCols, etc.
src/overlay/hooks/useSizeState.ts      — width, height, min/max, overflow, units, keyword toggles
src/overlay/hooks/usePositionState.ts  — position, top/right/bottom/left, zIndex, float, clear
src/overlay/hooks/useTypographyState.ts — fontSize, fontWeight, color, textAlign, etc.
src/overlay/hooks/useBorderState.ts    — borderSide, style, width, color, radius
src/overlay/hooks/useEffectsState.ts   — opacity, shadows, transforms, filters, transitions
```

### Research Insights — State Management

**Best practices finding:** With 50+ fields, `useReducer` with discriminated union actions is preferred over `useState`:
- Dispatch is referentially stable → safe to pass to memoized children
- Reducer is pure → testable with Vitest without rendering
- Single dispatch for correlated updates (e.g., changing `display` mode)

**However:** For this refactoring step, keep the `useState` pattern within each hook. Converting to `useReducer` is a follow-up optimization. The immediate goal is file-level isolation for parallel agents.

### 0e. Snapshot getComputedStyle

**Race condition finding (CRITICAL):** `getComputedStyle()` returns a **live** `CSSStyleDeclaration`. The current `useState(() => getComputedStyle(element))` stores a live reference. Any property access after mount triggers a style recalculation if the DOM is dirty.

**Fix:** Snapshot into a plain object at mount:

```tsx
const [snapshot] = useState(() => {
  const cs = getComputedStyle(element);
  return {
    display: cs.display,
    flexDirection: cs.flexDirection,
    width: cs.width,
    // ... all properties needed by section hooks
  };
});
```

Pass `snapshot` (not `cs`) to section hooks. This freezes the observation point.

### 0f. Memoize Derived Flags

**Performance finding:** `parentIsFlex` at line 1014 calls `getComputedStyle(parent)` on every render. Wrap in `useMemo`:

```tsx
const parentIsFlex = useMemo(() => {
  const parent = element.parentElement;
  if (!parent) return false;
  const pd = getComputedStyle(parent).display;
  return pd === "flex" || pd === "inline-flex";
}, [element]);
```

### Post-Refactoring Result

WebflowPanel.tsx shrinks from ~1533 lines to ~400 (hook calls + JSX). Each section's state lives in its own file. Parallel agents can safely modify different hooks without merge conflicts.

---

## Phase B Implementation

### Work Unit 1: Size Section Completion (Items 12, 13, 14)

**File:** `src/overlay/hooks/useSizeState.ts`

#### 12. Auto/None Keyword Toggles

State and handlers already exist. Add `KeywordToggle` to `controls.tsx` (~15 lines) and render next to Width, Height (auto), Max W, Max H (none).

```tsx
// In controls.tsx
function KeywordToggle({ label, active, onClick }: {
  label: "auto" | "none"; active: boolean; onClick: () => void;
}) { /* 28px pill button, indigo when active */ }
```

When active: disable slider, show keyword text in value position.

#### 13. Aspect Ratio Control

```tsx
// In useSizeState.ts
const [aspectRatio, setAspectRatio] = useState(() => snapshot.aspectRatio || "auto");
```

**Simplicity finding:** Drop "custom" from options — no follow-through for custom input defined. Use `SelectRow` with presets only: `"auto"`, `"1 / 1"`, `"16 / 9"`, `"4 / 3"`, `"3 / 2"`.

#### 14. Object Position for Media Elements

```tsx
const isMedia = element.tagName === 'IMG' || element.tagName === 'VIDEO' || element.tagName === 'CANVAS';
const [objectPosition, setObjectPosition] = useState(() => snapshot.objectPosition || "center");
// Render: SelectRow, only when isMedia
// Options: "center", "top", "bottom", "left", "right", "top left", "top right", "bottom left", "bottom right"
```

### Work Unit 2: Layout Order + Typography Advanced (Items 8, 9)

**Files:** `src/overlay/hooks/useLayoutState.ts`, `src/overlay/hooks/useTypographyState.ts`

#### 8. Flex Child Order

```tsx
// In useLayoutState.ts
const [order, setOrder] = useState(() => parseInt(snapshot.order) || 0);
// Render: SliderRow after Align Self in flex child section
```

**TypeScript finding:** Name the state variable `order` not `flexOrder` — match the CSS property name like all other state variables do.

#### 9. Typography Advanced Sub-section

**Simplicity finding:** Drop `column-count` and `column-gap` (multi-column layout is too niche for a first pass). Keep 4 controls: `word-spacing`, `white-space`, `text-indent`, `word-break`.

```tsx
// In useTypographyState.ts
const [wordSpacing, setWordSpacing] = useState(() => parseNum(snapshot.wordSpacing));
const [whiteSpace, setWhiteSpace] = useState(() => snapshot.whiteSpace);
const [textIndent, setTextIndent] = useState(() => parseNum(snapshot.textIndent));
const [wordBreak, setWordBreak] = useState(() => snapshot.wordBreak || "normal");
```

Add a collapsible sub-header in the Typography section JSX, starting collapsed.

Constants (`WHITE_SPACE_OPTIONS`, `WORD_BREAK_OPTIONS`) go in `constants.ts`.

### Work Unit 3: Position Offset Diagram (Item 10)

**Simplicity finding:** Do NOT create a new component file. The position diagram is simpler than SpacingBoxModel (one box, not two nested). Build it as ~40 lines of inline JSX in the Position section, reusing the exported `EditableValue` from `controls.tsx`.

**TypeScript finding:** Type `onChange` with a union, not `string`:

```tsx
onChange: (side: "top" | "right" | "bottom" | "left", value: number) => void
```

The diagram replaces the 4 SliderRows for top/right/bottom/left when position !== static.

### Work Unit 4: Spacing Enhancements (Items 15, 16)

**File:** `src/overlay/SpacingBoxModel.tsx`

#### 15. Color Zones

```tsx
// Margin box (outer): background: "rgba(255, 152, 0, 0.06)" (warm orange)
// Padding box (inner): background: "rgba(59, 130, 246, 0.06)" (cool blue)
// Content center: keep "rgba(255,255,255,0.06)"
// On hover: increase alpha to 0.12 for the hovered zone
```

#### 16. Alt+Click Shortcuts

**Race condition finding (HIGH):** Must check `e.altKey` BEFORE `setEditing(true)`. Otherwise alt+click both mirrors the value AND enters edit mode — the input flashes open and steals focus.

**Simplicity finding:** No new `onAltClick` prop needed. Handle entirely inside existing `EditableValue.onClick`:

```tsx
onClick={(e) => {
  e.stopPropagation();
  if (e.altKey) {
    // Mirror to complementary side(s) and return early
    // Side values (top/bottom, left/right): mirror to opposite
    // Corner values: mirror to all 4
    onChange(/* complementary prop */, value);
    return; // DO NOT enter edit mode
  }
  setEditing(true);
}}
```

Need to pass the property name to `EditableValue` so it knows which complementary sides to target. Add a `prop` string parameter.

### Work Unit 5: Keyboard Shortcuts (Item 21)

**File:** `src/overlay/Overlay.tsx`

Add to existing `handleKeyDown` (line 105):

**Race condition findings:**

1. **`S` and `R` must work when focus is in the panel but NOT in an input.** The existing `insidePanel` guard on line 128 returns early for all panel-internal events. Need a more nuanced check: `insidePanel && !isInputFocused`.

2. **`Cmd+C` must NOT steal native copy** from focused inputs/textareas. Only intercept when `window.getSelection()?.toString()` is empty AND no input has focus.

3. **`Cmd+S` must `e.preventDefault()`** to block browser's Save dialog.

```tsx
// Focus-aware guard:
const isInputFocused = tag === "input" || tag === "textarea" || tag === "select";

// S → cycle scope (only when panel open, no input focused)
if (e.key === "s" && !isInputFocused && selectedEl) {
  e.preventDefault();
  // cycle scope
}

// R → reset (only when panel open, no input focused)
if (e.key === "r" && !isInputFocused && selectedEl) {
  e.preventDefault();
  restoreAllOverrides();
}

// Cmd+S → save to source
if ((e.metaKey || e.ctrlKey) && e.key === "s" && selectedEl) {
  e.preventDefault();
  // trigger Footer save action
}

// Cmd+C → copy CSS (only when nothing selected and no input focused)
if ((e.metaKey || e.ctrlKey) && e.key === "c" && !isInputFocused && !window.getSelection()?.toString()) {
  e.preventDefault();
  // copy overrides as CSS text to clipboard
}
```

**Performance finding:** Store `scope` in a `useRef` to avoid expanding the effect dependency array. The handler reads scope on keypress but doesn't need re-registration when scope changes.

---

## Phase C Implementation

### Work Unit 6: Unit Conversion (Item 18)

**File:** New `src/overlay/unitConversion.ts`

**Simplicity finding:** Only support `px↔em` and `px↔rem`. Skip %, vw, vh conversion — users switching to those units expect to type a new value anyway.

```tsx
// src/overlay/unitConversion.ts

export interface UnitConversionContext {
  elementFontSize: number;  // px — for em conversion
  rootFontSize: number;     // px — for rem conversion
}

export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string,
  ctx: UnitConversionContext,
): number {
  if (fromUnit === toUnit) return value;
  // Convert to px first (pivot unit)
  let px = value;
  if (fromUnit === "em") px = value * ctx.elementFontSize;
  else if (fromUnit === "rem") px = value * ctx.rootFontSize;
  // Convert px to target
  if (toUnit === "px") return Math.round(px);
  if (toUnit === "em") return Math.round((px / ctx.elementFontSize) * 100) / 100;
  if (toUnit === "rem") return Math.round((px / ctx.rootFontSize) * 100) / 100;
  // Unsupported conversion — return value unchanged
  return value;
}
```

**Performance finding:** Compute `UnitConversionContext` once at panel level in a `useMemo`, not per-UnitSelector:

```tsx
const unitCtx = useMemo(() => ({
  elementFontSize: parseFloat(getComputedStyle(element).fontSize),
  rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
}), [element]);
```

**Pattern finding:** Current `onUnitChange` callbacks are passed directly as `setWidthUnit` — these need to become handler-wrapped to also call `apply()` with the converted value. Each section hook should expose `handleUnitChange(prop, newUnit)` that converts + applies.

### Work Unit 7: StyleIndicator System (Items 19, 20)

**Simplicity finding (MAJOR CHANGE):** Do NOT detect inheritance via DOM. The plan's original `detectStyleSource` requires:
- A `getDefaultValue()` lookup table for every CSS property (varies by element type)
- An `isInheritableProperty()` table
- Unreliable parent comparison via `getComputedStyle`
- Hand-waved pseudo-class detection

**Instead:** Track which properties the user has modified in this session. The override map in `apply.ts` already knows this.

#### 19. Detection Logic — Override-Based

Extend `apply.ts` to expose per-property override tracking:

```tsx
// In apply.ts — add to existing module
const modifiedProps = new Set<string>();

export function getModifiedProps(): ReadonlySet<string> {
  return modifiedProps;
}

// In applyInlineStyle(), add: modifiedProps.add(prop);
// In restoreAllOverrides(), add: modifiedProps.clear();
```

Then in `StyleIndicator.tsx`, the detection is simple:

```tsx
function getIndicatorType(
  prop: string,
  scope: "element" | "class",
  activeState: string | null,
  modifiedProps: ReadonlySet<string>,
): IndicatorType {
  if (!modifiedProps.has(prop)) return "none";
  if (activeState && activeState !== "none") return "state";  // green
  if (scope === "element") return "element";                   // pink
  return "direct";                                              // blue
}
```

This is **100% reliable** (no DOM inspection), **zero performance cost** (Set lookup), and **3 lines of logic** instead of 80.

"Inherited" (orange) indicator is deferred — it requires CSSOM rule walking with `element.matches(rule.selectorText)` which hits `SecurityError` on cross-origin sheets. Not worth the complexity for v1.

#### 20. Integration

Add optional `indicatorType` prop to `SliderRow`, `SelectRow`, `ColorRow` in `controls.tsx`. Render `<StyleIndicator>` to the left of the label when provided:

```tsx
// In SliderRow (controls.tsx)
{indicatorType && <StyleIndicator type={indicatorType} />}
<LabelScrub ...>
```

Compute indicators once at panel level as a `Map<string, IndicatorType>`:

```tsx
const modifiedProps = getModifiedProps();
const indicators = useMemo(() => {
  const map = new Map<string, IndicatorType>();
  for (const prop of modifiedProps) {
    map.set(prop, getIndicatorType(prop, scope, activeState, modifiedProps));
  }
  return map;
}, [modifiedProps.size, scope, activeState]);
```

Pass `indicators.get("width")` etc. to each control row.

---

## Execution Order for Swarm

### Phase 0: Sequential (1 agent, must complete before Phase B)

**Agent: Refactoring** → Extract cssHelpers.ts, controls.tsx, constants.ts, section hooks. Snapshot getComputedStyle. Memoize derived flags.

### Phase B: Parallel Batch (5 agents, all different files)

| Agent | Items | Primary File |
|-------|-------|-------------|
| A: Size Completion | 12, 13, 14 | `hooks/useSizeState.ts` + Size JSX |
| B: Layout + Typography | 8, 9 | `hooks/useLayoutState.ts` + `hooks/useTypographyState.ts` + JSX |
| C: Position Diagram | 10 | Position section JSX only (~40 lines) |
| D: Spacing Polish | 15, 16 | `SpacingBoxModel.tsx` |
| E: Keyboard Shortcuts | 21 | `Overlay.tsx` |

### Phase C: Sequential (2 agents, after Phase B)

6. **Agent: Unit Conversion** → Item 18, new `unitConversion.ts` + section hooks
7. **Agent: StyleIndicator** → Items 19+20 combined, `apply.ts` + `controls.tsx`

**Total: 8 agents (down from 11).** Phase 0 is serial. Phase B is fully parallel with zero file overlap. Phase C is serial because it modifies shared infrastructure.

## Acceptance Criteria

- [ ] All 13 items pass `npm run typecheck`
- [ ] WebflowPanel.tsx < 500 lines after refactoring
- [ ] No regressions to existing sections
- [ ] StyleIndicator dots visible next to modified property labels
- [ ] Keyboard shortcuts S/R/Cmd+S/Cmd+C functional (focus-aware)
- [ ] Unit conversion works for px↔em and px↔rem (2 decimal places)
- [ ] Position offset diagram shows clickable values on each edge
- [ ] Typography advanced starts collapsed, has 4 controls
- [ ] Spacing shows warm margin zones, cool padding zones
- [ ] Alt+click in spacing mirrors to complementary sides WITHOUT entering edit mode
- [ ] Cmd+C does NOT steal native copy from focused inputs
- [ ] `npm run typecheck` passes after each phase

## Technical Considerations

### Performance
- `getComputedStyle` snapshot at mount — never touch the live object during interaction
- Single-pass indicator computation via `Set<string>` lookup — zero DOM inspection
- `UnitConversionContext` computed once via `useMemo`, not per-UnitSelector
- `parentIsFlex` wrapped in `useMemo([element])`
- Section hooks isolate re-renders to the section that changed

### Testing Requirements
- `convertUnit()` — pure function, add Vitest unit tests for px→em, px→rem, em→px, rem→px, round-trip
- `getIndicatorType()` — pure function, add Vitest tests for all 4 indicator types
- `parseBoxShadow`, `parseFilter`, `parseTransform` — existing untested parsers, add tests during extraction to cssHelpers.ts

### Edge Cases
- `font-size` em conversion: uses element's OWN computed font-size, but the element may inherit it. Capture at mount time to avoid circular dependency.
- Cross-origin stylesheets throw `SecurityError` — any future CSSOM walk must wrap in try/catch
- `aspect-ratio` computed value may be `"auto"` or `"16 / 9"` (with spaces) — handle both formats
- `object-position` defaults to `"50% 50%"` in computed styles, display as "center" in UI

## References

- Spec: `webflow-style-panel-spec.md` (sections 3-7, 11-13)
- Existing components: `SpacingBoxModel.tsx:26`, `StyleIndicator.tsx:28`, `UnitSelector.tsx`, `Overlay.tsx:105`
- Constants: `WebflowPanel.tsx:833` (FLEX_DIRECTION_ICONS pattern)
- [Paul Irish: What Forces Layout/Reflow](https://gist.github.com/paulirish/5d52fb081b3570c81e3a)
- [MDN: Window.getComputedStyle()](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)
- [W3C WAI-ARIA APG: Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [MDN: CSS Values and Units](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Values_and_units)
