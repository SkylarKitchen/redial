---
title: "feat: Enhance CSS Variables Section + Copy as Tailwind Export"
type: feat
date: 2026-03-11
---

## Enhancement Summary

**Deepened on:** 2026-03-11
**Sections enhanced:** 2 features, 7 sections
**Review agents used:** kieran-typescript-reviewer, pattern-recognition-specialist, performance-oracle, julik-frontend-races-reviewer, architecture-strategist, code-simplicity-reviewer, security-sentinel, best-practices-researcher, framework-docs-researcher

### Key Improvements from Review
1. **Feature 1 re-scoped:** CSS Variables Panel already exists as `CSSVariablesSection.tsx` (460 lines). Re-scoped from "build from scratch" to "enhance existing component" with ColorPickerEnhanced, SliderRow, and recursive stylesheet walking.
2. **Feature 2 simplified:** Collapsed 3-tier mapping to 2-tier (drop `EXACT_MAP`). Spacing scale uses formula with exception table. Dropped Cmd+Shift+C for MVP (YAGNI).
3. **Performance concern surfaced:** ~18 stylesheet walks per element selection. Recommend a per-selection cache in a follow-up.
4. **Tailwind v4 changes incorporated:** Parentheses syntax for CSS vars, `!important` suffix change, continuous spacing scale.

### New Considerations Discovered
- Existing `discoverVariables()` only walks `CSSStyleRule` — misses vars inside `@media`, `@supports`, `@layer` blocks
- `@property` registered custom properties are Baseline 2024 — could inform type detection
- Security: CSS variable values rendered as swatch backgrounds could leak via `url()` — existing `detectType` already guards this

---

# Enhance CSS Variables Section + Copy as Tailwind Export

## Overview

Two features for Redial that extend the panel beyond Webflow parity into modern developer tooling:

1. **Enhance CSS Variables Section** — Upgrade the existing `CSSVariablesSection.tsx` with rich controls (ColorPickerEnhanced for colors, SliderRow for numerics) and fix nested rule discovery
2. **Copy as Tailwind** — An export mode that converts the CSS diff to Tailwind v4 utility classes for clipboard

## Problem Statement / Motivation

**CSS Variables Section:** `CSSVariablesSection.tsx` (460 lines) already exists and is wired into WebflowPanel.tsx at line 1537. It discovers variables, classifies them by type, and groups by source. However, all variable types use plain text inputs — color variables don't get the full `ColorPickerEnhanced` (HSB canvas, hue/opacity sliders, swatches), and numeric variables don't get `SliderRow` with drag-to-scrub. Additionally, `discoverVariables()` only walks `CSSStyleRule` instances, missing variables defined inside `@media`, `@supports`, or `@layer` blocks.

**Copy as Tailwind:** The target audience (Next.js developers) overwhelmingly uses Tailwind CSS. The existing "Copy CSS" produces raw CSS rules, but what developers actually want to paste into their JSX is Tailwind classes. This is a natural extension of the existing `diff()` → `formatCSSDiff()` pipeline.

---

## Feature 1: Enhance CSS Variables Section

### Current State (already implemented)

`src/overlay/CSSVariablesSection.tsx` already provides:
- Variable discovery via `discoverVariables()` (walks stylesheets, resolves scopes)
- Type classification via `detectType()` using `HEX_RE`, `LENGTH_RE`, `NUMBER_RE` regexes
- Grouping by source: element, inherited, root
- Inline text editing via `VariableRow` component
- `StyleIndicator` dots for dirty state
- Rendered in WebflowPanel.tsx at line 1537

### Proposed Enhancements

#### 1. Rich controls per variable type

Replace the generic text input in `VariableRow` with type-appropriate controls:

```tsx
// src/overlay/CSSVariablesSection.tsx — VariableRow render update
{variable.type === "color" ? (
  <ColorRow
    label={displayName}
    value={focused ? draft : variable.value}
    onChange={handleChange}
    indicator={dirty ? "element" : "none"}
  />
) : variable.type === "length" || variable.type === "number" ? (
  <SliderRow
    label={displayName}
    value={parseFloat(focused ? draft : variable.value)}
    onChange={(v) => handleChange(`${v}${variable.unit ?? "px"}`)}
    min={0} max={200} step={variable.type === "number" ? 0.1 : 1}
    unit={variable.unit ?? "px"}
    indicator={dirty ? "element" : "none"}
  />
) : (
  /* existing TextRow fallback for string variables */
)}
```

#### 2. Fix nested rule discovery

`discoverVariables()` only checks `CSSStyleRule`. Variables inside `@media`, `@supports`, or `@layer` blocks are missed.

```typescript
// Recursive rule walker for discoverVariables()
function walkRules(rules: CSSRuleList, callback: (rule: CSSStyleRule) => void) {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      callback(rule);
    } else if (
      rule instanceof CSSMediaRule ||
      rule instanceof CSSSupportsRule ||
      rule instanceof CSSLayerBlockRule
    ) {
      walkRules(rule.cssRules, callback);
    }
  }
}
```

#### 3. `@property` type hints (stretch goal)

Registered custom properties (`@property`) have declared syntax types. When present, use them to improve type detection:

```typescript
// Check @property registrations for type hints
function getRegisteredType(name: string): VarType | null {
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSPropertyRule && rule.name === name) {
          if (rule.syntax === '<color>') return 'color';
          if (rule.syntax === '<length>') return 'length';
          if (rule.syntax === '<number>') return 'number';
        }
      }
    } catch { /* CORS */ }
  }
  return null;
}
```

### Research Insights

**Best Practices (from framework-docs-researcher):**
- `getComputedStyle()` returns a live object — the existing pattern of caching it via `useState` is correct
- `getComputedStyle()` for custom properties preserves the authored token stream (e.g., `1.5rem` not `24px`)
- Use `element.style.getPropertyValue()` for detecting inline overrides (existing code does this correctly)

**Performance Considerations (from performance-oracle):**
- ~18 stylesheet walks already happen per element selection across `getAuthoredValue`, `getCustomProperties`, `discoverVariables`, and `getIndicatorType`
- Adding rich controls does NOT add more walks — the data is already discovered. This is a render-only change.
- **Follow-up:** Introduce a per-selection stylesheet cache to deduplicate walks. Not in scope for this feature but logged as tech debt.

**Race Condition Notes (from julik-frontend-races-reviewer):**
- The existing `CSSVariablesSection` correctly uses `useMemo(() => discoverVariables(element), [element])` — synchronous, no stale intermediate state
- Do NOT change to `useEffect` + `useState` (the original plan's approach) — that introduces a stale state window during rapid element switching
- The `applyCustomProperty` undo coalescence (100ms window) already handles rapid edits

**Security (from security-sentinel):**
- CSS variable values rendered as `ColorSwatch` backgrounds could trigger network requests via `url(https://...)`. The existing `detectType` guard (only rendering swatch for recognized color formats) prevents this. No action needed.

### Edge Cases

- **Circular references** (`--a: var(--b); --b: var(--a)`): `getComputedStyle` resolves to empty string. Show as string fallback.
- **`@property` registered types**: Baseline 2024 (Chrome 85+, Firefox 128+, Safari 16.4+). Use `CSSPropertyRule` check when available, fall back to regex detection.
- **Nested `@media` vars**: Fixed by recursive rule walker. Variables in `@media (prefers-color-scheme: dark)` are discovered but may have different resolved values depending on active media.
- **CORS-restricted stylesheets**: `sheet.cssRules` throws `SecurityError` for cross-origin sheets. Existing code already has try/catch — no change needed.

### Files Modified

| File | Change |
|------|--------|
| `src/overlay/CSSVariablesSection.tsx` | Replace text inputs with ColorRow/SliderRow per type (~40 lines changed); add recursive `walkRules` helper (~15 lines) |

### Acceptance Criteria

- [ ] Color variables show ColorRow with full ColorPickerEnhanced (HSB canvas, hue/opacity, swatches)
- [ ] Numeric variables show SliderRow with appropriate range/step and unit
- [ ] String variables retain TextRow fallback
- [ ] Variables inside `@media`/`@supports`/`@layer` blocks are discovered
- [ ] Existing undo/redo, reset, and dirty detection continue to work
- [ ] No new stylesheet walks added (render-only change)
- [ ] Typecheck passes

---

## Feature 2: Copy as Tailwind

### Proposed Solution

Add a `formatTailwindDiff()` function that maps CSS property/value pairs to Tailwind v4 classes. Add a "TW" button next to the existing Copy button in Footer.tsx.

### Technical Approach

#### Simplified 2-Tier Mapping (per simplicity review)

```typescript
// src/overlay/tailwind.ts — new file

/** Convert a CSS diff to a space-separated Tailwind class string. */
export function formatTailwindDiff(
  changes: { prop: string; from: string; to: string }[]
): string {
  return changes
    .map(c => cssToTailwind(c.prop, c.to))
    .filter(Boolean)
    .join(' ');
}

type Converter = (value: string) => string | null;

function cssToTailwind(prop: string, value: string): string | null {
  // Tier 1: Property-specific converter
  const converter = CONVERTERS[prop];
  if (converter) return converter(value);

  // Tier 2: Arbitrary value fallback
  const prefix = PROP_PREFIX[prop];
  if (prefix) return `${prefix}-[${escapeArbitraryValue(value)}]`;

  return null; // unmapped property — silently drop
}

/** Escape characters that break Tailwind's arbitrary value syntax */
function escapeArbitraryValue(v: string): string {
  return v.replace(/_/g, '\\_').replace(/\s+/g, '_');
}
```

#### Spacing Scale (formula + exceptions per simplicity review)

```typescript
// Tailwind v4: spacing is continuous (every 0.25rem = 1px at 16px root)
// But named tokens exist for common values. Use formula with exception map.
const SPACING_EXCEPTIONS: Record<string, string> = {
  '1px': 'px',   // Special: "px" not "0.25"
};

function spacingValue(px: string): string {
  if (SPACING_EXCEPTIONS[px]) return SPACING_EXCEPTIONS[px];
  const num = parseFloat(px);
  if (isNaN(num)) return `[${px}]`;  // arbitrary
  if (num === 0) return '0';
  const tw = num / 4;  // Tailwind v4 spacing: 1 unit = 4px
  if (tw === Math.round(tw)) return String(tw);
  if (tw * 2 === Math.round(tw * 2)) return String(tw); // 0.5 increments
  return `[${px}]`;  // Non-standard → arbitrary
}
```

#### Property Converters

```typescript
const CONVERTERS: Record<string, Converter> = {
  // Display/Position: value IS the class
  'display': (v) => v === 'none' ? 'hidden' : v,
  'position': (v) => v === 'static' ? null : v, // static is default, skip

  // Spacing with scale
  'width': (v) => spaced('w', v),
  'height': (v) => spaced('h', v),
  'min-width': (v) => spaced('min-w', v),
  'max-width': (v) => v === 'none' ? 'max-w-none' : spaced('max-w', v),
  'min-height': (v) => spaced('min-h', v),
  'max-height': (v) => v === 'none' ? 'max-h-none' : spaced('max-h', v),
  'padding-top': (v) => spaced('pt', v),
  'padding-right': (v) => spaced('pr', v),
  'padding-bottom': (v) => spaced('pb', v),
  'padding-left': (v) => spaced('pl', v),
  'margin-top': (v) => spacedSigned('mt', v),
  'margin-right': (v) => spacedSigned('mr', v),
  'margin-bottom': (v) => spacedSigned('mb', v),
  'margin-left': (v) => spacedSigned('ml', v),
  'gap': (v) => spaced('gap', v),
  'row-gap': (v) => spaced('gap-y', v),
  'column-gap': (v) => spaced('gap-x', v),

  // Colors — always arbitrary hex
  'color': (v) => `text-[${v}]`,
  'background-color': (v) => `bg-[${v}]`,
  'border-color': (v) => `border-[${v}]`,

  // Typography
  'font-size': (v) => `text-[${v}]`,
  'font-weight': (v) => `font-[${v}]`,
  'line-height': (v) => `leading-[${v}]`,
  'letter-spacing': (v) => `tracking-[${v}]`,
  'text-align': (v) => `text-${v}`,
  'text-decoration-line': (v) => v === 'none' ? 'no-underline' : v,
  'text-transform': (v) => v === 'none' ? 'normal-case' : v,

  // Layout
  'flex-direction': (v) => `flex-${v.replace('column', 'col')}`,
  'flex-wrap': (v) => v === 'nowrap' ? 'flex-nowrap' : `flex-${v}`,
  'justify-content': (v) => `justify-${v.replace('flex-', '').replace('space-', '')}`,
  'align-items': (v) => `items-${v.replace('flex-', '')}`,
  'flex-grow': (v) => v === '1' ? 'grow' : v === '0' ? 'grow-0' : `grow-[${v}]`,
  'flex-shrink': (v) => v === '1' ? 'shrink' : v === '0' ? 'shrink-0' : `shrink-[${v}]`,
  'flex-basis': (v) => spaced('basis', v),
  'order': (v) => `order-[${v}]`,

  // Position
  'top': (v) => spaced('top', v),
  'right': (v) => spaced('right', v),
  'bottom': (v) => spaced('bottom', v),
  'left': (v) => spaced('left', v),
  'z-index': (v) => v === 'auto' ? 'z-auto' : `z-[${v}]`,

  // Effects
  'opacity': (v) => `opacity-[${v}]`,
  'border-radius': (v) => `rounded-[${v}]`,
  'border-width': (v) => v === '1px' ? 'border' : `border-[${v}]`,
  'overflow': (v) => `overflow-${v}`,
  'cursor': (v) => `cursor-${v}`,
  'mix-blend-mode': (v) => `mix-blend-${v}`,
};

// Helpers
function spaced(prefix: string, v: string): string {
  if (v === 'auto') return `${prefix}-auto`;
  const tw = spacingValue(v);
  return tw.startsWith('[') ? `${prefix}-${tw}` : `${prefix}-${tw}`;
}

function spacedSigned(prefix: string, v: string): string {
  if (v === 'auto') return `${prefix}-auto`;
  const num = parseFloat(v);
  if (num < 0) return `-${prefix}-${spacingValue(v.replace('-', ''))}`;
  return spaced(prefix, v);
}
```

### Research Insights

**Tailwind v4 Changes (from best-practices-researcher):**
- Arbitrary value syntax `[value]` is unchanged in v4
- **New in v4:** Parentheses syntax for CSS vars: `bg-(--brand-color)` instead of `bg-[var(--brand-color)]`
- **New in v4:** Continuous spacing scale — bare numbers like `w-100` (= 25rem). No brackets needed for multiples of 4px.
- **Breaking in v4:** `!important` modifier moved from prefix (`!flex`) to suffix (`flex!`). Our output doesn't use `!important` so no impact.
- No existing open-source library supports Tailwind v4. Building a custom lookup is the right approach.

**Architecture Notes (from architecture-strategist):**
- `tailwind.ts` at `src/overlay/tailwind.ts` is correct granularity — pure function, no React deps, independently testable
- Consistent with other service files: `unitConversion.ts`, `colorUtils.ts`, `cssParsers.ts`
- If a second format is added later (UnoCSS, vanilla-extract), extract to `src/overlay/formatters/` directory then. Premature now.
- Format state lives in Footer (local) — no need to lift to Overlay for MVP

**Simplicity Notes (from code-simplicity-reviewer):**
- Dropped `EXACT_MAP` table — converters handle the same cases
- Spacing scale uses formula (`num / 4`) with exception for `1px → px`
- Dropped `Cmd+Shift+C` for MVP — YAGNI, "TW" button is sufficient
- SessionDrawer TW button is stretch goal, not required for MVP

**Security Notes (from security-sentinel):**
- `escapeArbitraryValue()` prevents bracket injection (`]` in values could break Tailwind syntax)
- CSS values are clipboard-only — no XSS risk unless pasted into `dangerouslySetInnerHTML` (user responsibility)
- No sensitive data concerns — tool only reads visible CSS properties

### User Flows

| # | Flow | Behavior |
|---|------|----------|
| 1 | Click "TW" button | Copies Tailwind classes to clipboard: `"flex gap-4 pt-6 rounded-[8px] bg-[#1e1e1e]"` |
| 2 | Click "Copy" button | Unchanged — still copies CSS rule block |
| 3 | Cmd+C shortcut | Still copies CSS (default, unchanged) |
| 4 | Arbitrary values | Uses bracket syntax: `w-[120px]`, `text-[#E8764B]`, `tracking-[0.05em]` |
| 5 | No Tailwind mapping | Silently dropped (unmapped props don't appear in output) |
| 6 | Empty diff | Button disabled (same as existing Copy) |
| 7 | CSS Variables | Uses Tailwind v4 parentheses: `bg-(--brand-color)` |

### Edge Cases

- **Negative values**: `margin-top: -8px` → `-mt-2` (Tailwind's negative prefix)
- **`auto` keyword**: `margin-left: auto` → `ml-auto`, `width: auto` → `w-auto`
- **`none` keyword**: `max-width: none` → `max-w-none`, `display: none` → `hidden`
- **Complex values**: `box-shadow`, `transform`, `filter` → arbitrary value with underscores for spaces
- **Calc/var values**: `width: calc(100% - 32px)` → `w-[calc(100%-32px)]` (spaces become underscores)
- **`text-` ambiguity**: Resolved by having separate converters per CSS property — `color` → `text-[#hex]`, `font-size` → `text-[16px]`, `text-align` → `text-left`. No ambiguity because source property is known.
- **Tailwind v4 CSS vars**: `var(--foo)` values → `prop-(--foo)` syntax

### Files Modified

| File | Change |
|------|--------|
| `src/overlay/tailwind.ts` | **New file** — `formatTailwindDiff()` + converters (~150 lines) |
| `src/overlay/Footer.tsx` | Add "TW" button + handler (~15 lines) |

### Acceptance Criteria

- [ ] "TW" button in Footer copies Tailwind classes to clipboard
- [ ] Standard spacing values map via formula (`16px` → `4`, `24px` → `6`)
- [ ] Non-standard values use arbitrary syntax (`w-[120px]`)
- [ ] Colors use arbitrary hex (`bg-[#1e1e1e]`)
- [ ] Negative margins use negative prefix (`-mt-2`)
- [ ] `auto`/`none` keywords map correctly
- [ ] Display/position values map to bare class names (`flex`, `absolute`)
- [ ] Toast shows "Copied Tailwind!" on success
- [ ] Unit tests for `formatTailwindDiff` covering: spacing, colors, keywords, negatives, arbitrary values
- [ ] Typecheck passes

---

## Implementation Phases

### Phase 1: Enhance CSS Variables Section (~55 lines changed)

**Tasks:**
1. In `CSSVariablesSection.tsx`, replace text inputs with `ColorRow` for color vars and `SliderRow` for length/number vars
2. Add recursive `walkRules` helper to `discoverVariables()` for nested `@media`/`@supports`/`@layer`
3. Verify existing undo/redo/reset still works with new controls
4. Add to ITERATION_LOG.md

### Phase 2: Copy as Tailwind (~165 lines new code)

**Tasks:**
1. Create `src/overlay/tailwind.ts` — 2-tier converter with property converters + arbitrary fallback
2. Add `spacingValue()` formula with `1px` exception
3. Add `escapeArbitraryValue()` for bracket safety
4. Add "TW" button in Footer.tsx with `handleCopyTailwind` handler
5. Write unit tests for `tailwind.ts` (spacing, colors, keywords, negatives, arbitrary, CSS vars)
6. Add to ITERATION_LOG.md

---

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Tailwind v4 class syntax may evolve | Arbitrary `[value]` is stable escape hatch; converters are easy to update |
| `text-` prefix ambiguity | Resolved architecturally: separate converters per CSS property, not per Tailwind prefix |
| Stylesheet walk performance (18+ walks/selection) | Not worsened by Feature 1 (render-only change). Follow-up: per-selection cache. |
| Nested `@media` vars may have different resolved values per breakpoint | `getComputedStyle` returns the currently-active value. Document that discovery reflects current viewport state. |

## References

### Internal References
- `src/overlay/CSSVariablesSection.tsx` — existing 460-line component to enhance
- `src/overlay/CSSVariablesSection.tsx:68` — `detectType()` classification logic
- `src/overlay/CSSVariablesSection.tsx:88-206` — `discoverVariables()` pipeline
- `src/overlay/util.ts:132-141` — `formatCSSDiff()` pattern to parallel
- `src/overlay/Footer.tsx:44-49` — existing copy handler
- `src/overlay/controls.tsx` — ColorRow, SliderRow, TextRow components
- `src/overlay/apply.ts:543-599` — `applyCustomProperty()` with undo
- `src/overlay/unitConversion.ts` — existing pure-function module pattern (model for tailwind.ts)
