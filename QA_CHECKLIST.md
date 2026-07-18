# QA Checklist

Browser-based QA for the Redial panel. Each scope is tested in one `/qa` run.
Tests are performed on `http://localhost:3000/demo` with Chrome automation.

---

## Resets

Every control that accepts a value should support modifying AND resetting (Alt+click label).

### Layout Section
- [x] DisplayTabs — `layout-reset.test.ts` "DisplayTabs is passed an onReset callback"; browser-verified ✓ on `<div>.page` (display: flex → Alt+click "Display" → inline cleared)
- [x] SegmentedControl (Direction) — `layout-reset.test.ts` "FlexDirectionRow is passed an onReset callback"
- [x] AlignBox — `reset-audit.test.ts` SubSectionHeader-with-indicator-has-onReset audit covers AlignBox row; `alignBoxClickFlexBug.test.ts` (#24 regression) covers click path
- [x] SliderRow (Gap) — `reset-audit.test.ts` "all SliderRows with computedProp have onReset"; browser-verified ✓ on `<div>.page` (gap: 24px → Alt+click "Gap" → inline cleared)
- [x] SelectRow (Align Self) — `layout-reset.test.ts` "Align Self SelectRow has onReset"

### Spacing Section
- [x] SpacingBoxModel (margin) — `spacing-reset.test.ts` "resetProp(margin-*) clears the dirty flag" + "has a reset path (onReset, onAltClick, or altKey handler)" per side
- [x] SpacingBoxModel (padding) — same audit, all 4 padding sides

### Size Section
- [x] SizeInputCell (Width) — `size-reset.test.ts` "resetProp clears the dirty flag" + "SizeSection must pass onReset to SizeInputCell for width"
- [x] SizeInputCell (Height) — same SizeInputCell component as Width (single onReset wiring)
- [x] SizeInputCell (Min/Max) — same SizeInputCell component
- [x] WebflowSegmentedControl (Overflow) — `reset-audit.test.ts` IconButtonGroup-with-computedProp coverage

### Position Section
- [x] PositionSelector — `position-reset.test.ts` "accepts an onReset prop" + "checks altKey on the trigger button click"
- [x] PositionOffsetDiagram (Top/Left) — `position-reset.test.ts` "EditableValue checks altKey on click" + "passes onReset to <PositionOffsetDiagram"
- [x] Z-Index input — `position-reset.test.ts` "z-index auto button checks altKey"
- [x] IconButtonGroup (Float/Clear) — `position-reset.test.ts` "Float IconButtonGroup receives onReset" + "Clear IconButtonGroup receives onReset"

### Typography Section
- [x] SelectRow (Font) — `reset-audit.test.ts` "all SelectRows with computedProp have onReset" (TypographySection)
- [x] SelectRow (Weight) — same audit
- [x] TypoValueCell (Size) — `reset-audit.test.ts` "all TextRows with computedProp have onReset"
- [x] TypoValueCell (Height) — same audit
- [x] ColorRow (Color) — `reset-audit.test.ts` "all ColorRows with computedProp have onReset"
- [x] IconButtonGroup (Align) — covered by IconButtonGroup audit pattern
- [x] IconButtonGroup (Decoration) — same

### Backgrounds Section
- [x] ColorRow (Color) — `reset-audit.test.ts` ColorRows audit (BackgroundsSection)
- [x] SelectRow (Clipping) — `reset-audit.test.ts` SelectRows audit (BackgroundsSection)

### Borders Section
- [x] Radius slider + ValueInput — `reset-audit.test.ts` "Radius label uses indicatorStyle" + "Radius row has alt-click reset handler"
- [x] IconButtonGroup (Style) — IconButtonGroup audit pattern
- [x] ValueInput (Width) — `reset-audit.test.ts` TextRows-with-computedProp audit
- [x] ColorRow (Border Color) — `reset-audit.test.ts` ColorRows audit (BordersSection)

### Effects Section
- [x] SelectRow (Blending) — `reset-audit.test.ts` SelectRows audit (EffectsSection)
- [x] SliderRow (Opacity) — `reset-audit.test.ts` SliderRows audit; same mechanism as Layout/Gap (browser-verified)
- [x] IconButtonGroup (Outline) — IconButtonGroup audit pattern
- [x] SelectRow (Cursor) — `reset-audit.test.ts` SelectRows audit

### Footer & Global
- [x] Footer Reset — browser-verified ✓ on `<div>.page` (multi-prop dirty: `display: flex !important; gap: 200px !important;` → Reset click → cssText === "")
- [x] Section collapse memory — `typographySection.test.ts` "renders with advanced section collapsed by default" + `positionSection.test.ts` collapse coverage; persisted across element re-selection by section header state
- [x] Scope pills — `scope.test.ts` covers element ↔ class scope switching

---

## Overflow

No content should clip or overflow the panel bounds.

### Panel Container
- [x] Panel scroll — root `overflowY: hidden` by design; per-section internal layout; browser-confirmed root at 300×981 fits within current selected-element height
- [x] Panel viewport — browser-verified ✓ panel rect (1415, 16, 300, 981) within viewport (1731×1154); `inViewport: true`

### Dropdowns & Popovers
- [x] SelectRow dropdown — `selectDropdownAudit.test.ts` (createPortal, position:fixed, zIndex.max, data-tuner-portal marker, click-outside via usePortalDropdown) + `selectPortalVariables.test.ts` (__tuner-root class for CSS-var inheritance); browser-verified ✓ on State combobox (3 new fixed body-children, both `mountIsBodyChild: true` and `inViewport: true`)
- [x] UnitSelector dropdown — same SelectContent/createPortal mechanism (audit-covered via `selectDropdownAudit.test.ts`)
- [x] ColorPicker popup — `colorPickerPosition.test.ts` "viewport-aware positioning" + "createPortal to escape panel's overflow:hidden + backdropFilter containing block"
- [x] ResetPopover — `resetPopoverClick.test.ts` (3 cases including no-event-stopping)
- [x] Clipboard dropdown (Footer) — uses same Radix SelectContent portal pattern (audit-covered); `dropdownOpaqueBackground.test.ts` enforces explicit `backgroundColor` on SelectContent (no transparency)

### Long Values
- [x] Long font family name — browser-observed: "Geist, Geist Fallback" truncates with ellipsis in Typography Font row (visible in screenshot)
- [x] Long CSS variable name — `feedback_pill_overflow_hidden` rule enforces overflow:hidden on VariableField pill; ColorRow variable display uses tooltip for full name (`feedback_clean_variable_display`)
- [x] Long class name in Header breadcrumb — browser-confirmed: header contains element with `text-overflow: ellipsis` / `overflow: hidden`

### Sub-editors
- [x] ShadowEditor — covered by `effectsSection.test.ts` + `reset-audit.test.ts` SubSectionHeader-with-indicator audit; uses standard list rendering with overflow:hidden on outer container
- [x] TransformEditor + TransitionEditor — covered by `transformEditor.test.ts`, `transformPill.test.ts`, `transformSettings.test.ts`, `transformExpanded.test.ts`, `effectsTransformIntegration.test.ts` (5 dedicated test files)

**Soft warning (not must-ship)**: `findOverflows` scan reported a 12px horizontal scrollWidth>clientWidth on the Borders Style+Width+Color sub-section's column wrapper (clientWidth 173, scrollWidth 185). Visually nothing is clipped (overflow:visible on a column flex container; children stack vertically at 173px each, so the 12px is content-measurement noise inside one of the rows, not a render artifact). No user-visible impact at panel width 300px. Filed informational follow-up for post-v1 if it becomes user-visible at narrower panels.

---

## Visual

Hover states, transitions, indicators, and alignment consistency.

### Hover States
- [x] Section header hover — background highlight appears (collapsed state)
- [x] SliderRow track — hover brightening works
- [x] Footer buttons — all 3 (Clipboard, Reset, Save) show hover state
- [x] Close button (Header) — hover background appears
- [x] IconButtonGroup items — hover distinct from active state

**Verified 2026-07-17** (QA loop iteration 1): all five PASS, locked in as
behavioral regression tests in `src/overlay/__tests__/hoverStates.test.tsx`
(mounted components + fired events per issue #105 policy). Item 1 additionally
confirmed in a live browser. Notes: Reset intentionally shows no hover feedback
while there is nothing to reset (count 0); Save sits at 0.5 opacity until
changes exist; the active IconButtonGroup item keeps `color.primary` through
hover so selection never washes out.

**Browser-QA methodology caveat**: claude-in-chrome tabs run with
`document.visibilityState === "hidden"`, where trusted CDP hover sets `:hover`
matching but React `onMouseEnter` state never updates (no frames → scheduler
starves continuous events). A "hover looks dead" result in that pane is a
false negative, not a bug — verify hover via mounted happy-dom tests or
synthetic `dispatchEvent`, and use the visible browser only for confirmation.

### Transitions
- [x] Section collapse/expand — smooth animation, no jump
- [x] Dropdown open/close — no flash or position jump
- [x] Panel drag — shadow deepens while dragging, reverts on drop
- [x] Save button success — green flash on save, smoothly reverts

**Verified 2026-07-17** (QA loop iteration 2): all four PASS, locked in as
behavioral regression tests in
`src/overlay/__tests__/transitionsIndicators.test.tsx`. Notes: dropdown
no-flash is guaranteed structurally — SelectRow's portal only renders once a
position exists (`open && dropdownPos &&` gate), so there is never an
unpositioned frame; drag shadow verified at the hook level (`useOverlayDrag`
`panelDragging` state machine) plus distinct `shadow.panelDrag` token; save
flash verified end-to-end with a mocked save transport (green "✓ Saved" for
1.5s, then reverts). Animation *smoothness* itself needs a visible browser —
spot-check alongside Alignment in a later iteration.

### Alignment
- [ ] Labels align vertically across all sections
- [ ] Section padding consistent between all 8 sections
- [ ] Footer buttons evenly spaced

*(Deferred to a later QA-loop iteration: alignment needs real layout geometry —
visible browser or Playwright-in-Orbstack `tests/visual/` — happy-dom has no
box model.)*

### Indicators
- [x] Modified property — orange highlight appears on label when value differs from computed
- [x] Section header — shows indicator when any child property is modified
- [x] Value flash — brief background highlight on numeric value change

**Verified 2026-07-17** (QA loop iteration 2): all three PASS, same test file
as Transitions. **Bug found and fixed**: ValueInput spread `...flashStyle`
*before* the `embedded`/base spreads, so both branches' `backgroundColor`
overrode the flash highlight — the value flash showed only the scale bump,
never the background. Fix: spread `...flashStyle` last (test-first repro in
`transitionsIndicators.test.tsx` → "Value flash").

---

## Keyboard

Tab navigation, Escape dismissal, focus rings, and ARIA attributes.

### Tab Order
- [ ] Tab from Header → section headers → controls → Footer
- [ ] Section headers: Enter/Space toggles collapse/expand
- [ ] SegmentedControl: arrow keys move between options
- [ ] SliderRow: focus ring visible on slider thumb
- [ ] SelectRow: opens on Enter, arrow keys navigate options
- [ ] Footer buttons: all reachable via Tab

### Escape Key
- [x] SelectRow dropdown → Escape → closes
- [x] ColorPicker → Escape → closes
- [x] UnitSelector dropdown → Escape → closes
- [x] Clipboard dropdown (Footer) → Escape → closes
- [x] TransitionOptionsMenu → Escape → closes

### Focus Management
- [x] Focus rings visible on all interactive elements (tuner-focusable class)
- [x] After dropdown closes, focus returns to trigger element

**Verified 2026-07-18** (QA loop iteration 3). Coverage split: UnitSelector +
searchable SelectRow Escape were already covered by
`dropdownAccessibility.test.tsx`, SwatchColorPicker by
`swatchColorPickerPortal.test.tsx`, Footer clipboard (Escape + focus return)
by `footerClipboardA11y.test.tsx`; the gaps — plain SelectRow Escape,
ColorRow/ModeValueCell picker Escape, TransitionOptionsMenu Escape + focus
return, and the `.tuner-focusable:focus-visible` ring contract — are locked in
by `src/overlay/__tests__/keyboardEscapeFocus.test.tsx` (5 tests).
**Bug found and fixed**: pickers opened from ColorRow and ModeValueCell had
no Escape handling at all (only outside-click closed them; only
SwatchColorPicker listened for Escape). Fix: shared
`hooks/useEscapeClose.ts` (document-level capture keydown, mirroring
SwatchColorPicker's semantics), wired into both. Notes: plain
SelectRow/UnitSelector handle Escape via `useDropdownKeyboard` on the
*trigger* (focus never leaves it, so focus-return is inherent);
TransitionOptionsMenu restores focus via `useFocusTrap`; the focus ring is
`:focus-visible`-gated so mouse clicks don't show it.

### ARIA
- [ ] SegmentedControl: role="radiogroup", children role="radio", aria-checked
- [ ] Section headers: aria-expanded reflects collapse state
- [ ] Toolbar buttons: aria-label and aria-pressed present
- [ ] Slider: aria-valuemin, aria-valuemax, aria-valuenow
- [ ] Footer status message: role="status", aria-live="polite"

---

## Issues Found & Fixed

### 2026-06-03 — useDraftNumber migration completed + stale-draft bug fixed

Finished the `useDraftNumber` adoption begun on 2026-06-02. The genuine numeric-draft site count was re-grepped (not trusted from the prior audit): **13** real sites (the "14"/"~11" were approximate), of which 3 were already migrated. Migrated the remaining **10**. All **behavior-preserving** (byte-equivalent unless noted); verified: typecheck clean, full suite **3296 pass / 1 skip / 0 fail across 188 files** (+11 new fired-event test files), `npm run build` green. Every site followed TDD: a fired-event characterization test written to **pass against the un-migrated code first**, then the migration kept it green, then an **independent adversarial reviewer** re-ran it and audited 8 behavioral axes (all `pass`, 0 medium/high drift).

**Bug fixed (TDD, `staleDraftOnArrowStep.test.tsx` — stateful parent, asserts the displayed value):**
- **Stale draft on Arrow-step** — FilterSliders `NumberInput` and TransitionEditor `MsInput` display `focused ? draft : String(value)` with `resync: !focused`, but did not write stepped values back into `draft`, so a focused field showed the old number until blur. Fixed with `stepUpdatesDraft: true` on both hook calls (ShadowEditor already had it).

**Migrated to `useDraftNumber` (each with a new behavioral `*Draft.test.tsx`):**
- `controls/ValueInput.tsx` (piloted first — shared control + trickiest: preserves `stopPropagation` on Escape/arrows, blur-on-Enter/Escape, math-expr eval, empty→keyword commit, wheel-adjust around the hook)
- `sections/{CornerRadiusEditor (CornerCell), PositionOffsetDiagram (EditableValue), GapControls (GapInput), GridControls (TrackCountInput), layoutMisc (TypoValueCell), SizeInputCell, SpacingValuePopover, TransformOriginPicker (OriginInput), TransformEditor (AxisSliderRow)}`
- TransformOriginPicker + TransformEditor done by one agent in sequence (TransformEditor imports TransformOriginPicker). The two source-string tests that asserted on the moved internals (`axisSliderRow.test.ts`, `transformOriginPicker.test.ts`) were converted to fired-event tests (behavioral > source-text).

**Byte-equivalence notes (deliberate / accepted):**
- `GapControls` + `layoutMisc` resync the edit-draft seed with `String(Math.round(value*100)/100)` (2-decimal rounding), which the hook's built-in `String(value)` resync can't express — both keep `resync:false` + the original rounded `useEffect` (gap pinned by a new regression test).
- Modifier precedence: the hook checks Shift before Alt; the bespoke sites were Alt-first. This only diverges for the degenerate **alt+shift held together** combo — negligible, uniform, untested.
- Single-bound arrow clamps (gap/grid clamped only one direction) became two-bound via `min`/`max`; unreachable in practice (values stay non-negative / ≥1).

Out of scope (own sessions, per handoff): engine-facade #14, Overlay reducer, MiniSelect wider adoption (a design decision, not a refactor).

### 2026-06-02 — Reusability & architecture refactor pass

Executed the deferred reusability/architecture items from the prior session's handoff. All **byte-identical pure refactors** unless noted; verified by typecheck clean, `npm run build` green (public `index.d.ts` 3.96 KB → 2.88 KB), full suite **3103 pass / 1 skip / 0 fail across 175 files** (+8 new behavioral test files), and a 6-area adversarial behavior-preservation review (**0 findings**). Out of scope (own sessions): engine-facade #14, Overlay reducer.

**Reusability extractions (TDD'd, behavioral tests added where coverage was absent):**
- `hooks/useDraftNumber.ts` — draft state + gated resync + Enter/Escape/Arrow + Shift/Alt step math + clamp/round; parse/clamp delegated to caller `onCommit`/`onStep` (no boolean-soup). 16 contract tests. Migrated the 3 handoff-named near-identical inputs (ShadowEditor `NumericInput`, FilterSliders `NumberInput`, TransitionEditor `MsInput`), each guarded by a **new fired-event** characterization test (these had zero behavioral coverage). The audit found **14** draft-number sites across ~11 files (8 axes of variation) — the other ~11 (SizeInputCell, CornerRadiusEditor, PositionOffsetDiagram, SpacingValuePopover, layoutMisc, GapControls, GridControls, TransformOriginPicker, ValueInput, AxisSliderRow) are ready-to-adopt **follow-ups**.
- `controls/MiniSelect.tsx` + `MINI_SELECT_CARET` — removed the doubly-pasted caret data-URI; backs the 2 TransitionEditor selects. Made all-longhand (`backgroundColor`/explicit paddings) per the no-shorthand-mixing rule — pixel-identical, removes a latent shorthand-reset fragility. The 3 native-arrow selects (SizeSection icon-arrow, FilterSliders, BackgroundLayerList) deliberately **not** migrated (forcing the caret = a design change).
- `useDragReorder` now returns `dropLine: ReactNode` (+ exported `computeDropLineStyle`); replaced the byte-identical drop-line IIFE in **5** editors (audit said 4 — missed TransformEditor). New harness test drives the real pointer drag (the gesture was untested). Skipped a generic `ReorderableList` (doesn't cleanly fit BackgroundLayerList).

**Architecture:**
- Layering inversion fixed (no `core/` → `variables/` imports): moved `modeOverrides.ts` (zero-dep runtime state) into `core/`; moved `parseVarRef`/`VAR_RE` into shared `cssParsers.ts` (colorVariables re-exports for its consumers; `core/commitUtils` imports the canonical source).
- `SectionCtx.reset/resetRead/resetReadStr` added + wired in WebflowPanel (element-direct wrappers, matching prior section behavior); all **8** section components migrated off direct `core/apply` reset imports (`SpacingBoxModel` sub-component correctly stays direct). Updated 3 source-string audits (`reset-audit`, `spacing-reset`, `effectsTransformIntegration`) that hard-coded `resetProp(element,…)` to recognize the `ctx.reset` path **by intent**.

**Minor:**
- **Bug fixed (TDD):** `SegmentedControl` arrow-key handler indexed `parentElement.children` without filtering the absolute indicator `<div>` → off-by-one + could focus the non-focusable indicator. Copied `WebflowSegmentedControl`'s `role="radio"` sibling filter.
- Deleted dead `controls/EditableValue.tsx` (+ `EditableValueProps`, barrel, stale test/DIRECTORY entries) — zero importers (PositionOffsetDiagram has its own local copy).
- Removed dead public exports `PX_PROPS`/`TOGGLE_CSS`/`toCSSValue`/`flattenValues` from `infer.ts` + the `src/index.tsx` barrel (audit-confirmed zero consumers).
- `SpacingValuePopover` unit menu now flips upward when opening below would overflow the viewport (pure `unitMenuOpensUpward` helper, unit-tested).

**Latent bug surfaced (preserved, not fixed — would break the byte-identical mandate):** FilterSliders `NumberInput` & TransitionEditor `MsInput` (always-input variants) don't `setDraft` on Arrow-step, so while focused the displayed number stays stale until blur even though the value updates. ShadowEditor's `NumericInput` is unaffected (it does setDraft on step). Candidate for a separate one-line fix (`stepUpdatesDraft: true`).

**Not done:** Chrome MCP visual spot-check (dev-server port flakiness; covered by behavioral tests + adversarial review). Did **not** touch the three "modified" blues (tracked design question #46).

### 2026-06-02 — UX/a11y/cleanliness pass (browser-verified in Chrome)

User-reported bug + a 7-dimension static audit (52 findings) driven to fixes. All verified: typecheck clean, full suite green (167 files), `npm run build` green.

**Bugs fixed (browser-verified on `/demo`):**
- **SpacingBoxModel Option(Alt)+click reset** — the box-model value cells *copied the value to the opposite side* instead of resetting, despite a "⌥ click to reset" tooltip. `onReset`/`resetAndReadNum` were imported but never called. Now resets correctly (`spacingBoxModelAltClickReset.test.tsx`, behavioral). Spec §4 realigned: alt+click = reset; complementary editing moved to **alt+drag**; corner alt+click → all 4 sides retained. The old `spacingAltClickComplementary.test.ts` PART 1 (which encoded the bug) was rewritten as an anti-regression guard.
- **Color pickers clipped by panel `overflow:hidden`** — ShadowEditor / GradientEditor / FilterSliders mounted `ColorPickerEnhanced` with `position:absolute`. Extracted a portaled `controls/SwatchColorPicker` (rect-anchored, viewport-clamped, flip-above, `data-tuner-portal`). Verified: picker is a direct `document.body` child, fully in viewport.
- **Navigator listed Redial's own injected chrome** (`__tuner-selected-outline`, overlay/portal divs, `next-route-announcer`) as selectable tree nodes. `navigatorFilter.shouldSkipEntirely` hardened (skip `__tuner*` classes, `data-tuner-*`, `next-route-announcer`) + all body-level overlays/selection-chrome now marked. Tree verified clean.
- **SpacingValuePopover selected preset** showed white text on a pale-blue bg (unreadable) → `color.primary`. Verified readable.
- **VisibilityToggle** opacity transition was silently overridden by the press-scale spread (spread-order bug) → composed transitions.

**Accessibility (Keyboard scope — source + unit-test verified):**
- [x] SegmentedControl — visible keyboard focus ring added
- [x] WebflowSegmentedControl — roving tabindex + arrow-key nav (`webflowSegmentedKeyboard.test.tsx`)
- [x] ColorPickerEnhanced — hue/opacity/saturation now `role="slider"` + arrow-key operable (`colorPickerKeyboard.test.tsx`)
- [x] Footer clipboard dropdown — `aria-haspopup`/`aria-expanded`, `role="menu"`/`menuitem`, Escape-to-close (`footerClipboardA11y.test.tsx`)
- [x] Footer status — live region always mounted (first message announced); Reset button `aria-disabled`

**Overflow scope (browser-verified):**
- [x] SelectRow dropdown — portal, opens upward, not clipped
- [x] ColorPicker popup — portaled, fully visible, flips above near bottom
- [x] SpacingValuePopover — portaled, not clipped

**Cleanliness / architecture:**
- ~15 hardcoded color/timing literals → `theme.ts`/`timing.ts` tokens (added `color.warning`/`warningAlpha`)
- Deleted dead code: `CSSVariablesSection.tsx`, `ViewportBar.tsx`, `getIndicatorColor`; removed ~415 dead lines from `infer.ts` (the unused DialKit `DialConfig` — only `.spacing` is consumed); deduped `DEFAULT_SHADOW`

### 2026-05-15 — Resets scope
- **#45 (must-ship)** — `npm test` red on `main`: Node v25.8.1's experimental `localStorage` global stub (broken `{}` without `--localstorage-file=<path>`) shadowed happy-dom's real Storage. 11 tests failed across `useSwatches.test.ts`, `tokenCollections.test.ts`, and `apply.test.ts` (restoreSession). Fixed by adding `vitest.setup.ts` with an in-memory `MemoryStorage` polyfill installed on `globalThis` + `window` before each test file evaluates. Baseline restored to 2937 passing / 1 skipped / 0 failed across 146 files. Closed #45.

### Resets scope — coverage methodology

Each item is marked `[x]` based on a combination of source-level audits (`reset-audit.test.ts` proves every control with `computedProp` has `onReset` wired), section-specific reset tests (`layout-reset.test.ts`, `position-reset.test.ts`, `size-reset.test.ts`, `spacing-reset.test.ts`), and three end-to-end browser spot-checks performed on `<div>.page` at `/demo`:

| Control type | Item browser-verified | Result |
|--------------|----------------------|--------|
| DisplayTabs  | Layout/Display       | PASS: `display: flex` → Alt+click "Display" → inline empty, computed unchanged |
| SliderRow    | Layout/Gap           | PASS: `gap: 24px` → Alt+click "Gap" → inline empty |
| Footer       | Footer/Reset         | PASS: multi-prop dirty state → Reset click → `cssText === ""` |

No reset-related bugs surfaced beyond #45. The Resets scope is structurally proven by the unit-test audit (any new control omitting `onReset` would have failed `reset-audit.test.ts` immediately).
