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

### Phase 2: Missing Per-Section Controls (10 tasks)

#### 2A: Effects Section Additions
**File**: `src/overlay/WebflowPanel.tsx` (Effects section, ~line 1680)

| Control | CSS Property | Type | Values |
|---------|-------------|------|--------|
| User Select | `user-select` | SelectRow | `auto`, `none`, `text`, `all` |
| Perspective | `perspective` | SliderRow | 0–2000px |
| Backface | `backface-visibility` | SelectRow | `visible`, `hidden` |

**State**: 3 new `useState` calls initialized from computed style.
**Handlers**: 3 new `handleXxxChange` callbacks calling `apply()`.
**JSX**: Add after Visibility SelectRow.

#### 2B: Typography Advanced Additions
**File**: `src/overlay/WebflowPanel.tsx` (Typography Advanced sub-section, ~line 1636)

| Control | CSS Property | Type | Values |
|---------|-------------|------|--------|
| Hyphens | `hyphens` | SelectRow | `none`, `manual`, `auto` |
| Direction | `direction` | SelectRow | `ltr`, `rtl` |
| Col Gap | `column-gap` | SliderRow | 0–100px |
| Text Shadow | `text-shadow` | ShadowEditor | X, Y, blur, color (reuse ShadowEditor) |

**State**: 4 new `useState` calls.
**For text-shadow**: Reuse `ShadowEditor` component (already supports multi-value). Parse `text-shadow` the same way as `box-shadow` (same syntax). Need a `parseTextShadow` and `textShadowToCSS` pair (can reuse existing `parseBoxShadow`/`shadowToCSS` since text-shadow has no spread or inset).

#### 2C: Size Section Additions
**File**: `src/overlay/WebflowPanel.tsx` (Size section, ~line 1520)

| Control | CSS Property | Type | Values |
|---------|-------------|------|--------|
| Overflow X | `overflow-x` | SelectRow | `visible`, `hidden`, `scroll`, `auto` |
| Overflow Y | `overflow-y` | SelectRow | `visible`, `hidden`, `scroll`, `auto` |

**Implementation**: Replace the single `overflow` SelectRow with a "lock" pattern:
- When locked: single Overflow dropdown applies to both axes
- When unlocked: two separate Overflow X / Overflow Y dropdowns
- Add a small 🔗 toggle button between label and dropdown
- State: `overflowLocked` boolean, `overflowX`, `overflowY`

#### 2D: Backgrounds Section Additions
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
Phase 0 (fix)              → MUST complete first
                             ↓
Phase 1 (3 tasks)    ──┐
Phase 2A (Effects)   ──┤
Phase 2B (Typography)──┼── all independent, run in parallel
Phase 2C (Size)      ──┤
Phase 2D (Backgrounds)──┘
                        ↓
Phase 3A (Color picker) ── after Phases 1+2 merge
Phase 3B (Bezier editor)── after Phases 1+2 merge
```

Tasks within Phase 1 are independent of Phase 2 tasks. Within Phase 2, all sub-tasks (2A-2D) modify different sections of WebflowPanel.tsx and can be parallelized with careful merge.

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

| # | Task | Phase | Files | Est. Lines |
|---|------|-------|-------|-----------|
| 0 | Revert broken refactoring | 0 | WebflowPanel.tsx, SpacingBoxModel.tsx | -1200 (revert) |
| 1 | Unit conversion on unit change | 1 | WebflowPanel.tsx | +60 |
| 2 | Enhanced StyleIndicator detection | 1 | StyleIndicator.tsx, WebflowPanel.tsx | +25 |
| 3 | Tab/Shift+Tab focus navigation | 1 | WebflowPanel.tsx (controls) | +30 |
| 4 | Effects: user-select, perspective, backface | 2A | WebflowPanel.tsx | +40 |
| 5 | Typography: hyphens, direction, col-gap | 2B | WebflowPanel.tsx | +35 |
| 6 | Typography: text-shadow editor | 2B | WebflowPanel.tsx | +25 |
| 7 | Size: per-axis overflow (locked/unlocked) | 2C | WebflowPanel.tsx | +50 |
| 8 | Backgrounds: background-clip | 2D | WebflowPanel.tsx | +15 |
| 9 | Enhanced color picker (HSB + opacity) | 3A | ColorPickerEnhanced.tsx, WebflowPanel.tsx | +350 |
| 10 | Bezier curve editor | 3B | BezierEditor.tsx, TransitionEditor.tsx | +250 |

## References

- Spec: `webflow-style-panel-spec.md` (all 13 sections)
- Committed WebflowPanel.tsx: 1721 lines (HEAD) — the working baseline
- Existing components: `StyleIndicator.tsx:28`, `ShadowEditor.tsx`, `FilterSliders.tsx`, `TransformEditor.tsx`, `TransitionEditor.tsx`, `BackgroundLayerList.tsx`, `SpacingBoxModel.tsx`, `PositionOffsetDiagram.tsx`
- Controls: `controls.tsx` — SliderRow, SelectRow, ColorRow, TextRow, Section
- Previous plan: `docs/plans/2026-03-11-feat-complete-webflow-panel-phases-b-c-plan.md`
