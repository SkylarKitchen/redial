# Custom Properties Section — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 9th "Custom properties" section to the panel — free-form property:value pairs with autocomplete, matching Webflow's UX.

**Architecture:** New `CustomPropertiesSection.tsx` receives `SectionCtx` like all other sections. Uses `ctx.apply()` for style changes (undo/redo/save free). Per-element entry state in local component state, auto-populated from `diff(element)`. Property autocomplete via static array + portal dropdown.

**Tech Stack:** React (inline styles), existing controls (`Section`), `usePortalDropdown`, `useDropdownKeyboard`, `diff()` from `apply.ts`.

---

### Task 1: CSS Property List

**Files:**
- Create: `src/overlay/sections/cssPropertyList.ts`
- Test: `src/overlay/__tests__/cssPropertyList.test.ts`

**Step 1: Write the failing test**

```ts
// src/overlay/__tests__/cssPropertyList.test.ts
import { describe, it, expect } from "vitest";
import { CSS_PROPERTIES } from "../sections/cssPropertyList";

describe("cssPropertyList", () => {
  it("exports a non-empty array of strings", () => {
    expect(Array.isArray(CSS_PROPERTIES)).toBe(true);
    expect(CSS_PROPERTIES.length).toBeGreaterThan(300);
  });

  it("includes common standard properties", () => {
    const common = ["display", "color", "width", "height", "margin", "padding", "font-size", "position", "z-index", "opacity"];
    for (const prop of common) {
      expect(CSS_PROPERTIES).toContain(prop);
    }
  });

  it("includes common webkit prefixed properties", () => {
    expect(CSS_PROPERTIES).toContain("-webkit-text-fill-color");
    expect(CSS_PROPERTIES).toContain("-webkit-text-stroke-color");
  });

  it("is sorted alphabetically", () => {
    const sorted = [...CSS_PROPERTIES].sort((a, b) => a.localeCompare(b));
    expect(CSS_PROPERTIES).toEqual(sorted);
  });

  it("has no duplicates", () => {
    const unique = new Set(CSS_PROPERTIES);
    expect(unique.size).toBe(CSS_PROPERTIES.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/overlay/__tests__/cssPropertyList.test.ts`
Expected: FAIL — module not found

**Step 3: Write the property list**

```ts
// src/overlay/sections/cssPropertyList.ts
/**
 * cssPropertyList.ts — Complete list of CSS properties for autocomplete.
 * Sorted alphabetically. Includes standard + common -webkit-* prefixes.
 */

export const CSS_PROPERTIES: string[] = [
  // Generate from MDN standard properties list (~350 standard + ~30 webkit)
  // Must be alphabetically sorted, no duplicates
  // Include: all standard CSS properties
  // Include: -webkit-text-fill-color, -webkit-text-stroke-color,
  //   -webkit-text-stroke-width, -webkit-line-clamp, -webkit-appearance,
  //   -webkit-background-clip, -webkit-text-security, -webkit-overflow-scrolling,
  //   -webkit-tap-highlight-color, -webkit-font-smoothing, etc.
  // Exclude: @-rules, pseudo-elements, ::selectors
  // Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference
].sort((a, b) => a.localeCompare(b));
```

Note: The implementer should generate the full list from MDN. The test validates the shape. Target 350-400 entries.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/overlay/__tests__/cssPropertyList.test.ts`
Expected: PASS

**Step 5: Commit**

```
git add src/overlay/sections/cssPropertyList.ts src/overlay/__tests__/cssPropertyList.test.ts
git commit -m "feat: add CSS property name list for custom properties autocomplete"
```

---

### Task 2: CustomPropertiesSection — Empty & Add States

**Files:**
- Create: `src/overlay/sections/CustomPropertiesSection.tsx`
- Test: `src/overlay/__tests__/CustomPropertiesSection.test.ts`

**Step 1: Write the failing tests**

```ts
// src/overlay/__tests__/CustomPropertiesSection.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the data model and entry management logic.
// Full render tests require the DOM + SectionCtx which is complex,
// so we focus on the core logic.

describe("CustomPropertiesSection", () => {
  it("module exports CustomPropertiesSection component", async () => {
    const mod = await import("../sections/CustomPropertiesSection");
    expect(mod.CustomPropertiesSection).toBeDefined();
    expect(typeof mod.CustomPropertiesSection).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/overlay/__tests__/CustomPropertiesSection.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the section component**

Create `src/overlay/sections/CustomPropertiesSection.tsx` with:

- `CustomEntry` type: `{ id: string; property: string; value: string }`
- Component receives `ctx: SectionCtx`, `forceOpen?`, `focusOpen?`, `onToggle?`
- State: `entries: CustomEntry[]` — starts empty
- Auto-populate from `diff(ctx.element)` on mount (only properties not in SECTION_PROPERTIES)
- Wraps in `<Section title="Custom properties" collapsed>`
- Empty state: bordered container with `+ Add` button
- Populated state: list of entry rows + `+ Add` at bottom
- `+ Add` click: appends `{ id: crypto.randomUUID(), property: "", value: "" }` to entries

Key patterns to follow (from existing sections):
- Import `Section` from `"../controls"`
- Import theme tokens: `text, border, surface, font, color` from `"../theme"`
- Import `ROW` from `"../panelStyles"`
- Import `ms` from `"../timing"` for transitions
- All inline styles, no CSS files
- Use `data-tuner-portal` on any portals

Entry row layout:
```
[ property input ] : [ value input ] [ trash icon ]
```

Property input: text input with placeholder "property". On focus, show autocomplete dropdown.
Value input: text input with placeholder "value". On blur/Enter, call `ctx.apply(property, value)`.
Trash icon: `Trash2` from lucide-react, removes entry and calls `resetProp(element, property)`.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/overlay/__tests__/CustomPropertiesSection.test.ts`
Expected: PASS

**Step 5: Commit**

```
git add src/overlay/sections/CustomPropertiesSection.tsx src/overlay/__tests__/CustomPropertiesSection.test.ts
git commit -m "feat: add CustomPropertiesSection shell with add/remove entries"
```

---

### Task 3: Property Autocomplete Dropdown

**Files:**
- Modify: `src/overlay/sections/CustomPropertiesSection.tsx`
- Test: `src/overlay/__tests__/CustomPropertiesSection.test.ts`

**Step 1: Write the failing test**

Add to the test file:

```ts
describe("property filtering", () => {
  it("filters CSS_PROPERTIES by substring match", async () => {
    const { filterProperties } = await import("../sections/CustomPropertiesSection");
    const results = filterProperties("flex");
    expect(results).toContain("flex");
    expect(results).toContain("flex-direction");
    expect(results).toContain("flex-wrap");
    expect(results).not.toContain("color");
  });

  it("returns top 12 results max", async () => {
    const { filterProperties } = await import("../sections/CustomPropertiesSection");
    const results = filterProperties("a");
    expect(results.length).toBeLessThanOrEqual(12);
  });

  it("returns empty array for empty query", async () => {
    const { filterProperties } = await import("../sections/CustomPropertiesSection");
    expect(filterProperties("")).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/overlay/__tests__/CustomPropertiesSection.test.ts`
Expected: FAIL — filterProperties not exported

**Step 3: Implement the autocomplete**

Add to `CustomPropertiesSection.tsx`:

1. Export `filterProperties(query: string): string[]` — filters `CSS_PROPERTIES` by substring, returns top 12 matches, prioritizes exact-start matches over substring matches.

2. Inside the property input, add a `PropertyAutocomplete` internal component:
   - Renders a portal dropdown (use `createPortal` to `document.body` with `data-tuner-portal`)
   - Position below the input using `getBoundingClientRect()`
   - Shows filtered results as a scrollable list
   - Arrow keys navigate (up/down), Enter selects, Escape closes
   - Clicking an option selects it
   - Styled with `surface.elevated`, `border.default`, `text.primary` tokens
   - Max height 240px, overflow-y auto
   - Each row: property name, monospace font, hover highlight

**Step 4: Run tests**

Run: `npm test -- --run src/overlay/__tests__/CustomPropertiesSection.test.ts`
Expected: PASS

**Step 5: Commit**

```
git add src/overlay/sections/CustomPropertiesSection.tsx src/overlay/__tests__/CustomPropertiesSection.test.ts
git commit -m "feat: add property autocomplete dropdown to custom properties section"
```

---

### Task 4: Wire Into WebflowPanel + PropertySearch

**Files:**
- Modify: `src/overlay/shell/WebflowPanel.tsx` (add 9th section after Effects)
- Modify: `src/overlay/shell/PropertySearch.tsx` (add "Custom properties" to SECTION_PROPERTIES)

**Step 1: Write the failing test**

```ts
// Add to existing WebflowPanel tests if they exist, or create:
// src/overlay/__tests__/customPropertiesIntegration.test.ts
import { describe, it, expect } from "vitest";
import { sectionMatchesQuery, SECTION_PROPERTIES } from "../shell/PropertySearch";

describe("Custom properties in PropertySearch", () => {
  it("SECTION_PROPERTIES includes 'Custom properties' key", () => {
    expect(SECTION_PROPERTIES).toHaveProperty("Custom properties");
  });

  it("matches search for 'custom'", () => {
    expect(sectionMatchesQuery("Custom properties", "custom")).toBe(true);
  });

  it("matches search for 'cursor' (escape hatch property)", () => {
    expect(sectionMatchesQuery("Custom properties", "cursor")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/overlay/__tests__/customPropertiesIntegration.test.ts`
Expected: FAIL — "Custom properties" not in SECTION_PROPERTIES

**Step 3: Wire it up**

In `PropertySearch.tsx`, add to `SECTION_PROPERTIES`:
```ts
"Custom properties": [
  "custom", "property", "css",
  // Include a sampling of common "uncovered" properties so search finds this section
  "cursor", "pointer-events", "user-select", "scroll-snap-type",
  "scroll-snap-align", "clip-path", "mask", "will-change", "contain",
  "content-visibility", "accent-color", "caret-color", "touch-action",
  "scroll-behavior", "overscroll-behavior", "resize", "appearance",
  "isolation", "writing-mode", "text-orientation",
],
```

In `WebflowPanel.tsx`:
1. Import `CustomPropertiesSection` from `"../sections/CustomPropertiesSection"`
2. Add after the Effects section (section 8):
```tsx
{/* 9. Custom properties */}
{showSection("Custom properties") && (
  <CustomPropertiesSection
    ctx={ctx}
    forceOpen={forceOpen}
    {...focusProps("Custom properties")}
  />
)}
```
3. Add "Custom properties" to the `noResults` check array.

**Step 4: Run tests**

Run: `npm test -- --run src/overlay/__tests__/customPropertiesIntegration.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing + new)

**Step 6: Commit**

```
git add src/overlay/shell/WebflowPanel.tsx src/overlay/shell/PropertySearch.tsx src/overlay/__tests__/customPropertiesIntegration.test.ts
git commit -m "feat: wire CustomPropertiesSection into panel as 9th section"
```

---

### Task 5: Auto-Populate From Existing Overrides

**Files:**
- Modify: `src/overlay/sections/CustomPropertiesSection.tsx`
- Test: `src/overlay/__tests__/CustomPropertiesSection.test.ts`

**Step 1: Write the failing test**

```ts
describe("auto-populate from overrides", () => {
  it("getCustomOverrides filters out properties covered by structured sections", async () => {
    const { getCustomOverrides } = await import("../sections/CustomPropertiesSection");
    const allDiffs = [
      { prop: "display", from: "block", to: "flex" },      // Layout section — exclude
      { prop: "cursor", from: "auto", to: "pointer" },     // Not in any section — include
      { prop: "color", from: "black", to: "red" },         // Typography section — exclude
      { prop: "scroll-snap-type", from: "none", to: "x mandatory" }, // Not in any — include
    ];
    const result = getCustomOverrides(allDiffs);
    expect(result).toHaveLength(2);
    expect(result[0].property).toBe("cursor");
    expect(result[1].property).toBe("scroll-snap-type");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/overlay/__tests__/CustomPropertiesSection.test.ts`
Expected: FAIL — getCustomOverrides not exported

**Step 3: Implement auto-populate**

Export `getCustomOverrides(diffs: DiffEntry[]): CustomEntry[]` from `CustomPropertiesSection.tsx`:
1. Build a Set of all property names from `SECTION_PROPERTIES` in `PropertySearch.tsx`
2. Filter `diffs` to only those whose `prop` is NOT in the set and has no `state` (base styles only)
3. Map to `CustomEntry[]` with `id: crypto.randomUUID()`, `property: diff.prop`, `value: diff.to`

In the component, call `diff(ctx.element)` on mount via `useMemo` and merge with manual entries. Use `useSyncExternalStore(subscribeOverrides, getOverrideSnapshot)` to re-derive when overrides change (same pattern as `CSSVariablesSection.tsx`).

**Step 4: Run tests**

Run: `npm test -- --run src/overlay/__tests__/CustomPropertiesSection.test.ts`
Expected: PASS

**Step 5: Commit**

```
git add src/overlay/sections/CustomPropertiesSection.tsx src/overlay/__tests__/CustomPropertiesSection.test.ts
git commit -m "feat: auto-populate custom properties from existing overrides"
```

---

### Task 6: Build + Visual Verification

**Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 3: Build the package**

Run: `npm run build`
Expected: Clean build (test-app imports compiled dist/)

**Step 4: Visual verification in browser**

Open `http://localhost:3000/demo` and verify:
1. "Custom properties" section appears at bottom of panel (collapsed)
2. Expanding shows `+ Add` button in bordered container
3. Clicking `+ Add` creates a new entry row with property/value inputs
4. Typing in property input shows autocomplete dropdown
5. Selecting a property and entering a value applies the style
6. Trash icon removes the entry
7. Properties modified via other sections do NOT appear here
8. Properties not in structured sections (e.g. cursor, pointer-events) DO appear if overridden

**Step 5: Commit any visual fixes**

```
git add -A
git commit -m "fix: polish custom properties section visual details"
```
