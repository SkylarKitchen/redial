# ADR-0007: Adopt cascade-provenance style indicators

**Status:** Accepted (2026-06-09) — supersedes the blue/green-only simplification (commit `c5e7adb`, 2026-03-13)

## Context

The style-panel label dots originally promised four cascade colors
(`webflow-style-panel-spec.md` §11) but were simplified on 2026-03-13 to a
single "modified this session" model: `IndicatorType = "modified" | "state" |
"none"` (blue dot = edited this session, green = state-specific edit, no dot
otherwise). That decision optimized for "did *I* change this?".

Issue [#46](https://github.com/SkylarKitchen/redial/issues/46) reopened the
question: Webflow's Designer shows **cascade provenance** — where a value comes
from — not session-dirtiness. The maintainer chose to adopt provenance for
fidelity (2026-06-09 launch-readiness decision).

## Decision

Adopt cascade-provenance indicators per spec §11:

| Color | Meaning | `IndicatorType` |
|-------|---------|-----------------|
| Blue | Authored directly on the selected element's own class rule | `authored-here` |
| Orange | Inherited / cascaded from a parent or base class | `inherited` |
| Pink | Element-scope (inline) override | `element-inline` |
| Green | Pseudo-state-specific style (unchanged) | `state` |
| — | Browser default / unset | `none` |

**Detection** (`getIndicatorType`): compare the element's computed value to its
parent's computed value and to authored rules (`getAuthoredValue` already locates
matching rules). Element scope → all overrides render pink; class scope → rules
on the active class render blue, ancestor-sourced render orange.

**Resolved sub-question (2026-06-09 implementation):** provenance and
"changed-this-session" are orthogonal, so the session cue is kept as a **sixth
`IndicatorType` member, `"modified"`**, with its own distinct colour
(`color.warning` amber, visibly different from the blue `authored-here`) rather
than an outline. The resolver applies a **priority order** —
`state → modified (isDirty) → element-inline → authored-here → inherited → none`
— so a property reads as `"modified"` exactly when it is dirty, which is the
precondition the existing reset affordances already gate on (`indicator ===
"modified"`). Provenance therefore surfaces only on properties not edited this
session, the "I edited this" cue is never lost, and no consumer churn was needed
(the ~12 components that synthesise `"modified"` from a local dirty/set boolean
keep working unchanged). Final union is 6 members, not 5.

## Consequences

- `IndicatorType` widens from 3 to 5 members; `tsc` exhaustiveness flags every
  consumer that must handle the new variants (~65 call-sites across
  sections/controls/overlays).
- Two new design tokens needed in `theme.ts` (`indicatorOrange` — may reuse
  `gridOrange`; `indicatorPink`). No hardcoded hex in components (lint rule).
- `getIndicatorType` gains real cascade analysis (computed-vs-parent comparison),
  not just an `isDirty` lookup.
- `styleIndicators.test.ts` is rewritten to lock provenance classification
  (it already sketches the inherited/authored-here/element-inline cases).
- Requires browser visual verification (no geometric oracle) before #46 closes.

This work is **decided and ready to build** but remains tracked (not launch-
blocking): v1.0 is shipped, and the indicator overhaul is a deliberate,
visually-iterated effort rather than a launch-moment change.
