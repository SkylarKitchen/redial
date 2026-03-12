# Redial Audit Backlog

Items identified during the 2026-03-12 audit, organized by priority.
Each item is sized for a focused session (separate context window).

---

## Ship Blockers (before npm publish)

### Remove shadcn/ui and `@/lib/utils` dependency
- **Problem**: Every component imports `cn()` from `@/lib/utils` and `Button`/`Badge`/`ScrollArea` from `@/components/ui/`. These path aliases don't exist in consumer projects.
- **Scope**: ~30 files import `cn()`, ~12 import shadcn components
- **Fix**: Inline `cn()` (it's just `clsx` + `tailwind-merge`), replace `Button`/`Badge`/`ScrollArea` with Radix primitives or plain elements with inline styles
- **Risk**: Large refactor, touch every component. Test thoroughly.
- **Files**: Every `*.tsx` in `src/overlay/`

### Add code-splitting / lazy-load boundary
- **Problem**: Full 697KB JS bundle loads eagerly. Dev tools should be lazy.
- **Fix**: Document recommended usage with `dynamic(() => import('redial'), { ssr: false })` and consider making the overlay a lazy-loaded chunk internally
- **Files**: `src/index.ts`, README.md

---

## Performance

### Decompose Overlay.tsx (1,642 lines)
- **Problem**: God component with ~30 useState, ~20 useEffect. Keyboard handler effect (line 309-589) has 10+ dependencies, causing constant listener churn.
- **Fix**: Extract into focused modules:
  - `useKeyboardShortcuts.ts` — keyboard handler with stable refs
  - `useElementOutline.ts` — RAF-based outline tracking
  - `usePanelDrag.ts` — drag + snap logic
  - `useHmrReconciliation.ts` — HMR auto-reset
- **Risk**: Medium — need to preserve exact behavior of capture-phase listeners
- **Files**: `src/overlay/Overlay.tsx`

### Optimize Selector candidate list
- **Problem**: `document.querySelectorAll("*")` on every activation (Selector.tsx:77)
- **Fix**: Build candidate list lazily on Tab key, or use `TreeWalker` for incremental traversal
- **Files**: `src/overlay/Selector.tsx`

### Batch `rebuildClassStyles()` during drags
- **Problem**: Rewrites entire `<style>` tag on every property change (scope.ts:262-277)
- **Fix**: Debounce or use `requestAnimationFrame` to batch during slider drags
- **Files**: `src/overlay/scope.ts`

### Memoize section components
- **Problem**: All 8 sections re-render on every `panelKey` change
- **Fix**: Wrap `LayoutSection`, `SpacingSection`, etc. in `React.memo` with proper comparison
- **Files**: `src/overlay/*Section.tsx`

---

## Live Site / Isolation

### Shadow DOM or iframe isolation
- **Problem**: Panel renders in host DOM. Host CSS bleeds into panel, panel styles leak out.
- **Fix**: Render panel inside a Shadow DOM root or iframe. This is the single biggest architectural improvement for live-site reliability.
- **Risk**: High — Shadow DOM breaks React portals, Radix portals, and some event delegation. Needs careful migration.
- **Files**: `src/overlay/Overlay.tsx`, all portal-using components

### CSP compatibility
- **Problem**: Dynamic `createElement("style")` and inline styles fail under strict CSP
- **Fix**: Document CSP requirements, or bundle styles into the CSS file and use class-based overrides with nonce support
- **Files**: `src/overlay/Overlay.tsx`, `src/overlay/scope.ts`

### Keyboard shortcut configuration
- **Problem**: Global capture-phase listeners steal Cmd+S, Cmd+C, Cmd+Z, Cmd+F, Cmd+K from host app
- **Fix**: Add a configuration API to disable specific shortcuts, or only intercept when panel has focus
- **Files**: `src/overlay/Overlay.tsx` (keydown handler)

---

## Design System

### Dark mode token set
- **Problem**: All tokens are light-theme only. Panel is jarring on dark sites.
- **Fix**: Add dark mode variants to `theme.ts`, detect `prefers-color-scheme` or host background luminance
- **Files**: `src/overlay/theme.ts`, all consuming components

---

## Workflow / Features

### Integrate disconnected components
- **Problem**: `BackgroundLayerList.tsx` (464 lines), `FilterSliders.tsx` (464 lines), `TransformEditor.tsx` (429 lines), `TransitionEditor.tsx` (745 lines) are built but not wired into WebflowPanel
- **Fix**: Follow the Phase A plan in CLAUDE.md — integrate one per session
- **Files**: `src/overlay/WebflowPanel.tsx`, each component file

### Authored value round-tripping
- **Problem**: `getComputedStyle()` returns resolved values. Saving overwrites `var(--accent)` with `#D97757`.
- **Fix**: `getAuthoredValue.ts` already exists — wire it into the save pipeline so commit.ts preserves variable references
- **Files**: `src/overlay/getAuthoredValue.ts`, `src/overlay/Footer.tsx`, `src/server/commit.ts`

### Responsive breakpoint awareness
- **Problem**: No indication of which breakpoint you're editing. Can't set media-query-scoped values.
- **Fix**: Add breakpoint indicator in header, allow selecting target breakpoint
- **Files**: `src/overlay/Header.tsx`, new `BreakpointSelector.tsx`

### Commit pipeline robustness
- **Problem**: Tiered search matches literal strings. Fails for SCSS variables, calc(), mixed color formats. Fuzzy fallback can corrupt variable references.
- **Fix**: Parse AST for SCSS files, use source maps when available, add dry-run mode
- **Files**: `src/server/commit.ts`

### Pseudo-element support
- **Problem**: Can't inspect `::before`, `::after`, `::placeholder`
- **Fix**: Detect pseudo-elements via stylesheet walk, add pseudo selector in header
- **Files**: `src/overlay/infer.ts`, `src/overlay/Header.tsx`

### Multi-element selection
- **Problem**: One element at a time only
- **Fix**: Hold Shift to add to selection, apply changes to all selected elements
- **Files**: `src/overlay/Overlay.tsx`, `src/overlay/apply.ts`

### Grid template editor
- **Problem**: Grid support limited to gap/justify/align
- **Fix**: Visual grid track editor for `grid-template-columns`/`rows`
- **Files**: New `GridTemplateEditor.tsx`, `src/overlay/LayoutSection.tsx`

### Tailwind v4 awareness
- **Problem**: `formatTailwindDiff` generates v3 classes, no awareness of v4 CSS-first config
- **Fix**: Detect Tailwind version, generate appropriate output
- **Files**: `src/overlay/tailwind.ts`
