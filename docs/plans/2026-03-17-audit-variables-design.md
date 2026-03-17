# Audit Variables Skill — Design

## Problem
Variable functionality spans a large surface area (8 control types × 8 operations × 2 panels × modes × save paths). Bugs surface randomly during manual browser testing. Need automated discovery.

## Solution
A Claude Code skill (`/audit-variables`) that systematically audits the variable surface across three layers.

## Layer 1: Static Analysis

Read all variable-related files. Check a **control × operation matrix**:

**Controls:** ColorRow, SliderRow, SizeInputCell, TypoValueCell, SpacingBoxModel, ModeValueCell, DetailVariableRow, LabelScrub

**Operations:** link, unlink, edit-while-linked, undo, reset, save, purple-pill-render, variable-picker-wiring

Per cell, verify:
- Props wired (`onSelectVariable`, `onUnlink`, `activeVariable`, `variableType`)
- `VariableField` rendered in linked state
- `data-tuner-portal` on all `createPortal` wrappers
- Undo/redo through `beginBatch/endBatch`
- Save path handles `var(--name)` values

Output: matrix table with PASS/FAIL/MISS per cell + line numbers.

## Layer 2: Unit Test Gaps

1. Grep existing tests for variable coverage
2. Map which control×operation combos have tests
3. Report gap list
4. Optionally write missing tests (with `--fix`)

## Layer 3: Browser Smoke Tests (optional)

If Chrome MCP available, exercise 5 flows on demo page:
1. Link color to variable → verify purple pill
2. Edit variable in variables panel → verify element updates
3. Undo → verify revert
4. Unlink → verify raw value restored
5. Re-link → save → verify `var()` in output

## Output Format

Markdown report with:
- Static analysis matrix (PASS/FAIL/MISS/WARN)
- Findings list with severity (CRITICAL/WARN/INFO)
- Test coverage gap list
- Browser test results (if run)

## Key Files

### Variable controls (style panel)
- `src/overlay/controls/VariableField.tsx` — purple pill
- `src/overlay/controls/VariablePicker.tsx` — connect picker
- `src/overlay/controls/VariableLinkDot.tsx` — unlinked state dot
- `src/overlay/controls/ColorRow.tsx`
- `src/overlay/controls/SliderRow.tsx`
- `src/overlay/sections/SizeSection.tsx` → `SizeInputCell.tsx`
- `src/overlay/sections/TypographySection.tsx` → `TextStyleRow.tsx`
- `src/overlay/sections/SpacingSection.tsx` → `SpacingBoxModel.tsx`, `SpacingValuePopover.tsx`
- `src/overlay/sections/LayoutSection.tsx` (gap SliderRows)
- `src/overlay/sections/EffectsSection.tsx` (opacity SliderRow)
- `src/overlay/sections/BordersSection.tsx` (LabelScrub)

### Variable panel
- `src/overlay/variables/GlobalVariablesPanel.tsx`
- `src/overlay/variables/CollectionDetail.tsx` → ModeValueCell, DetailVariableRow
- `src/overlay/variables/CollectionSidebar.tsx`

### Engine
- `src/overlay/core/apply.ts` — applyStyle, resetProp, undo, redo, applyCustomProperty
- `src/overlay/variables/modeOverrides.ts` — mode-specific overrides
- `src/overlay/variables/discoverVariables.ts` — variable discovery
- `src/overlay/variables/colorVariables.ts` — parseVarRef
- `src/overlay/core/commitUtils.ts` — save path

### Existing tests
- `src/overlay/__tests__/tokenCollections.test.ts`
- `src/overlay/__tests__/` (all variable-related test files)
