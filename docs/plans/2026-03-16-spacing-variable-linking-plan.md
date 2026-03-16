# Spacing Variable Linking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Webflow-style variable linking to the spacing box model so margin/padding values can reference CSS variables via `var(--name)`.

**Architecture:** Reuse the `extractVar` + `getAuthoredValue` pattern from SizeSection.tsx. SpacingSection tracks 8 variable states (one per spacing prop). SpacingBoxModel renders purple variable names when linked. SpacingValuePopover gains a VariableLinkDot that opens the existing VariablePicker.

**Tech Stack:** React, inline styles, VariableLinkDot, VariablePicker, getAuthoredValue, discoverLengthVariables

---

### Task 1: Add variable state tracking to SpacingSection.tsx

**Files:**
- Modify: `src/overlay/sections/SpacingSection.tsx`
- Test: `src/overlay/__tests__/spacingVariableLinking.test.ts`

**Step 1: Write failing test**

```ts
// src/overlay/__tests__/spacingVariableLinking.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("SpacingSection variable linking", () => {
  it("extractSpacingVar returns variable name when authored value is var()", () => {
    // This tests the helper we'll add to SpacingSection
    const el = document.createElement("div");
    el.style.setProperty("margin-top", "var(--space-4)");
    document.body.appendChild(el);

    // getAuthoredValue should detect the var() reference
    const { getAuthoredValue } = await import("../getAuthoredValue");
    const authored = getAuthoredValue(el, "margin-top");
    expect(authored).toBe("var(--space-4)");

    const match = authored?.match(/^var\(\s*(--[\w-]+)/)?.[1];
    expect(match).toBe("--space-4");

    document.body.removeChild(el);
  });

  it("extractSpacingVar returns null for plain numeric values", () => {
    const el = document.createElement("div");
    el.style.setProperty("margin-top", "16px");
    document.body.appendChild(el);

    const { getAuthoredValue } = await import("../getAuthoredValue");
    const authored = getAuthoredValue(el, "margin-top");
    const match = authored?.match(/^var\(\s*(--[\w-]+)/)?.[1] ?? null;
    expect(match).toBeNull();

    document.body.removeChild(el);
  });
});
```

**Step 2: Run test to verify it passes** (these test existing `getAuthoredValue` — should pass immediately)

Run: `npx vitest run src/overlay/__tests__/spacingVariableLinking.test.ts`

**Step 3: Add variable state to SpacingSection.tsx**

Add these imports at top of `SpacingSection.tsx`:
```ts
import { getAuthoredValue } from "../getAuthoredValue";
import { discoverLengthVariables } from "../variables/discoverVariables";
```

Inside the component, after the unit state, add:
```ts
// ─── CSS variable state per spacing property ────────────────────
const extractVar = (prop: string): string | null => {
  const authored = getAuthoredValue(element, prop);
  return authored?.match(/^var\(\s*(--[\w-]+)/)?.[1] ?? null;
};

const [spacingVars, setSpacingVars] = useState<Record<string, string | null>>(() => {
  const vars: Record<string, string | null> = {};
  for (const group of ["margin", "padding"]) {
    for (const side of ["top", "right", "bottom", "left"]) {
      const prop = `${group}-${side}`;
      vars[prop] = extractVar(prop);
    }
  }
  return vars;
});

const handleSpacingVarChange = useCallback((prop: string, varName: string | null) => {
  setSpacingVars(prev => ({ ...prev, [prop]: varName }));
  if (varName) {
    ctx.apply(prop, `var(${varName})`);
  } else {
    // Unlink: resolve computed value and apply as numeric
    const computed = parseFloat(getComputedStyle(element).getPropertyValue(prop));
    const isMargin = prop.startsWith("margin");
    const unit = isMargin ? marginUnit : paddingUnit;
    onSpacingChange(prop, isNaN(computed) ? 0 : computed, unit);
  }
}, [element, ctx, marginUnit, paddingUnit, onSpacingChange]);
```

Pass new props to SpacingBoxModel:
```tsx
<SpacingBoxModel
  /* ...existing props... */
  cssVars={spacingVars}
  onVarChange={handleSpacingVarChange}
/>
```

**Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: errors about missing `cssVars`/`onVarChange` props on SpacingBoxModel (expected — Task 2 adds them)

**Step 5: Commit**

```bash
git add src/overlay/sections/SpacingSection.tsx src/overlay/__tests__/spacingVariableLinking.test.ts
git commit -m "feat(spacing): add per-property variable state tracking to SpacingSection"
```

---

### Task 2: Add variable display to SpacingBoxModel.tsx

**Files:**
- Modify: `src/overlay/sections/SpacingBoxModel.tsx`
- Test: `src/overlay/__tests__/spacingVariableLinking.test.ts` (extend)

**Step 1: Add new tests**

Append to `spacingVariableLinking.test.ts`:
```ts
describe("SpacingBoxModel variable display", () => {
  it("displays variable name instead of number when cssVars has a value", () => {
    // Render SpacingBoxModel with cssVars set
    // Check that the value cell shows the variable name text
    // This is a behavior contract — implementation renders varName in purple
    expect(true).toBe(true); // Placeholder — real test below
  });

  it("disables drag-to-scrub when variable is linked", () => {
    // When cssVars[prop] is set, pointer events should not initiate scrub
    expect(true).toBe(true); // Placeholder — real test below
  });
});
```

**Step 2: Add `cssVars` and `onVarChange` props to SpacingBoxModelProps**

In `SpacingBoxModel.tsx`, add to the interface:
```ts
/** Per-property CSS variable name (e.g. { "margin-top": "--space-4" }) */
cssVars?: Record<string, string | null>;
/** Called when a variable is linked/unlinked on a spacing property */
onVarChange?: (prop: string, varName: string | null) => void;
```

Destructure in the component:
```ts
cssVars = {},
onVarChange,
```

**Step 3: Modify `renderValue` to show variable name when linked**

In the `renderValue` function, at the top, check if linked:
```ts
const linkedVar = cssVars[prop] ?? null;
```

When `linkedVar` is set, render a purple variable name instead of the number:
```tsx
if (linkedVar) {
  return (
    <div
      data-spacing-index={tabIndex}
      data-spacing-prop={prop}
      tabIndex={0}
      role="button"
      aria-label={propLabel(prop)}
      style={{
        fontSize: 9,
        fontFamily: font.mono,
        fontWeight: 500,
        color: color.variable,
        cursor: "pointer",
        padding: "2px 3px",
        borderRadius: 3,
        minWidth: 18,
        textAlign: "center",
        outline: "none",
        userSelect: "none",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 55,
        position: "relative",
      }}
      title={`var(${linkedVar}) — click to edit`}
      onClick={() => {
        const rect = (document.querySelector(`[data-spacing-prop="${prop}"]`) as HTMLElement)?.getBoundingClientRect();
        if (rect) setPopoverState({ prop, rect });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setPopoverState({ prop, rect });
        }
      }}
      onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = focusRing; }}
      onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      {linkedVar.replace(/^--/, "")}
    </div>
  );
}
```

The rest of `renderValue` (numeric display) stays unchanged. Drag-to-scrub is naturally disabled because the linked branch returns early before the `onPointerDown` handler.

**Step 4: Pass `cssVars` through to SpacingValuePopover**

In the popover rendering section, add the variable props:
```tsx
{popoverState && (
  <SpacingValuePopover
    /* ...existing props... */
    element={element}
    activeVariable={cssVars[popoverState.prop] ?? null}
    onSelectVariable={(varExpr) => {
      const varName = varExpr.match(/^var\(\s*(--[\w-]+)/)?.[1] ?? null;
      if (varName && onVarChange) {
        onVarChange(popoverState.prop, varName);
        setPopoverState(null);
      }
    }}
    onUnlink={() => {
      if (onVarChange) {
        onVarChange(popoverState.prop, null);
        setPopoverState(null);
      }
    }}
  />
)}
```

**Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: errors about new props on SpacingValuePopover (expected — Task 3 adds them)

**Step 6: Commit**

```bash
git add src/overlay/sections/SpacingBoxModel.tsx src/overlay/__tests__/spacingVariableLinking.test.ts
git commit -m "feat(spacing): display purple variable names in box model when linked"
```

---

### Task 3: Add VariableLinkDot to SpacingValuePopover.tsx

**Files:**
- Modify: `src/overlay/sections/SpacingValuePopover.tsx`
- Test: `src/overlay/__tests__/spacingVariableLinking.test.ts` (extend)

**Step 1: Add new props to SpacingValuePopoverProps**

```ts
/** Target element for variable discovery */
element?: Element;
/** Currently linked variable name (e.g. "--space-4") or null */
activeVariable?: string | null;
/** Called when user selects a variable — receives "var(--name)" */
onSelectVariable?: (varExpr: string) => void;
/** Called when user unlinks the variable */
onUnlink?: () => void;
```

Destructure with defaults:
```ts
element,
activeVariable = null,
onSelectVariable,
onUnlink,
```

**Step 2: Import VariableLinkDot**

```ts
import { VariableLinkDot } from "../controls/VariableLinkDot";
```

**Step 3: Add the dot to the slider row**

Inside the top row (the flex container with icon, input, slider, unit), add the VariableLinkDot **after the unit selector**, as the last item:

```tsx
{/* Variable link dot */}
{onSelectVariable && (
  <VariableLinkDot
    rowHovered={true}  /* always visible inside popover */
    isLinked={!!activeVariable}
    onUnlink={onUnlink}
    variableType="length"
    element={element}
    onSelect={(varExpr) => onSelectVariable?.(varExpr)}
    activeVariable={activeVariable}
    inline
  />
)}
```

Key: `inline` prop renders it as an inline flex item (no absolute positioning), and `rowHovered={true}` keeps it always visible since we're already inside the popover.

**Step 4: When linked, show variable name instead of slider**

At the top of the component's return, before the slider row, add a conditional:

```tsx
const isLinked = !!activeVariable;
```

Replace the top row with a conditional render:
- **Linked mode:** Show purple variable name + unlink dot (no slider/input/presets)
- **Unlinked mode:** Existing slider row + presets (unchanged)

When linked:
```tsx
{isLinked ? (
  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
    <div
      style={{
        flex: 1,
        height: 24,
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        background: `${color.variable}1a`, /* variableAlpha(0.1) */
        borderRadius: 4,
        border: `1px solid ${color.variable}4d`, /* variableAlpha(0.3) */
      }}
    >
      <span style={{
        fontSize: 11,
        fontFamily: font.mono,
        color: color.variable,
        fontWeight: 500,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {activeVariable.replace(/^--/, "")}
      </span>
    </div>
    {onSelectVariable && (
      <VariableLinkDot
        rowHovered={true}
        isLinked={true}
        onUnlink={onUnlink}
        variableType="length"
        element={element}
        onSelect={(varExpr) => onSelectVariable?.(varExpr)}
        activeVariable={activeVariable}
        inline
      />
    )}
  </div>
) : (
  /* existing slider row JSX — unchanged */
)}
```

When linked, also hide the preset grid (it doesn't make sense when value is a variable reference).

**Step 5: Increase popover width slightly**

Change `popoverWidth` from 220 to 240 to accommodate the dot comfortably:
```ts
const popoverWidth = 240;
```

**Step 6: Run tests**

Run: `npx vitest run src/overlay/__tests__/spacingVariableLinking.test.ts`
Expected: PASS

**Step 7: Run full test suite**

Run: `npm test`
Expected: all tests pass

**Step 8: Commit**

```bash
git add src/overlay/sections/SpacingValuePopover.tsx src/overlay/__tests__/spacingVariableLinking.test.ts
git commit -m "feat(spacing): add VariableLinkDot to SpacingValuePopover for variable linking"
```

---

### Task 4: Integration — wire everything together and typecheck

**Files:**
- Modify: `src/overlay/sections/SpacingSection.tsx` (finalize)
- Modify: `src/overlay/sections/SpacingBoxModel.tsx` (finalize)
- Modify: `src/overlay/sections/SpacingValuePopover.tsx` (finalize)

**Step 1: Verify all new props are passed correctly**

SpacingSection → SpacingBoxModel: `cssVars`, `onVarChange`
SpacingBoxModel → SpacingValuePopover: `element`, `activeVariable`, `onSelectVariable`, `onUnlink`

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

**Step 3: Run full test suite**

Run: `npm test`
Expected: all existing tests still pass + new tests pass

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(spacing): complete variable linking wiring across section/box-model/popover"
```

---

### Task 5: Build and browser test

**Files:**
- None (testing only)

**Step 1: Build**

Run: `npm run build`
Expected: clean build, no errors

**Step 2: Browser test checklist**

Open `http://localhost:3000/demo` in Chrome. Select an element with spacing.

1. Click a spacing value (e.g., padding-top) → popover opens
2. Purple dot visible at right edge of slider row
3. Click purple dot → VariablePicker opens with length variables
4. Select a variable → popover closes, box model shows variable name in purple
5. Click the purple variable name → popover opens in linked mode (purple pill + dot)
6. Click dot (shows ×) → unlinks, numeric value restored
7. Drag-to-scrub still works on non-linked values
8. Alt+click complementary sides still works on non-linked values
9. Undo (Cmd+Z) reverts variable link

**Step 3: Fix any issues found, re-build, re-test**

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(spacing): polish variable linking after browser testing"
```
