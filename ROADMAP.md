# Redial Roadmap (post-v1)

v1.0 is shipped and tagged. Every item below is **post-v1** and **non-launch-blocking**
— confirmed by a launch-readiness pass (2026-06-09) that found **0 launch-blocking
issues** and **0 ready-for-agent work** remaining. The library passes typecheck, lint,
the full test suite (3746 tests), and the production build.

Each entry lists the GitHub issue, rough effort (S/M/L/XL), risk, and the **blocking
decision** that must be made by a human before implementation can start. Nothing here
should be picked up "cold" by an autonomous agent — they all need a product/design call
or interactive exploration first.

> **This file is the source of truth.** The linked GitHub issues are **closed** to keep
> the v1.0 launch tracker clean; the issue history (full agent briefs, triage notes) is
> preserved and each will be **reopened when work begins**. Nothing was abandoned.

## Decided — ready to build

| # | Title | Effort | Risk | Status |
|---|-------|--------|------|--------|
| [#46](https://github.com/SkylarKitchen/redial/issues/46) | Cascade-provenance style indicators | L | med | **Decided 2026-06-09** ([ADR-0007](docs/adr/0007-cascade-provenance-style-indicators.md)): adopt Webflow-style provenance (blue=authored-here / orange=inherited / pink=element-inline / green=state), superseding the blue/green-only model. Full build spec on the issue; `ready-for-agent`. Needs browser visual QA before close. |

## Architectural (need a design decision + ADR before work)

| # | Title | Effort | Risk | Blocking decision |
|---|-------|--------|------|-------------------|
| [#14](https://github.com/SkylarKitchen/redial/issues/14) | Unified Style Engine (RFC, Phase 4 + Item C) | XL | high | Phase 1 facade is live. Phase 4 rewrites the temporal undo/redo core (issue forbids unattended work). Item C is **done**: recorded as [ADR-0005](docs/adr/0005-breakpoint-is-a-composition-dimension.md) (accepted 2026-06-03) and implemented (`compositeKey`/`isInlineWritable` in `apply.ts`, locked by `breakpointDimension.test.ts`). |
| [#30](https://github.com/SkylarKitchen/redial/issues/30) | Shadow DOM / iframe isolation | XL | high | Decision-ready draft: [ADR-0008](docs/adr/0008-shadow-dom-overlay-isolation.md) (Proposed) recommends **Shadow DOM** from a full inventory (24 portal sites, ~50 document listeners, 25 cross-realm `instanceof` checks). Awaiting maintainer sign-off; payoff still only verifiable by manual integration testing. |
| [#31](https://github.com/SkylarKitchen/redial/issues/31) | CSP compatibility (no runtime `<style>` injection under strict CSP) | M | med | Decision-ready draft: [ADR-0009](docs/adr/0009-csp-constructable-stylesheets.md) (Proposed) recommends a fourth path — constructable stylesheets via a single `managedSheet` helper (8 injection sites; CSSOM writes turn out CSP-exempt, so inline styles need no change). Awaiting maintainer sign-off. |
| [#36](https://github.com/SkylarKitchen/redial/issues/36) | Commit-pipeline robustness (SCSS vars, `calc()`, mixed colors) | XL | med | Current pipeline already refuses/escapes these safely. SCSS-AST strategy + dry-run response shape need specs. |
| [#37](https://github.com/SkylarKitchen/redial/issues/37) | Pseudo-element support (`::before`/`::after`/`::placeholder`) | XL | high | 5 open design questions (no live preview path for generated content). |

## Features (need scope/design clarity)

| # | Title | Effort | Risk | Blocking decision |
|---|-------|--------|------|-------------------|
| [#38](https://github.com/SkylarKitchen/redial/issues/38) | Multi-element selection (Shift-add, apply to all) | XL | med | 7 open design questions (mixed-state display, scoping, undo granularity, heterogeneous elements). |
| [#40](https://github.com/SkylarKitchen/redial/issues/40) | Tailwind v4 awareness (CSS-first config) | M | med | 5 product questions; would intentionally rewrite ~150 snapshot tests. Output is already v4-leaning. |
| [#39](https://github.com/SkylarKitchen/redial/issues/39) | Visual grid-track editor (beyond text input) | M | low | Define the editor UX (drag handles vs numeric cells) before building. |
| [#34](https://github.com/SkylarKitchen/redial/issues/34) | Authored-value round-tripping (preserve `var()` on save) | M | low | Largely works today; needs an edge-case spec + regression tests locked. |
| [#26](https://github.com/SkylarKitchen/redial/issues/26) | Code-splitting / lazy-load boundary | M | low | Marginal benefit for a dev-only tool; consumers can already `dynamic(..., { ssr:false })`. Decide if worth a separate entry point. |
| [#53](https://github.com/SkylarKitchen/redial/issues/53) | Breakpoint `@media` + mode overrides: file-save path | M | med | Decision-ready draft: [ADR-0010](docs/adr/0010-media-and-mode-file-save-strategy.md) (Proposed) specs the write strategy — media-aware commit tier (merge/insert/create-at-EOF), selector-scoped mode targeting (fuzzy tier forbidden), Tailwind variant prefixes (`md:`), round-trip read fixes. Also flags a latent bug: state edits on Tailwind elements save unprefixed. Awaiting maintainer sign-off. |

## Design / product decisions (the maintainer's call)

| # | Title | Effort | Risk | Decision needed |
|---|-------|--------|------|-----------------|
| [#32](https://github.com/SkylarKitchen/redial/issues/32) | Configurable keyboard shortcuts (stop hijacking Cmd+S/C/Z/F/K) | M | med | API shape (`disabledShortcuts` vs `keyboardConfig`). Hotkey handler is a sensitive seam. |
| [#33](https://github.com/SkylarKitchen/redial/issues/33) | Dark-mode token set in `theme.ts` | L | med | Amend ADR-0003 (light-only is currently deliberate); pick detection strategy; source dark tokens from the design system. |

## Discovery / QA

| # | Title | Effort | Risk | Notes |
|---|-------|--------|------|-------|
| [#51](https://github.com/SkylarKitchen/redial/issues/51) | Round-2 outlier hunt: real-browser surfaces happy-dom can't reach | L | med | Interactive Playwright/Orbstack exploration across 7 surfaces, then per-finding M fixes with regression tests. Round 1 fixed ~23 bugs. |

---

_Generated from the 2026-06-09 launch-readiness assessment. Closed during that pass:
#25 (shadcn removal), #27 (overlay hotkey decomposition), #35 (breakpoint awareness),
#43 (className-walk perf). Five verification regressions on recently-shipped fixes
(#22, #29, #48, #49, #50) were fixed test-first in commit `49dfdc6`._
