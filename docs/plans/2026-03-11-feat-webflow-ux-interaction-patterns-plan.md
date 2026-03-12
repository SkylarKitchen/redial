---
title: "feat: Add Webflow UX interaction patterns"
type: feat
date: 2026-03-11
---

# Add Webflow UX Interaction Patterns

## Overview

Redial has full CSS property coverage (44 tasks, Phases A-H) and a prior plan covers canvas overlays, command palette, navigator, and context menus (`2026-03-11-feat-webflow-ux-features-plan.md`). This plan targets the **interaction micro-patterns** that make Webflow's style panel feel fast and intelligent — math in inputs, clickable style labels, focus mode, effect layer management, undo grouping, and CSS variable indicators.

## Problem Statement

Power users interact with style panels hundreds of times per session. The difference between "functional" and "fast" is in the micro-interactions: typing `*2` to double a value, clicking a blue label to reset one property, or toggling an effect layer's visibility without deleting it. These patterns reduce clicks, prevent errors, and create muscle memory. Redial currently requires more clicks and more intent than Webflow for common operations.

## Proposed Solution

16 features across 6 phases, ordered by impact and dependency. Each phase is independently shippable.

## Technical Approach

### Architecture

All features modify existing files rather than creating new components:
- **Input intelligence** → `ValueInput.tsx`, `SizeInputCell.tsx`, `TypoValueCell.tsx` (shared via a `useInputMath` hook)
- **Style labels** → `StyleIndicator.tsx`, `Section.tsx`, `WebflowPanel.tsx`
- **Panel navigation** → `Overlay.tsx`, `WebflowPanel.tsx`
- **Effect layers** → `ShadowEditor.tsx`, `FilterSliders.tsx`, `BackgroundLayerList.tsx`, `TransitionEditor.tsx`
- **Undo grouping** → `apply.ts`
- **Variable indicators** → `CSSVariablesSection.tsx`, `ValueInput.tsx`, `ColorRow.tsx`

### Existing Shortcut Map (avoid conflicts)

| Shortcut | Current Action |
|----------|---------------|
| `` ` `` | Toggle selection mode |
| `S` | Cycle scope |
| `R` | Reset element |
| `D` (hold) | Diff peek |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+S` | Save to source |
| `Cmd+C` | Copy CSS (guard: not in text input) |
| `Cmd+Alt+C/V` | Copy/Paste styles |
| Arrow keys | Element navigation |
| `Tab/Shift+Tab` | Focus navigation |

### New Shortcuts (this plan)

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+S` | Toggle Focus Mode |
| `Shift+/` | Keyboard shortcut overlay |
| `Alt+Click` on label | Reset single property |
| `Alt+Click` on orange label | Show inheritance source |

---

### Implementation Phases

#### Phase I: Input Intelligence

The highest-impact, lowest-risk features. Modify 3 existing input components.

##### Task I.1: Math Expressions in Numeric Inputs
**Files: `src/overlay/controls.tsx` (new shared hook), `src/overlay/ValueInput.tsx`, `src/overlay/SizeInputCell.tsx`, `src/overlay/TypoValueCell.tsx`**

Add a `useInputMath` hook that intercepts `onKeyDown` + `onBlur`:
- On Enter or blur, check if the text matches pattern: `^[0-9.]+\s*[+\-*/]\s*[0-9.]+`
- If yes, evaluate the expression and replace with the result
- Preserve the current unit (e.g., `200px` → type `*2` → `400px`)
- Support chained expressions: `100 + 50 + 25` = `175`

Implementation:
```ts
// useInputMath.ts
function evaluateMathExpr(input: string, currentValue: number): number | null {
  // Match: optional_number operator number
  // e.g., "*2", "+10", "200 + 50", "/ 3"
  const match = input.match(/^([0-9.]*)\s*([+\-*/])\s*([0-9.]+)$/);
  if (!match) return null;
  const left = match[1] ? parseFloat(match[1]) : currentValue;
  const right = parseFloat(match[3]);
  switch (match[2]) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return right !== 0 ? left / right : null;
  }
  return null;
}
```

Edge cases:
- Division by zero → no-op, keep current value
- Result is negative for properties that don't allow negative (e.g., width) → clamp to 0
- Result has many decimal places → round to 2 decimal places
- Expression typed without leading number (e.g., just `*2`) → use current value as left operand
- Unit in expression (e.g., `200px + 10px`) → strip units before evaluating, re-apply current unit

Acceptance criteria:
- [ ] Typing `*2` in a value field doubles the current value
- [ ] Typing `+10` adds 10 to the current value
- [ ] Typing `200 + 50` evaluates to 250
- [ ] Division by zero is a no-op
- [ ] Current unit is preserved after evaluation
- [ ] Works in ValueInput, SizeInputCell, and TypoValueCell
- [ ] Expression evaluation happens on Enter and on blur
- [ ] Non-expression text (regular numbers) behaves normally (no regression)

##### Task I.2: Empty Field → Contextual Keyword
**Files: `src/overlay/ValueInput.tsx`, `src/overlay/SizeInputCell.tsx`**

When a user clears a numeric input and presses Enter, insert the CSS keyword appropriate for that property instead of setting to `0`:

```ts
const KEYWORD_MAP: Record<string, string> = {
  'width': 'auto',
  'height': 'auto',
  'min-width': 'auto',
  'min-height': 'auto',
  'max-width': 'none',
  'max-height': 'none',
  'top': 'auto',
  'right': 'auto',
  'bottom': 'auto',
  'left': 'auto',
  'z-index': 'auto',
  'flex-basis': 'auto',
  'flex-grow': '0',
  'flex-shrink': '1',
  'order': '0',
  'gap': 'normal',
  'column-gap': 'normal',
  'row-gap': 'normal',
};
```

The keyword map is passed as an optional prop `emptyKeyword` so each usage site specifies what "empty" means.

Acceptance criteria:
- [ ] Clearing width input and pressing Enter sets `auto`, not `0`
- [ ] Clearing max-width input and pressing Enter sets `none`
- [ ] Clearing z-index sets `auto`
- [ ] Properties without a keyword mapping still default to `0` (backwards compatible)
- [ ] Visual feedback: keyword text appears in the input field (styled with `opacity: 0.5` to distinguish from explicit values)

##### Task I.3: Alt+Click on Label to Reset Single Property
**Files: `src/overlay/SliderRow.tsx`, `src/overlay/controls.tsx`, `src/overlay/ColorRow.tsx`, `src/overlay/SelectRow.tsx`**

Add an `onAltClick` handler to all property labels:
- Alt+Click on any property label → call `apply(prop, '')` which removes the inline override
- Visual feedback: brief indigo flash on the label
- Only enabled when the property has a local override (StyleIndicator shows "element" or "direct")
- No-op on inherited or default properties

Implementation:
```tsx
// In SliderRow, ColorRow, SelectRow, etc.
const handleLabelClick = useCallback((e: React.MouseEvent) => {
  if (e.altKey && indicatorType !== 'none' && indicatorType !== 'inherited') {
    apply(prop, ''); // removes override
    // flash animation
  }
}, [prop, indicatorType]);
```

Acceptance criteria:
- [ ] Alt+Click on a blue-indicator label clears that property
- [ ] Alt+Click on a non-overridden label is a no-op
- [ ] Brief flash animation confirms the reset
- [ ] Property reverts to inherited/default value
- [ ] Reset is added to undo stack
- [ ] Works on SliderRow, ColorRow, SelectRow, TextRow labels

---

#### Phase J: Interactive Style Labels

Upgrade StyleIndicator from passive dots to interactive colored labels.

##### Task J.1: Colored Label Text
**Files: `src/overlay/StyleIndicator.tsx`, `src/overlay/SliderRow.tsx`, `src/overlay/ColorRow.tsx`, `src/overlay/SelectRow.tsx`**

Instead of (or in addition to) a small colored dot, the property label TEXT itself changes color:

| Indicator Type | Label Color | Meaning |
|---------------|-------------|---------|
| `element` | `#60a5fa` (blue-400) | User set this directly in current session |
| `direct` | `#60a5fa` (blue-400) | In current rule/class |
| `inherited` | `#f59e0b` (amber-400) | Inherited from parent/class |
| `state` | `#34d399` (green-400) | Set on a pseudo-class state |
| `none` | `rgba(255,255,255,0.5)` | Default (no custom style) |

Implementation approach:
- Add a `labelColor` export to `StyleIndicator.tsx` that returns the appropriate color string
- Each control component wraps its label in a `<span>` with that color
- The label also gets `cursor: pointer` when clickable (non-none indicator)

Acceptance criteria:
- [ ] Property labels turn blue when locally set
- [ ] Labels turn amber when inherited
- [ ] Labels turn green when state-specific
- [ ] Labels remain dim white when at default
- [ ] Color updates when user makes changes (reactive to indicator type)

##### Task J.2: Clickable Labels with Context-Dependent Behavior
**Files: `src/overlay/SliderRow.tsx`, `src/overlay/controls.tsx`**

Extend labels with click behavior (non-Alt click):

- **Blue/element label** → Click shows a small tooltip: "Set locally. Alt+Click to reset."
- **Orange/inherited label** → Click shows tooltip: "Inherited from `<parentTag.className>`. Click to navigate." Clicking the tooltip selects the parent element.
- **Green/state label** → Click shows tooltip: "Set on :hover. Alt+Click to clear."
- **None label** → No click behavior

Implementation: small tooltip component positioned above the label, auto-dismisses after 3s or on mouse leave.

Acceptance criteria:
- [ ] Click on blue label shows "Set locally" tooltip
- [ ] Click on orange label shows inheritance source with parent element info
- [ ] Click on orange tooltip navigates to the parent element
- [ ] Click on green label shows the state name
- [ ] Tooltip auto-dismisses after 3 seconds
- [ ] Tooltips don't overflow the 300px panel width

---

#### Phase K: Panel Navigation UX

##### Task K.1: Focus Mode
**Files: `src/overlay/WebflowPanel.tsx`, `src/overlay/Overlay.tsx`**

When Focus Mode is active, opening any section auto-collapses all other sections. This reduces scrolling in the 300px panel.

- Toggle with `Alt+Shift+S` (stored in localStorage as `tuner-focus-mode`)
- Visual indicator: small "Focus" pill in the panel header when active
- When toggling a section open in Focus Mode:
  1. Collapse all currently open sections
  2. Open the clicked section
  3. Scroll to the opened section header
- When Focus Mode is off, sections behave as current (independent collapse)

State management:
```ts
const [focusMode, setFocusMode] = useState(
  () => localStorage.getItem('tuner-focus-mode') === 'true'
);

const handleSectionToggle = useCallback((sectionId: string) => {
  if (focusMode) {
    // Close all, open only this one
    setOpenSections(new Set([sectionId]));
  } else {
    // Toggle this one independently
    setOpenSections(prev => { /* existing logic */ });
  }
}, [focusMode]);
```

Acceptance criteria:
- [ ] Alt+Shift+S toggles Focus Mode
- [ ] "Focus" pill visible in header when active
- [ ] Opening a section closes all others in Focus Mode
- [ ] Focus Mode preference persists in localStorage
- [ ] Normal mode (independent sections) still works when Focus Mode is off
- [ ] Smooth scroll to opened section header

##### Task K.2: Sticky Section Headers
**Files: `src/overlay/WebflowPanel.tsx` or `src/overlay/Section.tsx`**

Section headers stick to the top of the scrollable panel area while scrolling through that section's content:

- Use `position: sticky; top: 0; z-index: 10;` on section header divs
- Background must be opaque (`#1e1e1e`) to cover scrolling content
- Only the CURRENT section header sticks (subsequent headers push it out)
- The sticky header should have a subtle bottom border when stuck: `1px solid rgba(255,255,255,0.1)`

Implementation considerations:
- The panel uses a scrollable div — sticky positioning works inside scroll containers
- Need to ensure the panel's scroll container has the correct overflow context
- Collapsed sections should NOT have sticky headers (they're just one line)

Acceptance criteria:
- [ ] Expanded section headers stick to top while scrolling through section content
- [ ] Sticky header has opaque background (no content bleeding through)
- [ ] Subtle bottom shadow/border appears when header is stuck
- [ ] Collapsed section headers do not stick
- [ ] Headers push each other out naturally (only one sticks at a time)
- [ ] No layout shift when header transitions to/from sticky state

##### Task K.3: Keyboard Shortcut Reference Overlay
**Files: `src/overlay/ShortcutOverlay.tsx` (new), `src/overlay/Overlay.tsx`**

Pressing `Shift+/` (which is `?` on US keyboards) shows a full-screen keyboard shortcut reference:

- Semi-transparent dark backdrop
- Centered card (400px wide max) with all shortcuts in a two-column table
- Categories: Navigation, Editing, Panel, View
- Escape or Shift+/ again to close
- Not shown when a text input is focused

Layout:
```
┌─────────────────────────────────┐
│  Keyboard Shortcuts        [×]  │
├─────────────────────────────────┤
│  NAVIGATION                     │
│  ↑/↓/←/→    Element navigation  │
│  Tab         Next control       │
│  Esc         Close panel        │
│                                 │
│  EDITING                        │
│  Cmd+Z       Undo               │
│  Cmd+Shift+Z Redo               │
│  Cmd+S       Save to source     │
│  Cmd+C       Copy CSS           │
│  R           Reset element      │
│  Alt+Click   Reset property     │
│                                 │
│  PANEL                          │
│  `           Toggle panel       │
│  S           Cycle scope        │
│  D (hold)    Diff peek          │
│  Alt+Shift+S Focus Mode         │
│  Shift+/     This help          │
└─────────────────────────────────┘
```

Acceptance criteria:
- [ ] Shift+/ opens shortcut overlay
- [ ] All shortcuts listed with categories
- [ ] Escape or Shift+/ closes overlay
- [ ] Not triggered when text input is focused
- [ ] Dark backdrop, centered card, panel-matching dark theme

##### Task K.4: Command Palette Property Search
**Files: extend existing CommandPalette (from prior plan) OR new `PropertySearch.tsx`**

If the Command Palette from the prior plan is built, add a "Properties" tab that:
- Searches CSS properties by name (e.g., typing "font" shows font-size, font-weight, font-family, etc.)
- Selecting a property scrolls the panel to that section and highlights the property row
- Shows current value next to each result

If the Command Palette is NOT yet built, create a simpler inline search:
- Small search input at the top of the panel (below header, above sections)
- Filters visible sections/properties as user types
- Sections with no matching properties are hidden
- Clear search to show all sections again

Acceptance criteria:
- [ ] Property search finds CSS properties by name
- [ ] Selecting a result scrolls to and highlights that property
- [ ] Current value shown in search results
- [ ] Search is fast (< 50ms for filtering)
- [ ] Empty search restores all sections

---

#### Phase L: Effect Layer Management

##### Task L.1: Eye Icon Visibility Toggle on Layers
**Files: `src/overlay/ShadowEditor.tsx`, `src/overlay/FilterSliders.tsx`, `src/overlay/BackgroundLayerList.tsx`, `src/overlay/TransitionEditor.tsx`**

Add a small eye icon (👁 or SVG) on each effect layer row:
- Click toggles the layer's visibility without deleting it
- Disabled layer: store original value, apply with that layer removed from the CSS
- Re-enable: restore the original value
- Visual: disabled layer row gets `opacity: 0.4` and strikethrough on the value text
- Eye icon toggles between open-eye and closed-eye states

Implementation for multi-value properties (e.g., box-shadow with 3 shadows):
```ts
// Store disabled layer indices
const [disabledLayers, setDisabledLayers] = useState<Set<number>>(new Set());

// When applying, filter out disabled layers
const activeShadows = shadows.filter((_, i) => !disabledLayers.has(i));
const cssValue = activeShadows.map(formatShadow).join(', ') || 'none';
apply('box-shadow', cssValue);
```

Acceptance criteria:
- [ ] Eye icon on each shadow layer row
- [ ] Eye icon on each filter layer
- [ ] Eye icon on each background layer
- [ ] Eye icon on each transition
- [ ] Clicking eye toggles that layer's CSS contribution
- [ ] Disabled layer row visually dimmed (opacity: 0.4)
- [ ] Re-enabling restores the layer exactly
- [ ] Toggling is undoable
- [ ] Layer order preserved when toggling

##### Task L.2: Drag Handles for Layer Reordering
**Files: `src/overlay/ShadowEditor.tsx`, `src/overlay/BackgroundLayerList.tsx`**

Add a 6-dot drag handle (⠿) on the left side of each layer row. Drag to reorder:

- Implement with `onPointerDown` → track `pointermove` → calculate new position → reorder array → apply
- During drag: dragged item follows cursor with `position: absolute`, drop indicator line shows insertion point
- After drop: reorder the array and re-apply the CSS
- Minimum 3px movement to start drag (prevent accidental reorder on click)

Implementation:
```ts
const handleDragStart = (index: number, e: React.PointerEvent) => {
  e.preventDefault();
  const startY = e.clientY;
  const rowHeight = 36; // approx row height

  const handleMove = (moveE: PointerEvent) => {
    const deltaY = moveE.clientY - startY;
    const newIndex = Math.round(deltaY / rowHeight) + index;
    setDragTarget(clamp(newIndex, 0, layers.length - 1));
  };
  // ... pointermove/pointerup handlers
};
```

Acceptance criteria:
- [ ] 6-dot drag handle visible on each shadow layer
- [ ] 6-dot drag handle on each background layer
- [ ] Dragging reorders the layers
- [ ] Drop indicator line shows where the layer will land
- [ ] 3px dead zone before drag starts
- [ ] Reorder applies the new CSS order immediately
- [ ] Reorder is undoable

##### Task L.3: Transition Preview / Play Button
**Files: `src/overlay/TransitionEditor.tsx`**

Add a small play button (▶) next to each transition that triggers a live preview:

- Click play → temporarily apply a toggled state to the target property
  - e.g., if transition is on `opacity`, toggle opacity between current and 0
  - if on `transform`, toggle between current and `none`
  - if on `background-color`, toggle between current and a contrasting color
- After the transition duration + 200ms delay, reverse back to original
- Play button shows a spinner/loading state during playback
- Disable play if no target property is set

Acceptance criteria:
- [ ] Play button next to each transition row
- [ ] Clicking triggers a visible transition on the target element
- [ ] Transition plays forward then reverses
- [ ] Button disabled when no transition property set
- [ ] Does not interfere with other transitions
- [ ] Original values fully restored after preview

---

#### Phase M: History & Undo Enhancements

##### Task M.1: Undo Action Grouping
**Files: `src/overlay/apply.ts`**

Currently, dragging a slider from 10 to 50 creates 40 individual undo entries. Group rapid changes into one undo step:

- Add `beginBatch(label: string)` and `endBatch()` to apply.ts
- During a batch, all changes are collected into a single undo entry
- The batch entry stores `{ entries: UndoEntry[], label: string }`
- `undo()` pops the entire batch and reverts all entries
- Batch timeout: if no `endBatch()` within 5 seconds, auto-end (safety net)

Wire batching into existing interactions:
- `onPointerDown` on SliderRow thumb → `beginBatch("Adjust {prop}")`
- `onPointerUp` → `endBatch()`
- LabelScrub `onPointerDown` → `beginBatch("Scrub {prop}")`
- LabelScrub `onPointerUp` → `endBatch()`
- useWheelAdjust: debounce 500ms → start new batch on first wheel, end on 500ms idle

Acceptance criteria:
- [ ] Dragging a slider creates one undo entry (not N entries)
- [ ] Label-scrubbing creates one undo entry
- [ ] Cmd+Z after a slider drag reverts all the way to the start value
- [ ] Wheel-adjust groups nearby adjustments into one entry (500ms debounce)
- [ ] Batch auto-ends after 5s timeout (safety)
- [ ] Non-batched changes (typing a value, Enter) remain as individual entries
- [ ] Existing undo/redo tests still pass

##### Task M.2: Named Undo Entries
**Files: `src/overlay/apply.ts`**

Enrich undo stack entries with human-readable descriptions:

```ts
interface UndoEntry {
  el: Element;
  prop: string;
  prev: string;
  next: string;       // NEW: the value being set
  timestamp: number;  // NEW: Date.now()
  label: string;      // NEW: "font-size: 16px → 24px"
}
```

Auto-generate labels:
```ts
function makeLabel(prop: string, prev: string, next: string): string {
  const shortPrev = prev.length > 20 ? prev.slice(0, 17) + '...' : prev;
  const shortNext = next.length > 20 ? next.slice(0, 17) + '...' : next;
  return `${prop}: ${shortPrev} → ${shortNext}`;
}
```

This enables the visual history timeline (from the prior UX plan's Phase 5).

Acceptance criteria:
- [ ] Each undo entry has a timestamp and label
- [ ] Labels are human-readable (property: old → new)
- [ ] Long values are truncated
- [ ] Batch entries use the batch label
- [ ] Existing undo/redo behavior unchanged

---

#### Phase N: CSS Variable Integration Indicators

##### Task N.1: Variable-Linked Property Indicator
**Files: `src/overlay/ValueInput.tsx`, `src/overlay/ColorRow.tsx`, `src/overlay/StyleIndicator.tsx`**

When a CSS property's computed value comes from a CSS variable (e.g., `color: var(--primary)`), show a small purple dot indicator:

Detection:
```ts
function isVariableLinked(element: Element, prop: string): string | null {
  // Check if the inline style or stylesheet rule uses var()
  const inlineValue = element.style.getPropertyValue(prop);
  if (inlineValue.includes('var(')) {
    const match = inlineValue.match(/var\(([^)]+)\)/);
    return match ? match[1].trim() : null;
  }
  // Check computed stylesheets for var() references
  // (more complex — walk document.styleSheets matching rules)
  return null;
}
```

Visual: small purple (`#a78bfa`, violet-400) dot in the upper-right corner of the value input area.

Acceptance criteria:
- [ ] Purple dot appears when a property uses `var()`
- [ ] Dot tooltip shows the variable name (e.g., `--primary-color`)
- [ ] Dot does not appear for non-variable values
- [ ] Detection works for both inline styles and stylesheet rules

##### Task N.2: Variable Picker from Purple Dot
**Files: `src/overlay/VariablePicker.tsx` (new small component), `src/overlay/ValueInput.tsx`**

Clicking the purple dot opens a small dropdown listing available CSS variables:

- Scan `document.styleSheets` for `:root` / `html` custom properties
- Also include variables from the CSSVariablesSection's existing scan logic
- Group by source: `:root` variables, element-scoped variables
- Search/filter input at top
- Click a variable to apply `var(--name)` as the property value
- Show resolved value (color swatch or number) next to each variable name
- Fit within 260px width (panel width minus padding)

Acceptance criteria:
- [ ] Click purple dot opens variable picker dropdown
- [ ] Dropdown shows all available CSS variables
- [ ] Search/filter narrows the list
- [ ] Clicking a variable applies `var(--name)` to the property
- [ ] Resolved values shown next to variable names
- [ ] Color variables show a color swatch
- [ ] Dropdown closes on selection or click-outside

---

## Alternative Approaches Considered

### Breakpoint / Responsive Bar
Deferred (same as prior plan). The interaction patterns here are breakpoint-agnostic and work at any viewport. Breakpoints require a fundamentally different data model for style scoping.

### Full Style Manager Panel
Deferred. A separate panel showing all classes in the project with search, cleanup, and rename. While valuable, it's a separate UI surface rather than an interaction pattern enhancement to the existing panel.

### Animations Timeline
Deferred. GSAP-style timeline editing with scrubbing, tracks, and action blocks is a major feature that needs its own spec. The transition preview button (Task L.3) is a minimal version.

## Acceptance Criteria

### Functional Requirements
- [ ] All 16 tasks implemented and functional
- [ ] No regressions to existing 44 spec items or 176+ tests
- [ ] All new keyboard shortcuts documented
- [ ] Math expressions work across all 3 numeric input types

### Non-Functional Requirements
- [ ] Math evaluation completes in < 1ms
- [ ] Style label color changes are reactive (< 16ms update)
- [ ] Focus Mode section transitions are smooth (use existing 0fr/1fr pattern)
- [ ] Layer drag reordering maintains 60fps
- [ ] Undo batch grouping doesn't leak memory (auto-timeout)

### Quality Gates
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (176+ existing tests)
- [ ] New tests for: math expression evaluation, keyword map, batch undo grouping, variable detection
- [ ] Manual QA: test each feature with different element types (div, span, img, flex container, grid container)

## Dependencies & Prerequisites

- Existing `apply.ts` undo stack → extended with batching and labels (Phase M)
- Existing `StyleIndicator.tsx` → extended with colors and click behavior (Phase J)
- Existing `SliderRow`, `ValueInput`, `SizeInputCell`, `TypoValueCell` → extended with math + keyword (Phase I)
- Existing `ShadowEditor`, `FilterSliders`, `BackgroundLayerList`, `TransitionEditor` → extended with eye/drag/play (Phase L)
- Existing `CSSVariablesSection.tsx` → variable scan logic reused for indicators (Phase N)
- Prior UX plan's Command Palette (optional dependency for Task K.4)

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Math expressions conflict with negative values (typing `-5`) | Medium | Only evaluate if operator is preceded by a digit or space; standalone negative numbers treated as values |
| Batch undo timeout fires during long slider drags | Low | 5s timeout is generous; most drags complete in < 2s. If timeout fires, it just ends the batch early (no data loss) |
| Sticky headers jank on low-end devices | Low | CSS `position: sticky` is GPU-accelerated; no JS overhead |
| Variable detection misses variables from external stylesheets | Medium | External CORS-blocked stylesheets are inaccessible; detect from inline + same-origin stylesheets only, document limitation |
| Layer drag reorder conflicts with existing click handlers | Medium | 3px dead zone ensures click events fire normally; drag only activates on sufficient movement |
| Focus Mode + sticky headers interaction | Low | When Focus Mode collapses a section, its sticky header is removed naturally since the section content is gone |

## References

### Internal References
- StyleIndicator: `src/overlay/StyleIndicator.tsx`
- Undo system: `src/overlay/apply.ts`
- Numeric inputs: `src/overlay/ValueInput.tsx`, `src/overlay/SizeInputCell.tsx`, `src/overlay/TypoValueCell.tsx`
- Effect editors: `src/overlay/ShadowEditor.tsx`, `src/overlay/FilterSliders.tsx`, `src/overlay/BackgroundLayerList.tsx`
- CSS Variables: `src/overlay/CSSVariablesSection.tsx`
- Prior UX plan: `docs/plans/2026-03-11-feat-webflow-ux-features-plan.md`
- Iteration log: `ITERATION_LOG.md` (39 iterations, Phases A-H complete)

### External References
- [Webflow Style Labels](https://help.webflow.com/hc/en-us/articles/33961332425875-Style-labels-in-the-Designer)
- [Webflow Input Math](https://help.webflow.com/hc/en-us/articles/33961327404947-Basic-math-in-the-Style-panel)
- [Webflow Input Values and Units](https://help.webflow.com/hc/en-us/articles/33961290465043-Input-values-and-units)
- [Webflow Focus Mode](https://webflow.com/updates/focus-mode-in-style-panel)
- [Webflow Alt+Click Reset](https://webflow.com/updates/reset-styles-with-an-alt-optionclick)
- [Webflow Keyboard Shortcuts](https://help.webflow.com/hc/en-us/articles/33961359609875-Keyboard-shortcuts-in-Webflow)
- [Webflow Variables](https://help.webflow.com/hc/en-us/articles/33961268146323-Variables)
