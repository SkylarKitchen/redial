---
title: "Extract WebflowPanel sections + Property search filter"
type: feat
date: 2026-03-11
---

# Extract WebflowPanel Sections + Property Search Filter

## Enhancement Summary

**Deepened on:** 2026-03-11
**Research agents used:** architecture-strategist, kieran-typescript-reviewer, performance-oracle, code-simplicity-reviewer, pattern-recognition-specialist, julik-frontend-races-reviewer, Context7 (React 19 docs)

### Key Improvements from Research
1. **Drop PanelContext — use a `SectionCtx` prop object** (4/6 agents agreed: props beat context for 8 direct children)
2. **Fix `onDirtyChange` re-render cascade** before extraction — use `useSyncExternalStore` on `apply.ts` (P0 performance fix)
3. **Fix 3 real bugs discovered**: `isConnected` guard, columnGap unit coherence, keyboard shortcuts during active scrub
4. **Simplify search to ~30 lines inline** — kill PropertySearch.tsx, kill per-section SECTION_KEYWORDS, use one `SECTION_ALIASES` map
5. **Keep files flat** in `src/overlay/` — no `sections/` subdirectory

### Bugs to Fix (discovered during review)
- **HIGH**: `applyInlineStyle` has no `isConnected` guard — HMR can orphan overrides on disconnected elements
- **MEDIUM**: `columnGap` unit diverges between Layout (`gapUnit`) and Typography (hardcoded `"px"`)
- **MEDIUM**: Keyboard shortcuts (Escape, arrow keys) fire during active `LabelScrub` drag, causing orphaned overrides

---

## Overview

Two complementary features to improve maintainability and usability of the Redial panel:

1. **Extract WebflowPanel into per-section components** — Break the 1,540-line monolith into 8 focused section components with a shared prop interface
2. **Property search/filter** — Add a search input that filters visible sections in real time (~30 lines)

Feature 1 creates the architecture that Feature 2 leverages. They must be implemented in order. A prerequisite bug-fix phase addresses real issues discovered during review.

## Problem Statement

**WebflowPanel.tsx is 1,540 lines** with 119 `useState` calls, 94 `useCallback` handlers, and all 8 CSS sections inline. This makes it:
- Hard to navigate and modify
- Impossible to test individual sections
- A performance bottleneck (every state change re-renders everything — compounded by the `onDirtyChange` cascade from Overlay)
- Difficult for new contributors to understand

**No property search exists.** With 100+ CSS properties across 8 sections, finding the right control requires scrolling and visual scanning.

## Proposed Solution

### Architecture: SectionCtx Props + Section Components

```
WebflowPanel.tsx (orchestrator, ~200 lines)
├── SectionCtx prop object (element, apply, ind, sectionInd, cs, parentCs, getConversionCtx)
├── searchQuery state (local — resets on panelKey remount, acceptable UX)
├── display + derived flags (isFlex, isGrid, parentIsFlex, showTypography, isMedia)
├── columnGap + columnGapUnit state (shared between Layout and Typography)
├── SECTION_ALIASES map (~15 lines, single source of truth for search)
│
├── LayoutSection.tsx      (flat in src/overlay/)
├── SpacingSection.tsx
├── SizeSection.tsx
├── PositionSection.tsx
├── TypographySection.tsx
├── BackgroundsSection.tsx
├── BordersSection.tsx
└── EffectsSection.tsx
```

### Research Insights: Why Props Over Context

**4 of 6 review agents recommended props over context.** Key reasons:

1. **Consumer count is fixed and small** — 8 direct children, one level of nesting. Context solves deep prop-drilling; this has no drilling.
2. **React.memo does NOT prevent re-renders from context changes** (confirmed by React 19 docs). Each section would re-render on any context value change, defeating section isolation.
3. **CSSVariablesSection precedent** — The one existing extracted section uses props (`element` + `onDirtyChange`), not context. Follow the established pattern.
4. **Explicit data flow** — Props make dependencies visible. A `SectionCtx` prop object bundles the common values without hiding the dependency graph.

```tsx
// Define once in WebflowPanel.tsx or a shared types file
interface SectionCtx {
  element: Element
  apply: (prop: string, value: string) => void
  ind: (prop: string) => IndicatorType
  sectionInd: (props: string[]) => IndicatorType
  cs: CSSStyleDeclaration
  parentCs: CSSStyleDeclaration | null
  getConversionCtx: () => ConversionContext
}
```

Each section receives `ctx: SectionCtx` as a single prop, plus any cross-section props it needs.

### Research Insights: Performance

**The `onDirtyChange` cascade is the #1 performance bottleneck** (Performance Oracle, P0):

```
Slider drag → apply() → onDirtyChange() → setDirtyTick(t+1) in Overlay
→ Overlay re-renders → WebflowPanel re-renders → ALL sections re-render
```

This happens 60+ times/second during a drag. After extraction, `React.memo` on sections is useless if the parent re-renders every frame.

**Fix: Use `useSyncExternalStore` to subscribe Overlay's Footer directly to `apply.ts`'s override count.** Remove `onDirtyChange` from the WebflowPanel prop interface entirely. The `apply.ts` module already tracks all state externally — it's a natural external store.

### Search: Section-Level Filtering (Inline, ~30 lines)

Section-level filtering (not property-level) for v1:
- One `SECTION_ALIASES` map in WebflowPanel.tsx (~15 lines)
- Inline `<input>` between Header and scrollable content
- Case-insensitive substring matching against section name + aliases
- `forceOpen` prop on Section when search is active
- "No matching properties" empty state
- `/` keyboard shortcut to focus, Escape to clear

## Technical Approach

### Phase 0: Bug Fixes (prerequisite)

These bugs exist today and will be harder to fix after extraction. Fix them first.

#### 0a. `isConnected` guard in `applyInlineStyle`

**File: `src/overlay/apply.ts`**

Add at the top of `applyInlineStyle`:
```tsx
if (!(el as HTMLElement).isConnected) return; // Element detached by HMR
```

**Why**: During HMR, the old DOM node is removed but pointer events may still fire 1-2 more times on the old element. Without this guard, `apply()` writes styles to a disconnected node, orphaning entries in the `overrides` Map. `totalOverrideCount()` then reports phantom changes that can never be committed or reset.

#### 0b. columnGap unit coherence

**File: `src/overlay/WebflowPanel.tsx` (pre-extraction)**

Share `columnGapUnit` alongside `columnGap`. Currently Layout uses `gapUnit` but Typography hardcodes `"px"` when rendering the column-gap TypoValueCell. After extraction, pass `columnGapUnit` + `onColumnGapUnitChange` to both Layout and Typography.

#### 0c. Active scrub guard for keyboard shortcuts

**File: `src/overlay/Overlay.tsx`**

Add a module-level `let scrubActive = false` flag. Set it from `LabelScrub`'s `onScrubStart`/`onScrubEnd` callbacks. Check it in the keyboard handler:
```tsx
if (scrubActive) return; // Don't fire shortcuts during active drag
```

**Why**: Pressing Escape during a LabelScrub drag closes the panel but the drag continues via `setPointerCapture`, orphaning overrides on the now-unmanaged element.

#### 0d. Eliminate `onDirtyChange` cascade

**File: `src/overlay/apply.ts` + `src/overlay/Overlay.tsx`**

Export a `subscribe` function and `getOverrideCount` snapshot from `apply.ts`. In Overlay's Footer, use `useSyncExternalStore(subscribe, getOverrideCount)` instead of the current `dirtyTick` state + `onDirtyChange` prop chain.

```tsx
// apply.ts — add:
const listeners = new Set<() => void>();
export function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }
export function getOverrideSnapshot() { return totalOverrideCount(); }
// Call listeners.forEach(fn => fn()) after each applyInlineStyle/undo/redo/reset

// Overlay.tsx Footer — replace dirtyTick with:
const overrideCount = useSyncExternalStore(subscribe, getOverrideSnapshot);
```

Remove `onDirtyChange` from `WebflowPanelProps`. This eliminates the 60fps re-render cascade during slider drags.

### Phase 1: Extract Sections

#### 1a. Extract shared helpers to `panelUtils.ts`

**New file: `src/overlay/panelUtils.ts`**

Move from WebflowPanel.tsx:
- `INHERITABLE_PROPERTIES` set
- `getIndicatorType()` function
- `getAuthoredValue()` function (+ consider caching per element — currently walks all stylesheets N times)
- `detectUnit()` function
- `isTextBearing()` function
- `TEXT_TAGS` set

These are needed by multiple sections for their `useState` initializers.

#### 1b. Define `SectionCtx` interface

In `panelUtils.ts` or a separate `types.ts`:

```tsx
export interface SectionCtx {
  element: Element
  apply: (prop: string, value: string) => void
  ind: (prop: string) => IndicatorType
  sectionInd: (props: string[]) => IndicatorType
  cs: CSSStyleDeclaration
  parentCs: CSSStyleDeclaration | null
  getConversionCtx: () => ConversionContext
}
```

**Note on `resetCss`**: Do NOT include it in `SectionCtx`. The current signature `(prop: string, setter: (v: number) => void)` couples to the calling site. Each section should compose its own reset using the imported `resetProp` from `apply.ts` + its own setters.

#### 1c. Extract each section (one at a time, typecheck after each)

For each section, move from WebflowPanel.tsx:
- All `useState` calls for that section's properties
- All `useCallback` handlers for that section
- The JSX for that section's `<Section>` block
- Import only the constants/components that section needs

**File list (flat in `src/overlay/`):**
- `src/overlay/LayoutSection.tsx` — display, flex-direction, wrap, gap, align, grid tracks, flex child controls
- `src/overlay/SpacingSection.tsx` — SpacingBoxModel wrapper, margin/padding state
- `src/overlay/SizeSection.tsx` — width, height, min/max, overflow, object-fit, aspect-ratio, box-sizing
- `src/overlay/PositionSection.tsx` — position, top/right/bottom/left, z-index, float, clear
- `src/overlay/TypographySection.tsx` — font-family, size, weight, line-height, color, alignment, decoration, transform, advanced sub-section
- `src/overlay/BackgroundsSection.tsx` — BackgroundLayerList wrapper, background-clip
- `src/overlay/BordersSection.tsx` — SideSelector, per-side controls, corner radius
- `src/overlay/EffectsSection.tsx` — opacity, blend mode, shadows, transforms, transitions, filters, cursor, interaction

**Each section's props** — define per-section (not a shared mega-type):

```tsx
// Example: LayoutSection
interface LayoutSectionProps {
  ctx: SectionCtx
  display: string
  onDisplayChange: (v: string) => void
  columnGap: number
  columnGapUnit: string
  onColumnGapChange: (v: number) => void
  onColumnGapUnitChange: (u: string) => void
  isFlex: boolean
  isGrid: boolean
  parentIsFlex: boolean
  parentIsGrid: boolean
  showGridOverlay?: boolean
  onToggleGridOverlay?: () => void
}

// Example: SizeSection (much thinner)
interface SizeSectionProps {
  ctx: SectionCtx
  display: string
  isMedia: boolean
}
```

**Cross-section state stays in WebflowPanel.tsx:**
- `display` + `setDisplay` (affects section visibility + flex/grid sub-controls)
- `columnGap` + `columnGapUnit` (shared between Layout and Typography)
- Derived flags: `isFlex`, `isGrid`, `parentIsFlex`, `parentIsGrid`, `isMedia`, `showTypography`

#### 1d. Slim down WebflowPanel.tsx

After extraction, WebflowPanel.tsx becomes ~200 lines:
- `SectionCtx` object construction (memoized)
- Cross-section state management
- Derived flag computation
- `SECTION_ALIASES` map for search
- Search input + filtering logic
- Conditional section rendering
- `key={panelKey}` on each section component (preserves remount-to-reset)

#### 1e. Wrap sections in React.memo

After Phase 0d eliminates the `onDirtyChange` cascade, each section can be wrapped in `React.memo`. Since sections own their local state and receive stable props from the orchestrator, `React.memo` prevents cross-section re-renders during slider drags.

```tsx
export const LayoutSection = memo(function LayoutSection(props: LayoutSectionProps) {
  // ...
});
```

This is only effective because Phase 0d removed the parent re-render trigger.

### Phase 2: Property Search (~30 lines inline)

#### 2a. SECTION_ALIASES map

Single source of truth in WebflowPanel.tsx:

```tsx
const SECTION_ALIASES: Record<string, readonly string[]> = {
  Layout: ["display", "flex", "grid", "gap", "direction", "wrap", "align", "justify", "order"],
  Spacing: ["margin", "padding", "space"],
  Size: ["width", "height", "overflow", "aspect", "object-fit"],
  Position: ["top", "right", "bottom", "left", "z-index", "float", "clear", "sticky", "fixed"],
  Typography: ["font", "text", "color", "line-height", "letter", "word", "column", "indent"],
  Backgrounds: ["background", "gradient", "image", "bg"],
  Borders: ["border", "radius", "corner", "outline"],
  Effects: ["opacity", "shadow", "transform", "transition", "filter", "cursor", "blend", "pointer"],
} as const;
```

**Why not per-section SECTION_KEYWORDS**: 8 exported arrays totaling ~120 lines, spread across 8 files, that must stay in sync with rendered controls. One ~15-line map is simpler, never gets stale (section titles are right there), and is the single source of truth.

#### 2b. Search input + filtering (inline in WebflowPanel)

```tsx
const [searchQuery, setSearchQuery] = useState("");
const searchRef = useRef<HTMLInputElement>(null);

const matchedSections = useMemo(() => {
  if (!searchQuery.trim()) return null; // null = show all
  const q = searchQuery.toLowerCase();
  const result: Record<string, boolean> = {};
  for (const [name, aliases] of Object.entries(SECTION_ALIASES)) {
    result[name] = name.toLowerCase().includes(q) || aliases.some(a => a.includes(q));
  }
  return result;
}, [searchQuery]);

const isSearching = matchedSections !== null;
const noResults = isSearching && Object.values(matchedSections!).every(v => !v);
```

#### 2c. forceOpen on Section

Add one prop to `Section` in `controls.tsx`:

```tsx
forceOpen?: boolean
```

Implementation is one line:
```tsx
const [ownOpen, setOwnOpen] = useState(!collapsed);
const open = forceOpen || ownOpen;
```

No "save/restore previous state" complexity needed. `ownOpen` state persists in React across `forceOpen` changes because the Section component is not remounted. When `forceOpen` goes from `true` → `false`, `ownOpen` still holds whatever value it had before.

#### 2d. Keyboard shortcuts

- `/` key (when no input focused) → `searchRef.current?.focus()`
- `Escape` in search input → clear query + blur (if already empty, close panel per existing behavior)

~5 lines in the existing keyboard handler.

#### 2e. No results state

```tsx
{noResults && (
  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 20px', fontSize: '12px' }}>
    No matching properties
  </div>
)}
```

## Acceptance Criteria

### Phase 0: Bug Fixes
- [ ] `applyInlineStyle` returns early if `el.isConnected === false`
- [ ] `columnGapUnit` is shared between Layout and Typography (no hardcoded `"px"`)
- [ ] Keyboard shortcuts are suppressed during active `LabelScrub` drag
- [ ] `onDirtyChange` prop removed from WebflowPanel; Footer uses `useSyncExternalStore`
- [ ] All 176 existing tests pass
- [ ] `npm run typecheck` passes

### Phase 1: Section Extraction
- [ ] WebflowPanel.tsx is under 250 lines
- [ ] 8 section files exist in `src/overlay/` (flat, not subdirectory)
- [ ] `panelUtils.ts` contains shared helpers (`getIndicatorType`, `detectUnit`, etc.)
- [ ] `SectionCtx` interface defined; each section receives it as a prop
- [ ] Each section defines its own props interface (no shared mega-type)
- [ ] Sections wrapped in `React.memo`
- [ ] All existing functionality works identically (no visual/behavioral regression)
- [ ] Undo/redo correctly resets all section state (panelKey remount works)
- [ ] Changing `display` in Layout correctly shows/hides flex/grid/typography sections
- [ ] `columnGap` + `columnGapUnit` stay in sync between Layout and Typography
- [ ] `npm run typecheck` passes

### Phase 2: Property Search
- [ ] Search input visible between Header and scrollable content
- [ ] Typing filters sections in real time (section-level)
- [ ] Empty query shows all sections normally
- [ ] Matched sections auto-expand via `forceOpen`
- [ ] Conditionally hidden sections stay hidden during search
- [ ] "No matching properties" shown when nothing matches
- [ ] `/` shortcut focuses search input
- [ ] Escape clears query (or closes panel if query is empty)
- [ ] `SECTION_ALIASES` map is single source of truth (~15 lines)
- [ ] `npm run typecheck` passes

## Implementation Order

```
Phase 0: Bug fixes + performance prerequisite
  0a: isConnected guard in apply.ts                    (1 line)
  0b: columnGap unit coherence                         (share unit state)
  0c: Active scrub guard for keyboard shortcuts        (5 lines)
  0d: useSyncExternalStore for dirty tracking          (remove onDirtyChange cascade)
── typecheck ──

Phase 1: Extract sections
  1a: panelUtils.ts (shared helpers)                   (move existing code)
  1b: SectionCtx interface                             (define type)
  1c: Extract 8 sections, one at a time                (typecheck after each)
  1d: Slim WebflowPanel.tsx to ~200 lines              (natural result of 1c)
  1e: Wrap sections in React.memo                      (after 0d makes it effective)
── typecheck + manual verification ──

Phase 2: Search (~30 lines total)
  2a: SECTION_ALIASES map in WebflowPanel              (15 lines)
  2b: Inline search input + filtering useMemo          (15 lines)
  2c: forceOpen prop on Section                        (1 line change)
  2d: / and Escape keyboard shortcuts                  (5 lines)
  2e: No results state                                 (5 lines)
── typecheck + full verification ──
```

## Key Design Decisions

| Decision | Choice | Rationale | Agent Consensus |
|---|---|---|---|
| Shared state mechanism | **SectionCtx prop object** | 8 direct children, 1 level — props are simpler, explicit, and avoid context re-render issues | 4/6 agents: props |
| Cross-section state | Props from parent | Only `display`, `columnGap`, `columnGapUnit`, derived flags | All agents agree |
| Section callbacks | Section-local | Each section owns its handlers, receives `apply` via `ctx` prop | All agents agree |
| Dirty tracking | **useSyncExternalStore** on apply.ts | Eliminates 60fps re-render cascade; makes React.memo effective | Performance Oracle P0 |
| `resetCss` location | **NOT in SectionCtx** | Current signature couples to calling site. Sections compose their own reset. | TypeScript reviewer |
| Filtering granularity | Section-level | Property-level requires invasive refactor of composite controls | All agents agree |
| Search keywords | **Single SECTION_ALIASES map** | Replaces 8 per-section keyword exports (~120 lines) with 1 map (~15 lines) | Simplicity reviewer |
| Search state location | **Local to WebflowPanel** | Resets on undo (panelKey remount) — acceptable UX, avoids coupling to Overlay | Simplicity reviewer |
| forceOpen | **Simple boolean override** | `const open = forceOpen \|\| ownOpen` — no save/restore complexity needed | Patterns reviewer |
| File organization | **Flat in src/overlay/** | No `sections/` subdirectory. `*Section.tsx` naming convention provides grouping. Avoids `../` import noise. | Simplicity reviewer |
| Element type | **Keep as `Element`** — narrow to HTMLElement only where needed | Matches existing WebflowPanelProps. Scattered `as HTMLElement` casts already exist and are acceptable. | TypeScript reviewer |

## Dependencies & Risks

**Risks:**
- **State desync after extraction** — Changing `display` in Layout must propagate to parent to update `isFlex`/`isGrid` flags. Missing a callback wiring causes silent bugs.
- **Undo shows stale values** — If any section memoizes state across `key` changes, remount won't reset. Must verify `key={panelKey}` propagates to all sections.
- **Import graph** — Each section needs specific subsets of imports. Missing imports cause runtime errors on rare interactions.
- **`onDirtyChange` removal** — Must verify Footer still updates correctly via `useSyncExternalStore`. Test: drag slider → check footer shows "N changes".

**Mitigations:**
- Extract one section at a time, typecheck after each
- Test element type matrix: flex parent, grid parent, text element, media element, positioned element
- Verify undo/redo resets all sections after full extraction
- Phase 0 bugs fixed before extraction begins (cleaner foundation)

## Performance Notes

**Before extraction**: Every slider drag re-renders all 8 sections (1,540 lines of JSX) via `onDirtyChange` cascade.

**After extraction + Phase 0d**:
- Slider drag in TypographySection → only TypographySection re-renders (local state change)
- Other sections don't re-render (React.memo + no parent re-render)
- Footer updates via `useSyncExternalStore` (direct subscription to apply.ts, no prop chain)

**Additional opportunity (P2, not in scope)**: Cache `getAuthoredValue` results per element. Currently walks all stylesheets N times during mount. Build a single authored-value map per mount instead.

## References

- `src/overlay/WebflowPanel.tsx` — The 1,540-line monolith to extract
- `src/overlay/Overlay.tsx` — Parent lifecycle; owns `panelKey`
- `src/overlay/controls.tsx:41-97` — `Section` component (needs `forceOpen` prop)
- `src/overlay/apply.ts` — Style engine; needs `isConnected` guard + `useSyncExternalStore` exports
- `src/overlay/CSSVariablesSection.tsx` — Existing precedent for extracted section (uses props, not context)
- `src/overlay/panelConstants.tsx` — Option arrays consumed by sections
- `src/overlay/LabelScrub.tsx` — Needs scrub start/end callbacks for keyboard guard
- `webflow-style-panel-spec.md` — Full spec reference
