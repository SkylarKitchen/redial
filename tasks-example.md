# Example Task List

> Each `- [ ]` item is sent as a prompt to a fresh Claude Code session.
> Write tasks as clear, self-contained instructions — each one runs with
> no memory of the others.
>
> Works with both runners:
> - `./run-tasks-parallel.sh tasks-example.md 5` (bash, host worktrees)
> - `npm run tasks -- tasks-example.md --workers 5` (sandcastle, Docker isolation)
>
> See [`docs/sandcastle.md`](docs/sandcastle.md) for the trade-offs.

## Tasks

- [ ] In src/overlay/theme.ts, audit all color tokens and ensure contrast ratios meet WCAG AA (4.5:1 for text). Fix any that don't pass.
- [ ] Add unit tests for src/overlay/infer.ts covering edge cases: elements with no computed styles, inline elements, and SVG elements.
- [ ] Review src/overlay/apply.ts and add JSDoc comments to all exported functions describing their parameters and return values.
