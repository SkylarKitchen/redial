# Redial — How It Works & Why It's Useful

## What Is Redial?

Redial is a floating CSS tuning panel that overlays on top of any Next.js app during development. Think of it like Webflow's style inspector, but for your actual codebase. You click an element, get context-aware sliders and pickers for its CSS properties, drag to adjust, and hit Save — and your source files update on disk, live.

No copying hex codes. No switching tabs to find the right `.module.scss` file. No guessing which line to edit.

Nothing else in the ecosystem fills this gap. DevTools changes evaporate on reload. Libraries like DialKit provide drag-to-tune primitives but don't form a complete workflow — they don't infer which properties matter, and they don't write back to source. AI-assisted coding introduces minutes of latency per visual tweak where a slider would take seconds. Redial is the layer that connects direct manipulation to your actual code.

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
- **CSS Modules focus** — Save writes to CSS Modules (`.module.css`, `.module.scss`). For Tailwind projects, use Copy as Tailwind to export changes. Global stylesheets without module patterns may not resolve correctly (changes will show as "failed" rather than writing to the wrong place)
- **No destructive failures** — If Redial can't confidently locate the right line in the right file, it reports the failure explicitly. It won't silently write to an incorrect location.

---

## Persona: The Design-Developer

**Name:** Alex — a full-stack developer building a Next.js product

**Context:** Alex uses Claude Code as their primary development tool. They're comfortable with code, but when it comes to visual polish — spacing, typography, colors, layout tweaks — the feedback loop through Claude is painful. They describe what they want ("make the padding a bit bigger", "try a darker background"), Claude thinks for 5-10 seconds, edits the file, HMR reloads, and... it's not quite right. Repeat. Each micro-adjustment costs a full LLM round-trip.

Alex isn't a "designer who codes." They're a **developer who designs in-situ** — they know what looks right when they see it, but they don't always know the exact values ahead of time. They need to **feel their way** to the right answer through rapid visual feedback.

**Frustrations today:**
- Describing visual intent in words to Claude is lossy ("a little more breathing room" → how many px?)
- Each tweak is a full AI inference cycle: prompt → think → edit → HMR → evaluate
- Comparing variations means either branching, undo-redo through Claude, or manually stashing diffs
- When they're in "visual tuning mode," Claude's strengths (reasoning, architecture) are wasted — they just need a slider

**What Alex wants:**
- Manipulate live CSS properties with their hands, see results instantly
- Try 3-4 variations of spacing/color/layout, compare them, pick one
- When satisfied, press Save and have the actual source file updated — no copy-paste, no re-prompting Claude
- Get back to Claude for the hard stuff (logic, architecture, new features) while handling visual polish themselves

---

## UX Flow

### Phase 1: Enter — Select What to Tune

The developer is viewing their running Next.js app in the browser. They notice a section that needs visual work.

```
Press ` (backtick) → Redial activates selection mode
Hover over elements → elements highlight with a blue outline
Click the element  → Redial panel slides in
```

The backtick hotkey mirrors Webflow's keyboard-first philosophy and sits right next to Escape. The selection mode uses the `Selector.tsx` component, which inspects the DOM and builds a breadcrumb of the element's ancestry. This is when `infer.ts` does its work: reading `getComputedStyle()` to auto-populate every control with the element's current values.

**What they see in the panel header:**
- **Breadcrumb:** `body › main › section.hero › h1` (clickable — tap any ancestor to switch context)
- **Scope pills:** `element` vs `.hero-heading` (are you editing this one instance or the class?)
- **Source file:** `components/Hero.tsx:42` (clickable — opens in editor)

### Phase 2: Explore — Rapid Visual Experimentation

This is where the value lives. The developer drags sliders, picks colors, toggles layout options — and **sees results on the actual page in real-time** with zero latency.

```
Scenario: "This hero section needs work"

1. Open Typography section
   - Drag font-size slider from 48px → 56px (live update on page)
   - Shift+drag the "Weight" label to scrub from 600 → 700
   - Click the color swatch → pick a warmer tone → page updates instantly

2. Open Spacing section
   - Click the padding-top value in the box model → type "64" → Enter
   - Alt+click padding-top to apply 64px to padding-bottom too

3. Open Layout section
   - Toggle from justify-content: start → center using the 3×3 alignment grid
   - Bump gap from 16px → 24px with the slider

Each interaction is ≈0ms latency. No AI involved. Just DOM manipulation.
```

Underneath, `apply.ts` applies changes as inline styles on the DOM element (instant visual feedback), while maintaining an undo stack. The page never actually re-renders through React — it's raw `element.style` manipulation. This is why it feels instant compared to a code-edit → HMR → React-reconcile cycle.

### Phase 3: Compare — Evaluate Variations

This is the "designer brain" moment. The developer wants to see what changed and decide if it's better.

```
Hold D       → "Diff peek" strips all overrides temporarily
               → they see the original design alongside their changes
Release D    → overrides come back

Cmd+Z / Cmd+Shift+Z → step through undo/redo history
                     → each state renders live on the page

Footer shows: "12 overrides · Cmd+Z to undo"
Click "Diff" → see the CSS diff of everything changed
```

Even without explicit snapshots, the undo stack and diff peek give surprising exploratory power. A future "snapshots" feature could let users save named variations to flip between.

### Phase 4: Commit — Real Source Updates

The developer is happy with the result.

```
Press Cmd+S (or click Save in footer)

→ commit.ts writes the changes to the actual source file
→ If element scope: inline style or CSS module update
→ If class scope: the class definition in the CSS module file is updated
→ HMR picks up the change → page re-renders from real code
→ The changes ARE the code now — not floating overrides
```

This is what differentiates Redial from browser DevTools. In Chrome DevTools, CSS tweaks are lost on refresh. In Redial, the persistence layer (`commit.ts`) traces the element back to its source file via the React fiber tree and source maps, then writes the actual CSS property changes. The HMR integration means the page seamlessly transitions from "inline style overrides" to "real code" without a visible flash.

### Phase 5: Return to Claude — For the Hard Stuff

```
Developer closes Redial (Esc or backtick)
Opens Claude Code terminal
"Now add a fade-in animation to the hero section when it scrolls into view"

Claude handles the logic. Redial handled the visual polish.
They're complementary tools, not competing ones.
```

---

## The Value Proposition

**Claude Code is for *what to build*. Redial is for *how it looks*.**

When you're deciding font sizes, spacing, colors, and layout — tasks where the answer is "I'll know it when I see it" — a slider that updates in 0ms beats a prompt that takes 5 seconds. Redial removes visual tuning from the AI loop, keeps it in the developer's hands, and writes the results back as real code.

### Key UX Principles

1. **Zero-latency feedback** — Every interaction updates the page within the same frame. If there's lag, the tool fails at its core promise.
2. **Real code output** — Save doesn't generate CSS for you to copy. It writes to your actual files. The panel is a visual editor for your codebase.
3. **Keyboard-first** — Backtick to enter, Escape to exit, D to diff, Cmd+S to save. The developer never leaves the keyboard.
4. **Non-destructive exploration** — Everything is undo-able. Hold D to peek at the original. The developer should feel fearless about experimenting.
5. **Complement, don't replace** — Redial handles the visual-spatial tasks that LLMs are bad at (precise visual judgment). Claude handles everything else. The two tools make each other better.
