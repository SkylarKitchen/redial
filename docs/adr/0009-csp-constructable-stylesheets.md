# ADR-0009: CSP compatibility via constructable stylesheets

**Status:** Proposed — decision-ready draft awaiting maintainer sign-off (issue #31)
**Date:** 2026-06-09

## Context

Issue #31 offers three paths for strict-CSP hosts (`style-src` without
`'unsafe-inline'`): documentation-only (S), nonce threading (M), or migrating
the inline-styled panel to bundled class-based CSS (XL, reverses the
deliberate inline-styled-React house style).

The issue brief's premise overstates the breakage, and correcting it changes
which path wins. What CSP actually governs:

| Mechanism | Used by | Under strict `style-src` |
|---|---|---|
| Injected `<style>` elements | 8 sites (see below) | **Blocked** (unless nonce/hash) |
| `el.style.setProperty()` / `el.style.x =` (CSSOM) | Override engine (`apply.ts`, `"important"` writes) | **Allowed** — CSP does not cover CSSOM property writes |
| React inline `style={{}}` | All ~915 panel chrome styles | **Allowed** — React assigns via CSSOM, not `setAttribute("style")` |
| Bundled `styles.css` loaded by the host app | Published package export | **Allowed** under `style-src 'self'` |
| Constructable stylesheets (`new CSSStyleSheet()` + `adoptedStyleSheets`) | nothing yet | **Allowed** — CSSOM, exempt from `style-src` |

So the panel chrome and live overrides already survive strict CSP. What dies
is everything delivered through the 8 managed `<style>` tags — and four of
those are core features, not chrome:

- `core/scope.ts:266` — class-scope overrides (host page)
- `core/statePreview.ts:67` — pseudo-state preview (host page)
- `core/modeOverrides.ts:61` — mode overrides (host page)
- `breakpointPreview.ts:30` — breakpoint preview (host page)
- `hooks/useInjectedStyles.ts:26,39` — Next.js dev-overlay z-index fix; focus
  rings + outline-pulse keyframes
- `shell/WebflowPanel.tsx:89` — `.tuner-focusable` focus styles
- `sections/BezierEditor.tsx:42` — editor keyframes

All eight share one shape: a lazily created, ID/attribute-tagged `<style>` tag
whose `textContent` is rewritten on update.

## Decision (recommended)

Take a fourth path the issue didn't list: **replace all runtime `<style>`
injection with constructable stylesheets** behind a single helper —

```ts
managedSheet(key: string): { replace(css: string): void; dispose(): void }
```

— backed by `new CSSStyleSheet()` + `replaceSync()` and registered on
`document.adoptedStyleSheets` (or, for panel-owned styles after ADR-0008
lands, the shadow root's `adoptedStyleSheets`). Migrate the 8 sites onto it.

**Contract requirement — append, don't assign.** `adoptedStyleSheets` is
read/write but assigning a fresh array (`doc.adoptedStyleSheets = [mine]`)
clobbers any sheets the host app, another devtool, or even ADR-0008's
shadow root have already adopted. The helper must append its sheet via
`[...adoptedStyleSheets, sheet]` (or the upcoming mutable-array API where
supported) and `dispose()` must remove *only its own* sheet. Same rule for
the shadow root's `adoptedStyleSheets` once 0008 lands.

Why this beats the three listed options:

- **vs documentation-only (S):** strict-CSP hosts would lose class-scope
  editing, state/mode/breakpoint previews, and focus affordances — documented
  breakage of core features is still breakage.
- **vs nonce threading (M):** a nonce needs a new public config surface, host
  wiring, and per-site threading — and buys nothing the constructable-sheet
  path doesn't, since the inline styles a nonce can't cover turn out not to
  need covering. Same effort, worse API surface.
- **vs CSS-file migration (XL):** reverses the house style to fix the one
  mechanism (inline styles) that strict CSP doesn't actually block.

Bonus correctness: adopted sheets sort after all document stylesheets in the
cascade, so the preview/override sheets win against equal-specificity host
rules even when a host sheet loads later — strictly better than the current
head-appended tags.

## Scope of support promised

- Strict-CSP compatibility means `style-src 'self'` (no `'unsafe-inline'`,
  no nonce required) leaves every Redial feature working.
- Requires `Document.adoptedStyleSheets` (Chrome 99+, Firefox 101+,
  Safari 16.4+) — acceptable for a dev-only tool; if unavailable, fall back
  to the current `<style>` injection and document that strict CSP then needs
  a nonce or `'unsafe-inline'`.
- Out of scope (unchanged from the brief): `script-src` and other directives,
  the commit pipeline (server-side, CSP-irrelevant).

## Consequences

- New `managedSheet` helper (likely `src/overlay/core/managedSheet.ts`);
  8 call sites migrated; ~M effort total (down from the S/M/XL fork).
- Limitation: `replaceSync` rejects `@import` rules. The 8 sites here all
  build CSS strings in JS so this is moot for them, but it constrains
  ADR-0008's shadow-root style delivery — that path must feed in the
  postcss-flattened build output, not a source file like `globals.css`
  whose line 1 is `@import "tailwindcss"`. The helper itself should
  surface a clear error when given an `@import`-bearing string rather
  than silently swallowing the throw.
- Tests asserting on managed tags (`getStateStyleTag()` is exported for
  tests; scope/state/mode/breakpoint suites read tag `textContent`) move to
  sheet-based assertions — mechanical.
- README gains a short CSP section stating the support promise above.
- Synergy with ADR-0008: the same helper serves the shadow root's
  `adoptedStyleSheets`, so this work is a prerequisite-shaped step toward
  isolation rather than a parallel track.
- Verification: a test-app route served with
  `Content-Security-Policy: style-src 'self'` (Next `headers()` config),
  exercising selection, previews, class-scope edit, and focus rings in a
  real browser.

## Alternatives considered

Documentation-only, nonce threading, CSS-file migration — each rejected above
with reasons. A hybrid (nonce as *fallback* for browsers without
`adoptedStyleSheets`) is possible later without API changes if demand appears.

## Related

- Issue #31 (agent brief; its acceptance criteria are instantiated by this
  ADR's "Scope of support promised"), ADR-0008 (shared style-delivery helper),
  ADR-0001 (original deferral).
