# Redial — Development Timeline

A floating CSS tuning panel for Next.js. Click any element, get context-aware controls, drag to tune, save directly to source files.

**3,570 lines of TypeScript** across 19 source files. Two runtime dependencies: DialKit + Motion.

---

## Phase 1 — Core Loop

The foundation: click an element, see controls, drag to tune, save to source.

### Next.js Plugin (`next-plugin.cjs`)

A `withTuner()` wrapper for `next.config.js` that enables CSS source maps in dev mode for the commit flow. Production builds are a no-op passthrough. The panel injects itself as a `<TunerOverlay />` component inside the app's layout.

### Selector (`Selector.tsx`)

Full-viewport invisible overlay activated by the backtick key. Hover highlights elements with an indigo outline positioned via `getBoundingClientRect()`. Click captures the element and hands it to `infer()`. Escape cancels. The selector correctly ignores tuner-internal elements, `<html>`, and `<body>`.

### Local Inference Engine (`infer.ts`)

The intelligence layer. Takes a DOM element, reads `getComputedStyle()`, and generates a DialKit-native `DialConfig` object with context-aware control sections:

- **Typography** — font-size, weight, line-height, letter-spacing, color (only for text-bearing elements)
- **Spacing** — padding and margin for all 4 sides, with a "Reset" action button
- **Layout** — flex-direction, justify-content, align-items, flex-wrap, gap (only for flex/grid containers)
- **Size** — object-fit, width, height (only for images, video, canvas)
- **Appearance** — background-color, border-radius, opacity, visibility, pointer-events, border controls

Slider ranges are magnitude-aware: a 16px font-size gets a range of 8–40px, while a 1px border gets 0–3px. Runs in <1ms with zero network calls.

### Inline Style Engine (`apply.ts`)

Every slider drag calls `applyInlineStyle()` which:
1. Captures the initial computed value (for amber dirty indicators and reset)
2. Pushes to the undo stack
3. Sets the inline style with `!important`

Also provides: `undo()`, `reset()`, `resetAll()`, `diff()`, `diffAll()`, `isDirty()`, `stripAllOverrides()`/`restoreAllOverrides()` (for diff peek mode), and `clearRedundantOverrides()` (for HMR auto-reset).

### Direct File Commit (`commit.ts`)

Server-side surgical string replacement. Receives `{ prop, from, to, sourceFile, sourceLine }` changes from the browser, finds the property in the source file using a 4-tier search strategy, and replaces only the value.

**Tier 1 — Window search**: ±5 lines around the expected source line.
**Tier 2 — Class-block search**: find `.className { }` and search within its braces.
**Tier 3 — Full-file search**: `prop + value` anywhere in the file.
**Tier 4 — Fuzzy search**: just the property name (handles SCSS variables, calc(), etc.).

Batches writes per-file. Reports failures with specific reasons ("value not found literally — may be a variable").

### Dev Server Route (`server/index.ts`)

Express-style handler at `/__tuner/commit` that receives POST requests from the browser's Save button and delegates to `commit.ts`. Returns `{ written, failed }`.

### HMR Auto-Reset (`hmr.ts`)

Unified listener for Turbopack (`turbopack:afterUpdate`), Vite (`vite:afterUpdate`), and webpack (`module.hot.addStatusHandler`). After HMR fires, `clearRedundantOverrides()` checks each override: temporarily removes the inline style, reads the real computed value, and if the source caught up, removes the override permanently. Debounced at 100ms.

### Styles (`styles.css`)

Panel scrollbar styling and DialKit overrides scoped to `.__tuner-root`. Custom accent color for DialKit slider fills (`#E8764B`).

### Unit Tests (`commit.test.ts`)

Node.js native test runner (`--experimental-strip-types`) for the commit flow. Tests cover the 4-tier search strategy, surgical replacement, fuzzy matching, and edge cases.

---

## Phase 2 — Chrome + Navigation

Custom header/footer around DialKit's control folders. Element navigation and diff preview.

### Header (`Header.tsx`)

Displays element tag + CSS module class name (e.g., `button.btn`), source file link (resolved from React fiber `_debugSource`), a session badge showing total change count, and a draggable handle for repositioning the panel.

**Breadcrumb navigation**: Shows ancestor path (e.g., `main > div > button.btn`). Click any segment to navigate to that ancestor element.

**Scope toggle**: Radio pills to switch between "element" scope (inline styles on the clicked element) and "class" scope (injects a `<style>` tag targeting the CSS module classname, affecting all instances).

### Footer (`Footer.tsx`)

**Reset** — clears all overrides for the selected element.
**Copy** — copies the diff as CSS to clipboard.
**Save** — POSTs changes to `/__tuner/commit` and shows result.
**Diff peek** — hold `D` to temporarily strip all overrides and see the original state. Release to restore. Also available as a toggle button.

### Session Drawer (`SessionDrawer.tsx`)

Expandable drawer showing all modified elements across the entire session. Each element shows its tag, class name, and change count. Click to navigate to that element. Provides "Copy All", "Save All", and "Reset All" actions.

### Scope System (`scope.ts`)

Element-level and class-level style application.

**Element scope**: `applyInlineStyle()` sets styles directly on the DOM node.
**Class scope**: `applyClassStyle()` maintains a managed `<style>` tag in `document.head`, rebuilding CSS rules from a `classOverrides` map. Targets CSS module classnames (webpack: `Button_btn__a8f2k`, Turbopack: `page-module__IiFEKa__btnPrimary`).

### Source Map Resolution (`sourcemap.ts`)

Resolves where an element's styles come from:
1. Walks the React fiber tree (`__reactFiber$`) to find `_debugSource` (file + line from SWC/Babel transforms)
2. Falls back to CSS class name conventions to derive source file paths (e.g., `Button_btn__a8f2k` → `Button.module.scss`)

### Shared Utilities (`util.ts`)

- `getDisplayClass()` — extracts readable class names from CSS module hashes
- `buildBreadcrumb()` — builds ancestor path for navigation
- `getSelector()` — CSS selector for display/copy
- `getStableSelector()` — full `tag:nth-child(n)` path for session persistence

### Panel Bridge (`Panel.tsx`)

Maps DialKit's `useDialKit()` hook to the override system. Routes `onChange` events through scope: element scope calls `applyInlineStyle()`, class scope calls `applyClassStyle()`, and custom property scope calls `applyCustomProperty()`.

Converts DialKit values back to CSS strings using `toCSSValue()` and `PX_PROPS` from `infer.ts`.

---

## Phase 3 — Viewport + Polish

### Viewport Preview (`ViewportBar.tsx`)

Preset breakpoint buttons (Mobile 375px, Tablet 768px, Desktop 1024px) that constrain the page content to a max-width, simulating responsive breakpoints without resizing the browser. Re-infers the selected element after width change so slider values update to the new computed styles.

### Arrow Key Navigation

With an element selected, arrow keys navigate the DOM tree:
- **Up** → parent element
- **Down** → first child
- **Left** → previous sibling
- **Right** → next sibling

The persistent indigo outline follows the selection, repositioned via `requestAnimationFrame` loop.

### Diff Hold-to-Peek

Press and hold `D` to strip all inline overrides and see the original page. Release to restore. The panel border turns yellow during diff mode, and controls are dimmed and non-interactive.

---

## Phase 4 — Session Persistence + CSS Custom Properties

The latest improvements, focused on workflow continuity and design token support.

### Session Persistence via localStorage (`apply.ts`, `util.ts`, `Overlay.tsx`)

**Problem**: Every page refresh, HMR reload, or navigation wiped all accumulated CSS changes.

**Solution**: Serialize the `overrides` Map to localStorage on every change. On mount, restore overrides and re-apply inline styles.

- `getStableSelector(el)` — generates a unique CSS path like `body > div:nth-child(1) > main:nth-child(2) > h1:nth-child(1)` that survives reloads
- `schedulePersist()` — debounced at 16ms (one animation frame) to avoid thrashing during rapid slider drags
- `persistToStorage()` — serializes to `localStorage` keyed by `__tuner_session:{pathname}`, so each route maintains an independent session
- `restoreSession()` — resolves elements by stored selectors, re-applies inline styles, returns count of restored properties
- 100KB max size guard to prevent runaway storage
- `resetAll()` clears the persisted session

### CSS Custom Property Detection & Editing (`scope.ts`, `infer.ts`, `apply.ts`, `Panel.tsx`, `commit.ts`)

**Problem**: Modern codebases use CSS custom properties (`--color-primary`, `--spacing-md`) everywhere. The tuner couldn't see or edit them.

**Detection** (in `scope.ts`):
1. Walk `document.styleSheets` to find rules matching the element, check property values for `var(--name)` references
2. Check inline styles for `var()` references
3. Collect `:root` and ancestor custom properties
4. Resolve each variable's definition scope by walking up the DOM

**Controls** (in `infer.ts`):
- Color-valued custom properties (`#hex`, `rgb()`, `hsl()`) → color picker controls
- Numeric-valued custom properties (`16px`, `1.5rem`, `0.8`) → slider controls with unit tracking
- Variables section starts collapsed by default

**Application** (in `apply.ts` + `Panel.tsx`):
- `applyCustomProperty(scope, name, value)` — sets `style.setProperty(name, value)` on the variable's definition scope (e.g., `documentElement` for `:root`)
- Changes propagate to every element using that variable — editing `--color-primary` on `:root` updates the entire page
- Integrates with the undo stack and session persistence

**Commit** (in `commit.ts`):
- New `searchRootBlock()` strategy — finds custom property definitions inside `:root {}` and `[data-theme]` blocks
- Inserted as a priority search tier for `--*` properties, before class-block and full-file search

---

## Phase 5 — DialKit-Native Architecture

Eliminated the parallel type system between redial and dialkit. `infer()` now speaks dialkit's native config language, and `Panel.tsx` uses `useDialKit()` directly instead of manual control rendering.

### Return Type Migration (`infer.ts`)

**Before**: `infer()` returned `Section[]` with custom `Control` union types (`SliderControl | ColorControl | SelectControl`). Panel.tsx manually mapped each control kind to a dialkit component.

**After**: Returns `{ config: DialConfig, name: string, varUnits: Record<string, string> }` — a dialkit-native config object passed directly to `useDialKit()`.

Sections become nested objects (dialkit renders these as collapsible folders). Controls are expressed in dialkit's value-shape convention:

| Value shape | Control type |
|---|---|
| `[value, min, max, step]` | Slider |
| `boolean` | Toggle |
| `{ type: "color", default }` | Color picker |
| `{ type: "select", options }` | Select dropdown |
| `{ type: "text", default }` | Text input |
| `{ type: "spring", visualDuration, bounce }` | Spring control |
| `{ type: "action", label }` | Action button |

### Magnitude-Based Slider Ranges (`infer.ts`)

Replaced the flat `Math.max(64, value * 3)` formula with dialkit's value-magnitude table:

| Value | Min | Max | Step |
|---|---|---|---|
| 0–1 | 0 | 1 | 0.01 |
| 1–10 | 0 | value × 3 | 0.1 |
| 10–100 | 0 | value × 3 | 1 |
| 100+ | 0 | value × 3 | 10 |

Domain-specific properties override the table: font-weight stays 100–900 step 100, line-height stays 0.8–2.5 step 0.05, etc.

### New Control Types (`infer.ts`)

- **Toggles** — `visibility` and `pointer-events` are booleans, rendered as On/Off toggles. `TOGGLE_CSS` maps true/false back to CSS values (`auto`/`none`, `visible`/`hidden`).
- **Text input** — `font-family` renders as a text field via `TextConfig`.
- **Spring control** — Elements with CSS `transition` get an interactive spring config (`visualDuration` + `bounce`) with dialkit's visual preview. Applied via `applyTransition()` which approximates spring params as `cubic-bezier`.
- **Action buttons** — "Reset" in Spacing, "Center" and "Fill Parent" in Layout. Handled via `useDialKit`'s `onAction` callback.
- **`{value, label}` selects** — `flex-start` displays as "Start", `space-between` as "Between", etc.
- **`_collapsed` metadata** — Appearance collapses by default on text elements without visible backgrounds. Variables always starts collapsed.

### useDialKit() Integration (`Panel.tsx`)

Replaced ~230 lines of manual `ControlRenderer` / `SliderRenderer` / `ColorPickerControl` / `SelectPickerControl` with a single `useDialKit(name, config, { onAction })` call + `<DialRoot mode="inline" />`.

A `useEffect` diffs resolved values against the previous render and routes changes through the existing apply system:
- Regular CSS props → `applyInlineStyle()` or `applyClassStyle()` (respects scope toggle)
- Custom properties (`--*`) → `applyCustomProperty()` on the variable's definition scope
- Spring configs → `applyTransition()` (new in `apply.ts`)

Skips the first render to avoid redundantly applying initial computed values.

**Free from dialkit**: presets (save/load parameter snapshots per element), JSON copy to clipboard, dynamic config updates on HMR, spring animation controls with visual preview.

### New apply.ts Functions

- `resetProp(el, prop)` — per-property reset for action buttons, with proper undo stack cleanup
- `applyTransition(el, config)` — converts spring/easing configs to CSS `transition` via cubic-bezier approximation

---

## Architecture

```
redial/
├── next-plugin.cjs              # withTuner() wrapper for next.config.js
├── src/
│   ├── index.tsx                 # Public API exports
│   ├── styles.css                # Panel + DialKit overrides
│   ├── types.d.ts                # HMR type declarations
│   ├── overlay/
│   │   ├── Overlay.tsx           # Orchestrator: hotkeys, selection, panel lifecycle
│   │   ├── Selector.tsx          # Click-to-inspect hover overlay
│   │   ├── Header.tsx            # Element name, source file, breadcrumbs, scope toggle
│   │   ├── Footer.tsx            # Save, Copy, Reset, Diff buttons
│   │   ├── Panel.tsx             # DialKit ↔ override system bridge
│   │   ├── SessionDrawer.tsx     # Session-wide element list + batch actions
│   │   ├── ViewportBar.tsx       # Responsive breakpoint preview
│   │   ├── infer.ts              # DOM element → DialKit config (the intelligence layer)
│   │   ├── apply.ts              # Inline styles, undo stack, diff, session persistence
│   │   ├── scope.ts              # Element/class/variable scope + custom property detection
│   │   ├── sourcemap.ts          # React fiber + class convention → source file resolution
│   │   ├── util.ts               # Display helpers, breadcrumbs, stable selectors
│   │   └── hmr.ts                # Turbopack/Vite/webpack HMR listener
│   └── server/
│       ├── index.ts              # Dev-only API route handler
│       ├── commit.ts             # 4-tier source file search + surgical replacement
│       └── __tests__/
│           └── commit.test.ts    # Unit tests for the commit flow
└── test-app/                     # Next.js test application
    ├── app/
    │   ├── page.tsx              # Demo page with various element types
    │   ├── globals.css           # CSS custom properties for variable detection testing
    │   ├── page.module.css       # CSS modules for scope testing
    │   ├── layout.tsx            # Root layout
    │   └── tuner-provider.tsx    # Mounts the Tuner overlay
    └── next.config.ts            # Uses withTuner() plugin
```

---

## Phase 6 — Save Pipeline Fix, Scope Toggle Wiring, Test Coverage (2026-03-10)

Three fixes that unblock real usage of Save and the scope toggle.

### Save Pipeline Fix (`commit.ts`, `sourcemap.ts`, `Footer.tsx`, `SessionDrawer.tsx`)

**Problem**: Save failed for most files. `deriveSourceFromClassName()` returned `line: 0`, and `change.sourceLine ?? fallback` used nullish coalescing — `0` is not nullish, so the fallback never fired. The server searched only lines 0–5 and missed the property. Additionally, bare filenames like `"Page.module.scss"` couldn't resolve via `path.resolve(cwd, name)`.

**Fix — client side**: `sourcemap.ts` now returns `line: undefined` instead of `line: 0`. New `getModuleClassInfo(el)` extracts the readable class name and component name from CSS module classes.

**Fix — server side**: `resolveSourceFile()` recursively searches the project tree when given a bare filename, excluding `node_modules`/`.next`/`dist`/etc. Component name hints disambiguate when multiple files match. Footer and SessionDrawer now send `className` and `componentName` alongside source info, enabling the class-block search tier to pick the correct rule block.

### Scope Toggle Wiring (`Overlay.tsx`, `Header.tsx`, `Panel.tsx`, `Footer.tsx`)

**Problem**: `scope.ts` was fully implemented (`applyClassStyle`, `resetClassStyles`, `destroyClassStyles`) but never imported by any UI file.

**Fix**: `Overlay.tsx` now owns `scope`, `activeClassName`, and `cssClasses` state. `Header.tsx` renders scope pill buttons when CSS module classes are detected on the selected element. `Panel.tsx` routes `applyStyle()` through scope — element scope calls `applyInlineStyle()`, class scope calls `applyClassStyle()`. `Footer.tsx` calls `resetClassStyles()` alongside `reset()` when in class scope. Scope resets on element change and panel close.

### Header Deduplication (`Header.tsx`)

Replaced the inline `getSourceFile()` fiber walker (duplicate of `getReactSource()` in sourcemap.ts) with the shared import.

### Test Suite (`commit.test.ts`)

24 test cases using Node.js native test runner (`--experimental-strip-types`). Covers:

- `findPropertyInFile` — all 4 search tiers, SCSS variables, custom properties in `:root`, `sourceLine=0` skip
- `resolveSourceFile` — direct paths, bare filenames, component hints, `node_modules` exclusion, disambiguation
- `handleCommit` — integration tests with real filesystem I/O: good source info, missing line, bare filename resolution, SCSS variable graceful failure, multi-change batching, missing files, class-scoped disambiguation

---

## Roadmap

Remaining improvements ranked by developer impact:

| # | Improvement | Status |
|---|------------|--------|
| 1 | Session Persistence | Done |
| 2 | CSS Custom Property Detection | Done |
| 3 | Keyboard Element Selection | Done |
| 4 | Inline Diff Preview | Done |
| 5 | Save Pipeline Fix | Done |
| 6 | Scope Toggle Wiring | Done |
| 7 | Unit Test Foundation | Done |
| 8 | Centralize Theme Constants | Planned |
| 9 | Source Map Parsing (real `.map` files) | Planned |
| 10 | Silent Failure Diagnostics | Planned |
| 11 | Class-scope undo stack | Planned |
| 12 | Class-scope dirty indicators | Planned |
