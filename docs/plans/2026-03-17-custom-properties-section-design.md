# Custom Properties Section — Design

## Overview

New 9th section at bottom of WebflowPanel. Free-form `property : value` text pairs with property autocomplete. Escape hatch for CSS properties not covered by the 8 structured sections. Matches Webflow's "Custom properties" UX.

## UI States

**Empty:** Collapsible "Custom properties" section with `+ Add` button inside bordered container.

**Adding:** Clicking `+ Add` shows inline row:
- Property input (left) — searchable dropdown of all CSS properties, filters as you type
- Value input (right) — free-text, placeholder "value"
- Delete button (trash icon, right edge)

**Populated:** Each entry renders as `property : value` row. Inline editable. `+ Add` stays at bottom.

## Data Model

```ts
type CustomEntry = { id: string; property: string; value: string };
```

Per-element state in `Map<Element, CustomEntry[]>`. Auto-populated from existing inline style overrides on element selection.

## Integration

- **Apply:** `ctx.apply(property, value)` — no core changes
- **Undo/redo:** Free via `applyInlineStyle`
- **Save-to-source:** Free via `diff()` → `commitUtils.ts`
- **Indicators:** `ctx.ind(property)` for modified dots
- **Search:** "Custom properties" + entry names in `sectionMatchesQuery`
- **Focus mode:** Standard `focusOpen`/`onToggle` props

## Property Autocomplete

Static array of ~350 standard CSS properties + ~30 common `-webkit-*` prefixes. Portal dropdown via `usePortalDropdown`. Keyboard navigable via `useDropdownKeyboard`. Free-text allowed for unlisted properties.

## Files

| File | Change |
|------|--------|
| `sections/CustomPropertiesSection.tsx` | **New** ~300 lines |
| `sections/cssPropertyList.ts` | **New** — static property name array |
| `shell/WebflowPanel.tsx` | Add 9th section |
| `shell/PropertySearch.tsx` | Add "Custom properties" to search |

## Out of Scope

- Type-aware controls (color picker, slider for known value types)
- Variable linking on custom entries
- Cross-element sticky property templates
