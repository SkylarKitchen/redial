# Transform Editor Test PRD

> Copy to `docs/prd-transform-tests.md` on exit. Each `- [ ]` is one agent task.

**Goal:** Comprehensive test coverage for the new TransformEditor (pills, tabbed editor, settings panel, CSS parsers, drag reorder, EffectsSection integration).

**Test framework:** Vitest, same patterns as existing `src/overlay/__tests__/*.test.ts`
**Files to create:** One test file per group below, in `src/overlay/__tests__/`

---

## Group 1: TransformPill (`transformPill.test.ts`)

- [ ] P1-1: Pill renders icon + summary for translate — `"Move: 10px, 20px, 0px"`
- [ ] P1-2: Pill renders icon + summary for scale — `"Scale: 1.5, 2, 1"`
- [ ] P1-3: Pill renders icon + summary for rotate — `"Rotate: 45deg, 0deg, 0deg"`
- [ ] P1-4: Pill renders icon + summary for skew — `"Skew: 10deg, 5deg"`
- [ ] P1-5: Pill click calls onClick
- [ ] P1-6: Remove button hidden when not hovered and not expanded
- [ ] P1-7: Remove button visible when isExpanded=true
- [ ] P1-8: Remove click calls onRemove without triggering onClick (stopPropagation)
- [ ] P1-9: Drag handle click does not trigger pill onClick (stopPropagation)
- [ ] P1-10: Expanded pill has darker background (`blackAlpha(0.05)`) and active border

## Group 2: TransformExpanded — Tabs & Axes (`transformExpanded.test.ts`)

- [ ] P2-1: Renders SegmentedControl with Move/Scale/Rotate/Skew tabs
- [ ] P2-2: Active tab matches transform.type
- [ ] P2-3: Clicking different tab calls onTypeChange with new type
- [ ] P2-4: Translate shows X, Y, Z sliders with PX unit
- [ ] P2-5: Scale shows X, Y, Z sliders with no unit
- [ ] P2-6: Rotate shows X, Y, Z sliders with DEG unit
- [ ] P2-7: Skew shows only X, Y sliders (no Z) with DEG unit
- [ ] P2-8: Scale lock button visible only for scale type
- [ ] P2-9: Scale lock button hidden for translate/rotate/skew
- [ ] P2-10: Scale locked: changing X calls onUpdate with {x: v, y: v, z: v}
- [ ] P2-11: Scale unlocked: changing X calls onUpdate with {x: v} only
- [ ] P2-12: Scale lock toggle calls onUpdate with {scaleLocked: !current}

## Group 3: AxisSliderRow (`axisSliderRow.test.ts`)

- [ ] P3-1: Renders label, slider, input, and unit
- [ ] P3-2: Slider onChange fires immediately (not on blur)
- [ ] P3-3: Input blur commits value clamped to [min, max]
- [ ] P3-4: Input Enter key commits value and blurs
- [ ] P3-5: ArrowUp increments by step
- [ ] P3-6: Shift+ArrowUp increments by step*10
- [ ] P3-7: ArrowDown decrements by step
- [ ] P3-8: Value below min clamped to min on commit
- [ ] P3-9: Value above max clamped to max on commit
- [ ] P3-10: External value change syncs draft when not focused
- [ ] P3-11: External value change does NOT overwrite draft when focused

## Group 4: TransformEditor Orchestrator (`transformEditor.test.ts`)

- [ ] P4-1: Renders one pill per transform in list
- [ ] P4-2: Auto-expands newly added transform (last item)
- [ ] P4-3: Click pill toggles expanded/collapsed
- [ ] P4-4: Only one transform expanded at a time
- [ ] P4-5: Remove transform calls onChange with filtered array
- [ ] P4-6: Remove expanded transform sets expandedIndex to null
- [ ] P4-7: Remove item before expanded item adjusts expandedIndex down by 1
- [ ] P4-8: Type change via tab resets values to TRANSFORM_DEFAULTS
- [ ] P4-9: Type change to same type is a no-op
- [ ] P4-10: settingsOpen=true renders TransformSettings
- [ ] P4-11: settingsOpen=false hides TransformSettings
- [ ] P4-12: Empty transforms array renders no pills

## Group 5: TransformOriginPicker (`transformOriginPicker.test.ts`)

- [ ] P5-1: Renders 3x3 grid of cells
- [ ] P5-2: Click cell calls onChange with keyword (e.g., "top left")
- [ ] P5-3: Active cell highlighted for "center" value
- [ ] P5-4: Active cell highlighted for "top right" value
- [ ] P5-5: Keyboard Enter activates cell
- [ ] P5-6: Parse "50% 50%" → center cell active
- [ ] P5-7: Parse "0% 0%" → top-left cell active
- [ ] P5-8: Parse "100% 100%" → bottom-right cell active
- [ ] P5-9: Parse px values → no cell active ([-1, -1])
- [ ] P5-10: showInputs=false renders grid only (no Left/Top inputs)
- [ ] P5-11: showInputs=true renders grid + Left + Top inputs
- [ ] P5-12: Left input change emits "25% 50%" format
- [ ] P5-13: Top input change emits "50% 75%" format
- [ ] P5-14: OriginInput clamps to [0, 100] on blur
- [ ] P5-15: OriginInput ArrowUp increments by 1

## Group 6: TransformSettings (`transformSettings.test.ts`)

- [ ] P6-1: Renders "Transform settings" header
- [ ] P6-2: Renders Origin picker with showInputs=true
- [ ] P6-3: Backface segmented control shows Visible/Hidden
- [ ] P6-4: Backface change calls onBackfaceChange
- [ ] P6-5: Self perspective slider renders with 0-2000 range
- [ ] P6-6: Self perspective change calls onSelfPerspectiveChange
- [ ] P6-7: Children perspective slider renders with 0-2000 range
- [ ] P6-8: Children perspective change calls onChildrenPerspectiveChange
- [ ] P6-9: Children perspective origin picker renders with showInputs
- [ ] P6-10: Perspective origin change calls onPerspectiveOriginChange

## Group 7: CSS Parsers — Extended (`cssParsersTransform.test.ts`)

- [ ] P7-1: parseTransform: multiple transforms in order (translate + rotate + scale)
- [ ] P7-2: parseTransform: rotate(45deg) maps to z-axis `{x:0, y:0, z:45}`
- [ ] P7-3: parseTransform: perspective(500px) skipped, only transforms returned
- [ ] P7-4: parseTransform: scale(2) single arg → `{x:2, y:2}`
- [ ] P7-5: parseTransform: mixed rotateX(10deg) + translate(5px, 10px) + rotateZ(20deg) → rotate merged
- [ ] P7-6: transformToCSS: rotate all zeros → `"rotateX(0deg)"`
- [ ] P7-7: transformToCSS: multiple transforms joined with space
- [ ] P7-8: transformToCSSWithPerspective: selfPerspective=0 omits prefix
- [ ] P7-9: transformToCSSWithPerspective: empty transforms + perspective=500 → "none"
- [ ] P7-10: parseSelfPerspective: no perspective in string → 0
- [ ] P7-11: Round-trip: parse → serialize → parse produces same values

## Group 8: EffectsSection Integration (`effectsTransformIntegration.test.ts`)

- [ ] P8-1: Initial state parses transforms from computedStyle
- [ ] P8-2: Initial selfPerspective parsed from transform string
- [ ] P8-3: handleTransformsChange applies CSS with perspective prefix
- [ ] P8-4: handleSelfPerspectiveChange applies CSS with updated perspective
- [ ] P8-5: SubSectionHeader "..." toggles transformSettingsOpen
- [ ] P8-6: SubSectionHeader "+" adds default translate transform
- [ ] P8-7: Reset clears all transform-related properties
- [ ] P8-8: TransformEditor visible when transforms.length > 0
- [ ] P8-9: TransformEditor visible when settingsOpen even with no transforms
- [ ] P8-10: Backface/Perspective no longer rendered as standalone rows (moved into TransformEditor)

## Group 9: useDragReorder (`dragReorderTransform.test.ts`)

- [ ] P9-1: computeOverIndex: drag down past midpoint of next item → overIndex increments
- [ ] P9-2: computeOverIndex: drag up past midpoint of previous item → overIndex decrements
- [ ] P9-3: computeItemShift: items between dragIndex and overIndex shift by ±dragHeight
- [ ] P9-4: computeItemShift: items outside range have 0 shift
- [ ] P9-5: Dead zone: movement < 3px does not start drag
- [ ] P9-6: Reorder on drop: item moves from dragIndex to overIndex
- [ ] P9-7: Single item list: drop is no-op

---

## Verification

After all tasks complete:
1. `npm run typecheck` — all pass
2. `npm test` — all pass (existing 2501 + new ~100 tests)
3. No test file imports actual React DOM (use mocks like existing test patterns)

## Unresolved Questions

1. Should the round-trip test (P7-11) account for precision loss (e.g., matrix decomposition)?
2. Do any existing tests in `effectsSection.test.ts` need updating for the new TransformEditor props, or were they already updated by the Task 8 agent?
3. Should drag reorder tests (Group 9) test the hook in isolation or through TransformEditor? The hook is generic and already used by other editors (ShadowEditor, TransitionEditor).
