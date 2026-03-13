# UI Polish Backlog

Autonomous improvement queue. Each item is a self-contained, verifiable enhancement. Agent picks the next unchecked `[ ]` item in priority order, implements it, runs typecheck + tests, verifies visually if Chrome is available, commits, and checks it off.

**Important**: All colors/tokens must come from `src/overlay/theme.ts`. Never hardcode hex values in components. Use timing tokens from `timing.ts` for all transitions.

---

## Phase 0 — Fix Broken State (do these FIRST)

These items fix existing test failures and TypeScript errors. No polish work should start until Phase 0 is clear.

### TypeScript Errors
- [x] **Fix `annotation` not destructured in SliderRow**: `controls.tsx:377` — the `annotation` prop is in the type definition (line 408) but missing from the destructuring (line 377). Add `annotation,` to the destructured params. This fixes 2 TS errors and 2 section render test failures.

### Failing Tests — Behavioral Bugs
- [x] **Fix class-scope undo/redo** (`scope.test.ts`): Already fixed — all 40 scope tests pass including undo/redo class sync tests. `onClassChange` listener pattern is implemented.
- [x] **Fix state reset leaving apply.ts overrides** (`statePreview.test.ts`): Already fixed — all 28 statePreview tests pass. `resetStateOverrides` is now called from Footer.tsx handleReset.
- [x] **Fix IconButtonGroup active state** (`iconButtonActiveState.test.ts`): Active state uses inline `backgroundColor`/`color` which gets overridden by Tailwind `!important`. Switch to `data-[state=on]:bg-primary` and `data-[state=on]:text-primary-foreground` className approach.
- [x] **Fix spacing zone base colors** (`spacingZoneColors.test.ts`): Changed marginBase/paddingBase to `"transparent"` — zones only show color on hover.
- [x] **Fix UnitSelector overflow clip** (`unitDropdownClip.test.ts`): Already fixed — `overflow: "hidden"` removed from annotation span. All 7 tests pass.

---

## Phase 1 — Token & Consistency Audits (quick, high-impact)

These are grep-and-fix passes that enforce the token system uniformly.

### Hardcoded Values
- [x] **Move `#d4956a` to theme.ts**: Added `color.primaryActive` token, replaced 2 hardcoded values in Overlay.tsx injected CSS.
- [x] **Transition timing audit**: Replaced 7 hardcoded ms values across 5 files with timing tokens (normal, expand, slow, fast).
- [x] **Monospace font audit**: Audited — all 90+ `fontFamily` usages already use `font.mono`. Two `ui-monospace` references in controls.tsx are intentional font-family preview styles. No violations.
- [x] **Border radius consistency**: Added `layout.pillRadius` (4px) token. Updated ScopePill (was 4, now token) and PILL_BUTTON (was 3, now 4 via token).
- [x] **Separator consistency**: Fixed 2 hardcoded rgba separators (ShadowEditor, SideSelector) → `border.subtle`. Remaining rgba values are grid lines, hover states, or non-separator borders — intentional.
- [ ] **Icon opacity audit**: Check all lucide-react icon usages. Labels should use `text.label`, secondary icons `text.secondary`. Normalize any using raw opacity or hardcoded colors.

---

## Phase 2 — Input & Control Polish (medium effort, high UX value)

### Input Improvements
- [ ] **Section header hover highlight**: Add `surface.hover` background on section header row hover in the `Section` component (`controls.tsx`). Use timing token for transition.
- [ ] **Color swatch inset border**: Add `1px inset border` (`border.default`) on color swatches so white/near-white swatches don't disappear against the panel background. Target: `ColorRow` in `controls.tsx`.
- [ ] **Input placeholder styling**: Numeric inputs showing "auto"/"none" keywords should render in italic at `text.disabled` opacity. Target: `ValueInput`, `SizeInputCell`.
- [ ] **Label truncation with tooltip**: Long property labels (e.g., "border-top-left-radius") should truncate with ellipsis and show full name via `title` attribute. Target: all `labelStyle` usages.
- [ ] **Dropdown scroll-to-selected**: When a `SelectRow` dropdown opens, auto-scroll the selected item into view. Target: `SelectRow` in `controls.tsx`.
- [ ] **Slider value tooltip**: Show a floating tooltip above the slider thumb during drag, displaying the current value. Target: `SliderRow` in `controls.tsx`.

### Section-Specific Polish
- [ ] **Spacing side hover highlight**: Hovering a margin/padding value in `SpacingBoxModel` should highlight that side of the diagram using `spacingZone.marginHover` / `spacingZone.paddingHover`. Target: `SpacingBoxModel.tsx`.
- [ ] **Font weight preview**: In the font-weight dropdown, render each option at its actual weight (100=thin, 900=heavy). Target: Typography section `SelectRow`.
- [ ] **Shadow preview thumbnail**: Show a 24×24 preview square with the current shadow applied next to the shadow editor. Target: `ShadowEditor.tsx`.

---

## Phase 3 — Panel Chrome & Interaction (larger effort)

### Panel Behavior
- [ ] **Smooth section collapse animation**: Verify the CSS Grid `0fr→1fr` collapse animation is actually smooth (not popping). If not, add explicit height animation. Target: `Section` component.
- [ ] **Section collapse memory**: Remember which sections are collapsed across element selections within a session (not localStorage). Target: `WebflowPanel.tsx`.
- [ ] **Panel resize handle**: Subtle resize handle on the left edge, draggable between 260–400px. Persist to localStorage. Target: `Overlay.tsx`.
- [ ] **Panel shadow lift on drag**: While dragging the panel, deepen box-shadow (`shadow.panel` → a heavier variant). Revert on drop. Target: `Overlay.tsx` drag handlers.

### Visual Feedback
- [ ] **Changed property left-border accent**: Properties with overrides should show a 2px `color.primary` left border that fades in on first change. Target: all control row containers.
- [ ] **Element outline pulse on select**: Brief scale+opacity pulse on the selection outline when selecting a new element (400ms). Target: `Overlay.tsx` selection outline.
- [ ] **Undo/redo depth indicator**: Small "N changes" badge showing undo stack depth. Clicking opens HistoryDrawer. Target: `Footer.tsx` or `Header.tsx`.

### Advanced Interactions
- [ ] **Property search autocomplete**: Typing in Cmd+F search shows autocomplete from `SECTION_PROPERTIES`. Arrow keys navigate, Enter jumps. Target: `PropertySearch.tsx`.
- [ ] **Transition easing curve mini-preview**: Tiny 20×20 bezier curve icon next to easing dropdown. Target: `TransitionEditor.tsx`.
- [ ] **Filter before/after thumbnail**: Small before/after preview for each active filter. Target: `FilterSliders.tsx`.

---

## Completed

### 2026-03-13 — Separator consistency
Replaced 2 hardcoded rgba separator borders with `border.subtle` token: ShadowEditor.tsx (rgba(0,0,0,0.04)) and SideSelector.tsx (rgba(0,0,0,0.05)). Other rgba values in the codebase are grid lines, hover states, or canvas fills — not separators.

### 2026-03-13 — Border radius consistency
Added `layout.pillRadius: 4` token to theme.ts. Updated `ScopePill` in Header.tsx (was hardcoded `4`) and `PILL_BUTTON` in panelStyles.ts (was `3`) to use the token. Both now consistently use `layout.pillRadius`.

### 2026-03-13 — Monospace font audit
Audited all `fontFamily` usages across overlay files. All 90+ instances already use `font.mono` from theme.ts. Two `ui-monospace` strings in controls.tsx are intentional (font-family preview for selected font). No changes needed.

### 2026-03-13 — Transition timing audit
Replaced 7 hardcoded `ms` values in 5 files: FilterSliders (100ms→normal), TransitionEditor (100ms→normal), ShadowEditor (100ms→normal), UnitSelector (300ms→slow), Overlay.tsx (150ms→expand ×2, 75ms→fast). Added `ms` import to FilterSliders and TransitionEditor.

### 2026-03-13 — Move #d4956a to theme.ts
Added `color.primaryActive: "#d4956a"` token to theme.ts. Replaced 2 hardcoded hex values in Overlay.tsx injected CSS for webkit and moz slider thumb `:active` states.

### 2026-03-13 — Fix spacing zone base colors
Changed `marginBase` and `paddingBase` in theme.ts from `primaryAlpha(0.06)` / `greenAlpha(0.06)` to `"transparent"`. Zones are invisible at rest, colored only on hover.

### 2026-03-13 — Fix UnitSelector overflow clip
Already resolved — `overflow: "hidden"` removed from annotation span in controls.tsx. All 7 unitDropdownClip tests pass.

### 2026-03-13 — Fix IconButtonGroup active state
Moved active state styling from inline `backgroundColor`/`color` (which were silently overridden by Tailwind `!important`) to `data-[state=on]:bg-primary` and `data-[state=on]:text-primary-foreground` className. Non-active hover/muted styles remain inline with `undefined` fallback when active.

### 2026-03-13 — Fix class-scope undo/redo & state reset overrides
Already resolved — all scope and statePreview tests pass. `onClassChange` listener and `resetStateOverrides` are implemented.

### 2026-03-13 — Fix annotation not destructured in SliderRow
Added missing `annotation` to destructured params in `SliderRow` (`controls.tsx:378`). The prop was defined in the type and used in JSX but never extracted from the props object, so the Tailwind class hint annotation was always `undefined`.

### 2026-03-13 — Reset shake on no-op
Added shake animation to Reset button in `Footer.tsx`. When clicked with no overrides (count=0), the button does a 3-cycle horizontal shake (2px amplitude, 300ms via `timing.slow`). Converted to `motion.button` with keyframe animation `x: [0, -2, 2, -2, 2, -2, 2, 0]`. Button remains clickable but visually dimmed at 0.5 opacity.

### 2026-03-13 — Save button success state
Added `saved` state to `Footer.tsx` mirroring the existing `copied` pattern. After a successful save (no failures), the Save button turns green (`#22c55e`) with "✓ Saved" text for 1.5s, then smoothly transitions back to `color.primary` via `timing.normal` transitions on background, box-shadow, and opacity.

### 2026-03-13 — Copy button checkmark
Added `copied` state to `Footer.tsx`. After successful clipboard copy, "Clipboard" button briefly shows "✓ Copied" with green tint (`#16a34a`) for 1.5s, then smoothly reverts via `timing.normal` transitions.

### 2026-03-12 — Value change flash
Added `useValueFlash` hook in `controls.tsx`. Wired into `ValueInput`, `SizeInputCell`, `TypoValueCell`. Brief `primaryAlpha(0.12)` background flash on value change (200ms fade).
