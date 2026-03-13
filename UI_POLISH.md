# UI Polish Backlog

Autonomous improvement queue. Each item is self-contained and verifiable. Agent picks the next unchecked `[ ]` item, implements, tests, and checks it off.

**Status: 45/45 complete** | All tokens from `theme.ts` / `timing.ts`, never hardcode hex.

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

## Phase 6 — Sub-Editor Token Debt & Shadow Consistency

Deeper sweep of section-specific editors that were missed by the Phase 1 top-level audit.

- [x] **ShadowEditor hardcoded text colors** — Replaced 15 hardcoded values with `text.*` tokens and `primaryAlpha()`/`blackAlpha()`.
- [x] **GradientEditor hardcoded text colors** — Replaced 8 hardcoded values with theme tokens.
- [x] **PositionOffsetDiagram hardcoded text colors** — Replaced 6 hardcoded values with theme tokens.
- [x] **SpacingGuidesOverlay hardcoded colors** — Added `overlay.spacing.*` token family matching grid/flexGap pattern.
- [x] **Dropdown shadow token adoption** — Replaced 4 inline boxShadow strings with `shadow.dropdown`/`shadow.picker`.
- [x] **Internal z-index values outside token system** — Added 5 internal z-index tiers, replaced magic numbers in 10 files.
- [x] **TransformEditor hover convention** — Replaced `primaryAlpha(0.2)` with `surface.hover`, `surface.track` with `border.input`.
- [x] **TextStyleRow dark-on-primary text** — Added `color.primaryForegroundMuted` token.
- [x] **layoutControls dark dropdown hardcoded color** — Replaced `#e8e8e8` with `darkToolbar.text`.
- [x] **BezierEditor/TransitionEditor canvas hardcoded values** — Replaced 3 `rgba(0,0,0,...)` with `blackAlpha()`.
- [x] **Icon opacity audit** — Normalized 3 icon opacity violations to `text.disabled` token.

---

## Removed (audited 2026-03-13)

Items removed because they were already fixed, became outdated, or were too speculative:

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

---

<details>
<summary><strong>Completion log (45 entries)</strong></summary>

### Phase 1

**GridOverlay** — Added `overlay.grid.*` token family and `gridAlpha()` helper. Replaced 5 hardcoded `rgba(217,119,87,...)` constants.

**FlexGapOverlay** — Added `overlay.flexGap.*` tokens and `flexGapAlpha()` helper. Replaced 3 hardcoded magenta values.

**Toolbar dark theme** — Added `surface.darkToolbar: "#1e1e1e"` token. Replaced hardcoded hex in Toolbar.tsx.

**CommandPalette badges** — Added `badge.action` (#34d399), `badge.actionBg`, `badge.element` (#fbbf24), `badge.elementBg` tokens. Replaced 4 hardcoded values.

**SpacingBoxModel** — Replaced tooltip bg with `bgAlpha(0.97)`, shadow with `shadow.dropdown`, border with `border.subtle`.

**TextToggle border** — Replaced 3 `surface.track` border usages with `border.input`.

**SpacingBoxModel focus ring** — Replaced hardcoded `rgba(59,130,246,0.3)` with `focusRing` token.

**Toolbar rgba whites** — Added `darkToolbar` token family (text, textMuted, icon, active, hover, border). Replaced 6 hardcoded values.

**Toolbar fontFamily** — Replaced hardcoded `"system-ui, -apple-system, sans-serif"` with `font.sans`.

**StateSelector green** — Replaced hardcoded `#34d399` with `badge.action` token.

**Footer success greens** — Added `color.success` (#22c55e), `color.successMuted` (#16a34a), `successAlpha()`, `successMutedAlpha()`. Replaced 5 hardcoded values.

**ScopePill hover** — Fixed no-op ternary. Active+hovered now uses `blackAlpha(0.1)`.

**z-index sprawl** — Added 4-tier `zIndex` token family. Replaced magic numbers across 19 files.

**GapInput value flash** — Added `useValueFlash` to `GapInput` and `TrackCountInput`.

### Phase 2

**Section header hover** — Added `surface.hover` background on collapsed Section headers. Uses `ms("fast")` transition.

**Color swatch inset border** — Added `inset 0 0 0 1px blackAlpha(0.06)` box-shadow for white/near-white swatches.

**Input placeholder styling** — Numeric inputs showing keywords render italic at `text.disabled` opacity.

**Label truncation** — Added `overflow: hidden`, `textOverflow: ellipsis`, and `title` attribute.

**SizeInputCell width** — Expanded from fixed 36px to flexible width.

**UnitSelector dismissal** — Replaced hardcoded `1700ms` with timing token.

**Footer reset hover** — Changed hover to `surface.hover`, reserved `surface.active` for pressed state.

**Font weight preview** — Each font-weight option rendered at its actual weight.

**Shadow preview swatch** — 20x20 preview square with current shadow applied.

### Phase 3

**Panel shadow lift** — Deeper box-shadow during drag via `shadow.panelDrag` variant.

**Section collapse memory** — `SectionMemoryProvider` context in controls.tsx. Survives element re-selections.

**Element outline pulse** — 400ms `@keyframes tuner-outline-pulse` box-shadow animation on select.

### Phase 4

**Focus ring standardization** — Unified 8 inline variants across 7 files to `focusRing` token.

**Toolbar ARIA** — Added `aria-label={label}` and `aria-pressed={!!active}` to ToolButton.

**Breadcrumb focus** — Added `focusRing`, `tabIndex={0}`, `role="button"`, and keyboard activation.

**Hint text contrast** — Darkened `text.hint` from #A3A3A3 (2.5:1) to #757575 (4.6:1).

**text.disabled audit** — All 63 usages verified as appropriate for disabled/decorative contexts.

### Phase 5

**Hover standardization** — Replaced 9 raw `rgba()` hover values in 6 files with semantic tokens. Added convention doc to theme.ts.

**Toolbar animation timing** — Replaced hardcoded `duration: 0.15` with `timing.expand / 1000`.

**SessionDrawer timeout** — Replaced 3 hardcoded timing values with `timing.dismissal` and `timing.expand / 1000`.

### Phase 6

**ShadowEditor** — Replaced 15 hardcoded colors. Remaining hex values are CSS defaults only.

**GradientEditor** — Replaced 8 hardcoded colors. Only remaining hex is `#ffffff` default stop color.

**PositionOffsetDiagram** — Replaced 6 hardcoded colors including `rgba(217,119,87,0.5)` → `gridAlpha(0.5)`.

**SpacingGuidesOverlay** — Added `overlay.spacing.*` token family + alpha helpers. Replaced 4 top-level constants.

**Dropdown shadow adoption** — Replaced 4 inline boxShadow strings with `shadow.dropdown`/`shadow.picker`.

**Internal z-index** — Added 5 internal tiers (`above`, `sticky`, `float`, `dropdown`, `popover`). Replaced magic numbers in 10 files.

**TransformEditor hover** — `primaryAlpha(0.2)` → `surface.hover`, `surface.track` → `border.input`.

**TextStyleRow** — Added `color.primaryForegroundMuted: "rgba(255,255,255,0.6)"` token.

**layoutControls dark dropdown** — Replaced `#e8e8e8` with `darkToolbar.text`.

**BezierEditor/TransitionEditor canvas** — Replaced 3 `rgba(0,0,0,...)` with `blackAlpha()`.

**Icon opacity** — Normalized 3 lucide-react icon opacity violations to `text.disabled`.

**Value change flash** — Added `useValueFlash` hook. Wired into `ValueInput`, `SizeInputCell`, `TypoValueCell`.

**Separator consistency** — Replaced 2 hardcoded rgba separators with `border.subtle`.

**Border radius consistency** — Added `layout.pillRadius: 4` token. Updated ScopePill and PILL_BUTTON.

**Monospace font audit** — All 90+ instances verified as using `font.mono`. No changes needed.

**Transition timing audit** — Replaced 7 hardcoded `ms` values in 5 files.

**Move #d4956a** — Added `color.primaryActive` token for slider thumb `:active` states.

**Fix spacing zone base colors** — Changed `marginBase`/`paddingBase` to `"transparent"`.

**Fix UnitSelector overflow** — `overflow: "hidden"` removed from annotation span.

**Fix IconButtonGroup active** — Moved active styling from inline to `data-[state=on]` className.

**Fix class-scope undo/redo** — `onClassChange` listener and `resetStateOverrides` confirmed working.

**Fix annotation destructure** — Added missing `annotation` to `SliderRow` destructured params.

**Reset shake** — 3-cycle horizontal shake animation on no-op reset click.

**Save button success** — Green "Saved" state for 1.5s after successful save.

**Copy button checkmark** — Green "Copied" state for 1.5s after clipboard copy.

</details>
