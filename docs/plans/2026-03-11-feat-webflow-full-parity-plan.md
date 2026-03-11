---
title: "Webflow Full 1:1 Parity"
type: feat
date: 2026-03-11
---

# Webflow Full 1:1 Parity

## Overview

Complete the Redial CSS panel to achieve 1:1 feature parity with Webflow Designer's Style panel. The committed codebase already covers ~85% of the spec — this plan addresses the remaining gaps across 4 streams: a critical fix for broken local state, the 3 remaining Phase B/C checklist items, missing per-section controls, and input control enhancements.

## Problem Statement

1. **Broken local state**: An in-progress refactoring extracted hooks/constants from `WebflowPanel.tsx` but never created the target files. Typecheck fails with 7 missing module errors. Must be fixed before any other work.
2. **3 remaining Phase B/C items**: Unit conversion (18), full StyleIndicator detection (19 enhancement), Tab navigation (22).
3. **Per-section gaps**: The committed panel is missing user-select, text-shadow, hyphens, direction, column-gap, per-axis overflow, perspective, backface-visibility, background-clip, background-blend-mode.
4. **Input control gaps**: Color picker lacks HSB/RGB/Hex mode switching and opacity slider. Transition editor lacks bezier curve visual editor.

## Technical Approach

### Phase 0: Fix Broken State (BLOCKING)

**Action**: Revert the uncommitted changes to `WebflowPanel.tsx` and `SpacingBoxModel.tsx`.

```bash
git checkout -- src/overlay/WebflowPanel.tsx src/overlay/SpacingBoxModel.tsx
```

**Why revert instead of completing the extraction?** The committed monolithic 1721-line file has working StyleIndicator integration (indicator props on all rows) that the refactored version lost. Revering is instant; re-extracting correctly is a separate refactoring task that shouldn't block feature work.

**Verify**: `npm run typecheck` must pass.

### Phase 1: Remaining Phase B/C Items (3 tasks)

#### Task 18: Unit Conversion Logic
**Files**: `src/overlay/WebflowPanel.tsx`
**What**: When a UnitSelector changes units, convert the current numeric value instead of leaving it unchanged.
**Implementation**:
- Add a `convertUnit(value, fromUnit, toUnit, context)` pure function
- Conversion table:
  - `px → em`: `value / computedFontSize`
  - `px → rem`: `value / rootFontSize`
  - `px → %`: `value / parentDimension * 100` (width for W-type, height for H-type)
  - `em → px`: `value * computedFontSize`
  - `rem → px`: `value * rootFontSize`
  - `% → px`: `value / 100 * parentDimension`
  - `vw → px`: `value / 100 * window.innerWidth`
  - `vh → px`: `value / 100 * window.innerHeight`
- Build a `UnitConversionContext` from the element on mount:
  ```typescript
  { computedFontSize: number, rootFontSize: number, parentWidth: number, parentHeight: number }
  ```
- Modify each `onUnitChange` handler (width, height, fontSize, etc.) to also convert the value
- Round to 2 decimal places for readability

#### Task 19 Enhancement: Full StyleIndicator Detection
**Files**: `src/overlay/StyleIndicator.tsx`, `src/overlay/WebflowPanel.tsx`
**What**: Currently `getIndicatorType()` only detects inline overrides (pink). Enhance to detect:
  - `"element"` (pink) — has inline style override
  - `"inherited"` (orange) — value differs from default but not from inline
  - `"none"` — browser default
**Why not full class/state detection?** We're in element scope — class-level detection requires the scope system to be wired through, which is out of scope here. The simple 3-level detection covers the most useful case.
**Implementation**:
- Check `el.style.getPropertyValue(prop)` → "element" if non-empty
- Compare `getComputedStyle(el)[prop]` vs `getComputedStyle(el.parentElement)[prop]` for inheritable properties → "inherited" if different
- Otherwise → "none"

#### Task 22: Tab/Shift+Tab Navigation
**Files**: `src/overlay/WebflowPanel.tsx` (SliderRow, SelectRow, ColorRow, TextRow internal functions)
**What**: Add `tabIndex={0}` to all interactive control inputs and a focus ring style.
**Implementation**:
- Add `tabIndex={0}` to: SliderRow's `<input type="range">`, SelectRow's `<button>`, ColorRow's swatch `<input>`, TextRow's `<input>`
- On focus-visible, apply `outline: "1px solid rgba(99,102,241,0.5)"`, `outlineOffset: "1px"`
- Use a simple `onFocus`/`onBlur` pair to track focus state for inline styling (can't use `:focus-visible` pseudo in inline styles)
- Alternative: inject a single `<style>` tag with `.tuner-focusable:focus-visible { outline: 1px solid rgba(99,102,241,0.5); outline-offset: 1px; }` and add `className="tuner-focusable"` to controls

### Phase 2: Missing Per-Section Controls (12 tasks)

> **Reference**: `webflow-panel-reference.png` in project root shows the actual Webflow panel UI.

#### 2A: Layout — Display Toggle Buttons
**File**: `src/overlay/WebflowPanel.tsx` (Layout section, ~line 1407)
**What**: Replace the Display `SelectRow` dropdown with an `IconButtonGroup` of toggle buttons matching the reference image: `Block`, `Flex`, `Grid`, `None` — with a dropdown chevron for inline variants.
**Implementation**:
- Create `DISPLAY_TOGGLE_OPTIONS` with 4 icon buttons (Block/Flex/Grid/None)
- Add a small `▾` overflow button that opens a dropdown for `inline`, `inline-block`, `inline-flex`, `inline-grid`
- Pattern: same as flex-direction toggle buttons already done

#### 2B: Layout — Gap Lock (Row/Column Gap)
**File**: `src/overlay/WebflowPanel.tsx` (Layout section, ~line 1426)
**What**: Add a lock/unlock toggle next to Gap that splits into separate `row-gap` and `column-gap` sliders when unlocked (matching Webflow's lock icon).
**Implementation**:
- State: `gapLocked` boolean (default true), `rowGap`, `columnGap`
- When locked: single Gap slider sets both `row-gap` and `column-gap`
- When unlocked: two separate SliderRows for Row Gap and Col Gap
- Lock icon: small `🔗` / chain-broken toggle button

#### 2C: Size — Box Sizing Control
**File**: `src/overlay/WebflowPanel.tsx` (Size section, ~line 1520)
**What**: Add `box-sizing` toggle with `border-box` / `content-box` icon buttons (visible in reference image as two box icons).
**Implementation**:
- State: `boxSizing` initialized from `cs.boxSizing`
- IconButtonGroup with 2 options, box icons for border-box (filled) and content-box (outline)
- Place in "More size options" collapsible sub-section

#### 2D: Size — "More Size Options" Collapsible
**File**: `src/overlay/WebflowPanel.tsx` (Size section)
**What**: Group Ratio, Box size, and Fit under a collapsible "More size options" sub-section matching the reference image.
**Implementation**:
- State: `showMoreSize` boolean (default false)
- Disclosure triangle + "More size options" label
- Contains: aspect-ratio TextRow, box-sizing toggle, object-fit/object-position (for media)
- Same pattern as Typography Advanced collapsible

#### 2E: Size — Overflow Icon Buttons
**File**: `src/overlay/WebflowPanel.tsx` (Size section)
**What**: Replace the Overflow `SelectRow` dropdown with icon buttons matching the reference image (eye, crossed eye, scroll arrows, auto text) + per-axis unlock.
**Implementation**:
- `IconButtonGroup` with 4 options: visible (eye), hidden (crossed), scroll (arrows), auto (text)
- Lock/unlock toggle for per-axis control
- When unlocked: show separate Overflow X and Overflow Y icon button groups
- State: `overflowLocked`, `overflowX`, `overflowY`

#### 2F: Effects Section Additions
**File**: `src/overlay/WebflowPanel.tsx` (Effects section, ~line 1680)

| Control | CSS Property | Type | Values |
|---------|-------------|------|--------|
| User Select | `user-select` | SelectRow | `auto`, `none`, `text`, `all` |
| Perspective | `perspective` | SliderRow | 0–2000px |
| Backface | `backface-visibility` | SelectRow | `visible`, `hidden` |

**State**: 3 new `useState` calls initialized from computed style.
**Handlers**: 3 new `handleXxxChange` callbacks calling `apply()`.
**JSX**: Add after Visibility SelectRow.

#### 2G: Typography Advanced Additions
**File**: `src/overlay/WebflowPanel.tsx` (Typography Advanced sub-section, ~line 1636)

| Control | CSS Property | Type | Values |
|---------|-------------|------|--------|
| Hyphens | `hyphens` | SelectRow | `none`, `manual`, `auto` |
| Direction | `direction` | SelectRow | `ltr`, `rtl` |
| Col Gap | `column-gap` | SliderRow | 0–100px |
| Text Shadow | `text-shadow` | ShadowEditor | X, Y, blur, color (reuse ShadowEditor) |

**State**: 4 new `useState` calls.
**For text-shadow**: Reuse `ShadowEditor` component (already supports multi-value). Parse `text-shadow` the same way as `box-shadow` (same syntax). Text-shadow has no spread or inset — use `parseBoxShadow`/`shadowToCSS` directly (spread defaults to 0, inset to false).

#### 2H: Backgrounds Section Additions
**File**: `src/overlay/WebflowPanel.tsx` (Backgrounds section, ~line 1650)

| Control | CSS Property | Type | Values |
|---------|-------------|------|--------|
| Clip | `background-clip` | SelectRow | `border-box`, `padding-box`, `content-box`, `text` |

**State**: 1 new `useState` call.
**JSX**: Add after BackgroundLayerList/ColorRow.

### Phase 3: Input Control Enhancements (2 tasks)

#### 3A: Enhanced Color Picker
**File**: New component `src/overlay/ColorPickerEnhanced.tsx`, modify `ColorRow` in `WebflowPanel.tsx`
**What**: Replace the native `<input type="color">` with a custom picker matching Webflow's:
- 2D saturation/brightness gradient area with draggable handle
- Hue slider (0°–360°)
- Opacity slider (0–100%)
- Mode tabs: HSB / RGB / Hex
- Value inputs per mode
- Swatch grid for saved colors

**Scope decision**: This is a significant new component (~300-400 lines). Implement as a separate file. Wire into `ColorRow` — clicking the swatch opens the enhanced picker as a popover.

**MVP subset**: HSB picker + opacity slider + hex input. Skip swatches for now.

#### 3B: Bezier Curve Editor
**File**: New component `src/overlay/BezierEditor.tsx`, modify `TransitionEditor.tsx`
**What**: Visual cubic-bezier curve editor for `transition-timing-function`.
- Canvas showing the bezier curve
- Two draggable control points
- Preset buttons: ease, ease-in, ease-out, ease-in-out, linear
- Real-time preview animation

**Scope decision**: This is another significant component. Implement after all other tasks.

## Parallel Execution Strategy

```
Phase 0 (fix)                  → MUST complete first (1 min)
                                 ↓
Stream A: Phase 1 tasks  ──┐
Stream B: Layout (2A,2B)  ──┤
Stream C: Size (2C,2D,2E) ──┼── all modify different sections, parallel-safe
Stream D: Effects (2F)     ──┤
Stream E: Typography (2G)  ──┤
Stream F: Backgrounds (2H) ──┘
                              ↓
Phase 3A (Color picker) ── after all streams merge
Phase 3B (Bezier editor)── after all streams merge
```

Streams modify non-overlapping sections of `WebflowPanel.tsx`. Stream A touches helpers + control internals. Streams B-F each touch their own section's state/handlers/JSX.

## Acceptance Criteria

### Functional Requirements
- [ ] `npm run typecheck` passes
- [ ] All unit conversions produce correct values (px↔em, px↔rem, px↔%, px↔vw/vh)
- [ ] StyleIndicator dots show pink for inline overrides, orange for inherited values
- [ ] Tab key moves focus between controls within a section
- [ ] User-select, perspective, backface-visibility controls work in Effects
- [ ] Hyphens, direction, column-gap, text-shadow controls work in Typography Advanced
- [ ] Per-axis overflow controls (locked/unlocked) work in Size
- [ ] Background-clip control works in Backgrounds

### Quality Gates
- [ ] No regressions in existing controls (test all 8 sections)
- [ ] Dark theme consistency maintained (no new colors outside palette)
- [ ] Panel width stays at 300px (no overflow or layout breakage)
- [ ] All new controls follow existing SliderRow/SelectRow/ColorRow patterns
- [ ] ITERATION_LOG.md updated for each completed task

## Task Summary (ordered by priority)

| # | Task | Phase | Stream | Files | Est. Lines |
|---|------|-------|--------|-------|-----------|
| 0 | Revert broken refactoring | 0 | — | WebflowPanel.tsx, SpacingBoxModel.tsx | revert |
| 1 | Unit conversion on unit change | 1 | A | WebflowPanel.tsx | +60 |
| 2 | Enhanced StyleIndicator detection | 1 | A | StyleIndicator.tsx, WebflowPanel.tsx | +25 |
| 3 | Tab/Shift+Tab focus navigation | 1 | A | WebflowPanel.tsx (controls) | +30 |
| 4 | Display toggle buttons | 2A | B | WebflowPanel.tsx (Layout) | +45 |
| 5 | Gap lock (row/col gap) | 2B | B | WebflowPanel.tsx (Layout) | +35 |
| 6 | Box sizing control | 2C | C | WebflowPanel.tsx (Size) | +20 |
| 7 | "More size options" collapsible | 2D | C | WebflowPanel.tsx (Size) | +25 |
| 8 | Overflow icon buttons + per-axis | 2E | C | WebflowPanel.tsx (Size) | +60 |
| 9 | Effects: user-select, perspective, backface | 2F | D | WebflowPanel.tsx (Effects) | +40 |
| 10 | Typography: hyphens, direction, col-gap, text-shadow | 2G | E | WebflowPanel.tsx (Typography) | +55 |
| 11 | Backgrounds: background-clip | 2H | F | WebflowPanel.tsx (Backgrounds) | +15 |
| 12 | Enhanced color picker (HSB + opacity) | 3A | — | ColorPickerEnhanced.tsx | +350 |
| 13 | Bezier curve editor | 3B | — | BezierEditor.tsx | +250 |

## References

- Spec: `webflow-style-panel-spec.md` (all 13 sections)
- Reference image: `webflow-panel-reference.png` (project root) — actual Webflow Designer screenshot
- Committed WebflowPanel.tsx: 1721 lines (HEAD) — the working baseline
- Existing components: `StyleIndicator.tsx:28`, `ShadowEditor.tsx`, `FilterSliders.tsx`, `TransformEditor.tsx`, `TransitionEditor.tsx`, `BackgroundLayerList.tsx`, `SpacingBoxModel.tsx`, `PositionOffsetDiagram.tsx`
- Controls: `controls.tsx` — SliderRow, SelectRow, ColorRow, TextRow, Section
- Previous plan: `docs/plans/2026-03-11-feat-complete-webflow-panel-phases-b-c-plan.md`
