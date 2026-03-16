# Dynamic Variables Panel Width — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the variables panel width grow dynamically based on mode column count, capped at 80% viewport width with frozen-column horizontal scrolling.

**Architecture:** Pure helper `getVariablesPanelWidth(modeCount)` replaces all 4 hardcoded `580` values in Overlay.tsx. Mode count flows from GlobalVariablesPanel → Overlay via callback. CollectionDetail gets a scroll-synced frozen-column layout when modes overflow.

**Tech Stack:** React, inline styles, `useRef` for scroll sync

---

### Task 1: `getVariablesPanelWidth` helper + tests

**Files:**
- Create: `src/overlay/variables/panelWidth.ts`
- Create: `src/overlay/__tests__/panelWidth.test.ts`

**Step 1: Write failing tests**

```ts
// src/overlay/__tests__/panelWidth.test.ts
import { describe, it, expect } from "vitest";
import { getVariablesPanelWidth } from "../variables/panelWidth";

describe("getVariablesPanelWidth", () => {
  it("returns 580 for 0 modes (floor)", () => {
    expect(getVariablesPanelWidth(0)).toBe(580);
  });

  it("returns 580 for 1 mode (floor)", () => {
    expect(getVariablesPanelWidth(1)).toBe(580);
  });

  it("returns 660 for 2 modes", () => {
    expect(getVariablesPanelWidth(2)).toBe(660);
  });

  it("returns 800 for 3 modes", () => {
    expect(getVariablesPanelWidth(3)).toBe(800);
  });

  it("caps at 80% viewport width", () => {
    // 7 modes → 380 + 7*140 = 1360, but 80% of 1440 = 1152
    expect(getVariablesPanelWidth(7, 1440)).toBe(1152);
  });

  it("uses window.innerWidth when no viewport arg", () => {
    // In test env window.innerWidth is typically 1024
    const result = getVariablesPanelWidth(7);
    expect(result).toBeLessThanOrEqual(Math.floor(window.innerWidth * 0.8));
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/overlay/__tests__/panelWidth.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/overlay/variables/panelWidth.ts

const BASE_WIDTH = 380;   // sidebar 170 + icon 14 + name 130 + actions 40 + gaps 26
const PER_MODE = 140;
const MIN_WIDTH = 580;
const MAX_RATIO = 0.8;

/**
 * Compute variables panel width based on mode column count.
 * Returns at least 580px, grows 140px per mode, caps at 80% viewport.
 */
export function getVariablesPanelWidth(
  modeCount: number,
  viewportWidth?: number,
): number {
  const vw = viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1440);
  const computed = BASE_WIDTH + modeCount * PER_MODE;
  return Math.max(MIN_WIDTH, Math.min(computed, Math.floor(vw * MAX_RATIO)));
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/overlay/__tests__/panelWidth.test.ts`
Expected: all 6 PASS

**Step 5: Commit**

```
feat: add getVariablesPanelWidth helper
```

---

### Task 2: Wire mode count from GlobalVariablesPanel → Overlay

**Files:**
- Modify: `src/overlay/variables/GlobalVariablesPanel.tsx`
- Modify: `src/overlay/shell/Overlay.tsx`

**Step 1: Add `onModeCount` callback to GlobalVariablesPanel**

In `GlobalVariablesPanel.tsx`, change the props and add a useEffect:

```tsx
// Change the props type:
export function GlobalVariablesPanel({
  onClose,
  onModeCount,
}: {
  onClose: () => void;
  onModeCount?: (count: number) => void;
}) {
```

After the `modes` memo (line ~46), add:

```tsx
  useEffect(() => {
    onModeCount?.(modes.length);
  }, [modes.length, onModeCount]);
```

**Step 2: Add state + callback in Overlay.tsx**

Near line 121 (after `activePanel` state), add:

```tsx
const [variablesModeCount, setVariablesModeCount] = useState(0);
```

At line ~1915 where `<GlobalVariablesPanel>` is rendered, add the prop:

```tsx
<GlobalVariablesPanel
  onClose={() => setActivePanel({ type: "none" })}
  onModeCount={setVariablesModeCount}
/>
```

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean

**Step 4: Commit**

```
feat: wire mode count from GlobalVariablesPanel to Overlay
```

---

### Task 3: Replace hardcoded 580 with dynamic width

**Files:**
- Modify: `src/overlay/shell/Overlay.tsx`

**Step 1: Import the helper**

At top of Overlay.tsx, add:

```tsx
import { getVariablesPanelWidth } from "../variables/panelWidth";
```

**Step 2: Replace all 4 occurrences**

Each `activePanel.type === "variables" ? 580 : 300` becomes:

```tsx
activePanel.type === "variables" ? getVariablesPanelWidth(variablesModeCount) : 300
```

The 4 locations:
1. **Line 944** — `const PANEL_WIDTH = ...`
2. **Line 1166** — `const pw = ...` (resize handler)
3. **Line 1182** — `const pw = ...` (reposition effect)
4. **Line 1648** — `width: ...` (inline style)

Also update the `useEffect` dependency arrays:
- Line 1178: change `[anchor, activePanel.type]` → `[anchor, activePanel.type, variablesModeCount]`
- Line 1196: change `[activePanel.type, anchor]` → `[activePanel.type, anchor, variablesModeCount]`

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean

**Step 4: Commit**

```
feat: use dynamic width for variables panel based on mode count
```

---

### Task 4: Frozen-column scroll sync in CollectionDetail

**Files:**
- Modify: `src/overlay/variables/CollectionDetail.tsx`

This is the most involved task. When mode columns exceed available space, the name column stays pinned and mode columns scroll horizontally in sync.

**Step 1: Add a scroll sync ref at the top of `CollectionDetail`**

Inside the `CollectionDetail` component (after existing state declarations around line 868):

```tsx
const scrollSyncRef = useRef<HTMLDivElement[]>([]);
const registerScrollContainer = useCallback((el: HTMLDivElement | null, index: number) => {
  if (el) scrollSyncRef.current[index] = el;
}, []);

const handleModeScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
  const scrollLeft = e.currentTarget.scrollLeft;
  for (const el of scrollSyncRef.current) {
    if (el && el !== e.currentTarget) {
      el.scrollLeft = scrollLeft;
    }
  }
}, []);
```

**Step 2: Update the column headers for frozen-column layout**

Replace the multi-mode header block (lines 955-967) with:

```tsx
{relevantModes ? (
  <>
    <div style={{ width: 130, flexShrink: 0, ...COLUMN_HEADER_STYLE }}>Name</div>
    <div
      ref={(el) => registerScrollContainer(el, 0)}
      onScroll={handleModeScroll}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 4,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {relevantModes.map((m) => (
        <div
          key={m.name}
          style={{
            flex: "0 0 140px",
            textAlign: "right",
            ...COLUMN_HEADER_STYLE,
          }}
        >
          {m.name}
        </div>
      ))}
    </div>
  </>
) : (
  /* single-mode unchanged */
```

Key changes: `flex: 1, minWidth: 80` → `flex: "0 0 140px"` for fixed-width columns, `overflowX: "auto"` on the container, `scrollbarWidth: "none"` to hide scrollbar on header (data rows will show it).

**Step 3: Pass scroll sync props through to variable rows**

Add `scrollSyncRef`, `registerScrollContainer`, and `handleModeScroll` as props through `SubgroupSection` → `DetailVariableRow`. Use a context or prop drilling (prop drilling is simpler for 2 levels).

Add to `CollectionDetailProps` internal types — new props on `SubgroupSection` and `DetailVariableRow`:

```tsx
scrollSyncIndex: React.MutableRefObject<number>;
registerScrollContainer: (el: HTMLDivElement | null, index: number) => void;
onModeScroll: (e: React.UIEvent<HTMLDivElement>) => void;
```

In `CollectionDetail`, add a counter ref for assigning scroll container indices:

```tsx
const scrollIndexRef = useRef(1); // 0 is the header
scrollIndexRef.current = 1; // reset each render
```

**Step 4: Update DetailVariableRow multi-mode container**

Replace the mode values container (lines 626-638):

```tsx
{modeValues ? (
  <div
    ref={(el) => registerScrollContainer(el, scrollSyncIndex.current++)}
    onScroll={onModeScroll}
    style={{
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 4,
      overflowX: "auto",
      scrollbarWidth: "none",
    }}
  >
    {modeValues.map((mv) => (
      <ModeValueCell
        key={mv.modeName}
        varName={variable.name}
        mode={mv.mode}
        value={mv.value}
        varType={variable.type}
      />
    ))}
  </div>
) : (
```

Also update `ModeValueCell` style — change `flex: 1, minWidth: 80` → `flex: "0 0 140px"` so columns are fixed-width and don't shrink:

```tsx
// In ModeValueCell, both the editing and display containers:
style={{
  flex: "0 0 140px",
  // ... rest unchanged
}}
```

**Step 5: Typecheck + existing tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean typecheck, all tests pass

**Step 6: Commit**

```
feat: frozen-column scroll sync for mode columns in variables panel
```

---

### Task 5: Build + browser verify

**Step 1: Build**

Run: `npm run build`
Expected: clean

**Step 2: Browser test**

Open `http://localhost:3000/demo`, open the panel, click Variables. Verify:
1. Panel width adjusts to fit mode columns (wider than 580px if >1 mode)
2. Column headers show full mode names without clipping
3. If modes exceed 80vw, horizontal scroll appears on mode columns
4. Name column stays pinned during scroll
5. Scroll is synced between header and all data rows

**Step 3: Commit any fixes**

```
fix: adjustments from browser testing
```
