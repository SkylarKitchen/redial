# UX Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved UX workflow design (Approach B — Dev-Tool Hybrid) from `docs/plans/2026-03-15-ux-workflow-design.md`.

**Architecture:** Most features already exist. This plan adjusts defaults, adds new behaviors (pin toggle, click-to-reselect, unsaved warning, toast), merges two drawers, and adds hotkey discoverability.

**Tech Stack:** React, inline styles, Motion (framer-motion), localStorage, existing theme tokens.

> Each `- [ ]` item is a self-contained prompt for a fresh Claude Code session.
> Priority: **P0** = core workflow change | **P1** = supporting UX | **P2** = polish
> Note: The directory restructure moved shell files to `src/overlay/shell/`. All paths below reflect this.

---

## P0 — Core Workflow Changes

- [ ] **P0-1: Default scope to class when class detected.** In `src/overlay/shell/Overlay.tsx`, find the `handleSelect` callback (around line 726). It currently does `setScope("element")` and `setActiveClassName(null)` on every new selection. Change this so that when `getCSSModuleClasses(el)` returns a non-empty array, scope defaults to `"class"` with the first class as `activeClassName`. Only fall back to `"element"` when no classes are detected. The existing `getCSSModuleClasses` import is already at the top of the file. Write a test that selects an element with a CSS class and verifies scope is `"class"`, and another that selects a classless element and verifies scope is `"element"`.

- [ ] **P0-2: Rename scope pills to intent-based labels.** In `src/overlay/shell/Header.tsx`, the `ScopePill` component (around line 300) renders `label="element"` and `label=".{className}"`. Change the element pill label to `"Just this"` and the class pill label format to `"All .{className}"`. Keep the pill component generic — only change the labels passed to it. The `getReadableName` call already shortens CSS module hashes; keep using it. No test needed — this is a string change.

- [ ] **P0-3: Click-to-reselect while panel is open.** In `src/overlay/shell/Overlay.tsx`, add a global click handler that fires when `selectedEl` is set (panel is open) and `selecting` is false. On click: (1) check if the click target is inside `.__tuner-root` — if so, ignore. (2) Check if the click is a right-click (`e.button === 2`) — if so, ignore (let browser context menu through). (3) Otherwise, call `e.preventDefault()` and `e.stopPropagation()`, then resolve the clicked element and call `handleSelect(clickedEl)`. Add this as a `useEffect` that attaches a capture-phase click listener on `document` when `selectedEl !== null && !pinned`. Also add a `pinned` state variable (see P0-4). Write a test that verifies: (a) clicking a page element while panel is open re-selects it, (b) clicking inside `.__tuner-root` does not re-select, (c) right-click passes through.

- [ ] **P0-4: Pin toggle.** In `src/overlay/shell/Overlay.tsx`, add a `pinned` state (`useState(false)`, default unpinned). Pass `pinned` and `onTogglePin` to `Header`. In `src/overlay/shell/Header.tsx`, add a pin icon button next to the close button. Use `lucide-react`'s `Pin` icon (size 12). When pinned, show filled/active style; when unpinned, show muted style (same pattern as the close button hover). In `Overlay.tsx`'s keyboard handler, add `P` key (after the input guard, same block as `S` for scope) to toggle `pinned`. The click-to-reselect handler from P0-3 must check `!pinned` before intercepting clicks. Write a test that verifies: (a) pressing P toggles pinned state, (b) when pinned, page clicks pass through (are not intercepted).

- [ ] **P0-5: Save badge count on footer.** In `src/overlay/shell/Footer.tsx`, the Save button currently says "Save". Change it to show the pending change count when count > 0: `"Save (3)"`. The `count` variable already exists (line 81: `const count = overrideCount(element)`). Update the Save button label from the static string `"Save"` to `count > 0 ? \`Save (${count})\` : "Save"`. No test needed — this is a template string change.

- [ ] **P0-6: Post-save toast.** In `src/overlay/shell/Footer.tsx`, the save handler (search for `handleSave`) currently sets `saved` state and shows an inline "Saved!" message. Modify it to also report what was saved. After a successful save response, if `res.ok`, extract the file paths from the response JSON (the server returns `{ written: string[] }`). Set a `message` like `"Saved ${changes.length} properties → ${written[0]}"` (show first file path). If the save falls back to clipboard (no endpoint or fetch error), set the message to `"Copied CSS to clipboard"` and copy the formatted CSS to clipboard using `navigator.clipboard.writeText`. The message should auto-dismiss after 3 seconds (use the existing `messageTimerRef` pattern). Write a test that verifies the save handler sets the correct message format.

- [ ] **P0-7: Unsaved changes warning on close.** In `src/overlay/shell/Overlay.tsx`, modify the `handleClose` callback and the Escape key handler. Before closing, check `overrideCount(selectedElRef.current) > 0`. If there are unsaved changes, set a new state `closeWarning: true` instead of immediately closing. Render a lightweight warning bar at the bottom of the panel (above the footer): `"${count} unsaved changes"` with two buttons: **"Discard"** (calls the existing `handleClose` unconditionally) and **"Keep Editing"** (sets `closeWarning: false`). Use `text.warning` or `destructiveAlpha(0.15)` for the background. If there are no unsaved changes, close immediately as before. Write a test that verifies: (a) closing with no changes closes immediately, (b) closing with changes shows the warning, (c) clicking Discard closes, (d) clicking Keep Editing dismisses the warning.

---

## P1 — Supporting UX

- [ ] **P1-1: Merge SessionDrawer + HistoryDrawer into ChangesDrawer.** Create `src/overlay/shell/ChangesDrawer.tsx` that combines both drawers into a single component with two tabs: **"Pending"** (content from `SessionDrawer.tsx`) and **"History"** (content from `HistoryDrawer.tsx`). Use a simple tab bar at the top (two pills/buttons, same style as scope pills). The drawer receives all props from both: `open`, `onResetAll`, `onSaved`, `entries` (HistoryEntry[]), `onUndoToIndex`, `onClose`. In `Overlay.tsx`, replace the separate `showHistory` and `activePanel.type === "session"` states with a single `changesDrawerOpen` boolean and `changesDrawerTab: "pending" | "history"`. Update the toolbar "Session" button label to "Changes". Update the `H` keyboard shortcut to toggle the Changes Drawer (History tab) and ensure the toolbar "Changes" button opens the Pending tab. Delete `SessionDrawer.tsx` and `HistoryDrawer.tsx` after the merge is complete and all imports are updated.

- [ ] **P1-2: Rename "Session" to "Changes" in Toolbar.** In `src/overlay/shell/Toolbar.tsx`, rename the "Session" `ToolButton` label to `"Changes"`. Update the `onToggleSession` prop name to `onToggleChanges` in both the `ToolbarProps` interface and the component. Update `Overlay.tsx` accordingly where it renders `<Toolbar>`.

- [ ] **P1-3: Tooltip hints with keyboard shortcuts.** In `src/overlay/shell/Toolbar.tsx`, update each `ToolButton` to accept an optional `shortcut` string prop. Render it in the button's `title` attribute as `"${label} (${shortcut})"`. Pass shortcuts: Select → `` ` ``, Navigator → `N`, Variables → (none), AI → `T`, Changes → `H`. In `src/overlay/shell/Header.tsx`, update the close button `title` from `"Close (Esc)"` (already done) and add a title to the pin button: `"Pin element (P)"`. In `src/overlay/shell/Footer.tsx`, update the Save button `title` to `"Save to source (⌘S)"`, the Reset button to `"Reset element (R)"`, and the Copy dropdown trigger to `"Copy CSS (⌘C)"`.

- [ ] **P1-4: First-use hint bar.** In `src/overlay/shell/Overlay.tsx`, add a `showHintBar` state initialized from `localStorage.getItem("redial:hintDismissed") !== "true"`. When `showHintBar` is true and `selectedEl` exists, render a hint bar at the bottom of the panel (between the footer and the panel edge): a subtle row with text `"⌘S save · ⌘Z undo · ? all shortcuts"`, 10px font, `text.disabled` color, `surface.subtle` background, 6px vertical padding. Auto-dismiss after 5 seconds or on any click/keypress within the panel. On dismiss, set `localStorage.setItem("redial:hintDismissed", "true")` and `setShowHintBar(false)`. Use `AnimatePresence` + `motion.div` for a fade-out. Write a test that verifies the hint bar renders on first open and does not render when localStorage flag is set.

- [ ] **P1-5: FAB tooltip.** In `src/overlay/shell/Toolbar.tsx`, add a `title="Inspect element"` attribute to the outer FAB `motion.div` (the 48px circle, around line 167). This gives a native browser tooltip on first hover. No test needed.

---

## P2 — Polish

- [ ] **P2-1: Add P to ShortcutsHelp.** In `src/overlay/shell/ShortcutsHelp.tsx`, add `{ keys: "P", desc: "Pin / unpin element" }` to the "Selection" category items array (after the Esc entry). Also add `{ keys: "N", desc: "Toggle navigator" }` if not already present.

- [ ] **P2-2: Add "Changes" command to CommandPalette.** In `src/overlay/shell/CommandPalette.tsx`, find the commands array and add an entry: `{ label: "Toggle Changes Drawer", shortcut: "H", action: () => onToggleChanges() }`. Pass the `onToggleChanges` callback as a prop from `Overlay.tsx`. If the command palette already has a "Toggle Session" command, rename it to "Toggle Changes Drawer".

- [ ] **P2-3: Clipboard fallback when no commit endpoint.** In `src/overlay/shell/Footer.tsx`, in the save handler, before attempting `fetch(getConfig().commitEndpoint, ...)`, check if `getConfig().commitEndpoint` is truthy. If not, fall back to copying formatted CSS to clipboard and showing a toast: `"No commit endpoint — copied CSS to clipboard"`. This prevents a failed fetch when the server-side plugin isn't installed. Write a test that verifies the clipboard fallback fires when commitEndpoint is empty.

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **P0**   | 7     | Scope default, pill labels, click-to-reselect, pin toggle, save badge, toast, unsaved warning |
| **P1**   | 5     | Merge drawers, rename toolbar, tooltip hints, hint bar, FAB tooltip |
| **P2**   | 3     | Shortcuts help update, command palette update, clipboard fallback |
| **Total**| **15**| |
