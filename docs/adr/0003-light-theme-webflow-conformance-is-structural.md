# ADR-0003: Redial uses a light theme; Webflow conformance is structural, not chromatic

**Status:** Accepted
**Date:** 2026-06-01

## Context

Redial is a "Webflow-style" CSS panel and an explicit goal is that it should *follow
Webflow's UI/UX*. Webflow's Designer Style panel is **dark charcoal**
(verified live, 2026-06-01). Redial's panel is **light** — `theme.ts` sets
`background: "#FFFFFF"` and the codebase even ships a "Light-theme checkerboard"; the
dark tokens (`#1e1e1e`, `#363636`) are scoped only to the floating toolbar/FAB and
dropdown surfaces.

`webflow-style-panel-spec.md` §1 still prescribes a dark `#1e1e1e` panel — it predates
the light pivot and is stale. The net effect: anyone comparing Redial to Webflow (a
human, or an agent on a visual-bug hunt) is liable to flag the light theme as a bug.
That misread happened in the very session that produced this ADR.

## Decision

Redial's **light theme is deliberate and correct**, consistent with the white/Geist
docs-site aesthetic. "Follow Webflow's UI/UX" means fidelity to Webflow's **structure
and interaction** — section ordering, control types and grouping, layout, spacing, the
signature interactions (label-drag scrub, 3×3 align box, box-model spacing, etc.) — and
**not** its dark color scheme.

Light-vs-dark is therefore **out of scope** for visual-bug hunts: it is not a bug.

## Consequences

- Visual-QA sweeps must not report "panel is light, Webflow is dark" as a finding.
- `webflow-style-panel-spec.md` §1 (and §11) are marked stale in `CONTEXT.md`; the spec
  is a structural reference only.
- Future design tokens stay light-derived; dark surfaces remain scoped to toolbar +
  dropdowns.
- If a 1:1 dark match is ever desired, it is a separate, large initiative (re-derives
  every token across 100+ overlay files), not a bugfix.

## Alternatives considered

- **Flip to Webflow's dark theme.** Rejected: massive rework of every token and
  component, and it abandons the deliberate light/Geist brand choice for no functional
  gain. The user chose to keep light.

## Related

- `CONTEXT.md` — `Aesthetic visual bug` (oracle priority + stale-spec notes).
- `theme.ts` — `background:"#FFFFFF"`, light-theme tokens.
- `webflow-style-panel-spec.md` §1 (stale dark-panel spec).
