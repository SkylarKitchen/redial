# ADR-0002: Visual/layout regression tests run in browser mode, not happy-dom

**Status:** Accepted
**Date:** 2026-05-31

## Context

The next quality push targets **measurable visual bugs** (see `CONTEXT.md`) — Panel
overflow, popover/dropdown clipping, off-viewport drift, z-index stacking. These are
exactly the QA_CHECKLIST "Overflow" and "Panel Container" scopes that ship unchecked.

The detection oracle for these is geometric: assertions over `getBoundingClientRect()`,
`scrollWidth` vs `clientWidth`, and viewport bounds. The existing suite (~2,937 tests
across 146 files) runs in **happy-dom**, which has **no layout engine** — those APIs
return zeros, so a geometric assertion is not merely flaky there, it is impossible.
Real layout requires a real browser.

## Decision

Geometric visual regression tests run in **Vitest browser mode**
(`@vitest/browser` + a Playwright/Chromium provider), as a distinct project from the
happy-dom unit suite. They are wired into `npm test` so a green run proves the Panel and
its surfaces don't overflow/clip/escape the viewport across the swept states.

The happy-dom unit suite stays as-is for logic/wiring tests. The two environments
coexist; tests are routed by what they assert (DOM logic → happy-dom; layout geometry
→ browser).

## Consequences

**Accepted costs:**

- Two test environments to understand and maintain.
- New dev dependencies (`@vitest/browser`, Playwright + a browser binary); CI must
  install the browser.
- Browser-mode tests are slower than happy-dom and may need their own run lane.

**What this enables:**

- Layout assertions that are *impossible* in happy-dom become routine.
- Every measurable visual bug found by the sweep converts into a permanent regression
  test, finally giving the unchecked QA_CHECKLIST visual scopes a net.
- Matches the repo's bug protocol: reproduce-as-failing-test, then fix to green.

## Alternatives considered

- **Ad-hoc `preview_eval` sweep, no committed tests.** Fast to start, but findings don't
  become a permanent regression net — "fixed" can silently regress. Rejected as the
  primary home; still fine as the *discovery* driver that feeds tests.
- **Keep everything in happy-dom.** Impossible: no layout engine, geometric assertions
  return zeros.
- **jsdom instead of a real browser.** Same defect as happy-dom — no real layout.

## Related

- `CONTEXT.md` — `Measurable visual bug`, `Aesthetic visual bug`, `Panel`.
- `QA_CHECKLIST.md` — "Overflow" / "Panel Container" scopes this net finally covers.
- ADR-0001 — its "no new infra before v1" freeze does not bind here; v1.0 already shipped.
