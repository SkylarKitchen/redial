# RFC #14 Phase 4 — Roadmap (plugin extraction + unified undo)

> **For agentic workers:** This is a ROADMAP that decomposes Phase 4 into four
> independently-shippable increments. Each increment gets its own fully-detailed
> bite-sized plan (`superpowers:writing-plans`) when it is started, then executes
> via `superpowers:subagent-driven-development` / `superpowers:executing-plans`.
> One increment per session; review checkpoint between each. High-risk refactor on
> a shared, auto-committed `main`.

**Goal:** Collapse the four style subsystems behind one `MutationPlugin`-based
engine with a single temporal undo stack and injectable adapters; shrink
`apply.ts` from ~1260 → ~400 lines.

**Architecture:** Today `core/engine.ts` is a facade over `apply.ts` (inline +
state + class + batch + dom-move + custom-prop, **one** undo stack), `scope.ts`,
`statePreview.ts`, and `modeOverrides.ts` (**separate** undo stack). Phase 4
unifies the undo stack, formalizes each subsystem as a plugin, and injects
DOM/storage adapters for jsdom-free tests.

**Tech stack:** TypeScript, Vitest (happy-dom), tsup. No new deps.

---

## Current state (verified 2026-06-03)

- `apply.ts` runs ONE undo stack (`undoStack`/`redoStack`, entry union:
  `SingleUndoEntry | BatchUndoEntry | DomMoveUndoEntry`) covering inline, state
  (composite key), class (via `className` on the entry), batch, dom-move, and
  custom-property edits.
- `modeOverrides.ts` runs a SEPARATE `undoStack`/`redoStack` (`UndoEntry`:
  `{selector,varName,prev,next}`) + `beginModeCoalesce`/`endModeCoalesce`.
- `engine.undo()/redo()` do an inline→mode **fallthrough** (`undoInline()` else
  `undoModeOverride()`) — temporally wrong: a mode edit made *before* an inline
  edit still undoes *after* it.
- Undo consumers:
  - `hooks/useOverlayHotkeys.ts:156` → `styleEngine.undo()` (Cmd/Ctrl+Z; uses fallthrough).
  - `hooks/useStyleHandlers.ts:116` (`handleUndoToIndex`, ChangesDrawer history scrub)
    → `apply.ts` `undo()` DIRECTLY (inline-only, deliberately bypasses the broken fallthrough).
  - `variables/ModeValueCell.tsx:247,252` → `beginModeCoalesce`/`endModeCoalesce` (color-drag).
- ADR-0004 invariant: no style-panel reset clears mode overrides. Must survive Phase 4.

---

## Decomposition (4 increments)

### Increment 4a — Unify the undo stack (bring `mode` into `apply.ts`'s temporal stack)  ✅ SHIPPED 2026-06-03
> Detailed plan: `docs/superpowers/plans/2026-06-03-rfc14-4a-unified-undo.md`. Decision: ADR-0006.
> `mode` rides `apply.ts`'s new `pushForeignUndo` seam (generic foreign-op entry, peer of `dom-move`); the
> `engine.undo/redo` fallthrough + `modeOverrides`' parallel stack are deleted. Locked by
> `unifiedUndoOrdering.test.ts` (6 tests). Next: 4b.

**Goal:** A single temporal undo stack across inline/state/class/**mode**. Kill
`modeOverrides.ts`'s parallel `undoStack`/`redoStack` + `undoModeOverride` /
`redoModeOverride` + `beginModeCoalesce`/`endModeCoalesce`. Delete the
`engine.undo/redo` fallthrough (ordering becomes automatic).

**Files:** `core/apply.ts` (add a `mode` undo-entry variant + a revert-callback
registration seam), `core/modeOverrides.ts` (route applies through the unified
stack; delete its stack + coalesce), `core/engine.ts` (drop fallthrough; `undo`
returns the affected element or null uniformly), `variables/ModeValueCell.tsx`
(coalesce via the retained begin/end shims). Tests:
`__tests__/unifiedUndoOrdering.test.ts` (new).

**Approach (key shapes):**
- Avoid an `apply.ts → modeOverrides.ts` import cycle: `apply.ts` exposes a
  registration seam, `modeOverrides.ts` registers its revert closures at module
  init.
  ```ts
  // apply.ts — generic foreign-op entry in the ONE stack
  type ForeignUndoEntry = { type: 'foreign'; revert: () => void; reapply: () => void };
  // undo(): if foreign → entry.revert(); push reapply to redo; return null (no el).
  export function pushForeignUndo(step: { revert: () => void; reapply: () => void }): void;
  ```
- `modeOverrides.applyModeOverride` pushes a `pushForeignUndo({revert,reapply})`
  capturing `(selector,varName,prev,next)` instead of its own stack.
- Coalescing: keep `beginModeCoalesce`/`endModeCoalesce` as the public API
  (ModeValueCell unchanged), but implement by merging into the **last foreign
  entry** when the same `(selector,varName)` repeats while coalescing — same
  semantics as today, now on the unified stack.
- `engine.undo/redo` become straight `undoInline()/redoInline()` (mode is now in
  that stack). `UndoResult` already allows `null` for non-element steps.

**Tests (fired-event ordering — write RED first):**
1. Interleave: inline `color`, mode `--bg`, inline `margin`. `undo()`×3 reverts
   `margin` → `--bg` → `color` (reverse temporal). `redo()`×3 restores forward.
2. Coalesce: `beginModeCoalesce(); apply ×5 same (sel,var); endModeCoalesce()` ⇒
   ONE undo step reverts the whole drag.
3. ADR-0004: a style-panel `resetScope`/`resetAll` still leaves modes intact;
   mode is cleared only by undo.
4. `getModeOverrideCount` snapshot still drives `useSyncExternalStore`.

**Risk:** HIGH (core undo). Lock ordering tests GREEN before deleting the old stack.

---

### Increment 4b — Migrate `handleUndoToIndex` onto the unified undo
**Goal:** ChangesDrawer history scrub replays through `styleEngine.undo()` (now
temporally correct) instead of `apply.ts`'s inline-only `undo`.

**Files:** `hooks/useStyleHandlers.ts` (swap `undo` import → `styleEngine.undo`),
`shell/ChangesDrawer.tsx` (confirm `historyEntries` semantics across mixed
inline+mode steps). Tests: `__tests__/historyScrubUnified.test.tsx`.

**Approach:** `handleUndoToIndex` loop calls `styleEngine.undo()`; drop the
`apply.ts` `undo` import. Confirm whether mode edits should appear as history
rows (open Q4) and make the scrub count consistent with that.

**Tests:** seed a mixed inline+mode history; scrub to an index; assert the right
suffix is reverted and `diffAll()`/`getModeOverrideCount` match expectation.

**Risk:** MED — depends on 4a; small surface.

---

### Increment 4c — `MutationPlugin` interface + plugin extraction
**Goal:** Formalize `InlineStylePlugin` / `StatePreviewPlugin` / `ClassStylePlugin`
/ `ModeOverridePlugin` implementing `MutationPlugin { apply, revert, coalesce,
diff, reset }`. Engine dispatches by `target.scope` → plugin; the unified stack
stores `{ pluginId, payload }` and `undo` delegates to `plugin.revert`. A future
CSS-editor tab = register a plugin, zero engine edits.

**Files:** `core/plugins/*.ts` (new), `core/engine.ts` (registry + dispatch),
`core/apply.ts` (becomes `InlineStylePlugin`'s internals). Tests: per-plugin +
registry-dispatch suites.

**Approach:** Define the interface; wrap each subsystem; the 4a foreign-entry
becomes `ModeOverridePlugin`'s revert. Behavior-preserving — the existing suites
plus 4a/4b ordering locks are the safety net.

**Risk:** HIGH (broad), but no behavior change. Detail in its own plan.

---

### Increment 4d — Adapter injection (`StyleReader`/`StyleWriter`/`StorageAdapter`/`ElementResolver`)
**Goal:** Construct the engine with injected adapters so unit tests need no jsdom;
`apply.ts` shrinks toward ~400 lines.

**Files:** `core/adapters/*.ts` (new interfaces + default DOM/localStorage impls),
`core/engine.ts` (constructor injection; module singleton wires defaults). Tests:
engine unit tests with fake adapters (node env, no happy-dom).

**Approach:** Extract every `getComputedStyle`/`style.setProperty`/`localStorage`/
`querySelector` behind an adapter; default adapters wrap the real DOM; the
singleton stays the public surface. Wide but mechanical.

**Risk:** MED-HIGH (wide mechanical change). Detail in its own plan.

---

## Ordering fork (DECISION NEEDED)

- **Handoff order:** plugins (4c) → merge (4a) → 4b → adapters (4d).
- **This roadmap recommends:** **4a → 4b → 4c → 4d.** Rationale: `apply.ts`'s
  stack already unifies everything *except* mode, so "merge the stacks" is a
  small, self-contained, high-value increment that needs no plugin abstraction
  first. Shipping unified temporal undo early de-risks and validates the model
  before the broad plugin (4c) and adapter (4d) refactors; plugins then formalize
  an already-unified stack.

## Unresolved questions
1. **Ordering** — merge-first (4a→4b→4c→4d, recommended) or plugins-first (handoff)?
2. **4a layering** — `apply.ts` exposes a `pushForeignUndo` registration seam
   (recommended, no import cycle) vs. `apply.ts` importing `modeOverrides`
   internals directly?
3. **4a coalescing** — keep `beginModeCoalesce`/`endModeCoalesce` as the public
   shim over a unified "merge into last foreign entry" (recommended) vs. reuse
   `beginBatch`/`endBatch` (different semantics: batch groups multi-prop; mode
   merges same-key)?
4. **4b history rows** — should mode edits appear as ChangesDrawer history entries,
   or stay excluded (status quo)? Determines the scrub count semantics.
5. **Execution mode** — subagent-driven (fresh agent per task, two-stage review)
   vs. inline (this session, checkpoints) vs. plan-only (stop after the detailed
   4a plan)?
