# ADR-0002: Visual/layout regression tests run in a real browser (Playwright e2e), not happy-dom

**Status:** Accepted
**Date:** 2026-05-31 (revised 2026-06-01)

> **Revision note (2026-06-01).** This ADR originally specified *Vitest browser
> mode* (`@vitest/browser` + Playwright provider) mounting components in
> isolation. Implementation surfaced two facts that changed the mechanism (not
> the principle):
>
> 1. **Tailwind faithfulness.** Redial's measurable bugs depend on Tailwind
>    utility classes (e.g. `IconButtonGroup`'s `min-w-7`) and on the *composed*
>    panel (all three surfaces + their CSS). A component mounted in isolation
>    doesn't get the app's compiled Tailwind or the real composition, so it
>    can't faithfully reproduce layout. Testing against the running dev server
>    does.
> 2. **The oracle needs the real render.** Early sweeps produced false positives
>    (an `overflow:visible` inner column read as a 12px "overflow"; a breadcrumb
>    clipped by an `overflow:auto` ancestor read as a "spill"). Only measuring
>    the live, fully-styled panel let us calibrate the oracle to *visible*
>    defects.
>
> The decision below is therefore **Playwright e2e against the dev server**.

## Context

The next quality push targets **measurable visual bugs** (see `CONTEXT.md`) —
panel/popover off-viewport drift, content hard-cut at the panel edge, surfaces
escaping the viewport. These are the QA_CHECKLIST "Overflow" / "Panel Container"
scopes that ship unchecked.

The detection oracle is geometric: assertions over `getBoundingClientRect()`,
`scrollWidth` vs `clientWidth`, and viewport bounds, with awareness of which
ancestors clip. The existing unit suite (~2,900 tests) runs in **happy-dom**,
which has **no layout engine** — those APIs return zeros, so a geometric
assertion is not merely flaky there, it is impossible. Real layout requires a
real browser **and** the app's real CSS.

## Decision

Geometric visual-regression tests run as **Playwright e2e against the test-app
`/demo` page** (`tests/visual/`, config `playwright.config.ts`). They drive the
real, Tailwind-styled, fully-composed panel and run the in-page sweep in
`tests/visual/sweep.ts`. The happy-dom unit suite stays as-is for logic/wiring.

Local runs on macOS go through an **Orbstack/Docker Linux sandbox**, because the
host's binary-authorization (Santa) `SIGKILL`s a locally-spawned Chromium. The
sandbox mounts the repo (pure-JS `@playwright/test` runner) and uses the image's
Linux browsers, driving the dev server on the host via `host.docker.internal`
(`npm run test:visual`). CI (Linux, no Santa) runs Playwright directly and lets
it start the dev server (`npm run test:visual:ci`). See `tests/visual/README.md`.

## Consequences

**Accepted costs:**

- A real browser + the dev server must be available during the run (the standard
  e2e tradeoff). On macOS this means the Orbstack sandbox.
- New dev dependency (`@playwright/test`); the Docker image tag must track its
  version.
- e2e is slower than unit tests and lives in its own lane (`test:visual`), not
  `npm test`.

**What this enables:**

- Layout assertions that are *impossible* in happy-dom become routine, against
  the **real** composed panel with real Tailwind.
- The sweep is extensible: adding a driven state (archetype, sub-editor, viewport
  size) to `tests/visual/` means it is checked on every run — the "command
  Claude to find them" net.
- The oracle, calibrated on the live render, flags only *visible* defects and
  ignores intentional containment (panel edge-clip, scroll regions, ellipsis).

## Alternatives considered

- **Vitest browser mode, components in isolation** (the original decision).
  Rejected on implementation: no compiled Tailwind and no real composition, so it
  can't faithfully reproduce the panel's layout; the full-panel sweep is awkward
  in isolation.
- **Ad-hoc `preview_eval` sweep, no committed tests.** Great for *discovery*
  (it's how this oracle was developed), but findings don't become a permanent
  regression net. Kept as the discovery driver; the committed home is Playwright.
- **Keep everything in happy-dom / use jsdom.** Impossible: no layout engine,
  geometric assertions return zeros.

## Related

- `CONTEXT.md` — `Measurable visual bug`, `Aesthetic visual bug`, `Panel`.
- `tests/visual/` — the sweep, specs, and run instructions.
- `QA_CHECKLIST.md` — "Overflow" / "Panel Container" scopes this net covers.
- ADR-0001 — its "no new infra before v1" freeze does not bind here; v1.0 shipped.
