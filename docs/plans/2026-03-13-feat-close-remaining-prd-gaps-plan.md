---
title: "Close remaining gaps between spec and implementation"
type: feat
date: 2026-03-13
---

# Close Remaining PRD Gaps

## Overview

The PRD (`docs/2026-03-13-prd-remaining-gaps.md`) lists 13 iterations. **Research reveals ~5 are already done or nearly done.** This plan triages all 13 into three buckets: Already Done (verify + check off), Needs Small Polish, and Needs Real Work — then executes them in priority order with maximum parallelism.

## Triage Summary

| # | Iteration | Status | Remaining Work |
|---|---|---|---|
| 5 | Effects properties | **DONE** | Verify acceptance criteria, check off |
| 6 | Grid track editors | **DONE** | Verify, check off (computed hint label is nice-to-have) |
| 7 | Size gaps | **DONE** | Verify, check off (aspect-ratio preset is nice-to-have) |
| 9 | Font family dropdown | **DONE** | Verify, check off |
| 13 | Sync infer.ts | **MOSTLY DONE** | Panel.tsx already removed; slim infer.ts utility exports |
| 3 | Tailwind save | **DECISION** | Choose Option B (scope out), update docs |
| 8 | Spacing polish | **PARTIAL** | Warm/cool zone colors; Alt+click complementary side |
| 10 | Tab navigation | **PARTIAL** | Systematic section-level tab coordination |
| 11 | NPM publish | **TODO** | 5 checklist items |
| 1 | Class-scope save path | **VERIFY + HARDEN** | Verify scope routing in Footer.tsx; add tests |
| 2 | State-specific styling | **MAJOR NEW WORK** | Pseudo-class preview, state overrides map, commit.ts blocks |
| 4 | Background image controls | **TODO** | 6 new SelectRow/ValueInput controls |
| 12 | Integration tests | **TODO** | 4 new test scenarios |

## Problem Statement

The PRD was written before some iterations were implemented. The panel now has ~95% of the spec's property surface, but the core save pipeline (class-scope and state-specific) has gaps, some CSS properties are missing (background image sub-controls), and polish items remain.

---

## Phase 1: Verify & Check Off Done Iterations (Parallel)

**Goal:** Confirm iterations 5, 6, 7, 9, 13 meet acceptance criteria and mark them complete in the PRD.

### 1A. Verify Iteration 5 — Effects Properties

**Status: DONE** — All controls confirmed in code:
- `mix-blend-mode` → `EffectsSection.tsx:207` (SelectRow with BLEND_MODE_OPTIONS)
- `user-select` → `EffectsSection.tsx:261` (SelectRow with USER_SELECT_OPTIONS)
- `backface-visibility` → `EffectsSection.tsx:258` (SelectRow with BACKFACE_OPTIONS)
- `backdrop-filter` → `EffectsSection.tsx:254` (separate FilterSliders with `type="backdrop-filter"`)

**Action:** Run `npm run typecheck`, visually verify in test-app, check off all 6 acceptance criteria in PRD.

### 1B. Verify Iteration 6 — Grid Track Editors

**Status: DONE** — Both inputs exist:
- `grid-template-columns` → `LayoutSection.tsx:347` (TextRow, shown when isGrid)
- `grid-template-rows` → `LayoutSection.tsx:348` (TextRow, shown when isGrid)

**Missing nice-to-have:** Computed value hint label below inputs. Not blocking.

**Action:** Verify in test-app with a grid element, check off acceptance criteria.

### 1C. Verify Iteration 7 — Size Gaps

**Status: DONE** — Both controls exist:
- `aspect-ratio` → `SizeSection.tsx:460` (TextRow, placeholder "16 / 9")
- `object-position` → `SizeSection.tsx:472` (SelectRow with OBJECT_POSITION_OPTIONS, conditional on media elements)

**Missing nice-to-have:** Aspect-ratio preset dropdown (currently plain text). The text input accepts ratio strings fine.

**Action:** Verify in test-app, check off acceptance criteria.

### 1D. Verify Iteration 9 — Font Family Dropdown

**Status: DONE** — Fully implemented:
- `TypographySection.tsx:221` uses `<SelectRow label="Font" ... searchable fontPreview />`
- cmdk integration via `SelectRowCustom` in controls.tsx
- Font preview renders each option in its font
- System font enumeration via `document.fonts.ready`

**Action:** Verify searchability and font preview in test-app, check off all 6 criteria.

### 1E. Verify Iteration 13 — Sync infer.ts

**Status: MOSTLY DONE** — Panel.tsx already removed (glob found no file).

**Remaining:** Slim `infer.ts` to only utility exports (`PX_PROPS`, `TOGGLE_CSS`, `toCSSValue`, `flattenValues`, `SpacingValues`, `SPACING_PROPS`). The `infer()` function is still called from `Overlay.tsx` for `CommonPanel` view — leave it if CommonPanel is still used, or remove both.

**Action:** Check if CommonPanel is used. If yes, keep `infer()`. If no, remove and slim down. Either way, check off.

---

## Phase 2: Quick Wins (Parallel)

**Goal:** Close iterations 3, 8, 10, 11 — these are small-to-medium tasks.

### 2A. Iteration 3 — Tailwind Save: Option B (Scope Out)

**Decision: Option B** — Document that Save writes to CSS Modules only. Tailwind is export-only (Copy as Tailwind).

**Files to update:**
- `docs/how-redial-works.md` — Add to Key Constraints: "Save writes to CSS Modules (`.module.css`, `.module.scss`). For Tailwind projects, use Copy as Tailwind to export changes."
- `README.md` — Verify no false promises about Tailwind save
- Keep `tailwind.ts` for the copy/export path (it's working)

**Acceptance criteria:**
- [ ] Docs updated to clarify CSS Modules focus
- [ ] README updated if needed
- [ ] No false promises about Tailwind save in any user-facing text
- [ ] Copy as Tailwind still works in Footer

### 2B. Iteration 8 — Spacing Box Model Polish

**What's already done:**
- Alt+click resets property → `SpacingBoxModel.tsx:333`
- Shift+drag updates all 4 sides → documented in file header
- Alt+drag updates axis pair → documented in file header
- Tab/Shift+Tab navigation → in file header

**What needs work:**

1. **Warm/cool zone colors** — Currently both zones use neutral gray (`rgba(0,0,0,0.03)` and `rgba(0,0,0,0.02)` in `theme.ts:185-188`). Change to:
   - Margin area: warm tone `rgba(246, 178, 107, 0.15)`
   - Padding area: cool tone `rgba(130, 177, 255, 0.15)`
   - Update `spacingZone.marginBase` and `spacingZone.paddingBase` in `theme.ts`

2. **Alt+click complementary side** — Currently Alt+click resets. PRD wants Alt+click to *apply the value* to the opposite side. This is a behavior change that conflicts with existing Alt+click reset. **Recommendation:** Keep Alt+click as reset (existing behavior), add Shift+click for complementary side application (non-breaking).

3. **Hover highlighting** — Verify if hovering a value highlights the zone. If not, add hover state tracking.

**Files:** `src/overlay/theme.ts`, `src/overlay/SpacingBoxModel.tsx`

### 2C. Iteration 10 — Tab Navigation

**What's already done:**
- `tabIndex={0}` on most controls in `controls.tsx` (lines 140, 569, 708, 782, 862)
- `tuner-focusable` className on controls
- Focus-visible styles injected

**What needs work:**
- Verify DOM order matches visual order within sections
- Add section-level keyboard handler: Tab within a section → next `tuner-focusable`, Shift+Tab → previous
- When focus reaches end of section → move to next section (don't trap)

**Files:** `src/overlay/controls.tsx`, `src/overlay/WebflowPanel.tsx`

### 2D. Iteration 11 — NPM Publish Readiness

**5 items from pre-publish checklist:**

1. **Package name** — `"redial"` is taken on npm. Decide: `@redial-dev/redial`, `css-redial`, or user's choice. Check availability with `npm view <name>`.
2. **Author field** — Set in `package.json` (currently empty `""`)
3. **GitHub URLs** — Replace `TODO/redial` in repository, homepage, bugs
4. **LICENSE copyright** — Verify MIT text is correct (file exists, 1063 bytes)
5. **npm login** — Manual step, skip in automation

**Also verify:**
- `npm pack --dry-run` produces clean package
- `npm run build` succeeds
- No secrets in `files` array (looks clean: `["dist", "!dist/**/*.map", "next-plugin.cjs", "LICENSE", "README.md"]`)
- `README.md` accuracy after Tailwind scoping (Iteration 3)

**Files:** `package.json`, `LICENSE`, `README.md`

**Note:** Items 1 (name) and 3 (URLs) require user input. The rest can be automated.

---

## Phase 3: Core Pipeline Work (Sequential — 1 before 2)

**Goal:** Harden the save pipeline (Iteration 1), then build state-specific styling (Iteration 2).

### 3A. Iteration 1 — Class-Scope Save Path

**Current state:**
- `Footer.tsx:148-158` — Always enriches with `className` from `getModuleClassInfo()` regardless of scope
- `commit.ts` Tier 2 class-block search works (tested at `commit.test.ts:406`)
- `scope.ts` has `applyClassStyle()` for live preview of class-scoped changes
- `WebflowPanel.tsx:92-100` — When scope=class, applies both class style AND inline style

**Gaps to verify:**
1. Does `getModuleClassInfo()` extract the right class name for `.module.css` blocks?
2. When scope=element, does the inline style save path work independently of className?
3. Is there any case where className-based search overwrites the wrong block?

**What to build (if gaps found):**
- Ensure `diff()` or enrichment includes `scope` in each change object
- When scope=element, do NOT pass className to commit (force Tier 1/3 search)
- When scope=class, pass className to commit (enable Tier 2 class block search)

**Tests to write:**
- `commit.test.ts` — class-scoped change finds and replaces inside `.className { }` block
- `commit.test.ts` — element-scoped change does NOT modify the class block
- Verify existing test at line 406 covers the acceptance criteria

**Files:** `src/overlay/Footer.tsx`, `src/server/commit.ts`, `src/overlay/apply.ts`, `src/overlay/scope.ts`

### 3B. Iteration 2 — State-Specific Styling (Pseudo-Class Write Path)

**This is the largest piece of new work.**

**Preview mechanism:**
1. When `activeState !== "none"`, switch from inline style application to `<style>` tag injection
2. Inject: `.__tuner-state-preview:hover { font-size: 20px !important; }` (for hover)
3. Add `__tuner-state-preview` class to target element
4. On state change back to "none", remove the class and `<style>` tag

**State tracking changes to `apply.ts`:**
- Current: overrides keyed by `(element, prop)`
- Needed: overrides keyed by `(element, state, prop)` — or a separate `stateOverrides` map
- `diff()` needs to include `state` in each `DiffEntry`
- Undo/redo needs to track which state each operation was in

**Commit changes:**
- When saving state-specific changes, Footer.tsx includes `state: "hover"` in the payload
- `commit.ts` receives state, looks for `.className:hover { }` block
- If block exists: tiered search within it
- If block doesn't exist: create `.className:hover { }` after the base class block
- Need new `createPseudoClassBlock()` function in commit.ts

**Scope: Start with `:hover` only.** Other states follow the same pattern.

**Files:** `src/overlay/Overlay.tsx`, `src/overlay/apply.ts`, `src/overlay/Footer.tsx`, `src/server/commit.ts`, `src/overlay/StateSelector.tsx`

**Tests:**
- State-specific `<style>` tag injection and cleanup
- `commit.ts` finds and writes inside `.className:hover { }` block
- `commit.ts` creates `.className:hover { }` when it doesn't exist
- Undo/redo across state boundaries

---

## Phase 4: New CSS Controls (Parallel)

### 4A. Iteration 4 — Background Image Controls

**What exists:** BackgroundsSection.tsx has color, gradient layers, and background-clip. BackgroundLayerList handles gradient/image layers.

**What's missing:** When `background-image: url(...)` is detected, show standalone controls:

| Property | Control | Implementation |
|---|---|---|
| `background-size` | SelectRow + custom dual input | `auto`, `cover`, `contain`, custom `[w] [h]` |
| `background-position` | SelectRow + custom dual input | `center`, `top left`, etc. + custom X/Y |
| `background-repeat` | SelectRow | `repeat`, `repeat-x`, `repeat-y`, `no-repeat` |
| `background-attachment` | SelectRow | `scroll`, `fixed` |

Note: `background-clip` and `background-blend-mode` already exist in BackgroundsSection.tsx.

**Detection:** Read `cs.backgroundImage` — if it contains `url()`, show the image sub-controls below the existing layer controls.

**Pattern:** Follow the existing section component recipe — `useState` for each property, read from `cs`, handler calls `apply()`, wrap in `SelectRow` or dual `ValueInput`.

**Files:** `src/overlay/BackgroundsSection.tsx`, `src/overlay/panelConstants.tsx` (for option arrays)

---

## Phase 5: Integration Tests

### 5A. Iteration 12 — Integration Tests

**New file:** `src/overlay/__tests__/integration.test.ts`

**Test 1: Inline style round-trip**
```
Create DOM element → infer() → applyInlineStyle() → verify el.style → diff() → reset() → verify cleared
```

**Test 2: Commit tiered search (class-scoped)**
```
Mock CSS file with .className { } → handleCommit() with class-scoped change → assert value replaced in correct block
```

**Test 3: Undo/redo across operations**
```
Apply 3 changes → undo once → verify → undo again → verify → redo once → verify
```

**Test 4: HMR reconciliation**
```
Apply inline override → simulate stylesheet update → clearRedundantOverrides() → verify inline removed
```

**Environment:** happy-dom for client tests, real filesystem for commit tests (following existing patterns in commit.test.ts and apply.test.ts)

---

## Execution Order

```
Phase 1 (parallel, ~10min):
  ├── 1A: Verify Effects (iter 5) ✓
  ├── 1B: Verify Grid (iter 6) ✓
  ├── 1C: Verify Size (iter 7) ✓
  ├── 1D: Verify Font (iter 9) ✓
  └── 1E: Verify infer.ts (iter 13) ✓

Phase 2 (parallel, ~30min):
  ├── 2A: Tailwind scope-out docs (iter 3)
  ├── 2B: Spacing polish (iter 8)
  ├── 2C: Tab navigation (iter 10)
  └── 2D: NPM publish fields (iter 11)

Phase 3 (sequential, ~45min):
  ├── 3A: Class-scope save path (iter 1) — must complete before 3B
  └── 3B: State-specific styling (iter 2) — depends on 3A

Phase 4 (parallel with Phase 3, ~20min):
  └── 4A: Background image controls (iter 4)

Phase 5 (after Phase 3, ~20min):
  └── 5A: Integration tests (iter 12) — benefits from 3A/3B being done
```

## Dependencies

- Phase 3B depends on 3A (both touch commit.ts)
- Phase 2D (NPM publish README) depends on 2A (Tailwind decision affects README accuracy)
- Phase 5 benefits from Phase 3 (tests can cover class-scope and state paths)
- All other items are fully independent and parallelizable

## Acceptance Criteria (All Iterations)

After completion, every `- [ ]` checkbox in `docs/2026-03-13-prd-remaining-gaps.md` should be `- [x]`.

Additionally:
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (including new integration tests)
- [ ] `npm run build` succeeds
- [ ] `npm pack --dry-run` produces clean package
