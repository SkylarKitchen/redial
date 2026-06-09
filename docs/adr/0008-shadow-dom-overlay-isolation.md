# ADR-0008: Shadow DOM (not iframe) for overlay isolation

**Status:** Proposed — decision-ready draft awaiting maintainer sign-off (issue #30)
**Date:** 2026-06-09

## Context

The panel renders into the host page's light DOM (`.__tuner-root`, deferred per
ADR-0001). Host CSS bleeds into panel nodes, and the published stylesheet's
global `@import "tailwindcss"` (`src/styles/globals.css:1`, with
`important: true` in `tailwind.config.ts:4`) leaks into the host page. Issue
#30 calls isolation the single biggest architectural improvement for live-site
reliability, blocked on one decision: **Shadow DOM root or iframe**.

This ADR records a codebase inventory of every surface the boundary touches,
and recommends Shadow DOM.

## Evidence (full sweep, 2026-06-09)

| Surface | Count | Under Shadow DOM | Under iframe |
|---|---|---|---|
| `createPortal(…, document.body)` sites | 24 (22 files) | Retarget to a container inside the shadow root — mechanical | All `position: fixed` + `getBoundingClientRect` math crosses documents/viewports — rework |
| `document.addEventListener` sites (mostly capture-phase mousedown/keydown/click) | ~50 | Events still reach the host document; `event.target` is retargeted to the shadow host — fix centrally with `composedPath()` | Split across two documents; click-outside, hotkey suppression, and `isInsideTunerUI` break wholesale |
| `instanceof` DOM/CSSOM checks (13× `CSSStyleRule`, 8× `HTMLElement`, …) | 25 | Same realm — unaffected | Cross-realm constructors — every check is wrong |
| `getComputedStyle` call sites (mostly against host elements: infer, apply, scope, variables) | ~60 | Same document — unaffected | Must hold the host `window` reference everywhere |
| Styling of panel components | 915 inline `style={{}}` vs 121 `className` | Inline styles are boundary-immune; only `globals.css` + 8 runtime `<style>` injections need relocation | Same relocation, plus a second document to bootstrap |
| Tests locking the portal/event contract | ~20 files | Updated in place (target node + retargeting) | Largely rewritten |

Two architecture facts sharpen the choice:

1. **The overlay is not just a panel.** Selection mode, the selected-element
   outline, and the spacing/flex/grid guides (`Selector.tsx`,
   `FlexGapOverlay.tsx`, `GridOverlay.tsx`) capture host-page pointer events
   and draw over host elements. A full-viewport iframe either intercepts those
   events (breaking selection) or is `pointer-events: none` (breaking the
   panel). Solving that requires dynamic hit-testing forwarding — the most
   fragile kind of code this project could own.
2. **The overlay already dropped Radix.** `noShadcnInOverlay.test.ts` asserts
   no overlay file imports `components/ui`, so there is no third-party portal
   library that must cooperate with the boundary. All 24 portals are
   first-party and share hooks (`usePortalDropdown`, `useClickOutside`) where
   retargeting can be fixed once.

## Decision (recommended)

Render the overlay inside a **Shadow DOM root** (`mode: "open"`) attached to a
single host element; reject the iframe approach.

Implementation outline:

1. **Mount.** `Overlay.tsx` attaches a shadow root to `.__tuner-root`; the
   React root renders inside it. React ≥17 event delegation attaches at the
   root container, so synthetic events keep working.
2. **Portals.** Replace all 24 `createPortal(…, document.body)` targets with a
   `usePortalTarget()` hook returning a fixed-position container *inside* the
   shadow root (keeps `zIndex.max` 2147483647 and the `data-tuner-portal`
   tag). `position: fixed` stays viewport-relative as long as no shadow
   ancestor creates a containing block (no transform/filter on the host
   element — lock with a test).
3. **Ownership checks.** `isInsideTunerUI` (`util.ts:215`) and the independent
   `closest("[data-tuner-portal]")` checks (`useOverlayHotkeys.ts:263`,
   `navigatorFilter.ts:53`, `GridSettingsPopup.tsx:501`) switch to
   `event.composedPath()` / shadow-host awareness. Document-level listeners
   keep working because composed UI events cross open shadow boundaries.
4. **Styles.** Panel styles move into the shadow root via
   `adoptedStyleSheets` (fallback: a `<style>` element). The published
   `globals.css` drops the *global* Tailwind import for panel chrome — this is
   what fixes the leak-out direction. Add a `:host` defensive reset
   (inherited properties: font, color, line-height, direction) for the
   bleed-in direction; inline styles already cover non-inherited properties.
5. **What stays in the host document** (must not move): the four host-page
   style injections (`breakpointPreview.ts`, `statePreview.ts`,
   `modeOverrides.ts`, `scope.ts`), the Next.js dev-overlay z-index fix
   (`useInjectedStyles.ts:26`), selection/guide overlays, and every
   `getComputedStyle`/CSSOM read — inference and persistence keep operating on
   the host page by design. `WebflowPanel.tsx:89` and `BezierEditor.tsx:42`
   keyframe/focus injections move *into* the shadow root.

## Why not iframe

True isolation (no inherited-property bleed, no retargeting) does not pay for:
cross-document portal coordinate math (24 sites), split event delivery (~50
listeners; backtick hotkey and Escape handling would need bidirectional
forwarding), 25 broken cross-realm `instanceof` checks (13 of them
`CSSStyleRule` in the inference/commit path), the selection-mode hit-testing
problem above, and a second document lifecycle (font loading, focus
management, devtools friction). The one thing iframe buys over Shadow DOM —
immunity to inherited properties — the `:host` reset achieves at a fraction of
the cost.

## Consequences

- Host CSS (resets, Tailwind preflight, opinionated `*`/`button` rules) cannot
  restyle the panel; the published package stops mutating host styling.
- ~20 portal/event test files updated; new locks needed for: `:host` reset
  coverage, composedPath ownership, no-containing-block on the shadow host.
- Acceptance per issue #30: manual verification in ≥2 real host apps with
  aggressive global CSS, all popovers/selection/drag/undo/save flows, and a
  cross-browser smoke (Chromium + one other). No geometric oracle — human eyes
  required before close.
- Effort stays XL, but risk concentrates in two mechanical sweeps (portal
  target, composedPath) plus one style-delivery change, instead of iframe's
  distributed rewrites.

## Alternatives considered

- **iframe** — rejected above.
- **Status quo + documentation** — rejected: live-site reliability is the
  stated post-v1 priority and host-CSS collisions are unbounded.
- **CSS-only hardening (`all: revert` per component, no boundary)** — rejected:
  fixes bleed-in only at every node, does nothing for leak-out, and fights
  `important: true` Tailwind output indefinitely.

## Related

- Issue #30 (agent brief with acceptance criteria), ADR-0001 (deferral),
  ADR-0002 (browser-mode visual tests — the verification vehicle),
  `webflow-style-panel-spec.md`.
