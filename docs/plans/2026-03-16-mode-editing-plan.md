# Mode Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make multi-mode value cells in the Variables panel editable via runtime `<style>` tag overrides, with color picker support for color variables and clipboard save.

**Architecture:** New `modeOverrides.ts` module manages a `Map<selector, Map<varName, value>>` store. On mutation, it rebuilds a single `<style id="redial-mode-overrides">` element. Undo integrates with `apply.ts` via its existing `subscribeOverrides` / `notifyListeners` pattern. `CollectionDetail.tsx` gets editable mode cells — color dot opens `ColorPickerEnhanced`, other types get inline text input.

**Tech Stack:** React inline styles, `useSyncExternalStore`, `createPortal`, existing `ColorPickerEnhanced`, Vitest + happy-dom

---

## Task 1: modeOverrides.ts — Core Store

**Files:**
- Create: `src/overlay/variables/modeOverrides.ts`
- Test: `src/overlay/__tests__/modeOverrides.test.ts`

**Step 1: Write the failing test**

Create `src/overlay/__tests__/modeOverrides.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import {
  applyModeOverride,
  getModeOverrides,
  removeModeOverride,
  resetAllModeOverrides,
  serializeModeOverrides,
  subscribeModeOverrides,
  getModeOverrideSnapshot,
} from "../variables/modeOverrides";

afterEach(() => {
  resetAllModeOverrides();
});

describe("applyModeOverride", () => {
  it("stores an override for a selector + variable", () => {
    applyModeOverride(".dark", "--bg-primary", "#111");
    expect(getModeOverrides(".dark")).toEqual({ "--bg-primary": "#111" });
  });

  it("injects a <style> tag with the override", () => {
    applyModeOverride(".dark", "--bg-primary", "#111");
    const styleEl = document.getElementById("redial-mode-overrides");
    expect(styleEl).toBeTruthy();
    expect(styleEl!.textContent).toContain(".dark");
    expect(styleEl!.textContent).toContain("--bg-primary: #111");
  });

  it("multiple overrides in the same selector share one rule block", () => {
    applyModeOverride(".dark", "--bg-primary", "#111");
    applyModeOverride(".dark", "--text", "#fff");
    const styleEl = document.getElementById("redial-mode-overrides");
    const text = styleEl!.textContent!;
    // Only one .dark block
    expect(text.match(/\.dark\s*\{/g)?.length).toBe(1);
    expect(text).toContain("--bg-primary: #111");
    expect(text).toContain("--text: #fff");
  });

  it("overrides in different selectors get separate rule blocks", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".light", "--bg", "#fff");
    const text = document.getElementById("redial-mode-overrides")!.textContent!;
    expect(text).toContain(".dark");
    expect(text).toContain(".light");
  });
});

describe("removeModeOverride", () => {
  it("removes a single variable from a selector", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".dark", "--text", "#fff");
    removeModeOverride(".dark", "--bg");
    expect(getModeOverrides(".dark")).toEqual({ "--text": "#fff" });
  });

  it("removes the selector entirely when last variable is removed", () => {
    applyModeOverride(".dark", "--bg", "#111");
    removeModeOverride(".dark", "--bg");
    expect(getModeOverrides(".dark")).toBeUndefined();
  });
});

describe("resetAllModeOverrides", () => {
  it("clears all overrides and empties the style tag", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".light", "--bg", "#fff");
    resetAllModeOverrides();
    expect(getModeOverrides(".dark")).toBeUndefined();
    const styleEl = document.getElementById("redial-mode-overrides");
    expect(!styleEl || styleEl.textContent === "").toBe(true);
  });
});

describe("serializeModeOverrides", () => {
  it("returns CSS text with one rule block per selector", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".dark", "--text", "#fff");
    applyModeOverride('[data-theme="blue"]', "--accent", "blue");
    const css = serializeModeOverrides();
    expect(css).toContain('.dark {\n  --bg: #111;\n  --text: #fff;\n}');
    expect(css).toContain('[data-theme="blue"] {\n  --accent: blue;\n}');
  });

  it("returns empty string when no overrides", () => {
    expect(serializeModeOverrides()).toBe("");
  });
});

describe("subscription", () => {
  it("notifies listeners on apply", () => {
    let called = 0;
    const unsub = subscribeModeOverrides(() => { called++; });
    applyModeOverride(".dark", "--bg", "#111");
    expect(called).toBe(1);
    unsub();
  });

  it("snapshot increments on each change", () => {
    const s1 = getModeOverrideSnapshot();
    applyModeOverride(".dark", "--bg", "#111");
    const s2 = getModeOverrideSnapshot();
    expect(s2).toBeGreaterThan(s1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/overlay/__tests__/modeOverrides.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/overlay/variables/modeOverrides.ts`:

```ts
/**
 * modeOverrides.ts — Runtime CSS variable mode overrides.
 *
 * Manages a <style id="redial-mode-overrides"> element that holds
 * per-selector overrides for CSS custom properties in specific modes.
 * Integrates with the panel's undo/save system via subscription API.
 */

// ─── Store ──────────────────────────────────────────────────────────

/** Map<selector, Map<varName, value>> */
const store = new Map<string, Map<string, string>>();

/** Monotonic counter for useSyncExternalStore snapshot */
let version = 0;

/** Style element reference */
let styleEl: HTMLStyleElement | null = null;

// ─── Subscription ───────────────────────────────────────────────────

const listeners = new Set<() => void>();

export function subscribeModeOverrides(callback: () => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function getModeOverrideSnapshot(): number {
  return version;
}

function notify() {
  version++;
  listeners.forEach((fn) => fn());
}

// ─── DOM ────────────────────────────────────────────────────────────

const STYLE_ID = "redial-mode-overrides";

function ensureStyleEl(): HTMLStyleElement {
  if (styleEl && document.contains(styleEl)) return styleEl;
  styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

function renderStyleTag() {
  const el = ensureStyleEl();
  el.textContent = serializeModeOverrides();
}

// ─── Public API ─────────────────────────────────────────────────────

export function applyModeOverride(
  selector: string,
  varName: string,
  value: string,
): void {
  let vars = store.get(selector);
  if (!vars) {
    vars = new Map();
    store.set(selector, vars);
  }
  vars.set(varName, value);
  renderStyleTag();
  notify();
}

export function removeModeOverride(
  selector: string,
  varName: string,
): void {
  const vars = store.get(selector);
  if (!vars) return;
  vars.delete(varName);
  if (vars.size === 0) store.delete(selector);
  renderStyleTag();
  notify();
}

export function getModeOverrides(
  selector: string,
): Record<string, string> | undefined {
  const vars = store.get(selector);
  if (!vars || vars.size === 0) return undefined;
  return Object.fromEntries(vars);
}

export function resetAllModeOverrides(): void {
  if (store.size === 0) return;
  store.clear();
  if (styleEl && document.contains(styleEl)) {
    styleEl.textContent = "";
  }
  notify();
}

export function serializeModeOverrides(): string {
  if (store.size === 0) return "";
  const blocks: string[] = [];
  for (const [selector, vars] of store) {
    const props = Array.from(vars.entries())
      .map(([name, val]) => `  ${name}: ${val};`)
      .join("\n");
    blocks.push(`${selector} {\n${props}\n}`);
  }
  return blocks.join("\n\n");
}

/** Total number of overridden variable-mode pairs */
export function getModeOverrideCount(): number {
  let count = 0;
  for (const vars of store.values()) count += vars.size;
  return count;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/overlay/__tests__/modeOverrides.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat: add modeOverrides store for runtime CSS variable mode editing
```

---

## Task 2: Undo Integration

**Files:**
- Modify: `src/overlay/variables/modeOverrides.ts`
- Test: `src/overlay/__tests__/modeOverrides.test.ts`

**Step 1: Write the failing test**

Append to `modeOverrides.test.ts`:

```ts
import { undoModeOverride, redoModeOverride } from "../variables/modeOverrides";

describe("undo/redo", () => {
  it("undo reverts the last applyModeOverride", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".dark", "--bg", "#222");
    undoModeOverride();
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111" });
  });

  it("undo removes variable if it was newly added", () => {
    applyModeOverride(".dark", "--bg", "#111");
    undoModeOverride();
    expect(getModeOverrides(".dark")).toBeUndefined();
  });

  it("redo re-applies after undo", () => {
    applyModeOverride(".dark", "--bg", "#111");
    undoModeOverride();
    redoModeOverride();
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111" });
  });

  it("new apply after undo clears redo stack", () => {
    applyModeOverride(".dark", "--bg", "#111");
    undoModeOverride();
    applyModeOverride(".dark", "--bg", "#333");
    redoModeOverride(); // should be a no-op
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#333" });
  });

  it("undo past the beginning is a no-op", () => {
    undoModeOverride();
    expect(getModeOverrides(".dark")).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/overlay/__tests__/modeOverrides.test.ts`
Expected: FAIL — `undoModeOverride` not exported

**Step 3: Implement undo/redo**

Add to `modeOverrides.ts`:

```ts
// ─── Undo / Redo ────────────────────────────────────────────────────

interface UndoEntry {
  selector: string;
  varName: string;
  prev: string | null;  // null = variable didn't exist in this mode
  next: string;
}

const undoStack: UndoEntry[] = [];
const redoStack: UndoEntry[] = [];

// Update applyModeOverride to record undo entries:
// Before `vars.set(varName, value)`, capture `prev`:
//   const prev = vars.get(varName) ?? null;
// After notify(), push: undoStack.push({ selector, varName, prev, next: value });
// And clear redo: redoStack.length = 0;

export function undoModeOverride(): void {
  const entry = undoStack.pop();
  if (!entry) return;
  redoStack.push(entry);
  if (entry.prev === null) {
    // Variable was newly added — remove it
    removeModeOverrideInternal(entry.selector, entry.varName);
  } else {
    applyModeOverrideInternal(entry.selector, entry.varName, entry.prev);
  }
}

export function redoModeOverride(): void {
  const entry = redoStack.pop();
  if (!entry) return;
  undoStack.push(entry);
  applyModeOverrideInternal(entry.selector, entry.varName, entry.next);
}
```

Note: `applyModeOverrideInternal` and `removeModeOverrideInternal` are the same as the public functions but without pushing to undo/redo stacks. Refactor: extract the DOM + store mutation into internal functions, have the public API call internal + push undo.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/overlay/__tests__/modeOverrides.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat: add undo/redo to modeOverrides
```

---

## Task 3: Editable Mode Cells — Inline Text

**Files:**
- Modify: `src/overlay/variables/CollectionDetail.tsx` (lines 325–490, `DetailVariableRow`)
- Test: `src/overlay/__tests__/modeOverrides.test.ts` (or new `modeEditing.test.ts`)

**Step 1: Write the failing test**

Append to test file — unit test for the editing logic (not React render test, just the wiring):

```ts
describe("isModeOverrideDirty", () => {
  it("returns false when no override exists", () => {
    expect(getModeOverrides(".dark")).toBeUndefined();
  });

  it("returns true after applying an override", () => {
    applyModeOverride(".dark", "--bg", "#111");
    expect(getModeOverrides(".dark")).toBeDefined();
  });
});
```

**Step 2: Run to verify passes (baseline)**

These should already pass from Task 1. This step is just a sanity check.

**Step 3: Implement editable mode cells**

In `CollectionDetail.tsx`, modify the `DetailVariableRow` component's multi-mode rendering (lines 466–490).

Current read-only cell (line 466–490):
```tsx
{modeValues.map((mv) => (
  <div key={mv.modeName} style={{...}}>
    {mv.value !== undefined ? (
      <VariableValue value={mv.value} />
    ) : (
      <span style={{...}}>{"\u2014"}</span>
    )}
  </div>
))}
```

Replace each mode cell with `ModeValueCell` — a new inline component in `CollectionDetail.tsx`:

```tsx
function ModeValueCell({
  varName,
  mode,
  value,
  onOverride,
}: {
  varName: string;
  mode: InferredMode;
  /** Resolved value: from override store, then from mode.values, or undefined */
  value: string | undefined;
  onOverride: (selector: string, varName: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when value changes externally
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
      onOverride(mode.selector, varName, trimmed);
    }
    setEditing(false);
  }, [draft, mode.selector, varName, onOverride]);

  // Read-only for media query modes (v1 scope)
  const editable = mode.source !== "media";

  // Check if this cell has been overridden
  const overrideMap = getModeOverrides(mode.selector ?? "");
  const isOverridden = overrideMap?.[varName] !== undefined;

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); e.stopPropagation(); }
        }}
        onBlur={commit}
        style={{
          flex: 1, minWidth: 80, fontSize: 11, fontFamily: font.mono,
          background: surface.input, border: `1px solid ${border.focus}`,
          borderRadius: 3, padding: "1px 4px", outline: "none",
          color: text.primary, textAlign: "right",
        }}
      />
    );
  }

  return (
    <div
      onClick={editable ? () => setEditing(true) : undefined}
      style={{
        flex: 1, minWidth: 80, display: "flex", alignItems: "center",
        justifyContent: "flex-end", overflow: "hidden",
        cursor: editable ? "text" : "default",
        borderRadius: 3, padding: "1px 3px",
        ...(isOverridden ? {
          background: labelIndicator.modified.bg,
          color: labelIndicator.modified.text,
        } : {}),
      }}
    >
      {value !== undefined ? (
        <VariableValue value={value} />
      ) : (
        <span style={{ color: text.disabled, fontSize: 11, fontFamily: font.mono }}>
          {"\u2014"}
        </span>
      )}
    </div>
  );
}
```

Wire the `onOverride` callback: in `DetailVariableRow`, import `applyModeOverride` from `../variables/modeOverrides` and pass it through. The mode cell also needs to merge override values with discovered values — check override store first, fall back to `mode.values[varName]`.

Add new import at top of `CollectionDetail.tsx`:
```ts
import { applyModeOverride, getModeOverrides } from "./modeOverrides";
```

Update `modeValues` computation in `SubgroupSection` (line 634) to merge overrides:
```ts
const modeValues = modes?.map((m) => {
  const overrides = getModeOverrides(m.selector ?? "");
  const overrideVal = overrides?.[v.name];
  return {
    modeName: m.name,
    mode: m,
    value: overrideVal ?? m.values[v.name],
  };
});
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```
feat: editable inline text cells for mode variables
```

---

## Task 4: Color Picker for Color Mode Cells

**Files:**
- Modify: `src/overlay/variables/CollectionDetail.tsx` (within `ModeValueCell`)

**Step 1: Write the failing test**

```ts
describe("color mode cell detection", () => {
  it("identifies color variables by type", () => {
    // Ensure the variable type classification feeds into ModeValueCell
    // This is a structural test — verify the varType prop is threaded
    // through the component hierarchy
  });
});
```

This is primarily a UI wiring task. Verify with `npm run typecheck`.

**Step 2: Implement color picker in mode cells**

Extend `ModeValueCell` to accept a `varType` prop. When `varType === "color"`:

1. Render a 12px color dot before the value text (using `cssColorToHex` to resolve)
2. Clicking the dot (not the text) opens `ColorPickerEnhanced` in a portal
3. Picking a color calls `onOverride(mode.selector, varName, hex)`
4. Portal positioning: same pattern as `ColorRow.tsx` lines 267–294

```tsx
// Inside ModeValueCell, when varType === "color":
const [pickerOpen, setPickerOpen] = useState(false);
const dotRef = useRef<HTMLDivElement>(null);

// Color dot element:
<div
  ref={dotRef}
  onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
  style={{
    width: 12, height: 12, borderRadius: 3, flexShrink: 0,
    background: value ?? "transparent",
    border: `1px solid ${border.default}`,
    cursor: "pointer",
  }}
/>

// Portal picker (same positioning as ColorRow.tsx):
{pickerOpen && dotRef.current && createPortal(
  <div data-tuner-portal style={{ position: "fixed", ...computePosition(dotRef.current), zIndex: zIndex.max }}>
    <ColorPickerEnhanced
      color={cssColorToHex(value ?? "#000")}
      onChange={(hex, opacity) => {
        const final = opacity < 1 ? hexToRgba(hex, opacity) : hex;
        if (mode.selector) onOverride(mode.selector, varName, final);
      }}
      onClose={() => setPickerOpen(false)}
    />
  </div>,
  document.body
)}
```

For the color cell, clicking the **dot** opens the picker, clicking the **value text** opens inline text edit (for manual hex entry). Both paths call `onOverride`.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```
feat: color picker for color-type mode variable cells
```

---

## Task 5: Override Indicators on Mode Cells

**Files:**
- Modify: `src/overlay/variables/CollectionDetail.tsx` (within `ModeValueCell`)
- Modify: `src/overlay/variables/modeOverrides.ts` (add `isModeOverrideDirty`)

**Step 1: Write the failing test**

Add to `modeOverrides.test.ts`:

```ts
import { isModeOverrideDirty } from "../variables/modeOverrides";

describe("isModeOverrideDirty", () => {
  it("returns false when no override for that selector+var", () => {
    expect(isModeOverrideDirty(".dark", "--bg")).toBe(false);
  });

  it("returns true after applying override", () => {
    applyModeOverride(".dark", "--bg", "#111");
    expect(isModeOverrideDirty(".dark", "--bg")).toBe(true);
  });

  it("returns false after undo", () => {
    applyModeOverride(".dark", "--bg", "#111");
    undoModeOverride();
    expect(isModeOverrideDirty(".dark", "--bg")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL — `isModeOverrideDirty` not exported

**Step 3: Implement**

In `modeOverrides.ts`:
```ts
export function isModeOverrideDirty(selector: string, varName: string): boolean {
  return store.get(selector)?.has(varName) ?? false;
}
```

In `ModeValueCell`, use `isModeOverrideDirty` to show the blue modified indicator styling (already scaffolded in Task 3 with `isOverridden`). Replace the inline `getModeOverrides` check with `isModeOverrideDirty(mode.selector ?? "", varName)`.

**Step 4: Run tests**

Run: `npx vitest run src/overlay/__tests__/modeOverrides.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat: override indicators on mode variable cells
```

---

## Task 6: Clipboard Save for Mode Overrides

**Files:**
- Modify: `src/overlay/shell/Footer.tsx` (line ~161, `handleSave`)
- Modify: `src/overlay/variables/modeOverrides.ts` (already has `serializeModeOverrides`)

**Step 1: Write the failing test**

Add to `modeOverrides.test.ts`:

```ts
describe("serializeModeOverrides formatting", () => {
  it("produces pasteable CSS with proper indentation", () => {
    applyModeOverride(":root.dark", "--bg-primary", "#1a1a1a");
    applyModeOverride(":root.dark", "--text-primary", "#f5f5f5");
    applyModeOverride('[data-theme="ocean"]', "--accent", "#0066cc");
    const css = serializeModeOverrides();
    expect(css).toBe(
      ':root.dark {\n  --bg-primary: #1a1a1a;\n  --text-primary: #f5f5f5;\n}\n\n[data-theme="ocean"] {\n  --accent: #0066cc;\n}'
    );
  });
});
```

**Step 2: Run test — should pass if Task 1 serializer is correct**

**Step 3: Wire into Footer.tsx**

In `Footer.tsx`, import `serializeModeOverrides` and `getModeOverrideCount` from `../variables/modeOverrides`.

In `handleSave` (line ~161), after the existing element-override save logic, append mode overrides:

```ts
const modeCSS = serializeModeOverrides();
if (modeCSS) {
  const fullCSS = css + (css ? "\n\n/* Mode overrides */\n" : "") + modeCSS;
  navigator.clipboard.writeText(fullCSS).then(() => {
    const modeCount = getModeOverrideCount();
    showMessage(
      `Copied ${changes.length} propert${changes.length === 1 ? "y" : "ies"} + ${modeCount} mode override${modeCount === 1 ? "" : "s"} to clipboard`,
      3000
    );
  });
}
```

Also wire `resetAllModeOverrides` into the Footer's reset action so "Reset" clears mode overrides too.

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```
feat: include mode overrides in clipboard save
```

---

## Task 7: Wire Override Reactivity with useSyncExternalStore

**Files:**
- Modify: `src/overlay/variables/CollectionDetail.tsx`
- Modify: `src/overlay/variables/GlobalVariablesPanel.tsx`

**Step 1: Ensure mode cells react to override changes**

The mode cells need to re-render when overrides change. Use `useSyncExternalStore` in `CollectionDetail`:

```ts
import { useSyncExternalStore } from "react";
import { subscribeModeOverrides, getModeOverrideSnapshot } from "./modeOverrides";

// Inside CollectionDetail:
const modeOverrideVersion = useSyncExternalStore(subscribeModeOverrides, getModeOverrideSnapshot);
```

This forces re-render whenever `applyModeOverride`, `removeModeOverride`, `undoModeOverride`, or `resetAllModeOverrides` is called. The `modeValues` computation already reads from `getModeOverrides`, so the values will be fresh.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```
feat: reactive mode override cells via useSyncExternalStore
```

---

## Task 8: Integration Test + Full Test Suite Run

**Files:**
- Test: `src/overlay/__tests__/modeOverrides.test.ts`

**Step 1: Add integration-style test**

```ts
describe("full editing flow", () => {
  it("apply → serialize → undo → serialize roundtrip", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".dark", "--text", "#eee");
    applyModeOverride(".light", "--bg", "#fff");

    const css1 = serializeModeOverrides();
    expect(css1).toContain("--bg: #111");
    expect(css1).toContain("--text: #eee");
    expect(css1).toContain(".light");

    undoModeOverride(); // undo .light --bg
    expect(serializeModeOverrides()).not.toContain(".light");

    undoModeOverride(); // undo .dark --text
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111" });

    redoModeOverride(); // redo .dark --text
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111", "--text": "#eee" });
  });
});
```

**Step 2: Run full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```
test: integration test for mode override editing flow
```

---

## Summary

| Task | What | New/Modify | Test |
|------|------|-----------|------|
| 1 | modeOverrides.ts core store | Create | 10 tests |
| 2 | Undo/redo | Modify modeOverrides.ts | 5 tests |
| 3 | Editable inline text cells | Modify CollectionDetail.tsx | typecheck |
| 4 | Color picker for color cells | Modify CollectionDetail.tsx | typecheck |
| 5 | Override dirty indicators | Modify both | 3 tests |
| 6 | Clipboard save | Modify Footer.tsx | 1 test |
| 7 | useSyncExternalStore reactivity | Modify CollectionDetail.tsx | typecheck |
| 8 | Integration test + full suite | Test only | 1 test |
