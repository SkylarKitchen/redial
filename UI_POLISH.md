# UI Polish Backlog

Autonomous improvement queue. Each item is a self-contained, visually verifiable UI/UX enhancement. Agent picks the next unchecked `[ ]` item, implements it, verifies visually in Chrome, runs typecheck + tests, commits, and checks it off.

**Important**: All colors/tokens must come from `src/overlay/theme.ts`. Never hardcode hex values in components.

---

## Tier 1 — Quick Wins (< 10 min each)

### Visual Micro-interactions
- [x] **Value change flash**: When a slider/input value changes, briefly flash the value text with a subtle `primaryAlpha(0.15)` background (200ms). Helps users confirm their change registered. Target: `ValueInput`, `SizeInputCell`, `TypoValueCell`.
- [x] **Copy button checkmark**: After a successful copy (CSS/TW/Vars), briefly replace the button text with a ✓ checkmark for 1.5s before reverting. Target: `Footer.tsx` copy dropdown items.
- [ ] **Save button success state**: After save completes, briefly turn Save button green (#22c55e) with checkmark for 1.5s, then animate back to `color.primary`. Target: `Footer.tsx` ActionButton.
- [ ] **Reset shake on no-op**: If user clicks Reset when there are no overrides, apply a brief horizontal shake animation (3 cycles, 2px amplitude, 300ms). Target: `Footer.tsx` Reset button.
- [ ] **Section header hover**: Add subtle background highlight (`surface.hover`) on section header row hover, with timing token transition. Target: `Section` component in `controls.tsx`.

### Input Polish
- [ ] **Slider value tooltip**: Show a floating tooltip above the slider thumb displaying the current value while dragging. Use `onInput` event on the range input. Target: `SliderRow` in `controls.tsx`.
- [ ] **Dropdown scroll-to-selected**: When a SelectRow dropdown opens, auto-scroll the selected item into view (centered). Target: `SelectRow` in `controls.tsx`.
- [ ] **Input placeholder styling**: Numeric inputs that show "auto" or "none" keywords should display them in italic at `text.disabled` opacity to distinguish from real values. Target: `ValueInput`, `SizeInputCell`.
- [ ] **Color swatch border**: Add a subtle 1px inset border (`border.default`) on color swatches so light colors (white, near-white) don't disappear against the `color.background` panel. Target: `ColorRow` swatch in `controls.tsx`.
- [ ] **Label truncation with tooltip**: Long property labels (e.g., "border-top-left-radius") should truncate with ellipsis and show the full name on hover via `title` attr. Target: all label elements in control rows.

### Visual Consistency
- [ ] **Icon opacity consistency**: Audit all lucide-react icons and normalize to `text.label` default / `text.secondary` on hover. Some icons may be using inconsistent opacity values. Target: all icon usage across overlay components.
- [ ] **Separator consistency**: Ensure all section separators use exactly `border.subtle`. Grep for any hardcoded rgba separator colors. Target: global audit.
- [ ] **Monospace consistency**: Verify all numeric value displays use `font.mono` from theme.ts. Some may have fallen back to bare `monospace`. Target: global audit.
- [ ] **Border radius consistency**: All pill-shaped buttons (scope pills, keyword pills, auto pills) should use consistent `border-radius: 4px`. Audit for any using 3px or 6px inconsistently. Target: all pill/chip elements.
- [ ] **Transition timing consistency**: Ensure all hover transitions use timing tokens from `timing.ts` instead of hardcoded ms values. Target: grep for `transition:.*\d+ms` outside timing.ts.

## Tier 2 — Medium Polish (10–20 min each)

### Spacing & Box Model
- [ ] **Spacing side hover highlight**: When hovering over a margin/padding value in SpacingBoxModel, highlight that side of the box diagram with `spacingZone.marginHover` or `spacingZone.paddingHover`. Target: `SpacingBoxModel.tsx`.
- [ ] **Spacing drag-to-scrub on values**: The inline editable values in SpacingBoxModel should support click-drag to scrub (like LabelScrub). Target: `SpacingBoxModel.tsx` / `SpacingValuePopover.tsx`.

### Typography
- [ ] **Font weight preview**: In the font-weight dropdown, show each weight option rendered at its actual weight (100=thin text, 900=heavy text). Target: `SelectRow` font-weight in `WebflowPanel.tsx`.
- [ ] **Line-height visual indicator**: Show a small visual indicator next to line-height value: two horizontal lines with the gap representing the current line-height value. Target: Typography section.

### Effects
- [ ] **Shadow preview thumbnail**: Show a small 24×24 preview square with the current shadow applied next to the shadow editor row. Target: `ShadowEditor.tsx`.
- [ ] **Filter live preview chip**: Show a small "before/after" thumbnail (original vs filtered) for each active filter. Target: `FilterSliders.tsx`.
- [ ] **Transition easing curve mini-preview**: Show a tiny 20×20 bezier curve icon next to the easing dropdown showing the current curve shape. Target: `TransitionEditor.tsx`.

### Panel Chrome
- [ ] **Panel resize handle**: Add a subtle resize handle on the left edge of the panel that allows horizontal resizing between 260px–400px. Persist width to localStorage. Target: `Overlay.tsx` panel container.
- [ ] **Section collapse memory**: Remember which sections are collapsed across element selections. Store in session state (not localStorage). Target: `WebflowPanel.tsx` section state.
- [ ] **Smooth section height transitions**: When sections expand/collapse, animate content height smoothly (currently using CSS Grid 0fr→1fr — verify it's actually animating and not popping). Target: `Section` component.

## Tier 3 — Larger Polish (20–30 min each)

### Interaction Patterns
- [ ] **Multi-select with Shift+click**: Allow selecting multiple elements (Shift+click adds to selection). Panel shows "N elements selected" with only shared properties editable. Changes apply to all selected. Target: `Overlay.tsx` + `Selector.tsx`.
- [ ] **Undo/redo visual timeline**: Add a small visual indicator showing undo stack depth. Clicking it opens the HistoryDrawer. Show as a subtle "3 changes" badge near the undo shortcut area. Target: `Footer.tsx` or `Header.tsx`.
- [ ] **Property search autocomplete**: When typing in the Cmd+F property search, show autocomplete suggestions from the `SECTION_PROPERTIES` mapping. Arrow keys to navigate, Enter to jump to that section. Target: `PropertySearch.tsx`.
- [ ] **Drag-and-drop section reorder**: Allow reordering panel sections by dragging section headers. Persist order to localStorage. Target: `WebflowPanel.tsx` section rendering.

### Visual Feedback
- [ ] **Changed property highlight**: Properties with overrides (dirty) should have a subtle left-border accent (2px `color.primary`) that fades in when the value first changes. Target: all control row containers.
- [ ] **Element outline pulse on select**: When a new element is selected, pulse the selection outline once (scale 1→1.02→1, opacity 1→0.5→1, 400ms). Target: `Overlay.tsx` selection outline.
- [ ] **Panel shadow depth on drag**: While dragging the panel, increase box-shadow depth (use a deeper variant of `shadow.panel`) to create a "lifted" feel. Revert on drop. Target: `Overlay.tsx` drag handlers.

---

## Completed

### 2026-03-13 — Copy button checkmark
Added `copied` state to `Footer.tsx`. After successful clipboard copy, "Clipboard" button briefly shows "✓ Copied" with green tint (`#16a34a`) for 1.5s, then smoothly reverts via `timing.normal` transitions.

### 2026-03-12 — Value change flash
Added `useValueFlash` hook in `controls.tsx`. Wired into `ValueInput`, `SizeInputCell`, `TypoValueCell`. Brief `primaryAlpha(0.12)` background flash on value change (200ms fade).
