# Filter Section Redesign — Design

## Goal

Replace the flat-slider FilterSliders with a Webflow-style list-of-items editor. Each filter is an individual collapsible card with summary row, type dropdown, and type-specific parameter controls. Categorized add dropdown with checkmarks.

## Data Model

```ts
interface FilterItem {
  type: FilterType;       // "blur" | "drop-shadow" | "brightness" | etc.
  values: number[];       // [radius] for blur, [x,y,blur,spread] for drop-shadow, [amount] for others
  color?: string;         // only for drop-shadow
  visible: boolean;
  expanded: boolean;
}
```

Replaces the current `Partial<FilterValues>` flat map. Supports multiple filters of the same type, reordering, and per-item visibility.

## Categorized Add Dropdown

| Category | Filter Types |
|----------|-------------|
| **General** | Blur, Drop shadow |
| **Color Adjustments** | Brightness, Contrast, Hue rotate, Saturation |
| **Color Effects** | Grayscale, Invert, Sepia |

Checkmark on active types. Selecting an active type scrolls to it.

## Item Layout

**Collapsed**: `[drag] Type: value [eye] [x]`

**Expanded**:
- Filter type dropdown (change type in-place)
- Parameter controls by type:
  - **Blur**: "Radius" slider (0-50px)
  - **Drop shadow**: X, Y, Blur numeric inputs + color swatch
  - **Brightness/Contrast/Saturate**: slider (0-200%)
  - **Hue rotate**: slider (0-360deg)
  - **Grayscale/Invert/Sepia**: slider (0-100%)

## CSS Serialization

Ordered array serialization: `blur(5px) drop-shadow(2px 4px 6px rgba(0,0,0,0.3)) brightness(1.2)`. Hidden items excluded.

## Parser Changes

`parseFilter` returns `FilterItem[]` instead of `Partial<FilterValues>`. Adds `drop-shadow(x y blur color)` parsing.

## Integration

- `EffectsSection` state changes from `Partial<FilterValues>` to `FilterItem[]`
- Reuses `useDragReorder`, `DragHandle`, `VisibilityToggle`, `EditorRemoveButton`
- Same component serves both `filter` and `backdrop-filter`
