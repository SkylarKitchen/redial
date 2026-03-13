# UI Polish Backlog

Autonomous improvement queue. Each item is a self-contained, verifiable enhancement. Agent picks the next unchecked `[ ]` item in priority order, implements it, runs typecheck + tests, verifies visually if Chrome is available, commits, and checks it off.

**Important**: All colors/tokens must come from `src/overlay/theme.ts`. Never hardcode hex values in components. Use timing tokens from `timing.ts` for all transitions.

---

## Phase 1 — Token & Consistency Audits (quick, high-impact)

Grep-and-fix passes that enforce the token system uniformly.

- [x] **GridOverlay hardcoded colors** — Extracted 5 hardcoded rgba values to `overlay.grid.*` token family + `gridAlpha()` helper in theme.ts.
- [x] **FlexGapOverlay hardcoded colors** — Extracted 3 hardcoded magenta values to `overlay.flexGap.*` tokens + `flexGapAlpha()` helper in theme.ts.
- [x] **Toolbar dark theme colors** — Added `surface.darkToolbar` (#1e1e1e) token, replaced hardcoded hex in Toolbar.tsx.
- [x] **CommandPalette badge colors** — Added `badge.action/actionBg` (emerald) and `badge.element/elementBg` (amber) tokens, replaced hardcoded values.
- [x] **SpacingBoxModel hardcoded colors** — Replaced tooltip background with `bgAlpha(0.97)`, shadow with `shadow.dropdown`, border with `border.subtle`.
- [x] **TextToggle wrong border token** — `layoutControls.tsx:80` uses `surface.track` for borders. Should use `border.default` or `border.input`.
- [x] **SpacingBoxModel inline focus ring** — `SpacingBoxModel.tsx` has inline `rgba(59,130,246,0.3)` focus ring. Replace with `focusRing` from theme.ts.
- [x] **Toolbar hardcoded rgba whites** — `Toolbar.tsx` has 5+ hardcoded `rgba(255,255,255,...)` values for dark-on-dark hover/active states. Extract to `darkToolbar.*` token family in theme.ts (e.g. `darkToolbar.text`, `darkToolbar.textMuted`, `darkToolbar.hover`, `darkToolbar.active`, `darkToolbar.border`).
- [x] **Toolbar wrong fontFamily** — `Toolbar.tsx:71` uses `"system-ui, -apple-system, sans-serif"` instead of `font.sans` from theme.ts.
- [x] **StateSelector hardcoded green** — `StateSelector.tsx:57` uses `#34d399` for active state color. Should use `badge.action` token (same value, but via theme).
- [x] **Footer hardcoded success greens** — `Footer.tsx:264` has `#16a34a` and `Footer.tsx:357` has `#22c55e` for copied/saved states. Add `color.success` + `color.successMuted` tokens.
- [x] **ScopePill duplicate hover** — `Header.tsx:311` has `hovered ? surface.active : surface.active` — both branches identical. Active+hovered should use a slightly stronger background (e.g. `blackAlpha(0.1)`).
- [x] **z-index sprawl** — 16+ components use `2147483647` (max int). Add `zIndex` tokens to theme.ts (e.g. `zIndex.overlay`, `zIndex.popover`, `zIndex.max`) and replace all occurrences.
- [x] **GapInput missing value flash** — `GapInput` in `layoutControls.tsx:610` doesn't use `useValueFlash`. `TrackCountInput` at line 790 also lacks it. Add for consistency with `ValueInput`/`SizeInputCell`.

---

## Phase 2 — Input & Control Polish (medium effort, high UX value)

### Input Improvements
- [x] **Section header hover highlight**: Add `surface.hover` background on section header row hover in the `Section` component (`controls.tsx`). Use timing token for transition. Gives visual feedback that sections are clickable.
- [x] **Color swatch inset border**: The `1px solid color.border` on color swatches handles most cases, but pure-white or near-white swatches still blend into the panel background. Add an `inset` shadow or ensure border is always visible even for white swatches. Target: `ColorRow` in `controls.tsx:859`.
- [x] **Input placeholder styling**: Numeric inputs showing "auto"/"none" keywords should render in italic at `text.disabled` opacity. Target: `SizeInputCell` keyword mode.
- [x] **Label truncation with tooltip**: Long property labels (e.g., "border-top-left-radius") can clip. Add `overflow: hidden`, `textOverflow: ellipsis`, and `title` attribute to `labelStyle` in `controls.tsx`.
- [x] **SizeInputCell width clips large values** — Still fixed at `36px` width (`SizeInputCell.tsx:249`). Consider `minWidth: 36` with `flex: 1` or expand-on-focus.
- [x] **UnitSelector dismissal timeout** — Uses hardcoded `1700ms` for hint auto-dismiss. Replace with `timing.slow * 5` or a new `timing.dismissal` token.
- [x] **Footer reset button hover** — Uses `surface.active` for hover when count > 0, but `surface.active` is also the pressed state token. Use `surface.hover` for hover, `surface.active` only for pressed/active.

### Section-Specific Polish
- [x] **Font weight preview**: In the font-weight dropdown, render each option at its actual weight (100=thin, 900=heavy). Target: Typography section `SelectRow`.
- [x] **Shadow preview swatch**: Show a small 20×20 preview square with the current shadow applied, next to the shadow layer header. Target: `ShadowEditor.tsx`.

---

## Phase 3 — Panel Chrome & Interaction (larger effort)

### Panel Behavior
- [x] **Panel shadow lift on drag**: While dragging the panel, deepen box-shadow (`shadow.panel` → a heavier variant like `shadow.panelDrag`). Revert on drop. Target: `Overlay.tsx` drag handlers.
- [x] **Section collapse memory**: Remember which sections are collapsed across element selections within a session (not localStorage, just React state). Target: `WebflowPanel.tsx`.

### Visual Feedback
- [x] **Element outline pulse on select**: Brief scale+opacity pulse on the selection outline when selecting a new element (400ms). Target: `Overlay.tsx` selection outline.

---

## Phase 4 — Accessibility

- [x] **Standardize focus ring approach** — Components use 3 different focus patterns: `outline: 1px solid rgba(...)` (WebflowPanel), `boxShadow: 0 0 0 2px ...` (IconButtonGroup), and none (Header, Footer buttons). Pick one canonical approach using `focusRing` from theme.ts and apply globally.
- [x] **Toolbar missing ARIA** — `ToolButton` in `Toolbar.tsx` has no `aria-label` or `aria-pressed` attributes. Add `aria-label={label}` and `aria-pressed={active}`.
- [x] **Header breadcrumb focus** — No visible focus ring on breadcrumb items or close button when navigating with keyboard.
- [x] **Hint text contrast** — `text.hint` (#A3A3A3) on white background: contrast ratio is ~2.7:1, below WCAG AA (4.5:1). Darken to ~#8A8A8A for 3.9:1 or ~#757575 for 4.6:1.
- [x] **`text.disabled` contrast** — `#737373` on white is ~4.6:1, which barely passes AA for normal text. Verify it's only used for disabled/decorative elements where AA isn't strictly required.

---

## Phase 5 — Hover & Interaction Consistency

- [x] **Hover state standardization** — 4 different hover patterns across components: `surface.hover`, `surface.active`, custom `rgba(255,255,255,...)` (dark theme), and no hover. Document the rules: `surface.hover` for light backgrounds, dark-theme tokens for dark backgrounds, no custom rgba.
- [x] **Toolbar expanded animation timing** — `Toolbar.tsx:192` uses `duration: 0.15` (hardcoded seconds) for AnimatePresence exit. Should use timing token.
- [x] **SessionDrawer hardcoded timeout** — `SessionDrawer.tsx:47` uses `setTimeout(() => ..., 1500)` for "Copied!" message. Should use timing-based constant.

---

## Completed

### 2026-03-13 — Toolbar wrong fontFamily
Replaced hardcoded `"system-ui, -apple-system, sans-serif"` with `font.sans` token in Toolbar.tsx ToolButton. Now uses `"Inter, system-ui, sans-serif"` consistent with the rest of the panel.

### 2026-03-13 — StateSelector hardcoded green
Replaced hardcoded `#34d399` in StateSelector.tsx with `badge.action` token. Same emerald green value, now governed by the token system.

### 2026-03-13 — ScopePill duplicate hover
Fixed no-op ternary in Header.tsx ScopePill where active+hovered and active-only both resolved to `surface.active`. Active+hovered now uses `blackAlpha(0.1)` (10% vs 8%) for perceptible hover feedback.

### 2026-03-13 — Color swatch inset border
Added `inset 0 0 0 1px blackAlpha(0.06)` box-shadow to color swatches in ColorRow. Provides a subtle inner border visible on white/near-white swatches without affecting colored ones. Skipped when a CSS variable binding border is active.

### 2026-03-13 — Section header hover highlight
Added `surface.hover` background on hover to collapsed Section headers in controls.tsx. Uses `ms("fast")` transition. Only applies when section is collapsed — open/sticky headers keep `color.background` to cover scrolling content.

### 2026-03-13 — GapInput missing value flash
Added `useValueFlash(value)` to `GapInput` and `TrackCountInput` in layoutControls.tsx. Both now show a brief `primaryAlpha(0.12)` background flash on value change, consistent with `ValueInput` and `SizeInputCell`.

### 2026-03-13 — z-index sprawl
Added 4-tier `zIndex` token family to theme.ts: `max` (2147483647), `overlay` (max-1), `guide` (max-2), `backdrop` (max-3). Replaced all hardcoded z-index magic numbers across 19 component files and 4 Z_INDEX constants. Updated z-index test to accept `zIndex.max` token form. 21 files changed.

### 2026-03-13 — Footer hardcoded success greens
Added `color.success` (#22c55e), `color.successMuted` (#16a34a), `successAlpha()`, and `successMutedAlpha()` to theme.ts. Replaced 5 hardcoded green values in Footer.tsx (copied text, copied bg/border, saved bg, saved shadow).

### 2026-03-13 — Toolbar hardcoded rgba whites
Added `darkToolbar` token family to theme.ts with 6 tokens (text, textMuted, icon, active, hover, border). Replaced all 6 hardcoded `rgba(255,255,255,...)` values in Toolbar.tsx with corresponding tokens.

### 2026-03-13 — SpacingBoxModel inline focus ring
Replaced hardcoded `rgba(59,130,246,0.3)` focus ring in SpacingBoxModel.tsx onFocus handler with `focusRing` token from theme.ts. Same visual result, now governed by the token system.

### 2026-03-13 — TextToggle wrong border token
Replaced 3 `surface.track` border usages in layoutControls.tsx (TextToggle container, internal divider, MiniDropdown popup) with `border.input` — the correct semantic token for input control borders.

### 2026-03-13 — SpacingBoxModel hardcoded colors
Replaced 3 hardcoded values in SpacingBoxModel.tsx tooltip: `rgba(250,249,245,0.97)` → `bgAlpha(0.97)`, inline shadow → `shadow.dropdown`, `rgba(0,0,0,0.07)` border → `border.subtle`.

### 2026-03-13 — CommandPalette badge colors
Added `badge.action` (#34d399, emerald), `badge.actionBg`, `badge.element` (#fbbf24, amber), `badge.elementBg` tokens to theme.ts. Replaced 4 hardcoded values in CommandPalette.tsx CATEGORY_BADGE_STYLES.

### 2026-03-13 — Toolbar dark theme colors
Added `surface.darkToolbar: "#1e1e1e"` token to theme.ts. Replaced hardcoded hex in Toolbar.tsx line 138.

### 2026-03-13 — FlexGapOverlay hardcoded colors
Added `overlay.flexGap.*` tokens and `flexGapAlpha()` helper to theme.ts. Replaced 3 hardcoded magenta values (#FF44CC, rgba(255,68,204,...)) in FlexGapOverlay.tsx with theme tokens.

### 2026-03-13 — GridOverlay hardcoded colors
Added `overlay.grid.*` token family and `gridAlpha()` helper to theme.ts. Replaced 5 hardcoded `rgba(217,119,87,...)` constants in GridOverlay.tsx (LINE_COLOR, GAP_COLOR, LABEL_COLOR, LABEL_BG, OUTLINE_COLOR) with theme tokens.

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

### 2026-03-13 — text.disabled contrast audit
Audited all 63 usages of `text.disabled` (#737373, 4.7:1) across 25 files. Every usage falls into an appropriate category: disabled controls, decorative icons (chevrons, separators), supplementary labels (channel names, keyboard shortcuts, axis labels), inactive toggle states, or placeholder/empty-state text. No primary content text uses this token. No changes needed — current scoping is correct.

### 2026-03-13 — Hint text contrast
Darkened `text.hint` from `#A3A3A3` (2.5:1) to `#757575` (4.6:1) in theme.ts. Passes WCAG AA minimum of 4.5:1. Still lighter than `text.disabled` (#737373, 4.7:1), preserving the visual hierarchy. Single token change affects all 26 usages.

### 2026-03-13 — Header breadcrumb focus
Added `focusRing` box-shadow, `tabIndex={0}`, `role="button"`, and Enter/Space keyboard activation to breadcrumb ancestor segments and the ellipsis expander in Header.tsx. Close button also gets `focusRing` on focus with `outline: "none"` to suppress the default.

### 2026-03-13 — Toolbar missing ARIA
Added `aria-label={label}` and `aria-pressed={!!active}` to the `<button>` in `ToolButton` (Toolbar.tsx). All 4 toolbar buttons (Select, Variables, AI, Session) now announce their label and toggle state to screen readers.

### 2026-03-13 — Standardize focus ring approach
Unified 8 inline focus ring variants across 7 files to use the canonical `focusRing` token (`box-shadow: 0 0 0 2px color.ring`). Fixed: CSSVariablesSection (was 20% opacity via hex `33`), GlobalVariablesPanel ×2 (same), IconButtonGroup (was `primaryAlpha(0.3)`), PositionSelector, TextStyleRow, TransformOriginPicker, WebflowSegmentedControl (last two were hardcoded rgba). Converted WebflowPanel.tsx `.tuner-focusable` from `outline` to `box-shadow` to match.

### 2026-03-13 — Element outline pulse on select
Added `@keyframes tuner-outline-pulse` to the injected focus-ring stylesheet in Overlay.tsx. A `--pulse` CSS class triggers a 400ms box-shadow expand+fade animation (`color.primary` glow). Applied via `useEffect` watching `panelKey` — triggers on both direct selection and breadcrumb navigation. Uses `timing.toolbar` (400ms) for cleanup timeout.

### 2026-03-13 — Section collapse memory
Added `SectionMemoryProvider` context in controls.tsx. Overlay.tsx owns the `Record<string, boolean>` state (survives panelKey remounts). WebflowPanel wraps its JSX in the provider, and each `Section` reads/writes the shared context on toggle. No prop threading to section files needed.

### 2026-03-13 — Icon opacity audit
Normalized 3 lucide-react icon opacity violations to `text.disabled` token: Footer.tsx ChevronDown (was `opacity: 0.6`), Header.tsx ChevronRight ×2 (were `opacity: 0.4`). All other icon usages already use theme tokens.

### 2026-03-12 — Value change flash
Added `useValueFlash` hook in `controls.tsx`. Wired into `ValueInput`, `SizeInputCell`, `TypoValueCell`. Brief `primaryAlpha(0.12)` background flash on value change (200ms fade).

---

## Removed (audited 2026-03-13)

Items removed because they were already fixed, became outdated as the codebase evolved, or were too speculative for low-risk polish:

- **Dropdown scroll-to-selected** — Handled by Shadcn Select component natively.
- **Slider value tooltip** — `ComputedTooltip` already provides this.
- **MiniDropdown keyboard navigation** — Already implemented via `useDropdownKeyboard` hook.
- **Spacing side hover highlight** — Already implemented with `spacingZone.*Hover` tokens.
- **Smooth section collapse animation** — Handled by `CollapsibleContent` from Shadcn.
- **Panel resize handle** — Drag handle already exists in Header.tsx; resize adds complexity for low value.
- **ResetPopover z-index too aggressive** — Consolidated into the broader "z-index sprawl" item.
- **Changed property left-border accent** — `labelIndicator` highlight pills already serve this purpose.
- **Undo/redo depth indicator** — Header already shows total changes badge; HistoryDrawer provides detail.
- **Property search autocomplete** — CommandPalette (Cmd+K) already provides this with fuzzy search.
- **Transition easing curve mini-preview** — BezierEditor already provides full curve editing.
- **Filter before/after thumbnail** — Too much effort for low-use section.
- **UnitSelector missing ARIA** — Already has `role`, `aria-expanded`, `aria-haspopup`.
- **MiniDropdown missing ARIA** — Already has full ARIA via `useDropdownKeyboard`.
- **Footer button focus** — Buttons use `tuner-focusable` class with injected styles.
- **Copy button checkmark animation** — Already uses Motion.js transitions.

### 2026-03-13 — Hover state standardization
Replaced 9 raw `rgba()` hover values in 6 files with semantic `surface.hover`/`surface.active` tokens: PositionOffsetDiagram (×2), ShadowEditor (×1), SideSelector (×3 — active bg, hover bg, restore bg), HistoryDrawer (Tailwind class → inline style), BackgroundLayerList (×2 — `color.muted` → `surface.hover`), TextStyleRow (`blackAlpha(0.07)` → `surface.active`). Added hover convention doc comment to theme.ts: light bg → `surface.*`, dark bg → `darkToolbar.*`, no raw rgba.

### 2026-03-13 — Toolbar expanded animation timing
Replaced hardcoded `duration: 0.15` in Toolbar.tsx AnimatePresence exit transition with `timing.expand / 1000` (150ms → same value, now governed by token system). Motion uses seconds, timing tokens use milliseconds.

### 2026-03-13 — SessionDrawer hardcoded timeout
Replaced 3 hardcoded values in SessionDrawer.tsx: copy auto-dismiss `1500` → `timing.dismissal` (1700ms), save auto-dismiss `2000` → `timing.dismissal`, and message animation `duration: 0.15` → `timing.expand / 1000`. All timing now governed by tokens.
