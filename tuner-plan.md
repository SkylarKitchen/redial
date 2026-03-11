# Tuner — Plan v3

**A floating Webflow/Figma-style property panel for your live Next.js app. Click any element, get context-aware controls, drag to tune, changes write directly to your SCSS source files and go live via HMR. Built on DialKit for the control UI.**

---

## What changed from v2 and why

| v2 plan | This plan | Why |
|---|---|---|
| Custom slider, color picker, select from scratch | DialKit renders all controls | DialKit already solved the hardest UI problem — making sliders, color pickers, and folders feel polished. MIT licensed. Saves ~2 days of the most tedious UI work. |
| Custom section components (Typography.tsx, Spacing.tsx, etc.) | DialKit nested objects → collapsible folders | DialKit turns nested config objects into collapsible folders automatically. Our section components were just lists of controls anyway. |
| ~12 files that matter | ~7 files that matter | Removing the controls/ and sections/ directories. DialKit replaces them. |
| JSON export was cut | JSON export for free | DialKit has built-in JSON export/import. Session persistence comes free. |

Everything else from v2 stays: click-to-inspect, Shadow DOM isolation, `infer.ts`, context-aware sections, direct file writes, HMR auto-reset, scope resolution, undo stack.

---

## The core insight

The engine is **the slider**. We don't build the slider — DialKit already built it. Our job is the layer above and below:

- **Above:** `infer.ts` looks at the DOM and decides *which* controls to show. DialKit has no idea what element you clicked — it just renders whatever config you hand it.
- **Below:** `apply.ts` intercepts value changes and applies them as inline styles. `commit.ts` writes them to source files. DialKit doesn't know about files — it just reports that a value changed.

DialKit is the rendering layer. We are the intelligence layer and the persistence layer.

```
  click element
       │
       ▼
  ┌─────────┐     ┌──────────┐     ┌──────────┐
  │ infer.ts │────▶│ DialKit  │────▶│ apply.ts │──── inline styles (instant)
  │          │     │ (UI)     │     │          │
  │ DOM →    │     │ sliders, │     │ value    │──── commit.ts → file write → HMR
  │ config   │     │ pickers, │     │ changes  │
  └─────────┘     │ folders  │     └──────────┘
                   └──────────┘
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  localhost:3000 (Next.js dev server)                                  │
│                                                                       │
│  ┌──────────────────────────┐   ┌──────────────────────────────────┐  │
│  │  Your app                │   │  Shadow DOM host                 │  │
│  │                          │   │  ┌────────────────────────────┐  │  │
│  │  <button class={btn}>    │   │  │ button.Button_btn          │  │  │
│  │    ▲                     │   │  │ 📍 Button.tsx:12           │  │  │
│  │    │ inline style        │   │  │ ⬤ element  ○ .btn          │  │  │
│  │    │ overrides           │   │  ├────────────────────────────┤  │  │
│  │    │ (instant)           │   │  │                            │  │  │
│  │    │                     │   │  │  DialKit <DialRoot />      │  │  │
│  │    │                     │   │  │  ┌ Typography ──────────┐  │  │  │
│  │    │                     │   │  │  │ font-size  ███░░ [16]│  │  │  │
│  │    │                     │   │  │  │ weight     ██░░░ [500│  │  │  │
│  │    │                     │   │  │  │ color      ■ #1a1a1a │  │  │  │
│  │    │                     │   │  │  └──────────────────────┘  │  │  │
│  │    │                     │   │  │  ┌ Spacing ─────────────┐  │  │  │
│  │    └─────────────────┐   │   │  │  │ pad-top   █░░░░  [ 8]│  │  │  │
│  │                      │   │   │  │  │ pad-right ██░░░  [12]│  │  │  │
│  │                      └───┤   │  │  └──────────────────────┘  │  │  │
│  │                          │   │  │  ┌ Appearance ──────────┐  │  │  │
│  │                          │   │  │  │ radius    █░░░░  [ 4]│  │  │  │
│  │                          │   │  │  │ bg        ■ #3b82f6  │  │  │  │
│  │                          │   │  │  └──────────────────────┘  │  │  │
│  │                          │   │  ├────────────────────────────┤  │  │
│  │                          │   │  │ ✨ Suggest   📋 Copy  ⚡ Save│  │  │
│  └──────────────────────────┘   │  └────────────────────────────┘  │  │
│                                  └──────────────────────────────────┘  │
│          Injected by next.config.js plugin in dev mode only           │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               │  POST /__tuner/commit
                               │  (dev server route, same process)
                               ▼
                    ┌─────────────────────┐
                    │  commit.ts          │
                    │  read source map    │
                    │  find file:line     │
                    │  string replace     │
                    │  write file → HMR   │
                    └─────────────────────┘
```

**Key property:** zero extra processes, zero extra ports. DialKit renders inside our Shadow DOM. The commit path is a dev-only API route. HMR is already running.

---

## How DialKit integrates

DialKit's API: `useDialKit(name, config, options?)` takes a config object and returns reactive values. The config shape determines the control type automatically:

```
[default, min, max, step?]  → slider
"#ff5500"                   → color picker
true / false                → toggle
{ type: "select", ... }    → dropdown
nested object               → collapsible folder
```

Our `infer.ts` generates a DialKit-compatible config from the DOM. The mapping:

| Our concept | DialKit format |
|---|---|
| Typography section with font-size slider | `{ Typography: { 'font-size': [16, 8, 32, 1] } }` |
| Color control | `{ Typography: { color: '#1a1a1a' } }` |
| Select control | `{ Layout: { 'justify-content': { type: 'select', default: 'center', options: [...] } } }` |
| Collapsed section | `{ Appearance: { _collapsed: true, 'border-radius': [4, 0, 48, 1] } }` |

DialKit handles all the rendering: sliders with fill bars, color pickers, collapsible folder headers, the floating panel chrome. We never touch control UI code.

### The integration component

```tsx
function TunerPanel({ element }: { element: Element | null }) {
  const [config, setConfig] = useState<Record<string, any>>({});

  // When element changes, regenerate config
  useEffect(() => {
    if (!element) return;
    setConfig(infer(element));
  }, [element]);

  // useDialKit returns current values reactively
  const values = useDialKit('Tuner', config, {
    onChange(name, value) {
      // Every slider drag → apply inline style instantly
      applyInlineStyle(element, name, value);
    },
  });

  return (
    <>
      {/* Custom header: element name, source file, scope toggle */}
      <TunerHeader element={element} />

      {/* DialKit renders everything in between */}
      <DialRoot position="top-right" />

      {/* Custom footer: Save, Copy, Reset */}
      <TunerFooter element={element} />
    </>
  );
}
```

**What DialKit gives us for free:**
- Slider with fill bar, number input, drag, shift+drag, arrow keys
- Color picker with swatch
- Collapsible folders with remember-state
- Select/dropdown controls
- JSON export/import (session persistence)
- Keyboard navigation between controls
- The floating panel shell

**What we build around it:**
- The selector (click-to-inspect) — DialKit has no concept of this
- `infer.ts` — DOM → DialKit config
- `apply.ts` — intercept `onChange` → inline styles + undo stack
- `commit.ts` — direct file writes
- Shadow DOM wrapper — DialKit renders inside our shadow root
- Scope toggle — custom UI above DialKit's folders
- HMR auto-reset
- Save / Copy / Reset footer

### Shadow DOM compatibility

DialKit normally mounts as a sibling to `<body>` children. We need it inside our Shadow DOM instead. Two approaches:

1. **Render DialKit into the shadow root directly.** Import `dialkit/styles.css` into the shadow (via `<style>` or adopted stylesheet). If DialKit's `<DialRoot />` accepts a container ref, mount it there. This is the clean path.

2. **If DialKit doesn't support custom mount targets,** wrap it: render a hidden div in the light DOM for DialKit to attach to, then use a `MutationObserver` to portal its rendered output into the shadow. Hacky but works.

Approach 1 is the bet. If DialKit uses a React portal internally (likely, for floating behavior), we just need to redirect that portal target.

---

## Context-aware UI

The panel shows **only what's relevant to what you clicked.** `infer.ts` generates different DialKit folder structures for different elements.

### What shows for what

| You click... | DialKit folders generated |
|---|---|
| A `<button>` | Typography { font-size, weight, color } + Spacing { padding-*, margin-* } + Appearance { bg, radius, border } |
| An `<h2>` | Typography { font-size, weight, line-height, letter-spacing, color } + Spacing |
| A `<div>` with `display: flex` | Layout { direction, justify, align, wrap, gap } + Spacing + Appearance |
| An `<img>` | Size { object-fit, width, height } + Appearance { radius, opacity } + Spacing |
| An `<input>` | Typography + Spacing + Appearance { border, bg, radius } |
| A flex child | Layout { flex-grow, shrink, basis, align-self } + Spacing |

**The rule:** if `getComputedStyle` returns a non-default value for a property, or the element's tag/role makes that property commonly tuned, include it. Otherwise, don't.

### The spacing folder

Spacing is the one section that would benefit from a custom visual (the box model diagram) rather than a flat list of 8 sliders. Two options:

1. **Use DialKit sliders for all 8 values.** Less visual, but zero custom UI. Label them clearly: `pad-top`, `pad-right`, `margin-top`, etc. Group padding and margin into sub-folders.

2. **Custom box model diagram as a DialKit action + sliders.** Render the diagram as a static visual above the sliders (using DialKit's action type to embed custom JSX). Click a segment to scroll to its slider.

For v1, option 1. It works, it ships. The box model diagram is a polish pass — and only matters once you're tuning spacing frequently enough to want the visual shortcut.

---

## File structure

```
tuner/
├── package.json                   # depends on dialkit, motion
├── next-plugin.js                 # withTuner() wrapper for next.config.js
├── src/
│   ├── overlay/
│   │   ├── Overlay.tsx            # Shadow DOM host, mounts DialKit + custom chrome
│   │   ├── Selector.tsx           # Hover/click, the indigo outline
│   │   ├── Header.tsx             # Element name, source file link, scope toggle
│   │   ├── Footer.tsx             # Save, Copy, Reset buttons
│   │   ├── infer.ts               # element + computed styles → DialKit config object
│   │   ├── scope.ts               # element ↔ class ↔ variable resolution
│   │   └── apply.ts               # inline style management, undo stack, diff tracking
│   └── server/
│       ├── commit.ts              # Direct file write: source map → find file:line → replace → save
│       └── routes.ts              # Dev-only API routes (/__tuner/commit, /__tuner/source-map)
└── README.md
```

**~7 files that matter.** DialKit handles all control rendering. Our overlay files are the selector, the custom chrome (header/footer), and the three core modules (infer, scope, apply). The server has commit and routes.

---

## Phase 1: The loop (ship this first)

**Goal: click element → DialKit panel with context-aware controls → drag slider → see change → save to file. No AI anywhere.**

### 1a. Next.js plugin

```js
// next.config.js
const withTuner = require('tuner/next-plugin');
module.exports = withTuner({ /* your config */ });
```

What the plugin does:
- In dev mode only, injects `<TunerOverlay />` inside a **Shadow DOM host** attached to `<body>`
- Adds dev-only API routes at `/__tuner/commit` and `/__tuner/source-map`
- Source file detection uses `__source` props on JSX elements — both SWC (Next.js default since v12) and Babel inject these automatically in dev mode. No extra plugin needed.

### 1b. The Selector

A full-viewport invisible overlay that:
- Activates on a hotkey (default `` ` `` backtick)
- On activate: `pointer-events: auto`, crosshair cursor, indigo outline follows `elementFromPoint(e.clientX, e.clientY)` on mousemove
- On click: deactivate overlay, capture the element, run `infer.ts`, hand config to DialKit
- Escape key cancels

The outline is a single absolutely-positioned div with a box-shadow border, repositioned via `getBoundingClientRect()`.

**Shadow DOM isolation.** The panel (DialKit + custom chrome) lives inside a Shadow DOM:

```ts
const host = document.createElement('tuner-root');
document.body.appendChild(host);
const shadow = host.attachShadow({ mode: 'open' });
```

1. **Z-index wars solved.** `position: fixed; z-index: 2147483647` on the host. Shadow-scoped styles can't be overridden by app CSS.
2. **Style leakage solved.** Panel CSS stays in the shadow. App CSS stays out.

The selector highlight div lives on `document.body` (outside the shadow) so `elementFromPoint` works normally.

### 1c. Local inference (`infer.ts`)

Input: a DOM element. Output: a DialKit-compatible config object.

```ts
function infer(el: Element): Record<string, any> {
  const cs = getComputedStyle(el);
  const tag = el.tagName.toLowerCase();
  const config: Record<string, any> = {};

  // Typography — only for text-bearing elements
  const isTextBearing = el.textContent?.trim() &&
    ['h1','h2','h3','h4','h5','h6','p','span','a','label','button','li','td','th','input','textarea']
    .includes(tag) || el.matches('[role=button], [role=heading], [contenteditable]');

  if (isTextBearing) {
    const fontSize = parseFloat(cs.fontSize);
    config.Typography = {
      'font-size':      [fontSize, Math.max(8, fontSize * 0.5), fontSize * 2.5, 1],
      'font-weight':    [parseInt(cs.fontWeight), 100, 900, 100],
      'line-height':    [parseFloat(cs.lineHeight) / fontSize, 0.8, 2.5, 0.05],
      'letter-spacing': [parseFloat(cs.letterSpacing) || 0, -2, 8, 0.25],
      'color':          rgbToHex(cs.color),
    };
  }

  // Spacing — always
  config.Spacing = {
    Padding: {
      'padding-top':    [parseFloat(cs.paddingTop),    0, 64, 1],
      'padding-right':  [parseFloat(cs.paddingRight),  0, 64, 1],
      'padding-bottom': [parseFloat(cs.paddingBottom), 0, 64, 1],
      'padding-left':   [parseFloat(cs.paddingLeft),   0, 64, 1],
    },
    Margin: {
      'margin-top':    [parseFloat(cs.marginTop),    -32, 64, 1],
      'margin-right':  [parseFloat(cs.marginRight),  -32, 64, 1],
      'margin-bottom': [parseFloat(cs.marginBottom), -32, 64, 1],
      'margin-left':   [parseFloat(cs.marginLeft),   -32, 64, 1],
    },
  };

  // Layout — only for flex/grid containers
  if (cs.display === 'flex' || cs.display === 'inline-flex') {
    config.Layout = {
      'flex-direction':  { type: 'select', default: cs.flexDirection,
                           options: ['row', 'column', 'row-reverse', 'column-reverse'] },
      'justify-content': { type: 'select', default: cs.justifyContent,
                           options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] },
      'align-items':     { type: 'select', default: cs.alignItems,
                           options: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'] },
      'flex-wrap':       { type: 'select', default: cs.flexWrap,
                           options: ['nowrap', 'wrap', 'wrap-reverse'] },
      'gap':             [parseFloat(cs.gap) || 0, 0, 64, 1],
    };
  }

  if (cs.display === 'grid' || cs.display === 'inline-grid') {
    config.Layout = {
      'gap':            [parseFloat(cs.gap) || 0, 0, 64, 1],
      'justify-items':  { type: 'select', default: cs.justifyItems, options: ['start', 'center', 'end', 'stretch'] },
      'align-items':    { type: 'select', default: cs.alignItems, options: ['start', 'center', 'end', 'stretch'] },
    };
  }

  // Size — for images/video or elements with explicit dimensions
  if (tag === 'img' || tag === 'video' || tag === 'canvas') {
    config.Size = {
      'object-fit': { type: 'select', default: cs.objectFit,
                      options: ['cover', 'contain', 'fill', 'none', 'scale-down'] },
      'width':  [parseFloat(cs.width),  0, 1200, 1],
      'height': [parseFloat(cs.height), 0, 800,  1],
    };
  }

  // Appearance — always, collapsed by default for text-only
  const appearance: Record<string, any> = {
    _collapsed: isTextBearing && cs.backgroundColor === 'rgba(0, 0, 0, 0)',
    'border-radius': [parseFloat(cs.borderTopLeftRadius), 0, 48, 1],
    'opacity':       [parseFloat(cs.opacity), 0, 1, 0.05],
  };
  if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
    appearance['background-color'] = rgbToHex(cs.backgroundColor);
  }
  if (parseFloat(cs.borderWidth) > 0) {
    appearance['border-width'] = [parseFloat(cs.borderWidth), 0, 8, 1];
    appearance['border-color'] = rgbToHex(cs.borderColor);
  }
  config.Appearance = appearance;

  return config;
}
```

**The ranges matter as much as the controls.** `min: fontSize * 0.5, max: fontSize * 2.5` means the slider is always centered-ish on the current value with room to explore. This is what makes it feel like dialing.

Runs in <1ms. No network. No loading spinner. DialKit renders the result immediately.

### 1d. Apply + Undo (`apply.ts`)

DialKit's `onChange` callback fires on every slider drag. We intercept it to apply inline styles:

```ts
type Override = { initial: string; current: string };
const overrides = new Map<Element, Map<string, Override>>();
const undoStack: Array<{ el: Element; prop: string; prev: string }> = [];

function applyInlineStyle(el: Element, prop: string, value: string) {
  if (!overrides.has(el)) overrides.set(el, new Map());
  const elOverrides = overrides.get(el)!;

  if (!elOverrides.has(prop)) {
    elOverrides.set(prop, { initial: getComputedStyle(el)[prop], current: value });
    undoStack.push({ el, prop, prev: getComputedStyle(el)[prop] });
  } else {
    undoStack.push({ el, prop, prev: elOverrides.get(prop)!.current });
    elOverrides.get(prop)!.current = value;
  }

  (el as HTMLElement).style.setProperty(prop, value, 'important');
}

function undo() {
  const last = undoStack.pop();
  if (!last) return;
  const { el, prop, prev } = last;
  const elOverrides = overrides.get(el);
  if (!elOverrides) return;

  if (prev === elOverrides.get(prop)?.initial) {
    (el as HTMLElement).style.removeProperty(prop);
    elOverrides.delete(prop);
  } else {
    (el as HTMLElement).style.setProperty(prop, prev, 'important');
    elOverrides.get(prop)!.current = prev;
  }
}

function reset(el: Element) { /* remove all inline styles, clear from map */ }
function diff(): Diff[] { /* flatten into {sourceFile, sourceLine, prop, from, to}[] */ }
```

### 1e. Direct commit (`commit.ts`)

The "Save" button writes directly to your source files via a dev-only API route.

```ts
// Browser side
async function save() {
  const changes = diff();
  const res = await fetch('/__tuner/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes }),
  });
  const result = await res.json();
  // result: { written: ['src/components/Button.module.scss'], failed: [] }
  // Footer shows: "✓ Saved 3 changes to Button.module.scss" (green flash)
}
```

Server-side (`server/commit.ts`) does the file write:

```ts
async function handleCommit(changes: Change[]) {
  const results = { written: new Set<string>(), failed: [] };

  for (const change of changes) {
    const filePath = path.resolve(process.cwd(), change.sourceFile);
    const source = await fs.readFile(filePath, 'utf-8');
    const lines = source.split('\n');

    // Find the property in a ±3 line window (source maps aren't byte-perfect)
    const target = findPropertyInWindow(lines, change.sourceLine, change.prop, change.from);

    if (!target) {
      results.failed.push({ ...change, reason: 'property not found at expected location' });
      continue;
    }

    // Surgical string replacement: only the value changes
    lines[target.line] = lines[target.line].replace(
      new RegExp(`(${escapeRegex(change.prop)}\\s*:\\s*)${escapeRegex(change.from)}`),
      `$1${change.to}`
    );

    await fs.writeFile(filePath, lines.join('\n'));
    results.written.add(change.sourceFile);
  }

  return results;
}
```

**Handles the 90% case:** literal property value changes in `.module.scss` files. `font-size: 16px` → `font-size: 18px` is `String.replace()` at a known file:line.

**Graceful fallback for the 10%:** SCSS variables, `calc()`, interpolations can't be replaced literally. These surface in the Copy output with a note: *"couldn't auto-save — variable or expression."*

### 1f. HMR auto-reset

After Save, HMR reloads styles. Inline overrides that are now redundant auto-clear:

```ts
if (module.hot) {
  module.hot.addStatusHandler((status) => {
    if (status === 'idle') {
      for (const [el, props] of overrides) {
        for (const [prop, { current }] of props) {
          (el as HTMLElement).style.removeProperty(prop);
          const real = getComputedStyle(el).getPropertyValue(prop);
          if (real === current || parseFloat(real) === parseFloat(current)) {
            props.delete(prop); // source caught up — done
          } else {
            (el as HTMLElement).style.setProperty(prop, current, 'important'); // restore — wasn't saved
          }
        }
        if (props.size === 0) overrides.delete(el);
      }
    }
  });
}
```

**The effect:** drag → save → HMR → overrides auto-clear → amber indicators disappear. Zero manual reset.

### 1g. Copy SCSS (fallback)

For changes that couldn't be auto-saved:

```scss
// Button.module.scss — .btn
.btn {
  font-size: 18px;      // was 16px — auto-saved ✓
  border-radius: 6px;   // was $radius-md (4px) — needs manual edit
}
```

Only un-saved lines need attention. Auto-saved lines are marked.

**End of Phase 1.** Click → DialKit panel → drag → save to file → HMR. No AI.

---

## Phase 2: Scope + Polish

### 2a. The scope toggle

Custom UI in our Header component (above DialKit's folders):

```
┌─────────────────────────┐
│  ⬤ element    ○ .btn   │
└─────────────────────────┘
```

**Element scope** (default): `onChange` applies inline styles to the clicked DOM node.

**Class scope**: `onChange` writes to a `<style>` tag in `document.head` targeting the CSS-modules classname. Every instance of `.btn` updates together:

```css
.Button_btn__a8f2k { font-size: 18px !important; }
```

If the element has multiple CSS-module classes, clicking the scope pill cycles through them.

### 2b. Variable detection

When you enter class scope, `scope.ts` checks if a property resolves from a variable.

**Approach 1 — Source map inspection:** fetch the source map, trace the value back to a `$variable` definition, show it as a third scope option.

**Approach 2 — CSS custom properties (free):** `getComputedStyle` can read `--var` values at runtime. Zero source map work.

**Approach 3 — Config file fallback:** manual mapping in `tuner.config.js`.

The scope pill with variable detection:

```
┌────────────────────────────────────────┐
│  ⬤ element   ○ .btn   ○ $font-sm      │
└────────────────────────────────────────┘
```

### 2c. Session persistence (free from DialKit)

DialKit has built-in JSON export/import. When you close the panel and reopen it, your last tuning session can be restored. When you share a `.tuner-session.json` with a teammate, they see exactly what you were tuning.

This was cut in v1/v2. Now it's free.

### 2d. "Suggest" (optional, lowest priority)

A button in the Footer: **✨ Suggest**

Sends element context to the Anthropic API via the dev server route (no CORS issues, no API key in client bundle). Returns additional DialKit config entries that get merged into the current config.

The tool works fully without an API key. This button catches edge cases: SVG, custom elements, complex pseudo-states that `infer.ts` doesn't know about.

---

## Keyboard map

| Key | Action |
|---|---|
| `` ` `` | Toggle selection mode |
| `Esc` | Cancel selection / close panel |
| `Tab` / `Shift+Tab` | Move between controls (DialKit handles this) |
| `↑` / `↓` | Increment/decrement focused slider (DialKit handles this) |
| `Shift + ↑/↓` | ±10 × step |
| `Cmd+Z` / `Ctrl+Z` | Undo last change |
| `Cmd+Shift+Z` | Redo |
| `S` | Cycle scope (element → class → variable) |
| `R` | Reset current element |
| `Cmd+S` | Save (direct commit to source files) |
| `Cmd+C` | Copy SCSS (when panel is focused) |

---

## What's deliberately cut

- **Custom slider component.** DialKit's is good. Don't rebuild it.
- **Custom section components.** DialKit folders replace them.
- **Box model diagram.** DialKit sliders in a Padding/Margin sub-folder for v1. Visual diagram is a polish pass.
- **Spring editor integration.** DialKit has spring editors, but we don't infer animation values from the DOM. Future: wire up Motion springs explicitly via `useDialKit`.
- **Presets.** YAGNI. DialKit's JSON export covers the same ground if you need it.
- **React fiber walking.** `__source` props exist in dev mode via SWC/Babel.
- **Multiple panels.** One person, one localhost.
- **Full SCSS parser.** String replacement at known file:line. Variables fall back to clipboard.

---

## Build order

1. **Shadow DOM shell + selector + DialKit integration** — get DialKit rendering inside the shadow root, verify controls work, wire `onChange` to `console.log`. The slider feel is DialKit's problem, not ours. (~1 day)
2. **`infer.ts`** — DOM → DialKit config for ~6 element types (button, heading, image, flex container, input, paragraph). Iterate on ranges. (~half day)
3. **`apply.ts` + `commit.ts` + HMR auto-reset** — wire onChange to inline styles, add the Save route, verify the full loop: drag → save → HMR → auto-clear. Phase 1 complete. (~1 day)
4. **Custom chrome (Header + Footer)** — element name, source file, Save/Copy/Reset buttons. (~half day)
5. **Undo stack** — Cmd+Z through the override history. (~2 hours)
6. **Scope toggle + class-mode injection** (~half day)
7. **Variable detection** — try source maps, timebox 1 day. CSS custom properties free. Config fallback. (~1 day)
8. **Suggest button** — Anthropic API via dev server. (~2 hours)

**Usable in ~3 days. Polished in ~5.**

---

## Dependencies

```json
{
  "dependencies": {
    "dialkit": "latest",
    "motion": "latest"
  },
  "peerDependencies": {
    "react": ">=18",
    "next": ">=13"
  }
}
```

DialKit requires Motion. Both are the only runtime dependencies. Everything else (source map parsing, file writing) runs on the server side with Node built-ins.
