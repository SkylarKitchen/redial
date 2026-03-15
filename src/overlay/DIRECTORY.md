# src/overlay/ — Module Map

> Machine-readable table of contents. Read this first for any task.

## Directory Layout

```
src/overlay/
  core/        Engine — style application, undo/redo, inference, scoping (no UI)
  controls/    Shared UI primitives — Section, SliderRow, SelectRow, ColorRow, etc.
  sections/    8 panel sections + sub-editors (Layout, Spacing, Size, etc.)
  shell/       Panel frame — Overlay entry point, Header, Footer, Toolbar, drawers
  variables/   Variable/token discovery, linking, and collections
  overlays/    Visual overlays drawn on the page (box model, grid, spacing guides)
  navigator/   Navigator panel (DOM tree view, drag-to-reorder)
  hooks/       All use*.ts hooks
  (root)       Shared utilities imported across all domains
```

---

## core/ — Engine (no UI)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `apply.ts` | Inline style overrides, undo/redo stack, session persistence, diff tracking | `applyStyle`, `resetProp`, `undo`, `redo`, `beginBatch`, `endBatch`, `pushDomMove` |
| `infer.ts` | DOM element → section config via `getComputedStyle` | `inferSections`, `SectionCtx` |
| `scope.ts` | CSS Module class scoping | `getScopeInfo`, `ScopeInfo` |
| `statePreview.ts` | Pseudo-state (:hover/:focus) preview | `activateState`, `deactivateState` |
| `hmr.ts` | HMR bridge — re-infers on hot reload | `setupHMR` |
| `config.ts` | Runtime configuration | `getConfig`, `RedialConfig` |
| `sourcemap.ts` | Source map resolution for file writes | `resolveSourceFile` |
| `commitUtils.ts` | Commit preparation (diff → file write payload) | `prepareCommit` |
| `elementContext.ts` | Selected element metadata | `getElementContext` |
| `scrubState.ts` | Global drag/scrub state | `scrubState` |
| `navigationHistory.ts` | Element selection history | `pushHistory`, `popHistory` |

## controls/ — Shared UI Primitives

| File | Purpose | Key Exports | Used By |
|------|---------|-------------|---------|
| `Section.tsx` | Collapsible section wrapper | `Section` | All *Section.tsx |
| `ValueInput.tsx` | Numeric input with math expressions, units | `ValueInput` | SliderRow, sections |
| `SliderRow.tsx` | Label + slider + input row | `SliderRow` | All sections |
| `SelectRow.tsx` | Label + dropdown (with SearchableSelect) | `SelectRow` | All sections |
| `ColorRow.tsx` | Color swatch + picker + variable linking | `ColorRow` | Typography, Backgrounds, Borders, Effects |
| `TextRow.tsx` | Text input row | `TextRow` | Size, Layout |
| `NumberRow.tsx` | Number-only input row | `NumberRow` | Position, Effects |
| `EditableValue.tsx` | Inline editable number (memo) | `EditableValue` | SpacingBoxModel, PositionOffsetDiagram |
| `SubSectionHeader.tsx` | Section sub-header with indicator | `SubSectionHeader` | Effects, Backgrounds, Typography |
| `EditorRemoveButton.tsx` | Remove button for list editors | `EditorRemoveButton` | Shadow, Transform, Transition, Filter |
| `VisibilityToggle.tsx` | Eye toggle for list items | `VisibilityToggle` | Shadow, Filter, Transition, BackgroundLayer |
| `helpers.tsx` | Shared hooks/styles: useValueFlash, useResetPopover, PresetChips, labelStyle | (internal) | Other controls/ files |
| `index.ts` | Barrel re-export — `import { X } from "../controls"` | All of the above | 21 consumer files |
| `LabelScrub.tsx` | Drag-to-adjust label | `LabelScrub` | SliderRow, ColorRow, sections |
| `UnitSelector.tsx` | Unit dropdown (px/rem/em/%) | `UnitSelector` | ValueInput, sections |
| `ColorPickerEnhanced.tsx` | Full color picker (HSB canvas, hue, opacity) | `ColorPickerEnhanced` | ColorRow |
| `ComputedTooltip.tsx` | Computed value tooltip | `ComputedTooltip` | SliderRow, SelectRow, ColorRow |
| `ResetPopover.tsx` | Alt-click reset popover | `ResetPopover` | helpers.tsx |
| `SegmentedControl.tsx` | Segmented button group | `SegmentedControl` | Layout, Typography |
| `WebflowSegmentedControl.tsx` | Webflow-style segmented control | `WebflowSegmentedControl` | Layout, Variables |
| `IconButtonGroup.tsx` | Icon button toggle group | `IconButtonGroup` | Position, Layout |
| `SideSelector.tsx` | Border/padding side selector | `SideSelector` | Borders |
| `VariablePicker.tsx` | CSS variable picker dropdown | `VariablePicker` | ColorRow |

## sections/ — Panel Sections + Sub-Editors

| File | Section | Sub-Editors |
|------|---------|-------------|
| `LayoutSection.tsx` | Layout (display, flex, grid) | `layoutControls.tsx`, `AlignBox.tsx`, `GridSettingsPopup.tsx` |
| `SpacingSection.tsx` | Spacing (margin, padding) | `SpacingBoxModel.tsx`, `SpacingValuePopover.tsx` |
| `SizeSection.tsx` | Size (width, height, overflow) | `SizeInputCell.tsx` |
| `PositionSection.tsx` | Position (type, offsets, z-index) | `PositionOffsetDiagram.tsx`, `PositionSelector.tsx` |
| `TypographySection.tsx` | Typography (font, size, weight, color) | `TextStyleRow.tsx` |
| `BackgroundsSection.tsx` | Backgrounds (color, gradient, image) | `BackgroundLayerList.tsx`, `GradientEditor.tsx` |
| `BordersSection.tsx` | Borders (width, style, color, radius) | `CornerRadiusEditor.tsx` |
| `EffectsSection.tsx` | Effects (shadow, transform, transition, filter) | `ShadowEditor.tsx`, `TransformEditor.tsx`, `TransformOriginPicker.tsx`, `TransitionEditor.tsx`, `BezierEditor.tsx`, `FilterSliders.tsx` |
| `CSSVariablesSection.tsx` | CSS Variables | (uses variables/) |

## shell/ — Panel Frame

| File | Purpose |
|------|---------|
| `Overlay.tsx` | **Main entry point** — lifecycle orchestrator (1825 lines) |
| `Header.tsx` | Breadcrumb, scope pills, state selector, drag handle |
| `Footer.tsx` | Save, reset, clipboard dropdown |
| `Toolbar.tsx` | Mode toggles, AI button |
| `WebflowPanel.tsx` | Section orchestrator — renders all 8 sections |
| `CommandPalette.tsx` | Cmd+K command palette |
| `PropertySearch.tsx` | Property search within panel |
| `ShortcutsHelp.tsx` | Keyboard shortcuts help overlay |
| `ContextMenu.tsx` | Right-click context menu |
| `PropertyContextMenu.tsx` | Property-specific context menu |
| `HistoryDrawer.tsx` | Undo/redo history drawer |
| `SessionDrawer.tsx` | Session management drawer |
| `PromptPanel.tsx` | AI prompt panel |
| `Selector.tsx` | Element selector overlay |
| `StateSelector.tsx` | Pseudo-state (:hover/:focus) selector |
| `ViewportBar.tsx` | Viewport size bar |
| `DragHandle.tsx` | Drag handle component (used by list editors) |

## variables/ — Variable/Token System

| File | Purpose | Key Exports |
|------|---------|-------------|
| `GlobalVariablesPanel.tsx` | Full variable management panel (1505 lines) | `GlobalVariablesPanel` |
| `discoverVariables.ts` | Discover CSS variables from computed styles | `discoverCSSVariables`, `parseVarAlias` |
| `colorVariables.ts` | Color variable resolution and parsing | `parseVarRef`, `resolveVarColor`, `discoverColorVariables` |
| `autoCollections.ts` | Auto-generated variable collections | `buildAutoCollections` |
| `tokenCollections.ts` | Design token collection management | `useTokenCollections` |

## overlays/ — Visual Overlays

| File | Purpose |
|------|---------|
| `BoxModelOverlay.tsx` | Box model visualization (margin/padding/border) |
| `GridOverlay.tsx` | CSS Grid line overlay |
| `FlexGapOverlay.tsx` | Flex gap visualization |
| `SpacingGuidesOverlay.tsx` | Spacing measurement guides |
| `SpacingPreviewOverlay.tsx` | Live spacing preview during drag |

## navigator/ — Navigator Panel

| File | Purpose |
|------|---------|
| `NavigatorPanel.tsx` | DOM tree panel with expand/collapse, keyboard nav |
| `NavigatorNode.tsx` | Single tree node row component |
| `navigatorFilter.ts` | Tree filtering and flattening logic |
| `navigatorDrag.ts` | Drag-to-reorder logic for DOM elements |

## hooks/ — Shared Hooks

| File | Purpose | Used By |
|------|---------|---------|
| `useClickOutside.ts` | Detect clicks outside a ref | layoutControls, Toolbar |
| `useConversionHint.ts` | px→rem conversion hints | Layout, Size, Position, Borders, Typography |
| `useDragReorder.ts` | Drag-to-reorder list items | BackgroundLayer, Shadow, Transition, Filter, Variables, Transform |
| `useDropdownKeyboard.ts` | Arrow key navigation for dropdowns | layoutControls, PositionSelector, UnitSelector |
| `useElementTracker.ts` | Track element mutations | Overlay |
| `useFocusTrap.ts` | Focus trap for modals/panels | Variables, Effects, PropertyContextMenu |
| `usePortalDropdown.ts` | Portal-based dropdown positioning | SelectRow, PositionSelector, TextStyleRow, UnitSelector |
| `useSwatches.ts` | Recently-used color swatches | ColorPickerEnhanced |
| `useWheelAdjust.ts` | Mouse wheel value adjustment | SizeInputCell, CornerRadiusEditor, SliderRow |
| `useVirtualTree.ts` | Virtualized tree rendering | NavigatorPanel |

## Root Files — Shared Utilities

| File | Purpose |
|------|---------|
| `theme.ts` | **Single source of truth** for all design tokens (colors, spacing, typography) |
| `timing.ts` | Canonical animation timing tokens |
| `panelConstants.tsx` | Dropdown options, enums, preset values |
| `panelStyles.ts` | Shared inline style objects (ROW, LABEL, etc.) |
| `panelUtils.ts` | Formatters, indicator helpers, unit detection |
| `util.ts` | Breadcrumb builder, selectors, CSS diff formatting |
| `webflowIcons.tsx` | SVG icon components |
| `colorUtils.ts` | hex/rgba/rgb conversion |
| `cssParsers.ts` | Shadow, gradient, transform CSS string parsers |
| `inputMath.ts` | Math expression evaluator for inputs |
| `parseValueWithUnit.ts` | "12px" → { value: 12, unit: "px" } |
| `unitConversion.ts` | px↔rem↔em conversion |
| `textStyleScanner.ts` | Text style detection from computed styles |
| `getAuthoredValue.ts` | Authored vs computed value resolution |
| `cssImport.ts` | CSS text parser |
| `tailwind.ts` | Tailwind export formatter |
