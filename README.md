# Redial

A floating Webflow-style CSS tuning panel for Next.js. Click any element, get context-aware controls, drag to tune, save directly to your source files.

DevTools changes vanish on reload. AI coding tools add minutes of latency per visual tweak. Redial gives you the direct-manipulation workflow that Webflow proved essential — but inside your own Next.js codebase, writing changes straight to your source files.

**Status: Pre-release — API may change.**

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  1. Press ` (backtick) to enter selection mode           │
│  2. Click any element on the page                        │
│  3. A floating panel appears with CSS controls           │
│  4. Drag sliders, pick colors, toggle properties         │
│  5. Changes apply instantly via inline styles             │
│  6. Hit Save → changes write to your actual source files │
└─────────────────────────────────────────────────────────┘
```

Redial reads `getComputedStyle()` from the selected element, generates context-aware controls (flex elements get flex controls, text elements get typography, etc.), and presents them in a panel modeled after the [Webflow Designer](https://webflow.com/designer). When you save, it traces back to your source files via CSS source maps and does a surgical string replacement.

### Architecture

```
DOM Element
    │
    ▼
┌──────────┐     ┌──────────────┐     ┌────────────────┐
│ infer.ts │────▶│ WebflowPanel │────▶│    apply.ts    │
│ (read)   │     │ (render)     │     │ (inline style) │
└──────────┘     └──────────────┘     └───────┬────────┘
                                              │ Save
                                              ▼
                                      ┌──────────────┐     ┌─────────┐
                                      │  commit.ts   │────▶│ Source  │
                                      │ (file write) │     │  Files  │
                                      └──────────────┘     └─────────┘
                                              │
                                              ▼
                                           HMR reload
```

Three layers:

- **Intelligence** (`infer.ts`) — Reads `getComputedStyle()` from the selected DOM element and generates a configuration object describing what controls to show and their current values.
- **Rendering** (`WebflowPanel.tsx` + section components) — Renders the panel with 8 CSS sections plus a CSS Variables section. Each section contains sliders, color pickers, dropdowns, and toggle groups.
- **Persistence** (`apply.ts` → `commit.ts`) — Applies changes as inline styles with an undo stack. On save, traces the CSS property back to its source file and performs a surgical replacement. Next.js HMR picks up the file change immediately.

---

## Install

```sh
npm install github:SkylarKitchen/redial
```

## Setup

Three steps to add Redial to any Next.js project:

### 1. Next.js plugin (webpack only)

With Turbopack — the `next dev` default since Next 15 — **skip this step**: Turbopack already emits the CSS source maps Redial uses to trace styles back to their source files. Only add the plugin if you develop with `next dev --webpack`, where it enables full source maps:

```js
// next.config.js
const withTuner = require("redial/next-plugin");

module.exports = withTuner({
  // your existing config
});
```

Either way, saving still works without source maps — Redial falls back to searching your source files — they just make the trace more accurate.

### 2. API route

The server-side handler that writes CSS changes to your source files.

```ts
// app/api/tuner/[...path]/route.ts
export { GET, POST } from "redial/server";
```

### 3. Component

Drop the `<Tuner />` component into your root layout. It only renders in development.

```tsx
// app/layout.tsx
import { Tuner } from "redial";
import "redial/styles.css";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <Tuner />}
      </body>
    </html>
  );
}
```

---

## Panel Sections

The panel mirrors the [Webflow Designer's style panel](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview) with 8 CSS sections:

| Section | Properties | Key Controls |
|---------|-----------|--------------|
| **Layout** | `display`, `flex-direction`, `justify-content`, `align-items`, `gap`, `flex-wrap` | 3×3 alignment grid, display type selector, flex/grid child controls |
| **Spacing** | `margin-*`, `padding-*` | Visual box model diagram with click-to-edit values |
| **Size** | `width`, `height`, `min-*`, `max-*`, `overflow`, `object-fit` | Sliders with unit selectors (px, %, vw, vh, em, rem) |
| **Position** | `position`, `top/right/bottom/left`, `z-index` | Visual offset diagram, contextual controls |
| **Typography** | `font-size`, `font-weight`, `line-height`, `letter-spacing`, `color`, `text-align`, `text-transform` | Color picker, icon button groups, font selector |
| **Backgrounds** | `background-color`, `background-image`, gradients | Multi-layer support, gradient editor, color picker with opacity |
| **Borders** | `border-*`, `border-radius` | Side selector tabs, linked/unlinked corner radius, color picker |
| **Effects** | `opacity`, `box-shadow`, `transform`, `filter`, `backdrop-filter`, transitions | Shadow editor, transform editor, filter sliders, bezier curve editor |

Each section is context-aware — flex controls only appear when the element is `display: flex`, typography only appears for text-bearing elements, etc.

A **CSS Variables** section also appears when the selected element uses custom properties, letting you tune `--var` values directly.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `` ` `` | Toggle selection mode |
| `Esc` | Close panel / cancel selection |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+S` | Save changes to source files |
| `Cmd+C` | Copy CSS |
| `Cmd+K` | Command palette |
| `D` (hold) | Diff peek — strips overrides while held |
| `S` | Cycle scope (element → class) |
| `R` | Reset current element |
| `↑` / `↓` | Navigate sections |
| `Tab` | Move between controls |

**Label-drag scrubbing:** Click and drag on any property label (e.g. the word "Width") to scrub its value — the same signature interaction from Webflow. Hold `Shift` for 10× speed, `Alt` for 0.1× fine control.

---

## Features

### Scoping

Toggle between **element** scope (inline style overrides on the specific element) and **class** scope (writes to the CSS class definition). The header shows scope pills and a breadcrumb of the element's DOM ancestry.

### State Editing

Edit pseudo-class styles (`hover`, `focus`, `active`, `focus-within`, `focus-visible`) via the state selector dropdown. Changes are previewed live and committed to the appropriate `:state` block in your source file.

### Undo / Redo

Full undo stack with batch support. Every slider drag, color pick, or value change is reversible. Redo support with `Cmd+Shift+Z`.

### Session Persistence

Override state is serialized to `localStorage` keyed by pathname. Your unsaved changes survive page refreshes and HMR reloads.

### Visual Overlays

- **Grid overlay** — Shows grid lines, track numbers, and gap regions for CSS Grid elements
- **Flex gap overlay** — Visualizes flex gap spacing with hatched fill
- **Spacing guides** — Margin (blue) and padding (green) zone visualization
- **Box model overlay** — Highlights the content/padding/border/margin boxes

### CSS Variables

Discovers all CSS custom properties (`--var`) affecting the selected element. Organizes them into user-defined collections (primitives → semantic → component tokens). Link any value to a variable via the variable picker.

### Style Indicators

Modified properties show a blue highlight pill on their label. `Alt+click` any label to reset that individual property.

### Commit Flow

Save writes changes back to source files:

1. Traces the CSS property to its source file via CSS source maps
2. Finds the exact line with a tiered search strategy
3. Performs a surgical string replacement
4. Next.js HMR picks up the change — the page updates instantly

Supports both CSS Modules (`.module.scss`, `.module.css`) and Tailwind CSS projects.

### Copy / Export

- **Copy CSS** — Copies a clean CSS rule block with your changes
- **Copy as Variables** — Exports changes as CSS custom properties
- **Copy as Tailwind** — Formats changes as Tailwind utility classes
- **Diff view** — Shows before/after for every changed property

---

## Configuration

```tsx
<Tuner commitEndpoint="/api/tuner" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `commitEndpoint` | `string` | `"/api/tuner"` | API route path for the commit server |

---

## Exports

```ts
import { Tuner } from "redial";              // Main component
import { configure } from "redial";           // Runtime config
import "redial/styles.css";                   // Required stylesheet

export { GET, POST } from "redial/server";    // API route handlers
const withTuner = require("redial/next-plugin"); // Next.js plugin
```

---

## Requirements

- **Next.js** ≥ 13 (App Router)
- **React** ≥ 18
- **Node.js** ≥ 18

---

## Development

```sh
git clone https://github.com/SkylarKitchen/redial
cd redial
npm install
npm run build        # TypeScript compile (tsup)
npm run dev          # Watch mode
npm run typecheck    # Type check only
npm test             # Vitest
```

The `test-app/` directory contains a full Next.js app for development:

- `http://localhost:3000/demo` — Auto-opens the panel on sample content
- `http://localhost:3000/showcase` — Visual component showcase (imports live design tokens from `theme.ts`)

### Autonomous runs (sandcastle)

For sandboxed Claude Code runs — single tasks via `npm run sandcastle`, or
parallel checklist runs via `npm run tasks -- tasks.md` — see
[`docs/sandcastle.md`](docs/sandcastle.md). Replaces / complements the
existing `run-tasks-parallel.sh` flow with Docker isolation.

---

## Roadmap

v1.0 is shipped and stable. Planned post-v1 work — features, architectural
improvements, and design decisions — is tracked in
[`ROADMAP.md`](ROADMAP.md), the source of truth. The corresponding
[GitHub issues](https://github.com/SkylarKitchen/redial/issues?q=is%3Aissue)
are closed for a clean v1.0 tracker and reopened when work begins.

---

## License

MIT — see [LICENSE](LICENSE) for details.
