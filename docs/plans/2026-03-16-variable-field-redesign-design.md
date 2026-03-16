# Variable Field Redesign — Webflow-Style Purple Pill

**Date:** 2026-03-16
**Status:** Approved

## Problem

Current variable linking UX uses a tiny 14px VariableLinkDot at the corner of controls. When linked, the variable name appears in blue monospace text next to the dot. This is:
- Hard to discover (small target, hidden until hover)
- Inconsistent with Webflow's prominent linked-field pattern
- Missing edit-in-place for variable definitions

## Design

### Linked State — Purple Pill

When any control is linked to a variable, the **entire value area** (input + unit or swatch + hex) is replaced by a purple pill.

```
Unlinked:  [Gap]  [── slider ──] [16] [PX]
Linked:    [Gap]  [── slider ──] [  size  ]  ← purple pill
```

Pill styling:
- Background: `variableAlpha(0.15)` + `1px solid variableAlpha(0.3)` border
- Text: `color.variable` (#6B5CE7), 11px mono, left-aligned, `--` prefix stripped
- Border-radius: `layout.pillRadius` (4px)
- Fills same flex space as the input+unit it replaces

Click pill → opens Connect picker (to switch variables).

### Hover State — Pencil Icon

On pill hover, a pencil icon (12px) appears at the right edge.
- Click pencil → opens Edit Variable popover
- Click pill (not pencil) → opens Connect picker

### Edit Variable Popover

Portal-rendered (240px), anchored below pill:

```
┌─ Edit variable ──────────────┐
│ Name                         │
│ [size___________________]    │
│ Value                        │
│ [16_______________] [PX ▾]   │
└──────────────────────────────┘
```

- **Name**: text input. On commit → renames CSS variable globally.
- **Value**: numeric input + unit dropdown. On commit → updates variable value globally via `document.documentElement.style.setProperty`.
- Changes go through `apply.ts` for undo/redo.
- Portal with `data-tuner-portal`.
- Escape/click-outside → closes.

### Connect Picker (Upgraded VariablePicker)

Evolves existing `VariablePicker.tsx`:

```
┌─ Connect ─────────── [X] ────┐
│ [🔍 Search variables...]     │
├──────────────────────────────┤
│ ▾ Site variables             │
│   ▾ Base collection          │
│     ↗ size    16px           │
│   ▾ Colors                   │
│     ● primary #3B82F6        │
└──────────────────────────────┘
```

Changes from current:
- Header: "Connect" title + X button (unlinks current variable, only shown when linked)
- Width: 240px (up from 220px)
- No CSS functions section (v1)
- Same grouped list, search, type indicators, collection headers

### Unlinked State

VariableLinkDot (14px corner dot, progressive disclosure) stays as the affordance for opening the Connect picker when unlinked. Unchanged.

### New Component: VariableField.tsx

Single component replacing scattered variable-mode rendering across controls.

```ts
interface VariableFieldProps {
  variableName: string;        // e.g. "--size"
  variableType: "color" | "length" | "all";
  element?: Element;
  onSelectVariable: (varExpr: string) => void;
  onUnlink: () => void;
}
```

### Controls Affected

| Control | Current linked rendering | New rendering |
|---------|------------------------|---------------|
| SliderRow | Dot + blue text + reset × | Purple pill replaces input+unit area |
| SizeInputCell | Dot + blue text in cell | Purple pill replaces value+unit cell |
| ColorRow | Dot + swatch + blue text | Purple pill replaces swatch+hex area |
| TypoValueCell | Dot + blue text | Purple pill replaces value+unit cell |
| ModeValueCell | Dot on cell | Purple pill replaces cell content |

## Out of Scope

- CSS functions (calc, clamp, max, min) in Connect picker
- SpacingBoxModel / LabelScrub variable linking
- Variable rename propagation across source files (rename is runtime-only for now)
