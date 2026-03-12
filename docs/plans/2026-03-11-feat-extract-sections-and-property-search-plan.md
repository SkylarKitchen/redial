---
title: "Extract WebflowPanel sections + Property search filter"
type: feat
date: 2026-03-11
---

# Extract WebflowPanel Sections + Property Search Filter

## Overview

Two complementary features to improve maintainability and usability of the Redial panel:

1. **Extract WebflowPanel into per-section components** — Break the 1,503-line monolith into 8 focused section components with a lightweight shared context
2. **Property search/filter** — Add a search input that filters visible sections in real time

Feature 1 creates the architecture that Feature 2 leverages. They must be implemented in order.

## Problem Statement

**WebflowPanel.tsx is 1,503 lines** with 100+ `useState` calls, 60+ `useCallback` handlers, and all 8 CSS sections inline. This makes it:
- Hard to navigate and modify
- Impossible to test individual sections
- A performance bottleneck (every state change re-renders everything)
- Difficult for new contributors to understand

**No property search exists.** With 100+ CSS properties across 8 sections, finding the right control requires scrolling and visual scanning. Real Webflow has search — Redial should too.

## Proposed Solution

### Architecture: PanelContext + Section Components

```
WebflowPanel.tsx (orchestrator, ~200 lines)
├── PanelContext (shared: element, apply, ind, cs, parentCs, getConversionCtx, resetCss)
├── searchQuery state (lifted here, persists across panelKey remounts via Overlay)
├── display + derived flags (isFlex, isGrid, parentIsFlex, showTypography, isMedia)
├── columnGap state (shared between Layout and Typography)
│
├── LayoutSection.tsx
├── SpacingSection.tsx
├── SizeSection.tsx
├── PositionSection.tsx
├── TypographySection.tsx
├── BackgroundsSection.tsx
├── BordersSection.tsx
└── EffectsSection.tsx
```

Each section:
- Owns its own `useState` calls for section-specific properties
- Consumes `PanelContext` via `useContext` for shared utilities
- Receives cross-section state (`display`, `columnGap`) as props
- Exports a `SECTION_KEYWORDS: string[]` constant for search matching
- Initializes from `getComputedStyle()` in `useState` initializers (preserving remount-to-reset via `key={panelKey}`)

### Search: Section-Level Filtering

Section-level filtering (not property-level) for v1:
- Match query against section name + `SECTION_KEYWORDS` array
- Case-insensitive substring matching
- Auto-expand sections that match; respect conditional visibility (no showing flex controls on non-flex elements)
- "No matching properties" empty state
- `/` keyboard shortcut to focus search, Escape to clear

## Technical Approach

### Phase 1: PanelContext + Extract Sections

#### 1a. Create PanelContext

**New file: `src/overlay/PanelContext.tsx`**

```tsx
// Shared state consumed by all section components via useContext
interface PanelContextValue {
  element: HTMLElement
  apply: (prop: string, value: string) => void
  resetCss: (prop: string) => void
  ind: (prop: string) => IndicatorColor
  sectionInd: (props: string[]) => IndicatorColor
  cs: CSSStyleDeclaration
  parentCs: CSSStyleDeclaration | null
  getConversionCtx: () => ConversionContext
}
```

- No default value — context is always provided by WebflowPanel
- Sections call `const ctx = useContext(PanelContext)` at the top

#### 1b. Extract Each Section (8 files)

For each section, move from WebflowPanel.tsx:
- All `useState` calls for that section's properties
- All `useCallback` handlers for that section
- The JSX for that section's `<Section>` block
- Import only the constants/components that section needs

**File list:**
- `src/overlay/sections/LayoutSection.tsx` — display, flex-direction, wrap, gap, align, grid tracks, flex child controls
- `src/overlay/sections/SpacingSection.tsx` — SpacingBoxModel wrapper, margin/padding state
- `src/overlay/sections/SizeSection.tsx` — width, height, min/max, overflow, object-fit, aspect-ratio, box-sizing
- `src/overlay/sections/PositionSection.tsx` — position, top/right/bottom/left, z-index, float, clear
- `src/overlay/sections/TypographySection.tsx` — font-family, size, weight, line-height, color, alignment, decoration, transform, advanced sub-section
- `src/overlay/sections/BackgroundsSection.tsx` — BackgroundLayerList wrapper, background-clip
- `src/overlay/sections/BordersSection.tsx` — SideSelector, per-side controls, corner radius
- `src/overlay/sections/EffectsSection.tsx` — opacity, blend mode, shadows, transforms, transitions, filters, cursor, interaction

**Cross-section state stays in WebflowPanel.tsx:**
- `display` + `setDisplay` (affects section visibility + flex/grid sub-controls)
- `columnGap` + `handleColumnGapChange` (shared between Layout gap and Typography column-gap)
- `activeState` (from Header, affects indicator calculation)
- Derived flags: `isFlex`, `isGrid`, `parentIsFlex`, `parentIsGrid`, `isMedia`, `showTypography`

**Each section receives via props:**
- `display`, `isFlex`, `isGrid`, etc. (only the flags it needs)
- `columnGap` + `onColumnGapChange` (only Layout and Typography)

#### 1c. Slim Down WebflowPanel.tsx

After extraction, WebflowPanel.tsx becomes ~200 lines:
- PanelContext.Provider wrapper
- Cross-section state management
- Derived flag computation
- Conditional section rendering
- `key={panelKey}` on each section component (preserves remount-to-reset)

### Phase 2: Property Search Filter

#### 2a. SECTION_KEYWORDS Registry

Each section exports a keywords array:

```tsx
// LayoutSection.tsx
export const SECTION_KEYWORDS = [
  'layout', 'display', 'flex', 'grid', 'flex-direction', 'flex-wrap',
  'justify-content', 'align-items', 'gap', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'order',
  'flex-grow', 'flex-shrink', 'flex-basis', 'align-self',
]
```

#### 2b. Search Input Component

**New file: `src/overlay/sections/PropertySearch.tsx`**

- Positioned between Header and scrollable content (fixed, not scrollable)
- 300px wide, dark-themed input with search icon (Lucide `Search`)
- Clear button appears when query is non-empty
- `onChange` fires on every keystroke (no debounce needed — matching is O(n) on ~80 keywords)

#### 2c. Filtering Logic in WebflowPanel.tsx

```tsx
const matchedSections = useMemo(() => {
  if (!searchQuery.trim()) return null // null = show all
  const q = searchQuery.toLowerCase()
  return {
    layout: LAYOUT_KEYWORDS.some(k => k.includes(q)),
    spacing: SPACING_KEYWORDS.some(k => k.includes(q)),
    // ...etc
  }
}, [searchQuery])
```

Each section renders only if `matchedSections === null || matchedSections[sectionName]`.

#### 2d. Section Auto-Expand

The `Section` component in `controls.tsx` gets a new optional prop:

```tsx
forceOpen?: boolean  // When true, override collapsed state to open
```

When `forceOpen` transitions from false → true, expand. When it transitions back, restore previous state.

#### 2e. Search State Persistence

Search query state lives in `Overlay.tsx` and is passed as a prop to WebflowPanel. This way:
- It persists across `panelKey` remounts (undo/redo)
- It persists across element switches
- Escape in the search input clears the query (doesn't close the panel)

#### 2f. Keyboard Integration

- `/` key (when no input focused) → focus search input
- `Escape` in search input → clear query + blur input (if already empty, close panel)
- Tab from search input → first visible control in first visible section

#### 2g. No Results State

When `matchedSections` has all values `false`:
```tsx
<div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 20px' }}>
  No matching properties
</div>
```

## Acceptance Criteria

### Feature 1: Section Extraction

- [ ] WebflowPanel.tsx is under 250 lines
- [ ] 8 section files exist in `src/overlay/sections/`
- [ ] PanelContext.tsx provides shared utilities
- [ ] All existing functionality works identically (no visual/behavioral regression)
- [ ] `npm run typecheck` passes
- [ ] All 176 existing tests pass
- [ ] Undo/redo correctly resets all section state (panelKey remount works)
- [ ] Changing `display` in Layout correctly shows/hides flex/grid/typography sections
- [ ] `columnGap` stays in sync between Layout and Typography

### Feature 2: Property Search

- [ ] Search input visible between Header and scrollable content
- [ ] Typing filters sections in real time
- [ ] Empty query shows all sections normally
- [ ] Matched sections auto-expand even if previously collapsed
- [ ] Conditionally hidden sections stay hidden (no showing flex controls on non-flex elements)
- [ ] "No matching properties" shown when nothing matches
- [ ] `/` shortcut focuses search input
- [ ] Escape clears query (or closes panel if query is empty)
- [ ] Search query persists across undo/redo and element switches
- [ ] Each section exports `SECTION_KEYWORDS` array
- [ ] `npm run typecheck` passes

## Implementation Order

```
Phase 1a: PanelContext.tsx                    (30 min)
Phase 1b: Extract 8 sections                 (one at a time, test after each)
Phase 1c: Slim WebflowPanel.tsx              (natural result of 1b)
── typecheck + manual verification ──
Phase 2a: SECTION_KEYWORDS on each section   (10 min)
Phase 2b: PropertySearch.tsx component        (20 min)
Phase 2c: Filtering logic in WebflowPanel    (15 min)
Phase 2d: Section forceOpen prop              (10 min)
Phase 2e: Lift search state to Overlay        (10 min)
Phase 2f: Keyboard shortcuts                  (10 min)
Phase 2g: No results state                    (5 min)
── typecheck + full verification ──
```

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Shared state mechanism | Context (not props drilling) | 8+ shared values would make props verbose; context is cleaner |
| Cross-section state | Props from parent | Only `display`, `columnGap`, derived flags — explicit data flow for critical coupling |
| Section callbacks | Section-local (not parent) | Each section owns its handlers, receives `apply` via context. Moves code out of parent. |
| Filtering granularity | Section-level | Property-level requires invasive refactor of composite controls (SpacingBoxModel, AlignBox). Section-level is 90% as useful, 10% of the complexity. |
| Search state location | Overlay.tsx | Survives panelKey remount. User keeps search context across undo/element switches. |
| Collapse on clear | Restore previous state | Track pre-search collapse state, restore when query clears |
| File organization | `src/overlay/sections/` subdirectory | Keeps overlay/ from getting more crowded; clear grouping |

## Dependencies & Risks

**Risks:**
- **State desync after extraction** — Changing `display` in Layout must propagate to parent to update `isFlex`/`isGrid` flags. Missing a callback wiring causes silent bugs.
- **Undo shows stale values** — If any section memoizes state across `key` changes, remount won't reset. Must verify `key={panelKey}` propagates to all sections.
- **Import graph** — Each section needs specific subsets of imports. Missing imports cause runtime errors on rare interactions (e.g., unit conversion only triggered on specific property).

**Mitigations:**
- Extract one section at a time, typecheck after each
- Test element type matrix: flex parent, grid parent, text element, media element, positioned element
- Verify undo/redo resets all sections after full extraction

## References

- `src/overlay/WebflowPanel.tsx` — The monolith to extract
- `src/overlay/Overlay.tsx` — Parent lifecycle; where search state will live
- `src/overlay/controls.tsx:41-97` — `Section` component (needs `forceOpen` prop)
- `src/overlay/apply.ts` — Shared `applyInlineStyle`, `isDirty`, `resetProp`
- `src/overlay/PanelContext.tsx` — New file for shared context
- `src/overlay/panelConstants.tsx` — Option arrays consumed by sections
- `webflow-style-panel-spec.md` — Full spec reference
