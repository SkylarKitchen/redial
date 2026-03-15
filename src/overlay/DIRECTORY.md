# src/overlay/ — File Directory

> Read this first when navigating the overlay codebase. 103 files organized by domain.

## Sections (CSS Property Panels)

Each section renders one collapsible panel of CSS controls. Pattern: `*Section.tsx`.

| File | Domain | Lines | Key props |
|------|--------|-------|-----------|
| `LayoutSection.tsx` | display, flex, grid, gap | 846 | display mode, AlignBox, flex child, grid tracks |
| `SpacingSection.tsx` | margin, padding | ~100 | wraps SpacingBoxModel |
| `SizeSection.tsx` | width, height, min/max, overflow, object-fit | 485 | unit selectors, auto/none keywords |
| `PositionSection.tsx` | position, offsets, z-index, float, clear | 419 | offset diagram, collapsed when static |
| `TypographySection.tsx` | font, text, color, alignment, decoration | 467 | searchable font dropdown, advanced sub-section |
| `BackgroundsSection.tsx` | background layers, gradients, images | ~200 | multi-layer via BackgroundLayerList |
| `BordersSection.tsx` | border style/width/color, radius | 385 | side selector tabs, linked/unlinked radius |
| `EffectsSection.tsx` | opacity, shadows, transforms, filters, transitions | 393 | orchestrates sub-editors |
| `CSSVariablesSection.tsx` | custom properties (--var) | ~300 | auto-discovery, variable linking |

## Section-Specific Editors

Sub-components used within one section. Named after the control they implement.

| File | Used by | Purpose |
|------|---------|---------|
| `AlignBox.tsx` | Layout | 3x3 clickable alignment grid (justify + align) |
| `layoutControls.tsx` | Layout | Display tabs, direction toggles, helper buttons |
| `SpacingBoxModel.tsx` | Spacing | Visual nested-rectangle box model with editable values |
| `SpacingValuePopover.tsx` | Spacing | Click-to-edit value popover with presets |
| `SizeInputCell.tsx` | Size | Individual size input with unit + keyword support |
| `PositionOffsetDiagram.tsx` | Position | 4-side offset input layout |
| `PositionSelector.tsx` | Position | Position type selector (static/relative/absolute/fixed/sticky) |
| `TextStyleRow.tsx` | Typography | Font style preview row |
| `textStyleScanner.ts` | Typography | Detects common text styles and suggests presets |
| `BackgroundLayerList.tsx` | Backgrounds | Stackable background layer manager |
| `GradientEditor.tsx` | Backgrounds | Visual gradient bar with draggable color stops |
| `CornerRadiusEditor.tsx` | Borders | 4-corner visual radius layout |
| `SideSelector.tsx` | Borders | Tab bar (All/Top/Right/Bottom/Left) |
| `ShadowEditor.tsx` | Effects | Multi-shadow list with drag reorder |
| `TransformEditor.tsx` | Effects | Translate/scale/rotate/skew per-row editor |
| `TransformOriginPicker.tsx` | Effects | 3x3 visual origin picker |
| `TransitionEditor.tsx` | Effects | Property/duration/easing/delay with drag reorder |
| `BezierEditor.tsx` | Effects | Cubic-bezier visual curve editor with preview |
| `FilterSliders.tsx` | Effects | Grouped filter/backdrop-filter sliders |

## Shared Controls (Reusable UI Primitives)

Used across multiple sections. Pattern: generic control name.

| File | Purpose |
|------|---------|
| `controls.tsx` | Base control components: SelectRow, NumberRow, TextRow, ColorRow, etc. (1414 lines) |
| `UnitSelector.tsx` | Dropdown unit changer (px/%, em, rem, vw, vh, etc.) |
| `IconButtonGroup.tsx` | Radio-style icon button group (text-align, decoration, transform) |
| `SegmentedControl.tsx` | Generic segmented toggle |
| `WebflowSegmentedControl.tsx` | Webflow-styled segmented control variant |
| `LabelScrub.tsx` | Draggable label for value scrubbing (Webflow signature interaction) |
| `DragHandle.tsx` | Grip dots for drag-to-reorder |
| `ResetPopover.tsx` | Inline reset confirmation popover |
| `ColorPickerEnhanced.tsx` | Full color picker: HSB/RGB/Hex, opacity, variable swatches (874 lines) |
| `VariablePicker.tsx` | Dropdown for CSS variable selection |
| `ComputedTooltip.tsx` | Tooltip showing computed vs authored value |

## Shell & Chrome (Panel Frame)

The panel container, header, footer, and auxiliary panels.

| File | Purpose | Lines |
|------|---------|-------|
| `Overlay.tsx` | **Main entry point.** Full lifecycle: hotkey → selector → panel → footer. State management hub. | 1825 |
| `WebflowPanel.tsx` | Section orchestrator — renders all 8 sections in order | ~300 |
| `Header.tsx` | Breadcrumb, scope pills, state selector, drag handle, close button | 337 |
| `Footer.tsx` | Save, Reset, Clipboard dropdown (copy CSS/Tailwind/vars, paste, import) | 449 |
| `Toolbar.tsx` | Floating toolbar with quick-access buttons | ~200 |
| `Selector.tsx` | Element selection mode — click to pick a DOM element | ~300 |
| `ViewportBar.tsx` | Viewport size indicator bar | ~100 |
| `StateSelector.tsx` | Pseudo-class state dropdown (none/hover/focus/active/etc.) | ~100 |

## Auxiliary Panels & Modals

Secondary views that overlay or replace the main panel.

| File | Purpose |
|------|---------|
| `SessionDrawer.tsx` | Side drawer showing all changes in current session |
| `HistoryDrawer.tsx` | Timeline of property changes with undo-to-point |
| `CommandPalette.tsx` | Fuzzy-search command palette (`,` key) |
| `ShortcutsHelp.tsx` | Keyboard shortcuts reference modal |
| `ContextMenu.tsx` | Right-click context menu on panel |
| `PropertyContextMenu.tsx` | Right-click on a specific property (copy, reset, etc.) |
| `PropertySearch.tsx` | Filter properties by keyword within the panel |
| `PromptPanel.tsx` | AI prompt panel for natural-language style editing |
| `GlobalVariablesPanel.tsx` | Collection-grouped variable browser and linker (1505 lines) |
| `NavigatorNode.tsx` | DOM tree node for navigator view |
| `GridSettingsPopup.tsx` | Grid track editing popup |

## Canvas Overlays

Visual overlays drawn on top of the host page (outside the panel).

| File | Purpose |
|------|---------|
| `BoxModelOverlay.tsx` | Element box model visualization (margin/padding/content) |
| `FlexGapOverlay.tsx` | Visual flex gap indicator between children |
| `GridOverlay.tsx` | Grid cell boundaries and track labels |
| `SpacingGuidesOverlay.tsx` | Measurement lines between elements |
| `SpacingPreviewOverlay.tsx` | Live preview of spacing value changes |

## Hooks

Custom React hooks. Pattern: `use*.ts`.

| File | Purpose |
|------|---------|
| `useClickOutside.ts` | Close dropdowns/popovers on outside click |
| `useConversionHint.ts` | Flash hint when unit conversion changes value |
| `useDragReorder.ts` | Generic drag-to-reorder for lists (shadows, transitions) |
| `useDropdownKeyboard.ts` | Arrow key navigation within dropdown menus |
| `useElementTracker.ts` | Re-resolve selected element after DOM mutations |
| `useFocusTrap.ts` | Trap focus within a modal/popover |
| `usePortalDropdown.ts` | Portal-rendered dropdown positioning |
| `useSwatches.ts` | Saved color swatches (add/remove/persist to localStorage) |
| `useWheelAdjust.ts` | Mouse wheel to adjust numeric values |

## Engine (Core Logic — No UI)

State management, DOM analysis, style application, and persistence.

| File | Purpose | Lines |
|------|---------|-------|
| `apply.ts` | **Inline style engine.** Override tracking, undo/redo stack, session persistence (localStorage), batch operations. | 1118 |
| `infer.ts` | **DOM → config.** Reads getComputedStyle, detects display type, generates section configs. | 562 |
| `scope.ts` | Class-scoped style management — CSS module detection, Tailwind class awareness | ~300 |
| `statePreview.ts` | Pseudo-class style injection — preview :hover/:focus without actual state | ~200 |
| `hmr.ts` | HMR recovery — re-resolve elements and restore session after hot reload | ~100 |
| `commitUtils.ts` | Enrich change entries for source file writing | ~100 |
| `config.ts` | Runtime configuration (commit endpoint, feature flags) | ~50 |
| `sourcemap.ts` | React source location detection (file:line from fiber) | ~150 |
| `cssImport.ts` | Parse pasted CSS text into property/value pairs | ~100 |
| `cssParsers.ts` | Parse complex CSS values: box-shadow, gradient, filter, transform | ~300 |
| `tailwind.ts` | CSS property → Tailwind class conversion | ~200 |
| `scrubState.ts` | Global flag: is a label-drag scrub currently active? | ~20 |
| `elementContext.ts` | Element metadata (tag, classes, parent info) | ~50 |
| `navigationHistory.ts` | Track element selection history for back/forward | ~80 |
| `navigatorFilter.ts` | Filter/search within the navigator DOM tree | ~50 |

## Utilities (Pure Functions)

Stateless helpers used across the codebase.

| File | Purpose |
|------|---------|
| `colorUtils.ts` | hex↔rgba, HSB↔RGB, color parsing and conversion |
| `colorVariables.ts` | Resolve CSS variable references to actual color values |
| `unitConversion.ts` | Convert between CSS units (px↔em, rem, %, vw, vh) with root awareness |
| `inputMath.ts` | Parse math expressions in inputs (e.g., "16*2" → 32) |
| `parseValueWithUnit.ts` | Split "16px" → { value: 16, unit: "px" } |
| `getAuthoredValue.ts` | Read the authored (not computed) CSS value from inline/stylesheet |
| `util.ts` | General helpers: getSelector, buildBreadcrumb, formatCSSDiff, isNavigableElement |

## Tokens & Constants

Design system values. Single source of truth — import everywhere.

| File | Purpose | Lines |
|------|---------|-------|
| `theme.ts` | **All design tokens**: colors, layout dimensions, shadows, indicators | 436 |
| `timing.ts` | **All animation timing**: durations, spring configs, reduced motion | ~80 |
| `panelConstants.tsx` | Option arrays for all dropdowns (display modes, font weights, cursors, etc.) | 456 |
| `panelStyles.ts` | Shared inline style objects (ROW, LABEL, etc.) | ~100 |
| `panelUtils.ts` | Section utilities: indicator detection, section ordering | ~150 |

## Variables & Collections

CSS variable discovery and management system.

| File | Purpose |
|------|---------|
| `tokenCollections.ts` | Store for token collections (color, spacing, etc.) |
| `autoCollections.ts` | Auto-detect token collections from document stylesheets |
| `discoverVariables.ts` | Scan stylesheets for custom properties by type (color, length, number) |

## Icons

| File | Purpose |
|------|---------|
| `webflowIcons.tsx` | All custom SVG icons (display modes, alignment, decorations) |
