# ADR-0007: Adopt cascade-provenance style indicators

**Status:** Accepted (2026-06-09), implemented (2026-06-09, commit `fd05edb`) — supersedes the blue/green-only simplification (commit `c5e7adb`, 2026-03-13)

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
| Amber | Changed this session (orthogonal cue, kept — see resolution below) | `modified` |
| — | Browser default / unset | `none` |

**Detection** (`getIndicatorType`): compare the element's computed value to its
parent's computed value and to authored rules (`getAuthoredValue` already locates
matching rules). Element scope → all overrides render pink; class scope → rules
on the active class render blue, ancestor-sourced render orange.

**Sub-question — resolved during implementation (2026-06-09):** provenance and
"changed-this-session" are orthogonal signals, and the session cue is **kept as a
sixth union member** rather than an outline: `modified` renders a distinct amber
dot (`color.warning`) and takes priority in the resolver, so a property reads
`modified` exactly when it is dirty this session. Resolver priority is
`state → modified → element-inline → authored-here → inherited → none` —
provenance therefore surfaces only on properties *not* edited this session. This
keeps the precondition the existing reset affordances gate on
(`indicator === "modified"`), so the "I edited this" cue is never lost and the
~12 components that synthesise `modified` from a local boolean need no churn.

## Consequences

- `IndicatorType` widens from 3 to 6 members (the 5 provenance variants above
  plus the retained `modified` session cue); `tsc` exhaustiveness flags every
  consumer that must handle the new variants (~65 call-sites across
  sections/controls/overlays).
- Two new design tokens needed in `theme.ts` (`indicatorOrange` — may reuse
  `gridOrange`; `indicatorPink`). No hardcoded hex in components (lint rule).
- `getIndicatorType` gains real cascade analysis (computed-vs-parent comparison),
  not just an `isDirty` lookup.
- `styleIndicators.test.ts` is rewritten to lock provenance classification
  (it already sketches the inherited/authored-here/element-inline cases).
- Requires browser visual verification (no geometric oracle) before #46 closes.

This work is **implemented** (resolver, tokens, consumer sweep, and rewritten
`styleIndicators.test.ts` landed in commit `fd05edb`; ADR resolution and
showcase sync followed). Browser visual verification of the rendered palette
ran against `/showcase` and `/demo`; colour tuning remains a one-line token
swap in `theme.ts` if the maintainer wants to adjust amber/pink/orange.
