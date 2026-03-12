---
title: "feat: Add Webflow UX interaction features"
type: feat
date: 2026-03-12
---

# Add Webflow UX Interaction Features

## Overview

Redial's CSS property controls are comprehensive (44 spec items, Phases A–H complete, 39 iterations). This plan adds **10 UX interaction features** that define the Webflow Designer experience beyond property editing — the features that make it feel like a design tool rather than a DevTools panel.

## Problem Statement

Users can edit every CSS property, but the workflow around editing is bare. There's no way to:
- Search for a specific property across 100+ controls (must scroll manually)
- See element details during hover in selection mode (only an outline appears)
- Preview responsive behavior at different breakpoints
- Import CSS from an external source (Figma, another tool)
- Pick a color from the page with an eyedropper
- See what the computed value of a property actually is
- Right-click for contextual actions
- Discover available keyboard shortcuts

## Proposed Solution

10 features across 2 tiers, implemented in 5 phases. Each feature is a self-contained task suitable for parallel agent execution.

## Technical Approach

### Architecture

All features plug into existing extension points:
- **Keyboard shortcuts** → `Overlay.tsx` `handleKeyDown` (capture phase)
- **Canvas overlays** → Follow `Selector.tsx` pattern (getBoundingClientRect + fixed positioning)
- **New UI panels** → Inline-styled React, rendered inside the `.__tuner-root` portal
- **Panel modifications** → Extend existing `controls.tsx` components with optional props
- **State** → Managed in `Overlay.tsx` (new features) or component-local (enhancements)

### Shortcut Reference (existing + new)

| Shortcut | Action | Status |
|----------|--------|--------|
| `` ` `` | Toggle selection mode | Existing |
| `Esc` | Close panel / exit mode | Existing |
| `S` | Cycle scope | Existing |
| `R` | Reset element | Existing |
| `D` (hold) | Diff peek | Existing |
| `Cmd+Z` | Undo | Existing |
| `Cmd+Shift+Z` | Redo | Existing |
| `Cmd+S` | Save to source | Existing |
| `Cmd+C` | Copy CSS | Existing |
| `Cmd+Alt+C` | Copy styles | Existing |
| `Cmd+Alt+V` | Paste styles | Existing |
| Arrow keys | Element navigation | Existing |
| `Cmd+K` | Command Palette | **New** |
| `Shift+/` | Keyboard shortcuts help | **New** |

---

### Implementation Phases

#### Phase 1: Element Selection UX (Canvas Feedback)

##### Task 1.1: Element Hover Labels
**Files: `src/overlay/Selector.tsx` (modify)**

During selection mode, show a floating label next to the hover outline displaying the element's identity and dimensions. This is Webflow's signature blue label.

Current state: `Selector.tsx` shows only an indigo outline on hover via `outlineRef`. Add a second `labelRef` div that renders tag, class, and dimensions.

Implementation:
- Add `labelRef = useRef<HTMLDivElement>(null)` alongside existing `outlineRef`
- In the `updatePosition` callback (already called on mousemove/scroll/resize):
  ```tsx
  // Position label above the outline, offset 4px
  const tag = hovered.tagName.toLowerCase();
  const cls = hovered.classList[0] || '';
  const dims = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
  label.textContent = cls ? `${tag}.${cls}  ${dims}` : `${tag}  ${dims}`;
  label.style.top = `${rect.top - 22}px`;
  label.style.left = `${rect.left}px`;
  ```
- Style: indigo background (`#6366f1`), white text, 10px font, 2px border-radius, `pointer-events: none`
- Flip label below element when near top of viewport (`rect.top < 28`)
- Render the label div alongside the outline div in JSX

Acceptance criteria:
- [ ] Hovering an element in selection mode shows tag + class + dimensions label
- [ ] Label positioned above element (or below when near viewport top)
- [ ] Label disappears when selection mode is deactivated
- [ ] Label does not interfere with click-to-select (`pointer-events: none`)
- [ ] Label updates on scroll and resize
- [ ] Long class names truncated with `text-overflow: ellipsis` (max 200px)

---

#### Phase 2: Panel Productivity (Search & Viewport)

##### Task 2.1: Property Search / Filter
**Files: `src/overlay/WebflowPanel.tsx` (modify), `src/overlay/controls.tsx` (modify Section)**

Add a search input at the top of the panel that filters visible sections.

Implementation:
- Add `searchQuery` state to `WebflowPanel`
- Render search input before the first section:
  ```tsx
  <input
    placeholder="Search properties..."
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    style={{ /* dark theme input, full width, 11px font */ }}
  />
  ```
- Create `SECTION_ALIASES` map mapping search terms to section names:
  ```ts
  const SECTION_ALIASES: Record<string, string[]> = {
    Layout: ["display", "flex", "grid", "gap", "direction", "wrap", "align", "justify", "order"],
    Spacing: ["margin", "padding", "spacing"],
    Size: ["width", "height", "min", "max", "overflow", "aspect", "object"],
    Position: ["position", "top", "right", "bottom", "left", "z-index", "float", "clear", "sticky", "fixed", "absolute", "relative"],
    Typography: ["font", "text", "color", "line-height", "letter", "word", "white-space", "column", "hyphens", "direction"],
    Backgrounds: ["background", "bg", "gradient", "image", "clip", "blend"],
    Borders: ["border", "radius", "corner", "outline"],
    Effects: ["opacity", "shadow", "transform", "transition", "filter", "blur", "cursor", "pointer", "visibility", "mix", "backdrop", "perspective", "backface"],
    "CSS Variables": ["var", "variable", "custom", "--"],
  };
  ```
- When `searchQuery` is non-empty: for each section, check if `searchQuery` fuzzy-matches any alias. Pass `forceOpen` to matching sections, hide non-matching sections.
- Clear search on Escape (when search input is focused)
- Auto-focus search on `Cmd+F` (when inside panel)

Acceptance criteria:
- [ ] Search input appears between header and first section
- [ ] Typing filters sections in real-time (non-matching sections hidden)
- [ ] Matching sections are force-opened
- [ ] Empty query restores all sections to their collapse state
- [ ] Fuzzy matching: "bg" matches Backgrounds, "font" matches Typography
- [ ] Escape clears search, Cmd+F focuses search input
- [ ] Typecheck: PASS

##### Task 2.2: Wire Viewport Responsive Breakpoints
**Files: `src/overlay/Overlay.tsx` (modify), `src/overlay/ViewportBar.tsx` (existing, no changes needed)**

Wire the existing `ViewportBar.tsx` component into the panel. It already has presets (375, 768, 1024, Full) and styled buttons.

Implementation:
- In `Overlay.tsx`, add state: `const [viewportWidth, setViewportWidth] = useState<number | null>(null);`
- Render `<ViewportBar active={viewportWidth} onChange={setViewportWidth} />` between `Header` and the scrollable panel area
- Apply viewport constraint via injected `<style>` tag:
  ```tsx
  {viewportWidth !== null && (
    <style dangerouslySetInnerHTML={{ __html: `
      html { max-width: ${viewportWidth}px !important; margin: 0 auto !important; box-shadow: 0 0 0 9999px rgba(0,0,0,0.15); }
    `}} />
  )}
  ```
- Reset viewport width on panel close (`handleClose` sets it to `null`)
- Show current pixel width indicator in ViewportBar when active

Acceptance criteria:
- [ ] ViewportBar appears between header and panel sections
- [ ] Clicking a preset (375, 768, 1024) constrains page width
- [ ] Clicking "Full" removes constraint
- [ ] Page shows a dark shadow on sides when constrained (viewport visualization)
- [ ] Panel itself is NOT constrained (remains at fixed 300px)
- [ ] Viewport resets when panel is closed
- [ ] Typecheck: PASS

---

#### Phase 3: Color & Input Enhancements

##### Task 3.1: Eyedropper Color Picker
**Files: `src/overlay/ColorPickerEnhanced.tsx` (modify)**

Add an eyedropper button that uses the browser's EyeDropper API to sample colors from the page.

Implementation:
- Check API availability: `const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;`
- Add eyedropper icon button next to the "+" swatch button:
  ```tsx
  {hasEyeDropper && (
    <button onClick={handleEyedropper} title="Pick color from page" style={{ /* icon button */ }}>
      <svg>/* pipette icon inline SVG */</svg>
    </button>
  )}
  ```
- Handler:
  ```ts
  const handleEyedropper = useCallback(async () => {
    try {
      // @ts-expect-error EyeDropper API not in all TS libs
      const dropper = new EyeDropper();
      const result = await dropper.open();
      const hex = result.sRGBHex;
      const rgb = hexToRgb(hex);
      const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
      setHue(hsb.h);
      setSat(hsb.s);
      setBri(hsb.b);
      setHexInput(hex.toUpperCase());
      emitChange(hsb.h, hsb.s, hsb.b, alpha);
    } catch {
      // User cancelled or API error — silent
    }
  }, [alpha, emitChange]);
  ```
- While eyedropper is active, the color picker popover stays open (don't close on blur)
- Add `isEyedroppingRef` to prevent click-outside from closing during pick

Acceptance criteria:
- [ ] Eyedropper button visible in ColorPickerEnhanced (when API available)
- [ ] Clicking it activates browser's native eyedropper cursor
- [ ] Picking a color updates the picker's HSB state + hex input + emits onChange
- [ ] Cancelling (Escape) does nothing (no error)
- [ ] Button hidden in browsers without EyeDropper API (Firefox)
- [ ] Popover does NOT close while eyedropper is active
- [ ] Typecheck: PASS

##### Task 3.2: Slider Snap Points
**Files: `src/overlay/controls.tsx` (modify SliderRow)**

Add optional magnetic snap behavior to sliders for common CSS values.

Implementation:
- Add `snapPoints?: number[]` prop to `SliderRow`
- Add `snapThreshold?: number` prop (default 2, in slider-value units)
- Modify the range input's `onChange` handler:
  ```ts
  const handleChange = (rawValue: number) => {
    if (snapPoints && snapPoints.length > 0) {
      const threshold = snapThreshold ?? 2;
      for (const snap of snapPoints) {
        if (Math.abs(rawValue - snap) <= threshold) {
          onChange(snap);
          return;
        }
      }
    }
    onChange(rawValue);
  };
  ```
- Wire snap points into key sections in WebflowPanel:
  - Gap sliders: snap to `[0, 4, 8, 12, 16, 24, 32, 48, 64]`
  - Border radius: snap to `[0, 2, 4, 8, 12, 16, 24, 50]`
  - Font size: snap to `[8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 64, 72, 96]`
  - Opacity: snap to `[0, 0.25, 0.5, 0.75, 1]`
  - Spacing: snap to `[0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]`
- Snap only applies to slider drag, NOT to arrow key steps or direct input

Acceptance criteria:
- [ ] Slider values "stick" to snap points when dragging within threshold
- [ ] Arrow keys bypass snap (precise control still works)
- [ ] Direct input bypasses snap (type any value)
- [ ] Snap points configurable per-slider via prop
- [ ] Default threshold of 2 value-units works for common use cases
- [ ] Snap is subtle — user can still reach non-snap values by dragging past
- [ ] Typecheck: PASS

---

#### Phase 4: Information & Discoverability

##### Task 4.1: Command Palette (Cmd+K)
**File: `src/overlay/CommandPalette.tsx` (new)**

Universal search overlay for finding elements, CSS properties, actions, and sections.

Implementation:
- Triggered by `Cmd+K` in `Overlay.tsx` keydown handler
- Full-viewport semi-transparent backdrop (`rgba(0,0,0,0.4)`)
- Centered search input (min 400px, max 500px)
- Result categories:
  - **Elements**: Walk DOM via `document.querySelectorAll('*')`, filter by `isNavigableElement`, fuzzy-match on tag + className + id + textContent (first 60 chars)
  - **Properties**: Match against `SECTION_ALIASES` from property search
  - **Actions**: Hardcoded list: Save, Reset, Copy CSS, Copy Tailwind, Paste Styles, Toggle Diff, Toggle X-Ray
- Results rendering:
  ```tsx
  <div key={i} style={{ /* dark row, hover highlight */ }}>
    <span style={{ /* category badge */ }}>{result.category}</span>
    <span>{result.label}</span>
    <span style={{ /* dim path/breadcrumb */ }}>{result.detail}</span>
  </div>
  ```
- Navigation: ArrowUp/Down moves selection, Enter executes, Escape closes
- Debounced search (100ms) with max 30 results
- For "Elements" results: selecting an element calls `handleSelect(el)` on the parent Overlay
- For "Properties" results: jumps to that section (scrolls to it, opens it)
- For "Actions" results: executes the action

Props:
```tsx
interface CommandPaletteProps {
  onSelectElement: (el: Element) => void;
  onAction: (action: string) => void;
  onClose: () => void;
}
```

Acceptance criteria:
- [ ] Cmd+K opens palette from any state
- [ ] Search input auto-focuses
- [ ] Results categorized: Elements, Properties, Actions
- [ ] Fuzzy matching works (e.g., "btn" matches `<button>`, "bg" matches "Backgrounds")
- [ ] ArrowUp/Down navigates results, Enter selects, Escape closes
- [ ] Element selection highlights it on canvas (preview before committing)
- [ ] Large pages (1000+ elements) don't cause jank (debounce + limit)
- [ ] Typecheck: PASS

##### Task 4.2: Computed Value Tooltips
**Files: `src/overlay/controls.tsx` (modify SliderRow, ColorRow, SelectRow), `src/overlay/Tooltip.tsx` (new)**

Hover over a property label/value to see its computed value, authored value, and inheritance source.

Implementation:
- Create `Tooltip.tsx` — a simple absolute-positioned div:
  ```tsx
  export function Tooltip({ text, x, y }: { text: string; x: number; y: number }) {
    return (
      <div style={{
        position: "fixed", left: x, top: y - 28, zIndex: 2147483647,
        background: "#000", color: "#fff", fontSize: "10px",
        padding: "3px 8px", borderRadius: "4px", whiteSpace: "nowrap",
        pointerEvents: "none",
      }}>
        {text}
      </div>
    );
  }
  ```
- Add `computedValue?: string` prop to `SliderRow`, `ColorRow`, `SelectRow`
- On label hover (300ms delay), show tooltip:
  - `"Computed: 16px"` (when specified value matches computed)
  - `"Computed: 16px (authored: 1em)"` (when they differ)
  - `"Inherited from div.parent"` (when indicator is "inherited")
- Use `onMouseEnter`/`onMouseLeave` with a timeout ref for the 300ms delay
- Tooltip auto-dismisses on mouse leave or after 3s

Acceptance criteria:
- [ ] Hovering a property label for 300ms shows a computed value tooltip
- [ ] Tooltip shows computed value, and authored value if different
- [ ] Tooltip shows "Inherited from ..." when the value is inherited
- [ ] Tooltip dismisses on mouse leave
- [ ] No tooltip when computed === displayed value (avoid noise)
- [ ] Works on SliderRow, ColorRow, and SelectRow
- [ ] Typecheck: PASS

##### Task 4.3: Right-Click Context Menu
**File: `src/overlay/ContextMenu.tsx` (new)**

Custom context menu on page elements when the panel is open.

Implementation:
- In `Overlay.tsx`, add `contextmenu` event listener (capture phase):
  ```ts
  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.closest('.__tuner-root')) return; // let panel use native menu
    if (!selectedEl) return; // only when panel is open
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, element: target });
  };
  ```
- Menu items:
  1. Copy Styles (Cmd+Alt+C)
  2. Paste Styles (Cmd+Alt+V)
  3. Copy CSS
  4. Copy Tailwind
  5. ─── (separator)
  6. Select Parent → shows parent tag + class
  7. Reset Styles
  8. ─── (separator)
  9. Open in Editor

- Styling: dark background (`#1e1e1e`), rounded corners, 1px border, items with hover highlight
- Positioning: render at (x, y), flip up/left when near viewport edge
- Dismiss: click outside, Escape, or selecting an action

Acceptance criteria:
- [ ] Right-click on page element shows custom context menu
- [ ] Right-click inside panel shows native browser menu
- [ ] All menu actions functional (copy, paste, reset, select parent, open editor)
- [ ] Menu flips position near viewport edges
- [ ] Escape or click-outside dismisses menu
- [ ] Typecheck: PASS

---

#### Phase 5: Discoverability

##### Task 5.1: Keyboard Shortcuts Help Modal
**File: `src/overlay/ShortcutsHelp.tsx` (new)**

Show all available keyboard shortcuts in an organized modal.

Implementation:
- Triggered by `Shift+/` (i.e., `?` key) in `Overlay.tsx` keydown handler
- Also triggered by a `?` icon button in Footer (optional)
- Full-viewport backdrop, centered modal (400px wide, auto height)
- Shortcuts organized by category:

  ```tsx
  const SHORTCUTS = [
    { category: "Selection", items: [
      { keys: "`", desc: "Toggle selection mode" },
      { keys: "Esc", desc: "Close panel" },
      { keys: "↑ ↓ ← →", desc: "Navigate elements" },
    ]},
    { category: "Editing", items: [
      { keys: "⌘Z", desc: "Undo" },
      { keys: "⌘⇧Z", desc: "Redo" },
      { keys: "R", desc: "Reset element" },
      { keys: "D (hold)", desc: "Diff peek" },
      { keys: "S", desc: "Cycle scope" },
    ]},
    { category: "Clipboard", items: [
      { keys: "⌘C", desc: "Copy CSS" },
      { keys: "⌘S", desc: "Save to source" },
      { keys: "⌘⌥C", desc: "Copy styles" },
      { keys: "⌘⌥V", desc: "Paste styles" },
    ]},
    { category: "Tools", items: [
      { keys: "⌘K", desc: "Command palette" },
      { keys: "?", desc: "Shortcuts help" },
    ]},
  ];
  ```
- Each row: key combo on left (monospace, badge style), description on right
- Dismiss: Escape or click backdrop

Acceptance criteria:
- [ ] `?` (Shift+/) opens shortcuts help modal
- [ ] All shortcuts listed and organized by category
- [ ] Modal dismissible with Escape or backdrop click
- [ ] Dark theme consistent with panel
- [ ] Typecheck: PASS

##### Task 5.2: CSS Import from Clipboard
**Files: `src/overlay/cssImport.ts` (new), `src/overlay/Footer.tsx` (modify), `src/overlay/Overlay.tsx` (modify)**

Parse CSS text from clipboard and apply as inline overrides.

Implementation:
- Create `cssImport.ts` with parser:
  ```ts
  export function parseCSSText(text: string): Array<{ prop: string; value: string }> {
    // Handle both formats:
    // 1. "property: value;" (CSS declaration)
    // 2. "property: value" (without semicolon)
    // 3. Full rule blocks: ".class { prop: val; prop: val; }"
    const results: Array<{ prop: string; value: string }> = [];
    // Strip selectors/braces, split by semicolons, parse prop:value pairs
    const cleaned = text.replace(/[^{]*\{/g, '').replace(/\}/g, '');
    const declarations = cleaned.split(';').map(d => d.trim()).filter(Boolean);
    for (const decl of declarations) {
      const colonIdx = decl.indexOf(':');
      if (colonIdx === -1) continue;
      const prop = decl.slice(0, colonIdx).trim();
      const value = decl.slice(colonIdx + 1).trim();
      if (prop && value && /^[a-z-]+$/i.test(prop)) {
        results.push({ prop, value });
      }
    }
    return results;
  }
  ```
- Add "Import" button in Footer (between Copy and Save):
  ```tsx
  <ActionButton onClick={handleImportCSS} title="Import CSS from clipboard">
    Import
  </ActionButton>
  ```
- Handler reads clipboard, parses, applies each via `applyInlineStyle`:
  ```ts
  const handleImportCSS = async () => {
    const text = await navigator.clipboard.readText();
    const declarations = parseCSSText(text);
    if (declarations.length === 0) return;
    beginBatch();
    for (const { prop, value } of declarations) {
      applyInlineStyle(element, prop, value);
    }
    endBatch();
    showMessage(`Imported ${declarations.length} properties`, 1500);
    onReset(); // triggers re-infer
  };
  ```
- Also wire `Cmd+Shift+V` in Overlay.tsx keydown as a shortcut for CSS import
- Write tests for `parseCSSText` covering: single declarations, multiple declarations, full rules, comments, invalid input

Acceptance criteria:
- [ ] "Import" button in Footer reads clipboard and applies CSS
- [ ] Parses `property: value;` format
- [ ] Parses full CSS rules (strips selector/braces)
- [ ] Shows toast with count of imported properties
- [ ] All imported properties go through `beginBatch()`/`endBatch()` for single undo
- [ ] Invalid clipboard content (not CSS) shows no error (silent no-op)
- [ ] Unit tests for `parseCSSText` covering edge cases
- [ ] Typecheck: PASS

---

## Acceptance Criteria

### Functional Requirements
- [ ] All 10 features implemented and functional
- [ ] No regressions to existing 44 spec items
- [ ] All new keyboard shortcuts documented and working
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (existing 289+ tests + new tests)

### Non-Functional Requirements
- [ ] Command palette search responds within 100ms on 1000+ element pages
- [ ] Slider snap does not cause visible stutter during drag
- [ ] Hover labels update at 60fps during mouse movement

### Quality Gates
- [ ] New tests: `parseCSSText` parser, slider snap logic
- [ ] Manual QA: test each feature with panel open/closed, during selection mode, during diff mode

## Dependencies & Prerequisites

- Existing `Selector.tsx` pattern → used by hover labels
- Existing `ViewportBar.tsx` → wired into Overlay.tsx
- Existing `ColorPickerEnhanced.tsx` → extended with eyedropper
- Existing `controls.tsx` `SliderRow` → extended with snap points
- Existing `controls.tsx` `Section.forceOpen` → used by property search
- Existing `isNavigableElement()` from `util.ts` → used by Command Palette
- Existing `buildBreadcrumb()` from `util.ts` → used by Command Palette results
- Existing `apply.ts` `beginBatch()`/`endBatch()` → used by CSS import
- Existing `Footer.tsx` `ActionButton` → used by CSS import button

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cmd+K conflicts with browser URL bar | Medium | Only intercept when overlay is mounted; event captured before reaching browser |
| EyeDropper API not in Firefox | Low | Feature-detect and hide button; graceful degradation |
| Slider snap makes precise values hard to reach | Medium | Small threshold (2 units); arrow keys + direct input bypass snap |
| CSS import parses malicious clipboard content | Low | Only apply valid CSS property names (regex check); all through existing apply() which is inline-style only |
| Command Palette jank on large pages | Medium | Debounce 100ms, limit 30 results, filter with `isNavigableElement` |

## Task Summary for Swarm Execution

| Task | File(s) | Dependencies | Parallelizable |
|------|---------|-------------|----------------|
| 1.1 Hover Labels | Selector.tsx | None | Yes |
| 2.1 Property Search | WebflowPanel.tsx, controls.tsx | None | Yes |
| 2.2 Viewport Bar | Overlay.tsx | None | Yes |
| 3.1 Eyedropper | ColorPickerEnhanced.tsx | None | Yes |
| 3.2 Slider Snap | controls.tsx, WebflowPanel.tsx | None | Yes (merge with 2.1 carefully) |
| 4.1 Command Palette | CommandPalette.tsx (new), Overlay.tsx | None | Yes |
| 4.2 Computed Tooltips | Tooltip.tsx (new), controls.tsx | None | Yes (merge with 3.2 carefully) |
| 4.3 Context Menu | ContextMenu.tsx (new), Overlay.tsx | None | Yes |
| 5.1 Shortcuts Help | ShortcutsHelp.tsx (new), Overlay.tsx | None | Yes |
| 5.2 CSS Import | cssImport.ts (new), Footer.tsx, Overlay.tsx | None | Yes |

**Merge conflicts expected between:** Tasks modifying `Overlay.tsx` (2.2, 4.1, 4.3, 5.1, 5.2), tasks modifying `controls.tsx` (2.1, 3.2, 4.2). Use worktree isolation for parallel agents, then sequential merge.

## References

### Internal References
- Existing UX plan: `docs/plans/2026-03-11-feat-webflow-ux-features-plan.md`
- Property search plan: `docs/plans/2026-03-11-feat-extract-sections-and-property-search-plan.md`
- Spec: `webflow-style-panel-spec.md` (sections 12–13 for input controls and keyboard patterns)
- Overlay keyboard handler: `src/overlay/Overlay.tsx:170-336`
- Selector pattern: `src/overlay/Selector.tsx`
- ViewportBar: `src/overlay/ViewportBar.tsx`
- ColorPicker: `src/overlay/ColorPickerEnhanced.tsx`
- SliderRow: `src/overlay/controls.tsx:172-260`

### External References
- [EyeDropper API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API)
- [Webflow Quick Find](https://help.webflow.com/hc/en-us/articles/33961382093587-Quick-find)
- [Webflow Keyboard Shortcuts](https://help.webflow.com/hc/en-us/articles/33961359609875-Keyboard-shortcuts-in-Webflow)
