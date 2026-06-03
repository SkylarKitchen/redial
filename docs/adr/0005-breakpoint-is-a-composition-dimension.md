# ADR-0005: A breakpoint is an orthogonal composition dimension on the override key, not a fifth override target

**Status:** Accepted
**Date:** 2026-06-03

## Context

RFC #14's unified engine models a style mutation as an **override** landing on an
**override target** — `element` (inline), `class` (a shared rule), `state` (a
pseudo-state), or `mode` (a theme-mode CSS variable). Increment C adds the
**breakpoint** dimension (a responsive `@media` band) to that model, ahead of #35
"Breakpoint Studio", so the model generalizes *before* breakpoint-aware callers
harden around today's `(scope, class, state)` triple.

The read side already exists: `variables/modeDiscovery.ts` parses
`@media (min-width: 768px)` queries. Increment C adds the **write/override** side.

Two questions had to be settled before writing code:

1. **Shape.** Add a fifth `breakpoint` arm to `OverrideTarget`, or carry the
   breakpoint as a dimension that composes with the existing arms?
2. **Where it lives in the key.** `apply.ts` keys every override by a composite
   string (`stateKey("hover","color") → "hover::color"`). Does the breakpoint
   generalize *that key*, or live somewhere new?

The scope of Increment C was deliberately bounded to the **model** (keying,
diffing, undo, reset) — no breakpoint UI, no media-gated live preview, and no
`@media` file-write path; those land with #35.

## Decision

**A breakpoint is an orthogonal composition dimension, carried as an optional
field on the `element` / `class` / `state` arms of `OverrideTarget` and encoded
into `apply.ts`'s composite key — never as a fifth flat arm.**

- The override-map key generalizes from `state::prop` to
  `<breakpoint>@@<state>::<prop>` (`compositeKey` / `parseKey` in `apply.ts`).
  The **base breakpoint** and the `"none"` state elide their segments, so base
  keys stay **byte-identical** to the legacy form — persisted sessions, undo
  entries, and the three existing `resolveTarget` callers are unaffected.
- `ScopeContext.activeBreakpoint` is **optional** (defaults to `"base"`), so
  pre-Increment-C callers compile and behave unchanged.
- **Inline-DOM writability** is now decided by `isInlineWritable(key)`
  (`breakpoint === "base" && state === "none"`), replacing the scattered
  `prop.includes("::")` guard — which is blind to breakpoints (`768@@color` has
  no `::` but must **not** be written to the base inline style).
- **Reset is surgical per breakpoint** (mirrors per-state reset): a Footer
  `resetScope` clears only the active breakpoint's cell; session-wide `resetAll`
  spans every breakpoint. Per **ADR-0004**, neither touches **mode** overrides.
- **Model only.** A non-base-breakpoint override is *tracked* (keyed, diffed,
  undone, reset) but not live-rendered: the state `<style>` tag and class rules
  stay base-only, and the commit path drops breakpoint-tagged changes so they
  are never mis-written as un-mediated base styles. Live render + `@media` save
  are #35.

## Consequences

- The model supports `:hover` AT `≥768px` as a genuine combination — a flat arm
  never could — so #35 builds the UI/preview/save on a model that already
  composes, instead of reworking the target union.
- One predicate (`isInlineWritable`) now governs every "is this key live inline?"
  decision across apply/undo/redo/diff/reset/persistence, removing a class of
  breakpoint-blind bugs the old `::` check would have introduced.
- Until #35, a breakpoint override has **no live visual effect and no save path**
  — it is inert except in the model. This is an accepted, temporary gap; the
  commit-path filter makes the gap *safe* (no silent base-style corruption).
- Locked by `src/overlay/__tests__/breakpointDimension.test.ts` (engine + key
  helpers): independent keying/diffing, state composition, surgical reset,
  `resetAll` spanning breakpoints, and ADR-0004 mode-survival at this dimension.

## Alternatives considered

- **A fifth `{ scope: "breakpoint" }` arm.** Rejected: it cannot express a
  breakpoint *combined with* state or class, so #35's cascading breakpoints would
  force a target-union rework. A composition dimension is the smaller, more
  durable change.
- **Model + live preview now.** Rejected for this increment: correct breakpoint
  preview means resizing a responsive canvas (Webflow's responsive view), which
  is the substance of #35. Increment C generalizes the model first.
- **A separate breakpoint override map** parallel to the inline map. Rejected: it
  would re-introduce the multi-map / multi-undo-stack problem RFC #14 exists to
  remove. One composite-keyed map keeps diff/undo/reset/persistence unified.

## Related

- RFC #14 (Unified Style Engine), Increment C — `src/overlay/core/engine.ts`
  (`OverrideTarget`, `ScopeContext`, `resolveTarget`, `apply`, `resetScope`) and
  `src/overlay/core/apply.ts` (`compositeKey`/`parseKey`/`isInlineWritable`,
  `resetElementBreakpoint`).
- ADR-0004 — mode overrides are a separate reset dimension (upheld here at the
  breakpoint dimension).
- `CONTEXT.md` — `Breakpoint`, `Override target`, `Mode override`.
- Issue #35 — "Breakpoint Studio": the breakpoint UI, media-gated live preview,
  and `@media` file-write path that consume this model.
