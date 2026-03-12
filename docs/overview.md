# Redial — Project Overview

**A floating Webflow-style CSS tuning panel for Next.js.**

Click any element → get context-aware controls → drag to tune → save to source files via HMR.

```
npm install redial
```

```tsx
import { Tuner } from "redial";

export default function RootLayout({ children }) {
  return (
    <html><body>
      {children}
      {process.env.NODE_ENV === "development" && <Tuner />}
    </body></html>
  );
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                        │
│                                                              │
│  ┌──────────┐    hotkey (`)     ┌───────────────────────┐   │
│  │  Next.js  │ ──────────────▶  │     Selector.tsx       │   │
│  │   Page    │                  │  (click any element)   │   │
│  └──────────┘                  └───────────┬───────────┘   │
│                                             │ selected      │
│                                             ▼ element       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Overlay.tsx                          │   │
│  │  ┌────────────┐  ┌────────────────┐  ┌─────────────┐ │   │
│  │  │ Header.tsx  │  │ WebflowPanel   │  │ Footer.tsx  │ │   │
│  │  │ breadcrumb  │  │ ┌────────────┐ │  │ save/reset  │ │   │
│  │  │ scope pills │  │ │ Layout     │ │  │ diff/copy   │ │   │
│  │  │ source link │  │ │ Spacing    │ │  └─────────────┘ │   │
│  │  └────────────┘  │ │ Size       │ │                   │   │
│  │                   │ │ Position   │ │                   │   │
│  │                   │ │ Typography │ │                   │   │
│  │                   │ │ Backgrounds│ │                   │   │
│  │                   │ │ Borders    │ │                   │   │
│  │                   │ │ Effects    │ │                   │   │
│  │                   │ └────────────┘ │                   │   │
│  │                   └────────────────┘                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Three-Layer Pipeline

```
 ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
 │  1. INTELLIGENCE │     │  2. RENDERING     │     │  3. PERSISTENCE  │
 │                  │     │                   │     │                  │
 │  infer.ts        │     │  WebflowPanel.tsx │     │  apply.ts        │
 │  ─────────────── │     │  ──────────────── │     │  ──────────────  │
 │  getComputedStyle│────▶│  DialKit sliders  │────▶│  inline styles   │
 │  → DialKit config│     │  color pickers    │     │  + undo stack    │
 │                  │     │  dropdowns        │     │  + session store  │
 │  Reads the DOM   │     │  box model viz    │     │                  │
 │  to understand   │     │  alignment grids  │     │  commit.ts       │
 │  what controls   │     │                   │     │  ──────────────  │
 │  to show         │     │  30+ specialized  │     │  surgical file   │
 │                  │     │  components       │     │  writes → HMR    │
 └─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/overlay/` | **Core** — 90+ files, ~24K lines. Panel UI, inference, styling engine |
| `src/server/` | Server-side commit endpoint (writes CSS changes to source files) |
| `src/components/ui/` | Shared Radix-based primitives (scroll-area, dialog, etc.) |
| `src/lib/` | Utilities (`cn()` class merge helper) |
| `test-app/` | Next.js app for development (`/demo` interactive, `/showcase` Figma export) |

---

## Key Subsystems

### 1. Intelligence — `infer.ts`

Reads `getComputedStyle()` from the selected DOM element and generates a DialKit-compatible config object. Determines which CSS sections are relevant (e.g., flex controls only appear on flex containers, typography only on text elements).

### 2. Panel Sections — `WebflowPanel.tsx` + Section Components

Eight collapsible CSS sections mirroring Webflow's Designer panel:

| Section | File | CSS Properties |
|---------|------|----------------|
| Layout | `LayoutSection.tsx` | display, flex-direction, justify/align, gap, grid |
| Spacing | `SpacingSection.tsx` | margin, padding (visual box model) |
| Size | `SizeSection.tsx` | width, height, min/max, overflow, object-fit |
| Position | `PositionSection.tsx` | position, top/right/bottom/left, z-index |
| Typography | `TypographySection.tsx` | font, size, weight, color, alignment, decoration |
| Backgrounds | `BackgroundsSection.tsx` | color, gradients, images, layers |
| Borders | `BordersSection.tsx` | style, width, color, radius (per-side) |
| Effects | `EffectsSection.tsx` | shadows, transforms, filters, transitions, opacity |

### 3. Inline Style Engine — `apply.ts`

Every slider drag calls `applyInlineStyle()` which records the initial value, pushes to an undo stack, sets the inline style with `!important`, and persists to `localStorage` across HMR reloads.

### 4. Source File Commit — `commit.ts`

Takes a diff of changes and performs surgical string replacements in the original `.module.scss` or component files. Path-traversal protected. Triggers HMR for instant feedback.

See [save-pipeline.md](save-pipeline.md) for the full commit flow.

### 5. Design Tokens — `theme.ts` + `timing.ts`

Single source of truth for all colors, layout constants, shadows, and animation timings. The `/showcase` page imports directly from these files so Figma exports stay in sync.

---

## Specialized Components

```
┌─────────── Visual Controls ───────────┐  ┌──────── Utility ────────┐
│                                        │  │                         │
│  AlignBox       3×3 flex alignment     │  │  UnitSelector   px/%/em │
│  SpacingBoxModel  nested rect viz      │  │  LabelScrub     drag    │
│  CornerRadiusEditor  4-corner visual   │  │  StyleIndicator dots    │
│  PositionOffsetDiagram  offset box     │  │  IconButtonGroup radios │
│  GradientEditor  color stop bar        │  │  SideSelector   tabs    │
│  BezierEditor   cubic-bezier curve     │  │  ColorPickerEnhanced    │
│  TransformEditor  translate/scale/...  │  │  SegmentedControl       │
│  ShadowEditor   multi-shadow list      │  │  SizeInputCell          │
│  FilterSliders  blur/brightness/...    │  │  PropertySearch  ⌘K     │
│  TransitionEditor  property/easing     │  │  CommandPalette         │
│                                        │  │  ShortcutsHelp          │
└────────────────────────────────────────┘  └─────────────────────────┘
```

---

## Interaction Flow

```
                    ` (backtick)
                         │
                         ▼
              ┌──────────────────┐
              │  Selection Mode   │◀──── Esc (close)
              │  hover highlight  │
              └────────┬─────────┘
                       │ click
                       ▼
              ┌──────────────────┐
              │   Panel Opens     │
              │   infer() → UI    │
              └────────┬─────────┘
                       │ user drags slider
                       ▼
              ┌──────────────────┐
              │  apply.ts         │──── Cmd+Z (undo)
              │  inline style set │──── Cmd+Shift+Z (redo)
              │  undo stack push  │──── D (hold: diff peek)
              └────────┬─────────┘
                       │ Cmd+S (save)
                       ▼
              ┌──────────────────┐
              │  commit.ts        │
              │  write to source  │
              │  file → HMR       │
              └──────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Controls | [DialKit](https://npmjs.com/package/dialkit) — slider/picker/folder primitives |
| Animation | [Motion](https://motion.dev) (Framer Motion successor) |
| Primitives | Radix UI (dialog, scroll-area, select, tooltip, etc.) |
| Icons | Lucide React |
| Build | tsup (ESM output) |
| Tests | Vitest + happy-dom |
| Framework | Next.js ≥13 (peer dependency) |

---

## Development

```bash
npm run dev        # watch mode (tsup --watch)
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm test           # vitest run
```

**Test app:** `cd test-app && npm run dev` → `localhost:3000`

- `/demo` — auto-opens the real panel on sample content
- `/showcase` — static token reference + component reproductions for Figma export

---

## Further Reading

- [How Redial Works](how-redial-works.md) — deeper architecture walkthrough
- [Save Pipeline](save-pipeline.md) — the full commit flow from inline style to source file
- [Webflow Panel Spec](../webflow-style-panel-spec.md) — 13-section UI specification
