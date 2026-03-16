# Transform Editor Redesign — Design

> Redesign the TransformEditor subsection to match Webflow's 2D & 3D transforms UI.

## Context

The current TransformEditor uses compact inline card rows with tiny numeric inputs and no sliders. Webflow's implementation is significantly more polished: summary pills that expand into a tabbed editor with full-width slider rows per axis, a scale lock, and a grouped "Transform settings" sub-panel for origin, backface, and perspective.

## Data Model

```ts
interface TransformValue {
  type: "translate" | "scale" | "rotate" | "skew";
  x: number;
  y: number;
  z?: number;          // translate, scale, rotate (not skew)
  scaleLocked?: boolean; // scale only — uniform lock
}
```

- Scale gains Z axis (currently X/Y only)
- Rotate gains Y and Z axes (currently X only)
- `scaleLocked` tracks whether the chain-link uniform lock is engaged

## UI Structure

### Collapsed state — Summary pills

Each transform in the list renders as a clickable pill:

```
┌─ ⟳ Rotate: 53deg, 0deg, 0deg ─────────────┐
└─────────────────────────────────────────────┘
┌─ ✦ Move: 65px, 0px, 0px ───────────────────┐
└─────────────────────────────────────────────┘
```

- Icon on the left (per type)
- Label + formatted values
- Click to expand/collapse
- Drag handle for reorder
- Remove button (hover or expanded)

### Expanded state — Tabbed editor

Clicking a pill expands it to show:

```
┌─ ⟳ Rotate: 53deg, 0deg, 0deg ──────────────┐
│  Type  [Move][Scale][Rotate][Skew]           │
│  X ⟳  ═══════■═══════════  [53]  DEG       │
│  Y ⟳  ══════════■════════  [ 0]  DEG       │
│  Z ⟳  ══════════■════════  [ 0]  DEG       │
└──────────────────────────────────────────────┘
```

- **Tab bar**: Move / Scale / Rotate / Skew — switches type of this transform
- **Type change**: Only commits when a value is actually modified (not on tab click alone)
- **Per-axis rows**: Axis label + slider + numeric input + unit label
- **Scale tab**: Additional chain-link lock icon for uniform X/Y/Z scaling

### Axis counts per type

| Type    | Axes  | Unit | Default |
|---------|-------|------|---------|
| Move    | X,Y,Z | PX   | 0,0,0   |
| Scale   | X,Y,Z | (none) | 1,1,1 |
| Rotate  | X,Y,Z | DEG  | 0,0,0   |
| Skew    | X,Y   | DEG  | 0,0     |

### Header controls

- **`+` button**: Opens dropdown to add a new 2D transform (Move/Scale/Rotate/Skew). New transform auto-expands.
- **`...` button**: Toggles the Transform Settings panel.

### Transform Settings (revealed by `...`)

```
── Transform settings ───────────────────────
Origin   [3x3 grid]  Left [50] %
                      Top  [50] %
Backface  [Visible | Hidden]

Self perspective
Distance  ═══■═══════════  [0]  PX

Children perspective
Distance  ═══■═══════════  [0]  PX
Origin   [3x3 grid]  Left [50] %
                      Top  [50] %
```

- **Origin**: 3x3 grid picker + editable Left/Top numeric inputs (% units)
- **Backface**: Segmented control (Visible/Hidden)
- **Self perspective**: Distance slider (maps to `perspective(Npx)` in the transform string, emitted first)
- **Children perspective**: Distance slider + its own origin picker (maps to `perspective` + `perspective-origin` CSS properties)

## Component Breakdown

| Component | Responsibility |
|-----------|---------------|
| `TransformEditor` (rewrite) | Orchestrates pill list + settings panel |
| `TransformPill` (new, internal) | Summary pill: icon, label, values. Click to expand. |
| `TransformExpanded` (new, internal) | Tab bar + per-axis slider rows + scale lock |
| `TransformSettings` (new, internal) | Origin + Backface + Self/Children perspective |
| `TransformOriginPicker` (update) | Add Left/Top numeric inputs alongside 3x3 grid |

All new sub-components are internal to TransformEditor.tsx (not separate files unless the file gets too large).

## CSS Parser Updates (`cssParsers.ts`)

### `transformToCSS`
- Self perspective emitted first: `perspective(Npx) ...`
- Scale: `scale3d(x, y, z)` when Z present, `scale(x, y)` when Z absent/1
- Rotate: `rotateX(Xdeg) rotateY(Ydeg) rotateZ(Zdeg)` (separate functions, not `rotate3d`)
- Translate/Skew: unchanged

### `parseTransform`
- Parse `scale3d(x, y, z)`
- Parse `rotateX()`, `rotateY()`, `rotateZ()` individually and merge into one TransformValue
- Parse `perspective()` from transform string (for self perspective)
- Handle `matrix3d()` decomposition for all axes

## What Moves in EffectsSection

The **Perspective** NumberRow and **Backface** SelectRow currently live as standalone rows in EffectsSection.tsx below the transforms sub-section. They move inside the TransformEditor component as part of Transform Settings, and their CSS application handlers pass through as props.

## Key Behaviors

- **Pill click** → toggles expanded/collapsed
- **Tab switching** → changes type; only persists on value edit
- **Scale lock** → changing any axis updates all three
- **`+` button** → dropdown picker, adds transform, auto-expands
- **`...` button** → toggles settings panel
- **Drag reorder** → pills are reorderable (existing `useDragReorder`)
- **Remove** → per-pill remove button
