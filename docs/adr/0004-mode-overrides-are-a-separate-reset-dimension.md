# ADR-0004: Mode overrides are a separate dimension; element Reset never clears them

**Status:** Accepted
**Date:** 2026-06-03

## Context

Redial tracks style mutations as **overrides** against an **override target** —
`element` (inline), `class` (a shared rule), `state` (a pseudo-state), and `mode`
(a theme-mode CSS variable). The first three are edits to the *selected element*;
a **mode override** is different — it is global, keyed by `(selector, varName)`,
and created in the Variables panel, not attached to any selected element.

Before RFC #14 Phase 3, the Footer's **Reset** button (`handleReset`) called
`resetAllModeOverrides()` on *every* reset. So resetting one element's `:hover`
state — or any element at all — silently wiped **all** theme-mode overrides
across the whole page, including unrelated theme edits made elsewhere. The Reset
button's count even folded the global mode count into its per-element badge
(`totalCount = count + modeCount`), masking the conflation.

While migrating Footer onto the unified engine (`styleEngine.resetScope`), we had
to decide whether to preserve this behavior (faithful migration) or fix it.

## Decision

**Mode overrides are a distinct reset dimension.** `resetScope(el, ctx)` clears
only the selected element's overrides for the active scope/state and **never**
touches mode overrides. The Footer's Reset count is element-only.

Mode overrides remain clearable through their own lifecycle: **undo**
(Cmd/Ctrl+Z falls through to the mode stack) today, and a dedicated
Variables-panel affordance tracked in issue #52.

## Consequences

- Resetting an element no longer destroys unrelated theme edits — the reported
  over-clear bug is fixed (locked by `footerReset.test.tsx`).
- Until #52 lands, mode overrides have **no button-driven clear path** on the
  Footer; undo is the only one. This is an accepted, temporary gap.
- The engine gains reset/apply symmetry: `resolveTarget` + `apply` for writes,
  `resetScope` for clears, both consuming the same `ScopeContext`.
- This is a deliberate **behavior change** (not a pure refactor), made mid-#14 at
  the user's direction.

## Alternatives considered

- **Preserve the global wipe** (faithful migration). Rejected by the user: the
  over-clear is a real data-loss bug, worth fixing even though it deviates from
  byte-identical migration.
- **Also build the Variables-panel mode-reset now.** Deferred to #52 to keep this
  increment scoped to the engine surface + the bugfix.

## Related

- RFC #14 (Unified Style Engine), Phase 3 — `src/overlay/core/engine.ts`
  (`resetScope` carries the "does not clear modes" rationale inline).
- `CONTEXT.md` — `Mode override`, `Override target`, `Scoping context`.
- Issue #52 — dedicated Variables-panel mode-override clear affordance.
