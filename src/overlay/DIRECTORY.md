# src/overlay/ — Module Map

> Machine-readable table of contents. Read this first for any task.

## Directory Layout

```
src/overlay/
  core/        Engine — style application, undo/redo, inference, scoping (no UI)
  controls/    Shared UI primitives — Section, SliderRow, SelectRow, ColorRow, etc.
  sections/    8 panel sections + Custom properties + sub-editors
  shell/       Panel frame — Overlay entry point, Header, Footer, Toolbar, drawers
  variables/   Variable/token discovery, linking, and collections
  overlays/    Visual overlays drawn on the page (box model, grid, spacing guides)
  navigator/   Navigator panel (DOM tree view, CSS editor tab, drag-to-reorder)
  hooks/       All use*.ts hooks (20 files)
  util/        Pure math shared by overlays (boxGeometry)
  (root)       Shared utilities imported across all domains
```

---

## core/ — Engine (no UI)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `apply.ts` | Inline style overrides, undo/redo stack, session persistence, diff tracking | `applyInlineStyle`, `undo`, `redo`, `reset`, `resetAll`, `diff`, `beginBatch`, `endBatch`, `copyStyles`, `pasteStyles` |
| `engine.ts` | Unified style-engine facade over element/class/state/mode dimensions (RFC #14) | `styleEngine`, `resolveTarget`, `ScopeContext`, `OverrideTarget` |
| `infer.ts` | DOM element → panel config via `getComputedStyle` | `infer`, `InferResult`, `SPACING_PROPS` |
| `scope.ts` | CSS Module class scoping + custom-property reads | `getCSSModuleClasses`, `applyClassStyle`, `getCustomProperties`, `isTailwindElement` |
| `statePreview.ts` | Pseudo-state (:hover/:focus/…) preview via injected rules | `applyStateStyle`, `removeStateStyle`, `diffState`, `VALID_STATES` |
| `stylingSystem.ts` | Classify which styling system authored an element (saveable or not) | `classifyStylingSystem`, `StylingSystemInfo` |
| `modeOverrides.ts` | Theme-mode CSS-variable overrides (global, keyed by selector+var) | `applyModeOverride`, `removeModeOverride`, `getModeOverridesCss` |
| `managedSheet.ts` | CSP-safe constructable-stylesheet helper (ADR-0009) | `managedSheet` |
| `hmr.ts` | HMR bridge — re-infers on hot reload | `onHmrUpdate` |
| `config.ts` | Runtime configuration (commit endpoint, project breakpoints) | `getConfig`, `configure`, `TunerConfig` |
| `sourcemap.ts` | React source detection (≤18 `_debugSource`, 19 `_debugStack`) + CSS source resolution | `resolveSource`, `getReactSource`, `getCSSSource`, `getModuleClassInfo` |
| `save.ts` | **THE save pipeline (ADR-0011)** — enrichment, file-vs-clipboard partition, per-mode transport, fallbacks, breakpoint reconciliation; every save surface calls this | `save`, `SaveOutcome`, `__setTransportForTests` |
| `commitUtils.ts` | Commit preparation (provenance-driven diff → file write payload; internal to save.ts + tests) | `enrichChangesForCommit`, `partitionBreakpointChanges` |
| `contrast.ts` | Pure WCAG contrast evaluation for the Typography color row | `evaluateContrast` |
| `resolveBackdrop.ts` | Resolve the effective backdrop color behind an element | `resolveBackdropColor` |
| `elementContext.ts` | Selected-element metadata for the AI prompt panel | `buildPromptContext` |
| `scrubState.ts` | Global drag/scrub state | `isScrubActive`, `subscribeScrubState` |
| `navigationHistory.ts` | Element selection history + panel positioning math | `NavigationHistory`, `computePanelMaxHeight` |

## controls/ — Shared UI Primitives

| File | Purpose | Key Exports | Used By |
|------|---------|-------------|---------|
| `Section.tsx` | Collapsible section wrapper | `Section` | All *Section.tsx |
| `ValueInput.tsx` | Numeric input with math expressions, units | `ValueInput` | SliderRow, sections |
| `SliderRow.tsx` | Label + slider + input row | `SliderRow` | All sections |
| `Slider.tsx` | Inline range slider (no shadcn/Radix) | `Slider` | SliderRow |
| `SelectRow.tsx` | Label + dropdown (with searchable variant) | `SelectRow` | All sections |
| `ColorRow.tsx` | Color swatch + picker + variable linking | `ColorRow` | Typography, Backgrounds, Borders, Effects |
| `TextRow.tsx` | Text input row | `TextRow` | Size, Layout |
| `NumberRow.tsx` | Number-only input row | `NumberRow` | Position, Effects |
| `SubSectionHeader.tsx` | Section sub-header with indicator | `SubSectionHeader` | Effects, Backgrounds, Typography |
| `EditorRemoveButton.tsx` | Remove button for list editors | `EditorRemoveButton` | Shadow, Transform, Transition, Filter |
| `VisibilityToggle.tsx` | Eye toggle for list items | `VisibilityToggle` | Shadow, Filter, Transition, BackgroundLayer |
| `helpers.tsx` | Shared hooks/styles: useValueFlash, useResetPopover, PresetChips, labelStyle | (internal) | Other controls/ files |
| `index.ts` | Barrel re-export — `import { X } from "../controls"` | All of the above | Consumer files across sections/shell |
| `LabelScrub.tsx` | Drag-to-adjust label primitive | `LabelScrub` | ScrubLabel |
| `ScrubLabel.tsx` | Webflow-style draggable property label (LabelScrub + indicator + reset) | `ScrubLabel` | SliderRow, ColorRow, sections |
| `UnitSelector.tsx` | Unit dropdown (px/rem/em/%) | `UnitSelector` | ValueInput, sections |
| `ColorPickerEnhanced.tsx` | Full color picker (HSB canvas, hue, opacity) | `ColorPickerEnhanced` | ColorRow, SwatchColorPicker |
| `SwatchColorPicker.tsx` | Reusable color swatch + portalled picker | `SwatchColorPicker` | Sub-editors (shadows, gradients, variables) |
| `colorPickerPosition.ts` | Viewport-aware placement for the color-picker popover | `computeColorPickerPosition` | ColorRow, SwatchColorPicker |
| `ContrastBadge.tsx` | Live WCAG contrast gauge for the Typography color row | `ContrastBadge` | TypographySection |
| `ComputedTooltip.tsx` | Computed value tooltip | `ComputedTooltip` | SliderRow, SelectRow, ColorRow |
| `ResetPopover.tsx` | Alt-click reset popover | `ResetPopover` | helpers.tsx |
| `SegmentedControl.tsx` | Segmented button group | `SegmentedControl` | Layout, Typography |
| `WebflowSegmentedControl.tsx` | Webflow-style segmented control | `WebflowSegmentedControl` | Layout, Variables |
| `IconButtonGroup.tsx` | Icon button toggle group | `IconButtonGroup` | Position, Layout |
| `SideSelector.tsx` | Border/padding side selector | `SideSelector` | Borders |
| `MiniSelect.tsx` | Small styled native `<select>` | `MiniSelect` | Sub-editors, variables |
| `PortalListboxSelect.tsx` | Shared portal-dropdown combobox for header selectors | `PortalListboxSelect` | StateSelector, BreakpointSelector |
| `SearchableMenu.tsx` | Inline searchable dropdown box (no shadcn/cmdk) | `SearchableMenu` | TextStyleRow, SelectRow |
| `VariableField.tsx` | Purple pill shown when a value is linked to a CSS variable | `VariableField` | Linked controls |
| `VariableLinkDot.tsx` | Purple dot for variable link/unlink progressive disclosure | `VariableLinkDot` | SliderRow, ColorRow, sections |
| `VariablePicker.tsx` | CSS variable picker dropdown | `VariablePicker` | ColorRow, VariableLinkDot |

## sections/ — Panel Sections + Sub-Editors

| File | Section | Sub-Editors |
|------|---------|-------------|
| `LayoutSection.tsx` | Layout (display, flex, grid) | `layoutControls.tsx`, `layoutPrimitives.tsx`, `layoutMisc.tsx`, `DisplayTabs.tsx`, `DirectionControls.tsx`, `GridControls.tsx`, `AlignBox.tsx`, `GridSettingsPopup.tsx` |
| `SpacingSection.tsx` | Spacing (margin, padding) | `SpacingBoxModel.tsx`, `SpacingValuePopover.tsx` |
| `SizeSection.tsx` | Size (width, height, overflow) | `SizeInputCell.tsx` |
| `PositionSection.tsx` | Position (type, offsets, z-index) | `PositionOffsetDiagram.tsx`, `PositionSelector.tsx` |
| `TypographySection.tsx` | Typography (font, size, weight, color) | `TextStyleRow.tsx` |
| `BackgroundsSection.tsx` | Backgrounds (color, gradient, image) | `BackgroundLayerList.tsx`, `GradientEditor.tsx` |
| `BordersSection.tsx` | Borders (width, style, color, radius) | `CornerRadiusEditor.tsx` |
| `EffectsSection.tsx` | Effects (shadow, transform, transition, filter) | `ShadowEditor.tsx`, `TransformEditor.tsx`, `TransformOriginPicker.tsx`, `TransitionEditor.tsx`, `BezierEditor.tsx`, `FilterSliders.tsx` |
| `CustomPropertiesSection.tsx` | Custom properties (arbitrary property:value escape hatch) | `cssPropertyList.ts` (autocomplete source) |

## shell/ — Panel Frame

| File | Purpose |
|------|---------|
| `Overlay.tsx` | **Main entry point** — lifecycle orchestrator (~1000 lines; logic split into `hooks/`, render tree split into the shell subcomponents below) |
| `overlayTypes.ts` | Canonical `ActivePanel` / `ActiveModal` discriminated unions (shared by Overlay + hooks) |
| `Header.tsx` | Breadcrumb, scope pills, state selector, drag handle |
| `Footer.tsx` | Save, reset, clipboard dropdown |
| `Toolbar.tsx` | Mode toggles, AI button |
| `WebflowPanel.tsx` | Section orchestrator — renders the 8 sections + Custom properties, styling-system capability notice |
| `OverlayStyles.tsx` | Static `<style>` tags: scrollbar/slider theming + reduced-motion |
| `SelectionChrome.tsx` | Selected-element outline, dimensions badge, tag label, hover/ancestor highlights (ref-driven) |
| `VisualOverlays.tsx` | On-page measurement overlays (grid / box model / spacing / flex gap) |
| `OverlayModals.tsx` | Transient modals: command palette, context menu, shortcuts help |
| `Modal.tsx` | Portaled, focus-trapped modal primitive (no shadcn/Radix) |
| `InspectorTabBar.tsx` | Inspector sub-header: Focus Mode pill + Style/AI tabs |
| `CloseWarningBar.tsx` | "N unsaved changes" close-confirmation strip |
| `HintBar.tsx` | First-use keyboard-hint strip |
| `CommandPalette.tsx` | Cmd+K command palette |
| `PropertySearch.tsx` | Property search within panel |
| `ShortcutsHelp.tsx` | Keyboard shortcuts help overlay (the canonical shortcut list) |
| `ContextMenu.tsx` | Right-click context menu |
| `PropertyContextMenu.tsx` | Property-specific context menu |
| `ChangesDrawer.tsx` | Unified drawer: pending changes + undo history tabs |
| `PromptPanel.tsx` | AI prompt panel |
| `Selector.tsx` | Element selector overlay |
| `StateSelector.tsx` | Pseudo-state (:hover/:focus/…) selector |
| `BreakpointSelector.tsx` | Responsive breakpoint selector (issue #35) |
| `DragHandle.tsx` | Drag handle component (used by list editors) |

## variables/ — Variable/Token System

| File | Purpose | Key Exports |
|------|---------|-------------|
| `GlobalVariablesPanel.tsx` | Master-detail shell for the variables panel (sidebar + detail wiring) | `GlobalVariablesPanel` |
| `CollectionSidebar.tsx` | Left pane — collections list with create/rename/delete | `CollectionSidebar` |
| `CollectionDetail.tsx` | Right pane — variable table grouped by subgroups, mode columns | `CollectionDetail` |
| `DetailVariableRow.tsx` | Variable row, inline add row, subgroup section for the detail pane | (components) |
| `ModeValueCell.tsx` | Editable per-mode value cell | `ModeValueCell` |
| `DetailContextMenu.tsx` | Right-click context menu for the detail pane | `DetailContextMenu` |
| `ReferencePill.tsx` | Pill for var-to-var alias references | `ReferencePill` |
| `VarTypeIcon.tsx` | Type icon (color/length/number/string) | `VarTypeIcon` |
| `collectionDetailShared.tsx` | Shared helpers/styles for the detail pane pieces | (internal) |
| `discoverVariables.ts` | Discover CSS variables from stylesheets/computed styles | `discoverVariables`, `discoverAllVariables`, `parseVarAlias`, `naturalCompare` |
| `colorVariables.ts` | Color variable resolution and parsing | `discoverColorVariables`, `resolveVarColor` |
| `autoCollections.ts` | Auto-generated variable collections + subgroup inference | `inferAutoCollections`, `inferSubgroups` |
| `tokenCollections.ts` | User-defined token collection management (localStorage) | `useTokenCollections` |
| `modeDiscovery.ts` | Discover CSS variable "modes" (theme classes, media queries, …) | `discoverModeDeclarations`, `inferModes` |
| `panelWidth.ts` | Variables panel width from mode column count | `getVariablesPanelWidth` |

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
| `CSSEditorView.tsx` | DevTools-like CSS rule viewer with inline editing |
| `cssRuleGatherer.ts` | Walk stylesheets to find CSS rules matching an element |
| `navigatorFilter.ts` | Tree filtering and flattening logic |
| `navigatorDrag.ts` | Drag-to-reorder logic for DOM elements |

## hooks/ — Shared Hooks

| File | Purpose | Used By |
|------|---------|---------|
| `useOverlayHotkeys.ts` | The single capture-phase keydown listener for all shortcuts (context-aware pass-through) | Overlay, Footer |
| `useElementSelection.ts` | Selection / close lifecycle callbacks | Overlay |
| `useStyleHandlers.ts` | Style-mutation callbacks (reset, paste, undo-to-index) | Overlay |
| `useOverlayDrag.ts` | Panel position, edge anchoring, snap, header drag | Overlay |
| `usePageInteractions.ts` | Page-level pointer listeners while the panel is open | Overlay |
| `useSelectionOutline.ts` | Selected-element outline + badge + tag label tracking | Overlay |
| `useInjectedStyles.ts` | One-time global style injection (dev-overlay z-index taming) | Overlay |
| `useElementTracker.ts` | Event-driven element position/size tracking (no rAF polling) | BoxModelOverlay, useSelectionOutline, useTrackedOverlay |
| `useTrackedOverlay.ts` | State-returning tracking adapter for the declarative overlays | Grid/FlexGap/Spacing overlays |
| `useClickOutside.ts` | Detect clicks outside a ref | layoutPrimitives, FilterSliders, DirectionControls, DisplayTabs, Toolbar |
| `useConversionHint.ts` | px→rem conversion hints | Layout, Size, Position, Borders, Typography |
| `useDraftNumber.ts` | Draft + commit-on-blur/Enter + arrow stepping for numeric inputs | ValueInput + 11 sub-editors |
| `useDragReorder.ts` | Drag-to-reorder list items | BackgroundLayer, Shadow, Transition, Filter, Transform |
| `useDropdownKeyboard.ts` | Arrow key navigation for dropdowns | PositionSelector, layoutPrimitives, UnitSelector, PortalListboxSelect, SelectRow |
| `useFocusTrap.ts` | Focus trap for modals/panels | Effects, PropertyContextMenu, variables |
| `useListKeyboardNav.ts` | Highlighted-item keyboard nav over flat lists | CommandPalette, SearchableMenu |
| `usePortalDropdown.ts` | Portal-based dropdown positioning | SelectRow, PositionSelector, TextStyleRow, UnitSelector, PortalListboxSelect |
| `useSwatches.ts` | Recently-used color swatches (localStorage) | (no current consumers) |
| `useVirtualTree.ts` | Virtualized tree rendering | NavigatorPanel |
| `useWheelAdjust.ts` | Mouse wheel value adjustment | SizeInputCell, CornerRadiusEditor, layoutMisc, ValueInput |

## util/ — Pure Math

| File | Purpose |
|------|---------|
| `boxGeometry.ts` | Pure box-model math shared by box-model + spacing overlays (`parseBoxModel`, `boxRects`, `buildZones`) |

## Root Files — Shared Utilities

| File | Purpose |
|------|---------|
| `theme.ts` | **Single source of truth** for all design tokens (colors, spacing, typography) |
| `timing.ts` | Canonical animation timing tokens |
| `breakpoints.ts` | Canonical responsive breakpoints + `@media` serialization (#35) |
| `breakpointPreview.ts` | Live media-gated stylesheet for breakpoint edits (#35) |
| `panelConstants.tsx` | Dropdown options, enums, preset values |
| `panelStyles.ts` | Shared inline style objects (ROW, LABEL, etc.) |
| `panelUtils.ts` | `SECTION_ORDER`, indicator helpers, unit detection, `SectionCtx` |
| `util.ts` | Breadcrumb builder, selectors, CSS diff formatting |
| `webflowIcons.tsx` | SVG icon components |
| `colorUtils.ts` | hex/rgba/rgb conversion |
| `cssParsers.ts` | Shadow, gradient, transform CSS string parsers |
| `cssImport.ts` | CSS text parser (paste/import) |
| `inputMath.ts` | Math expression evaluator for inputs |
| `parseValueWithUnit.ts` | "12px" → { value: 12, unit: "px" } |
| `unitConversion.ts` | px↔rem↔em conversion |
| `textStyleScanner.ts` | Text style detection from computed styles |
| `getAuthoredValue.ts` | Authored vs computed value resolution |
| `tailwind.ts` | Tailwind export formatter |
