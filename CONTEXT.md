# Redial Glossary

Canonical vocabulary for Redial. Terms are resolved here when they get sharpened in design conversations. Implementation details belong in code or ADRs, not here.

---

## must-ship

An item required to release **v1.0**. An item qualifies if it meets at least one of:

- **first-run breakage** — a fresh `npm install github:SkylarKitchen/redial` user hits it within their first ten minutes of use,
- **correctness or security bug** — produces wrong output, corrupts a source file, or has a real security impact,
- **public embarrassment** — visibly broken to anyone reading the repo (broken README example, dead reference in the showcase, contradictory docs).

An item does **not** qualify as `must-ship` solely on the basis of:

- performance,
- architecture or refactoring (e.g. shadcn removal, Shadow DOM isolation, file decomposition),
- test-coverage gaps that don't hide a known bug,
- polish, token consistency, or focus-ring uniformity,
- "better UX" smoothing of already-working flows.

Everything that fails the rubric is either `nice-to-have` (kept) or `wontfix` (rejected) — see those terms.

## nice-to-have

A backlog item we want to keep but defer past v1.0. Lives as an **open GitHub Issue** carrying the `nice-to-have` and `post-v1` labels, with a state label from the canonical triage vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`). Does not live in an in-repo `.md` backlog. Milestones are not used for the v1 boundary — labels are the canonical cohort primitive here.

## wontfix

A backlog item we have considered and decided not to do. Two dispositions:

- **filed and closed with `wontfix`** — used when the decision has signal value (someone is likely to raise it again, or the rationale is non-obvious). Provides a searchable paper trail.
- **deleted outright** — used when the item has no future signal value (e.g. items that were polish-only and already obsolete). Git history is sufficient record.

The choice between the two is per-item judgment, not a category rule.

## Panel

The floating Webflow-style tuning surface Redial injects into the host page. It is **not** centered, blocking, or backdropped.
_Avoid_: modal, dialog, modal window — these imply a centered blocking overlay Redial does not have. When someone says "the modal," they mean the **Panel**.

## Measurable visual bug

A visual defect computable from geometry alone, with an **automatic oracle** (a `getBoundingClientRect()` / `scrollWidth` assertion), so it can be caught autonomously and locked with a regression test. The calibrated oracle lives in [`tests/visual/sweep.ts`](tests/visual/sweep.ts) and flags exactly three things:

- **surface-offviewport** — a panel/popover whose rect escapes the viewport,
- **h-spill** — a descendant pokes out past its surface *with no clipping ancestor in between* (truly sticks out),
- **h-content-clipped** — content hard-cut by `overflow-x:hidden` with no ellipsis affordance.

Crucial calibration (learned the hard way — naive checks over-flag): a raw `scrollWidth > clientWidth` is **not** a bug when it is *intentional containment* — `overflow:visible` content that stays within the surface, the style-panel root's own `overflow-x:hidden` edge clip, `overflow:auto/scroll` scroll regions (the breadcrumb), `text-overflow:ellipsis` truncation (variable pills), or the 1px screen-reader-only clip. An inner element overflowing its own box is only a *visible* defect if it escapes the surface unclipped.
_Avoid_: conflating with **aesthetic visual bug**.

## Aesthetic visual bug

A visual defect that geometry can't decide — misalignment, inconsistent spacing, "looks wrong." Cannot be reduced to a passing/failing assertion, so it follows a review-and-ratify flow, not the test-then-fix loop.

Its oracle, in priority order:
1. **The live Webflow Designer** (canonical for *structure, ordering, control patterns, interaction*). Note a deliberate divergence: Webflow's panel is **dark-charcoal**, but Redial is **intentionally light** (`theme.ts` `background:"#FFFFFF"`). "Follow Webflow UI/UX" therefore means structural/interaction fidelity — **not** the dark color scheme — unless the user decides otherwise.
2. The user's own recorded decisions (memory / GitHub issues) where they revise Webflow — these **override** the spec.
3. [`webflow-style-panel-spec.md`](webflow-style-panel-spec.md) — useful for *section ordering and control structure* (verified to match live Webflow), but **stale on**: §1 Panel Shell (prescribes dark `#1e1e1e`; Redial is now light) and §11 Style Indicators (prescribes blue/orange/green/pink; later cut to blue/green-only, orange/pink reopened in issue #46). Do not treat §1 or §11 as authoritative.

## Ship Blocker

> ⚠️ **Deprecated.** Pre-dates the `must-ship` rubric. `AUDIT_BACKLOG.md` uses this label under an older, fuzzier definition that conflated architectural improvements with release-gating bugs. When reading existing docs, treat the "Ship Blocker" label as a *suggestion to re-triage under the current rubric*, not as evidence the item gates v1.0.

---

## Flagged ambiguities

- **"modal"** was used to mean the floating tuning surface — resolved: the canonical term is **Panel**. Redial has no modal (nothing centered, blocking, or backdropped).
- **"visual bug"** was used for two different things — resolved into **measurable visual bug** (geometric, auto-oracle, test-locked) vs **aesthetic visual bug** (judgment against Webflow, review-ratified).
