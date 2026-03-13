---
title: "prd: Close remaining gaps between spec and implementation"
type: feat
date: 2026-03-13
---

# Close Remaining Gaps

## Overview

Redial's UI has ~90% of the Webflow spec's property surface area built as components. The remaining gaps fall into three categories: **pipeline depth** (making the core loop work across all modes), **missing CSS properties** (completing sections), and **interaction polish** (the Webflow-feel details).

13 iterations, ordered by impact on the core promise: "tune → save → real code."

## Problem Statement

The panel exposes UI for features that don't have a working write path (States dropdown, class scope ambiguity), is missing CSS properties that users expect when they open a section (backgrounds, effects, grid), and lacks some of the micro-interactions that make Webflow feel like a design tool rather than a settings panel.

---

## Iteration 1: Verify and harden class-scope save path

**Priority: P0**
**Files: `src/overlay/apply.ts`, `src/server/commit.ts`, `src/overlay/Footer.tsx`, `src/overlay/scope.ts`**

The docs promise: "If class scope: the class definition in the CSS/Tailwind file is updated." The `commit.ts` tiered search supports class block matching (Tier 2). But it's unclear whether the scope toggle in the Header actually routes differently through the save pipeline.

### What to verify

1. With scope set to `.className`, does `Footer.tsx`'s save handler include `className` in the payload sent to `commit.ts`?
2. Does `commit.ts` use that className to find the right CSS block (Tier 2: class block search)?
3. Does the HMR reconciliation in `apply.ts` correctly clear overrides when the class-scoped change lands?

### What to build (if gaps found)

- Ensure `diff()` includes `className` and `scope` in each change object when scope is "class"
- Ensure `commit.ts` prioritizes Tier 2 (class block search) over Tier 3 (full file) when className is provided
- Write an integration-style test: mock a `.module.css` file content, call `commit()` with class-scoped changes, assert the correct line was replaced

### Acceptance criteria

- [x] Selecting `.className` scope pill → editing a property → saving writes to the correct `.className { }` block in the CSS module
- [x] The same property edited in `element` scope writes as an inline style / JSX-level change (existing behavior)
- [x] New test: `commit.test.ts` — class-scoped change finds and replaces inside `.className { }` block
- [x] New test: `commit.test.ts` — element-scoped change does NOT modify the class block
- [x] `npm run typecheck` passes
- [x] `npm test` passes

---

## Iteration 2: State-specific styling (pseudo-class write path)

**Priority: P0**
**Files: `src/overlay/Overlay.tsx`, `src/overlay/apply.ts`, `src/server/commit.ts`, `src/overlay/StateSelector.tsx`**

The StateSelector dropdown exists but selecting `:hover` has no effect on the write path. Inline styles can't target pseudo-classes, so a fundamentally different preview mechanism is needed.

### Technical approach

**Preview**: Inject a `<style>` tag with a temporary class targeting the selected pseudo-class:

```css
.__tuner-state-preview:hover {
  font-size: 20px !important;
}
```

Add/remove `__tuner-state-preview` class on the target element. This replaces inline style application when a non-base state is active.

**Commit**: When saving state-specific changes, `commit.ts` needs to:
1. Find the `.className:hover { }` block if it exists
2. If it exists, do the tiered search within that block
3. If it doesn't exist, append a new `.className:hover { }` block after the base class block

**State tracking**: `apply.ts` needs a separate overrides map keyed by `(element, state, prop)` instead of just `(element, prop)`.

### Scope

Start with `:hover` only. Other states (`:focus`, `:active`) follow the same pattern and can be added incrementally.

### Acceptance criteria

- [ ] Select an element → choose "Hover" in StateSelector → drag a slider → the change previews when hovering the element (not immediately)
- [ ] Save writes to `.className:hover { }` block in the CSS module
- [ ] If no `:hover` block exists, one is created after the base class
- [ ] Switching back to "None" (base) restores normal inline preview behavior
- [ ] Undo/redo works across state boundaries
- [ ] New test: state-specific `<style>` tag injection and cleanup
- [ ] New test: `commit.ts` finds and writes inside `.className:hover { }` block
- [ ] `npm run typecheck` passes

---

## Iteration 3: Tailwind save path (or honest scoping)

**Priority: P1**
**Files: `src/overlay/tailwind.ts`, `src/server/commit.ts`, `docs/how-redial-works.md`, `README.md`**

The workflow doc says "maybe Tailwind" and there's a `tailwind.ts` with tests. But saving Tailwind changes means rewriting `className` strings in JSX — a fundamentally different write path from CSS property replacement. Currently the Footer can "Copy as Tailwind" but Save doesn't write Tailwind classes.

### Decision needed: build it or scope it out

**Option A — Build Tailwind save**: `commit.ts` receives Tailwind class additions/removals. Server finds the JSX element (via React fiber source), modifies the `className` prop (or `cn()` / `clsx()` call). This is a substantial feature.

**Option B — Scope it out honestly**: Document that Save works with CSS Modules. Tailwind is export-only (copy to clipboard). Update docs and README to be clear about this.

### If Option A

- `tailwind.ts` already has `cssToTailwind()` conversion
- `commit.ts` needs a new write strategy: find the JSX element by file + line, locate the `className` attribute, parse the existing classes, add/remove the diff
- Handle `cn()`, `clsx()`, `twMerge()` wrappers — or require bare `className="..."` strings
- This is fragile and should be gated behind a `tailwind: true` config option

### If Option B

- Update `docs/how-redial-works.md` Key Constraints section: "Save writes to CSS Modules (`.module.css`, `.module.scss`). For Tailwind projects, use Copy as Tailwind to export changes."
- Update README if it implies Tailwind save support
- Keep `tailwind.ts` for the copy/export path

### Acceptance criteria (Option A)

- [ ] Save with Tailwind file detected rewrites className in JSX
- [ ] Handles bare `className="..."` strings
- [ ] Handles `cn()` / `clsx()` wrappers
- [ ] New test: Tailwind save replaces classes in a mock JSX file
- [ ] `npm run typecheck` passes

### Acceptance criteria (Option B)

- [ ] Docs updated to clarify CSS Modules focus
- [ ] README updated if needed
- [ ] No false promises about Tailwind save in any user-facing text
- [ ] Copy as Tailwind still works in Footer

---

## Iteration 4: Background image controls

**Priority: P2**
**Files: `src/overlay/BackgroundsSection.tsx`, `src/overlay/BackgroundLayerList.tsx`, `src/overlay/infer.ts`**

`BackgroundsSection.tsx` (213 lines) covers color + gradients. The spec (Section 8) calls for full background-image controls: size, position, repeat, attachment, clip, and blend-mode.

### Properties to add

| Property | Control | Values |
|---|---|---|
| `background-size` | Select / dual input | `auto`, `cover`, `contain`, custom `[w] [h]` |
| `background-position` | Select / 2D picker | `center`, `top left`, etc. + custom X/Y |
| `background-repeat` | Select | `repeat`, `repeat-x`, `repeat-y`, `no-repeat` |
| `background-attachment` | Select | `scroll`, `fixed` |
| `background-clip` | Select | `border-box`, `padding-box`, `content-box`, `text` |
| `background-blend-mode` | Select | `normal`, `multiply`, `screen`, `overlay`, ... (16 options) |

### Implementation

- Read `cs.backgroundImage` — if it contains `url()`, show the image sub-controls
- Add each as a `SelectRow` in `BackgroundsSection.tsx`, below the existing color/gradient controls
- For `background-size` custom mode: two `ValueInput` cells (width + height) with `UnitSelector`
- For `background-position` custom mode: two `ValueInput` cells (X + Y)
- Wire all through `ctx.apply()` like existing controls

### Acceptance criteria

- [ ] When an element has `background-image: url(...)`, the image controls appear
- [ ] Each control reads the computed value and allows editing
- [ ] Changes apply live via inline styles
- [ ] `background-clip: text` works (requires `-webkit-background-clip` vendor prefix)
- [ ] All controls save correctly via the commit pipeline
- [ ] `npm run typecheck` passes

---

## Iteration 5: Missing Effects properties

**Priority: P2**
**Files: `src/overlay/EffectsSection.tsx`**

The Effects section (264 lines) has opacity, shadows, transforms, filters, and transitions. Missing from the spec:

| Property | Control | Values |
|---|---|---|
| `mix-blend-mode` | Select | `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity` |
| `user-select` | Select | `auto`, `none`, `text`, `all` |
| `backface-visibility` | Select | `visible`, `hidden` |

### Implementation

- Add three `SelectRow` components to `EffectsSection.tsx`
- Read computed values from `cs.mixBlendMode`, `cs.userSelect`, `cs.backfaceVisibility`
- Place `mix-blend-mode` next to opacity (they're conceptually related)
- Place `user-select` and `backface-visibility` at the bottom of the section

### Also verify

- `FilterSliders.tsx` — confirm it supports both `filter` and `backdrop-filter` modes (the spec treats them as separate sub-sections)
- If `backdrop-filter` isn't wired, add a second `FilterSliders` instance with `mode="backdrop"` prop

### Acceptance criteria

- [ ] `mix-blend-mode` dropdown appears in Effects section
- [ ] `user-select` dropdown appears in Effects section
- [ ] `backface-visibility` dropdown appears in Effects section
- [ ] Backdrop filter controls are distinct from regular filter controls
- [ ] All new controls read computed values and apply changes live
- [ ] `npm run typecheck` passes

---

## Iteration 6: Grid track editors

**Priority: P2**
**Files: `src/overlay/LayoutSection.tsx`**

The spec (Section 3) calls for editable `grid-template-columns` and `grid-template-rows` text inputs. `LayoutSection.tsx` likely has grid gap/alignment but not free-form track definitions.

### Implementation

- When `display === "grid"` or `display === "inline-grid"`, show two `TextRow`-style inputs:
  - `grid-template-columns`: reads `cs.gridTemplateColumns` (computed will be resolved values like `200px 1fr 200px`)
  - `grid-template-rows`: reads `cs.gridTemplateRows`
- Allow free-form editing (the user types `1fr 1fr 1fr` or `repeat(3, 1fr)`)
- On blur or Enter, apply via `ctx.apply('grid-template-columns', value)`
- Show a label hint with the computed resolved value below the input (e.g., "Computed: 200px 400px 200px")

### Acceptance criteria

- [ ] Grid template inputs appear only when display is grid/inline-grid
- [ ] Inputs pre-populate with computed values
- [ ] Free-form text input accepted (e.g., `1fr 1fr 1fr`, `repeat(3, minmax(0, 1fr))`)
- [ ] Changes apply live
- [ ] `npm run typecheck` passes

---

## Iteration 7: Size section gaps (aspect-ratio, object-position)

**Priority: P2**
**Files: `src/overlay/SizeSection.tsx`, `src/overlay/infer.ts`**

The spec (Section 5) calls for `aspect-ratio` and `object-position` controls.

### Implementation

**`aspect-ratio`:**
- Show for all elements (it's a general property)
- Control: text input with common presets in a dropdown (`auto`, `1/1`, `4/3`, `16/9`, `21/9`)
- Read: `cs.aspectRatio` (returns `auto` or a number like `1.77778`)
- Display as ratio string when possible (`16 / 9` instead of `1.77778`)

**`object-position`:**
- Show only for media elements (`img`, `video`, `canvas`) — same condition as `object-fit`
- Control: select with presets (`center`, `top`, `bottom`, `left`, `right`, `top left`, `top right`, `bottom left`, `bottom right`) + custom X/Y inputs
- Read: `cs.objectPosition`

### Acceptance criteria

- [ ] `aspect-ratio` control appears in Size section for all elements
- [ ] Common ratio presets available in dropdown
- [ ] `object-position` appears alongside `object-fit` for media elements
- [ ] Both read computed values and apply changes live
- [ ] `npm run typecheck` passes

---

## Iteration 8: Spacing box model interaction polish

**Priority: P3**
**Files: `src/overlay/SpacingBoxModel.tsx`, `src/overlay/SpacingSection.tsx`**

The spec (Section 4) calls for several interaction enhancements beyond basic value editing.

### Features to add

**Alt+click side label → complementary sides:**
When holding Alt and clicking a margin/padding label (e.g., "top"), apply that value to the opposite side ("bottom") too.

**Alt+click corner → all four sides:**
When holding Alt and clicking a corner region of the box model, apply that value to all 4 sides.

**Hover highlighting:**
When hovering over a value in the box model, highlight the corresponding side of the visual diagram (e.g., hover over padding-left value → the left padding zone gets a brighter fill).

**Color differentiation:**
- Margin area: warm tone (e.g., `rgba(246, 178, 107, 0.15)`)
- Padding area: cool tone (e.g., `rgba(130, 177, 255, 0.15)`)
- Content center: solid darker rectangle

### Acceptance criteria

- [ ] Alt+click on a side value applies to complementary side
- [ ] Alt+click on a corner applies to all 4 sides of that type (margin or padding)
- [ ] Hovering a value highlights the corresponding zone in the diagram
- [ ] Margin and padding zones have distinct warm/cool tint colors
- [ ] Existing interactions (click-to-edit, arrow keys, tab navigation) still work
- [ ] `npm run typecheck` passes

---

## Iteration 9: Font family searchable dropdown

**Priority: P3**
**Files: `src/overlay/TypographySection.tsx`, `src/overlay/panelConstants.tsx`**

The spec (Section 7) wants a searchable dropdown with system fonts. Currently font-family is a plain text input in `infer.ts`.

### Implementation

- Use the existing `cmdk` dependency (already in package.json) to build a searchable combobox
- Populate with system font stacks:
  ```ts
  const SYSTEM_FONTS = [
    { value: "system-ui, sans-serif", label: "System UI" },
    { value: "'Inter', sans-serif", label: "Inter" },
    { value: "'SF Pro Display', system-ui, sans-serif", label: "SF Pro Display" },
    { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica Neue" },
    { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
    { value: "'SF Mono', ui-monospace, monospace", label: "SF Mono" },
    // ... more common stacks
  ];
  ```
- Allow free-form text entry (for custom fonts not in the list)
- Show a font preview next to each option (render the font name in that font via inline `fontFamily`)
- Current font-family highlighted in the list

### Acceptance criteria

- [ ] Font family control is a searchable dropdown (not plain text input)
- [ ] Typing filters the font list
- [ ] Free-form text still accepted (user can type any font stack)
- [ ] Font name preview renders in the actual font
- [ ] Current font highlighted/selected
- [ ] `npm run typecheck` passes

---

## Iteration 10: Tab navigation within sections

**Priority: P3**
**Files: `src/overlay/controls.tsx`, `src/overlay/WebflowPanel.tsx`**

The spec (Section 13) calls for Tab/Shift+Tab to move between controls within a section. There's partial focus management (focus-visible styles are injected) but no systematic tab-order.

### Implementation

- Add `tabIndex={0}` and `className="tuner-focusable"` to all interactive controls in `controls.tsx` (`SliderRow` input, `SelectRow` trigger, `ColorRow` swatch, `ValueInput`)
- Ensure the DOM order within each section matches the visual order (it should already, but verify)
- Add a keyboard handler at the section level: when Tab is pressed inside a section, move focus to the next `tuner-focusable` element within that section. Shift+Tab moves backward.
- When focus reaches the last control in a section, Tab moves to the first control of the next section (or wraps)

### Acceptance criteria

- [ ] Pressing Tab moves focus to the next control within the panel
- [ ] Shift+Tab moves backward
- [ ] Focus ring visible on each control (already injected via `tuner-focusable` class)
- [ ] Tab order matches visual order (top-to-bottom, left-to-right within rows)
- [ ] Focus does not get trapped in a section (moves between sections)
- [ ] `npm run typecheck` passes

---

## Iteration 11: NPM publish readiness

**Priority: P1**
**Files: `package.json`, `LICENSE`, `README.md`**

Five items from the pre-publish checklist.

### Checklist

1. **Package name**: Decide on `redial` vs. `@skylar/redial` vs. scoped name. Check npm availability.
2. **Author field**: Fill in `package.json` author.
3. **GitHub URLs**: Replace `TODO/redial` in repository, homepage, and bugs URLs.
4. **LICENSE file**: Verify a `LICENSE` file exists at root with MIT text (package.json says MIT).
5. **npm login**: Verify logged in and can publish (manual step).

### Also verify

- `npm pack --dry-run` produces a clean package with expected files
- `dist/` builds cleanly with `npm run build`
- No secrets or dev files in the `files` array
- `README.md` is accurate for the current state (not over-promising features)

### Acceptance criteria

- [ ] `package.json` name is the final decided name
- [ ] `package.json` author is set
- [ ] `package.json` repository/homepage/bugs URLs point to real GitHub repo
- [ ] `LICENSE` file exists at project root
- [ ] `npm pack --dry-run` output contains only expected files
- [ ] `npm run build` succeeds
- [ ] `README.md` accurately reflects current feature set

---

## Iteration 12: Integration test for the core loop

**Priority: P3**
**Files: `src/overlay/__tests__/integration.test.ts` (new), `src/server/__tests__/commit.test.ts` (new or extend)**

48 unit tests exist but none exercise the full `select → panel → edit → save` flow. The core value proposition should have test coverage.

### Test 1: Inline style round-trip

```ts
// 1. Create a DOM element with known computed styles
// 2. Call infer(el) — verify config matches
// 3. Call applyInlineStyle(el, 'font-size', '20px')
// 4. Verify el.style.fontSize === '20px'
// 5. Call diff(el) — verify it reports the change
// 6. Call reset(el) — verify el.style.fontSize is cleared
```

### Test 2: Commit tiered search

```ts
// 1. Create mock CSS file content with a .className { } block
// 2. Call commit() with a class-scoped change
// 3. Assert the value was replaced inside the correct block
// 4. Assert indentation and surrounding code preserved
```

### Test 3: HMR reconciliation

```ts
// 1. Apply an inline override
// 2. Simulate the stylesheet updating (mock getComputedStyle returning the new value)
// 3. Call clearRedundantOverrides()
// 4. Verify the inline override was removed
```

### Test 4: Undo/redo across operations

```ts
// 1. Apply 3 changes
// 2. Undo once — verify last change reverted
// 3. Undo again — verify second change reverted
// 4. Redo once — verify second change restored
```

### Acceptance criteria

- [ ] Integration tests cover the inline style round-trip
- [ ] Integration tests cover commit tiered search (at minimum Tier 2: class block)
- [ ] Integration tests cover undo/redo across multiple operations
- [ ] All new tests pass in `npm test`
- [ ] No mocking of `getComputedStyle` where a real DOM (happy-dom) can be used

---

## Iteration 13: Sync `infer.ts` with reality (optional cleanup)

**Priority: P3**
**Files: `src/overlay/infer.ts`, `src/overlay/Panel.tsx`**

The docs describe `infer.ts` as the "intelligence layer" but the 8 section components now read `getComputedStyle()` directly. `infer.ts` still generates a DialKit config used by `Panel.tsx` (the DialKit bridge), but the main `WebflowPanel.tsx` bypasses it.

### Decision needed

**Option A — Remove the DialKit panel path entirely**: If `WebflowPanel.tsx` is the only panel going forward, delete `Panel.tsx` and slim down `infer.ts` to just the utility exports (`toCSSValue`, `flattenValues`, `PX_PROPS`, `TOGGLE_CSS`, `SpacingValues`, `SPACING_PROPS`) that other files import.

**Option B — Keep both paths**: If the DialKit panel is useful as a fallback or alternative view, update `infer.ts` to generate configs that match the current section components' property coverage.

**Option C — Do nothing**: Accept the drift. `infer.ts` isn't broken, it's just stale for the main panel path.

### Acceptance criteria (Option A)

- [ ] `Panel.tsx` removed (or deprecated with a clear comment)
- [ ] `infer.ts` slimmed to just utility exports + `SpacingValues` extraction
- [ ] All imports of `infer.ts` still resolve
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes

---

## Iteration Order Summary

| # | Iteration | Priority | Est. Complexity |
|---|---|---|---|
| 1 | Class-scope save path | P0 | Medium (verify + test) |
| 2 | State-specific styling | P0 | High (new preview mechanism + commit changes) |
| 3 | Tailwind save decision | P1 | Low (if scoping out) / High (if building) |
| 4 | Background image controls | P2 | Medium (6 new SelectRows) |
| 5 | Missing Effects properties | P2 | Low (3 SelectRows + verify backdrop) |
| 6 | Grid track editors | P2 | Low (2 TextRow inputs) |
| 7 | Size gaps (aspect-ratio, object-position) | P2 | Low (2 controls) |
| 8 | Spacing interactions | P3 | Medium (Alt+click, hover highlight, color zones) |
| 9 | Font family dropdown | P3 | Medium (cmdk integration) |
| 10 | Tab navigation | P3 | Medium (focus management across sections) |
| 11 | NPM publish readiness | P1 | Low (5 fields + verify) |
| 12 | Integration tests | P3 | Medium (4 test scenarios) |
| 13 | Sync infer.ts | P3 | Low (cleanup) |

## Dependencies

- Iteration 2 (states) depends loosely on Iteration 1 (class-scope) — both touch `commit.ts`
- Iteration 3 (Tailwind) is a decision gate — resolve before building
- Iterations 4–10 are fully independent and parallelizable
- Iteration 11 (npm publish) blocks on Iteration 3 (README accuracy depends on Tailwind decision)
- Iteration 12 (integration tests) benefits from Iterations 1–2 being done first (tests can cover those paths)
- Iteration 13 is standalone cleanup

## References

- [Webflow Panel Spec](../webflow-style-panel-spec.md) — 13-section UI spec with property tables
- [Save Pipeline](save-pipeline.md) — 4-stage commit architecture
- [How Redial Works](how-redial-works.md) — persona, UX flow, value prop
- [Position](position.md) — market positioning and gap
- Prior plans: `docs/archived/plans/` (14 completed iteration plans)
