# Workflow & Customer Story

## The Problem

CSS iteration is slow. Edit code, save, wait for HMR, check browser, repeat. DevTools lets you tweak but changes vanish on reload. Webflow/Figma give visual control but don't write to your codebase. Each round-trip costs 30-60 seconds and kills flow state.

---

## The Workflow

```
` hotkey → click element → panel opens → drag/tune → Cmd+S → saved to source → HMR reloads
```

| Step | What Happens |
|------|-------------|
| **Activate** | Press `` ` `` to enter selection mode |
| **Select** | Click any element to target it |
| **Inspect** | Panel shows computed CSS by section |
| **Tune** | Drag sliders, pick colors, toggle layout |
| **Preview** | Changes apply instantly (inline styles) |
| **Save** | Writes CSS changes to your actual source files |
| **HMR** | Next.js hot-reloads with persisted changes |

---

## Before & After

**Without Redial** — 3.5 min for one property:
Open VS Code → guess `p-6` → save → wait → check → wrong → try `p-8` → save → wait → check → open DevTools → tweak → copy values back to source → save.

**With Redial** — 14 seconds:
Press hotkey → click element → drag padding slider → looks right → Save. Done.

---

## Why It Matters

- **Zero context switch** — stay in the browser
- **Real persistence** — saves to source files, not lost on reload
- **Webflow-grade UX** — Layout, Spacing, Size, Typography, Borders, Effects sections
- **Fits your stack** — drop-in Next.js dev dependency

---

## Under the Hood

| Layer | What |
|-------|------|
| `infer.ts` | `getComputedStyle()` → structured config of editable properties |
| `WebflowPanel.tsx` | DialKit + Radix controls in collapsible sections |
| `apply.ts` → `commit.ts` | Inline styles for preview → surgical file writes → HMR |
