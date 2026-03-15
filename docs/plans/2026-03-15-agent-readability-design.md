---
date: 2026-03-15
topic: agent-readability-refactor
approach: B (directory restructure + file splitting)
---

# Agent-Readability Refactor — Design

> Make the Redial codebase easy for Claude Code to navigate, understand, and modify.

## Problem

187 files in a flat `src/overlay/` directory. 6 files over 800 lines. `controls.tsx` exports 18 components. An agent asked to "fix the gap slider" must grep through all 187 files, then read hundreds of lines to find the relevant code.

## Solution

Three structural changes:

1. **Subdirectories by domain** — 8 directories matching the codebase's natural boundaries
2. **Split `controls.tsx`** — 18 exports → 12 focused files with a barrel re-export
3. **Module map** — `src/overlay/DIRECTORY.md` as the agent's table of contents

## Non-Goals

- Rearchitecting internal state management
- Adding TypeScript interface contracts at module boundaries
- Splitting `Overlay.tsx`, `GlobalVariablesPanel.tsx`, `apply.ts`, or `layoutControls.tsx` (each is cohesive enough as-is)

---

## 1. Directory Structure

```
src/overlay/
├── core/              # Engine — no UI
│   ├── apply.ts              (inline style engine, undo/redo, session persistence)
│   ├── infer.ts              (DOM element → section config via getComputedStyle)
│   ├── scope.ts              (CSS Module class scoping)
│   ├── statePreview.ts       (pseudo-state :hover/:focus preview)
│   ├── hmr.ts                (HMR bridge)
│   ├── config.ts             (runtime config)
│   ├── sourcemap.ts          (source map resolution)
│   ├── commitUtils.ts        (commit prep)
│   ├── elementContext.ts      (selected element context)
│   ├── scrubState.ts         (global drag state)
│   └── navigationHistory.ts
│
├── controls/          # Shared UI primitives (split from controls.tsx)
│   ├── Section.tsx           (collapsible section wrapper)
│   ├── ValueInput.tsx        (numeric input w/ math, units)
│   ├── SliderRow.tsx         (label + slider + input)
│   ├── SelectRow.tsx         (label + dropdown, with SearchableSelect)
│   ├── ColorRow.tsx          (color swatch + picker + variable linking)
│   ├── TextRow.tsx           (text input row)
│   ├── NumberRow.tsx         (number-only row)
│   ├── EditableValue.tsx     (inline editable number)
│   ├── SubSectionHeader.tsx
│   ├── EditorRemoveButton.tsx
│   ├── VisibilityToggle.tsx
│   ├── helpers.ts            (useValueFlash, useResetPopover, selectAllOnDoubleClick, shared styles)
│   ├── index.ts              (barrel — re-exports everything)
│   ├── LabelScrub.tsx
│   ├── UnitSelector.tsx
│   ├── ColorPickerEnhanced.tsx
│   ├── ComputedTooltip.tsx
│   ├── ResetPopover.tsx
│   ├── SegmentedControl.tsx
│   ├── WebflowSegmentedControl.tsx
│   ├── IconButtonGroup.tsx
│   ├── SideSelector.tsx
│   └── VariablePicker.tsx
│
├── sections/          # 8 panel sections + sub-editors
│   ├── LayoutSection.tsx
│   ├── layoutControls.tsx    (RowLabel, DisplayTabs, DirectionRow, GapRow, etc.)
│   ├── AlignBox.tsx
│   ├── SpacingSection.tsx
│   ├── SpacingBoxModel.tsx
│   ├── SpacingValuePopover.tsx
│   ├── SizeSection.tsx
│   ├── SizeInputCell.tsx
│   ├── PositionSection.tsx
│   ├── PositionOffsetDiagram.tsx
│   ├── PositionSelector.tsx
│   ├── TypographySection.tsx
│   ├── TextStyleRow.tsx
│   ├── BackgroundsSection.tsx
│   ├── BackgroundLayerList.tsx
│   ├── GradientEditor.tsx
│   ├── BordersSection.tsx
│   ├── CornerRadiusEditor.tsx
│   ├── EffectsSection.tsx
│   ├── ShadowEditor.tsx
│   ├── TransformEditor.tsx
│   ├── TransformOriginPicker.tsx
│   ├── TransitionEditor.tsx
│   ├── BezierEditor.tsx
│   ├── FilterSliders.tsx
│   ├── CSSVariablesSection.tsx
│   └── index.ts              (barrel — exports all *Section components)
│
├── shell/             # Panel frame / chrome
│   ├── Overlay.tsx           (main entry point — lifecycle orchestrator)
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Toolbar.tsx
│   ├── WebflowPanel.tsx      (section orchestrator)
│   ├── CommandPalette.tsx
│   ├── PropertySearch.tsx
│   ├── ShortcutsHelp.tsx
│   ├── ContextMenu.tsx
│   ├── PropertyContextMenu.tsx
│   ├── HistoryDrawer.tsx
│   ├── SessionDrawer.tsx
│   ├── PromptPanel.tsx
│   ├── Selector.tsx
│   ├── StateSelector.tsx
│   ├── ViewportBar.tsx
│   └── DragHandle.tsx
│
├── variables/         # Variable/token system
│   ├── GlobalVariablesPanel.tsx
│   ├── discoverVariables.ts
│   ├── colorVariables.ts
│   ├── autoCollections.ts
│   ├── tokenCollections.ts
│   └── index.ts
│
├── overlays/          # Visual overlays drawn on the page
│   ├── BoxModelOverlay.tsx
│   ├── GridOverlay.tsx
│   ├── FlexGapOverlay.tsx
│   ├── SpacingGuidesOverlay.tsx
│   └── SpacingPreviewOverlay.tsx
│
├── navigator/         # Navigator panel (DOM tree view)
│   ├── NavigatorPanel.tsx
│   ├── NavigatorNode.tsx
│   └── navigatorFilter.ts
│
├── hooks/             # All use*.ts hooks
│   ├── useClickOutside.ts
│   ├── useConversionHint.ts
│   ├── useDragReorder.ts
│   ├── useDropdownKeyboard.ts
│   ├── useElementTracker.ts
│   ├── useFocusTrap.ts
│   ├── usePortalDropdown.ts
│   ├── useSwatches.ts
│   └── useWheelAdjust.ts
│
├── theme.ts              # Single source of truth for design tokens
├── timing.ts             # Canonical timing tokens
├── panelConstants.tsx    # Dropdown options, enums
├── panelStyles.ts        # Shared inline style objects
├── panelUtils.ts         # Formatters, indicator helpers
├── util.ts               # Breadcrumb, selectors, formatCSSDiff
├── webflowIcons.tsx      # SVG icon components
├── cssImport.ts          # CSS text parser
├── cssParsers.ts         # Shadow/gradient/transform parsers
├── tailwind.ts           # Tailwind export formatter
├── colorUtils.ts         # hex/rgba conversion
├── inputMath.ts          # Math expression evaluator
├── parseValueWithUnit.ts # "12px" → { value: 12, unit: "px" }
├── unitConversion.ts     # px↔rem↔em conversion
├── textStyleScanner.ts   # Text style detection
├── getAuthoredValue.ts   # Authored vs computed value resolution
├── DIRECTORY.md          # Machine-readable module map
└── __tests__/            # All test files (stays flat)
```

### What stays at root and why

`theme.ts`, `timing.ts`, `util.ts`, `panelConstants.tsx`, `panelStyles.ts`, `panelUtils.ts`, `webflowIcons.tsx`, and the utility files are imported across every domain. Nesting them would add `../` noise to every import path.

---

## 2. File Splitting

Only `controls.tsx` (1414 lines, 18 exports) gets split. The other 5 mega-files stay intact:

| File | Lines | Action | Rationale |
|------|-------|--------|-----------|
| `controls.tsx` | 1414 | **Split into 12 files** in `controls/` | 18 exports, used by 21 files. Too many concerns in one file. |
| `Overlay.tsx` | 1825 | Move to `shell/` | One cohesive lifecycle orchestrator. Splitting scatters state machine. |
| `GlobalVariablesPanel.tsx` | 1505 | Move to `variables/` | One cohesive panel. Directory placement provides context. |
| `layoutControls.tsx` | 1215 | Move to `sections/` | Layout-specific sub-components, single consumer. |
| `apply.ts` | 1118 | Move to `core/` | Well-structured engine. Splitting breaks transactional undo integrity. |
| `ColorPickerEnhanced.tsx` | 874 | Move to `controls/` | Self-contained component. |

### controls.tsx split detail

| New File | Exports | ~Lines |
|----------|---------|--------|
| `Section.tsx` | Section, SectionMemoryProvider | 120 |
| `ValueInput.tsx` | ValueInput | 150 |
| `SliderRow.tsx` | SliderRow | 130 |
| `SelectRow.tsx` | SelectRow (+ SearchableSelect) | 320 |
| `ColorRow.tsx` | ColorRow | 220 |
| `TextRow.tsx` | TextRow | 50 |
| `NumberRow.tsx` | NumberRow | 50 |
| `EditableValue.tsx` | EditableValue | 120 |
| `SubSectionHeader.tsx` | SubSectionHeader | 60 |
| `EditorRemoveButton.tsx` | EditorRemoveButton | 40 |
| `VisibilityToggle.tsx` | VisibilityToggle | 30 |
| `helpers.ts` | useValueFlash, useResetPopover, selectAllOnDoubleClick, shared styles | 120 |
| `index.ts` | Re-exports all of the above | 20 |

---

## 3. Module Map (DIRECTORY.md)

`src/overlay/DIRECTORY.md` — machine-readable table of contents.

Each directory gets a table with columns:
- **File** — filename
- **Purpose** — one-line description
- **Key exports** — the functions/components an agent would grep for
- **Used by** (for controls/) — blast radius of changes

CLAUDE.md already references this file: `"Full file directory: src/overlay/DIRECTORY.md — read this first for any task."`

---

## 4. Import Migration Strategy

### controls.tsx → Barrel re-export (zero consumer changes)

`controls/index.ts` re-exports all 18 symbols. Existing `import { X } from "./controls"` resolves to `controls/index.ts` automatically. No consumer changes needed.

### Moved files → Mechanical path updates

Files that move into subdirectories get their import paths updated in one pass per file. Example:

```typescript
// Before
import { undo, redo } from "./apply";
// After
import { undo, redo } from "./core/apply";
```

### Root files → No changes

`theme.ts`, `timing.ts`, `util.ts`, etc. stay put. Their importers don't change.

### Test files

Tests in `__tests__/` update relative paths in the same pass. Tests stay flat.

### Verification

After all moves:
1. `npm run typecheck` — catches broken imports
2. `npm test` — catches runtime breakage
3. `npm run build` — confirms package compiles
