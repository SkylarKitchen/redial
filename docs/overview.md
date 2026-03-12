# Redial

A floating Webflow-style CSS tuning panel for Next.js.
Click any element, drag to tune, save to source files via HMR.

```tsx
import { Tuner } from "redial";

// Add to your root layout (dev only)
{process.env.NODE_ENV === "development" && <Tuner />}
```

---

## How It Works

```
` (hotkey)  →  click element  →  panel opens  →  drag sliders  →  Cmd+S saves to source  →  HMR reloads
```

Three layers:

| Layer | File | Job |
|-------|------|-----|
| **Intelligence** | `infer.ts` | `getComputedStyle()` → DialKit config |
| **Rendering** | `WebflowPanel.tsx` | 8 collapsible CSS sections (Layout, Spacing, Size, Position, Typography, Backgrounds, Borders, Effects) |
| **Persistence** | `apply.ts` → `commit.ts` | Inline styles + undo stack → surgical source file writes → HMR |

---

## Project Structure

| Path | What |
|------|------|
| `src/overlay/` | Core — panel UI, inference engine, 90+ files |
| `src/server/` | Commit endpoint (writes changes to source files) |
| `src/components/ui/` | Radix primitives |
| `test-app/` | Dev app — `/demo` (interactive) and `/showcase` (Figma export) |

---

## Tech Stack

DialKit (controls) + Motion (animation) + Radix UI (primitives) + Lucide (icons)
Built with tsup, tested with Vitest + happy-dom. Peer dep: Next.js ≥13.

---

## Commands

```bash
npm run dev        # watch mode
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm test           # vitest
```

---

## Further Reading

- [Workflow & Customer Story](workflow.md)
- [How Redial Works](how-redial-works.md)
- [Save Pipeline](save-pipeline.md)
- [Webflow Panel Spec](../webflow-style-panel-spec.md) — 13-section UI spec
