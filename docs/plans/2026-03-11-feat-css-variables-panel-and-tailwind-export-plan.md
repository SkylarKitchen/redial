---
title: "feat: CSS Variables Panel + Copy as Tailwind Export"
type: feat
date: 2026-03-11
---

# CSS Variables Panel + Copy as Tailwind Export

## Overview

Two new features for Redial that extend the panel beyond Webflow parity into modern developer tooling:

1. **CSS Variables Panel** — A new section that discovers and edits CSS custom properties (`--var-name`) on the selected element with live updates across all consumers
2. **Copy as Tailwind** — An export mode that converts the CSS diff to Tailwind utility classes for clipboard

Both features leverage existing infrastructure heavily: `scope.ts` already discovers variables, `apply.ts` already has custom property support, and `util.ts` already has the `formatCSSDiff` pipeline.

## Problem Statement / Motivation

**CSS Variables Panel:** Modern CSS relies heavily on custom properties for theming, spacing scales, and design tokens. Redial can read and write them (`getCustomProperties`, `applyCustomProperty`) but WebflowPanel.tsx doesn't expose this — it's wired only to the old DialKit-based Panel.tsx. Users editing a Next.js app with CSS variables (which is most of them) can't see or tune their design tokens.

**Copy as Tailwind:** The target audience (Next.js developers) overwhelmingly uses Tailwind CSS. The existing "Copy CSS" produces raw CSS rules, but what developers actually want to paste into their JSX is Tailwind classes. This is a natural extension of the existing `diff()` → `formatCSSDiff()` pipeline.

---

## Feature 1: CSS Variables Panel

### Proposed Solution

Add a new collapsible `<Section title="Variables">` at the bottom of WebflowPanel.tsx (after Effects). It reads custom properties from `getCustomProperties(element)`, classifies them (color / numeric / string), and renders appropriate controls.

### Technical Approach

#### State

```typescript
// src/overlay/WebflowPanel.tsx — new state block
const [customProps, setCustomProps] = useState<CustomProp[]>([]);
const [varValues, setVarValues] = useState<Record<string, string>>({});

// Initialize on element change
useEffect(() => {
  const props = getCustomProperties(element);
  setCustomProps(props);
  const vals: Record<string, string> = {};
  props.forEach(p => { vals[p.name] = p.value; });
  setVarValues(vals);
}, [element]);
```

#### Handlers

```typescript
const handleVarChange = useCallback((cp: CustomProp, value: string) => {
  setVarValues(prev => ({ ...prev, [cp.name]: value }));
  applyCustomProperty(cp.scope, cp.name, value);
  onDirtyChange?.();
}, [onDirtyChange]);
```

#### Render

```tsx
{customProps.length > 0 && (
  <Section title="Variables" collapsed indicator={/* custom check */}>
    {/* Color variables */}
    {colorVars.map(cp => (
      <ColorRow
        key={cp.name}
        label={cp.name.replace('--', '')}
        value={varValues[cp.name]}
        onChange={v => handleVarChange(cp, v)}
      />
    ))}
    {/* Numeric variables */}
    {numericVars.map(cp => (
      <SliderRow
        key={cp.name}
        label={cp.name.replace('--', '')}
        value={parseFloat(varValues[cp.name])}
        onChange={v => handleVarChange(cp, `${v}${varUnit}`)}
        min={0} max={200} step={1}
      />
    ))}
    {/* String variables (font-family, etc.) */}
    {stringVars.map(cp => (
      <TextRow
        key={cp.name}
        label={cp.name.replace('--', '')}
        value={varValues[cp.name]}
        onChange={v => handleVarChange(cp, v)}
      />
    ))}
    {/* Scope badges showing where each var is defined */}
  </Section>
)}
```

#### Classification Logic

Extract/export the existing helpers from `infer.ts` (currently private):

```typescript
// src/overlay/varClassify.ts
export function isColorValue(v: string): boolean { /* hex, rgb, hsl, named */ }
export function isNumericValue(v: string): boolean { /* digits + optional unit */ }
export function parseVarUnit(v: string): { num: number; unit: string } { ... }
```

### User Flows

| # | Flow | Behavior |
|---|------|----------|
| 1 | Select element with CSS vars | Variables section appears (collapsed by default), showing all vars grouped by type |
| 2 | Edit a color variable | ColorRow opens ColorPickerEnhanced; change propagates to all elements using that var |
| 3 | Edit a numeric variable | SliderRow or ValueInput; live update on the var's scope element |
| 4 | Undo a variable change | Cmd+Z reverts via existing `applyCustomProperty` undo stack integration |
| 5 | Reset all | `resetAll()` in apply.ts already clears custom property overrides |
| 6 | Element has no vars | Section is hidden entirely (`customProps.length > 0` guard) |
| 7 | Var defined on `:root` | Scope badge shows ":root" — editing affects entire page |
| 8 | Var defined on ancestor | Scope badge shows the selector — editing affects that subtree |
| 9 | Same var name, different scopes | Show both with scope disambiguation |
| 10 | Save to source | Variable changes included in `diff()` output → `commit.ts` writes them |

### Edge Cases

- **Circular references** (`--a: var(--b); --b: var(--a)`): `getComputedStyle` resolves these to empty string. Show as string fallback with a warning icon.
- **Registered custom properties** (`@property`): These have type constraints. For MVP, treat all as untyped.
- **Dark mode / media query vars**: Variables from `@media (prefers-color-scheme: dark)` may not appear in `getComputedStyle` if not currently active. Document as known limitation.
- **Transition on var change**: CSS transitions on properties using `var()` may not fire for inline overrides. This matches existing behavior.
- **Large var count**: Pages with 50+ CSS variables (design systems) need virtualization or a search filter. For MVP, cap display at 30 with a "Show all" toggle.

### Files Modified

| File | Change |
|------|--------|
| `src/overlay/WebflowPanel.tsx` | New Variables section (~60 lines of state + ~80 lines of JSX) |
| `src/overlay/varClassify.ts` | **New file** — exported classification helpers (~40 lines) |
| `src/overlay/scope.ts` | No changes needed (already exports `getCustomProperties`) |
| `src/overlay/apply.ts` | No changes needed (already has `applyCustomProperty`) |

---

## Feature 2: Copy as Tailwind

### Proposed Solution

Add a `formatTailwindDiff()` function that maps CSS property/value pairs to Tailwind classes. Add a "TW" toggle button next to the existing Copy button in Footer.tsx.

### Technical Approach

#### Mapping Function

```typescript
// src/overlay/tailwind.ts — new file

export function formatTailwindDiff(
  changes: { prop: string; from: string; to: string }[]
): string {
  return changes
    .map(c => cssToTailwind(c.prop, c.to))
    .filter(Boolean)
    .join(' ');
}

function cssToTailwind(prop: string, value: string): string | null {
  // 1. Check exact match table first (fast path)
  const exact = EXACT_MAP[`${prop}:${value}`];
  if (exact) return exact;

  // 2. Check property-specific converter
  const converter = PROP_CONVERTERS[prop];
  if (converter) return converter(value);

  // 3. Fallback: arbitrary value syntax
  const twProp = CSS_TO_TW_PROP[prop];
  if (twProp) return `${twProp}-[${value}]`;

  // 4. No mapping possible
  return `/* ${prop}: ${value} */`;
}
```

#### Core Mapping Tables

```typescript
// Spacing scale: 4px = 1 unit (Tailwind default)
const SPACING_SCALE: Record<string, string> = {
  '0px': '0', '1px': 'px', '2px': '0.5', '4px': '1', '6px': '1.5',
  '8px': '2', '10px': '2.5', '12px': '3', '14px': '3.5', '16px': '4',
  '20px': '5', '24px': '6', '28px': '7', '32px': '8', '36px': '9',
  '40px': '10', '44px': '11', '48px': '12', '56px': '14', '64px': '16',
  '80px': '20', '96px': '24',
};

// Property prefix map
const CSS_TO_TW_PROP: Record<string, string> = {
  'display': '', // special: value IS the class
  'position': '', // special: value IS the class
  'width': 'w', 'height': 'h',
  'min-width': 'min-w', 'max-width': 'max-w',
  'min-height': 'min-h', 'max-height': 'max-h',
  'padding-top': 'pt', 'padding-right': 'pr',
  'padding-bottom': 'pb', 'padding-left': 'pl',
  'margin-top': 'mt', 'margin-right': 'mr',
  'margin-bottom': 'mb', 'margin-left': 'ml',
  'gap': 'gap', 'row-gap': 'gap-y', 'column-gap': 'gap-x',
  'font-size': 'text', 'font-weight': 'font',
  'line-height': 'leading', 'letter-spacing': 'tracking',
  'color': 'text', 'background-color': 'bg',
  'border-radius': 'rounded', 'border-width': 'border',
  'border-color': 'border',
  'opacity': 'opacity', 'z-index': 'z',
  'top': 'top', 'right': 'right', 'bottom': 'bottom', 'left': 'left',
  'flex-grow': 'grow', 'flex-shrink': 'shrink',
  'flex-basis': 'basis', 'order': 'order',
  'justify-content': 'justify', 'align-items': 'items',
  'flex-wrap': 'flex', 'flex-direction': 'flex',
  'overflow': 'overflow', 'cursor': 'cursor',
  'text-align': 'text', 'text-decoration-line': 'decoration',
  'text-transform': '', // special
  'box-shadow': 'shadow', 'filter': '', // complex
  'mix-blend-mode': 'mix-blend',
};
```

#### Footer UI

```tsx
// src/overlay/Footer.tsx — add TW toggle next to Copy
<div style={{ display: 'flex', gap: 4 }}>
  <FooterButton onClick={handleCopy} title="Copy CSS">
    Copy
  </FooterButton>
  <FooterButton
    onClick={handleCopyTailwind}
    title="Copy as Tailwind classes"
    style={twActive ? { background: 'rgba(99,102,241,0.3)' } : undefined}
  >
    TW
  </FooterButton>
</div>
```

### User Flows

| # | Flow | Behavior |
|---|------|----------|
| 1 | Click "TW" button | Copies Tailwind classes to clipboard: `"flex gap-4 p-6 rounded-lg bg-[#1e1e1e]"` |
| 2 | Click "Copy" button | Unchanged — still copies CSS rule block |
| 3 | Cmd+C shortcut | Copies CSS (default). Could add Cmd+Shift+C for Tailwind variant |
| 4 | Arbitrary values | Uses bracket syntax: `w-[120px]`, `text-[#E8764B]`, `tracking-[0.05em]` |
| 5 | No Tailwind equivalent | Includes CSS comment: `/* backdrop-filter: blur(8px) */` or uses arbitrary: `backdrop-blur-[8px]` |
| 6 | Session "Copy All" | SessionDrawer gets a parallel TW button |
| 7 | Empty diff | Button disabled (same as existing Copy) |

### Edge Cases

- **Shorthand expansion**: `padding: 16px 24px` needs to become `py-4 px-6` (detect symmetric values)
- **Color mapping**: Hex colors → Tailwind's arbitrary `bg-[#hex]` (don't try to match named colors — too fragile)
- **Negative values**: `margin-top: -8px` → `-mt-2` (Tailwind's negative prefix)
- **`auto` keyword**: `margin-left: auto` → `ml-auto`, `width: auto` → `w-auto`
- **`none` keyword**: `max-width: none` → `max-w-none`, `display: none` → `hidden`
- **Complex values**: `box-shadow`, `transform`, `filter` → use arbitrary value syntax or skip with comment
- **Calc/var values**: `width: calc(100% - 32px)` → `w-[calc(100%-32px)]`
- **Multiple text utilities**: `text-` prefix is overloaded (color vs size vs align). Disambiguate by checking if value is a color, size, or keyword.

### Files Modified

| File | Change |
|------|--------|
| `src/overlay/tailwind.ts` | **New file** — `formatTailwindDiff()` + mapping tables (~200 lines) |
| `src/overlay/Footer.tsx` | Add "TW" button (~15 lines) |
| `src/overlay/Overlay.tsx` | Optional: Cmd+Shift+C shortcut for Tailwind copy (~5 lines) |
| `src/overlay/SessionDrawer.tsx` | Add "TW" copy option (~10 lines) |

---

## Acceptance Criteria

### Feature 1: CSS Variables Panel

- [ ] Variables section appears when element uses CSS custom properties
- [ ] Section hidden when no variables are present
- [ ] Color variables show ColorRow with full ColorPickerEnhanced
- [ ] Numeric variables show SliderRow with appropriate range/step
- [ ] String variables show TextRow for free-text editing
- [ ] Editing a variable updates all elements using it in real-time
- [ ] Scope badge shows where each variable is defined (`:root`, `.theme-dark`, etc.)
- [ ] Undo/redo works for variable changes
- [ ] Reset clears variable overrides
- [ ] Variable changes appear in `diff()` output and can be saved
- [ ] StyleIndicator dot shows on Variables section header when any var is overridden
- [ ] Section starts collapsed by default
- [ ] Typecheck passes

### Feature 2: Copy as Tailwind

- [ ] "TW" button in Footer copies Tailwind classes to clipboard
- [ ] Standard spacing values map to Tailwind scale (`16px` → `4`, `24px` → `6`)
- [ ] Non-standard values use arbitrary syntax (`w-[120px]`)
- [ ] Colors use arbitrary hex (`bg-[#1e1e1e]`)
- [ ] Negative margins use negative prefix (`-mt-2`)
- [ ] `auto`/`none` keywords map correctly
- [ ] Display/position values map to bare class names (`flex`, `absolute`)
- [ ] Complex properties (shadow, transform) use arbitrary or comment fallback
- [ ] Toast shows "Copied Tailwind!" on success
- [ ] Cmd+Shift+C shortcut triggers Tailwind copy
- [ ] SessionDrawer "Copy All" has Tailwind option
- [ ] Unit tests for `formatTailwindDiff` covering all property categories
- [ ] Typecheck passes

---

## Implementation Phases

### Phase 1: CSS Variables Panel (estimated ~140 lines new code)

**Tasks:**
1. Create `src/overlay/varClassify.ts` — export `isColorValue`, `isNumericValue`, `parseVarUnit`
2. Add Variables section state + handlers in WebflowPanel.tsx
3. Add Variables section JSX using existing controls (ColorRow, SliderRow, TextRow)
4. Add scope badges (small `:root` / `.class` label per variable)
5. Wire StyleIndicator using `isCustomPropertyDirty()` from apply.ts
6. Add to ITERATION_LOG.md

### Phase 2: Copy as Tailwind (estimated ~230 lines new code)

**Tasks:**
1. Create `src/overlay/tailwind.ts` — property mapping tables + `formatTailwindDiff()`
2. Add `cssToTailwind()` converter with spacing scale, property-specific converters, and arbitrary fallback
3. Add "TW" button in Footer.tsx
4. Add `handleCopyTailwind` handler in Footer
5. Wire Cmd+Shift+C shortcut in Overlay.tsx
6. Add TW copy option to SessionDrawer.tsx
7. Write unit tests for `tailwind.ts` (spacing, colors, keywords, negatives, arbitrary)
8. Add to ITERATION_LOG.md

---

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Large var count on design-system-heavy pages | Cap at 30 vars with "Show all" toggle; consider search filter in v2 |
| Tailwind mapping incompleteness | Arbitrary `[value]` syntax is the universal escape hatch — always produces valid TW |
| `text-` prefix ambiguity (color vs size vs align) | Disambiguate by checking value type: hex/rgb → color, `px/rem` → size, `left/center` → align |
| Custom properties from shadow DOM | `getCustomProperties` only walks light DOM stylesheets. Document as limitation. |

## References

### Internal References
- `src/overlay/scope.ts:getCustomProperties()` — variable discovery
- `src/overlay/apply.ts:applyCustomProperty()` — variable editing with undo
- `src/overlay/apply.ts:isCustomPropertyDirty()` — dirty detection
- `src/overlay/infer.ts:479-513` — existing var classification (color/numeric) for old Panel
- `src/overlay/util.ts:132-141` — `formatCSSDiff()` pattern to parallel
- `src/overlay/Footer.tsx:44-49` — existing copy handler
- `src/overlay/controls.tsx` — Section, ColorRow, SliderRow, TextRow components
