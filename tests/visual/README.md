# Visual / layout regression sweep

Playwright e2e tests that drive the **real** Redial panel on the test-app
`/demo` page and assert a geometric oracle — the automated "find the visual bugs
for me" net. See [`docs/adr/0002`](../../docs/adr/0002-visual-tests-in-browser-mode.md)
and the `Measurable visual bug` entry in [`CONTEXT.md`](../../CONTEXT.md).

## What it checks

[`sweep.ts`](./sweep.ts) runs in-page and flags three classes of **measurable**
defect across every Redial surface (`.__tuner-root` + open `[data-tuner-portal]`):

| Finding | Meaning |
|---|---|
| `surface-offviewport` | a panel/popover whose rect escapes the viewport (can't see/reach it) |
| `h-spill` | a descendant pokes out past its surface **with no clipping ancestor** (truly sticks out) |
| `h-content-clipped` | content hard-cut by `overflow-x:hidden` with **no** ellipsis affordance (text chopped) |

Intentional containment is **not** flagged: `overflow:visible` content that stays
within the surface, the panel root's own `overflow-x:hidden` edge clip,
`overflow:auto/scroll` scroll regions (e.g. the breadcrumb), `text-overflow:ellipsis`
truncation (variable pills), and the 1px screen-reader-only clip.

## What it drives

- `panel-overflow.spec.ts` — default state
- `panel-states.spec.ts` — 11 element archetypes (text/flex/grid/image/button/…) + every dropdown opened
- `panel-rich-content.spec.ts` — multi-shadow / multi-stop gradient / multi-fn transform/filter/transition
- `panel-viewport.spec.ts` — common editor window sizes (down to 960×700)
- `panel-edge.spec.ts` — every dropdown opened on SHORT viewports (downward popover must flip up, not escape)
- `panel-popovers.spec.ts` — the color-picker portal (its own positioned surface): opened from every swatch, default + short viewports

**Add a state here and it is swept on every run.**

## Running it

The sweep needs a real browser. On this macOS host, binary-authorization (Santa)
kills a Playwright-spawned Chromium, so we run it inside an Orbstack/Docker Linux
sandbox against the dev server on the host.

```sh
# 1. start the dev server on the host
npm --prefix test-app run dev          # http://localhost:3000

# 2. run the sweep in the sandbox (another terminal)
npm run test:visual                    # all specs
npm run test:visual -- panel-states    # filter
```

`scripts/visual-test.sh` mounts the repo into `mcr.microsoft.com/playwright`
(keep the image tag in sync with the `@playwright/test` version) and points the
tests at `host.docker.internal:3000`.

### CI (Linux — no Santa)

```sh
npm run test:visual:ci                 # Playwright starts the dev server itself
```
