---
date: 2026-03-15
topic: v1-refinement-prd
---

# Redial v1.0 Refinement PRD

> Each `- [ ]` item is a self-contained prompt for a fresh Claude Code session.
> Priority: **P0** = blocking v1.0 | **P1** = should fix | **P2** = nice to have
> Tasks are ordered by priority (P0 first, then P1, then P2).

---

## P0 — Blocking v1.0

- [x] **P0** In `src/overlay/TransformEditor.tsx`, add drag-to-reorder support using `useDragReorder` (already used by `ShadowEditor.tsx` and `TransitionEditor.tsx`). The spec says "Each transform is a removable row. Order matters (drag to reorder)." Import `useDragReorder` from `./useDragReorder` and `DragHandle` from `./DragHandle`, then wire them into the transform row rendering. Follow the same pattern as `ShadowEditor.tsx` lines 304+.

- [x] **P0** In `src/overlay/ColorPickerEnhanced.tsx`, wire the saved-color swatch system. The infrastructure exists (`src/overlay/useSwatches.ts` — add/remove/persist to localStorage) but is NOT imported or used in the color picker. Add: (1) import `useSwatches` in `ColorPickerEnhanced.tsx`, (2) render saved swatches below the CSS variable swatches, (3) add an "+ Add to swatches" button that calls `addSwatch(currentHex, currentOpacity)` when clicked. Follow the existing variable-swatch rendering pattern already in the component.

- [x] **P0** In `src/overlay/infer.ts`, add a try/catch around the `getComputedStyle()` call at the entry point. If `getComputedStyle` throws (e.g., element is detached, is an SVG foreignObject, or is in a shadow DOM), return a safe fallback `InferResult` with all default values rather than crashing the panel. Write a test that passes a detached element to `infer()` and verifies it returns without throwing.

---

## P1 — Spec Compliance

- [x] **P1** In `src/overlay/WebflowPanel.tsx`, verify the panel body scrollbar matches the spec: thin custom scrollbar styling. If the panel uses the browser default scrollbar inside its `overflow-y: auto` container, add a `::-webkit-scrollbar` style (via inline style or a small injected `<style>` tag) to make the scrollbar 6px wide, semi-transparent thumb on transparent track, matching `theme.ts` tokens.

- [x] **P1** In `src/overlay/Overlay.tsx`, verify max-height is exactly `85vh` as the spec requires. If it differs, update to match. Also verify `backdrop-filter: blur(20px)` is present on the panel container.

- [x] **P1** In `src/overlay/Header.tsx`, the spec defines a **green** indicator for state-specific styles (hover, focus, etc.). Verify the style indicator system in `src/overlay/panelUtils.ts` includes a `"state"` indicator type with a green color from `theme.ts`. If missing, add `color.indicatorGreen` to `theme.ts` and wire it so that properties modified while a pseudo-class state is active show a green dot instead of blue.

- [x] **P1** In `src/overlay/layoutControls.tsx`, the `DISPLAY_PRIMARY` array has `[block, flex, grid, none]`. The spec also lists `inline` as a primary display mode in the overflow dropdown (`DISPLAY_OVERFLOW`). Verify that ALL 8 display values from the spec are accessible: `block`, `flex`, `inline-flex`, `grid`, `inline-grid`, `inline-block`, `inline`, `none`. Check that `inline` and `inline-flex` and `inline-grid` are in the overflow dropdown if not in the primary tabs.

- [x] **P1** In `src/overlay/LayoutSection.tsx`, verify the spec's gap unlock behavior: when gap is "linked" (single slider), it sets both `row-gap` and `column-gap` simultaneously. When "unlocked", it shows two separate sliders for `row-gap` and `column-gap`. Confirm this toggle exists and works correctly. If the unlock toggle is missing, add a small link/unlink icon button similar to the border radius linked toggle in `BordersSection.tsx`.

- [ ] **P1** In `src/overlay/SpacingBoxModel.tsx`, verify the spec's complementary-side shortcut: **Alt+click** on a side label should apply the value to both complementary sides (e.g., Alt+click on margin-left copies its value to margin-right). **Alt+click on a corner** should apply to all 4 sides. Test this behavior end-to-end. If the Alt+click handler is missing for corners (applying to all 4), add it.

- [ ] **P1** In `src/overlay/PositionSection.tsx`, the spec says float and clear controls should only appear when position is `sticky` or `fixed`. Verify this conditional visibility. If float/clear are always shown (regardless of position type), add the conditional so they only render when position is `sticky` or `fixed`.

- [x] **P1** In `src/overlay/TypographySection.tsx`, verify the `font-style` toggle for italic. The spec says it should be an icon button (I). Confirm it exists as a toggle (not a dropdown) and correctly applies `font-style: italic` / `font-style: normal`. If implemented as a dropdown, convert it to an `IconButtonGroup` toggle button.

- [x] **P1** In `src/overlay/GradientEditor.tsx`, verify clicking empty space on the gradient bar adds a new color stop at that position. The comment on line 5 says "click empty space to add" — confirm this is implemented with a click handler on the gradient bar that calculates the position percentage from click coordinates and inserts a new stop.

- [ ] **P1** In `src/overlay/panelUtils.ts`, verify the style indicator system implements ALL 5 states from the spec: (1) **blue** = direct style on current class, (2) **orange** = inherited from parent/base class, (3) **green** = state-specific style (when viewing a pseudo-class state), (4) **pink** = element-level style (not saved to a class), (5) **no dot** = browser default. If the green (state) indicator is missing, add it. Read `theme.ts` for indicator color tokens.

- [ ] **P1** In `src/overlay/Overlay.tsx`, verify that selecting an element inside an `<iframe>` or `<shadow-root>` doesn't crash the panel. If `infer.ts` receives a cross-origin iframe element, it should gracefully degrade (show the element tag but no editable properties). Add a guard at the selection stage if not already present.

- [ ] **P1** In `src/overlay/apply.ts`, add a maximum undo history limit (e.g., 200 entries). Currently there is no `MAX_HISTORY` constant, meaning very long editing sessions could accumulate unbounded undo entries in memory. Add `const MAX_UNDO = 200` and trim the oldest entries when the stack exceeds this limit. Write a test that performs 250 changes and verifies the undo stack is capped at 200.

---

## P1 — Acceptance Criteria Tests

- [ ] **P1** Write a test in `src/overlay/__tests__/panelShell.test.ts` that verifies: (1) panel width is `layout.panelWidth` (300px), (2) border radius is 10px, (3) section separators use `border.subtle` token, (4) section headers use 13px font-size / weight 500. Read the rendered styles from `WebflowPanel.tsx` and `theme.ts` to validate these constants match the spec.

- [!] **P1** Write a test in `src/overlay/__tests__/breadcrumb.test.ts` that verifies: (1) breadcrumb collapses to `first ... last-2 > last-1 > current` when ≥4 ancestors, (2) clicking `...` expands full chain, (3) clicking an ancestor segment fires `onBreadcrumbClick` with the correct element, (4) hovering fires `onBreadcrumbHover`.

- [!] **P1** Write a test in `src/overlay/__tests__/stateSelector.test.ts` that verifies: (1) StateSelector renders with value="none" by default, (2) all pseudo-class options are present: none, hover, focus, active, visited, focus-within, focus-visible, (3) changing selection fires `onStateChange` with the new value, (4) selector refuses to change mid-drag (when `isScrubActive()` returns true).

- [!] **P1** Write a test in `src/overlay/__tests__/layoutSection.test.ts` that verifies: (1) when parent is a flex container, flex child controls (grow, shrink, basis, order, align-self) are shown, (2) when parent is NOT flex, flex child controls are hidden, (3) when display is "grid", grid track editors (template-columns, template-rows) appear, (4) the 3×3 AlignBox sets both `justify-content` and `align-items` simultaneously on click.

- [!] **P1** Write a test in `src/overlay/__tests__/spacingBoxModel.test.ts` that verifies: (1) click on a value enters edit mode, (2) arrow up/down increments/decrements by 1, (3) shift+arrow increments by 10, (4) tab moves between values in order (top → right → bottom → left), (5) padding values cannot go negative while margin values can.

- [!] **P1** Write a test in `src/overlay/__tests__/sizeSection.test.ts` that verifies: (1) width/height support `auto` as a keyword value (not just numeric), (2) min/max-width/height support `none` as a keyword, (3) object-fit and object-position only appear for media elements (`img`, `video`, `canvas`), (4) aspect-ratio accepts freeform text input like "16 / 9", (5) overflow per-axis controls (`overflow-x`, `overflow-y`) appear when overflow is "unlocked".

- [!] **P1** Write a test in `src/overlay/__tests__/positionSection.test.ts` that verifies: (1) offset controls (top/right/bottom/left) are hidden when position is `static`, (2) they appear for `relative`, `absolute`, `fixed`, `sticky`, (3) z-index accepts `auto` as a keyword and numeric values from -1 to 9999, (4) changing position from `static` to `absolute` reveals the offset diagram with smooth animation.

- [!] **P1** Write a test in `src/overlay/__tests__/typographySection.test.ts` that verifies: (1) font-family dropdown is searchable, (2) font-weight dropdown shows labels (Thin, Light, Regular, ..., Black) alongside numeric values, (3) text-align icon buttons are mutually exclusive (radio behavior), (4) text-decoration toggles can combine multiple values (underline + line-through), (5) text-transform buttons are mutually exclusive, (6) advanced sub-section is collapsed by default and expands on click.

- [!] **P1** Write a test that verifies the Typography section's advanced sub-section includes ALL spec properties: word-spacing, white-space (with `break-spaces` option), text-indent, word-break, hyphens, direction, column-count, column-gap, and text-shadow editor. Read `src/overlay/TypographySection.tsx` to confirm each property has a control.

- [!] **P1** Write a test in `src/overlay/__tests__/backgroundsSection.test.ts` that verifies: (1) clicking "+ Add background" creates a new layer, (2) layer types include color, gradient (linear/radial/conic), and image, (3) gradient editor supports all three gradient types with angle slider for linear, (4) background-clip includes the `text` option, (5) blend mode dropdown has all 16 blend modes from the spec.

- [!] **P1** Write a test in `src/overlay/__tests__/bordersSection.test.ts` that verifies: (1) side selector tabs (All/Top/Right/Bottom/Left) switch which border properties are editable, (2) when "All" is selected, changes apply to all 4 sides, (3) radius linked/unlinked toggle works — linked mode shows 1 slider for all corners, unlinked shows 4 individual inputs, (4) border-radius supports both `px` and `%` units.

- [!] **P1** Write a test in `src/overlay/__tests__/effectsSection.test.ts` that verifies: (1) opacity slider displays as 0%–100% (not 0–1), (2) box shadow editor supports inset toggle, (3) multiple shadows can be added and each has X/Y/blur/spread/color controls, (4) transform editor includes translate (X,Y,Z), scale (X,Y), rotate (angle), skew (X,Y), (5) filter sliders cover all 8 filter types: blur, brightness, contrast, grayscale, hue-rotate, invert, saturate, sepia.

- [!] **P1** Write a test that verifies the bezier curve editor: (1) dragging control points updates the cubic-bezier values, (2) preset buttons (ease, ease-in, ease-out, ease-in-out, linear) set correct control point coordinates, (3) the preview animation restarts when the curve changes.

- [!] **P1** Write a test in `src/overlay/__tests__/styleIndicators.test.ts` that verifies: (1) a property with no override shows no indicator dot, (2) a property overridden at element scope shows a pink dot, (3) a property overridden at class scope shows a blue dot, (4) a property inherited from a parent class shows an orange dot. Mock the necessary scope and style detection functions.

- [!] **P1** Write a test in `src/overlay/__tests__/unitSelector.test.ts` that verifies: (1) changing unit triggers value conversion (e.g., 16px → 1em when root font-size is 16px), (2) each property context offers only valid units (e.g., opacity has no unit selector, border-width is px-only), (3) the `—` option represents auto/none/unitless depending on context.

- [!] **P1** Write a test in `src/overlay/__tests__/labelScrub.test.ts` that verifies: (1) mousedown on a property label starts scrub mode, (2) mousemove changes the value proportional to horizontal movement, (3) holding Shift during scrub applies 10x multiplier, (4) holding Alt during scrub applies 0.1x multiplier, (5) mouseup commits the final value, (6) cursor changes to `ew-resize` on hover over scrubbable labels.

- [!] **P1** Write a comprehensive keyboard shortcut test in `src/overlay/__tests__/keyboardShortcuts.test.ts` that verifies ALL 12 shortcuts from the spec: (1) `` ` `` toggles selection mode, (2) `Esc` closes panel, (3) `Cmd+Z` triggers undo, (4) `Cmd+Shift+Z` triggers redo, (5) arrow keys navigate elements (up=parent, down=first child, left=prev sibling, right=next sibling), (6) `D` hold strips overrides temporarily, (7) `S` cycles scope, (8) `R` resets current element, (9) `Cmd+S` saves, (10) `Cmd+C` copies CSS, (11) `,` opens command palette, (12) `Tab`/`Shift+Tab` navigate controls.

- [!] **P1** Write a test that verifies keyboard shortcuts are disabled when a text input is focused (to prevent e.g., typing "S" in a font-family search from cycling scope instead of typing the letter). Check that `Overlay.tsx` keyboard handler skips shortcuts when `activeElement` is an `input`, `textarea`, or `[contenteditable]`.

---

## P1 — Accessibility

- [!] **P1** Audit all dropdown components (`UnitSelector.tsx`, `SelectRow` in controls, `StateSelector.tsx`) for keyboard accessibility: (1) `Enter`/`Space` opens the dropdown, (2) arrow keys navigate options, (3) `Escape` closes without selecting, (4) `Tab` moves focus out. Run the existing `useDropdownKeyboard.test.ts` and verify it covers these cases. Add missing test cases.

- [!] **P1** In `src/overlay/ShadowEditor.tsx` and `src/overlay/TransformEditor.tsx`, verify that the "+ Add" buttons and delete (×) buttons are keyboard-accessible (`tabIndex`, `role="button"`, `aria-label`). Also verify the drag handles have `aria-label="Drag to reorder"` and are focusable for screen reader users even though they're mouse-only in practice.

---

## P1 — Test Coverage Gaps

- [!] **P1** In `src/overlay/__tests__/`, there is no test for the `GradientEditor` component. Write `gradientEditor.test.ts` covering: (1) adding a color stop by clicking the gradient bar, (2) dragging a stop changes its position, (3) deleting a stop (minimum 2 stops enforced), (4) changing gradient type between linear/radial/conic, (5) angle slider only appears for linear type.

- [!] **P1** In `src/overlay/__tests__/`, there is no test for `BackgroundLayerList`. Write `backgroundLayerList.test.ts` covering: (1) adding a new layer, (2) selecting layer type (color vs gradient vs image), (3) deleting a layer, (4) layer order in the rendered CSS output.

---

## P2 — Polish

- [!] **P2** In the panel container (either `Overlay.tsx` or `WebflowPanel.tsx`), add `overscroll-behavior: contain` to the scrollable area to prevent scroll chaining when the panel scroll reaches the top/bottom edge. This prevents the host page from scrolling when the user is scrolling the panel.

- [!] **P2** In `src/overlay/Header.tsx`, the source file path (e.g., `components/Hero.tsx:42`) is display-only. Make it clickable — when clicked, call `fetch('/__tuner/open-editor', { method: 'POST', body: JSON.stringify({ file, line }) })` to open the file in the user's editor. If the endpoint doesn't exist, just `console.log` the path. Add `cursor: pointer` and a subtle hover underline.

- [!] **P2** Write a test in `src/overlay/__tests__/layoutAlignBox.test.ts` that verifies the AlignBox maps correctly for grid context: X axis → `justify-items` (not `justify-content`), Y axis → `align-items`. Check that the component receives a `mode` prop or detects display type to switch between flex and grid alignment property names.

- [!] **P2** In `src/overlay/LayoutSection.tsx`, add a "Center" quick-action button that sets `justify-content: center` AND `align-items: center` in a single click. Also add a "Fill Parent" button that sets `width: 100%` and `height: 100%`. If these buttons already exist, verify they use `beginBatch()` / `endBatch()` from `apply.ts` to group the two changes into a single undo step.

- [!] **P2** In `src/overlay/SpacingBoxModel.tsx`, verify that the color zones match the spec: margin area uses a warm transparent tone, padding area uses a cool transparent tone, and content center uses a solid darker rectangle. Read `theme.ts` for the actual token values (`spacingMargin`, `spacingPadding`, `spacingContent` or equivalent). If the colors feel too similar, increase the contrast difference between zones.

- [!] **P2** Write a test that verifies unit conversion: when switching width from `px` to `%`, the value converts correctly based on the parent element's width. Check `src/overlay/unitConversion.ts` and `src/overlay/SizeSection.tsx` to verify the conversion uses the parent element's computed dimensions, not hardcoded assumptions.

- [!] **P2** In `src/overlay/SizeSection.tsx`, verify that the Tailwind-aware step detection (4px steps for Tailwind in px mode) works correctly. Read the step logic and confirm it detects Tailwind projects (via the scope system or a config flag) and adjusts the slider step size accordingly.

- [!] **P2** In the position offset diagram (`src/overlay/PositionOffsetDiagram.tsx` or equivalent), verify that all four offset inputs support unit selectors (`px`, `%`, `vh`, `vw`). The spec lists these units for position offsets. If any input is px-only, add `UnitSelector` to it.

- [!] **P2** In the font family dropdown (in `src/overlay/TypographySection.tsx`), verify that `fontPreview` prop is working — each font option in the dropdown should render its own name in that font face. If the preview loads slowly for many fonts, consider lazy-loading font previews as the dropdown scrolls.

- [!] **P2** Write a test that verifies multi-layer background stacking: adding 3 background layers and verifying they render in correct CSS stacking order (last added = bottommost in CSS). Verify deleting a middle layer recomposes the background correctly.

- [!] **P2** In `src/overlay/BordersSection.tsx`, verify the per-side border controls show correct style/width/color when different sides have different values. E.g., if `border-top: 2px solid red` and `border-bottom: 1px dashed blue`, switching between Top and Bottom tabs should show the correct values for each side.

- [!] **P2** In `src/overlay/EffectsSection.tsx`, the cursor section has a `CURSOR_OPTIONS` list. Verify it includes ALL 14 cursor types from the spec: `auto`, `default`, `pointer`, `text`, `move`, `grab`, `grabbing`, `not-allowed`, `crosshair`, `help`, `wait`, `zoom-in`, `zoom-out`, `none`. Read `panelConstants.tsx` to check. Add any missing values.

- [!] **P2** In `src/overlay/ColorPickerEnhanced.tsx`, verify the color mode toggle works correctly between HSB, RGB, and Hex input modes. Check that switching modes preserves the current color value accurately (no rounding drift across mode switches). If there's visible drift (e.g., HSB → RGB → HSB changes the color), fix the conversion precision.

- [!] **P2** In `src/overlay/Overlay.tsx`, verify that the `D` key "diff peek" interaction is smooth: (1) pressing D immediately strips all overrides, (2) the visual change is instant (no animation delay), (3) releasing D restores overrides, (4) if D is tapped quickly (<200ms), it doesn't flash. Add a small debounce if the flash issue exists.

- [ ] **P2** In `src/overlay/apply.ts`, verify that `restoreSession()` handles corrupted localStorage gracefully. Add a try/catch around JSON.parse of the stored session data so that corrupted data doesn't crash the panel on startup. If parsing fails, silently discard the stored session and start fresh.

---

## P2 — Performance

- [ ] **P2** In `src/overlay/WebflowPanel.tsx`, verify that section collapse/expand doesn't trigger expensive re-renders of other sections. Since all 8+ sections are siblings, collapsing one section should NOT cause the others to re-render. If sections share state that triggers full re-renders, consider wrapping each section in `React.memo` or moving section state to individual components.

- [ ] **P2** Audit `src/overlay/infer.ts` for performance: `getComputedStyle()` is called once on selection, but verify it isn't called again on every render or slider drag. The infer result should be cached per selection and only refreshed on re-selection or explicit refresh. If `infer()` is called inside any render path, move it to an effect or callback.

---

## P2 — Accessibility

- [ ] **P2** Audit the `AlignBox` component (`src/overlay/AlignBox.tsx`) for accessibility: each cell should have `role="radio"`, `aria-checked`, and `aria-label` describing its alignment (e.g., "Align top-left"). The 3×3 grid should be wrapped in `role="radiogroup"` with an accessible name.

---

## P2 — Test Coverage Gaps

- [ ] **P2** In `src/overlay/__tests__/`, there is no test for `CommandPalette`. Write `commandPalette.test.ts` covering: (1) `,` key opens the palette, (2) typing filters commands, (3) enter executes selected command, (4) escape closes palette, (5) palette includes commands for all keyboard shortcuts.

---

## P2 — Directory Restructure

- [ ] **P2** Restructure `src/overlay/` from a flat 103-file directory into domain subdirectories. Target structure: `sections/` (9 section files), `editors/` (19 sub-editor components), `controls/` (11 shared controls), `shell/` (Overlay, Header, Footer, Toolbar, Selector + auxiliary panels), `overlays/` (6 canvas overlays), `hooks/` (9 use*.ts files), `engine/` (apply, infer, scope, statePreview, hmr + parsers/utils), `tokens/` (theme, timing, panelConstants, panelStyles, panelUtils). Update all import paths. Run `npm run typecheck` and `npm test` after to verify nothing breaks. Reference `src/overlay/DIRECTORY.md` for the exact file-to-directory mapping.

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **P0**   | 3     | Transform reorder, color swatches wiring, infer.ts error boundary |
| **P1**   | 22    | Spec compliance checks, acceptance criteria tests, accessibility audit |
| **P2**   | 15    | Polish, nice-to-haves, performance audit, extra test coverage, directory restructure |
| **Total**| **40**| |
