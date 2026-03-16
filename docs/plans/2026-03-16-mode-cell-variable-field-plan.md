# Mode Cell VariableField Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make mode value cells in the Variables panel use the same `VariableField` purple pill as the style panel when a value is a `var()` reference, and auto-fit panel width to mode columns.

**Architecture:** Rewrite `ModeValueCell` in `CollectionDetail.tsx` to branch on `parseVarRef(value)` — linked cells render `<VariableField>`, unlinked cells render `VariableLinkDot` (absolute corner) + raw value controls. Remove horizontal scroll from mode containers and switch columns to `flex: 1, minWidth: 120px`.

**Tech Stack:** React inline styles, existing VariableField/VariableLinkDot components, parseVarRef from colorVariables.ts

---

### Task 1: Rewrite ModeValueCell — linked path uses VariableField

**Files:**
- Modify: `src/overlay/variables/CollectionDetail.tsx:31-34` (imports)
- Modify: `src/overlay/variables/CollectionDetail.tsx:336-515` (ModeValueCell component)

**Step 1: Update imports**

Add VariableField import, keep existing imports:

```tsx
// Add this import (line ~32):
import { VariableField } from "../controls/VariableField";
```

Keep existing imports for: `VariableLinkDot`, `ColorPickerEnhanced`, `parseVarRef`, `cssColorToHex`, `hexToRgba`, `beginModeCoalesce`, `endModeCoalesce`. All are still needed for the unlinked path.

**Step 2: Rewrite the ModeValueCell return block**

Replace the current single return (lines ~429-514) with a branching structure. The full component should be:

```tsx
function ModeValueCell({
  varName,
  mode,
  value,
  varType,
}: {
  varName: string;
  mode: InferredMode;
  value: string | undefined;
  varType: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cellHovered, setCellHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      const id = setTimeout(() => inputRef.current?.select(), 0);
      return () => clearTimeout(id);
    }
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && mode.selector) {
      applyModeOverride(mode.selector, varName, trimmed);
    }
    setEditing(false);
  }, [draft, mode.selector, varName]);

  const editable = mode.source !== "media" && mode.source !== "base";
  const isOverridden = isModeOverrideDirty(mode.selector ?? "", varName);
  const linkedVarName = value ? parseVarRef(value) : null;
  const isLinked = !!linkedVarName;

  const handleVarSelect = useCallback((varExpr: string) => {
    if (mode.selector) {
      applyModeOverride(mode.selector, varName, varExpr);
    }
  }, [mode.selector, varName]);

  const handleUnlink = useCallback(() => {
    if (!linkedVarName || !mode.selector) return;
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(linkedVarName).trim();
    if (resolved) {
      applyModeOverride(mode.selector, varName, resolved);
    }
  }, [linkedVarName, mode.selector, varName]);

  // ── Editing state ──
  if (editing) {
    return (
      <div style={{ flex: 1, minWidth: 120, overflow: "hidden" }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setEditing(false); e.stopPropagation(); }
          }}
          onBlur={commit}
          data-tuner-portal
          style={{
            width: "100%",
            fontSize: 11,
            fontFamily: font.mono,
            background: surface.hover,
            border: `1px solid ${color.primary}`,
            borderRadius: 3,
            padding: "1px 4px",
            outline: "none",
            color: text.primary,
            textAlign: "right",
            boxSizing: "border-box" as const,
          }}
        />
      </div>
    );
  }

  // ── Linked state: VariableField purple pill ──
  if (isLinked && editable) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 120,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          ...(isOverridden ? {
            borderRadius: 3,
            outline: `1px solid ${labelIndicator.modified.bg}`,
          } : {}),
        }}
      >
        <VariableField
          variableName={linkedVarName}
          variableType={varType === "color" ? "color" : "all"}
          onSelectVariable={handleVarSelect}
          onUnlink={handleUnlink}
        />
      </div>
    );
  }

  // ── Linked state but read-only (base/media) ──
  if (isLinked && !editable) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          overflow: "hidden",
          borderRadius: 3,
          padding: "1px 3px",
        }}
      >
        {varType === "color" && value && (
          <div style={{
            width: 12, height: 12, borderRadius: 3, flexShrink: 0, marginRight: 4,
            background: value, border: `1px solid ${border.default}`,
          }} />
        )}
        <VariableValue value={value!} />
      </div>
    );
  }

  // ── Unlinked state: VariableLinkDot + raw value ──
  return (
    <div
      onMouseEnter={() => setCellHovered(true)}
      onMouseLeave={() => setCellHovered(false)}
      onClick={editable ? () => setEditing(true) : undefined}
      style={{
        flex: 1,
        minWidth: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        overflow: "hidden",
        cursor: editable ? "text" : "default",
        borderRadius: 3,
        padding: "1px 3px",
        position: "relative",
        ...(isOverridden ? {
          background: labelIndicator.modified.bg,
          color: labelIndicator.modified.text,
          ...labelHighlight,
        } : {}),
      }}
    >
      {/* VariableLinkDot at top-left corner (absolute, default mode) */}
      {editable && (
        <VariableLinkDot
          rowHovered={cellHovered}
          isLinked={false}
          variableType={varType === "color" ? "color" : "all"}
          onSelect={handleVarSelect}
          activeVariable={null}
        />
      )}

      {/* Color dot for color-type variables */}
      {varType === "color" && value && (
        <div
          ref={dotRef}
          onClick={(e) => {
            if (!editable) return;
            e.stopPropagation();
            setPickerOpen(true);
          }}
          style={{
            width: 12, height: 12, borderRadius: 3, flexShrink: 0, marginRight: 4,
            background: value, border: `1px solid ${border.default}`,
            cursor: editable ? "pointer" : "default",
          }}
        />
      )}

      {value !== undefined ? (
        <VariableValue value={value} />
      ) : (
        <span style={{ color: text.disabled, fontSize: 11, fontFamily: font.mono }}>
          {editable ? "+" : "\u2014"}
        </span>
      )}

      {/* Color picker portal */}
      {pickerOpen && dotRef.current && (() => {
        const rect = dotRef.current!.getBoundingClientRect();
        const pickerWidth = 264;
        const pickerHeight = 300;
        const gap = 4;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < pickerHeight + gap
          ? rect.top - pickerHeight - gap : rect.bottom + gap;
        const left = Math.min(rect.left, window.innerWidth - pickerWidth - gap);
        return createPortal(
          <div data-tuner-portal style={{ position: "fixed", top, left, zIndex: zIndex.max }}>
            <ColorPickerEnhanced
              color={value ? cssColorToHex(value) : "#000000"}
              onChange={(hex, opacity) => {
                if (mode.selector) {
                  beginModeCoalesce();
                  const final = opacity < 1 ? hexToRgba(hex, opacity) : hex;
                  applyModeOverride(mode.selector, varName, final);
                }
              }}
              onClose={() => { endModeCoalesce(); setPickerOpen(false); }}
            />
          </div>,
          document.body,
        );
      })()}
    </div>
  );
}
```

**Key changes from current:**
- Linked + editable → `<VariableField>` purple pill (new)
- Linked + read-only → color dot + VariableValue text (simplified, no VariableLinkDot)
- Unlinked → `VariableLinkDot` at corner (absolute, NOT inline) + raw value controls (same as before minus `inline` prop)
- All cells use `flex: 1, minWidth: 120` instead of `flex: 0 0 132px`

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: Clean pass

**Step 4: Commit**

```
feat: ModeValueCell uses VariableField purple pill for linked vars
```

---

### Task 2: Update column headers and mode containers — remove scroll, use flex

**Files:**
- Modify: `src/overlay/variables/CollectionDetail.tsx:667-672` (row mode container)
- Modify: `src/overlay/variables/CollectionDetail.tsx:1036-1057` (header mode container)
- Modify: `src/overlay/variables/CollectionDetail.tsx:604-618` (row padding)

**Step 1: Change mode column headers from fixed to flex**

In the column header section (~line 1049-1055), change each mode header from `flex: "0 0 132px"` to `flex: 1, minWidth: 120`:

```tsx
{relevantModes.map((m) => (
  <div
    key={m.name}
    style={{ flex: 1, minWidth: 120, textAlign: "right", ...COLUMN_HEADER_STYLE }}
  >
    {m.name}
  </div>
))}
```

**Step 2: Remove overflowX: auto from header mode container**

In the header mode container (~line 1039-1047), remove `overflowX: "auto"` and `scrollbarWidth: "none"`:

```tsx
style={{
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 4,
}}
```

**Step 3: Remove overflowX: auto from row mode container**

In the row mode container (~line 672), remove `overflowX: "auto"`:

```tsx
style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}
```

**Step 4: Add row padding for VariableLinkDot corner positioning**

In `DetailVariableRow` (~line 613), increase `padding` from `"3px 12px"` to `"8px 12px"` so the VariableLinkDot at `top: -7px` doesn't clip against the row boundary:

```tsx
padding: "8px 12px",
```

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: Clean pass

**Step 6: Commit**

```
feat: mode columns flex to fill panel width, remove horizontal scroll
```

---

### Task 3: Update panelWidth.ts and tests

**Files:**
- Modify: `src/overlay/variables/panelWidth.ts`
- Modify: `src/overlay/__tests__/panelWidth.test.ts`

**Step 1: Update panelWidth.ts comment**

The doc comment says "110px" — update to reflect the new flex-based approach:

```ts
const BASE_WIDTH = 340; // sidebar 170 + padding 24 + icon 14 + name 100 + gaps 12 + action 20
const PER_MODE = 136; // ~136px per flex column (min 120px + gap)
const MIN_WIDTH = 580; // single-mode minimum width
const MAX_RATIO = 0.8;

/**
 * Compute variables panel width based on mode column count.
 * Grows to fit: BASE + modes * PER_MODE, min 580px, caps at 80vw.
 * Columns flex to fill — this sets the panel's total width, not column width.
 */
```

**Step 2: Run tests**

Run: `npm test -- --run src/overlay/__tests__/panelWidth.test.ts`
Expected: All 6 tests pass (no formula change, just comments)

**Step 3: Commit**

```
docs: update panelWidth comments for flex-based mode columns
```

---

### Task 4: Build, browser test, verify

**Step 1: Build**

Run: `npm run build`
Expected: Clean build

**Step 2: Run full test suite**

Run: `npm test -- --run`
Expected: All 2769+ tests pass

**Step 3: Browser verify**

Open `http://localhost:3000/demo` in Chrome. Click Variables → select Border collection. Verify:

1. Mode columns (DARK, DARK SYS) expand to fill panel width — no horizontal scroll
2. Cells with `var()` references (accent, default, strong, subtle) show purple pills
3. Hovering a purple pill reveals pencil icon
4. Clicking a purple pill opens VariablePicker
5. Empty cells (+) and raw value cells show VariableLinkDot on hover at top-left corner
6. Width-medium/thick/thin rows (non-color, raw values) look correct

**Step 4: Commit**

```
chore: build for mode cell VariableField verification
```
