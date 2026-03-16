---
title: Wire SliderRow Variable Linking into Sections
type: feat
date: 2026-03-16
deepened: 2026-03-16
---

# Wire SliderRow Variable Linking into Sections

## Enhancement Summary

**Deepened on:** 2026-03-16
**Key additions:** Concrete code snippets, codebase-specific gotchas, test considerations

### Critical Gotchas (from codebase research)
1. **`overflow: "clip"` not `"hidden"`** — `unitDropdownClip.test.ts` scans all overlay files for `overflow: "hidden"` ancestors and flags them as bugs. Use `"clip"` instead.
2. **`data-tuner-portal`** — Any `createPortal` wrapper MUST include this attribute or clicks get intercepted by Overlay's capture-phase reselect handler.
3. **`parseVarRef`** from `variables/colorVariables.ts` — Reuse this for var() detection rather than inline regex. Returns `--name` or `null`.
4. **`gapLocked` state** — When gap is locked and user links a variable, must also apply to row-gap/column-gap to stay in sync.
5. **Opacity is 0-1 internally but 0-100 in UI** — The `handleOpacitySliderChange` divides by 100. Variable linking bypasses the slider, so `apply("opacity", varExpr)` is correct (CSS handles it).

## Overview

Add variable linking support to SliderRow and wire it into all section instances that have `computedProp`/`computedElement`. This lets users link numeric CSS properties (gap, opacity) to CSS variables via `var(--name)` references, matching ColorRow's existing variable-first workflow.

## Problem

Colors already link to variables. Numeric controls (gap, opacity, font-size, etc.) don't. Users who define spacing/sizing tokens can't apply them from the panel.

## Tasks

### Phase 0: SliderRow Component (props were reverted, need re-implementation)

SliderRow.tsx currently has NO variable linking props. The auto-commit hook reverted them. Must re-add.

**Reference pattern:** `ColorRow.tsx:87-98` — state + parseVarRef + display logic.

- [x] **Add 3 optional props** to SliderRow:
  ```typescript
  onSelectVariable?: (varExpr: string) => void;
  activeVariable?: string | null;
  variableElement?: Element;
  ```
- [x] **Import VariablePicker** from `"./VariablePicker"` and add state: `varPickerOpen`, `linkBtnRef`
- [x] **Two rendering modes** controlled by `activeVariable`:
  - **Numeric mode** (default): current slider+input+unit. Add link icon (🔗) at row end when `onSelectVariable` is provided
  - **Variable mode** (`activeVariable` is set): replace slider+input+unit with:
    ```tsx
    <span style={{ flex: 1, fontSize: 11, fontFamily: font.mono, color: primaryAlpha(0.8),
      overflow: "clip", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {activeVariable.replace(/^--/, "")}
    </span>
    ```
    Plus unlink icon + × reset icon
- [x] **Link icon**: `<button ref={linkBtnRef}>` that sets `setVarPickerOpen(true)`
- [x] **VariablePicker portal**:
  ```tsx
  {varPickerOpen && linkBtnRef.current && (
    <VariablePicker
      anchor={linkBtnRef.current}
      type="length"
      element={variableElement}
      onSelect={(varExpr) => { onSelectVariable?.(varExpr); setVarPickerOpen(false); }}
      onClose={() => setVarPickerOpen(false)}
      activeVariable={activeVariable}
    />
  )}
  ```
- [x] **Unlink handler**: resolve via `getComputedStyle(variableElement!)[computedProp!]`, parse to number, call `onChange(num)`
- [x] **Use `overflow: "clip"` not `"hidden"`** on variable name span (unitDropdownClip test scans for `"hidden"`)

### Phase 1: LayoutSection.tsx (~6 SliderRow instances across grid+flex)

**State** (add near other state declarations ~line 200):
```typescript
const [gapVar, setGapVar] = useState<string | null>(null);
const [rowGapVar, setRowGapVar] = useState<string | null>(null);
const [columnGapVar, setColumnGapVar] = useState<string | null>(null);
```

**Handlers** (add after existing gap handlers ~line 290):
```typescript
const handleGapSelectVar = useCallback((varExpr: string) => {
  setGapVar(varExpr.match(/var\((--[\w-]+)\)/)?.[1] ?? null);
  apply("gap", varExpr);
  if (gapLocked) {
    setRowGapVar(varExpr.match(/var\((--[\w-]+)\)/)?.[1] ?? null);
    setColumnGapVar(varExpr.match(/var\((--[\w-]+)\)/)?.[1] ?? null);
  }
}, [apply, gapLocked]);

const handleRowGapSelectVar = useCallback((varExpr: string) => {
  setRowGapVar(varExpr.match(/var\((--[\w-]+)\)/)?.[1] ?? null);
  apply("row-gap", varExpr);
}, [apply]);

const handleColumnGapSelectVar = useCallback((varExpr: string) => {
  setColumnGapVar(varExpr.match(/var\((--[\w-]+)\)/)?.[1] ?? null);
  apply("column-gap", varExpr);
}, [apply]);
```

**Clear on numeric change:**
- `handleGapChange`: add `setGapVar(null);` (and `setRowGapVar(null); setColumnGapVar(null);` when locked)
- `handleRowGapChange`: add `setRowGapVar(null);`
- `handleColumnGapChange`: add `setColumnGapVar(null);`

**Clear on reset** — each onReset callback adds `setXxxVar(null)`:
- `onReset={() => { resetCss("gap", setGap); setGapVar(null); }}`
- `onReset={() => { resetCss("row-gap", setRowGap); setRowGapVar(null); }}`
- `onReset={() => { resetCss("column-gap", (v) => onColumnGapChange(v)); setColumnGapVar(null); }}`

**Pass props to all 6 SliderRow instances:**
```tsx
onSelectVariable={handleGapSelectVar}
activeVariable={gapVar}
variableElement={element}
```

**Instances (all 6):**
| Instance | Line | Var state | Handler |
|----------|------|-----------|---------|
| Grid Gap (locked) | ~465 | `gapVar` | `handleGapSelectVar` |
| Grid Row Gap | ~518 | `rowGapVar` | `handleRowGapSelectVar` |
| Grid Col Gap | ~566 | `columnGapVar` | `handleColumnGapSelectVar` |
| Flex Gap (locked) | ~677 | `gapVar` | `handleGapSelectVar` |
| Flex Row Gap | ~730 | `rowGapVar` | `handleRowGapSelectVar` |
| Flex Col Gap | ~778 | `columnGapVar` | `handleColumnGapSelectVar` |

### Phase 2: EffectsSection.tsx (1 SliderRow instance)

**State** (add near other state ~line 170):
```typescript
const [opacityVar, setOpacityVar] = useState<string | null>(null);
```

**Handler:**
```typescript
const handleOpacitySelectVar = useCallback((varExpr: string) => {
  setOpacityVar(varExpr.match(/var\((--[\w-]+)\)/)?.[1] ?? null);
  apply("opacity", varExpr);
}, [apply]);
```

**Clear on numeric change** — `handleOpacitySliderChange` and `handleOpacityChange`: add `setOpacityVar(null);`

**Clear on reset** — the inline onReset at line ~321: add `setOpacityVar(null);`

**Pass props to opacity SliderRow (line ~321):**
```tsx
onSelectVariable={handleOpacitySelectVar}
activeVariable={opacityVar}
variableElement={element}
```

## Acceptance Criteria

- [ ] `npm run typecheck` — clean
- [ ] `npm test` — all pass (especially `unitDropdownClip.test.ts`)
- [ ] Browser: select element with gap → click link icon → VariablePicker opens → select variable → row shows variable mode → unlink resolves to numeric → reset clears

## Edge Cases

- **Element changes**: When user selects a different element, section re-mounts and state resets to `null` — correct behavior since new element may not use var()
- **Locked gap + variable**: When gap is locked and user links a variable, all three (gap, row-gap, column-gap) should show the same variable
- **No variables available**: VariablePicker handles empty state — shows "No variables found"
- **Opacity var()**: CSS `opacity` accepts var() natively, no conversion needed

## Files

- `src/overlay/controls/SliderRow.tsx` — variable mode + 3 new props
- `src/overlay/sections/LayoutSection.tsx` — wire gap/row-gap/column-gap
- `src/overlay/sections/EffectsSection.tsx` — wire opacity
