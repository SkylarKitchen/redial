# ADR-0011: Overrides record their provenance at apply time; save targeting never derives from the save-time scoping context

**Status:** Accepted
**Date:** 2026-07-15

## Context

An **override** (see `CONTEXT.md`) used to be stored as a bare
`{ initial, current }` per `(breakpoint, state, property)` cell — the store
did not record *which override target the edit was applied under*. The
element-vs-class dimension was therefore reconstructed **at save time** from
the panel's scoping context, and every save surface reconstructed it
differently:

- **Footer save** (Save button, Cmd+S, palette) stamped the *current* toggle
  onto every diff via an `elementScopeSave: true` opt-in — so editing in
  class scope, flipping the toggle to element, and hitting Cmd+S rerouted
  the class edit into a JSX `style` write.
- **ChangesDrawer "Save All"** had no per-element context at all, so it
  hardcoded a placeholder element context *without* the opt-in and always
  took legacy class-rule targeting.

The same edit could land in a **different file depending on which button
saved it** (documented at the time in `commitUtils.ts`), and the
client-side enrichment needed a scoping-context parameter whose subtle
contract (`elementScopeSave` "only surfaces that KNOW the user's scope
choice") existed purely to paper over the missing record. A second live
defect fell out of the same gap: the drawer picked the request `mode` via
`enriched.find(...)`, so one Tailwind element in a mixed Save All sent every
CSS change to the Tailwind handler.

## Decision

**1. Provenance is recorded at apply time.** `applyInlineStyle` stores the
class an edit was applied under on the override (`Override.className`;
absent = element provenance), `DiffEntry` carries it out of `diff()`, and
`resolveTarget` freezes the active class onto pseudo-state targets so a
`.class:hover` edit remembers its class. Session persistence round-trips
the record; pre-provenance payloads restore as **element** (an inline
override *is* element-shaped).

**2. Provenance lives in the value, not the key.** One override per
`(breakpoint, state, property)` cell; a later edit to the same cell under a
different target **replaces** the record (last write wins). This preserves
today's store shape, undo grouping, reset semantics, and persistence format.

**3. Save targeting derives from the recorded provenance, never from the
scoping context at save time.** `enrichChangesForCommit(element, changes)`
lost its scoping-context parameter entirely; the `elementScopeSave` flag is
deleted. The panel's toggle describes the *next* edit, not the recorded ones
(see the `CONTEXT.md` Override entry).

**4. One save pipeline.** `core/save.ts` owns enrichment, the
file-vs-clipboard partition, per-mode transport (mixed batches POST css and
tailwind separately), the no-endpoint/unreachable clipboard fallbacks, and
post-save breakpoint reconciliation — behind
`save(entries) → SaveOutcome`, with an injectable transport
(`__setTransportForTests`) whose second adapter drives the real server
handlers in the round-trip suite.

## Alternatives considered

- **Provenance in the key** — `(breakpoint, state, scope, property)` so an
  element edit and a class edit to the same property coexist and both save.
  Fully consistent with ADR-0005's composition model and it closes the
  residual gap below, but it reshapes keying, undo grouping, reset
  semantics, session format, and preview in one move — a second
  architecture project riding a save fix. Deferred until the gap earns it.
- **Fix Save All only, keep save-time contexts** — aggregate surfaces
  fundamentally lack a per-edit context (an element edited under both
  scopes is inexpressible), so the divergence would have survived inside
  the new module.

## Consequences

- Every save surface resolves the same edit to the same file; the
  Footer/Save-All divergence class is structurally dead, and mixed-target
  batches (element + class edits on one element) became expressible.
- **Accepted residual gap (last-write-wins):** editing the *same property*
  under a class and then under element scope (or vice versa) keeps only the
  later record — the earlier edit still previews live (the class rule
  remains injected) but is absent from the diff, exactly as before this
  ADR. The in-key alternative is the future fix.
- **Behavior change:** saves honor the scope each edit was *made* under.
  Re-toggling the panel before saving no longer reroutes older edits.
- The engine's `diffState` reads the override store's mirror (state-stamped,
  breakpoint-aware, provenance-carrying) instead of statePreview's render
  map, whose `initial` was unreadable (`""`) and which never knew about
  breakpoint▸state composites.
- `from` on the wire remains the *computed initial* and the server's
  literal-replacement tiers remain value-matched — an empty `from` produces
  a zero-width match (observed as `redblue` splices in early round-trip
  fixtures). Server-side rejection of empty `from` is a follow-up hardening
  candidate, not part of this change.
