---
title: "Panel Polish: Tier 2-3 (Timing, Thumbs, Keyboard, ARIA, Toast, DnD, Swatches)"
type: feat
date: 2026-03-11
deepened: 2026-03-11
---

# Panel Polish: Tier 2-3

## Enhancement Summary

**Deepened on:** 2026-03-11
**Sections enhanced:** 6 phases + new race-condition section
**Research agents used:** simplicity-reviewer, architecture-strategist, performance-oracle, frontend-races-reviewer, best-practices-researcher, framework-docs-researcher, pattern-recognition-specialist, code-simplicity-reviewer

### Key Improvements
1. ~40% of originally planned work already exists on this branch — plan trimmed to delta-only
2. Identified 6 race conditions (4 in planned features, 2 in existing code) with mitigations
3. Motion's `spring()` generates CSS `linear()` easing — better than hand-tuned cubic-bezier for DnD settle
4. WAI-ARIA APG patterns verified: activedescendant for combobox, roving tabindex for radiogroup/tablist

### Status of Existing Code
| Feature | Status | Remaining Work |
|---------|--------|----------------|
| Toast animation | **Done** (Footer.tsx) | Fix same-text key race, add timing tokens, minHeight |
| SelectRow KB nav | **Done** (useDropdownKeyboard) | Add type-ahead, scrollIntoView, aria-activedescendant |
| SelectRow ARIA | **Done** (controls.tsx) | Add aria-activedescendant + aria-controls |
| UnitSelector ARIA | **Done** (UnitSelector.tsx) | Add aria-activedescendant + aria-controls |
| IconButtonGroup ARIA | **Partial** | Fix: hardcodes radiogroup in multi-select (should be toolbar) |
| DisplayTabs ARIA | **Wrong pattern** | Fix: uses radiogroup (should be tablist/tab/aria-selected) |
| Slider thumb CSS | **Partial** (Overlay.tsx:728-752) | Enhance: 10→12px, add active state, scale, glow ring |
| Timing tokens | Not started | Full implementation needed |
| DnD settle | Not started | Full implementation needed |
| Swatches | Not started | Full implementation needed |

---

## Implementation Order & Dependency Chain

```
1. Timing tokens ──> 2. Slider thumb (enhance existing)
                 ──> 3. Toast fixes (enhance existing)
                 ──> 4. ARIA fixes (delta on existing)
                 ──> 5. DnD settle animation
                 ──> 6. Color picker swatches
```

Phases 2-4 are small deltas on existing code. Phases 5-6 are new features.

---

## Phase 1: Canonical Timing System

**Files:** New `src/overlay/timing.ts`, then refactor 15+ existing files

### Token Taxonomy

```typescript
// src/overlay/timing.ts
export const timing = {
  instant: 50,   // selector highlight
  micro:   60,   // dropdown option hover
  fast:    80,   // button/control hover background
  normal: 100,   // text feedback, state transitions
  expand: 150,   // section collapse/expand, chevron rotate
  layout: 200,   // drag displacement, focus ring transitions
  slow:   300,   // scrollbar fade, complex animations
} as const;

export type TimingKey = keyof typeof timing;

/** Convert timing token to CSS duration string */
export const ms = (key: TimingKey) => `${timing[key]}ms`;
```

### Research Insight: `ms()` Signature

The `ms()` helper should accept `TimingKey` (not raw `number`) to enforce that only sanctioned values flow into CSS strings. This catches typos at compile time — `ms("fst")` errors, `ms(80)` silently passes. Any one-off value that doesn't fit a token is a signal to add a new token or question the design.

### Refactor Scope (47 occurrences across 15+ files)

| Value | Files to update |
|-------|----------------|
| `60ms` | `controls.tsx`, `UnitSelector.tsx`, `StateSelector.tsx`, `layoutControls.tsx` |
| `80ms` | `IconButtonGroup.tsx`, `UnitSelector.tsx`, `StateSelector.tsx`, `controls.tsx`, `layoutControls.tsx`, `WebflowPanel.tsx`, `TransformEditor.tsx`, `Overlay.tsx` |
| `100ms` | `Footer.tsx`, `ShadowEditor.tsx`, `CornerRadiusEditor.tsx`, `SideSelector.tsx`, `SpacingBoxModel.tsx`, `ViewportBar.tsx`, `SizeInputCell.tsx`, `DragHandle.tsx`, `ColorPickerEnhanced.tsx`, `controls.tsx` |
| `150ms` | `controls.tsx` (x2), `Overlay.tsx`, `WebflowPanel.tsx` (x2) |
| `200ms` | `useDragReorder.ts` (x2), `Overlay.tsx` (x2) |
| `0.3s` | `Overlay.tsx` (scrollbar) |

### Rules
- Export numbers only; use `ms()` helper for CSS strings
- Preserve exact values — do not normalize (keep the one `50ms` as `timing.instant`)
- Template-interpolate into `dangerouslySetInnerHTML` CSS strings in `Overlay.tsx`
- No transition presets yet — just raw timing values

### Acceptance Criteria

- [ ] `timing.ts` exports the token object, `TimingKey` type, and `ms()` helper
- [ ] `ms()` accepts `TimingKey` only (not arbitrary numbers)
- [ ] All 47 magic-number timing values replaced with token references
- [ ] `npm run typecheck` passes
- [ ] Zero behavior change — visual output identical before/after

---

## Phase 2: Slider Thumb Styling (Enhance Existing)

**Files:** `src/overlay/Overlay.tsx` (lines 728-770, existing global `<style>`)

### Current State

Slider thumb styles already exist at Overlay.tsx:728-770 with:
- 10px diameter, white/gray appearance
- Hover: changes to `#6366f1`
- No active state, no scale, no glow ring

### Changes Needed

Update existing thumb styles — do NOT create new rules, edit in place:

```css
/* EXISTING at line 740 — UPDATE these values: */
.__tuner-root input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;          /* was 10px */
  height: 12px;         /* was 10px */
  border-radius: 50%;
  background: #6366f1;  /* was rgba(255,255,255,0.7) — use accent as default */
  border: 2px solid rgba(255,255,255,0.9);  /* was 1px solid rgba(255,255,255,0.3) */
  box-shadow: 0 0 3px rgba(0,0,0,0.4);     /* NEW */
  margin-top: -4.5px;   /* was -3.5px — recalculate: (12-3)/2 = 4.5 */
  cursor: pointer;
  transition: transform ${ms("fast")}, box-shadow ${ms("fast")};  /* was background 80ms */
}

/* EXISTING at line 750 — ADD scale + glow: */
.__tuner-root input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.25);
  background: #6366f1;  /* keep */
}

/* NEW — add active state: */
.__tuner-root input[type="range"]::-webkit-slider-thumb:active {
  transform: scale(1.1);
  background: #818cf8;
}

/* Firefox — mirror the same changes for ::-moz-range-thumb */
```

### Research Insight: margin-top Calculation

The `margin-top` value for `::-webkit-slider-thumb` must be `-(thumbHeight - trackHeight) / 2` to vertically center the thumb on the track. Track is 3px, thumb is 12px → `-(12-3)/2 = -4.5px`.

### Acceptance Criteria

- [ ] Thumb size increased to 12px with accent color default
- [ ] Hover: scale(1.15) + glow ring
- [ ] Active/pressed: #818cf8 + scale(1.1)
- [ ] Firefox `::-moz-range-thumb` mirrors webkit styles
- [ ] margin-top recalculated for 12px thumb
- [ ] Uses timing tokens from Phase 1
- [ ] `npm run typecheck` passes

---

## Phase 3: Toast Feedback Fixes (Delta on Existing)

**Files:** `src/overlay/Footer.tsx`

### Current State

Toast animation already implemented (Footer.tsx:140-154):
- `AnimatePresence` + `motion.span` with fade+slide
- `role="status"` + `aria-live="polite"` ✓
- BUT: `key={clipboardMessage || message}` — same-text produces no re-animation
- BUT: uses `duration: 0.15` not timing tokens
- BUT: no `minHeight` on container — Reset button jumps

### Changes Needed (3 small fixes)

**Fix 1: Monotonic counter key** — When rapid copy clicks produce identical text (e.g., "Copied!" twice), the key doesn't change and there's no re-animation. Add a counter:

```tsx
const messageCounterRef = useRef(0);
// In showMessage or wherever message state is set:
messageCounterRef.current += 1;

// In JSX:
<motion.span
  key={`${clipboardMessage || message}-${messageCounterRef.current}`}
  // ... rest unchanged
```

**Fix 2: Timing tokens** — Replace `duration: 0.15` with `timing.normal / 1000`:

```tsx
transition={{ duration: timing.normal / 1000 }}  // 100ms → 0.1
```

**Fix 3: Container minHeight** — Add to the message container div:

```tsx
<div role="status" aria-live="polite" style={{ minHeight: "20px" }}>
```

### Research Insight: AnimatePresence mode

The current code uses default `mode="sync"` (not `mode="wait"`). This is correct — Motion v12 has documented race condition bugs with `mode="wait"` where rapid state changes can leave components stuck in exit state. Keep `mode="sync"`.

### Acceptance Criteria

- [ ] Same-text rapid clicks produce re-animation (counter key fix)
- [ ] Uses timing tokens (`timing.normal`)
- [ ] Reset button doesn't jump (minHeight)
- [ ] `npm run typecheck` passes

---

## Phase 4: ARIA Fixes (Delta on Existing)

**Files:** `controls.tsx`, `UnitSelector.tsx`, `IconButtonGroup.tsx`, `layoutControls.tsx`, `useDropdownKeyboard.ts`

Most ARIA work is already done. This phase addresses the remaining gaps.

### 4A: SelectRow + UnitSelector — Add Missing ARIA Attributes

Both components already have `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`, `role="listbox"`, `role="option"`, `aria-selected`, and `useDropdownKeyboard` wired in.

**Missing attributes to add:**

```tsx
// On the combobox trigger button — add these two:
aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined}
aria-controls={`${id}-listbox`}

// On the listbox container — add id:
id={`${id}-listbox`}

// Each option needs an id matching activedescendant:
id={`${id}-opt-${index}`}
```

Generate IDs with `useId()` (React 19 — already in use in this project).

### 4B: useDropdownKeyboard — Add Type-ahead + ScrollIntoView

**Type-ahead** (opt-in via `labels` prop):

```typescript
interface UseDropdownKeyboardOptions {
  // ... existing props
  labels?: string[];  // opt-in: option labels for type-ahead matching
}

// Inside the hook:
const typeBuffer = useRef("");
const typeTimer = useRef<ReturnType<typeof setTimeout>>();

// In onListKeyDown, add default case:
default:
  if (labels && e.key.length === 1) {
    typeBuffer.current += e.key.toLowerCase();
    clearTimeout(typeTimer.current);
    typeTimer.current = setTimeout(() => { typeBuffer.current = ""; }, 500);
    const match = labels.findIndex(l => l.toLowerCase().startsWith(typeBuffer.current));
    if (match >= 0) setHighlightedIndex(match);
  }
```

**ScrollIntoView** — return a ref callback from the hook:

```typescript
// In the hook return:
const optionRefCallback = useCallback((el: HTMLElement | null) => {
  el?.scrollIntoView({ block: "nearest" });
}, []);

// Usage in component — attach to the highlighted option:
ref={index === highlightedIndex ? optionRefCallback : undefined}
```

**Fix stale closure bug** — The current Enter handler reads `highlightedIndex` directly from the closure, but `setHighlightedIndex` is async. Use a ref:

```typescript
const highlightedRef = useRef(highlightedIndex);
highlightedRef.current = highlightedIndex;

// In Enter handler:
case "Enter":
  e.preventDefault();
  if (highlightedRef.current >= 0 && highlightedRef.current < optionCount) {
    onSelect(highlightedRef.current);
  }
  break;
```

### 4C: IconButtonGroup — Fix Multi-select Mode

Currently hardcodes `role="radiogroup"` even in multi-select mode.

```tsx
// Container:
role={multiSelect ? "toolbar" : "radiogroup"}

// Each button:
role={multiSelect ? undefined : "radio"}
aria-checked={multiSelect ? undefined : isSelected}
aria-pressed={multiSelect ? isSelected : undefined}
```

### 4D: DisplayTabs — Fix to Tablist Pattern

Currently uses `role="radiogroup"` + `role="radio"` + `aria-checked`. Should be:

```tsx
// Container:
role="tablist"

// Each tab:
role="tab"
aria-selected={isActive}
tabIndex={isActive ? 0 : -1}
```

Arrow key nav is already implemented (left/right). Change `aria-checked` → `aria-selected`.

### Research Insight: activedescendant vs Roving Tabindex

WAI-ARIA APG specifies two keyboard patterns:
- **`aria-activedescendant`**: Required for combobox pattern (SelectRow, UnitSelector). Focus stays on the trigger; highlighted option is indicated via `aria-activedescendant`.
- **Roving tabindex**: Required for radiogroup, toolbar, tablist (IconButtonGroup, DisplayTabs). Move `tabIndex={0}` to the focused item, all others get `tabIndex={-1}`.

The existing code correctly uses arrow keys for both patterns. We just need to add `aria-activedescendant` to comboboxes and fix `tabIndex` for radiogroup/tablist.

### Acceptance Criteria

- [ ] SelectRow + UnitSelector: `aria-activedescendant` + `aria-controls` attributes
- [ ] useDropdownKeyboard: type-ahead with 500ms buffer (opt-in via `labels`)
- [ ] useDropdownKeyboard: scrollIntoView ref callback on highlighted option
- [ ] useDropdownKeyboard: stale closure fix for Enter handler
- [ ] IconButtonGroup: `toolbar` + `aria-pressed` in multi-select mode
- [ ] DisplayTabs: `tablist` + `tab` + `aria-selected` (replace radiogroup)
- [ ] IDs generated via `useId()`
- [ ] `npm run typecheck` passes

---

## Phase 5: Shadow/Transform DnD Improvements

**Files:** `src/overlay/useDragReorder.ts`

### Approach: CSS-based Settle Animation

Add a `settling` phase to the hook's state machine:

```typescript
type DragPhase =
  | { type: "idle" }
  | { type: "pending"; pointerId: number; startY: number }
  | { type: "dragging"; pointerId: number; startY: number; currentY: number; dragIndex: number }
  | { type: "settling" };
```

State flow:
```
pointerdown → 3px dead zone → dragging → pointerup → settling (200ms) → idle
```

### Settle Phase Implementation

```typescript
// On pointerup in dragging state:
1. Call onReorder() immediately — items move to final array order
2. Use requestAnimationFrame to set phase to "settling" AFTER React commits the reorder
3. During settling: CSS transition on all items: transform ${ms("layout")} <spring-easing>
4. The dragged item animates from its drag offset to translateY(0)
5. Displaced items animate back to translateY(0)
6. After timing.layout ms, clear to idle

// Cancellable timeout:
const settleTimer = useRef<ReturnType<typeof setTimeout>>();
// On new pointerdown during settle: clearTimeout, skip to idle immediately
```

### Research Insight: requestAnimationFrame for Settle

The `requestAnimationFrame` call between reorder and settle is critical. Without it, React batches the array reorder and the settling state change into one render — items jump to new positions with the transition already applied, causing them to animate FROM the correct position. The rAF separates them into two frames:
1. Frame 1: Items move to new array order (no transition yet)
2. Frame 2: Settle state applies transition + translateY(0) → items animate into place

### Spring Easing

Use Motion's `spring()` function to generate a CSS `linear()` easing curve. Motion v12 converts spring physics into a CSS `linear()` approximation that runs on the GPU:

```typescript
import { spring } from "motion";

// In the settle phase CSS transition:
transition: `transform ${ms("layout")} ${spring({ stiffness: 400, damping: 25 })}`
```

If `spring()` doesn't export a CSS string directly, fall back to `cubic-bezier(0.34, 1.56, 0.64, 1)` — a good CSS spring approximation with slight overshoot.

### Race Condition: New Drag During Settle

If the user starts a new drag while items are settling:
1. `clearTimeout(settleTimer.current)`
2. Immediately set phase to `idle`, then process the new `pointerdown` as normal
3. Items snap to their settled positions (transition removed when phase exits settling)

### Acceptance Criteria

- [ ] Drop animation: items spring-settle into place over 200ms
- [ ] Discriminated union for DragPhase type
- [ ] requestAnimationFrame separates reorder from settle
- [ ] New drag during settle: cancels settle cleanly
- [ ] Cancel (drop in same position): no settle animation
- [ ] Works for both ShadowEditor and TransformEditor
- [ ] Uses timing tokens
- [ ] `npm run typecheck` passes

---

## Phase 6: Color Picker Swatch Palette

**Files:** New `src/overlay/useSwatches.ts`, modify `src/overlay/ColorPickerEnhanced.tsx`

### Storage: Module-level Store + localStorage

```typescript
// src/overlay/useSwatches.ts
type HexColor = `#${string}`;

interface Swatch {
  hex: HexColor;
  opacity: number;
}

const STORAGE_KEY = "__tuner_swatches";
const MAX_SWATCHES = 24;  // 3 rows of 8

// Module-level source of truth — read localStorage ONCE at module load
let swatches: Swatch[] = readFromStorage();
const listeners = new Set<() => void>();

function readFromStorage(): Swatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function notify() {
  // Cache snapshot to return STABLE reference from getSnapshot
  cachedSnapshot = [...swatches];
  listeners.forEach(fn => fn());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(swatches));
}

let cachedSnapshot = [...swatches];

// useSyncExternalStore integration
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() { return cachedSnapshot; }
function getServerSnapshot() { return [] as Swatch[]; }  // SSR safety

// Hook
export function useSwatches() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { swatches: list, addSwatch, removeSwatch };
}
```

### Research Insight: Stable getSnapshot Reference

`useSyncExternalStore` compares snapshot references with `Object.is()`. If `getSnapshot` returns a new array every call, React re-renders every subscribed component on every store notification — even if the data hasn't changed. The `cachedSnapshot` pattern ensures the same reference is returned until `notify()` creates a new one.

### Research Insight: HexColor Branded Type

Using `type HexColor = \`#${string}\`` gives compile-time validation that hex strings always include the `#` prefix. This prevents bugs where `"ff0000"` and `"#ff0000"` are mixed.

### UI Layout

```
─── Swatches ──────────────────
[sq][sq][sq][sq][sq][sq][sq][sq]
[sq][sq][sq][sq][sq][sq][sq][+]
```

- Grid: 8 columns, ~24px squares with 4px gap
- Fits within the 216px canvas width (`CANVAS_W`)
- "+" button adds current color to swatches
- Hover on swatch shows small X delete button (top-right corner)
- Click swatch: applies hex + opacity, updates all picker state

### Decisions
- Swatches store `{ hex, opacity }` — preserves full color info
- Max 24 swatches; adding beyond max replaces oldest
- Starts empty (no preset colors)
- Duplicate prevention: skip if hex+opacity match exactly
- Module-level variable is the source of truth; localStorage is persistence layer

### ARIA for Swatches
- Grid: `role="grid"` with `aria-label="Saved color swatches"`
- Each swatch: `role="gridcell"` with `aria-label` describing the color (e.g., "#FF0000 at 100%")

### Acceptance Criteria

- [ ] Swatch grid renders below color mode inputs
- [ ] Click swatch applies color + opacity
- [ ] "+" button adds current color
- [ ] Hover shows X delete button
- [ ] Persists to localStorage across page reloads
- [ ] Shared across all picker instances (verified by opening two color pickers)
- [ ] Max 24 swatches with oldest-replacement
- [ ] Duplicate prevention
- [ ] `getSnapshot` returns stable reference
- [ ] `getServerSnapshot` returns empty array for SSR
- [ ] `HexColor` branded type used
- [ ] ARIA roles on grid
- [ ] `npm run typecheck` passes

---

## Race Condition Mitigations

Identified by the frontend-races-reviewer. Each must be addressed in its respective phase.

| # | Location | Bug | Fix |
|---|----------|-----|-----|
| 1 | Footer.tsx toast | Same-text rapid clicks → no re-animation | Monotonic counter ref as part of motion key (Phase 3) |
| 2 | useDragReorder.ts | New drag during settle reads mid-transition rects | Cancellable settle timeout; snap to idle on new pointerdown (Phase 5) |
| 3 | useDropdownKeyboard.ts | Enter handler reads stale `highlightedIndex` from closure | Sync to ref: `highlightedRef.current = highlightedIndex` (Phase 4) |
| 4 | useDropdownKeyboard.ts | Type-ahead timer leaks on unmount | `useEffect` cleanup: `return () => clearTimeout(typeTimer.current)` (Phase 4) |
| 5 | useSwatches.ts | Torn read if localStorage written from another tab | `window.addEventListener("storage", ...)` to sync cross-tab (Phase 6, stretch) |
| 6 | Footer.tsx save | Double-click Save fires two concurrent requests | Already guarded by `saving` state — verify ref-based guard (Phase 3, verify only) |

---

## Technical Considerations

### Performance
- Timing token refactor is zero-runtime-cost (same values, just imported from a module)
- Swatch `useSyncExternalStore` triggers re-renders only in mounted ColorPickerEnhanced instances
- DnD settle phase uses CSS transitions (GPU-accelerated), not JS animation loops
- `getSnapshot` returns cached reference — prevents unnecessary React re-renders

### Bundle Impact
- `timing.ts`: ~200 bytes (tree-shakeable)
- `useSwatches.ts`: ~400 bytes (only loaded when color picker opens)
- No new dependencies — Motion is already in the bundle

### Cross-browser
- Slider thumb: `::-webkit-slider-thumb` (Chrome/Safari/Edge) + `::-moz-range-thumb` (Firefox)
- `React.useId()` available in React 19 (this project uses React 19)
- `useSyncExternalStore` available in React 19

## References

### Internal
- `src/overlay/controls.tsx:242-376` — SelectRow (ARIA delta target)
- `src/overlay/UnitSelector.tsx` — UnitSelector (ARIA delta target)
- `src/overlay/useDropdownKeyboard.ts` — Shared keyboard hook (type-ahead + fix target)
- `src/overlay/Footer.tsx:140-154` — Existing toast animation (fix target)
- `src/overlay/useDragReorder.ts:128-152` — Drop logic (DnD settle target)
- `src/overlay/ColorPickerEnhanced.tsx:78-83` — Picker interface (swatch target)
- `src/overlay/IconButtonGroup.tsx:17-89` — Multi-mode ARIA fix target
- `src/overlay/layoutControls.tsx:235-341` — DisplayTabs ARIA fix target
- `src/overlay/Overlay.tsx:728-770` — Existing slider thumb styles (enhance target)

### Spec
- `webflow-style-panel-spec.md` line 740 — Section 12: Input Controls & Units
- `webflow-style-panel-spec.md` line 828 — Section 13: Keyboard & Interaction Patterns
- `webflow-style-panel-spec.md` line 794-824 — Color Picker + Swatches spec
