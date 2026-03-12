# Redial — Customer Workflow

> A floating Webflow-style CSS tuning panel for Next.js. Click any element, drag to tune, save to source.

---

## Customer Story

### Maya Chen — Senior Frontend Engineer @ a SaaS startup

| | |
|---|---|
| **Stack** | Next.js 15, Tailwind, TypeScript |
| **Focus** | Landing pages & marketing site |
| **Goal** | Ship pixel-perfect designs fast without a separate design tool roundtrip |
| **Frustration** | "I spend more time toggling between VS Code and Chrome than actually designing." |

### The Problem

- Visual CSS iteration is slow: edit code, save, wait for HMR, check browser, repeat
- DevTools can tweak styles but changes are lost on reload — no persistence
- Webflow/Figma give visual control but don't write to her actual codebase
- Design handoff gaps: Figma says 24px, the computed value is 22px — who's right?
- Context switching kills flow state — each round-trip costs 30–60 seconds

---

## Redial Workflow

```
Activate → Select Element → Inspect Styles → Tune Properties → Live Preview → Save to Source → HMR Sync
```

| Step | Action | Detail |
|------|--------|--------|
| 1. **Activate** | Press hotkey | Enters selection mode |
| 2. **Select Element** | Click any element | Targets it for editing |
| 3. **Inspect Styles** | Panel appears | Shows computed CSS organized by section |
| 4. **Tune Properties** | Drag sliders, pick colors | Toggle layout modes, adjust spacing |
| 5. **Live Preview** | Instant feedback | Changes apply via inline styles in real time |
| 6. **Save to Source** | Click save | Writes CSS changes to actual source files |
| 7. **HMR Sync** | Automatic | Next.js hot-reloads with the persisted changes |

---

## Before & After

### Without Redial (3.5 minutes per property)

| Time | Action |
|------|--------|
| 0:00 | Open VS Code, find the component file |
| 0:30 | Guess at a padding value: `p-6` maybe? |
| 0:45 | Save file, wait for HMR to rebuild |
| 1:10 | Switch to Chrome, check the result |
| 1:20 | Not quite right. Back to VS Code... |
| 1:40 | Try `p-8`, save, wait, check... |
| 2:15 | Open DevTools to see computed values |
| 2:45 | Tweak in DevTools — looks perfect! |
| 3:00 | Manually copy values back to source... |
| 3:30 | Finally saved. One property took 3.5 min. |

### With Redial (14 seconds)

| Time | Action |
|------|--------|
| 0:00 | Press hotkey, click the element |
| 0:03 | See all computed styles organized by section |
| 0:05 | Drag the padding slider — live preview updates instantly |
| 0:12 | Looks perfect. Click Save. |
| 0:14 | Source file updated, HMR confirms. Done. |

---

## Why It Matters

**Zero Context Switch** — Stay in the browser. No more toggling between editor, browser, and DevTools.

**Real Persistence** — Unlike DevTools, changes save directly to your source files. Nothing is lost on reload.

**Webflow-Grade UX** — Organized sections for Layout, Spacing, Size, Typography, Borders, Effects — like a visual design tool.

**Fits Your Stack** — Works with Next.js, React, and your existing build pipeline. Drop in as a dev dependency.

---

## Under the Hood

### Intelligence Layer
`infer.ts` reads `getComputedStyle()` from the selected element and generates a structured config of editable CSS properties.

### Rendering Layer
Context-aware sliders, color pickers, and segmented controls — built with DialKit + Radix — organized into collapsible Webflow-style sections.

### Persistence Layer
`apply.ts` writes inline styles for live preview. `commit.ts` writes to source files. Next.js HMR hot-reloads to confirm.

---

## Maya's Outcome

> "I tuned the entire hero section — padding, font sizes, colors, border radius — in under 5 minutes. It used to take me 30+ minutes of back-and-forth. Redial changed how I build."

| Metric | Value |
|--------|-------|
| **Faster iteration** | 15x on visual CSS |
| **Lost changes** | 0 (persists to source) |
| **Setup** | 1 line to install as a Next.js plugin |
