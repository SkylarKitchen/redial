---
title: "Close remaining gaps between spec and implementation"
type: feat
date: 2026-03-13
---

# Close Remaining PRD Gaps

## Enhancement Summary

**Deepened on:** 2026-03-13
**Agents used:** TypeScript reviewer, Performance oracle, Architecture strategist, Frontend race conditions reviewer, Code simplicity reviewer, Pattern recognition specialist, SpecFlow analyzer, 2x Explore agents (scope.ts deep dive, tab navigation research)

### Key Improvements from Research
1. **5 iterations already done** — verified with exact file:line references, no work needed
2. **Composite string key** for state overrides (`"hover:font-size"`) — unanimous consensus, keeps flat Map structure
3. **6 race conditions identified** for state-specific styling — mitigations designed before code exists
4. **Footer.tsx already routes correctly** — conditional className based on scope (confirmed, existing test at commit.test.ts:436)
5. **Tab navigation works natively** — browser handles it via existing `tabIndex={0}`, no custom handler needed
6. **Performance: CSSOM rule manipulation** instead of `textContent` replacement on `<style>` tags during drag

### Critical Architectural Decisions
- **State override map**: Composite string key in existing flat Map (option a) — not nested Maps, not separate Map
- **State preview**: Consolidate into scope.ts (extend existing `<style>` tag system), not a new module
- **Preview UX**: Force-simulate state (show changes immediately), write pseudo-class to source on save
- **Alt+click conflict**: Use Shift+click for complementary side, keep Alt+click for reset

---

## Triage Summary

| # | Iteration | Status | Action |
|---|---|---|---|
| 5 | Effects properties | **DONE** | Check off in PRD |
| 6 | Grid track editors | **DONE** | Check off in PRD |
| 7 | Size gaps | **DONE** | Check off in PRD |
| 9 | Font family dropdown | **DONE** | Check off in PRD |
| 13 | Sync infer.ts | **DONE** | Panel.tsx removed, CommonPanel still uses infer() — nothing to clean up |
| 10 | Tab navigation | **DONE** | Browser handles it natively via tabIndex={0} — verified |
| 3 | Tailwind save | **TRIVIAL** | 1-sentence doc update (Option B: scope out) |
| 8 | Spacing polish | **TRIVIAL** | 2-line theme.ts color change |
| 11 | NPM publish | **PARTIAL** | Items 2+4 automatable; items 1+3 blocked on user input |
| 1 | Class-scope save path | **VERIFY + TEST** | Footer routing confirmed correct; write tests |
| 2 | State-specific styling | **MAJOR NEW WORK** | Pseudo-class preview, state overrides, commit.ts blocks |
| 4 | Background image controls | **TODO** | 4 new SelectRow controls |
| 12 | Integration tests | **ABSORBED** | Tests written inline with features, not as separate phase |

---

## Phase A: Core Pipeline (Sequential)

### A1. Class-Scope Save Path — Verify + Test (Iteration 1)

**Research finding: Footer.tsx already routes correctly.**

```typescript
// Footer.tsx:157 — already conditional on scope
className: scope === "class" && activeClassName
  ? (getReadableName(activeClassName) ?? moduleInfo?.className)
  : undefined,
```

Existing test at `commit.test.ts:436` ("element-scoped change uses sourceLine, not class block") confirms the distinction works. **No code changes needed — just additional test coverage.**

#### Tests to Write

**`src/server/__tests__/commit.test.ts`** (extend existing):
```
1. Class-scoped change with className → Tier 2 finds .className { } block → value replaced
2. Element-scoped change without className → Tier 2 skipped → Tier 1/3 used instead
3. Class-scoped change when multiple class blocks exist → correct block targeted
```

**`src/overlay/__tests__/scope.test.ts`** (extend existing):
```
4. Class-scope undo reverts both inline style AND <style> tag
5. diff() in class scope returns correct changes
```

#### Research Insights

**SpecFlow gap: Undo in class scope is inconsistent.** When user edits in class scope, both `applyClassStyle()` (style tag) and `applyInlineStyle()` (inline) fire. Undo only reverts inline — the `<style>` tag retains the old value. Other instances of the class stay wrong.

**Fix:** Extend `undo()` to also call `removeClassStyle(className, prop)` when the undo entry was made during class scope. Follow the `applyCustomProperty()` pattern at `apply.ts:624` which already does dual tracking.

#### Acceptance Criteria
- [ ] Selecting `.className` scope → editing → saving writes to correct `.className { }` block
- [ ] Element scope → editing → saving does NOT modify class block
- [ ] Undo in class scope reverts both inline and `<style>` tag
- [ ] New tests pass in `npm test`
- [ ] `npm run typecheck` passes

---

### A2. State-Specific Styling (Iteration 2) — The Core New Feature

**This is the most complex item. 9 agents provided input. Here is the synthesized design.**

#### Data Model: Composite String Key

**Unanimous consensus across all agents.** Extend the existing flat Map with prefixed keys:

```typescript
// helpers in apply.ts
function stateKey(state: string, prop: string): string {
  return state === "none" ? prop : `${state}::${prop}`;
}
function parseStateKey(key: string): { state: string; prop: string } {
  const idx = key.indexOf("::");
  return idx < 0 ? { state: "none", prop: key } : { state: key.slice(0, idx), prop: key.slice(idx + 2) };
}
```

**Why this wins:**
- Map shape stays `Map<Element, Map<string, Override>>` — unchanged
- All 15+ functions in apply.ts continue working (they see string keys)
- `diff()` parses state from key, populates `DiffEntry.state` automatically
- Session persistence serializes naturally (keys are just strings)
- Undo stack: `SingleUndoEntry.state` becomes required field (default `"none"`)

#### Preview Mechanism: Force-Simulate in scope.ts

**Consolidate into `scope.ts`** (2/3 agents agree — Architecture + Pattern Recognition). Generalize existing `<style>` tag system:

```typescript
// scope.ts additions
const stateOverrides = new Map<string, Map<string, string>>(); // stateSelector → Map<prop, value>

export function applyStateStyle(selector: string, state: string, prop: string, value: string): void {
  const key = `${selector}:${state}`;
  const props = stateOverrides.get(key) ?? new Map();
  props.set(prop, sanitizeCSSValue(value));
  stateOverrides.set(key, props);
  rebuildStateStyles();
}

function rebuildStateStyles(): void {
  // Use CSSOM insertRule/deleteRule for performance (not textContent replacement)
  const sheet = getStateScopeStyle().sheet!;
  // Clear and rebuild rules...
}
```

**Force-simulate UX decision:** When user selects `:hover`, show changes immediately (inject without pseudo-class during editing). Only write the `:hover` pseudo-class to source on save. This avoids the confusing "hover to see your changes" pattern.

```css
/* During editing: immediate feedback */
.__tuner-state-preview { font-size: 20px !important; }

/* On save: writes to source file as */
.btn:hover { font-size: 20px; }
```

#### Apply Routing

Extend `WebflowPanel.tsx` apply callback — backwards-compatible:

```typescript
const apply = useCallback(
  (prop: string, value: string) => {
    if (activeState !== "none") {
      // State-specific: inject via <style> tag (force-simulate)
      const selector = activeClassName ?? getStableSelector(element);
      applyStateStyle(selector, activeState, prop, value);
    }
    if (scope === "class" && activeClassName) {
      applyClassStyle(activeClassName, prop, value);
    }
    // Always track in apply.ts for undo/diff (using composite key for state)
    applyInlineStyle(element, stateKey(activeState, prop), value);
  },
  [element, scope, activeClassName, activeState]
);
```

#### Race Condition Mitigations (P0)

**Race 1: Mid-drag state switch.** Refuse state transitions while scrubbing:
```typescript
// StateSelector or onStateChange handler
if (isScrubActive()) return; // refuse transition
```

**Race 2: Visual flash on state transition.** Synchronous teardown+setup:
```typescript
function transitionState(from: string, to: string, el: Element): void {
  // Single synchronous block — no intermediate reflow
  removeStateStyleTag(from);
  if (to !== "none") injectStateStyleTag(to, el, getStateOverrides(to, el));
  restoreInlineOverridesForState(to, el);
}
```

**Race 3: Undo across states.** Tag every undo entry with state (required field, default `"none"`):
```typescript
type SingleUndoEntry = { el: Element; prop: string; prev: string; state: string };
```

Undo dispatches to correct write path based on entry's state.

#### Commit Changes

**Extend `CommitChange` type** with optional `state` field:
```typescript
type CommitChange = {
  prop: string; from: string; to: string;
  sourceFile?: string; sourceLine?: number;
  className?: string; componentName?: string;
  state?: string; // NEW: "hover", "focus", etc.
};
```

**Extend `searchClassBlock` regex** for pseudo-class selectors:
```typescript
// Current: matches .btn {
const basePattern = `\\.${escapeRegex(className)}\\s*[{,]`;
// New: matches .btn:hover {
const statePattern = `\\.${escapeRegex(className)}:${escapeRegex(state)}\\s*\\{`;
```

**New `insertClassBlock` function** (separate, testable):
```typescript
function insertClassBlock(
  lines: string[], className: string, state: string,
  prop: string, value: string
): { lineIdx: number; linesAdded: number }
```

**SCSS nesting detection:** Scan base class block for `&:` patterns. Insert `&:hover { }` inside block (SCSS) or `.className:hover { }` after block (plain CSS).

#### Save Consolidation (P1 race fix)

**Cmd+S shortcut at `Overlay.tsx:270` bypasses scope/state.** Consolidate:
```typescript
// Single buildSavePayload function used by both Footer.handleSave and Overlay.handleSaveShortcut
function buildSavePayload(el: Element, scope: Scope, activeClassName: string | null, activeState: string): CommitChange[]
```

#### Performance Optimizations

1. **CSSOM rule manipulation** instead of `textContent` replacement on `<style>` tags during drag
2. **Fix `totalOverrideCount()` to O(1)** — maintain running counter instead of iterating all overrides
3. **Single persistent `<style>` element** for state previews — never create/remove during drag

#### Tests for Iteration 2

```
1. State-specific <style> tag injection and cleanup
2. commit.ts finds and writes inside .className:hover { } block
3. commit.ts creates .className:hover { } when it doesn't exist (CSS and SCSS)
4. Undo/redo across state boundaries (tagged undo entries)
5. State transition mid-drag is refused
6. Synchronous state transition (no visual flash)
7. HMR reconciliation extended for state overrides
8. Session persistence with state-keyed overrides
```

#### Acceptance Criteria
- [ ] Select element → choose "Hover" → drag slider → change visible immediately (force-simulated)
- [ ] Save writes to `.className:hover { }` block in CSS module
- [ ] If no `:hover` block exists, one is created (correct position, correct indentation)
- [ ] SCSS files: `&:hover { }` inserted inside parent block
- [ ] Switching back to "None" restores normal inline preview
- [ ] Undo/redo works across state boundaries
- [ ] State transitions refused during active drag
- [ ] Cmd+S includes scope and state in payload
- [ ] `npm run typecheck` passes
- [ ] All new tests pass

---

## Phase B: Polish + Background Controls (Parallel with Phase A)

### B1. Tailwind Save Scope-Out (Iteration 3) — 5-minute doc edit

Update `docs/how-redial-works.md` Key Constraints: "Save writes to CSS Modules (`.module.css`, `.module.scss`). For Tailwind projects, use Copy as Tailwind to export changes."

Verify `README.md` doesn't promise Tailwind save.

- [ ] Docs updated
- [ ] README accurate
- [ ] Copy as Tailwind still works

### B2. Spacing Zone Colors (Iteration 8) — 2-line theme.ts change

```typescript
// theme.ts — change spacingZone tokens
marginBase: "rgba(255, 149, 0, 0.08)",     // was rgba(0,0,0,0.03)
marginHover: "rgba(255, 149, 0, 0.14)",    // was rgba(0,0,0,0.06)
paddingBase: "rgba(59, 130, 246, 0.08)",    // was rgba(0,0,0,0.02)
paddingHover: "rgba(59, 130, 246, 0.14)",   // was rgba(0,0,0,0.05)
```

Note: Keep Alt+click as reset (existing behavior). Use Shift+click for complementary side if adding that interaction.

- [ ] Warm/cool zone colors applied
- [ ] Existing interactions still work
- [ ] `npm run typecheck` passes

### B3. Background Image Controls (Iteration 4) — 4 new SelectRows

**Follow existing pattern exactly** (confirmed by Pattern Recognition agent). Each control needs:
- `useState` from `cs.{property}`
- `useCallback` handler calling `apply(prop, value)`
- `SelectRow` with `label`, `value`, `options`, `onChange`, `onReset`, `indicator`, `computedProp`, `computedElement`, `onContextMenu`

**Controls to add:**

| Property | Options constant | Notes |
|---|---|---|
| `background-size` | `BG_SIZE_OPTIONS` | `auto`, `cover`, `contain` + custom dual input (w/h) |
| `background-position` | `BG_POSITION_OPTIONS` | 9 positions + custom X/Y |
| `background-repeat` | `BG_REPEAT_OPTIONS` | `repeat`, `repeat-x`, `repeat-y`, `no-repeat` |
| `background-attachment` | `BG_ATTACHMENT_OPTIONS` | `scroll`, `fixed` |

**Detection:** Show only when `cs.backgroundImage` contains `url()`.

**Performance note:** `background-size` changes trigger layout recalc on images. Consider `will-change: background` during drag.

**Files:** `src/overlay/BackgroundsSection.tsx`, `src/overlay/panelConstants.tsx`

- [ ] Image controls appear when element has `background-image: url(...)`
- [ ] Each reads computed value and allows editing
- [ ] Changes apply live
- [ ] All controls save via commit pipeline
- [ ] `npm run typecheck` passes

### B4. NPM Publish — Automatable Items (Iteration 11)

**Do items 2 and 4 now. Items 1 and 3 blocked on user input.**

- [ ] `package.json` author set
- [ ] LICENSE copyright verified
- [ ] `npm run build` succeeds
- [ ] `npm pack --dry-run` output clean
- [ ] README.md accurate after Tailwind scoping

**Blocked (user decision needed):**
- Package name (`"redial"` is taken)
- GitHub URLs (need real repo URL)

---

## Iterations Checked Off (No Work Needed)

These are verified done during research — check off in PRD immediately:

**Iteration 5 — Effects Properties:** mix-blend-mode (EffectsSection:207), user-select (:261), backface-visibility (:258), backdrop-filter (:254). All 6 criteria met.

**Iteration 6 — Grid Track Editors:** grid-template-columns (LayoutSection:347), grid-template-rows (:348). All 5 criteria met.

**Iteration 7 — Size Gaps:** aspect-ratio (SizeSection:460), object-position (:472). All 5 criteria met.

**Iteration 9 — Font Family Dropdown:** searchable + fontPreview SelectRow (TypographySection:221). All 6 criteria met.

**Iteration 10 — Tab Navigation:** All controls have `tabIndex={0}`, native browser Tab order works. Focus-visible styles injected. SpacingBoxModel has custom Tab handler for visual order. All 6 criteria met.

**Iteration 13 — Sync infer.ts:** Panel.tsx removed. CommonPanel still uses `infer()` — leave it. Utility exports used by other modules. All 5 criteria met (option C: accept as-is).

**Iteration 12 — Integration Tests:** Absorbed into Phase A. Tests for round-trip, commit search, undo/redo, and HMR already exist in `apply.test.ts` and `commit.test.ts`. New state-specific tests written as part of A2.

---

## Execution Order

```
Phase A (sequential):
  ├── A1: Class-scope verify + test (iter 1)
  └── A2: State-specific styling (iter 2) — depends on A1

Phase B (parallel with Phase A):
  ├── B1: Tailwind docs (iter 3) — 5 min
  ├── B2: Spacing zone colors (iter 8) — 5 min
  ├── B3: Background image controls (iter 4)
  └── B4: NPM publish automatable items (iter 11)

Check off done iterations: 5, 6, 7, 9, 10, 12, 13
```

## Dependencies

- A2 depends on A1 (both touch commit.ts)
- B4 (NPM README) depends on B1 (Tailwind decision affects README)
- Everything else is independent

## Final Acceptance

- [ ] All `- [ ]` checkboxes in PRD → `- [x]`
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
