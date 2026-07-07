# ADR-0010: Configurable keyboard shortcuts (panel-focused default)

**Status:** Proposed — decision-ready draft awaiting maintainer sign-off (issue #32)
**Date:** 2026-06-09

## Context

The overlay's central `useOverlayHotkeys` hook
(`src/overlay/hooks/useOverlayHotkeys.ts:128`) attaches a single
capture-phase `keydown` listener on `document` that intercepts ~20 shortcuts
— including the host-OS staples `Cmd+S`, `Cmd+C`, `Cmd+Z`, `Cmd+Shift+Z`,
`Cmd+K`, and `Cmd+F`. The gate today is `selectedEl && …`, which only checks
"is there a selected element in redial's state" — not "where is keyboard
focus." So once the user has selected any element with the panel, **`Cmd+S`
on a host-page text field stops bubbling to the browser**: the user's host
form, IDE-style host editor, or browser-bound `Cmd+F` is silently stolen for
the duration of the redial session.

Issue #32 calls out the offence directly:

> Global capture-phase listeners steal Cmd+S, Cmd+C, Cmd+Z, Cmd+F, Cmd+K
> from the host app. Add configuration API to disable specific shortcuts,
> or only intercept when panel has focus.

The blocking decision is the **API shape**: do you (a) ship a disable-list,
(b) ship a richer config object, (c) change the default scoping, or some
combination — and what's the minimal public surface that closes the bug
without prematurely growing `TunerConfig`.

This ADR records the surface inventory and recommends a combination of
**a default-behaviour change** (intercept only when the panel has focus) +
**a small additive opt-out list** (`disabledShortcuts`).

## Evidence (full sweep, 2026-06-09)

The overlay's keyboard-listener surface, by category:

| Category | Sites | Steal risk | Gate today |
|---|---|---|---|
| **Global modifier shortcuts** | 9 in `useOverlayHotkeys.ts` | High — collides with host OS / browser / app shortcuts | `selectedEl && …` (no focus check) |
| **Global single-key shortcuts** | 9 in `useOverlayHotkeys.ts` | Medium — collides with host text input ("n", "s", "p", "r", "R", "h", "m", "g", "t", "?") | `selectedEl && !selecting && …` |
| **Selection entry** | 1 (backtick, `:397`) | Low — required global by design (it's the entry point) | None (always global) |
| **Panel-internal navigation** | `useFocusTrap`, `useDropdownKeyboard`, `useListKeyboardNav`, plus ~10 section/control listeners | None — fire only when panel sub-tree is focused | Component-scoped |

The 9 high-risk modifier shortcuts:

| Shortcut | Action | Steals from |
|---|---|---|
| `Cmd+Z` | redial undo | host undo |
| `Cmd+Shift+Z` | redial redo | host redo |
| `Cmd+S` | save changes | host save (every form, IDE, etc.) |
| `Cmd+C` | copy CSS (only if no text selection) | host copy when no text is selected |
| `Cmd+K` | command palette | host command palette (browser address bar, many SaaS apps) |
| `Cmd+F` | property search | browser find |
| `Cmd+Alt+C` | copy styles | rare; low risk |
| `Cmd+Shift+V` | import CSS | rare; low risk |
| `Cmd+Alt+V` | paste styles | rare; low risk |

The 9 single-key shortcuts (`n`, `?`, `s`, `p`, `r`, `R`, `h`, `m`, `g`,
`t`) fire even if the user is typing into a host-page `<input>`, as long as
the redial panel has a selected element. That's a subtler bug — the user is
typing "neighbourhood" into a host form and instead toggles redial's
navigator on `n`.

`TunerConfig` (`src/overlay/core/config.ts:8`) currently has one field:
`commitEndpoint`. It's the only public extension point. Adding shortcut
config to `TunerConfig` (rather than a top-level prop) keeps `<Tuner>`'s
prop surface narrow and reuses the existing forwarding plumbing.

## Decision (recommended)

A two-part change:

### Part 1 — Default behaviour: intercept only when the panel has focus

Replace `selectedEl && …` with `panelHasFocus() && …` for every shortcut in
`useOverlayHotkeys.ts` **except** the backtick (entry-point) and the three
"copy-CSS" handlers that explicitly want to fire from host-element focus
(see exceptions below). `panelHasFocus()` returns `true` when
`document.activeElement` is inside `.__tuner-root` (or, after ADR-0008
lands, when the shadow root's `activeElement` is non-null).

Exceptions — these should still fire when focus is on the host page:

- **`Cmd+S`** when there are pending overrides: saving from host-element
  focus is the common case (you selected, you tuned, you're moving on).
  Gate on `overrideCount(selectedEl) > 0` and let host `Cmd+S` through
  otherwise.
- **`Cmd+C`** when text is not selected: same logic as today
  (`window.getSelection().toString() === ""`). Host `Cmd+C` already wins
  when text is selected; this stays.
- **Backtick** (selection entry): must be global. No change.

Everything else (`Cmd+Z`, `Cmd+Shift+Z`, `Cmd+K`, `Cmd+F`, single-key
shortcuts, `Cmd+Alt+C/V`, `Cmd+Shift+V`) gates on `panelHasFocus()`.

This single change closes the loudest 80% of #32 — the host page gets its
`Cmd+F` / `Cmd+K` / `Cmd+Z` back, single-key shortcuts stop firing while
the user types into host inputs.

### Part 2 — `disabledShortcuts`: additive opt-out

Add to `TunerConfig`:

```ts
export interface TunerConfig {
  commitEndpoint: string;
  /**
   * Shortcut names redial should NOT intercept, even when the panel has
   * focus. Use the canonical names: "cmd+s", "cmd+c", "cmd+z",
   * "cmd+shift+z", "cmd+k", "cmd+f", "cmd+alt+c", "cmd+shift+v",
   * "cmd+alt+v", and the single keys "n", "?", "s", "p", "r", "shift+r",
   * "h", "m", "g", "t". The backtick (selection entry) is always global
   * and not configurable.
   *
   * Useful for hosts that need a specific shortcut back even from
   * inside the panel (e.g. a host-wide `cmd+k` palette the user wants
   * to keep working).
   */
  disabledShortcuts?: ShortcutName[];
}

export type ShortcutName =
  | "cmd+s" | "cmd+c" | "cmd+z" | "cmd+shift+z"
  | "cmd+k" | "cmd+f"
  | "cmd+alt+c" | "cmd+shift+v" | "cmd+alt+v"
  | "n" | "?" | "s" | "p" | "r" | "shift+r"
  | "h" | "m" | "g" | "t";
```

`ShortcutName` is a closed union: TypeScript flags typos at compile time.
Implementation: a small `shouldFire(name)` helper consults `getConfig()`
and bails when `disabledShortcuts` includes `name`. Each shortcut handler
wraps its body in `if (!shouldFire("cmd+s")) return;`.

### What the combination buys

| User who has… | Gets, with no config | Gets, with config |
|---|---|---|
| A normal host page | `Cmd+F`/`Cmd+K`/`Cmd+Z` back; `n` doesn't toggle navigator while typing | (no config needed) |
| A host with its own `Cmd+K` palette they want from inside the panel too | (default panel-only is fine for most) | `disabledShortcuts: ["cmd+k"]` lets host `Cmd+K` through everywhere |
| Insistence on the current global behaviour | _not provided_ — this is the breaking-change opt-out we don't ship | (intentionally absent) |

There is deliberately **no** "go back to the global pre-#32 behaviour"
switch. The current behaviour is the bug; the new default is the fix.

## Why not other shapes

- **`disabledShortcuts` alone, no default change.** Closes #32 only for
  users who read docs, find the list, and configure. Most won't — the
  bug stays loud. Default behaviour is what users actually live with.
- **Full `keyboardConfig` object** (e.g. `{ scope: "panel-focused" |
  "selected-element" | "always", bindings: { cmd_s: "redial" | "host" |
  Fn }}`). Solves edge cases nobody has asked for; expands the public
  surface by ~5–10 fields, each of which has to be honoured forever.
  YAGNI applied: the recommended minimal shape can grow into this if a
  real need surfaces.
- **Per-shortcut rebinding** (let users move `Cmd+S` to `Cmd+Alt+S`).
  No issue or user has asked for it. Adds bindings, conflict detection,
  cross-platform key normalization — a separate, larger ADR if it ever
  becomes warranted.
- **`onlyWhenFocused: boolean` flag with no opt-out.** Closes #32 but
  blocks the rare legitimate "save from host focus" workflow. The
  `Cmd+S` / `Cmd+C` exceptions in Part 1 are the better trade.
- **Defer until after ADR-0008 (Shadow DOM).** Tempting because the
  shadow boundary changes how `event.target` and `activeElement` work,
  and the `panelHasFocus()` helper would need rewriting. But: ADR-0008
  is XL and unlanded; #32 is an active live-site bug. The right
  sequencing is "ship this with `panelHasFocus()` using
  `closest(".__tuner-root")`, and update the helper as part of the
  ADR-0008 portal-retargeting sweep." The two changes don't conflict;
  the helper is a one-function update.

## Consequences

- **Breaking change** for any consumer who relied on global `Cmd+S` /
  `Cmd+Z` from host-element focus when an element is selected — they
  must either click into the panel before using the shortcut, or learn
  the (still-supported) "save with pending overrides" exception.
  README is pre-v1 ("API may change"), risk is acceptable.
- `useOverlayHotkeys.ts` gains a `panelHasFocus()` check at each
  shortcut site (~18 sites). Single helper function. Locked with a
  test that asserts `Cmd+Z` is NOT intercepted when focus is on a
  host element outside `.__tuner-root`.
- `TunerConfig` widens from 1 field to 2; `ShortcutName` becomes a
  public type export.
- `src/index.tsx` `Tuner` component forwards the new prop:
  `<Tuner disabledShortcuts={["cmd+f"]} />` works identically to
  `configure({ disabledShortcuts: ["cmd+f"] })`.
- README + keyboard-shortcuts table in the existing docs grow a small
  section: "Disabling shortcuts" + the canonical name list.
- New `shortcuts.test.ts` cases lock the focus-gating contract and the
  `disabledShortcuts` opt-out across every shortcut. Existing
  `shortcuts.test.ts` (~12 cases) must continue to pass; the focus
  context they assume becomes explicit.
- ADR-0008 (Shadow DOM) needs to update `panelHasFocus()` to also
  check `host.shadowRoot?.activeElement`. Documented as a one-line
  change in the ADR-0008 implementation PR, not blocking here.

## Effort

M. The work is mechanical (wrap ~18 handler sites in a shared check
+ add the config field + tests). The hotkey handler is called out in
the roadmap as "a sensitive seam" — care is in the test coverage, not
the diff size.

## Related

- Issue #32 (the report), ADR-0001 (deferral context), ADR-0008
  (Shadow DOM — needs the `panelHasFocus()` helper updated for shadow
  root awareness in its own sweep).
