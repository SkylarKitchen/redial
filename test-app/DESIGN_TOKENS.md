# Design Token System

The demo app uses a two-tier CSS custom property architecture: **primitives** (raw values) and **semantic tokens** (meaningful aliases). This keeps component styles readable, makes dark mode automatic, and ensures every color/spacing/type choice traces back to a single source of truth.

---

## How It Works

```
primitives.css          semantic.css             component CSS
─────────────          ────────────             ─────────────
--color-brand-500  ──▶  --interactive-default  ──▶  background-color: var(--interactive-default)
--color-neutral-200 ─▶  --border-default       ──▶  border: 1px solid var(--border-default)
--color-neutral-900 ─▶  --text-primary         ──▶  color: var(--text-primary)
```

**Primitives** describe *what* a value is (a shade of blue, a spacing step).
**Semantic tokens** describe *where/why* it's used (primary text, default border, interactive element).
**Components** only reference semantic tokens — never primitives directly.

Dark mode remaps the semantic layer to different primitives. Components don't change at all.

---

## File Structure

```
test-app/app/
├── tokens/
│   ├── primitives.css    ← Raw scales (colors, spacing, type, radii)
│   └── semantic.css      ← Meaningful aliases + dark mode remapping
├── globals.css           ← Imports both token files
└── page.module.scss      ← Component styles (semantic tokens only)
```

---

## Primitive Tokens

These are the raw building blocks. They never appear in component CSS.

### Color Scales

| Scale    | Range   | Usage                        |
|----------|---------|------------------------------|
| Brand    | 50–900  | Blue accent palette          |
| Neutral  | 50–900  | Grays for text, bg, borders  |
| Green    | 50–900  | Success states               |
| Amber    | 50–900  | Warning states               |
| Red      | 50–900  | Error/destructive states     |

Each scale follows a **50 = lightest, 900 = darkest** convention. Only the stops actually used are defined (no unnecessary stops).

### Spacing

| Token        | Value | Token        | Value |
|--------------|-------|--------------|-------|
| `--space-1`  | 4px   | `--space-8`  | 32px  |
| `--space-2`  | 8px   | `--space-10` | 40px  |
| `--space-3`  | 12px  | `--space-12` | 48px  |
| `--space-4`  | 16px  | `--space-16` | 64px  |
| `--space-5`  | 20px  | `--space-20` | 80px  |
| `--space-6`  | 24px  | `--space-24` | 96px  |

### Typography

| Category       | Tokens                                                    |
|----------------|-----------------------------------------------------------|
| Size           | `xs` (12) `sm` (14) `base` (16) `lg` (18) `xl` (20) `2xl` (24) `3xl` (30) `4xl` (36) `5xl` (48) |
| Weight         | `normal` (400) `medium` (500) `semibold` (600) `bold` (700) |
| Line Height    | `tight` (1.25) `normal` (1.5) `relaxed` (1.75) `loose` (2) |
| Letter Spacing | `tight` (-0.025em) `normal` (0) `wide` (0.025em) `wider` (0.05em) |

### Other

| Category        | Tokens                                              |
|-----------------|-----------------------------------------------------|
| Border Radius   | `sm` (4) `md` (6) `lg` (8) `xl` (12) `2xl` (16) `full` (9999) |
| Border Width    | `thin` (1) `medium` (2) `thick` (4)                |
| Container Width | `sm` (640) `md` (768) `lg` (1024) `xl` (1280)      |

---

## Semantic Tokens

These are the tokens components actually use. Organized by role.

### Text

| Token               | Light                | Dark                 | Use for                     |
|----------------------|----------------------|----------------------|-----------------------------|
| `--text-primary`     | neutral-900          | neutral-50           | Headings, body text         |
| `--text-secondary`   | neutral-500          | neutral-400          | Captions, labels            |
| `--text-tertiary`    | neutral-400          | neutral-500          | Hints, placeholders         |
| `--text-disabled`    | neutral-300          | neutral-600          | Disabled controls           |
| `--text-accent`      | brand-500            | brand-400            | Links, highlighted text     |
| `--text-on-accent`   | #ffffff              | #ffffff              | Text on brand-colored bg    |
| `--text-inverse`     | neutral-50           | neutral-900          | Text on dark/light surfaces |
| `--text-on-success`  | green-800            | #86efac              | Text on success bg          |
| `--text-on-warning`  | amber-800            | amber-300            | Text on warning bg          |
| `--text-on-error`    | red-800              | red-300              | Text on error bg            |

### Surfaces

| Token                      | Light         | Dark          | Use for                         |
|----------------------------|---------------|---------------|---------------------------------|
| `--surface-page`           | neutral-50    | neutral-900   | Page background                 |
| `--surface-primary`        | #ffffff       | neutral-800   | Cards, containers, inputs       |
| `--surface-inset`          | neutral-50    | neutral-800   | Cards inset within primary      |
| `--surface-muted`          | neutral-100   | neutral-700   | Tags, progress tracks           |
| `--surface-elevated`       | #ffffff       | neutral-700   | Elevated panels, dropdowns      |
| `--surface-inverse`        | neutral-900   | neutral-50    | Inverted sections               |
| `--surface-overlay`        | rgba(0,0,0,0.5) | rgba(0,0,0,0.5) | Modal backdrops            |
| `--surface-accent-subtle`  | brand-50      | brand-900     | Testimonials, accent highlights |
| `--surface-success-subtle` | green-100     | green-900     | Success alerts                  |
| `--surface-warning-subtle` | amber-100     | amber-900     | Warning alerts                  |
| `--surface-error-subtle`   | red-100       | red-900       | Error alerts                    |

### Borders

| Token              | Light        | Dark         | Use for              |
|--------------------|--------------|--------------|----------------------|
| `--border-default` | neutral-200  | neutral-700  | Cards, inputs, dividers |
| `--border-subtle`  | neutral-100  | neutral-800  | Light section dividers |
| `--border-strong`  | neutral-400  | neutral-500  | Emphasized borders   |
| `--border-accent`  | brand-500    | brand-400    | Focused/active borders |
| `--border-success` | green-500    | green-500    | Success alerts       |
| `--border-warning` | amber-500    | amber-500    | Warning alerts       |
| `--border-error`   | red-500      | red-500      | Error alerts         |

### Interactive

| Token                       | Light      | Dark       | Use for                       |
|-----------------------------|------------|------------|-------------------------------|
| `--interactive-default`     | brand-500  | brand-400  | Buttons, links, accents       |
| `--interactive-hover`       | brand-600  | brand-300  | Hover state                   |
| `--interactive-active`      | brand-700  | brand-200  | Pressed/active state          |
| `--interactive-subtle`      | brand-50   | brand-900  | Subtle badges, tag backgrounds |
| `--interactive-subtle-hover`| brand-100  | brand-800  | Subtle hover                  |
| `--interactive-light`       | brand-300  | brand-600  | Gradients, decorative accents |

### Status

| Token             | Value     | Use for           |
|-------------------|-----------|-------------------|
| `--status-success`| green-500 | Checkmarks, icons |
| `--status-warning`| amber-500 | Warning icons     |
| `--status-error`  | red-500   | Error icons       |
| `--status-info`   | brand-500 | Info icons        |

### Shadows

| Token         | Description            |
|---------------|------------------------|
| `--shadow-sm` | Subtle lift            |
| `--shadow-md` | Cards, containers      |
| `--shadow-lg` | Elevated panels, modals |

Shadows automatically deepen in dark mode for visibility.

---

## Usage Rules

1. **Components reference semantic tokens only** — never `var(--color-brand-500)` directly
2. **Primitives are the palette** — they exist only to be referenced by semantic tokens
3. **Dark mode lives in one place** — the `@media` block in `semantic.css`
4. **New tokens follow the pattern** — add primitives for raw values, add semantics for usage roles

### Example

```css
/* Correct */
.card {
  background: var(--surface-inset);
  border: var(--border-width-thin) solid var(--border-default);
  color: var(--text-primary);
}

/* Incorrect — references primitives directly */
.card {
  background: var(--color-neutral-50);
  border: 1px solid var(--color-neutral-200);
  color: var(--color-neutral-900);
}
```

---

## Token Counts

| Layer      | Count | File              |
|------------|-------|-------------------|
| Primitives | 106   | `tokens/primitives.css` |
| Semantic   | 35    | `tokens/semantic.css`   |
| **Total**  | **141** |                 |
