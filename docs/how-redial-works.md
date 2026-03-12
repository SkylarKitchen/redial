# Redial — How It Works & Why It's Useful

## What Is Redial?

Redial is a floating CSS tuning panel that overlays on top of any Next.js app during development. Think of it like Webflow's style inspector, but for your actual codebase. You click an element, get context-aware sliders and pickers for its CSS properties, drag to adjust, and hit Save — and your source files update on disk, live.

No copying hex codes. No switching tabs to find the right `.module.scss` file. No guessing which line to edit.

## Who Is This For?

- **Designers in code** who think visually and want to tune spacing, color, and typography by feel rather than by typing values
- **Developers moving fast** who'd rather drag a border-radius slider than remember whether it's `12px` or `0.75rem` in this particular file
- **Anyone doing UI polish passes** — the last 20% of visual work where you're tweaking `letter-spacing` by half a pixel at a time

## The Save Pipeline

When you click **Save** in the panel footer, here's what actually happens:

### 1. Diff Calculation (browser)

Redial tracks every property you've touched. When you first drag a slider, it snapshots the original computed value from `getComputedStyle()`. The diff is: *what changed from that original?* Only genuinely modified properties are included — if you drag a slider and drag it back, it's excluded.

### 2. Source File Resolution (browser)

Before sending anything to the server, Redial figures out *which source file* each property lives in. It does this two ways:

- **CSS Modules class names** — e.g., a class like `Button_btn__a8f2k` tells Redial the styles live in `Button.module.scss`
- **React debug info** — in dev mode, React fibers carry `__debugSource` with the JSX file path and line number

### 3. Server Commit (Next.js API route)

The enriched changes are POSTed to `/api/tuner/commit`, a dev-only API route running inside your Next.js dev server. This route is disabled in production — it returns a 404 if `NODE_ENV` isn't `development`.

### 4. Surgical File Write (disk)

The server finds the exact line in your source file using a tiered search strategy:

| Strategy | How it works |
|---|---|
| **Line window** | If we know the line number, search ±5 lines around it |
| **Class block** | Find the `.className { }` block and search within it |
| **Full file** | Scan the entire file for `property: value` |
| **Fuzzy** | Last resort — find any line with just the property name (handles variables, `calc()`, etc.) |

Once found, it does a regex-based replacement of *only the value*, preserving your indentation, comments, and everything else. The file is written back to disk with `fs.writeFile`.

### 5. HMR Reload (automatic)

Since this runs during `next dev`, the file change triggers Hot Module Replacement automatically. The browser reflects the new styles without a full page reload.

## What Else It Does (Beyond Save)

- **Undo/Redo** — Full undo stack (⌘Z / ⌘⇧Z) with batch support for multi-property operations like Paste Styles
- **Copy as CSS / Tailwind / CSS Variables** — Clipboard dropdown exports changes in multiple formats
- **Paste Styles** — Copy from one element, paste onto another
- **Session persistence** — Unsaved changes survive page refreshes and HMR reloads (stored in localStorage)
- **Reset** — Revert all changes on an element back to the original computed values

## Key Constraints

- **Dev-only** — The save route is completely disabled in production builds
- **CSS Modules focus** — Source file resolution works best with `.module.scss` and `.module.css` files. Global stylesheets without module patterns may not resolve correctly (changes will show as "failed" rather than writing to the wrong place)
- **No destructive failures** — If Redial can't confidently locate the right line in the right file, it reports the failure explicitly. It won't silently write to an incorrect location.
