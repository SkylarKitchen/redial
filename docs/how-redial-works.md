# Redial — How It Works

## What Is Redial?

Redial is a floating CSS tuning panel that overlays on top of any Next.js app during development. Think of it like Webflow's style inspector, but for your actual codebase. You click an element, get context-aware sliders and pickers for its CSS properties, drag to adjust, and hit Save — and your source files update on disk, live.

Nothing else fills this gap. DevTools changes evaporate on reload. AI coding tools add minutes of latency per visual tweak. Redial connects direct manipulation to your actual code.

## Who Is This For?

- **Designers in code** who think visually and want to tune spacing, color, and typography by feel
- **Developers moving fast** who'd rather drag a border-radius slider than remember whether it's `12px` or `0.75rem`
- **Anyone doing UI polish passes** — the last 20% where you're tweaking `letter-spacing` by half a pixel at a time

## UX Flow

### Phase 1: Select

```
Press ` (backtick) → selection mode activates
Hover over elements → blue outline highlights
Click an element   → panel slides in from the side
```

The panel header shows:
- **Breadcrumb:** `body › main › section.hero › h1` (click any ancestor to switch context)
- **Scope pills:** `element` vs `.hero-heading` (edit this instance or the class?)
- **Source file:** `components/Hero.tsx:42` (click to open in editor)

### Phase 2: Tune

Drag sliders, pick colors, toggle layout options. Changes render on the actual page in real-time with zero latency.

```
Typography  → drag font-size from 48px → 56px, scrub weight to 700, pick a color
Spacing     → click padding-top value → type "64" → Enter
Layout      → toggle justify-content with the alignment grid, bump gap to 24px
```

Underneath, `apply.ts` sets inline styles on the DOM element directly. No React re-render, no HMR — raw `element.style` manipulation. That's why it feels instant.

### Phase 3: Compare

```
Hold D       → diff peek: strips all overrides so you see the original
Release D    → overrides come back
Cmd+Z/⇧Z    → step through undo/redo, each state renders live
Click "Diff" → see the CSS diff of all changes
```

### Phase 4: Save

Press Cmd+S. Redial writes changes to your actual source files. HMR picks up the edit. See [Save Pipeline](save-pipeline.md) for the full 5-stage architecture (diff → resolve → commit → write → HMR).

### Phase 5: Return to Code

Close Redial (Esc or backtick). Use Claude Code for logic, architecture, new features. Redial handled the visual polish. They're complementary tools.

## Key Constraints

- **Dev-only** — The save route is disabled in production builds
- **CSS Modules focus** — Save writes to `.module.css`/`.module.scss`. Tailwind is export-only (Copy as Tailwind). Global stylesheets without module patterns may not resolve correctly.
- **Non-destructive** — If Redial can't confidently locate the right line, it reports the failure. It won't silently write to the wrong place.

## Beyond Save

- **Undo/Redo** — Full stack (Cmd+Z / Cmd+Shift+Z) with batch support
- **Copy as CSS / Tailwind / Variables** — Clipboard dropdown with multiple formats
- **Paste Styles** — Copy from one element, paste onto another
- **Session persistence** — Unsaved changes survive page refreshes (localStorage)
- **Reset** — Revert all changes to original computed values
