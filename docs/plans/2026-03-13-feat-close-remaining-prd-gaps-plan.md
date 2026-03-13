---
title: "Close remaining gaps between spec and implementation"
type: feat
date: 2026-03-13
revised: 2026-03-13
---

# Close Remaining PRD Gaps (Revised)

> **Revision note:** Original plan described A2 (state-specific styling) as major new work.
> Three independent code reviewers confirmed ~80% of A2 is already implemented.
> This revision separates "verify existing" from "fix bugs found."

## Triage Summary

| # | Iteration | Status | Action |
|---|---|---|---|
| 5 | Effects properties | **DONE** | ✓ Verified |
| 6 | Grid track editors | **DONE** | ✓ Verified |
| 7 | Size gaps | **DONE** | ✓ Verified |
| 9 | Font family dropdown | **DONE** | ✓ Verified |
| 13 | Sync infer.ts | **DONE** | ✓ Verified |
| 10 | Tab navigation | **DONE** | ✓ Verified |
| 12 | Integration tests | **ABSORBED** | Tests written inline with features |
| 3 | Tailwind save | **TRIVIAL** | 1-sentence doc update |
| 8 | Spacing polish | **DONE** | Already has warm/cool zone colors in theme.ts |
| 11 | NPM publish | **PARTIAL** | Items 2+4 automatable; 1+3 blocked on user input |
| 1 | Class-scope save path | **BUG FIX** | Undo in class scope doesn't revert `<style>` tag |
| 2 | State-specific styling | **VERIFY + 3 BUGS** | Core is built; 3 confirmed bugs remain |
| 4 | Background image controls | **TODO** | 4 new SelectRow controls |

---

## Phase A: Bug Fixes (Sequential)

### A1. Class-Scope Undo Bug

**Bug:** When user edits in class scope, both `applyClassStyle()` (style tag) and
`applyInlineStyle()` (inline) fire. Undo only reverts inline — the `<style>` tag
retains the stale value. Other instances of the class stay wrong.

**Root cause:** `undo()` in `apply.ts` dispatches `notifyStateChange` for state-keyed
entries (which syncs `statePreview.ts`), but has no equivalent `notifyClassChange`
mechanism for class-scoped entries.

**Fix:** Add a `classChangeListeners` callback system to `apply.ts` (mirroring the
existing `stateChangeListeners` pattern). When `undo()` processes a non-state entry
and the element is in class scope, call `removeClassStyle(className, prop)`.

**Test first:**
```
1. Class-scope undo reverts both inline style AND <style> tag
2. Class-scope redo re-applies to both inline and <style> tag
```

**Acceptance:**
- [ ] Test written that reproduces the bug (fails before fix)
- [ ] Fix applied
- [ ] Test passes
- [ ] `npm run typecheck` passes

---

### A2. State-Specific Styling — Verify + Fix 3 Bugs

**Already implemented** (confirmed in codebase):
- ✓ Composite `stateKey`/`parseStateKey` — `apply.ts:29-45`
- ✓ State preview via `<style>` tag — `statePreview.ts` (295 lines)
- ✓ Apply routing (tri-path callback) — `WebflowPanel.tsx:97-112`
- ✓ State-tagged undo entries — `apply.ts:47`
- ✓ Undo/redo sync with statePreview — `syncWithApplyUndoRedo()`
- ✓ Commit pseudo-class block search — `commit.ts` (`searchPseudoClassBlock`, `searchNestedPseudoBlock`)
- ✓ SCSS nesting support — `commit.ts` (`&:hover {}` insertion)
- ✓ Save consolidation — `commitUtils.ts` (`enrichChangesForCommit`)
- ✓ `isScrubActive()` guard — `scrubState.ts`
- ✓ O(1) `totalOverrideCount` — `apply.ts:120` (`dirtyCount`)
- ✓ Persistent `<style>` element — `statePreview.ts:72`

**3 confirmed bugs to fix:**

#### Bug 1: Reset doesn't clear apply.ts overrides for state entries

`Footer.tsx:handleReset` calls `resetStateStyles(element, activeState)` to clear
`statePreview.ts`, but does NOT clear the composite-keyed entries (e.g. `"hover::color"`)
from `apply.ts`'s overrides map. Result: `dirtyCount` stays wrong, badge/save button
shows stale dirty count after reset.

**Fix:** In `handleReset`, after `resetStateStyles()`, also clear composite-keyed
entries for `activeState` from `apply.ts` overrides. Add a `resetStateOverrides(el, state)`
export to `apply.ts` that removes entries where `parseStateKey(key).state === state`.

**Test first:**
```
1. Reset in hover state → dirtyCount returns to 0
2. Reset in hover state → overrideCount(element) excludes cleared hover entries
```

#### Bug 2: Session restore doesn't rebuild state `<style>` tags

`restoreSession()` in `apply.ts` calls `applyInlineStyle()` with composite keys, which
correctly skips setting inline style for state-keyed props. But it does NOT call
`applyStateStyle()` to rebuild the `<style>` tag. After page refresh, state overrides
are tracked in the overrides map but invisible in the DOM.

**Fix:** In `restoreSession()`, for state-keyed entries, also call `applyStateStyle()`
to rebuild the preview `<style>` tag.

**Test first:**
```
3. After restoreSession with hover overrides → statePreview <style> tag contains rules
4. After restoreSession → visual preview matches pre-refresh state
```

#### Bug 3: State dropdown not guarded during mouse-driven scrub

`isScrubActive()` check at `Overlay.tsx:348` blocks keyboard shortcuts during drag,
but the state dropdown can still be clicked with a mouse mid-drag. This could cause
the state to change while overrides are being applied.

**Fix:** One-line guard in the state change handler: `if (isScrubActive()) return;`

**Test first:**
```
5. Clicking state dropdown during active scrub is a no-op
```

**Acceptance:**
- [ ] 5 tests written that reproduce bugs (fail before fix)
- [ ] All 3 bugs fixed
- [ ] All tests pass
- [ ] `npm run typecheck` passes

---

## Phase B: Polish + New Controls — ALL VERIFIED DONE

### B1. Tailwind Save Scope-Out (Iteration 3) — ✓ ALREADY DONE
`docs/how-redial-works.md:64` already says: "Save writes to CSS Modules. For Tailwind, use Copy as Tailwind."
README doesn't mention Tailwind save. No changes needed.

### B2. Spacing Zone Colors (Iteration 8) — ✓ ALREADY DONE
`theme.ts:228-237` already uses `primaryAlpha` (blue) for margin and `greenAlpha` (green) for padding.
Distinct warm/cool zone colors are in place.

### B3. Background Image Controls (Iteration 4) — ✓ ALREADY DONE
`BackgroundsSection.tsx:234-281` already has all 4 controls (Size, Position, Repeat, Attachment)
with `hasBgImage` detection at line 180.

### B4. NPM Publish — Automatable Items (Iteration 11)

- [ ] `package.json` author set
- [ ] LICENSE copyright verified
- [ ] `npm run build` succeeds
- [ ] `npm pack --dry-run` output clean

**Blocked (user decision needed):**
- Package name (`"redial"` is taken)
- GitHub URLs (need real repo URL)

---

## Execution Order

```
Phase A (sequential — each bug fix builds on the last):
  ├── A1: Class-scope undo bug fix
  └── A2: State styling verify + 3 bug fixes

Phase B (parallel with Phase A):
  ├── B1: Tailwind docs — 5 min
  ├── B2: Background image controls
  └── B3: NPM publish automatable items
```

## Dependencies

- A2 Bug 1 (reset) and Bug 2 (session restore) both touch apply.ts → sequential
- B3 depends on B1 (Tailwind decision affects README)
- Everything else is independent

## Final Acceptance

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
