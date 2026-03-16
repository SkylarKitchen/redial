# Variable Field Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the small VariableLinkDot + inline variable name with a Webflow-style purple pill field, pencil-to-edit popover, and upgraded Connect picker across all 5 linkable controls.

**Architecture:** New `VariableField.tsx` component renders the purple pill (linked state), pencil hover icon, Edit Variable popover, and Connect picker. Each control delegates its linked-state rendering to `<VariableField />`. Unlinked-state VariableLinkDot stays unchanged. VariablePicker gets a "Connect" header + unlink X.

**Tech Stack:** React inline styles, theme.ts tokens, createPortal, existing discoverVariables/tokenCollections infrastructure.

**Design doc:** `docs/plans/2026-03-16-variable-field-redesign-design.md`

---

### Task 1: VariableField component + theme tokens

**Files:**
- Create: `src/overlay/controls/VariableField.tsx`
- Modify: `src/overlay/controls/index.ts`
- Test: `src/overlay/__tests__/variableField.test.ts`

**Step 1: Write the failing test**

```ts
// src/overlay/__tests__/variableField.test.ts
// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

describe("VariableField", () => {
  it("exports from controls barrel", async () => {
    const mod = await import("../controls");
    expect(mod.VariableField).toBeDefined();
  });

  it("exports VariableFieldProps type", async () => {
    const mod = await import("../controls/VariableField");
    expect(mod.VariableField).toBeTypeOf("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/overlay/__tests__/variableField.test.ts`
Expected: FAIL — module not found

**Step 3: Create VariableField.tsx**

Create `src/overlay/controls/VariableField.tsx`:

```tsx
/**
 * VariableField.tsx — Webflow-style purple pill for linked CSS variables.
 *
 * When a control is linked to a variable, this replaces the value area with:
 * - Purple pill showing variable name (click → Connect picker)
 * - Pencil icon on hover (click → Edit Variable popover)
 *
 * Used by: SliderRow, SizeInputCell, ColorRow, TypoValueCell, ModeValueCell
 */

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { color, font, layout, variableAlpha, zIndex, border, surface, text, shadow } from "../theme";
import { ms } from "../timing";
import { VariablePicker } from "./VariablePicker";

export interface VariableFieldProps {
  /** CSS variable name including -- prefix (e.g. "--size") */
  variableName: string;
  /** Variable type filter for the picker */
  variableType?: "color" | "length" | "all";
  /** Element for scoped variable discovery */
  element?: Element;
  /** Called when user selects a different variable; receives `var(--name)` */
  onSelectVariable: (varExpr: string) => void;
  /** Called when user unlinks the variable */
  onUnlink: () => void;
}

export function VariableField({
  variableName,
  variableType = "length",
  element,
  onSelectVariable,
  onUnlink,
}: VariableFieldProps) {
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);

  const displayName = variableName.replace(/^--/, "");

  const handlePillClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't open picker if edit popover is open
    if (editOpen) return;
    setPickerOpen((prev) => !prev);
  }, [editOpen]);

  const handlePencilClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditOpen((prev) => !prev);
    setPickerOpen(false);
  }, []);

  const handleSelect = useCallback((varExpr: string) => {
    onSelectVariable(varExpr);
    setPickerOpen(false);
  }, [onSelectVariable]);

  const handleUnlink = useCallback(() => {
    onUnlink();
    setPickerOpen(false);
  }, [onUnlink]);

  return (
    <>
      <div
        ref={pillRef}
        onClick={handlePillClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={`var(${variableName})`}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          height: 26,
          borderRadius: layout.pillRadius,
          background: variableAlpha(0.15),
          border: `1px solid ${variableAlpha(0.3)}`,
          padding: "0 8px",
          cursor: "pointer",
          flex: 1,
          minWidth: 0,
          transition: `background ${ms("fast")}`,
          ...(hovered ? { background: variableAlpha(0.22) } : {}),
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: font.mono,
            color: color.variable,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {displayName}
        </span>
        {hovered && (
          <button
            type="button"
            title="Edit variable"
            onClick={handlePencilClick}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              marginLeft: 4,
              cursor: "pointer",
              color: color.variable,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              opacity: 0.7,
              transition: `opacity ${ms("fast")}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          >
            <Pencil size={11} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Connect picker */}
      {pickerOpen && pillRef.current && (
        <VariablePicker
          anchor={pillRef.current}
          type={variableType}
          element={element}
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
          activeVariable={variableName}
          onUnlink={handleUnlink}
        />
      )}

      {/* Edit Variable popover */}
      {editOpen && pillRef.current && (
        <EditVariablePopover
          anchor={pillRef.current}
          variableName={variableName}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
```

The `EditVariablePopover` is defined in Task 2. For now, stub it as a no-op so the file compiles:

```tsx
function EditVariablePopover({ anchor, variableName, onClose }: {
  anchor: HTMLElement;
  variableName: string;
  onClose: () => void;
}) {
  return null; // Implemented in Task 2
}
```

**Step 4: Add to barrel export**

In `src/overlay/controls/index.ts`, add:
```ts
export { VariableField } from "./VariableField";
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --run src/overlay/__tests__/variableField.test.ts`
Expected: PASS

**Step 6: Run full test suite**

Run: `npm test -- --run`
Expected: All passing (no regressions)

**Step 7: Commit**

```
feat: add VariableField purple pill component
```

---

### Task 2: EditVariablePopover

**Files:**
- Modify: `src/overlay/controls/VariableField.tsx` (replace stub)
- Test: `src/overlay/__tests__/variableField.test.ts` (add tests)

**Step 1: Write the failing test**

Add to `variableField.test.ts`:
```ts
describe("EditVariablePopover", () => {
  it("is rendered by VariableField (internal component)", async () => {
    // The popover is internal to VariableField — we just verify
    // the module exports the main component which includes it
    const mod = await import("../controls/VariableField");
    expect(mod.VariableField).toBeTypeOf("function");
  });
});
```

**Step 2: Implement EditVariablePopover**

Replace the stub in `VariableField.tsx` with the full implementation:

```tsx
function EditVariablePopover({ anchor, variableName, onClose }: {
  anchor: HTMLElement;
  variableName: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [name, setName] = useState(variableName.replace(/^--/, ""));
  const [value, setValue] = useState(() => {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  });

  // Position below anchor
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ar = anchor.getBoundingClientRect();
    const mr = el.getBoundingClientRect();
    let top = ar.bottom + 4;
    let left = ar.left;
    if (left + mr.width > window.innerWidth - 8) left = window.innerWidth - mr.width - 8;
    if (top + mr.height > window.innerHeight - 8) top = ar.top - mr.height - 4;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchor]);

  // Click-outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  // Escape → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const commitValue = useCallback(() => {
    document.documentElement.style.setProperty(variableName, value);
  }, [variableName, value]);

  const commitName = useCallback(() => {
    const newName = `--${name}`;
    if (newName === variableName) return;
    const currentValue = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    document.documentElement.style.removeProperty(variableName);
    document.documentElement.style.setProperty(newName, currentValue);
  }, [name, variableName]);

  return createPortal(
    <div
      ref={ref}
      data-tuner-portal
      style={{
        position: "fixed",
        zIndex: zIndex.max,
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
        width: 240,
        background: color.background,
        border: `1px solid ${border.default}`,
        borderRadius: 6,
        boxShadow: shadow.dropdown,
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: text.primary }}>
        Edit variable
      </div>
      {/* Name field */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 10, color: text.label }}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === "Enter") commitName(); }}
          style={{
            height: 28,
            background: surface.subtle,
            border: `1px solid ${border.default}`,
            borderRadius: 4,
            padding: "0 8px",
            fontSize: 11,
            fontFamily: font.mono,
            color: text.primary,
            outline: "none",
          }}
        />
      </div>
      {/* Value field */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 10, color: text.label }}>Value</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => { if (e.key === "Enter") commitValue(); }}
          style={{
            height: 28,
            background: surface.subtle,
            border: `1px solid ${border.default}`,
            borderRadius: 4,
            padding: "0 8px",
            fontSize: 11,
            fontFamily: font.mono,
            color: text.primary,
            outline: "none",
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
```

Add missing imports to the top of VariableField.tsx: `useEffect` from React.

**Step 3: Run tests**

Run: `npm test -- --run src/overlay/__tests__/variableField.test.ts`
Expected: PASS

**Step 4: Typecheck**

Run: `npm run typecheck`
Expected: Clean

**Step 5: Commit**

```
feat: add EditVariablePopover to VariableField
```

---

### Task 3: Upgrade VariablePicker with Connect header + unlink X

**Files:**
- Modify: `src/overlay/controls/VariablePicker.tsx`
- Test: `src/overlay/__tests__/variableLinkDot.test.ts` (extend)

**Step 1: Write the failing test**

Add to `variableLinkDot.test.ts` (or create a new `variablePicker.test.ts`):
```ts
describe("VariablePicker", () => {
  it("accepts onUnlink prop", async () => {
    const mod = await import("../controls/VariablePicker");
    expect(mod.VariablePicker).toBeTypeOf("function");
    // Type-level check: VariablePickerProps now includes onUnlink
  });
});
```

**Step 2: Add onUnlink prop + Connect header to VariablePicker.tsx**

Changes to `VariablePicker.tsx`:

1. Add `onUnlink?: () => void` to `VariablePickerProps` interface.

2. Update width from `220` to `240`.

3. Replace the search-only header with a Connect header + search:

```tsx
{/* Header with Connect title + optional unlink X */}
<div style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 8px 0",
  flexShrink: 0,
}}>
  <span style={{ fontSize: 11, fontWeight: 600, color: text.primary }}>
    Connect
  </span>
  {onUnlink && (
    <button
      type="button"
      title="Unlink variable"
      onClick={(e) => { e.stopPropagation(); onUnlink(); onClose(); }}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: text.hint,
        display: "flex",
        alignItems: "center",
      }}
    >
      <X size={12} strokeWidth={2} />
    </button>
  )}
</div>
```

Import `X` from lucide-react at top of file.

The existing search input stays in its own `<div>` below the header row.

**Step 3: Run tests**

Run: `npm test -- --run`
Expected: All passing

**Step 4: Commit**

```
feat: add Connect header and unlink X to VariablePicker
```

---

### Task 4: Wire VariableField into SliderRow

**Files:**
- Modify: `src/overlay/controls/SliderRow.tsx`

**Step 1: Replace variable-mode rendering**

In `SliderRow.tsx`, the `if (activeVariable)` block (lines ~133-198) currently renders VariableLinkDot + blue text + reset button.

Replace the inner content of the variable-mode branch with `<VariableField />`:

```tsx
if (activeVariable) {
  return (
    <>
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }} onMouseEnter={() => setRowHovered(true)} onMouseLeave={() => setRowHovered(false)}>
      <LabelScrub value={value} onChange={onChange} step={step} min={min} max={max} onAltClick={onReset} onClick={resetPopover.triggerOpen}>
        {computedProp && computedElement ? (
          <ComputedTooltip property={computedProp} element={computedElement}>
            {labelContent}
          </ComputedTooltip>
        ) : labelContent}
      </LabelScrub>
      <VariableField
        variableName={activeVariable}
        variableType={variableType ?? "length"}
        element={variableElement}
        onSelectVariable={(varExpr) => { onSelectVariable?.(varExpr); }}
        onUnlink={handleUnlink}
      />
      {indicator === "modified" && onReset && (
        <button
          type="button"
          title="Reset to original value"
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.9)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: text.hint,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            opacity: 0.5,
            transition: `opacity ${ms("fast")}, transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
    {resetPopover.node}
    </>
  );
}
```

Add import: `import { VariableField } from "./VariableField";`

Remove the VariableLinkDot import **only if** it's no longer used in the unlinked branch. Check: the unlinked branch (line ~228-235) still uses VariableLinkDot — keep the import.

**Step 2: Run tests + typecheck**

Run: `npm test -- --run && npm run typecheck`
Expected: All passing

**Step 3: Commit**

```
feat: wire VariableField into SliderRow linked mode
```

---

### Task 5: Wire VariableField into SizeInputCell

**Files:**
- Modify: `src/overlay/sections/SizeInputCell.tsx`

**Step 1: Replace variable-mode rendering**

In `SizeInputCell.tsx`, the `isVariable` branch (lines ~238-247) currently shows a clickable span with the variable name in blue.

Replace the `isVariable` value area + the unit dropdown area when in variable mode:

When `isVariable` is true, instead of the current `<span>` for the variable name + the `<UnitSelector>` in the unit column, render a `<VariableField>` that spans the full value+unit area.

The key change: when `isVariable`, the value area and unit area both get replaced by the pill. This means wrapping the value+unit in a conditional:

```tsx
{isVariable ? (
  <VariableField
    variableName={cssVar!}
    variableType="length"
    onSelectVariable={(varExpr) => {
      const match = varExpr.match(/^var\((.+)\)$/);
      if (match) onCssVarChange?.(match[1]);
    }}
    onUnlink={() => onCssVarChange?.(null)}
  />
) : (
  <>
    {/* existing value area div */}
    {/* existing unit div */}
  </>
)}
```

Add import: `import { VariableField } from "../controls/VariableField";`

The VariableLinkDot for the unlinked state stays — it lives outside the conditional (in the cell before the value area). But when `isVariable` is true, hide the VariableLinkDot since the pill handles everything. Update the condition:

```tsx
{!isKeyword && !isVariable && variableOptions && onCssVarChange && (
  <VariableLinkDot ... />
)}
```

**Step 2: Run tests + typecheck**

Run: `npm test -- --run && npm run typecheck`
Expected: All passing

**Step 3: Commit**

```
feat: wire VariableField into SizeInputCell linked mode
```

---

### Task 6: Wire VariableField into ColorRow

**Files:**
- Modify: `src/overlay/controls/ColorRow.tsx`

**Step 1: Replace variable-mode rendering**

In `ColorRow.tsx`, when `varName` is truthy the row currently shows: VariableLinkDot + swatch (with primary border) + variable name span in blue.

Replace the content of the `<div style={{ position: "relative", display: "flex"... }}>` when linked:

```tsx
<div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
  {varName ? (
    <VariableField
      variableName={varName}
      variableType="color"
      onSelectVariable={(varExpr) => onChange(varExpr)}
      onUnlink={() => { if (resolvedColor) onChange(resolvedColor); }}
    />
  ) : (
    <>
      <VariableLinkDot
        rowHovered={rowHovered}
        isLinked={false}
        variableType="color"
        onSelect={(varExpr) => onChange(varExpr)}
        activeVariable={null}
      />
      <div
        ref={swatchRef}
        /* ... existing swatch ... */
      />
      <span /* existing hex/label span */ />
    </>
  )}
</div>
```

Note: When linked to a variable, the color picker (opened via swatch click) is no longer directly accessible from the row — the user clicks the pill to open the Connect picker which includes color variables. The swatch preview is removed in linked state per the "uniform pill" design.

Add import: `import { VariableField } from "./VariableField";`

**Step 2: Run tests + typecheck**

Run: `npm test -- --run && npm run typecheck`
Expected: All passing

**Step 3: Commit**

```
feat: wire VariableField into ColorRow linked mode
```

---

### Task 7: Wire VariableField into TypoValueCell

**Files:**
- Modify: `src/overlay/sections/layoutControls.tsx`

**Step 1: Replace variable-mode rendering**

In `TypoValueCell` (layoutControls.tsx:~1062), the `isVariable` branch (line ~1165) shows a clickable span + unit selector.

Same pattern as SizeInputCell: when `isVariable`, replace the content + unit area with `<VariableField>`:

```tsx
{isVariable ? (
  <VariableField
    variableName={cssVar!}
    variableType="length"
    onSelectVariable={(varExpr) => {
      const match = varExpr.match(/^var\((.+)\)$/);
      if (match) onCssVarChange?.(match[1]);
    }}
    onUnlink={() => onCssVarChange?.(null)}
  />
) : (
  /* existing numeric/keyword rendering */
)}
```

Hide VariableLinkDot when in variable mode (same `!isVariable` guard as SizeInputCell).

Add import: `import { VariableField } from "../controls/VariableField";` (check existing imports at top of layoutControls.tsx — it already imports from `../controls/VariableLinkDot`).

**Step 2: Run tests + typecheck**

Run: `npm test -- --run && npm run typecheck`
Expected: All passing

**Step 3: Commit**

```
feat: wire VariableField into TypoValueCell linked mode
```

---

### Task 8: Build, browser test, and polish

**Files:**
- Possibly adjust: `src/overlay/controls/VariableField.tsx` (sizing, spacing)
- Possibly adjust: `src/overlay/controls/VariablePicker.tsx` (positioning)

**Step 1: Build**

Run: `npm run build`
Expected: Clean

**Step 2: Browser test**

Open `http://localhost:3000/demo` in Chrome. Test:
1. Select an element with a linked CSS variable (e.g. gap) → verify purple pill appears
2. Hover the pill → verify pencil icon appears
3. Click pill → verify Connect picker opens with "Connect" header
4. Click pencil → verify Edit Variable popover opens with Name + Value
5. Edit value in popover → verify element updates globally
6. Click X in Connect picker → verify unlink works, returns to numeric
7. From unlinked state, click VariableLinkDot → verify picker opens, select variable → pill appears
8. Test on ColorRow, SizeInputCell, TypoValueCell — verify pill renders consistently

**Step 3: Polish any visual issues**

Typical things to fix:
- Pill height not matching row height (should be 26px)
- Pill not getting enough flex space (needs `flex: 1; minWidth: 0`)
- Pencil icon color contrast
- Edit popover positioning clipped by viewport

**Step 4: Final commit**

```
polish: variable field sizing and visual adjustments
```

---

## File Partitioning for Parallel Execution

Tasks 4-7 touch **separate files** and can run in parallel after Tasks 1-3 are complete:

| Task | File | Can parallel? |
|------|------|---------------|
| 1 | `controls/VariableField.tsx` (create) | Sequential — foundation |
| 2 | `controls/VariableField.tsx` (modify) | Sequential — depends on T1 |
| 3 | `controls/VariablePicker.tsx` (modify) | Parallel with T2 |
| 4 | `controls/SliderRow.tsx` | Parallel batch |
| 5 | `sections/SizeInputCell.tsx` | Parallel batch |
| 6 | `controls/ColorRow.tsx` | Parallel batch |
| 7 | `sections/layoutControls.tsx` | Parallel batch |
| 8 | Browser test + polish | Sequential — after all |
