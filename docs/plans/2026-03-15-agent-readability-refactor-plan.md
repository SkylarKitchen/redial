# Agent-Readability Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure `src/overlay/` from 103 flat files into 8 domain subdirectories, split `controls.tsx` into focused files, and create a DIRECTORY.md module map — making the codebase easy for Claude Code to navigate.

**Architecture:** Move files into `core/`, `controls/`, `sections/`, `shell/`, `variables/`, `overlays/`, `navigator/`, `hooks/` directories. Split `controls.tsx` (18 exports) into 12 individual files with a barrel `index.ts`. Update all import paths. Shared root files (`theme.ts`, `timing.ts`, etc.) stay put.

**Tech Stack:** TypeScript, React, git mv, npm run typecheck/test/build for verification.

**Design doc:** `docs/plans/2026-03-15-agent-readability-design.md`

---

## Task 1: Create directory structure and move `core/` files

**Files:**
- Create: `src/overlay/core/` (directory)
- Move: 11 files into `core/`

**Step 1: Create directory and move files**

```bash
mkdir -p src/overlay/core
cd src/overlay
git mv apply.ts core/
git mv infer.ts core/
git mv scope.ts core/
git mv statePreview.ts core/
git mv hmr.ts core/
git mv config.ts core/
git mv sourcemap.ts core/
git mv commitUtils.ts core/
git mv elementContext.ts core/
git mv scrubState.ts core/
git mv navigationHistory.ts core/
```

**Step 2: Fix internal imports within `core/`**

These core files import each other. After moving, their relative paths stay the same (all in `core/`), so no changes needed between them.

However, core files import root-level files. These paths change from `./` to `../`:

- `core/apply.ts`: `"./util"` → `"../util"`, `"./theme"` → `"../theme"`, etc.
- `core/infer.ts`: `"./scope"` stays `"./scope"` (both in core), but `"./theme"` → `"../theme"`
- `core/statePreview.ts`: `"./apply"` stays `"./apply"` (both in core)
- `core/commitUtils.ts`: `"./apply"` stays, `"./sourcemap"` stays, `"./scope"` stays (all in core)
- `core/elementContext.ts`: `"./sourcemap"` stays (both in core)
- `core/scrubState.ts`: no overlay imports

For each file in `core/`, update imports of root files: replace `from "./X"` with `from "../X"` for files that remain in the overlay root (theme, timing, util, panelUtils, panelConstants, panelStyles, etc.).

**Step 3: Fix external imports pointing to core files**

Every file outside `core/` that imports a core file needs path updates. The full list:

**apply.ts** (33 importers — the biggest):
- `Overlay.tsx`: `"./apply"` → `"./core/apply"`
- `controls.tsx`: `"./apply"` → `"./core/apply"`
- `BackgroundsSection.tsx`, `BordersSection.tsx`, `CSSVariablesSection.tsx`, `EffectsSection.tsx`, `LayoutSection.tsx`, `PositionSection.tsx`, `SizeSection.tsx`, `SpacingBoxModel.tsx`, `TypographySection.tsx`: `"./apply"` → `"./core/apply"`
- `Footer.tsx`, `SessionDrawer.tsx`: `"./apply"` → `"./core/apply"`
- `WebflowPanel.tsx`: `"./apply"` → `"./core/apply"`
- `GlobalVariablesPanel.tsx`: `"./apply"` → `"./core/apply"`
- `LabelScrub.tsx`: `"./apply"` → `"./core/apply"`
- `PropertyContextMenu.tsx`: `"./apply"` → `"./core/apply"`
- `panelUtils.ts`: `"./apply"` → `"./core/apply"`
- `tailwind.ts`: `"./apply"` → `"./core/apply"`
- `useWheelAdjust.ts`: `"./apply"` → `"./core/apply"`
- `__tests__/apply.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/layout-section-stale-indicator.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/spacing-indicator-after-reset.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/spacing-reset.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/panelUtils.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/size-reset.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/tailwind.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/layout-reset.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/variableLinking.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/transition-phantom-dirty.test.ts`: `"../apply"` → `"../core/apply"`
- `__tests__/variableManager.test.ts`: `"../apply"` → `"../core/apply"`

**scope.ts** (7 importers):
- `Overlay.tsx`, `WebflowPanel.tsx`, `Footer.tsx`, `Header.tsx`: `"./scope"` → `"./core/scope"`
- `__tests__/scope.test.ts`: `"../scope"` → `"../core/scope"`

**infer.ts** (5 importers):
- `Overlay.tsx`, `WebflowPanel.tsx`, `SpacingSection.tsx`: `"./infer"` → `"./core/infer"`
- `__tests__/infer.test.ts`, `__tests__/sections.test.ts`: `"../infer"` → `"../core/infer"`

**config.ts** (3 importers):
- `Overlay.tsx`, `Footer.tsx`, `SessionDrawer.tsx`: `"./config"` → `"./core/config"`

**sourcemap.ts** (5 importers):
- `PromptPanel.tsx`, `SessionDrawer.tsx`, `Header.tsx`: `"./sourcemap"` → `"./core/sourcemap"`
- `__tests__/sourcemap.test.ts`: `"../sourcemap"` → `"../core/sourcemap"`

**statePreview.ts** (3 importers):
- `Overlay.tsx`, `WebflowPanel.tsx`, `Footer.tsx`: `"./statePreview"` → `"./core/statePreview"`
- `__tests__/statePreview.test.ts`: `"../statePreview"` → `"../core/statePreview"`

**hmr.ts** (1 importer):
- `Overlay.tsx`: `"./hmr"` → `"./core/hmr"`

**scrubState.ts** (5 importers):
- `Overlay.tsx`, `LabelScrub.tsx`, `SpacingPreviewOverlay.tsx`, `SpacingBoxModel.tsx`, `SpacingGuidesOverlay.tsx`: `"./scrubState"` → `"./core/scrubState"`
- `__tests__/shortcuts.test.ts`, `__tests__/scrubState.test.ts`: `"../scrubState"` → `"../core/scrubState"`

**elementContext.ts** (1 importer):
- `PromptPanel.tsx`: `"./elementContext"` → `"./core/elementContext"`

**navigationHistory.ts** (1 importer):
- `__tests__/navigation.test.ts`: `"../navigationHistory"` → `"../core/navigationHistory"`

**commitUtils.ts** (2 importers):
- `Footer.tsx`, `Overlay.tsx`: `"./commitUtils"` → `"./core/commitUtils"`

**`src/index.tsx`** (public API — critical):
- `"./overlay/Overlay"` → no change yet (Overlay not moved until Task 4)
- `"./overlay/infer"` → `"./overlay/core/infer"`
- `"./overlay/scope"` → `"./overlay/core/scope"`
- `"./overlay/sourcemap"` → `"./overlay/core/sourcemap"`
- `"./overlay/config"` → `"./overlay/core/config"`

**Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS with 0 errors.

**Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move engine files into core/ subdirectory"
```

---

## Task 2: Move `hooks/` files

**Files:**
- Create: `src/overlay/hooks/` (directory)
- Move: 9 files

**Step 1: Create directory and move files**

```bash
mkdir -p src/overlay/hooks
cd src/overlay
git mv useClickOutside.ts hooks/
git mv useConversionHint.ts hooks/
git mv useDragReorder.ts hooks/
git mv useDropdownKeyboard.ts hooks/
git mv useElementTracker.ts hooks/
git mv useFocusTrap.ts hooks/
git mv usePortalDropdown.ts hooks/
git mv useSwatches.ts hooks/
git mv useWheelAdjust.ts hooks/
```

**Step 2: Fix internal imports within hooks**

`useWheelAdjust.ts` imports `from "./apply"` → now `from "../core/apply"` (apply already moved in Task 1).

Other hooks import root files only (theme, timing) — update `"./"` → `"../"`.

**Step 3: Fix external imports pointing to hook files**

Importers (source files, not yet moved — still at overlay root):
- `layoutControls.tsx`: `"./useClickOutside"` → `"./hooks/useClickOutside"`, `"./useDropdownKeyboard"` → `"./hooks/useDropdownKeyboard"`, `"./useWheelAdjust"` → `"./hooks/useWheelAdjust"`
- `LayoutSection.tsx`, `SizeSection.tsx`, `PositionSection.tsx`, `BordersSection.tsx`: `"./useConversionHint"` → `"./hooks/useConversionHint"`
- `GlobalVariablesPanel.tsx`, `BackgroundLayerList.tsx`, `ShadowEditor.tsx`, `TransitionEditor.tsx`, `FilterSliders.tsx`: `"./useDragReorder"` → `"./hooks/useDragReorder"`
- `Overlay.tsx`: `"./useElementTracker"` → `"./hooks/useElementTracker"`
- `GlobalVariablesPanel.tsx`, `EffectsSection.tsx`: `"./useFocusTrap"` → `"./hooks/useFocusTrap"`
- `PositionSelector.tsx`, `TextStyleRow.tsx`: `"./usePortalDropdown"` → `"./hooks/usePortalDropdown"`
- `layoutControls.tsx`: `"./useDropdownKeyboard"` → `"./hooks/useDropdownKeyboard"`
- `SizeInputCell.tsx`, `CornerRadiusEditor.tsx`: `"./useWheelAdjust"` → `"./hooks/useWheelAdjust"`
- `controls.tsx`: `"./useWheelAdjust"` → `"./hooks/useWheelAdjust"`, `"./usePortalDropdown"` → `"./hooks/usePortalDropdown"`

Test files:
- `__tests__/useClickOutside.test.ts`: `"../useClickOutside"` → `"../hooks/useClickOutside"`
- `__tests__/useConversionHint.test.ts`: `"../useConversionHint"` → `"../hooks/useConversionHint"`
- `__tests__/useDragReorder.test.ts`: `"../useDragReorder"` → `"../hooks/useDragReorder"`
- `__tests__/useDropdownKeyboard.test.ts`: `"../useDropdownKeyboard"` → `"../hooks/useDropdownKeyboard"`
- `__tests__/useFocusTrap.test.ts`: `"../useFocusTrap"` → `"../hooks/useFocusTrap"`
- `__tests__/usePortalDropdown.test.ts`, `__tests__/unitSelectorPortal.test.ts`: `"../usePortalDropdown"` → `"../hooks/usePortalDropdown"`
- `__tests__/useSwatches.test.ts`: `"../useSwatches"` → `"../hooks/useSwatches"`
- `__tests__/useWheelAdjust.test.ts`: `"../useWheelAdjust"` → `"../hooks/useWheelAdjust"`
- `__tests__/selectDropdownAudit.test.ts`: `"../useDropdownKeyboard"` → `"../hooks/useDropdownKeyboard"`

**Step 4: Typecheck + test**

```bash
npm run typecheck && npm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move hooks into hooks/ subdirectory"
```

---

## Task 3: Move `variables/` files

**Files:**
- Create: `src/overlay/variables/` (directory)
- Move: 5 files

**Step 1: Create directory and move files**

```bash
mkdir -p src/overlay/variables
cd src/overlay
git mv GlobalVariablesPanel.tsx variables/
git mv discoverVariables.ts variables/
git mv colorVariables.ts variables/
git mv autoCollections.ts variables/
git mv tokenCollections.ts variables/
```

**Step 2: Fix internal imports within variables/**

These files import each other (all stay relative within `variables/`):
- `GlobalVariablesPanel.tsx`: `"./tokenCollections"` → `"./tokenCollections"` (no change), `"./autoCollections"` → same, `"./discoverVariables"` → same
- `colorVariables.ts`: `"./discoverVariables"` → same
- `autoCollections.ts`: `"./discoverVariables"` → same

But they import root/core files — update `"./"` → `"../"` for root files, `"./apply"` → `"../core/apply"`, `"./hooks/..."` → `"../hooks/..."`.

Specifically for `GlobalVariablesPanel.tsx` (big file, many imports):
- `"./core/apply"` → `"../core/apply"` (apply moved in Task 1)
- `"./hooks/useDragReorder"` → `"../hooks/useDragReorder"` (moved in Task 2)
- `"./hooks/useFocusTrap"` → `"../hooks/useFocusTrap"` (moved in Task 2)
- All root imports (`theme`, `timing`, `panelConstants`, etc.): `"./"` → `"../"`
- `"./controls"` → `"../controls"` (controls not yet moved but will become `controls/index.ts` — for now keep as `"../controls"`)

**Step 3: Fix external imports pointing to variables files**

- `controls.tsx`: `"./colorVariables"` → `"./variables/colorVariables"`, `"./discoverVariables"` → `"./variables/discoverVariables"`
- `Overlay.tsx`: `"./GlobalVariablesPanel"` → `"./variables/GlobalVariablesPanel"`
- `CSSVariablesSection.tsx`: `"./discoverVariables"` → `"./variables/discoverVariables"`
- `GradientEditor.tsx`, `ShadowEditor.tsx`: `"./colorVariables"` → `"./variables/colorVariables"`

Test files:
- `__tests__/discoverVariables.test.ts`: `"../discoverVariables"` → `"../variables/discoverVariables"`
- `__tests__/aliasDetection.test.ts`: `"../discoverVariables"` → `"../variables/discoverVariables"`
- `__tests__/varReferences.test.ts`: `"../discoverVariables"` → `"../variables/discoverVariables"`
- `__tests__/groupByPrefix.test.ts`: `"../discoverVariables"` → `"../variables/discoverVariables"`
- `__tests__/autoCollections.test.ts`: `"../autoCollections"` → `"../variables/autoCollections"`
- `__tests__/tokenCollections.test.ts`: `"../tokenCollections"` → `"../variables/tokenCollections"`
- `__tests__/colorVariables.test.ts`: `"../colorVariables"` → `"../variables/colorVariables"`
- `__tests__/variableLinking.test.ts`: `"../colorVariables"` → `"../variables/colorVariables"`
- `__tests__/variableManager.test.ts`: `"../discoverVariables"` → `"../variables/discoverVariables"`, `"../tokenCollections"` → `"../variables/tokenCollections"`, `"../autoCollections"` → `"../variables/autoCollections"`

**Step 4: Typecheck + test**

```bash
npm run typecheck && npm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move variable system into variables/ subdirectory"
```

---

## Task 4: Move `overlays/` and `navigator/` files

**Files:**
- Create: `src/overlay/overlays/`, `src/overlay/navigator/` (directories)
- Move: 5 + 3 = 8 files

**Step 1: Create directories and move files**

```bash
mkdir -p src/overlay/overlays src/overlay/navigator
cd src/overlay
git mv BoxModelOverlay.tsx overlays/
git mv GridOverlay.tsx overlays/
git mv FlexGapOverlay.tsx overlays/
git mv SpacingGuidesOverlay.tsx overlays/
git mv SpacingPreviewOverlay.tsx overlays/
git mv NavigatorPanel.tsx navigator/
git mv NavigatorNode.tsx navigator/
git mv navigatorFilter.ts navigator/
```

**Step 2: Fix internal imports**

Overlays: No cross-imports. Update root imports `"./"` → `"../"`. Update core imports `"./core/"` → `"../core/"`.

Specifically:
- `SpacingGuidesOverlay.tsx`: `"./core/scrubState"` → `"../core/scrubState"`
- `SpacingPreviewOverlay.tsx`: `"./core/scrubState"` → `"../core/scrubState"`
- All overlays: `"./theme"` → `"../theme"`

Navigator:
- `NavigatorPanel.tsx` → `NavigatorNode.tsx`: stays `"./NavigatorNode"` (both in navigator/)
- `NavigatorNode.tsx` → `navigatorFilter.ts`: stays `"./navigatorFilter"` (both in navigator/)
- Root imports: `"./"` → `"../"`

**Step 3: Fix external imports**

All 5 overlays are imported only by `Overlay.tsx`:
- `"./BoxModelOverlay"` → `"./overlays/BoxModelOverlay"`
- `"./GridOverlay"` → `"./overlays/GridOverlay"`
- `"./FlexGapOverlay"` → `"./overlays/FlexGapOverlay"`
- `"./SpacingGuidesOverlay"` → `"./overlays/SpacingGuidesOverlay"`
- `"./SpacingPreviewOverlay"` → `"./overlays/SpacingPreviewOverlay"`

Navigator:
- `Overlay.tsx`: `"./NavigatorPanel"` → `"./navigator/NavigatorPanel"` (if imported)

Test files:
- `__tests__/navigatorFilter.test.ts`: `"../navigatorFilter"` → `"../navigator/navigatorFilter"`

**Step 4: Typecheck + test**

```bash
npm run typecheck && npm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move overlays and navigator into subdirectories"
```

---

## Task 5: Move `sections/` files

**Files:**
- Create: `src/overlay/sections/` (directory)
- Move: 26 files

**Step 1: Create directory and move files**

```bash
mkdir -p src/overlay/sections
cd src/overlay
git mv LayoutSection.tsx sections/
git mv layoutControls.tsx sections/
git mv AlignBox.tsx sections/
git mv SpacingSection.tsx sections/
git mv SpacingBoxModel.tsx sections/
git mv SpacingValuePopover.tsx sections/
git mv SizeSection.tsx sections/
git mv SizeInputCell.tsx sections/
git mv PositionSection.tsx sections/
git mv PositionOffsetDiagram.tsx sections/
git mv PositionSelector.tsx sections/
git mv TypographySection.tsx sections/
git mv TextStyleRow.tsx sections/
git mv BackgroundsSection.tsx sections/
git mv BackgroundLayerList.tsx sections/
git mv GradientEditor.tsx sections/
git mv BordersSection.tsx sections/
git mv CornerRadiusEditor.tsx sections/
git mv EffectsSection.tsx sections/
git mv ShadowEditor.tsx sections/
git mv TransformEditor.tsx sections/
git mv TransformOriginPicker.tsx sections/
git mv TransitionEditor.tsx sections/
git mv BezierEditor.tsx sections/
git mv FilterSliders.tsx sections/
git mv CSSVariablesSection.tsx sections/
```

**Step 2: Fix internal imports within sections/**

Intra-section imports stay relative (e.g., LayoutSection → layoutControls, AlignBox). No path changes for files importing each other within `sections/`.

Cross-directory imports need updating (all now one level deeper):
- Root files (`theme`, `timing`, `panelConstants`, `panelUtils`, `panelStyles`, `util`, `webflowIcons`, `cssParsers`, `colorUtils`, `inputMath`, `parseValueWithUnit`, `unitConversion`, `textStyleScanner`, `getAuthoredValue`, `cssImport`): `"./"` → `"../"`
- Core files: `"./core/"` → `"../core/"`
- Hook files: `"./hooks/"` → `"../hooks/"`
- Variable files: `"./variables/"` → `"../variables/"`
- Controls: `"./controls"` → `"../controls"` (will resolve to `controls/index.ts` after Task 7)

Each section file has many imports. Use find-and-replace within `sections/` directory:
- `from "./core/` → `from "../core/`
- `from "./hooks/` → `from "../hooks/`
- `from "./variables/` → `from "../variables/`
- For root files: `from "./theme"` → `from "../theme"`, etc. — do each root file individually.

**Step 3: Fix external imports pointing to section files**

The primary importer of section files is `WebflowPanel.tsx` (still at overlay root for now):
- `"./LayoutSection"` → `"./sections/LayoutSection"`
- `"./SpacingSection"` → `"./sections/SpacingSection"`
- `"./SizeSection"` → `"./sections/SizeSection"`
- `"./PositionSection"` → `"./sections/PositionSection"`
- `"./TypographySection"` → `"./sections/TypographySection"`
- `"./BackgroundsSection"` → `"./sections/BackgroundsSection"`
- `"./BordersSection"` → `"./sections/BordersSection"`
- `"./EffectsSection"` → `"./sections/EffectsSection"`
- `"./CSSVariablesSection"` → `"./sections/CSSVariablesSection"`
- `"./PropertyContextMenu"` stays (PropertyContextMenu is in shell, not sections)

Other importers:
- `DragHandle.tsx` is imported by `BackgroundLayerList`, `FilterSliders`, `ShadowEditor`, `TransitionEditor` — DragHandle will move to `shell/` in Task 6. After both moves: `"./DragHandle"` → `"../shell/DragHandle"`

Test files (all in `__tests__/`):
- `__tests__/sections.test.ts`: update all section imports `"../"` → `"../sections/"`
- `__tests__/alignBox.test.tsx`, `__tests__/alignBoxStretch.test.ts`: `"../AlignBox"` → `"../sections/AlignBox"`
- `__tests__/spacingPopoverPresets.test.ts`: `"../SpacingBoxModel"` → `"../sections/SpacingBoxModel"`, `"../SpacingValuePopover"` → `"../sections/SpacingValuePopover"`
- `__tests__/spacingShiftMidDrag.test.ts`: `"../SpacingBoxModel"` → `"../sections/SpacingBoxModel"`
- `__tests__/selectDropdownAudit.test.ts`: `"../PositionSelector"` → `"../sections/PositionSelector"`
- `__tests__/transition-menu.test.ts`: `"../TransitionEditor"` → `"../sections/TransitionEditor"`
- Various other test files that import section files — update `"../"` to `"../sections/"` for each.

**Step 4: Typecheck + test**

```bash
npm run typecheck && npm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move panel sections into sections/ subdirectory"
```

---

## Task 6: Move `shell/` files

**Files:**
- Create: `src/overlay/shell/` (directory)
- Move: 17 files

**Step 1: Create directory and move files**

```bash
mkdir -p src/overlay/shell
cd src/overlay
git mv Overlay.tsx shell/
git mv Header.tsx shell/
git mv Footer.tsx shell/
git mv Toolbar.tsx shell/
git mv WebflowPanel.tsx shell/
git mv CommandPalette.tsx shell/
git mv PropertySearch.tsx shell/
git mv ShortcutsHelp.tsx shell/
git mv ContextMenu.tsx shell/
git mv PropertyContextMenu.tsx shell/
git mv HistoryDrawer.tsx shell/
git mv SessionDrawer.tsx shell/
git mv PromptPanel.tsx shell/
git mv Selector.tsx shell/
git mv StateSelector.tsx shell/
git mv ViewportBar.tsx shell/
git mv DragHandle.tsx shell/
```

**Step 2: Fix internal imports within shell/**

Shell files import each other heavily (Overlay imports Header, Footer, WebflowPanel, etc.). These stay relative within `shell/`.

Cross-directory imports need updating:
- Root files: `"./"` → `"../"`
- Core files: `"./core/"` → `"../core/"`
- Hook files: `"./hooks/"` → `"../hooks/"`
- Section files: `"./sections/"` → `"../sections/"`
- Variable files: `"./variables/"` → `"../variables/"`
- Overlay files: `"./overlays/"` → `"../overlays/"`
- Navigator files: `"./navigator/"` → `"../navigator/"`
- Controls: `"./controls"` → `"../controls"`

Key file: `Overlay.tsx` has the most imports (~40 import lines). Carefully update every import.

**Step 3: Fix external imports pointing to shell files**

- `src/index.tsx`: `"./overlay/Overlay"` → `"./overlay/shell/Overlay"`
- `src/index.tsx`: `"./overlay/core/config"` → stays (config already at core/)
- `Toolbar.tsx` imports from `Overlay.tsx` (type: ActivePanel) — both in shell, no change
- `DragHandle.tsx` imported by section files (`BackgroundLayerList`, `FilterSliders`, `ShadowEditor`, `TransitionEditor`) — these are in `sections/`, so: `"./DragHandle"` → `"../shell/DragHandle"` (already handled if sections moved first)

Test files:
- `__tests__/toolbarAiButton.test.ts`: `"../Overlay"` → `"../shell/Overlay"`
- `__tests__/footer.test.tsx`: `"../Footer"` → `"../shell/Footer"`
- Other test files importing shell components — update `"../"` to `"../shell/"`

**Step 4: Typecheck + test**

```bash
npm run typecheck && npm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move panel shell into shell/ subdirectory"
```

---

## Task 7: Split `controls.tsx` into `controls/` directory

This is the most complex task. `controls.tsx` is now at `src/overlay/controls.tsx` with 18 exports across 1414 lines. We split it into individual files inside a new `controls/` directory, with a barrel `index.ts` that preserves the existing import API.

**Files:**
- Delete: `src/overlay/controls.tsx`
- Create: `src/overlay/controls/` directory with 13 files

**Step 1: Create controls directory**

```bash
mkdir -p src/overlay/controls
```

**Step 2: Create `controls/helpers.ts`**

Extract: `useValueFlash` (lines 34-53), `selectAllOnDoubleClick` (lines 68-70), shared styles `labelStyle`/`rowBase` (lines 72-115), `SectionMemoryContext`/`SectionMemoryProvider` context (lines 117-135), `useResetPopover` (lines 397-411), `PresetChips` (lines 352-395), and the exported types (`SpacingSide`, `SpacingProperty`, `SpacingUnit`, `EditableValueProps`).

This file contains the shared utilities that other control components import internally.

Imports needed:
```typescript
import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { type IndicatorType, indicatorStyle, altClickReset, labelIndicator, labelHighlight } from "../theme";
import { color, text, border, font, layout, primaryAlpha, presets, presetBaseUnit } from "../theme";
import { ms } from "../timing";
import { ResetPopover } from "../ResetPopover";
import { convertPresets } from "../panelUtils";
```

**Step 3: Create `controls/Section.tsx`**

Extract: `Section` component (lines 139-251).

Imports:
```typescript
import React, { useCallback, useRef, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { SectionMemoryContext } from "./helpers";
import { color, text, border, surface, font, shadow, layout } from "../theme";
import { ms } from "../timing";
```

**Step 4: Create `controls/ValueInput.tsx`**

Extract: `ValueInput` component (lines 255-350).

Imports:
```typescript
import React, { useState, useCallback, useRef, useEffect } from "react";
import { UnitSelector, type ConversionHint } from "../UnitSelector";
import { evaluateMathExpr } from "../inputMath";
import { selectAllOnDoubleClick, useValueFlash } from "./helpers";
import { color, text, border, surface, font, layout, primaryAlpha } from "../theme";
import { ms } from "../timing";
```

**Step 5: Create `controls/SliderRow.tsx`**

Extract: `SliderRow` component (lines 414-540).

Imports:
```typescript
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { LabelScrub } from "../LabelScrub";
import { UnitSelector, type ConversionHint } from "../UnitSelector";
import { ComputedTooltip } from "../ComputedTooltip";
import { ValueInput } from "./ValueInput";
import { labelStyle, rowBase, useResetPopover, PresetChips } from "./helpers";
import { type IndicatorType } from "../theme";
import { color, text, border, surface, font, layout, primaryAlpha } from "../theme";
import { getIndicatorTitle } from "../panelUtils";
import { ms } from "../timing";
```

**Step 6: Create `controls/SelectRow.tsx`**

Extract: `SelectRow` component and `SearchableSelect` (lines 544-826).

Imports:
```typescript
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { ChevronDown } from "lucide-react";
import { LabelScrub } from "../LabelScrub";
import { ComputedTooltip } from "../ComputedTooltip";
import { labelStyle, rowBase, useResetPopover } from "./helpers";
import { type IndicatorType, indicatorStyle } from "../theme";
import { color, text, border, surface, font, shadow, layout, blackAlpha, zIndex } from "../theme";
import { getIndicatorTitle } from "../panelUtils";
import { ms } from "../timing";
import { usePortalDropdown } from "../hooks/usePortalDropdown";
```

**Step 7: Create `controls/ColorRow.tsx`**

Extract: `ColorRow` component (lines 865-1082).

Imports:
```typescript
import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link2, Unlink, X } from "lucide-react";
import { ColorPickerEnhanced } from "../ColorPickerEnhanced";
import { VariablePicker } from "../VariablePicker";
import { LabelScrub } from "../LabelScrub";
import { ComputedTooltip } from "../ComputedTooltip";
import { hexToRgba } from "../colorUtils";
import { parseVarRef, resolveVarColor } from "../variables/colorVariables";
import { parseVarAlias } from "../variables/discoverVariables";
import { beginBatch, endBatch } from "../core/apply";
import { labelStyle, rowBase, useResetPopover } from "./helpers";
import { type IndicatorType, indicatorStyle, checkerboard } from "../theme";
import { color, text, border, surface, font, layout, primaryAlpha, zIndex } from "../theme";
import { getIndicatorTitle } from "../panelUtils";
import { ms } from "../timing";
```

**Step 8: Create `controls/TextRow.tsx`**

Extract: `TextRow` component (lines 1086-1128).

**Step 9: Create `controls/NumberRow.tsx`**

Extract: `NumberRow` component (lines 1132-1180).

**Step 10: Create `controls/EditableValue.tsx`**

Extract: `EditableValue` memo component (lines 1183-1293).

**Step 11: Create `controls/SubSectionHeader.tsx`**

Extract: `SubSectionHeader` component (lines 1298-1352).

**Step 12: Create `controls/EditorRemoveButton.tsx`**

Extract: `EditorRemoveButton` component (lines 1356-1389).

**Step 13: Create `controls/VisibilityToggle.tsx`**

Extract: `VisibilityToggle` component (lines 1393-1414).

**Step 14: Create barrel `controls/index.ts`**

```typescript
// Barrel re-export — preserves existing `import { X } from "./controls"` API
export { useValueFlash, selectAllOnDoubleClick, useResetPopover } from "./helpers";
export { SectionMemoryProvider } from "./helpers";
export type { SpacingSide, SpacingProperty, SpacingUnit, EditableValueProps } from "./helpers";
export { Section } from "./Section";
export { ValueInput } from "./ValueInput";
export { SliderRow } from "./SliderRow";
export { SelectRow } from "./SelectRow";
export { ColorRow } from "./ColorRow";
export { TextRow } from "./TextRow";
export { NumberRow } from "./NumberRow";
export { EditableValue } from "./EditableValue";
export { SubSectionHeader } from "./SubSectionHeader";
export { EditorRemoveButton } from "./EditorRemoveButton";
export { VisibilityToggle } from "./VisibilityToggle";
```

**Step 15: Delete original `controls.tsx`**

```bash
rm src/overlay/controls.tsx
```

All 21 files that `import { ... } from "./controls"` will now resolve to `controls/index.ts` — zero consumer changes needed.

**Step 16: Typecheck + test**

```bash
npm run typecheck && npm test
```

**Step 17: Commit**

```bash
git add -A
git commit -m "refactor: split controls.tsx into individual files in controls/"
```

---

## Task 8: Move remaining control primitives into `controls/`

Several standalone control component files should also live in `controls/`:

**Files to move:**
- `LabelScrub.tsx` → `controls/LabelScrub.tsx`
- `UnitSelector.tsx` → `controls/UnitSelector.tsx`
- `ColorPickerEnhanced.tsx` → `controls/ColorPickerEnhanced.tsx`
- `ComputedTooltip.tsx` → `controls/ComputedTooltip.tsx`
- `ResetPopover.tsx` → `controls/ResetPopover.tsx`
- `SegmentedControl.tsx` → `controls/SegmentedControl.tsx`
- `WebflowSegmentedControl.tsx` → `controls/WebflowSegmentedControl.tsx`
- `IconButtonGroup.tsx` → `controls/IconButtonGroup.tsx`
- `SideSelector.tsx` → `controls/SideSelector.tsx`
- `VariablePicker.tsx` → `controls/VariablePicker.tsx`

**Step 1: Move files**

```bash
cd src/overlay
git mv LabelScrub.tsx controls/
git mv UnitSelector.tsx controls/
git mv ColorPickerEnhanced.tsx controls/
git mv ComputedTooltip.tsx controls/
git mv ResetPopover.tsx controls/
git mv SegmentedControl.tsx controls/
git mv WebflowSegmentedControl.tsx controls/
git mv IconButtonGroup.tsx controls/
git mv SideSelector.tsx controls/
git mv VariablePicker.tsx controls/
```

**Step 2: Fix imports within moved files**

Each moved file's imports of root/core/hook/variable/section files need path updates: `"./"` → `"../"`, `"./core/"` → `"../core/"`, etc.

**Step 3: Fix imports within `controls/` split files**

The files created in Task 7 (SliderRow, ColorRow, etc.) import these control primitives with `"../"` paths (e.g., `from "../LabelScrub"`). Now they're siblings: `"../LabelScrub"` → `"./LabelScrub"`.

**Step 4: Fix external imports**

Every file outside `controls/` that imports these files needs `"./X"` → `"./controls/X"`:
- `LabelScrub.tsx` imported by: section files (now in `sections/`), so `"./LabelScrub"` → `"../controls/LabelScrub"` in section files.
- `UnitSelector.tsx` imported by: section files, `layoutControls.tsx`.
- `ColorPickerEnhanced.tsx` imported by: controls (already internal).
- etc.

Update barrel `controls/index.ts` to also re-export these moved files if they were previously imported via other paths.

**Step 5: Typecheck + test**

```bash
npm run typecheck && npm test
```

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move control primitives into controls/ subdirectory"
```

---

## Task 9: Create DIRECTORY.md module map

**Files:**
- Create: `src/overlay/DIRECTORY.md`

**Step 1: Write DIRECTORY.md**

Create the file with tables for each directory. Use the actual exports discovered during the refactor. Include:
- `core/` — File, Purpose, Key exports
- `controls/` — File, Purpose, Key exports, Used by
- `sections/` — File, Section, Sub-editors
- `shell/` — File, Purpose
- `variables/` — File, Purpose, Key exports
- `overlays/` — File, Purpose
- `navigator/` — File, Purpose
- `hooks/` — File, Purpose, Used by
- Root files — File, Purpose

**Step 2: Commit**

```bash
git add src/overlay/DIRECTORY.md
git commit -m "docs: add DIRECTORY.md module map for agent navigation"
```

---

## Task 10: Update CLAUDE.md and verify everything

**Step 1: Update CLAUDE.md**

Ensure the "Navigating the Codebase" section references the new directory structure. The "Quick Lookup by Task" table should use the new paths (e.g., `src/overlay/core/apply.ts` instead of `src/overlay/apply.ts`).

**Step 2: Full verification**

```bash
npm run typecheck && npm test && npm run build
```

All three must pass.

**Step 3: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "docs: update CLAUDE.md paths to match new directory structure"
```

---

## Execution Order & Dependencies

```
Task 1 (core/)
  ↓
Task 2 (hooks/) — depends on Task 1 (hooks import from core/)
  ↓
Task 3 (variables/) — depends on Tasks 1, 2
  ↓
Task 4 (overlays/ + navigator/) — depends on Task 1
  ↓
Task 5 (sections/) — depends on Tasks 1, 2, 3
  ↓
Task 6 (shell/) — depends on Tasks 1, 2, 3, 4, 5
  ↓
Task 7 (split controls.tsx) — depends on Tasks 1, 2, 3
  ↓
Task 8 (move control primitives) — depends on Task 7
  ↓
Task 9 (DIRECTORY.md) — depends on all moves complete
  ↓
Task 10 (CLAUDE.md + verify) — depends on Task 9
```

Each task is independently committable and verifiable. If any task breaks typecheck/tests, fix before proceeding.
