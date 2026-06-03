# ADR-0006: The engine runs ONE temporal undo stack; foreign subsystems ride a `pushForeignUndo` seam

**Status:** Accepted
**Date:** 2026-06-03

## Context

RFC #14's unified engine had collapsed apply/diff/reset/subscribe behind one
facade (`engine.ts`), but **undo** was still split across two stacks:

- `apply.ts` owned the temporal stack for inline, state (composite-keyed),
  class, batch, dom-move, and custom-property edits.
- `modeOverrides.ts` owned a **separate** `undoStack`/`redoStack` for CSS-variable
  theme-mode edits, with its own `undoModeOverride`/`redoModeOverride` and
  coalescing.

`engine.undo()/redo()` bridged them with a **fallthrough**: try the inline stack
first, and only touch the mode stack when the inline stack was empty. That is
temporally wrong — a mode edit made *before* an inline edit was undone *after*
it, because all inline edits drained first regardless of when each happened.
Cmd+Z did not reverse the user's actions in the order they occurred.

Increment 4a unifies the stacks. Two questions had to be settled:

1. **Where does temporal order live?** Merge `mode` into `apply.ts`'s stack, or
   keep two stacks and arbitrate order at the engine with a sequence counter?
2. **How does `apply.ts` revert a `mode` step without importing
   `modeOverrides.ts`** (which would create a cycle, since `modeOverrides`
   renders/serializes through its own DOM helpers and is the higher-level module)?

## Decision

**`apply.ts` is the single owner of temporal order. A `mode` edit is recorded on
that one stack as a generic `ForeignUndoEntry` — a `{revert, reapply, coalesceKey?}`
closure-pair, structurally the `dom-move` entry generalized — registered through a
`pushForeignUndo` seam. `modeOverrides.ts` calls the seam; `apply.ts` never imports
`modeOverrides.ts`.**

- `apply.ts` exposes `pushForeignUndo`, `clearForeignUndo`,
  `beginForeignCoalesce`/`endForeignCoalesce`. `undo()`/`redo()` gain a `foreign`
  branch that calls `entry.revert()`/`entry.reapply()` — exactly mirroring the
  existing `dom-move` branch.
- `modeOverrides.applyModeOverride` captures the prior value and registers
  `revert` (restore prior / remove if it didn't exist) + `reapply` (re-apply the
  new value), with `coalesceKey = "<selector> <varName>"`. Its own stack,
  `undoModeOverride`, and `redoModeOverride` are **deleted**.
  `beginModeCoalesce`/`endModeCoalesce` are retained as the public API
  (`ModeValueCell` unchanged) and delegate to the foreign-coalesce flag.
- `engine.undo()/redo()` become straight `undoInline()/redoInline()`. The
  fallthrough is gone; ordering is automatic and temporal.
- **Return contract.** A `mode` (and `dom-move`) step returns the
  `{ el: document.body }` sentinel rather than `null`, so the ChangesDrawer
  history scrub (`handleUndoToIndex`, which loops `apply.ts`'s `undo()` and halts
  on a falsy result) keeps stepping past it — the behavior `dom-move` already
  relied on.
- **ADR-0004 upheld.** No style-panel reset clears mode overrides. The five
  element-filtering stack loops (`reset`/`resetProp`/`resetStateOverrides`/
  `resetElementBreakpoint`) now also guard `!isForeign(entry)`, so a reset never
  splices a mode step out of the stack. `resetAllModeOverrides` purges mode's
  unified-stack footprint via `clearForeignUndo()` (which removes **only**
  foreign entries, leaving inline/state/class/dom-move entries intact).

## Consequences

- Cmd+Z / Cmd+Shift+Z now reverse **every** dimension (inline, state, class,
  mode, dom-move) in true reverse-time order — the headline correctness fix.
- One stack means one place to reason about temporal order; `modeOverrides.ts`
  shrinks to pure store + render + serialize + the seam registration.
- A keyboard mode-undo now `refreshPanel(document.body)` + announces "Undo"
  (today's fallthrough returned `null`, so it silently did nothing). This is the
  same behavior `dom-move` undo already has; suppressing the body-jump for both
  is an optional follow-up, not part of 4a.
- `handleUndoToIndex` (the ChangesDrawer history scrub) still calls `apply.ts`'s
  `undo()` directly and now steps mode entries too — consistent with how it
  already steps `dom-move` entries. Migrating it onto `styleEngine.undo()` with
  history-row-aware semantics is **Increment 4b**.
- Locked by `src/overlay/__tests__/unifiedUndoOrdering.test.ts` (interleave
  ordering, forward redo, drag coalescing, body sentinel, ADR-0004 survival,
  snapshot tracking) plus the updated `modeOverrides.test.ts` /
  `styleEngine.test.ts`.

## Alternatives considered

- **Temporal arbiter over two stacks.** Keep both stacks, stamp each push with a
  global monotonic sequence, and have the engine pop whichever stack's top is
  newer. Rejected: it fixes ordering but keeps the second stack RFC #14 exists to
  remove, and duplicates trimming/redo-invalidation logic.
- **Physically merge by importing `modeOverrides` into `apply.ts`.** Rejected:
  `apply.ts` is the lower-level module; importing the higher-level mode renderer
  creates a cycle. The `pushForeignUndo` seam keeps the dependency one-way
  (`modeOverrides → apply`).
- **Combine 4a with 4b** (migrate `handleUndoToIndex` in the same change).
  Rejected: high-risk core-undo work on a shared, auto-committed `main` is safer
  one reviewable increment at a time. 4a leaves the scrub consistent with its
  existing `dom-move` handling; 4b reworks the scrub deliberately.

## Related

- RFC #14 (Unified Style Engine), Increment 4a — `src/overlay/core/apply.ts`
  (`ForeignUndoEntry`/`isForeign`/`pushForeignUndo`/`clearForeignUndo`/
  `beginForeignCoalesce`/`endForeignCoalesce`, the `foreign` branches in
  `undo`/`redo`), `src/overlay/core/modeOverrides.ts`, `src/overlay/core/engine.ts`.
- ADR-0004 — mode overrides are a separate reset dimension (upheld here, now via
  `clearForeignUndo` rather than mode's own stack).
- ADR-0005 — breakpoint composition dimension (the prior 4-* increment).
- Plan: `docs/superpowers/plans/2026-06-03-rfc14-4a-unified-undo.md`.
- Issue #14 — Unified Style Engine. Increment 4b — migrate `handleUndoToIndex`.
