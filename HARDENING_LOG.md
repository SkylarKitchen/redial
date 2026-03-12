# Redial — Hardening Log

Tracks progress of the overnight hardening loop. Each iteration picks the highest-priority remaining task, does the work, verifies with typecheck + tests, and commits.

---

## Task Queue (priority order)

### Tier 1 — Fix Failing Tests
- [ ] Fix commit.test.ts: "handles hex color in source when from value is computed rgb()"
- [ ] Fix commit.test.ts: "handles CSS var() in source when from value is computed"

### Tier 2 — Test Coverage: Pure Utility Modules
- [ ] timing.ts — timing tokens, reducedMotion, ms()
- [ ] scrubState.ts — scrub active flag get/set
- [ ] scope.ts — scope resolution logic
- [ ] colorVariables.ts — color variable utilities
- [ ] discoverVariables.ts — CSS variable discovery
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

(none yet)
