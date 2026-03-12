---
title: "feat: Add Webflow UX interaction patterns"
type: feat
date: 2026-03-11
deepened: 2026-03-11
---

# Add Webflow UX Interaction Patterns

## Enhancement Summary

**Deepened on:** 2026-03-11
**Original tasks:** 16 → **Final tasks:** 12 (3 cut, 1 merged)
**Agents:** SpecFlow, TypeScript, Architecture, Simplicity, Performance, Patterns, Race Conditions, Best Practices

### Key Changes
1. **CUT K.4** — Property search already exists in WebflowPanel.tsx lines 37-153
2. **CUT M.2** — Named undo entries YAGNI (timeline feature is in a different plan)
3. **CUT N.2** — Variable picker duplicates CSSVariablesSection.tsx
4. **SIMPLIFIED I.1** — Pure function not hook; single-operator only
5. **MERGED J.2 into J.1** — `title` attributes + direct click, no custom tooltip
6. **SIMPLIFIED K.3** — Inline div in Overlay.tsx, not a separate component
7. **SIMPLIFIED L.2** — Wiring only; useDragReorder.ts already exists (280 lines)

### Critical Race Conditions
- Wheel debounce + unmount: clear timer in useEffect cleanup
- Drag + eye toggle: disable controls during active drag
- Transition preview: bypass undo system (raw el.style writes)
- Focus mode collapse-all: skip CSS transition to avoid layout thrashing

---

## Overview

Redial has full CSS property coverage (44 tasks, Phases A-H) and a prior plan covers canvas overlays, command palette, navigator, and context menus. This plan targets **interaction micro-patterns** that make Webflow's style panel feel fast — math in inputs, clickable style labels, focus mode, effect layer management, undo grouping, and CSS variable indicators.

## Problem Statement

Power users interact with style panels hundreds of times per session. The difference between "functional" and "fast" is in the micro-interactions: typing `*2` to double a value, clicking a blue label to reset one property, or toggling an effect layer's visibility without deleting it.

## Proposed Solution

12 features across 6 phases, ordered by impact and dependency. Each phase is independently shippable.

---

### Phase I: Input Intelligence

##### Task I.1: Math Expressions in Numeric Inputs
**Files: `src/overlay/inputMath.ts` (new ~30 lines), `src/overlay/controls.tsx`, `src/overlay/SizeInputCell.tsx`, `src/overlay/TypoValueCell.tsx`**

Pure function `evaluateMathExpr()` called from each input's commit handler. Single-operator only.

```ts
// inputMath.ts
export function evaluateMathExpr(input: string, currentValue: number): number | null {
  const match = input.match(/^([0-9.]*)\s*([+\-*/])\s*([0-9.]+)$/);
  if (!match) return null;
  const left = match[1] ? parseFloat(match[1]) : currentValue;
  const right = parseFloat(match[3]);
  switch (match[2]) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return right !== 0 ? left / right : null;
  }
  return null;
}
```

Edge cases: div-by-zero → no-op, negative clamp for non-negative props, round to 2 decimals, strip unit before eval.

Acceptance criteria:
- [ ] `*2` doubles, `+10` adds, `200 + 50` = 250, `/0` no-op
- [ ] Unit preserved, works in ValueInput/SizeInputCell/TypoValueCell
- [ ] Eval on Enter and blur only (synchronous)

##### Task I.2: Empty Field → Contextual Keyword
**Files: `src/overlay/panelConstants.tsx`, `src/overlay/controls.tsx`, `src/overlay/SizeInputCell.tsx`**

```ts
export const EMPTY_KEYWORD_MAP: Record<string, string> = {
  'width': 'auto', 'height': 'auto', 'max-width': 'none', 'max-height': 'none',
  'min-width': '0', 'min-height': '0', 'z-index': 'auto', 'flex-basis': 'auto',
};
```

Acceptance criteria:
- [ ] Clear width → `auto`, clear max-width → `none`
- [ ] Unmapped properties revert to previous value
- [ ] Keyword displayed at `opacity: 0.5`

##### Task I.3: Alt+Click Label Reset
**Files: `src/overlay/controls.tsx` (SliderRow, ColorRow, SelectRow, TextRow)**

Wire `onReset` → `resetProp(element, prop)` to all row types. Alt+Click within 3px dead zone = reset; Alt+drag >3px = fine scrub (no regression with LabelScrub).

Acceptance criteria:
- [ ] Alt+Click blue label clears property, no-op on unoverridden
- [ ] Flash animation, undo stack entry, works on all row types

---

### Phase J: Interactive Style Labels

##### Task J.1: Colored Labels + Title Attributes
**Files: `src/overlay/panelUtils.ts`, `src/overlay/controls.tsx` (all row types)**

| Indicator | Color | `title` |
|-----------|-------|---------|
| element/direct | `#60a5fa` | "Set locally. Alt+Click to reset." |
| inherited | `#f59e0b` | "Inherited from {parent.tag}.{class}" |
| state | `#34d399` | "Set on :{state}. Alt+Click to clear." |
| none | `rgba(255,255,255,0.5)` | none |

Add `getIndicatorColor(type)` to panelUtils.ts. StyleIndicator stays pure.

Acceptance criteria:
- [ ] Labels colored by indicator type, reactive to changes
- [ ] `title` attributes show context on hover

---

### Phase K: Panel Navigation

##### Task K.1: Focus Mode
**Files: `src/overlay/WebflowPanel.tsx`, `src/overlay/controls.tsx` (Section)**

Alt+Shift+S toggle. Lift section open/close state to WebflowPanel as `expandedSection: string | null`. Session state only (not localStorage). Skip transition when collapsing all.

Acceptance criteria:
- [ ] Opening a section closes others in Focus Mode
- [ ] "Focus" pill in header, smooth scroll to opened section
- [ ] Independent collapse when off

##### Task K.2: Sticky Section Headers
**Files: `src/overlay/controls.tsx` (Section)**

`position: sticky; top: 0; zIndex: 2; background: '#1e1e1e'` on section headers. Only expanded sections stick.

Acceptance criteria:
- [ ] Headers stick during scroll, opaque background, no layout shift

##### Task K.3: Shortcut Reference
**Files: `src/overlay/Overlay.tsx`, `src/overlay/panelConstants.tsx`**

Define `SHORTCUTS` constant array in panelConstants. Shift+/ toggles inline div (not a new file). Guard: skip when input focused.

Acceptance criteria:
- [ ] Shift+/ opens/closes reference, Escape closes, all shortcuts listed

---

### Phase L: Effect Layer Management

##### Task L.1: Eye Icon Visibility Toggle
**Files: `src/overlay/ShadowEditor.tsx`, `src/overlay/FilterSliders.tsx`, `src/overlay/BackgroundLayerList.tsx`, `src/overlay/TransitionEditor.tsx`**

Add `visible: boolean` (required, default true) to ShadowValue, BackgroundLayer, filter/transition types. Serialization skips invisible layers. Disable eye toggle during active drag (`pointerEvents: 'none'` when isDragging).

Acceptance criteria:
- [ ] Eye icon on all layer types, toggle CSS contribution
- [ ] Dimmed row at opacity 0.4, undoable, order preserved

##### Task L.2: Wire Drag Reorder
**Files: `src/overlay/FilterSliders.tsx`, `src/overlay/TransitionEditor.tsx`**

Wire existing `useDragReorder` + `DragHandle` into FilterSliders and TransitionEditor. ~15 lines each.

Acceptance criteria:
- [ ] Drag handles on filter/transition layers, reorder applies CSS

##### Task L.3: Transition Preview
**Files: `src/overlay/TransitionEditor.tsx`**

Play button. Bypass undo system: raw `el.style.setProperty`/`removeProperty`. Cancellation token for double-play. Toggle opacity for generic preview.

Acceptance criteria:
- [ ] Play triggers visible transition, reverses after duration
- [ ] Double-click cancels first, element change cleans up

---

### Phase M: Undo Grouping

##### Task M.1: Wire Batch Undo
**Files: `src/overlay/LabelScrub.tsx`, `src/overlay/controls.tsx` (SliderRow), `src/overlay/useWheelAdjust.ts`**

`beginBatch`/`endBatch` already exist in apply.ts. Wire into: LabelScrub (pointerdown/up), SliderRow range input (mousedown/up), useWheelAdjust (first tick → beginBatch, 500ms idle → endBatch). Clear debounce timer in useEffect cleanup.

Acceptance criteria:
- [ ] Slider drag = 1 undo entry, label scrub = 1 entry
- [ ] Wheel groups at 500ms, unmount cleans up timer

---

### Phase N: Variable Indicator

##### Task N.1: Variable-Linked Property Indicator
**Files: `src/overlay/panelUtils.ts`, `src/overlay/StyleIndicator.tsx`**

Add `"variable"` to IndicatorType union. Detect via `getAuthoredValue` for `var()`. Cache stylesheet scan per element in WeakMap. Purple dot `#a78bfa`.

Acceptance criteria:
- [ ] Purple dot when property uses `var()`, tooltip shows variable name
- [ ] Stylesheet scan cached per element

---

## Acceptance Criteria

- [ ] All 12 tasks functional, no regressions to 176+ tests
- [ ] `npm run typecheck` and `npm test` pass
- [ ] Math eval < 1ms, label colors < 16ms, drag 60fps
- [ ] Stylesheet scan cached (no repeated O(rules) walks)
