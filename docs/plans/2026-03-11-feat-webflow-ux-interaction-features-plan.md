---
title: "feat: Add Webflow-style UX interaction features"
type: feat
date: 2026-03-11
---

# Add Webflow-style UX Interaction Features

## Enhancement Summary

**Deepened on:** 2026-03-11
**Sections enhanced:** 12 features + 2 prerequisite refactors
**Research agents used:** 11 (4 Explore agents, TypeScript reviewer, pattern recognition, performance oracle, frontend race reviewer, architecture strategist, security sentinel, code simplicity reviewer)

### Key Improvements from Research
1. **CRITICAL: Extract `useOverlayKeyboard` hook** before adding features — Overlay.tsx is 949 lines with a 180-line keydown handler
2. **CRITICAL: Consolidate RAF loops** into a single measurement coordinator — 4 concurrent loops = 4 forced layouts per frame
3. **Feature 2 is already 80% done** — `searchQuery`, `matchedSections`, `SECTION_ALIASES`, and `forceOpen` already exist in WebflowPanel.tsx
4. **Use discriminated union types** for command palette entries — prevents spaghetti if/else dispatch
5. **Blur/click race** on value presets needs 150ms `setTimeout` pattern (proven in SpacingValuePopover)

### New Considerations Discovered
- Cmd+K is safe on all browsers (not reserved by Safari/Chrome/Firefox)
- GridOverlay's string-key diff pattern prevents unnecessary React reconciliation — replicate for all overlays
- Cross-origin stylesheets throw `SecurityError` when accessed — need try/catch in viewport badge @media parsing
- Context menu must use `contextmenu` event (not `click`) — separate from existing `handlePageClick`

---

## Overview

Redial's CSS style panel has full property coverage (44 completed spec items across Phases A–H), but lacks several UX interaction patterns that make Webflow's Designer feel intuitive and fast. This plan adds **12 features** across 4 phases, plus **2 prerequisite refactors**, focusing on discovery, visual feedback, contextual efficiency, and responsive awareness.

## Problem Statement

The panel currently operates as a "find the section, scroll to the control" workflow. Webflow's Designer reduces friction through:
- **Instant discovery** — command palette and search to jump to any property
- **Spatial feedback** — overlays on the page itself showing spacing, measurements, flex proportions
- **Contextual shortcuts** — right-click menus, value presets, tooltips
- **Responsive awareness** — knowing which breakpoint you're editing at

These UX gaps slow down power users and make the panel harder to learn for new users.

## Technical Approach

### Prerequisite Refactor 0A: Extract `useOverlayKeyboard` Hook

**Why (from TypeScript reviewer):** `Overlay.tsx` is 949 lines with a 180-line keydown handler (lines 172–352) that dispatches via a growing if/else chain. Adding Cmd+K, `/` for search, and context menu handling to this will make it unmaintainable.

**Implementation:**
- New file: `src/overlay/useOverlayKeyboard.ts`
- Accepts a config object describing registered shortcuts:

```tsx
type ShortcutConfig = {
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  guard?: () => boolean;  // return false to skip (e.g., scrub active, diff mode)
  handler: (e: KeyboardEvent) => void;
};

function useOverlayKeyboard(shortcuts: ShortcutConfig[], deps: unknown[]): void;
```

- Registers a single capture-phase keydown listener
- Iterates shortcuts in priority order (first match wins)
- Built-in guards: `isScrubActive()`, `isContentEditable`, `isInputTag`
- Existing shortcuts migrate first (zero behavior change), then new ones are added

### Prerequisite Refactor 0B: RAF Measurement Coordinator

**Why (from performance oracle):** Each RAF callback that reads `getBoundingClientRect()` or `getComputedStyle()` forces the browser to complete pending layout work. With 4 concurrent RAF loops (outline + grid + spacing + flex), worst case is 4 forced reflows per frame. On complex pages, each reflow costs 2–10ms, consuming 8–40ms of a 16.6ms frame budget.

**Implementation:**
- New file: `src/overlay/useMeasurementLoop.ts`
- Single RAF loop that batches all DOM reads, then distributes results:

```tsx
type MeasurementConsumer = {
  id: string;
  enabled: boolean;
  measure: () => unknown;          // DOM read (batched first)
  apply: (data: unknown) => void;  // DOM write or setState (batched second)
};

function useMeasurementLoop(consumers: MeasurementConsumer[]): void;
```

- Follows read/write batching to avoid layout thrashing
- GridOverlay's string-key diff pattern replicated: only call `apply()` when measurements change
- Element outline, grid overlay, spacing guide, and flex visualizer all register as consumers
- When a consumer's `enabled` is false, its measurement is skipped (zero cost)

### Z-Index Allocation Plan

| Z-Index | Layer |
|---------|-------|
| `2147483647` | Panel, command palette, context menu (topmost) |
| `2147483646` | Element outline (existing) |
| `2147483645` | Grid overlay (existing) |
| `2147483644` | Informational overlays: spacing guide, flex visualizer, measurement labels |
| `2147483640` | Next.js dev overlay (already tamed in Overlay.tsx line 571) |

### Keyboard Shortcut Map (Existing + Proposed)

| Shortcut | Current | Proposed |
|----------|---------|----------|
| `` ` `` | Toggle selector mode | — |
| `Escape` | Close panel / cancel | Also: dismiss palette, context menu, tooltips (priority: palette > menu > panel) |
| `Cmd+Z` | Undo | — |
| `Cmd+Shift+Z` | Redo | — |
| `Cmd+S` | Save to source | — |
| `Cmd+C` | Copy CSS | — |
| `Cmd+Alt+C` | Copy styles | — |
| `Cmd+Alt+V` | Paste styles | — |
| `D` (hold) | Diff peek | — |
| `S` | Cycle scope | — |
| `R` | Reset element | — |
| `Arrow keys` | Element navigation | — |
| **`Cmd+K`** | — | **Open command palette** (only when panel is open + no input focused) |
| **`/`** | — | **Focus inline search** (only when panel has focus, no input focused) |

**Research insight:** Cmd+K is not reserved by any major browser (Safari, Chrome, Firefox, Edge). Safe to intercept at capture phase. Linear, Superhuman, and Slack all use Cmd+K as the standard command palette shortcut.

### Event Routing Rules

New features introduce pointer event conflicts. Resolution:

1. **Command palette** renders inside `.__tuner-root` (avoids shortcut key leakage — typing in palette search won't trigger `S`/`R`/`D` shortcuts because the handler already bails on `<input>` tags)
2. **Context menu** listens on `contextmenu` event (separate from `click` handler in `handlePageClick`)
3. **All page overlays** use `pointerEvents: "none"` (same as GridOverlay pattern)
4. **Escape priority chain:** Command palette → Context menu → Panel close (first open dismissible wins)

### Diff Mode Behavior

All new features respect diff mode:
- Overlays show **original** (pre-override) values during diff peek (useful — shows what would revert)
- Command palette and context menu are **disabled** during diff
- Tooltips remain active (informational only)

---

## Implementation Phases

### Phase I — Discovery & Navigation (highest impact)

These features transform the panel from "scroll and hunt" to "jump anywhere instantly."

#### Feature 1: Command Palette (`Cmd+K`)

**What:** A centered overlay search input that fuzzy-matches against all CSS properties, section names, and actions (Save, Reset, Copy CSS, Copy Tailwind, Toggle Grid).

**Implementation:**
- New file: `src/overlay/CommandPalette.tsx`
- Renders inside `.__tuner-root` as a fixed overlay (centered horizontally, 25% from top)
- Width: 280px (fits within panel context), max-height: 320px scrollable results
- Fuzzy search: prefix match boost (500pts) + substring match (100pts) + word-boundary scoring. No library needed for <200 items.
- Result types: `property` (scrolls panel + focuses control), `section` (scrolls + expands), `action` (executes)
- Reuse existing `useDropdownKeyboard` hook for arrow key navigation, Enter/Escape, and type-ahead
- ARIA: `role="combobox"` with `aria-activedescendant` on results (matches existing `UnitSelector` pattern at `controls.tsx` line 339)

**Data source — use discriminated union (from TypeScript reviewer):**
```tsx
type PaletteEntry =
  | { kind: "section"; name: string; aliases: readonly string[] }
  | { kind: "property"; name: string; section: string; cssProp: string }
  | { kind: "action"; name: string; shortcut?: string; execute: () => void };

// Reuse existing SECTION_ALIASES from WebflowPanel.tsx line 39 for section entries
// Property entries derived from SliderRow/SelectRow labels
// Action entries wired to existing footer handlers
```

**Fuzzy scoring (from research):**
```tsx
function scoreMatch(query: string, label: string, aliases: readonly string[]): number {
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  if (l === q) return 1000;                    // exact match
  if (l.startsWith(q)) return 500;             // prefix match
  if (l.includes(q)) return 200;               // substring
  for (const a of aliases) {
    if (a.includes(q)) return 150;             // alias match
  }
  return 0;                                     // no match
}
```

**Edge cases:**
- Only activates when `selectedEl` is non-null (panel is open)
- Does NOT intercept Cmd+K when any `<input>` or `<textarea>` has focus (let browser handle)
- Dismissed by: Escape, click outside (existing pattern from `ColorPickerEnhanced`), selecting a result
- During diff mode: disabled (early return in guard)
- During scrub: disabled (check `isScrubActive()`)
- Escape priority: palette dismisses first; panel close only if palette is not open

**Acceptance criteria:**
- [ ] Cmd+K opens palette when panel is open, no input focused
- [ ] Typing filters results with fuzzy matching (prefix boost)
- [ ] Selecting a property scrolls panel to that section and focuses the control
- [ ] Selecting an action executes it (Save, Reset, Copy CSS, etc.)
- [ ] Arrow keys + Enter for keyboard-only usage (via `useDropdownKeyboard`)
- [ ] Escape dismisses, focus returns to previously focused element
- [ ] ARIA combobox role with activedescendant (matching UnitSelector pattern)
- [ ] Recently used commands ranked higher (optional — track in `localStorage`)

### Research Insights — Command Palette

**Best Practices (from VS Code, Figma, Linear analysis):**
- Figma uses min-max normalization when combining multiple search indexes; exact lexical matches receive a boost
- Linear implements automatic type-ahead (single keystrokes find commands)
- Superhuman's Cmd+K groups results by category with section headers

**Performance:**
- Static registry of ~100–150 entries. No virtualization needed at this size.
- Scoring runs synchronously on every keystroke — O(n) with n<200 is <1ms

**ARIA pattern (from W3C WAI):**
- `role="combobox"` on trigger, `aria-expanded`, `aria-haspopup="listbox"`, `aria-controls`, `aria-activedescendant`
- List items: `role="option"` with `aria-selected`
- Use managed focus with `aria-activedescendant` (not DOM focus on items) — avoids breaking native scrolling

---

#### Feature 2: Inline Property Search (`/` to focus)

**What:** A sticky search bar at the top of the panel's scrollable area. Typing filters visible sections.

**IMPORTANT (from research): This is already 80% implemented!**

WebflowPanel.tsx already has:
- `searchQuery` state (line 114)
- `matchedSections` memoized logic (lines 117–125) using `SECTION_ALIASES`
- `showSection()` helper (line 152) that gates rendering
- `forceOpen` prop on `Section` — overrides local collapse state during search
- `Section` component supports `forceOpen` via `const open = forceOpen || ownOpen`

**Remaining work:**
1. Add the visible search `<input>` at the top of the scroll container (currently only programmatic)
2. Add `/` key handler to focus the search input (in `useOverlayKeyboard` config)
3. Add yellow highlight on matching control labels (`<mark>` or bg color on label text)
4. Wire Escape in search input to clear query and blur

**Acceptance criteria:**
- [ ] Search input visible at top of panel scroll area
- [ ] Typing filters sections — non-matching sections hidden entirely (already works via `showSection`)
- [ ] Matching sections auto-expand (already works via `forceOpen`)
- [ ] Matching control labels highlighted (yellow bg) — **NEW**
- [ ] Clearing search restores previous collapse state (already works — `Section` uses local `ownOpen`)
- [ ] `/` key focuses search input from anywhere in panel — **NEW**
- [ ] Escape in search input clears and blurs — **NEW**

---

#### Feature 3: Section Minimap

**What:** A thin (16px) vertical strip on the left edge of the panel showing one dot per section. Dot color indicates override status. Click to scroll to that section.

**Implementation:**
- Rendered inside the panel container, positioned absolutely on the left edge
- One 8px dot per section, vertically distributed to match section positions
- Dot colors: gray (no overrides), indigo (has overrides), orange (inherited overrides)
- Uses existing `sectionInd()` helper to determine indicator type per section
- Click handler calls `scrollIntoView({ behavior: 'smooth' })` on the section header ref
- Active section (currently scrolled to) detected via `IntersectionObserver` on section headers
- Active dot: slightly larger (10px) + brighter opacity

**Research insight:** The existing `useDropdownKeyboard` already uses `scrollIntoView({ block: "nearest" })` for dropdown items. Apply the same pattern at the panel level with `block: "start"`.

**Acceptance criteria:**
- [ ] 16px vertical strip on left edge of panel
- [ ] One dot per section, colored by override status
- [ ] Click dot scrolls to that section smoothly
- [ ] Active (visible) section dot is visually distinct (IntersectionObserver)
- [ ] Minimap updates when overrides change (via `useSyncExternalStore` subscription)

### Research Insights — Discovery Phase

**Simplicity review findings:**
- Command palette and inline search serve different use cases: palette = global jump (any section/action), search = filter within visible panel. Both are valuable.
- Section minimap is low-complexity, high-value for a panel with 8+ sections. The 16px width reduction (300→284px content) is acceptable.

---

### Phase II — Visual Feedback Overlays

These render on the actual page, providing spatial context for CSS values.

**All overlays in this phase use the RAF Measurement Coordinator (Refactor 0B).**

#### Feature 4: Spacing Guide Overlay

**What:** When hovering a margin/padding value in the SpacingBoxModel, a colored semi-transparent overlay appears on the actual page element showing the real spacing area.

**Implementation:**
- New file: `src/overlay/SpacingGuideOverlay.tsx`
- Activated by: hover or focus on any value in `SpacingBoxModel` (via callback prop)
- Registers as a `MeasurementConsumer` in the coordinator (enabled only during hover)
- Reads `getComputedStyle()` for margin/padding values + `getBoundingClientRect()` for position
- Renders colored rectangles:
  - Margin zones: `rgba(255, 152, 87, 0.25)` (warm orange, matches SpacingBoxModel)
  - Padding zones: `rgba(87, 168, 255, 0.25)` (cool blue, matches SpacingBoxModel)
- Only shows the specific side being hovered
- Dimension label: small floating text showing "24px" on the highlighted zone
- Z-index: `2147483644`
- Viewport clipping: fixed container `100vw × 100vh` with `overflow: hidden` (same as GridOverlay)

**Race condition mitigation (from frontend races reviewer):**
- Tooltip + scrub race: Clear tooltip timer on `pointerdown` (before scrub starts)
- Diff peek race: Spacing overlay reads from `getComputedStyle()` which returns the current DOM state — during diff peek, overrides are stripped, so overlay automatically shows original values. No special handling needed.
- HMR stale element: Check `element.isConnected` in measurement callback (existing pattern from outline RAF)

**Edge cases:**
- Element partially off-screen: clip overlay to viewport (handled by container overflow:hidden)
- During scrub: update in real-time (measurement runs every frame)
- `pointerEvents: "none"` — clicks pass through

**Acceptance criteria:**
- [ ] Hover margin value → orange overlay on page shows margin area for that side
- [ ] Hover padding value → blue overlay shows padding area for that side
- [ ] Overlay includes dimension label (e.g., "24px")
- [ ] Real-time update during label scrub drag
- [ ] Overlay disappears on mouse leave
- [ ] Works with both hover and keyboard focus
- [ ] No new standalone RAF loop (uses coordinator)

---

#### Feature 5: Flex Visualizer

**What:** When the selected element is a flex container, semi-transparent bars appear overlaid on each flex child showing their proportional sizes.

**Implementation:**
- New file: `src/overlay/FlexVisualizer.tsx`
- Toggle button in Layout section (next to grid overlay toggle) — "Show Flex" with Rows icon
- Registers as a `MeasurementConsumer` in coordinator (enabled when toggle is on + display is flex)
- Measurement callback: for each direct child, read `getComputedStyle()` for `flexGrow`, `flexShrink`, `flexBasis` + `getBoundingClientRect()` for position
- Render colored bar within each child's bounding rect
- Bar height proportional to `flex-grow` (relative to total grow of all siblings)
- Color: `rgba(99, 102, 241, 0.15)` (indigo tint) with 2px bottom border `rgba(99, 102, 241, 0.4)`
- Z-index: `2147483644`
- String-key diff (GridOverlay pattern): concat child rects + flex values, skip React update if unchanged

**Edge cases (from research):**
- All children have `flex-grow: 0` → show computed-width-proportional bars instead
- `flex-basis: auto` → use computed width as the proportion
- Flex direction `column` / `column-reverse` → bars are vertical (height proportional)
- `flex-wrap: wrap` → bars still drawn per-child, even if wrapped to new line
- During scrub of flex properties → bars update in real-time via coordinator

**Acceptance criteria:**
- [ ] Toggle button appears when display is flex/inline-flex
- [ ] Colored proportion bars appear on each flex child
- [ ] Bars update in real-time when flex properties change
- [ ] Hover bar shows grow/shrink/basis tooltip
- [ ] Column direction renders vertical bars
- [ ] `pointerEvents: "none"` — clicks pass through
- [ ] No new standalone RAF loop (uses coordinator)

---

#### Feature 6: Element Measurement Labels

**What:** A floating "W × H" label appears near the selected element showing its computed dimensions.

**Implementation:**
- Add to existing element outline system in `Overlay.tsx`
- Small label div positioned at the bottom-right corner of the outline element
- Shows: `"320 × 48"` (rounded integers, no units — pixels implied)
- Background: `rgba(99, 102, 241, 0.9)` (indigo), text: white, font-size: 10px, padding: 2px 5px, border-radius: 3px
- **Reuses the existing outline RAF loop** — the outline callback already reads `getBoundingClientRect()` which has `width` and `height`. Just add a sibling div to the outline element.
- No additional RAF loop or measurement coordinator registration needed

**Edge cases:**
- Element at viewport edge: flip label to inside (bottom-left or top-right)
- Very small elements (< 50px wide): position label below instead of inside

**Acceptance criteria:**
- [ ] Label visible near bottom-right of selected element outline
- [ ] Shows computed width × height as integers
- [ ] Updates in real-time during width/height adjustments
- [ ] Repositions correctly on scroll/resize
- [ ] Doesn't overflow viewport (flips to inside if at edge)

### Research Insights — Visual Overlays

**Performance (from performance oracle):**
- With the measurement coordinator, worst case is 1 forced layout per frame (all reads batched before all writes)
- GridOverlay's `prevMetricsRef` string-key pattern prevents unnecessary `setState` — replicate in all overlays
- SpacingGuideOverlay only registers when hover is active → zero cost when not hovering

**Pattern (from page overlay research):**
- Viewport container: `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; pointerEvents: "none"`
- All child elements: absolute-positioned within container
- HMR resilience: check `element.isConnected` in every measurement callback

---

### Phase III — Context & Efficiency

These reduce friction for common operations.

#### Feature 7: Right-Click Context Menu

**What:** Right-clicking the selected element on the page shows a custom context menu with quick actions.

**Implementation:**
- New file: `src/overlay/ContextMenu.tsx`
- Register `contextmenu` event handler in `useOverlayKeyboard` config (or dedicated useEffect in Overlay)
- Only show custom menu when right-click target is the currently selected element (or within it)
- For all other elements: allow native browser context menu (no `preventDefault`)
- Menu items:
  - Copy CSS (`formatCSSDiff` → clipboard)
  - Copy Tailwind (`formatTailwindDiff` → clipboard)
  - Copy Selector (element tag + classes → clipboard)
  - Reset Element (calls `reset()`)
  - Select Parent (navigate to `parentElement`)
  - Open in Editor (click source file link)
- Menu renders inside `.__tuner-root`, positioned at click coordinates
- Click-outside dismissal: same pattern as `ColorPickerEnhanced` (`document.addEventListener("mousedown", handler, true)`)
- ARIA: `role="menu"` with `role="menuitem"` children, `aria-orientation="vertical"`

**Race condition mitigations (from frontend races reviewer):**
- `contextmenu` vs `handlePageClick`: They're separate events (`contextmenu` vs `click`), so no conflict. `handlePageClick` only listens for `click` events.
- Multiple rapid right-clicks: Set state to dismiss previous before showing new (single `contextMenuPos` state)
- Escape priority: Context menu Escape handler runs before panel close (using priority in `useOverlayKeyboard`)

**Security (from security reviewer):**
- "Copy Selector" renders element tag + class names. Classes could contain user-controlled content from CMS. Render as `textContent` (never `innerHTML`). Already the case with inline-styled React.

**Edge cases:**
- Menu near viewport edge → flip to fit (same logic as `ColorPickerEnhanced` positioning)
- During diff mode: disabled
- During scrub: disabled

**Acceptance criteria:**
- [ ] Right-click on selected element shows custom context menu
- [ ] Right-click elsewhere shows native browser menu
- [ ] All 6 menu items functional
- [ ] Escape dismisses menu (priority over panel close)
- [ ] ARIA menu/menuitem roles
- [ ] Viewport-aware positioning (flip at edges)

---

#### Feature 8: Value Presets / Quick Picks

**What:** When a numeric input receives focus, a row of common value chips appears below it.

**Implementation:**
- Add to `ValueInput` component in `controls.tsx` as an absolutely-positioned dropdown
- Optional `presets` prop: `readonly string[]` passed from the parent section
- Preset registry per property type (in `panelConstants.tsx`):
  - **Size**: `["auto", "0", "50%", "100%", "fit-content"]`
  - **Spacing**: `["0", "4", "8", "12", "16", "24", "32", "auto"]`
  - **Typography** (font-size): `["12", "14", "16", "18", "20", "24", "32", "48"]`
  - **Opacity**: `["0", "0.25", "0.5", "0.75", "1"]`
  - **Border-radius**: `["0", "4", "8", "12", "9999"]`
- Only visible on focus (not always) — prevents vertical bloat
- Chips: 22px tall, `rgba(255,255,255,0.06)` bg, 3px border-radius, monospace

**Race condition mitigation (from frontend races reviewer):**
- Focus/blur/click race: Use 150ms `setTimeout` on blur before hiding presets, allowing the chip click to fire first. Clear timeout if re-focused. This is the same pattern used in `SpacingValuePopover` for its dismiss behavior.

**Edge cases:**
- Input near bottom of panel: flip presets above using `getBoundingClientRect` check
- During diff mode: disabled (inputs are read-only)
- Keyword presets like "auto": emit both value change AND keyword toggle

**Acceptance criteria:**
- [ ] Focus on numeric input shows relevant preset chips below
- [ ] Clicking a chip applies the value and emits onChange
- [ ] Chips disappear on blur (with 150ms delay for click to register)
- [ ] Different presets per property type
- [ ] Keyword presets (auto, none) work correctly with keyword toggle state
- [ ] Position flips when near panel bottom

---

#### Feature 9: Tooltip System

**What:** Hovering any control label for 500ms shows a small tooltip explaining the CSS property.

**Implementation:**
- New file: `src/overlay/Tooltip.tsx` — singleton tooltip component via React context
- `TooltipProvider` wraps `.__tuner-root`, exposes `show(rect, text)` and `hide()` methods via context
- Tooltip registry: static `Record<string, string>` map (~50 entries) in `src/overlay/tooltipRegistry.ts`
- Trigger: `onMouseEnter` starts 500ms timer, `onMouseLeave` clears timer and hides
- Singleton: only one tooltip at a time; moving between labels swaps instantly (no re-delay) via `warmRef`
- Position: above the label, centered, with CSS triangle arrow
- Style: `rgba(30,30,30,0.95)` bg, `rgba(255,255,255,0.9)` text, 11px font, 6px padding, max-width 200px
- Fade in: `opacity` transition using `ms("normal")` (100ms)

**Race condition mitigation (from frontend races reviewer):**
- Tooltip + label scrub: Clear timer on `pointerdown` event (not just `onMouseLeave`). The scrub starts on `pointerdown`, so clearing the timer there prevents tooltips appearing mid-drag.
- Singleton warmup: After first tooltip shows, subsequent hovers show instantly (warmRef stays true for 300ms after last hide). Matches Figma's tooltip behavior.

**Acceptance criteria:**
- [ ] Hover label for 500ms → tooltip appears above label
- [ ] Moving to adjacent label → tooltip swaps instantly (no re-delay)
- [ ] Mouse leave → tooltip fades out
- [ ] Max 200px width, text wraps cleanly
- [ ] Works on section headers too
- [ ] Does not interfere with label scrub (timer cleared on pointerdown)

---

#### Feature 10: Property Value History

**What:** Each numeric input has a small clock icon. Clicking it shows the last 8 values used for that CSS property.

**Implementation:**
- Storage: `localStorage` under `__tuner-value-history` key, JSON object keyed by CSS property name
- Recording hook: insert into `applyInlineStyle()` in `apply.ts` — after applying, record `{prop, value}` (deduplicated, newest first, max 8 per prop)
- Eviction: 50 properties max; evict least-recently-used property entry when exceeded
- UI: small clock icon (12px, lucide `Clock`) at right edge of `ValueInput`, visible on hover only
- Click opens dropdown (max 8 items) using existing dark dropdown styling
- Click history item → applies via onChange callback

**Performance (from performance oracle):**
- Don't write localStorage on every drag frame. Use same `schedulePersist()` debounce pattern from `apply.ts` (150ms).
- Parse `__tuner-value-history` once on mount, keep in-memory `Map`, flush on debounced timer.

**Security (from security reviewer):**
- Values come from `getComputedStyle` and user input. Rendered as `textContent` in dropdown items (no injection vector). Safe.

**Acceptance criteria:**
- [ ] Values automatically recorded when applied (debounced, not per-frame)
- [ ] Clock icon visible on input hover
- [ ] Click shows last 8 values for that property
- [ ] Click a history value → applies it
- [ ] Persists across sessions via localStorage
- [ ] Max 8 values per property, 50 properties total

---

### Phase IV — Responsive Awareness

#### Feature 11: Viewport Width Badge

**What:** A small badge in the panel header showing the current viewport width and active breakpoint tier.

**Implementation:**
- Add to `Header.tsx` — small inline badge in the right column (next to changes badge)
- Shows: `"1280px xl"` based on Tailwind breakpoint tiers:
  - `< 640px` → `sm`
  - `640–767px` → `md`
  - `768–1023px` → `lg`
  - `1024–1279px` → `xl`
  - `>= 1280px` → `2xl`
- Updates on `window.resize` (debounced 100ms via `setTimeout`)
- Badge style: matches existing ScopePill styling (10px font, 2px 8px padding, border-radius 8px)
- Optional expansion: click badge to show matched @media rules

**Security (from security reviewer):**
- Parsing `document.styleSheets` for @media rules: cross-origin stylesheets throw `SecurityError`. Must wrap in try/catch per stylesheet:
```tsx
for (const sheet of document.styleSheets) {
  try {
    for (const rule of sheet.cssRules) { /* ... */ }
  } catch { continue; }  // skip cross-origin sheets
}
```

**Acceptance criteria:**
- [ ] Badge shows viewport width + breakpoint tier label
- [ ] Updates on window resize (debounced)
- [ ] Styled consistently with existing header elements (ScopePill pattern)
- [ ] Optional: click to see matching @media rules (with try/catch for cross-origin)

---

#### Feature 12: Computed Values View

**What:** A toggle button in the footer switches the panel to a read-only "Computed" view showing all resolved CSS values.

**Implementation:**
- Toggle button in `Footer.tsx` using existing `ActionButton` component: "Computed" label, active state with yellow accent (existing `active` prop)
- `showComputed` state lifted to `Overlay.tsx` (passed down as prop)
- When active, `WebflowPanel` renders `<ComputedValuesView>` instead of sectioned controls
- New file: `src/overlay/ComputedValuesView.tsx`
- Each row: property name (left) + resolved value (right), virtualized if >300 properties
- Source: `getComputedStyle(element)` iterated via numeric index: `for (let i = 0; i < cs.length; i++) { cs[i] }`
- Filter out vendor-prefixed properties by default, toggle to show all
- Reuse Feature 2's search filter (same `searchQuery` state)
- Values differing from parent highlighted with indigo left-border (indicating non-inherited)
- Click value → copy to clipboard with toast feedback

**Performance:**
- `getComputedStyle()` returns 300+ properties. Iterating and rendering all is expensive.
- Use windowing: render only visible rows (simple `overflow: auto` + `slice` based on scroll position, ~30 visible rows at a time)
- Cache the property list: only re-iterate on element change, not on scroll

**Acceptance criteria:**
- [ ] Toggle button switches between Edit and Computed views
- [ ] Computed view shows all resolved values alphabetically
- [ ] Vendor-prefixed properties hidden by default
- [ ] Search filter works in Computed view
- [ ] Click value to copy to clipboard
- [ ] Non-inherited values visually distinguished (indigo border)
- [ ] Smooth scrolling with windowed rendering

---

## Deferred Features (Future Phase)

These require significant architectural changes or have uncertain value:

- **Multi-element selection (Shift+click)** — Requires refactoring `WebflowPanel`, `infer.ts`, and `apply.ts` from single-element to multi-element data model. "Mixed" value display, batch undo, shared-property intersection all need design. Deferred.
- **Quick text edit (double-click)** — Text content changes need a different persistence mechanism than CSS (editing JSX/HTML, not CSS properties). Conflicts with double-click-to-select-all behavior on inputs. Deferred.
- **Animation preview timeline** — CSS transitions don't have keyframes (only animations do). Simulating transition playback requires cloning elements or using the Web Animations API with `element.getAnimations()`. Complex for uncertain UX value. Deferred.

---

## Success Metrics

- **Discovery speed**: Time from "I want to change font-size" to having the slider focused (target: < 2 seconds via Cmd+K)
- **Spatial understanding**: Users can see spacing/flex layout without mentally mapping values to pixels
- **Reduced scrolling**: Minimap + search reduce panel scroll distance for power users
- **Learnability**: Tooltips reduce time for new users to understand what each control does
- **Frame budget**: All overlays active simultaneously stays under 12ms/frame (measured via Performance API)

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Overlay.tsx god-component growth | **Prerequisite 0A**: Extract `useOverlayKeyboard` hook before adding features |
| RAF loop frame drops (4 concurrent) | **Prerequisite 0B**: Single measurement coordinator batches all reads |
| localStorage bloat | Debounced writes; per-feature caps: 50 props × 8 values ≈ 20KB max |
| Keyboard shortcut collisions | `useOverlayKeyboard` with priority ordering; Escape chain: palette > menu > panel |
| Panel width pressure from minimap | 16px minimap inside 300px = 284px content area — acceptable |
| Cross-origin stylesheet SecurityError | try/catch per stylesheet in viewport badge @media parsing |
| Value preset blur/click race | 150ms setTimeout on blur (proven SpacingValuePopover pattern) |
| Tooltip during label scrub | Clear timer on `pointerdown` (before scrub dead zone) |

## Implementation Order

```
0A. Extract useOverlayKeyboard (prerequisite)
0B. Create useMeasurementLoop coordinator (prerequisite)
 2. Inline property search (80% done — just add UI)
 6. Element measurement labels (smallest scope — add to existing outline)
11. Viewport width badge (standalone, no dependencies)
 1. Command palette (depends on 0A for keyboard handling)
 3. Section minimap (depends on IntersectionObserver setup)
 9. Tooltip system (standalone, wraps existing labels)
 4. Spacing guide overlay (depends on 0B coordinator)
 5. Flex visualizer (depends on 0B coordinator)
 7. Context menu (depends on 0A for event routing)
 8. Value presets (depends on controls.tsx ValueInput)
10. Value history (depends on apply.ts hook)
12. Computed values view (largest scope — new component + windowing)
```

## References

### Internal
- Overlay lifecycle: `src/overlay/Overlay.tsx` (949 lines)
- Panel sections: `src/overlay/WebflowPanel.tsx` (1300+ lines, has `searchQuery`/`SECTION_ALIASES`)
- Existing overlay pattern: `src/overlay/GridOverlay.tsx` (string-key diff, RAF, viewport container)
- Style application: `src/overlay/apply.ts` (undo/redo, debounced persist)
- Timing tokens: `src/overlay/timing.ts` (7 levels: instant through slow)
- Spacing box model: `src/overlay/SpacingBoxModel.tsx` (drag-to-scrub, batched undo)
- Keyboard hook: `src/overlay/useDropdownKeyboard.ts` (reusable for palette)
- Dropdown positioning: `src/overlay/ColorPickerEnhanced.tsx` (click-outside, drag suppression)
- ARIA combobox: `src/overlay/UnitSelector.tsx` (role, aria-expanded, aria-activedescendant)

### External
- [W3C ARIA Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [Superhuman Command Palette Design](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- [Figma AI Search Infrastructure](https://www.figma.com/blog/the-infrastructure-behind-ai-search-in-figma/)
- [Command Palette UX Patterns](https://maggieappleton.com/command-bar)

### Spec Sections
- Panel Shell: `webflow-style-panel-spec.md` §1
- Input Controls: `webflow-style-panel-spec.md` §12
- Keyboard Patterns: `webflow-style-panel-spec.md` §13
