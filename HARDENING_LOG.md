# Redial — Hardening Log

Tracks progress of the overnight hardening loop. Each iteration picks the highest-priority remaining task, does the work, verifies with typecheck + tests, and commits.

---

## Task Queue (priority order)

### Tier 1 — Fix Failing Tests
- [x] Fix commit.test.ts: "handles hex color in source when from value is computed rgb()"
- [x] Fix commit.test.ts: "handles CSS var() in source when from value is computed"

### Tier 2 — Test Coverage: Pure Utility Modules
- [x] timing.ts — timing tokens, reducedMotion, ms()
- [x] scrubState.ts — scrub active flag get/set
- [x] scope.ts — scope resolution logic
- [x] colorVariables.ts — color variable utilities
- [x] discoverVariables.ts — CSS variable discovery
- [ ] sourcemap.ts — source map parsing
- [ ] panelConstants.tsx — constant arrays, option definitions

### Tier 3 — Test Coverage: Hooks (test pure logic, mock DOM)
- [ ] useWheelAdjust.ts — wheel delta → value increment
- [ ] useDropdownKeyboard.ts — type-ahead, arrow key handling
- [ ] useFocusTrap.ts — focus cycling logic
- [ ] useSwatches.ts — localStorage persistence, add/remove
- [ ] useConversionHint.ts — hint text generation
- [ ] useDragReorder.ts — reorder index calculation
- [ ] useClickOutside.ts — outside click detection

### Tier 4 — Code Quality Review
- [ ] Dead code scan: unused exports across all .ts/.tsx files
- [ ] Type safety: replace `any` types with proper types in overlay modules
- [ ] Consistency: naming patterns, import ordering
- [ ] Server module review: commit.ts edge cases and error handling

### Tier 5 — Performance Review
- [ ] Bundle audit: identify heavy imports or unnecessary dependencies
- [ ] Re-render audit: find React state updates that trigger excessive re-renders

---

## Completed

### Tier 1 — Fix Failing Tests (2026-03-11)
- **commit.test.ts hex color + CSS var() fixes**: Added broad CSS value replacement in `commit.ts` for fuzzy-match strategy. When `getComputedStyle()` returns `rgb()` but source has hex or `var()`, the property line is found via fuzzy search and the entire value is replaced. SCSS variable failure behavior preserved by scoping to fuzzy strategy only. +2 tests fixed, 502 total passing.

### Tier 2 — timing.ts (2026-03-11)
- **timing.ts test coverage**: 13 tests covering timing token values and ordering, reducedMotion get/set/toggle, ms() CSS string output for all tokens, and reduced-motion zero-duration behavior. +13 tests, 515 total.

### Tier 2 — scrubState.ts (2026-03-11)
- **scrubState.ts test coverage**: 5 tests for get/set/toggle/idempotent behavior. +5 tests, 520 total.

### Tier 2 — scope.ts (2026-03-11)
- **scope.ts test coverage**: 36 tests across getCSSModuleClasses (webpack/Turbopack detection), getReadableName (segment extraction), applyClassStyle/removeClassStyle/resetClassStyles/destroyClassStyles (style tag management), and getCustomProperties (var() resolution). +36 tests, 556 total.

### Tier 2 — colorVariables.ts + discoverVariables.ts (2026-03-11)
- **colorVariables.ts**: 20 tests — parseVarRef (var() extraction, whitespace, fallbacks, edge cases), resolveVarColor (DOM resolution), discoverColorVariables (smoke tests).
- **discoverVariables.ts**: 56 tests — parseLength (all CSS units, decimals, negatives), LENGTH_RE (regex validation), detectVarType (color/length/number/string classification), walkRules (CSSRuleList traversal), discoverVariables (inline/inherited/root sources), discoverLengthVariables (filtering). +76 tests, 632 total.
