---
title: "feat: Overflow Per-Axis Controls"
type: feat
date: 2026-03-16
---

# Overflow Per-Axis Controls

## Overview

Add lock/unlock toggle to the overflow control in SizeSection. When locked (default), a single `WebflowSegmentedControl` sets both axes. When unlocked, two independent controls appear for `overflow-x` and `overflow-y`. Follows the gap row lock/unlock pattern from `LayoutSection.tsx:157`.

Spec reference: `webflow-style-panel-spec.md:286-288`

## Files

| File | Change |
|------|--------|
| `src/overlay/core/infer.ts:325-334` | Add `overflowX`, `overflowY` fields to size inference |
| `src/overlay/sections/SizeSection.tsx:93,163,374-390` | Lock state, per-axis state, handlers, conditional UI |
| `src/overlay/__tests__/sizeSection.test.ts:281-317` | Replace gap test, add per-axis tests |

## Implementation

### Task 1: `infer.ts` — Add overflow-x/y to inference

After the existing `overflow` field at line 325, add:

```ts
"overflow-x": {
  type: "select",
  options: [
    { value: "visible", label: "Visible" },
    { value: "hidden", label: "Hidden" },
    { value: "scroll", label: "Scroll" },
    { value: "auto", label: "Auto" },
  ],
  default: cs.overflowX,
} as SelectConfig,
"overflow-y": {
  type: "select",
  options: [
    { value: "visible", label: "Visible" },
    { value: "hidden", label: "Hidden" },
    { value: "scroll", label: "Scroll" },
    { value: "auto", label: "Auto" },
  ],
  default: cs.overflowY,
} as SelectConfig,
```

Also add `"overflow-x"`, `"overflow-y"` to the section indicator array in `SizeSection.tsx:241`.

### Task 2: `SizeSection.tsx` — State + handlers

**New state** (after line 93):

```ts
const [overflowLocked, setOverflowLocked] = useState(() => {
  const ox = cs.overflowX || "visible";
  const oy = cs.overflowY || "visible";
  return ox === oy;
});
const [overflowX, setOverflowX] = useState(() => cs.overflowX || "visible");
const [overflowY, setOverflowY] = useState(() => cs.overflowY || "visible");
```

**Replace `handleOverflowChange`** (line 163):

```ts
const handleOverflowChange = useCallback((v: string) => {
  setOverflow(v);
  setOverflowX(v);
  setOverflowY(v);
  apply("overflow", v);
}, [apply]);

const handleOverflowXChange = useCallback((v: string) => {
  setOverflowX(v);
  apply("overflow-x", v);
}, [apply]);

const handleOverflowYChange = useCallback((v: string) => {
  setOverflowY(v);
  apply("overflow-y", v);
}, [apply]);

const handleOverflowLockToggle = useCallback(() => {
  setOverflowLocked((prev) => !prev);
}, []);
```

### Task 3: `SizeSection.tsx` — UI (lines 374-390)

Replace the single overflow row with a lock/unlock pattern matching the gap row from `LayoutSection.tsx:462-512`:

**When locked:** Single `WebflowSegmentedControl` + link icon button (existing layout, add lock toggle).

**When unlocked:** Two rows — "Overflow X" and "Overflow Y" — each with their own `WebflowSegmentedControl`, plus an unlink button on the first row.

Use the `Link` / `Unlink` icons from `lucide-react` (same as gap row).

### Task 4: Tests

- Remove the "does not yet implement" test (line 305-311)
- Add: "overflow defaults to locked when axes match"
- Add: "overflow auto-unlocks when overflow-x !== overflow-y on init"
- Add: "unlock shows overflow-x and overflow-y controls"
- Add: "per-axis values are independent when unlocked"
- Add: "section indicator tracks overflow-x and overflow-y"

## Acceptance Criteria

- [x] `infer.ts` exposes `overflow-x` and `overflow-y` in size config
- [x] SizeSection defaults to locked (single overflow control)
- [x] Unlocking reveals two independent per-axis controls
- [x] Auto-unlocks when computed `overflow-x !== overflow-y`
- [x] Lock toggle button uses same visual pattern as gap lock
- [x] All existing overflow tests still pass
- [x] New per-axis tests pass
- [x] `npm run typecheck` clean
- [x] `npm test` all green

## Verification

1. `npm run typecheck`
2. `npm test`
3. Browser: select element → unlock overflow → set X to scroll, Y to hidden → verify independent application
