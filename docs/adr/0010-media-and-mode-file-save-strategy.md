# ADR-0010: File-save strategy for breakpoint `@media` blocks and mode overrides

**Status:** Proposed — decision-ready draft awaiting maintainer sign-off (issue #53)
**Date:** 2026-06-09

## Context

ADR-0005 made breakpoints a composition dimension of the override model; #35
shipped the UI, media-gated live preview, and clipboard export. Mode overrides
(CSS-variable values per theme mode) work the same way. Neither writes to
source on Save: `enrichChangesForCommit` drops breakpoint-tagged changes
(`commitUtils.ts:71`) and `UnifiedDiff.modes` is pre-serialized clipboard text
(`engine.ts:226`). Issue #53 asks for the write strategy.

A full pipeline inventory (2026-06-09) found five hard constraints:

1. **No media-aware targeting exists.** `commit.ts` locates declarations by
   tiered text search (`findPropertyInFile`, `commit.ts:932`) keyed on
   className/prop/from-value; brace counting traverses `@media` wrappers only
   incidentally, and base-vs-media duplicates are disambiguated solely by
   `from`-value (`outliers-commit-nesting.test.ts:163`).
2. **No wire field.** `CommitChange` (`commit.ts:98`) has no
   breakpoint/media member; `DiffEntry.breakpoint` exists and survives
   enrichment typing but is filtered before send.
3. **Mode overrides are unlocatable.** The store is
   `Map<selector, Map<var, value>>` (`modeOverrides.ts:25`) with no
   file/href/line; discovery (`modeDiscovery.ts`) drops sheet identity; the
   server's root-block tier matches only `:root`/`[data-theme…]`
   (`commit.ts:693`) — a `.dark { --bg: … }` site doesn't match, and the
   fuzzy tier would then rewrite the *first* `--bg:` anywhere, i.e. the wrong
   (light) block.
4. **Round-trip blindness.** `getAuthoredValue`, `getCSSSource`, and
   `getVariableDefinitionSource` iterate top-level rules only — a written
   `@media` block would not be re-discovered on the next save, risking
   duplicates.
5. **Tailwind breakpoints are variant prefixes, not `@media`.** The merge
   side already understands stacked variants (`getUtilityGroup`,
   `commitTailwind.ts:96`). The inventory originally found
   `formatTailwindDiff` ignored `breakpoint` **and `state`**, so a
   `:hover` edit on a Tailwind element saved as an *unprefixed base
   utility*; the **state half is fixed** as of this draft —
   `formatTailwindDiff` (`tailwind.ts:32`) composes state variants via
   `STATE_VARIANTS` and `enrichChangesForCommit` refuses unmappable
   states (regression tests: `commitUtilsTailwindState.test.ts`,
   `tailwind.test.ts`, `commitTailwind.test.ts`). `breakpoint` is still
   unmapped — the `md:` prefix half remains this ADR's scope.

## Decision (recommended)

Stay **text-surgical and refusal-first** (the existing pipeline philosophy —
AST rewriting remains #36's question). Five parts:

### 1. Wire protocol

Add `breakpoint?: string` (registry id, e.g. `"768"`) to `CommitChange`.
Client and server ship in one package, so no version-skew handling — but the
server must **refuse** (not base-write) any change carrying an unknown
breakpoint id. Remove the `commitUtils.ts:71` filter only in the same change
that lands server support. The clipboard path stays as the fallback UX for
every refusal.

### 2. CSS write strategy (new media-aware tier in `commit.ts`)

For a change with `breakpoint`, derive the condition from the registry
(`mediaConditionFor`, `breakpoints.ts:59` — exactly `(min-width: Npx)`):

- **Locate:** find `@media` blocks whose condition matches after whitespace
  normalization (`min-width:768px` ≡ `min-width: 768px`); within one, reuse
  the existing class-block + property search. Complex conditions in host
  files (`prefers-*`, range syntax) never match — we only ever merge into
  blocks we could have written.
- **Edit:** if the selector + prop + `from` value exist inside a matching
  block → surgical value replacement (existing machinery).
- **Insert:** else if a matching-condition block exists → splice the
  declaration/selector block into it.
- **Create:** else append a new `@media (min-width: Npx) { .cls { … } }`
  block at **end of file** — cascade-safe (last wins at equal specificity),
  splice-simple, and idempotent with the locate tier above. Multiple new
  breakpoints in one save append in ascending px order (mobile-first,
  matching `serializeBreakpointCSS`, `breakpoints.ts:107`).
- **Compose state:** `768@@hover::color` targets `.cls:hover` inside the
  block, reusing the existing pseudo-state block logic (`commit.ts:1076`).
- **Refuse:** ambiguity (multiple matching blocks containing the selector
  with the same `from`), SCSS variables, or unlocatable base class — same
  `failed[]` + clipboard fallback as today.

### 3. Mode overrides

- **Carry identity from discovery:** retain the sheet href in
  `ModeDeclaration`/`InferredMode` (today dropped, `modeDiscovery.ts:18`) so
  enrichment can resolve a file the same way other changes do.
- **Selector-scoped targeting:** add `selectorScope?: string` to
  `CommitChange`; the root-block tier (`commit.ts:687`) accepts the mode's
  actual selector (`.dark`, `[data-theme="dark"]`, `:root`) instead of only
  the hardcoded root pattern. Keep `from`-value disambiguation.
- **Forbid the fuzzy tier for selector-scoped variables** — the inventory
  showed it would rewrite the light `:root` value. Unlocatable → refuse →
  clipboard, never guess.
- **Media-source modes stay read-only** (`prefers-color-scheme` blocks) —
  already non-editable in the UI (`ModeValueCell.tsx:70`); excluded here.

### 4. Tailwind path

- Map registry ids to default screens: 640→`sm:`, 768→`md:`, 1024→`lg:`,
  1280→`xl:`; any other px → arbitrary variant `min-[Npx]:`. Project-custom
  `screens` config is #40's domain (Tailwind v4 CSS-first awareness) — note
  the dependency, don't block on it.
- `formatTailwindDiff` already composes the state variant per change
  (the unprefixed-state bug from constraint 5 is fixed; `hover:`
  emission is locked by regression tests). This ADR adds the breakpoint
  prefix in front of it — `{breakpoint: "768", state: "hover"}` →
  `md:hover:p-4`. The variant-aware merge side needs no change.

### 5. Round-trip read side

Reuse the navigator's recursive walker shape (`walkRulesWithMedia`,
`cssRuleGatherer.ts:60`) in `getAuthoredValue`/`getCSSSource`/
`getVariableDefinitionSource`, filtered by the relevant condition, so a
written block is re-discovered on the next save (edit → save → re-edit →
second save must edit the same block, not duplicate it).

## Acceptance (instantiates #53's criteria)

- Round-trip: edit at ≥768 → Save → `@media (min-width: 768px)` block in the
  source file → re-infer reads it back → second edit at ≥768 modifies the
  same block (no duplicates).
- Mode round-trip: edit a `.dark` variable → Save → value changes inside the
  `.dark` block only; light `:root` untouched (regression test for the
  wrong-block fuzzy hazard).
- Tailwind: breakpoint edit emits `md:*`; state edit emits `hover:*`
  (already shipped and locked by `commitUtilsTailwindState.test.ts`);
  unknown px emits `min-[Npx]:*`.
- Every refusal path lands in `failed[]` with the clipboard fallback toast —
  no silent base-style writes anywhere (extends the
  `outliers-commit-nesting` duplicate-disambiguation suite to
  condition-aware targeting).

## Alternatives considered

- **AST rewrite (PostCSS/SCSS parser).** Deferred to #36, which owns the
  SCSS-AST question; the text-surgical pipeline already encodes the
  refuse-don't-guess posture and its outlier suites. If #36 lands an AST
  backend, the media tier migrates with everything else.
- **Insert `@media` adjacent to the base block.** Rejected: mid-file splices
  shift line numbers for subsequent same-save changes, and EOF placement is
  strictly safer in the cascade.
- **Per-breakpoint partial files** (`styles.768.css`). Rejected: invents a
  project convention Redial has no business imposing.
- **Write breakpoints as `[data-redial-bp]` attribute rules** (reusing the
  preview mechanism, `breakpointPreview.ts:9`). Rejected: preview-only
  synthetic selectors must never leak into source.

## Related

- Issue #53 (acceptance basis), #35 (preview + clipboard layers), #36
  (AST/dry-run — kept orthogonal), #40 (custom Tailwind screens),
  ADR-0005 (the model this saves), ADR-0004 (mode reset separation).
