---
title: "feat: Add Webflow-style UX interaction features"
type: feat
date: 2026-03-11
---

# Add Webflow-style UX Interaction Features

## Overview

Redial's CSS style panel has full property coverage (44 completed spec items across Phases A–H), but lacks several UX interaction patterns that make Webflow's Designer feel intuitive and fast. This plan adds **12 features** across 4 phases, focusing on discovery, visual feedback, contextual efficiency, and responsive awareness.

## Problem Statement

The panel currently operates as a "find the section, scroll to the control" workflow. Webflow's Designer reduces friction through:
- **Instant discovery** — command palette and search to jump to any property
- **Spatial feedback** — overlays on the page itself showing spacing, measurements, flex proportions
- **Contextual shortcuts** — right-click menus, value presets, tooltips
- **Responsive awareness** — knowing which breakpoint you're editing at

These UX gaps slow down power users and make the panel harder to learn for new users.

## Technical Approach

### Z-Index Allocation Plan

All new overlays must fit the existing stacking context:

| Z-Index | Layer |
|---------|-------|
| `2147483647` | Panel, command palette, context menu (topmost) |
| `2147483646` | Element outline (existing) |
| `2147483645` | Grid overlay (existing) |
| `2147483644` | Informational overlays: spacing guide, flex visualizer, measurement labels |

### Keyboard Shortcut Map (Existing + Proposed)

| Shortcut | Current | Proposed |
|----------|---------|----------|
| `` ` `` | Toggle selector mode | — |
| `Escape` | Close panel / cancel | Also: dismiss palette, context menu, tooltips |
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

### Event Routing Rules

New features introduce pointer event conflicts. Resolution:

1. **Command palette** renders inside `.__tuner-root` (avoids shortcut key leakage)
2. **Context menu** listens on `contextmenu` event (separate from `click` handler in `handlePageClick`)
3. **All page overlays** use `pointerEvents: "none"` (same as GridOverlay pattern)
4. **Palette/context menu typing** — shortcut handler already bails on `<input>`, `<textarea>`, `<select>` tags; palette search renders as `<input>` inside `.__tuner-root`

### Diff Mode Behavior

All new features respect diff mode:
- Overlays show **original** (pre-override) values during diff peek (this is useful — shows what would revert)
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
- Fuzzy search using simple substring + word-boundary scoring (no library needed)
- Result types: `property` (scrolls panel + focuses control), `section` (scrolls + expands), `action` (executes)
- Arrow keys navigate results, Enter selects, Escape dismisses
- ARIA: `role="combobox"` with `aria-activedescendant` on results

**Data source:** Static registry of all properties/sections/actions with display names and keywords:
```tsx
// Example entries
{ type: "property", label: "Font Size", section: "typography", keywords: ["font-size", "text size", "fs"] }
{ type: "section", label: "Backgrounds", keywords: ["bg", "background", "image", "gradient"] }
{ type: "action", label: "Copy CSS", shortcut: "Cmd+C", handler: () => handleCopyCSS() }
```

**Edge cases:**
- Only activates when `selectedEl` is non-null (panel is open)
- Does NOT intercept Cmd+K when any `<input>` or `<textarea>` has focus (let browser handle)
- Dismissed by: Escape, click outside, selecting a result
- During diff mode: disabled (early return)
- During scrub: disabled (check `isScrubActive()`)

**Acceptance criteria:**
- [ ] Cmd+K opens palette when panel is open, no input focused
- [ ] Typing filters results with fuzzy matching
- [ ] Selecting a property scrolls panel to that section and focuses the control
- [ ] Selecting an action executes it (Save, Reset, Copy CSS, etc.)
- [ ] Arrow keys + Enter for keyboard-only usage
- [ ] Escape dismisses, focus returns to previously focused element
- [ ] ARIA combobox role with activedescendant

---

#### Feature 2: Inline Property Search (`/` to focus)

**What:** A sticky search bar at the top of the panel's scrollable area. Typing filters visible sections — non-matching sections collapse, matching sections expand with matching controls highlighted.

**Implementation:**
- Add search input inside `WebflowPanel.tsx` at the top of the scroll container (below header, above sections)
- Search state: `searchQuery` string in `WebflowPanel`
- Each `Section` component receives a `hidden` prop — when search is active and no controls match, the section is `display: none`
- Matching is per-property label (substring, case-insensitive)
- When search is cleared (empty string), all sections restore their previous collapse state
- `/` key focuses the search input (only when panel has focus, no other input focused)

**Acceptance criteria:**
- [ ] Search input visible at top of panel scroll area
- [ ] Typing filters sections — non-matching sections hidden entirely
- [ ] Matching sections auto-expand, matching control labels highlighted (yellow bg)
- [ ] Clearing search restores previous collapse state
- [ ] `/` key focuses search input from anywhere in panel
- [ ] Escape in search input clears and blurs

---

#### Feature 3: Section Minimap

**What:** A thin (16px) vertical strip on the left edge of the panel showing one dot per section. Dot color indicates override status. Click to scroll to that section.

**Implementation:**
- Rendered inside the panel container, positioned absolutely on the left edge
- One 8px dot per section, vertically distributed to match section positions
- Dot colors: gray (no overrides), indigo (has overrides), orange (inherited overrides)
- Uses existing `sectionInd()` helper to determine indicator type per section
- Click handler calls `scrollIntoView({ behavior: 'smooth' })` on the section header
- Active section (currently scrolled to) gets a slightly larger dot (10px) or brighter color

**Acceptance criteria:**
- [ ] 16px vertical strip on left edge of panel
- [ ] One dot per section, colored by override status
- [ ] Click dot scrolls to that section smoothly
- [ ] Active (visible) section dot is visually distinct
- [ ] Minimap updates when overrides change

---

### Phase II — Visual Feedback Overlays

These render on the actual page, providing spatial context for CSS values.

#### Feature 4: Spacing Guide Overlay

**What:** When hovering a margin/padding value in the SpacingBoxModel, a colored semi-transparent overlay appears on the actual page element showing the real spacing area.

**Implementation:**
- New file: `src/overlay/SpacingGuideOverlay.tsx`
- Activated by: hover or focus on any value in `SpacingBoxModel`
- Reads `getComputedStyle()` for margin/padding values + `getBoundingClientRect()` for element position
- Renders colored rectangles:
  - Margin zones: `rgba(255, 152, 87, 0.25)` (warm orange, matches SpacingBoxModel)
  - Padding zones: `rgba(87, 168, 255, 0.25)` (cool blue, matches SpacingBoxModel)
- Only shows the specific side being hovered (e.g., hover "margin-left" → only left margin area highlighted)
- Position tracked via RAF loop (same pattern as element outline)
- Dimension label: small floating text showing "24px" on the highlighted zone
- Z-index: `2147483644`

**Edge cases:**
- Element partially off-screen: clip overlay to viewport
- During diff peek: show original spacing values
- During scrub: update in real-time as value changes
- `pointerEvents: "none"` — clicks pass through

**Acceptance criteria:**
- [ ] Hover margin value → orange overlay on page shows margin area for that side
- [ ] Hover padding value → blue overlay shows padding area for that side
- [ ] Overlay includes dimension label (e.g., "24px")
- [ ] Real-time update during label scrub drag
- [ ] Overlay disappears on mouse leave
- [ ] Works with both hover and keyboard focus

---

#### Feature 5: Flex Visualizer

**What:** When the selected element is a flex container, semi-transparent bars appear overlaid on each flex child showing their proportional sizes.

**Implementation:**
- New file: `src/overlay/FlexVisualizer.tsx`
- Toggle button in Layout section (next to grid overlay toggle) — "Show Flex" with Rows icon
- For each direct child of the flex container:
  - Read `getComputedStyle()` for `flexGrow`, `flexShrink`, `flexBasis`, and computed width/height
  - Render a colored bar inside the child's bounding rect
  - Bar width proportional to `flex-grow` (relative to siblings' total grow)
  - Label: "grow: 1 | basis: auto" tooltip on hover
- Color: `rgba(99, 102, 241, 0.15)` (indigo tint) with bottom border
- RAF loop for position tracking
- Z-index: `2147483644`

**Edge cases:**
- All children have `flex-grow: 0` → show basis-proportional bars instead
- `flex-basis: auto` → use computed width as the proportion
- Flex direction column → bars are vertical
- During scrub of flex properties → bars update in real-time

**Acceptance criteria:**
- [ ] Toggle button appears when display is flex/inline-flex
- [ ] Colored proportion bars appear on each flex child
- [ ] Bars update in real-time when flex properties change
- [ ] Hover bar shows grow/shrink/basis tooltip
- [ ] Column direction renders vertical bars
- [ ] `pointerEvents: "none"` — clicks pass through

---

#### Feature 6: Element Measurement Labels

**What:** A floating "W × H" label appears near the selected element showing its computed dimensions.

**Implementation:**
- Add to existing element outline system in `Overlay.tsx`
- Small label positioned at the bottom-right corner of the element outline
- Shows: `"320 × 48"` (rounded integers, no units — pixels implied)
- Background: `rgba(99, 102, 241, 0.9)` (indigo), text: white, font-size: 10px, padding: 2px 5px, border-radius: 3px
- Updates via the existing RAF loop that tracks the element outline (no additional RAF)
- When element is being resized (width/height scrub active), label updates in real-time

**Acceptance criteria:**
- [ ] Label visible near bottom-right of selected element outline
- [ ] Shows computed width × height as integers
- [ ] Updates in real-time during width/height adjustments
- [ ] Repositions correctly on scroll/resize
- [ ] Doesn't overflow viewport (flips to inside if at edge)

---

### Phase III — Context & Efficiency

These reduce friction for common operations.

#### Feature 7: Right-Click Context Menu

**What:** Right-clicking the selected element on the page shows a custom context menu with quick actions.

**Implementation:**
- New file: `src/overlay/ContextMenu.tsx`
- Listen for `contextmenu` event on `document` in `Overlay.tsx` (capture phase)
- Only show custom menu when right-click target is the currently selected element (or within it)
- For all other elements: allow native browser context menu (no `preventDefault`)
- Menu items:
  - Copy CSS (`formatCSSDiff` → clipboard)
  - Copy Tailwind (`formatTailwindDiff` → clipboard)
  - Copy Selector (element tag + classes)
  - Reset Element (calls `reset()`)
  - Select Parent (navigate to `parentElement`)
  - Open in Editor (click source file link)
- Menu renders inside `.__tuner-root`, positioned at click coordinates
- Dismissed by: click outside, Escape, selecting an item
- ARIA: `role="menu"` with `role="menuitem"` children

**Edge cases:**
- Menu near viewport edge → flip to fit (same logic as color picker positioning)
- During diff mode: disabled
- During scrub: disabled
- Multiple rapid right-clicks: dismiss previous before showing new

**Acceptance criteria:**
- [ ] Right-click on selected element shows custom context menu
- [ ] Right-click elsewhere shows native browser menu
- [ ] All 6 menu items functional
- [ ] Escape dismisses menu
- [ ] ARIA menu roles
- [ ] Viewport-aware positioning

---

#### Feature 8: Value Presets / Quick Picks

**What:** When a numeric input receives focus, a row of common value chips appears below it. Clicking a chip applies the value instantly.

**Implementation:**
- Add to `ValueInput` component in `controls.tsx` as an absolutely-positioned dropdown
- Preset registry per property type:
  - **Size properties** (width, height, etc.): `auto`, `0`, `50%`, `100%`, `fit-content`
  - **Spacing properties** (margin, padding): `0`, `4`, `8`, `12`, `16`, `24`, `32`, `auto`
  - **Typography** (font-size): `12`, `14`, `16`, `18`, `20`, `24`, `32`, `48`
  - **Opacity**: `0`, `0.25`, `0.5`, `0.75`, `1`
  - **Border-radius**: `0`, `4`, `8`, `12`, `9999` (full round)
- Chips: 22px tall, `rgba(255,255,255,0.06)` background, 3px border-radius, monospace font
- Chip hover: `rgba(255,255,255,0.12)` background
- Only visible on focus (not always) — prevents vertical bloat
- Positioned absolutely below the input, z-index above sibling controls

**Edge cases:**
- Input near bottom of panel: flip presets above the input
- During diff mode: disabled (inputs are read-only)
- Keyword values like "auto": set value AND toggle any keyword state (e.g., `widthAuto`)

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
- New file: `src/overlay/Tooltip.tsx` — singleton tooltip component
- Tooltip registry: static map of property name → description string (~50 entries)
- Trigger: `onMouseEnter` starts 500ms timer, `onMouseLeave` clears timer and hides
- Position: above the label, centered, with 6px arrow pointing down
- Style: `rgba(30,30,30,0.95)` background, `rgba(255,255,255,0.9)` text, 11px font, 6px padding, max-width 200px
- Fade in: 100ms opacity transition
- Singleton pattern: only one tooltip visible at a time (moving between labels swaps instantly after initial delay)
- Add `data-tooltip` attribute to labels in `SliderRow`, `SelectRow`, `ColorRow`, section headers

**Example tooltips:**
```
font-size → "Sets the size of the text. Common values: 14-18px for body, 24-48px for headings."
flex-grow → "How much this element should grow relative to siblings. 0 = don't grow, 1 = fill available space."
backdrop-filter → "Applies effects (blur, brightness) to the area behind this element."
```

**Acceptance criteria:**
- [ ] Hover label for 500ms → tooltip appears above label
- [ ] Moving to adjacent label → tooltip swaps instantly (no re-delay)
- [ ] Mouse leave → tooltip fades out
- [ ] Max 200px width, text wraps cleanly
- [ ] Works on section headers too
- [ ] Does not interfere with label scrub (tooltip hides on pointerdown)

---

#### Feature 10: Property Value History

**What:** Each numeric input has a small clock icon. Clicking it shows the last 8 values used for that CSS property (across all elements).

**Implementation:**
- Storage: `localStorage` under `__tuner-value-history` key, JSON object keyed by CSS property name
- Each property stores last 8 unique values (newest first), evicting oldest on overflow
- Values recorded on: `applyInlineStyle()` in `apply.ts` (hook into existing function)
- UI: small clock icon (12px) at right edge of `ValueInput`, visible on hover
- Click opens a dropdown (max 8 items) showing previous values
- Click a history item → applies it as the current value
- Total storage cap: 50 properties max (evict least-recently-used property when exceeded)

**Acceptance criteria:**
- [ ] Values automatically recorded when applied
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
- Add to `Header.tsx` — small inline badge next to the source file link
- Shows: `"1280px"` with a breakpoint label like `"xl"` based on common tiers:
  - `< 640px` → `sm`
  - `640–767px` → `md`
  - `768–1023px` → `lg`
  - `1024–1279px` → `xl`
  - `>= 1280px` → `2xl`
- Updates on `window.resize` (debounced 100ms)
- Badge style: monospace, `rgba(255,255,255,0.4)` text, `rgba(255,255,255,0.06)` bg, 3px border-radius
- Optional: click badge to show a dropdown listing all `@media` rules affecting the selected element (parsed from `document.styleSheets`)

**Acceptance criteria:**
- [ ] Badge shows viewport width + breakpoint tier label
- [ ] Updates on window resize
- [ ] Styled consistently with existing header elements
- [ ] Optional: click to see matching @media rules

---

#### Feature 12: Computed Values View

**What:** A toggle button in the footer switches the panel to a read-only "Computed" view showing all resolved CSS values, like Chrome DevTools' Computed tab.

**Implementation:**
- Toggle button in `Footer.tsx`: "Computed" / "Edit" with `showComputed` state lifted to `Overlay.tsx`
- When active, `WebflowPanel` renders a flat alphabetical list instead of the sectioned controls
- Each row: property name (left, `rgba(255,255,255,0.5)`) + resolved value (right, `rgba(255,255,255,0.85)`)
- Source: `getComputedStyle(element)` iterated via `for (let i = 0; i < cs.length; i++) { cs[i] }`
- Filter out vendor-prefixed properties (starting with `-webkit-`, `-moz-`) by default, toggle to show
- Search/filter from Feature 2 works here too
- Values that differ from the element's parent are highlighted (indicating non-inherited)
- Click any value to copy it to clipboard

**Acceptance criteria:**
- [ ] Toggle button switches between Edit and Computed views
- [ ] Computed view shows all resolved values alphabetically
- [ ] Vendor-prefixed properties hidden by default
- [ ] Search filter works in Computed view
- [ ] Click value to copy to clipboard
- [ ] Non-inherited values visually distinguished

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

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| RAF loop proliferation (4+ concurrent loops) | Measurement labels reuse the existing outline RAF loop; spacing guide only runs during hover |
| localStorage bloat (value history + swatches + session) | Per-feature caps: 50 properties × 8 values = ~20KB max for history |
| Keyboard shortcut collisions | Palette renders inside `.__tuner-root`; all new shortcuts guarded by `!insidePanel && !isInput` checks |
| Panel width pressure from minimap | Minimap is 16px inside existing 300px; section content area reduces to 284px — acceptable |

## References

### Internal
- Overlay lifecycle: `src/overlay/Overlay.tsx`
- Panel sections: `src/overlay/WebflowPanel.tsx`
- Existing overlay pattern: `src/overlay/GridOverlay.tsx`
- Style application: `src/overlay/apply.ts`
- Timing tokens: `src/overlay/timing.ts`
- Spacing box model: `src/overlay/SpacingBoxModel.tsx`
- Keyboard shortcuts: `src/overlay/Overlay.tsx` (capture-phase keydown handler)

### Spec Sections
- Panel Shell: `webflow-style-panel-spec.md` §1
- Input Controls: `webflow-style-panel-spec.md` §12
- Keyboard Patterns: `webflow-style-panel-spec.md` §13
