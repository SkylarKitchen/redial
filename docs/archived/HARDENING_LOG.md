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
- [x] sourcemap.ts — source map parsing
- [x] panelConstants.tsx — constant arrays, option definitions

### Tier 3 — Test Coverage: Hooks (test pure logic, mock DOM)
- [x] useWheelAdjust.ts — wheel delta → value increment
- [x] useDropdownKeyboard.ts — type-ahead, arrow key handling
- [x] useFocusTrap.ts — focus cycling logic
- [x] useSwatches.ts — localStorage persistence, add/remove
- [x] useConversionHint.ts — hint text generation
- [x] useDragReorder.ts — reorder index calculation
- [x] useClickOutside.ts — outside click detection

### Tier 4 — Code Quality Review
- [x] Dead code scan: unused exports across all .ts/.tsx files
- [x] Type safety: replace `any` types with proper types in overlay modules
- [ ] Consistency: naming patterns, import ordering
- [x] Server module review: commit.ts edge cases and error handling

### Tier 5 — Performance Review
- [x] Bundle audit: identify heavy imports or unnecessary dependencies
- [x] Re-render audit: find React state updates that trigger excessive re-renders

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

### Tier 2 — sourcemap.ts + panelConstants.tsx (2026-03-11)
- **sourcemap.ts**: 30 tests — getModuleClassInfo (webpack/Turbopack/SVG/mixed), getReactSource (fiber walking, path stripping, lineNumber edge cases), getCSSSource (derivation from class patterns), resolveSource (fallback chain).
- **panelConstants.tsx**: 62 tests — array lengths, shape validation (value+title+icon / value+label), no duplicate values, critical entries (font weights, border styles, blend modes), EMPTY_KEYWORD_MAP mappings, SHORTCUTS group coverage. Also updated vitest.config.ts for .tsx test discovery. +92 tests, 724 total.

### Tier 3 — Hooks (2026-03-11)
- **useSwatches**: 23 tests — store add/remove, hex normalization, dedup, MAX_SWATCHES cap, localStorage persistence, subscribe/unsubscribe.
- **useWheelAdjust**: 21 tests — base step, shift (10×), alt (0.1×), priority, rounding, min/max clamping, deltaY sign.
- **useDropdownKeyboard**: 29 tests — ArrowDown/Up wrapping, Home/End, single/two-option edges, type-ahead prefix matching.
- **useFocusTrap**: 15 tests — FOCUSABLE_SELECTOR matching (6 element types), getNextFocusTarget boundary cycling.
- **useClickOutside**: 5 tests — contains logic for child/sibling/exact/nested/null.
- Pure logic extracted as exported helpers from each hook for direct testability. +93 tests, 817 total.
- **useDragReorder**: 23 tests — computeOverIndex closest-center algorithm (13), computeItemShift displacement ranges (10).
- **useConversionHint**: 12 tests — buildConversionHint for all unit types, axes, edge values. +35 tests, 852 total.

### Tier 4 — Code Quality (2026-03-11)
- **Dead code scan**: Audited all exports in src/. Found 1 genuinely dead function (`applyTransition` in apply.ts) — removed. Other "dead" exports are test-only helpers or internally-used functions. Noted `getAuthoredValue` duplication between `getAuthoredValue.ts` and `panelUtils.ts`.
- **Type safety audit**: All `any` usages in production code are justified (webpack HMR access, React fiber internals). No gratuitous `any` to fix.
- **Server review**: commit.ts edge cases addressed in Tier 1 (hex/var() broad replacement).

### Tier 5 — Performance Review (2026-03-11)
- **Bundle audit**: lucide-react tree-shakes properly (individual imports). motion only used in Footer.tsx. No barrel imports. Overlay.tsx imports 28 exports from apply.ts (medium concern — could lazy-import handlers).
- **Re-render audit findings** (none critical for a dev tool):
  - MEDIUM: PositionSection.tsx:80 — inline `units` object prop recreated each render (could memoize)
  - MEDIUM: 5 section components create inline property arrays for `sectionInd()` each render (could extract to constants)
  - MEDIUM: Leaf components (SpacingBoxModel, SizeInputCell, PositionOffsetDiagram) lack `memo()` wrappers
  - LOW: Header.tsx, Footer.tsx, controls.tsx — direct DOM style mutations in hover handlers (works, bypasses reconciliation)
  - POSITIVE: WebflowPanel.tsx `ctx` properly memoized with useMemo, PropertySearch has good useCallback patterns
