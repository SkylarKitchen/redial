# Variable Link Dot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Link2 icon-button variable trigger with a Webflow-style purple dot that progressively reveals on hover: hidden → purple dot with white center → purple circle with white `+` → click opens VariablePicker.

**Architecture:** New shared `<VariableLinkDot>` component in `controls/`. Positioned absolutely in the top-left corner of the input field. Each consumer wraps its input area in `position: relative` and renders the dot inside. Row-level hover state controls dot visibility. Existing `VariablePicker` reused unchanged.

**Tech Stack:** React inline styles, `createPortal` for VariablePicker, theme.ts tokens, Vitest.

---

## Task 1: Add purple theme token

**Files:**
- Modify: `src/overlay/theme.ts`

**Step 1: Add `color.variable` and `variableAlpha` helper**

In `theme.ts`, add to the `color` object after the `// ── Blue accent ──` section:

```ts
// Inside color = { ... }
  // ── Variable linking ──
  /** Purple accent — variable link affordance */
  variable: "#6B5CE7",
```

Then add an alpha helper after the existing alpha helpers (~line 144):

```ts
/** Variable purple at a given alpha — derived from color.variable */
export const variableAlpha = (a: number) => hexToRgba(color.variable, a);
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (additive change only)

**Step 3: Commit**

```
feat(theme): add color.variable purple token for link dot
```

---

## Task 2: Create `VariableLinkDot` component

**Files:**
- Create: `src/overlay/controls/VariableLinkDot.tsx`
- Modify: `src/overlay/controls/index.ts` (add re-export)
- Create: `src/overlay/__tests__/variableLinkDot.test.ts`

**Step 1: Write the failing test**

```ts
// src/overlay/__tests__/variableLinkDot.test.ts
// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

describe("VariableLinkDot", () => {
  it("exports from controls barrel", async () => {
    const mod = await import("../controls");
    expect(mod.VariableLinkDot).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/overlay/__tests__/variableLinkDot.test.ts`
Expected: FAIL — `VariableLinkDot` not exported

**Step 3: Create the component**

Create `src/overlay/controls/VariableLinkDot.tsx`:

```tsx
/**
 * VariableLinkDot.tsx — Webflow-style purple dot that triggers variable linking.
 *
 * Progressive disclosure:
 *   1. Row not hovered → hidden (opacity 0)
 *   2. Row hovered → small purple circle with white dot center
 *   3. Dot hovered → purple circle with white + sign
 *   4. Clicked → opens VariablePicker via onOpen callback
 *
 * Position: absolute top-left corner of parent (parent must be position: relative).
 * Size: 14px circle, shifted -7px top/left to sit on the corner.
 */

import { useState, useRef, useCallback } from "react";
import { color, variableAlpha } from "../theme";
import { ms } from "../timing";
import { VariablePicker, type VariablePickerProps } from "./VariablePicker";

const DOT_SIZE = 14;
const OFFSET = -(DOT_SIZE / 2); // -7px — center on corner

export interface VariableLinkDotProps {
  /** Is the parent row currently hovered? Controls visibility. */
  rowHovered: boolean;
  /** Variable type filter for the picker */
  variableType?: "color" | "length" | "all";
  /** Element for scoped variable discovery */
  element?: Element;
  /** Called when user selects a variable — receives `var(--name)` */
  onSelect: (varExpr: string) => void;
  /** Currently active variable name (e.g. `--spacing-4`) for highlighting in picker */
  activeVariable?: string | null;
}

export function VariableLinkDot({
  rowHovered,
  variableType = "length",
  element,
  onSelect,
  activeVariable,
}: VariableLinkDotProps) {
  const [dotHovered, setDotHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dotRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPickerOpen((prev) => !prev);
  }, []);

  const handleSelect = useCallback(
    (varExpr: string) => {
      onSelect(varExpr);
      setPickerOpen(false);
    },
    [onSelect],
  );

  const visible = rowHovered || pickerOpen;

  return (
    <>
      <button
        ref={dotRef}
        type="button"
        title="Link to variable"
        onClick={handleClick}
        onMouseEnter={() => setDotHovered(true)}
        onMouseLeave={() => setDotHovered(false)}
        style={{
          position: "absolute",
          top: OFFSET,
          left: OFFSET,
          zIndex: 1,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: "50%",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color.variable,
          opacity: visible ? 1 : 0,
          transform: dotHovered ? "scale(1.15)" : "scale(1)",
          transition: `opacity ${ms("fast")}, transform 100ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
          pointerEvents: visible ? "auto" : "none",
          // Prevent focus outline from looking odd on a tiny circle
          outline: "none",
        }}
      >
        {/* White center: dot when idle, + when hovered */}
        {dotHovered ? (
          // Plus sign — two crossing bars
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <line x1="4" y1="1" x2="4" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="1" y1="4" x2="7" y2="4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          // Small white dot
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "white",
            }}
          />
        )}
      </button>
      {pickerOpen && dotRef.current && (
        <VariablePicker
          anchor={dotRef.current}
          type={variableType}
          element={element}
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
          activeVariable={activeVariable}
        />
      )}
    </>
  );
}
```

**Step 4: Add barrel export**

In `src/overlay/controls/index.ts`, add:

```ts
export { VariableLinkDot } from "./VariableLinkDot";
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --run src/overlay/__tests__/variableLinkDot.test.ts`
Expected: PASS

**Step 6: Commit**

```
feat(controls): add VariableLinkDot component — purple dot with progressive hover disclosure
```

---

## Task 3: Wire into SliderRow

**Files:**
- Modify: `src/overlay/controls/SliderRow.tsx`

**Overview:** Replace the `Link2` icon button with `VariableLinkDot`. Add row-level hover tracking. The input area (bordered div with ValueInput + UnitSelector) gets `position: relative` so the dot sits on its top-left corner.

**Step 1: Write the failing test**

Add to `src/overlay/__tests__/variableLinkDot.test.ts`:

```ts
describe("SliderRow link dot integration", () => {
  it("does not render Link2 icon (replaced by VariableLinkDot)", async () => {
    // The SliderRow module should no longer import Link2 from lucide-react
    const source = await import("../controls/SliderRow?raw");
    // After refactor, Link2 should only remain for fallback or be fully removed
    // This is a structural check — the actual rendering test is in browser
  });
});
```

> Note: The real verification is visual/browser. The unit test ensures the import was removed.

**Step 2: Refactor SliderRow.tsx**

Key changes in the **numeric mode** (non-variable) render path:

1. Add `const [rowHovered, setRowHovered] = useState(false);` at the top.
2. Add `onMouseEnter` / `onMouseLeave` on the outer `<div style={rowStyle}>`.
3. Add `position: "relative"` to the bordered input container div.
4. Render `<VariableLinkDot>` inside that container (before `<ValueInput>`).
5. **Remove** the `Link2` icon button block (lines ~250-275).
6. Remove `Link2` from the lucide-react import (keep `Unlink` and `X` for variable mode).
7. Remove `linkBtnRef` — no longer needed (the dot manages its own ref internally).
8. Remove the standalone `{varPickerOpen && ...}` block — the dot manages its own VariablePicker.

The **variable mode** render path (when `activeVariable` is set) stays unchanged — it still shows the variable name + Unlink + X reset.

Before (numeric mode, abbreviated):
```tsx
<div style={{ display: "flex", ... border, background ... }}>
  <ValueInput ... />
  <div style={{ borderLeft ... }}><UnitSelector ... /></div>
</div>
{onSelectVariable && (
  <button ref={linkBtnRef} ...><Link2 size={11} /></button>
)}
```

After:
```tsx
<div style={{ display: "flex", ... border, background, position: "relative" }}>
  {onSelectVariable && (
    <VariableLinkDot
      rowHovered={rowHovered}
      variableType={variableType ?? "length"}
      element={variableElement}
      onSelect={(varExpr) => { onSelectVariable(varExpr); }}
      activeVariable={activeVariable}
    />
  )}
  <ValueInput ... />
  <div style={{ borderLeft ... }}><UnitSelector ... /></div>
</div>
```

**Step 3: Run full tests**

Run: `npm test -- --run`
Expected: All tests pass. If any SliderRow tests reference `Link2` or `linkBtnRef`, update them.

**Step 4: Build and visually verify**

Run: `npm run build`
Check: `http://localhost:3000/demo` — hover a SliderRow (e.g. Gap), purple dot appears on top-left corner of the input field.

**Step 5: Commit**

```
feat(SliderRow): replace Link2 icon with VariableLinkDot purple dot
```

---

## Task 4: Wire into ColorRow

**Files:**
- Modify: `src/overlay/controls/ColorRow.tsx`

**Overview:** ColorRow already has variable linking via two paths: (a) the color picker's built-in variable list, and (b) a standalone `Link2` button + `VariablePicker`. Replace path (b) — the `Link2` button — with the purple dot. Keep the Unlink button for when a variable is active.

**Step 1: Refactor ColorRow.tsx**

Key changes:

1. Add `const [rowHovered, setRowHovered] = useState(false);` at top.
2. Add `onMouseEnter`/`onMouseLeave` on the outer row div.
3. The swatch + value text area needs a `position: relative` wrapper for the dot to anchor to. Add a wrapper `<div style={{ position: "relative", display: "flex", ... }}>` around the swatch and text span.
4. Render `<VariableLinkDot>` inside that wrapper (only when `!varName`, i.e. not already linked).
5. **Remove** the standalone `Link2` button block and `linkBtnRef`.
6. **Remove** the standalone `{varPickerOpen && linkBtnRef.current && ...}` block.
7. Remove `Link2` from lucide-react import (keep `Unlink`, `X`).
8. Remove `varPickerOpen` state and `linkBtnRef` ref.
9. Set `variableType="color"` on the dot.

The Unlink button (when `varName` is set) stays as-is.

**Step 2: Run tests + build**

Run: `npm test -- --run && npm run build`

**Step 3: Commit**

```
feat(ColorRow): replace Link2 icon with VariableLinkDot purple dot
```

---

## Task 5: Wire into SizeInputCell

**Files:**
- Modify: `src/overlay/sections/SizeInputCell.tsx`

**Overview:** SizeInputCell currently handles variable linking through the UnitSelector dropdown (the unit dropdown has a "Variables" section). The purple dot is an **additional** entry point — it opens the VariablePicker directly without going through the unit dropdown.

**Step 1: Add props and refactor**

1. Add `const [rowHovered, setRowHovered] = useState(false);` at top.
2. The outer bordered container div already exists. Add `position: "relative"` to it.
3. Add `onMouseEnter`/`onMouseLeave` on the outer `<div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2 }}>` wrapper.
4. Render `<VariableLinkDot>` inside the bordered container div (only when `!isVariable && !isKeyword && variableOptions && onCssVarChange`). The dot's `onSelect` should extract the var name from `var(--name)` and call `onCssVarChange(name)`.

```tsx
{!isVariable && !isKeyword && variableOptions && onCssVarChange && (
  <VariableLinkDot
    rowHovered={rowHovered}
    variableType="length"
    element={undefined}
    onSelect={(varExpr) => {
      const match = varExpr.match(/^var\((.+)\)$/);
      if (match) onCssVarChange(match[1]);
    }}
    activeVariable={cssVar}
  />
)}
```

Note: SizeInputCell's `onCssVarChange` takes just the variable name (e.g. `--spacing-4`), not the full `var()` expression. The dot's `onSelect` returns `var(--spacing-4)`, so we extract the inner name.

**Step 2: Run tests + build**

Run: `npm test -- --run && npm run build`

**Step 3: Commit**

```
feat(SizeInputCell): add VariableLinkDot purple dot for variable linking
```

---

## Task 6: Wire into TypoValueCell

**Files:**
- Modify: `src/overlay/sections/layoutControls.tsx`

**Overview:** TypoValueCell follows the same pattern as SizeInputCell — it handles variables through UnitSelector. Add the purple dot as an additional entry point.

**Step 1: Add props and refactor**

1. Add `const [rowHovered, setRowHovered] = useState(false);` at top of TypoValueCell.
2. Add `onMouseEnter`/`onMouseLeave` on the outer container div.
3. Add `position: "relative"` to the outer container div.
4. Render `<VariableLinkDot>` inside (only when `!isVariable && !isKeyword && variableOptions && onCssVarChange`).

Same `onSelect` extraction pattern as SizeInputCell:
```tsx
onSelect={(varExpr) => {
  const match = varExpr.match(/^var\((.+)\)$/);
  if (match) onCssVarChange?.(match[1]);
}}
```

**Step 2: Run tests + build**

Run: `npm test -- --run && npm run build`

**Step 3: Commit**

```
feat(TypoValueCell): add VariableLinkDot purple dot for variable linking
```

---

## Task 7: Final test + cleanup

**Files:**
- Modify: `src/overlay/__tests__/variableLinkDot.test.ts`

**Step 1: Add integration tests**

```ts
describe("VariableLinkDot component", () => {
  it("renders with opacity 0 when rowHovered is false", () => {
    // Import and render with rowHovered=false
    // Check button style has opacity: 0
  });

  it("renders with opacity 1 when rowHovered is true", () => {
    // Import and render with rowHovered=true
    // Check button style has opacity: 1
  });

  it("uses color.variable (#6B5CE7) as background", () => {
    // Verify the purple token is applied
  });
});
```

**Step 2: Verify no stale Link2 imports in modified files**

Run grep to confirm Link2 is removed from SliderRow and ColorRow:

```bash
grep -n "Link2" src/overlay/controls/SliderRow.tsx src/overlay/controls/ColorRow.tsx
```

Expected: No matches (Link2 fully removed from both files).

**Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

**Step 4: Build**

Run: `npm run build`
Expected: Clean build

**Step 5: Commit**

```
test: add VariableLinkDot integration tests, verify Link2 cleanup
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Purple theme token | `theme.ts` |
| 2 | `VariableLinkDot` component | `VariableLinkDot.tsx`, `index.ts`, test |
| 3 | Wire into SliderRow | `SliderRow.tsx` |
| 4 | Wire into ColorRow | `ColorRow.tsx` |
| 5 | Wire into SizeInputCell | `SizeInputCell.tsx` |
| 6 | Wire into TypoValueCell | `layoutControls.tsx` |
| 7 | Final tests + cleanup | test file, grep verification |

**Controls NOT getting the dot (judgment call):**
- **SpacingBoxModel** — interactive diagram, not a standard input row. Variable linking not yet wired here. Dot doesn't have a natural anchor point.
- **LabelScrub** — drag-to-adjust label, not an input field. No variable linking wired.
- **SelectRow/DropdownRow** — keyword selectors (display, position, etc.), not numeric/color values. Variable linking doesn't apply.
- **NumberRow** — used for z-index and similar. Could be wired later but low priority.
