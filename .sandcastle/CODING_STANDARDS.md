# Coding Standards — redial

These standards bind sandcastle implementer and reviewer agents. Reviewers
load this file via `@.sandcastle/CODING_STANDARDS.md`. If a rule here
conflicts with anything in a diff, flag it and require a fix.

Redial is a **public open-source repo** — some rules below exist for that
reason and are non-negotiable.

## Public-repo rules (instant fail)

- **Never write unreleased Anthropic model identifiers into tracked files** —
  no `claude-opus-4-N` / `claude-sonnet-4-N` / `claude-haiku-4-N` for any
  unreleased N, anywhere that gets committed: code, config, docs, tests,
  comments, commit messages. The live model ID lives only in
  `.sandcastle/.env` (gitignored). Refer to it abstractly in committed prose.
- Never log or commit secrets, tokens, or `.env` contents.

## TypeScript

- `npm run typecheck` runs three configs (src, sandcastle scripts, tests).
  All must be green.
- Reject in review: `any`, `as any`, `as unknown as T`, unchecked `as` casts
  on external input, non-null `!` assertions papering over real undefined
  cases.

## Testing policy (issue #105)

- Behavior and accessibility tests **mount the component** (happy-dom) and
  assert rendered DOM: ARIA attributes, dispatched events, focus movement.
- Source-text assertions (`readFileSync` + regex/`toContain`) are reserved
  for true convention audits (`noShadcnInOverlay`, `themeCompliance`,
  `variableAudit`) — never for behavior. String tests pass when runtime
  behavior breaks and fail on harmless renames.
- When touching a file that has source-text behavior tests, migrate those
  tests to behavioral in the same change (accessibility audits first).
  Exemplar migrations: `dropdownAccessibility.test.tsx`,
  `fontPreview.test.tsx`.
- Test names describe expected behavior, not implementation.

## UI & styling

- Panel UI is inline-styled React — no CSS files for panel internals.
- **All design tokens come from `src/overlay/theme.ts`** — reject hardcoded
  hex colors or magic dimension values in components. Panel width is
  `layout.panelWidth`.
- Animation timing comes from `src/overlay/timing.ts`.
- No shadcn imports inside `src/overlay/` (convention-audited).
- This is a dev tool UI: keyboard and screen-reader accessibility of new
  controls matters — new interactive elements need ARIA roles/labels and
  focus handling, verified by behavioral tests.

## Architecture

- Navigate via `src/overlay/DIRECTORY.md`. Panel sections live in
  `src/overlay/sections/`, shared controls in `src/overlay/controls/`
  (import through the barrel: `import { X } from "../controls"`).
- Core engines — `core/apply.ts` (style application, undo/redo),
  `core/infer.ts` (computed-style → panel config), `core/commit*.ts`
  (source-file writes) — are the deep modules. Changes there need tests.
- Follow the existing hook patterns in `src/overlay/hooks/`; don't introduce
  parallel state systems.
- Dropdown options live in `panelConstants.tsx`; CSS parsing in
  `cssParsers.ts`. Extend, don't duplicate.

## File hygiene & process

- Quality gates before every commit, in order, fail-fast:
  `npm run typecheck` → `npm test` → `npm run lint`.
- Comments explain *why*, never *what*. Delete comments that paraphrase the
  code.
- Don't create README/plan/summary `.md` files unless the issue asked.
- Stay scoped to the issue at hand — no drive-by refactors. (Exception: the
  testing-policy migration rule above.)
- Issues are closed by humans after QA, never by agents.
