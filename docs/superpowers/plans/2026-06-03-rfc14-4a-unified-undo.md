# RFC #14 Increment 4a — Unify the undo stack (bring `mode` into apply.ts's temporal stack)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, with checkpoints) — chosen by the user. Steps use checkbox (`- [ ]`) syntax. High-risk core-undo refactor on a shared, auto-committed `main`: lock the ordering tests GREEN before deleting the old mode stack.

**Goal:** One temporal undo stack across inline/state/class/**mode**, so Cmd+Z reverses edits in true reverse-time order regardless of dimension. Delete `modeOverrides.ts`'s parallel `undoStack`/`redoStack` + `undoModeOverride`/`redoModeOverride`, and the `engine.undo/redo` inline→mode **fallthrough** (the source of the temporal-ordering bug).

**Architecture:** `apply.ts` already owns the single temporal stack for inline/state/class/batch/dom-move/custom-prop. A `mode` override is structurally identical to the existing `dom-move` entry — a closure-pair (`revert`/`reapply`), non-element, non-history stack entry — plus coalescing. 4a adds a generic `ForeignUndoEntry` (the `dom-move` entry generalized) and a `pushForeignUndo` registration **seam**; `modeOverrides.ts` registers its revert/reapply closures through that seam instead of running its own stack. Dependency direction stays a clean DAG: `modeOverrides → apply` (no cycle — `apply` never imports `modeOverrides`); `engine → both`.

**Tech Stack:** TypeScript, Vitest (happy-dom), tsup. No new deps.

---

## Key design decisions (settled)

- **Q2 layering** → `apply.ts` exposes `pushForeignUndo({revert, reapply, coalesceKey?})`. `modeOverrides.ts` calls it. No import cycle.
- **Q3 coalescing** → keep `beginModeCoalesce`/`endModeCoalesce` as the public API (ModeValueCell unchanged); implement by **merging into the last foreign entry** when `coalesceKey` matches while coalescing — same semantics as today, now on the unified stack. (Distinct from `beginBatch`/`endBatch`, which groups multi-prop inline edits.)
- **Mode return contract** → a `mode` undo/redo returns `{ el: document.body }` (identical to `dom-move`), NOT `null`. This is what keeps `handleUndoToIndex` (which loops `apply.ts` `undo()` and breaks on a falsy result) working — `dom-move` already proves the pattern. Consequence: keyboard-undo of a mode override now `refreshPanel(document.body)` + announces "Undo" (today's fallthrough silently did nothing). Same behavior `dom-move` undo already has. Flagged as optional polish (see Unresolved).
- **ADR-0004 upheld** → no style-panel reset clears mode overrides; mode clears only via undo. `resetAllModeOverrides` additionally purges mode's foreign entries from the unified stack via a new `clearForeignUndo()` (replacing its old `undoStack.length=0`).

---

## Task 1: RED — lock unified temporal ordering with fired-event tests

**Files:**
- Create: `src/overlay/__tests__/unifiedUndoOrdering.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { styleEngine } from "../core/engine";
import {
  applyModeOverride,
  beginModeCoalesce,
  endModeCoalesce,
  getModeOverrideCount,
  getModeOverrides,
  resetAllModeOverrides,
} from "../core/modeOverrides";
import { isDirty } from "../core/apply";

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

describe("unified temporal undo (RFC #14 Increment 4a)", () => {
  it("undo reverses interleaved inline + mode edits in reverse-time order", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");          // t0 inline
    applyModeOverride(".dark", "--bg", "#111");                            // t1 mode
    styleEngine.apply({ scope: "element", el }, "margin", "8px");          // t2 inline

    expect(isDirty(el, "color")).toBe(true);
    expect(isDirty(el, "margin")).toBe(true);
    expect(getModeOverrideCount()).toBe(1);

    // Reverse temporal: margin (t2) → --bg (t1) → color (t0)
    styleEngine.undo();
    expect(isDirty(el, "margin")).toBe(false);
    expect(getModeOverrideCount()).toBe(1); // mode still present

    styleEngine.undo();
    expect(getModeOverrideCount()).toBe(0); // mode reverted SECOND, not last
    expect(isDirty(el, "color")).toBe(true); // color still present

    styleEngine.undo();
    expect(isDirty(el, "color")).toBe(false);
  });

  it("redo restores interleaved edits in forward-time order", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    applyModeOverride(".dark", "--bg", "#111");
    styleEngine.undo(); // revert mode
    styleEngine.undo(); // revert color
    expect(isDirty(el, "color")).toBe(false);
    expect(getModeOverrideCount()).toBe(0);

    styleEngine.redo(); // re-color
    expect(isDirty(el, "color")).toBe(true);
    expect(getModeOverrideCount()).toBe(0);

    styleEngine.redo(); // re-mode
    expect(getModeOverrideCount()).toBe(1);
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111" });
  });

  it("a coalesced mode drag collapses to ONE undo step", () => {
    beginModeCoalesce();
    applyModeOverride(".dark", "--bg", "#100");
    applyModeOverride(".dark", "--bg", "#200");
    applyModeOverride(".dark", "--bg", "#300");
    endModeCoalesce();
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#300" });

    styleEngine.undo(); // ONE step reverts the whole drag
    expect(getModeOverrideCount()).toBe(0);
  });

  it("a mode undo returns the body sentinel (not null) so history-scrub keeps stepping", () => {
    applyModeOverride(".dark", "--bg", "#111");
    const r = styleEngine.undo();
    expect(r).not.toBeNull();
    expect(r?.el).toBe(document.body);
    expect(getModeOverrideCount()).toBe(0);
  });

  it("ADR-0004: a session-wide style resetAll leaves mode overrides intact", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    applyModeOverride(".dark", "--bg", "#111");

    styleEngine.resetAll();
    expect(isDirty(el, "color")).toBe(false);
    expect(getModeOverrideCount()).toBe(1); // mode survives the style reset
  });

  it("getModeOverrideCount tracks across unified undo/redo (drives useSyncExternalStore)", () => {
    applyModeOverride(".dark", "--bg", "#111");
    expect(getModeOverrideCount()).toBe(1);
    styleEngine.undo();
    expect(getModeOverrideCount()).toBe(0);
    styleEngine.redo();
    expect(getModeOverrideCount()).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails (RED)**

Run: `npx vitest run src/overlay/__tests__/unifiedUndoOrdering.test.ts`
Expected: the "interleaved … reverse-time order" and "mode undo returns the body sentinel" tests FAIL (today `styleEngine.undo()` reverts inline first via fallthrough and returns `null` for a mode step). Coalesce + ADR-0004 + count may already pass (regression guards).

---

## Task 2: GREEN-A — `apply.ts` foreign-op seam

**Files:**
- Modify: `src/overlay/core/apply.ts`

- [ ] **Step 1: Add `ForeignUndoEntry` to the union + a guard** (after `DomMoveUndoEntry`, ~line 104)

```ts
type DomMoveUndoEntry = { type: 'dom-move'; undo: () => void; redo: () => void };
/**
 * A foreign subsystem's undo step in the ONE temporal stack — a generic
 * closure-pair entry (like dom-move) that apply.ts reverts/reapplies without
 * knowing the subsystem. modeOverrides.ts registers through `pushForeignUndo`.
 * `coalesceKey` enables drag-coalescing (consecutive same-key steps merge).
 */
type ForeignUndoEntry = { type: 'foreign'; revert: () => void; reapply: () => void; coalesceKey?: string };
type UndoEntry = SingleUndoEntry | BatchUndoEntry | DomMoveUndoEntry | ForeignUndoEntry;

function isBatch(entry: UndoEntry): entry is BatchUndoEntry {
  return 'type' in entry && entry.type === 'batch';
}

function isDomMove(entry: UndoEntry): entry is DomMoveUndoEntry {
  return 'type' in entry && entry.type === 'dom-move';
}

function isForeign(entry: UndoEntry): entry is ForeignUndoEntry {
  return 'type' in entry && entry.type === 'foreign';
}
```

- [ ] **Step 2: Add the public seam** (near `pushDomMove`, in the DOM-Move section ~line 1270)

```ts
// --- Foreign-op undo seam (modeOverrides registers through this) ---

/** When true, consecutive `pushForeignUndo` calls with the same `coalesceKey`
 *  merge into the last foreign entry (one undo step per drag). */
let foreignCoalescing = false;

/** Begin coalescing foreign undo steps (call before a rapid-fire drag). */
export function beginForeignCoalesce(): void { foreignCoalescing = true; }

/** End coalescing foreign undo steps. */
export function endForeignCoalesce(): void { foreignCoalescing = false; }

/**
 * Register a foreign subsystem's undo step on the ONE temporal stack. `revert`
 * undoes the step, `reapply` redoes it. While coalescing, a step whose
 * `coalesceKey` matches the top foreign entry merges into it (keeps the original
 * `revert`, advances `reapply`) so a whole drag is one undo. A fresh step clears
 * the redo stack (standard undo semantics).
 */
export function pushForeignUndo(step: { revert: () => void; reapply: () => void; coalesceKey?: string }): void {
  const top = undoStack[undoStack.length - 1];
  if (
    foreignCoalescing && step.coalesceKey != null &&
    top && isForeign(top) && top.coalesceKey === step.coalesceKey
  ) {
    top.reapply = step.reapply; // keep original revert; advance the forward value
    return;
  }
  if (redoStack.length > 0) redoStack.length = 0;
  undoStack.push({ type: 'foreign', revert: step.revert, reapply: step.reapply, coalesceKey: step.coalesceKey });
  if (undoStack.length > MAX_UNDO) {
    undoStack.splice(0, undoStack.length - MAX_UNDO);
  }
}

/** Drop every foreign entry from both stacks (used when a foreign subsystem
 *  resets all of its state — today only modeOverrides). */
export function clearForeignUndo(): void {
  for (const stack of [undoStack, redoStack]) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (isForeign(stack[i])) stack.splice(i, 1);
    }
  }
}
```

- [ ] **Step 3: Handle foreign entries in `undo()`** (after the `isDomMove(last)` block, ~line 404)

```ts
  if (isForeign(last)) {
    last.revert();
    redoStack.push(last);
    notifyListeners();
    return { el: document.body };
  }
```

- [ ] **Step 4: Handle foreign entries in `redo()`** (after the `isDomMove(last)` block, ~line 531)

```ts
  if (isForeign(last)) {
    last.reapply();
    undoStack.push(last);
    notifyListeners();
    return { el: document.body };
  }
```

- [ ] **Step 5: Add `!isForeign(entry)` to every element-filtering stack loop** (TS-required — after `!isBatch`/`!isDomMove`, the union still includes `ForeignUndoEntry`, which has no `.el`). Four sites:
  - `resetStateOverrides` (~line 645): `} else if (!isDomMove(entry) && !isForeign(entry) && entry.el === el && matches(entry.prop)) {`
  - `resetElementBreakpoint` (~line 692): add `&& !isForeign(entry)` to the `else if`.
  - `reset` (~line 734): `} else if (!isBatch(entry) && !isDomMove(entry) && !isForeign(entry) && entry.el === el) {`
  - `resetProp` (~line 1032): `} else if (!isBatch(entry) && !isDomMove(entry) && !isForeign(entry) && entry.el === el && entry.prop === prop) {`
  - `resetProp` display-cascade loop (~line 1065): `} else if (!isBatch(ue) && !isDomMove(ue) && !isForeign(ue) && ue.el === el && ue.prop === cp) {`

- [ ] **Step 6: Run apply.ts unit suites + typecheck**

Run: `npx vitest run src/overlay/__tests__/apply.test.ts && npm run typecheck`
Expected: apply suite PASS; typecheck clean for apply.ts (foreign branches type-narrow correctly).

---

## Task 3: GREEN-B — route `modeOverrides.ts` through the seam, delete its stack

**Files:**
- Modify: `src/overlay/core/modeOverrides.ts`

- [ ] **Step 1: Import the seam** (top of file)

```ts
import {
  pushForeignUndo,
  clearForeignUndo,
  beginForeignCoalesce,
  endForeignCoalesce,
} from "./apply";
```

- [ ] **Step 2: Delete the parallel stack** — remove `interface UndoEntry`, `const undoStack`, `const redoStack`, `undoModeOverride`, `redoModeOverride`. Keep `store`, `version`, subscription, DOM helpers, internal mutators, `getModeOverrides`, `serialize…`, `isModeOverrideDirty`, `getModeOverrideCount`, `removeModeOverride`.

- [ ] **Step 3: Coalesce → delegate** (replace the `coalescing` flag block)

```ts
/** Enable undo coalescing (call before rapid-fire updates like color picker drag) */
export function beginModeCoalesce(): void { beginForeignCoalesce(); }

/** Disable undo coalescing */
export function endModeCoalesce(): void { endForeignCoalesce(); }
```

- [ ] **Step 4: `applyModeOverride` → register on the unified stack**

```ts
export function applyModeOverride(
  selector: string,
  varName: string,
  value: string,
): void {
  const prev = store.get(selector)?.get(varName) ?? null;
  pushForeignUndo({
    revert: () =>
      prev === null
        ? removeModeOverrideInternal(selector, varName)
        : applyModeOverrideInternal(selector, varName, prev),
    reapply: () => applyModeOverrideInternal(selector, varName, value),
    coalesceKey: `${selector} ${varName}`,
  });
  applyModeOverrideInternal(selector, varName, value);
}
```

- [ ] **Step 5: `resetAllModeOverrides` → purge unified foreign entries** (replace the two `…Stack.length = 0` lines)

```ts
export function resetAllModeOverrides(): void {
  clearForeignUndo();
  if (store.size === 0) return;
  store.clear();
  if (styleEl && document.contains(styleEl)) {
    styleEl.textContent = "";
  }
  notify();
}
```

- [ ] **Step 6: Run mode suite (will fail until Task 5 rewrites its undo imports) + typecheck**

Run: `npm run typecheck`
Expected: typecheck fails ONLY in `modeOverrides.test.ts` / `engine.ts` (deleted exports) — fixed in Tasks 4–5.

---

## Task 4: GREEN-C — collapse the engine fallthrough

**Files:**
- Modify: `src/overlay/core/engine.ts`

- [ ] **Step 1: Drop deleted imports** — remove `undoModeOverride`, `redoModeOverride` from the `./modeOverrides` import (keep `applyModeOverride`, `serializeModeOverrides`, `getModeOverrideCount`, `subscribeModeOverrides`, `getModeOverrideSnapshot`).

- [ ] **Step 2: `undo`/`redo` become straight delegates**

```ts
/** Unified undo over the ONE temporal stack (inline/state/class/mode/dom-move).
 *  Returns the affected element, or the body sentinel for non-element steps
 *  (mode/dom-move). The legacy inline→mode fallthrough is gone — ordering is
 *  now temporal (RFC #14 Increment 4a). */
function undo(): UndoResult | null {
  return undoInline();
}

function redo(): UndoResult | null {
  return redoInline();
}
```

- [ ] **Step 3: Run engine suite + typecheck**

Run: `npm run typecheck`
Expected: engine.ts clean. `styleEngine.test.ts` may still fail on the two fallthrough assertions — fixed in Task 5.

---

## Task 5: Update existing tests to the unified semantics

**Files:**
- Modify: `src/overlay/__tests__/modeOverrides.test.ts`
- Modify: `src/overlay/__tests__/styleEngine.test.ts`

- [ ] **Step 1: `modeOverrides.test.ts` — rewire undo/redo to the unified stack.** Replace the import of `undoModeOverride`/`redoModeOverride` with `import { undo, redo } from "../core/apply";`. In the `undo/redo` and `isModeOverrideDirty` describe blocks, replace `undoModeOverride()` → `undo()` and `redoModeOverride()` → `redo()`. (Store-state assertions are unchanged; return values aren't checked there.)

- [ ] **Step 2: `styleEngine.test.ts:165` — mode-only undo no longer returns null.**

```ts
    // No inline overrides exist; the mode step is on the unified stack and
    // returns the body sentinel (it has no specific element).
    const result = styleEngine.undo();
    expect(result?.el).toBe(document.body);
    expect(getModeOverrideCount()).toBe(0);
```

- [ ] **Step 3: `styleEngine.test.ts:309` — second undo (mode) returns body, not null.** Update the `r2` assertion + comment:

```ts
    const r2 = styleEngine.undo();
    expect(r2?.el).toBe(document.body);
    expect(getModeOverrideCount()).toBe(0); // mode cleared via the unified stack
```

(Title/first-undo assertions stay: inline was applied last, so it's still reverted first — now by genuine temporal order rather than fallthrough.)

- [ ] **Step 4: Run both suites**

Run: `npx vitest run src/overlay/__tests__/modeOverrides.test.ts src/overlay/__tests__/styleEngine.test.ts src/overlay/__tests__/unifiedUndoOrdering.test.ts`
Expected: ALL PASS (including the Task-1 RED tests — now GREEN).

---

## Task 6: Full verification

- [ ] **Step 1: Full suite** — `npx vitest run` → triage any red against changed modules only (`apply.ts`, `modeOverrides.ts`, `engine.ts`, the 3 test files). Leave foreign-session failures (e.g. `bordersPerSide`, `VisualOverlays.tsx`) untouched.
- [ ] **Step 2: Typecheck** — `npm run typecheck` → clean for changed modules.
- [ ] **Step 3: Build** — `npm run build` → GREEN (ESM + DTS).

---

## Task 7: Adversarial verification (ultracode) ✅ DONE — 5 upheld, 2 fixed

- [x] 7-skeptic workflow run. **5 invariants upheld** (temporal ordering, redo-invalidation, `clearForeignUndo` isolation, MAX_UNDO/batch, snapshot subscription). **2 medium catches, both RED-proven then fixed:**
  - **resetAll wiped the surviving mode's undo step** (TRUE 4a regression). Fix: `resetAll()` removes only non-foreign entries, preserving mode's foreign undo (upholds ADR-0006).
  - **two coalesce drags of the same key merged into one undo** (pre-existing latent flaw, faithfully ported — not a 4a regression). Fix: `foreignCoalesceFresh` latch so each `begin…/end…` session is its own entry.
  - Locked by 3 tests appended to `unifiedUndoOrdering.test.ts` (now 9 total, all green).

---

## Task 8: Document + record

- [ ] ADR-0006 — "The engine runs ONE temporal undo stack; foreign subsystems ride a `pushForeignUndo` seam" (supersedes the fallthrough).
- [ ] Update the `project_architecture_audit.md` memory: Phase 4 item 4a RESOLVED; next = 4b (`handleUndoToIndex`).
- [ ] Tick 4a in `2026-06-03-rfc14-phase4-roadmap.md`.

---

## Unresolved questions
1. **Mode-undo panel jump** — a keyboard mode-undo now `refreshPanel(document.body)` + announces (matching `dom-move`). Suppress the body-jump for both `dom-move` and `mode` (announce only, keep current selection) as a small shared polish, or leave consistent-with-dom-move? (Out of 4a scope; 1-line hotkey guard if wanted.)
2. **4b history rows** — should mode edits appear as ChangesDrawer history rows (they don't today)? Determines whether `handleUndoToIndex` should count or skip foreign steps. Deferred to 4b.
