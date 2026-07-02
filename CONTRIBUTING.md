# Contributing to Redial

Thanks for helping improve Redial. This is a small, fast-moving project — the
bar is accuracy and tests, not ceremony.

## Dev setup

```sh
git clone https://github.com/SkylarKitchen/redial
cd redial
npm install
npm run build        # TypeScript compile (tsup)
npm run dev          # Watch mode
npm run typecheck    # Type check only
npm test             # Vitest
```

The `test-app/` directory is a full Next.js app for manual testing:

- `http://localhost:3000/demo` — auto-opens the panel on sample content
- `http://localhost:3000/showcase` — visual component showcase (live tokens from `theme.ts`)

## Before you code

- Read [`src/overlay/DIRECTORY.md`](src/overlay/DIRECTORY.md) — the per-file map of the overlay.
- Read [`CONTEXT.md`](CONTEXT.md) for the project's vocabulary and [`ARCHITECTURE.md`](ARCHITECTURE.md) for the internals.
- Check [GitHub Issues](https://github.com/SkylarKitchen/redial/issues) — the tracker. Triage labels are documented in [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

## The TDD norm

**Bug fixes start with a failing test.** Write a test that reproduces the bug
exactly as reported, confirm it fails, then fix until it passes. The fix isn't
done until the test is green. Features should land with tests covering their
behavior — the suite (3700+ tests) is the project's safety net.

## Conventions

- All panel UI is inline-styled React — no CSS files for panel internals, no shadcn/Radix.
- Every color/dimension/shadow comes from `src/overlay/theme.ts`. Never hardcode hex in components (ESLint enforces this).
- Undo batching is `beginBatch`/`endBatch` only — never time-based coalescing.
- Portals need `data-tuner-portal` and max z-index (`zIndex.max`).

## PR expectations

- Keep PRs focused: one issue/feature per PR.
- `npm run typecheck`, `npm test`, and `npm run lint` must pass — CI runs all three plus the build.
- Reference the issue you're fixing (`Fixes #N`).
- Update docs (README/ARCHITECTURE/DIRECTORY.md) when behavior or structure changes — docs that contradict code are treated as bugs.

## Security issues

Do **not** open a public issue — see [SECURITY.md](SECURITY.md).
