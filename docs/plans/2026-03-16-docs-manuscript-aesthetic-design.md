# Docs Manuscript Aesthetic — Design

**Date:** 2026-03-16
**Inspiration:** Technical manuscript / "code as sacred text" — ornate serif typography, paper textures, thin rules, drop caps, section markers

## Decisions

| Question | Answer |
|----------|--------|
| Navigation style | Full manuscript — nav and sidebar transform to match |
| Code blocks | Paper-and-rules — same warm bg, thin horizontal rules top/bottom, monospace |
| Drop caps | Landing page only — install/features lead with headings, not prose |
| Background texture | Subtle CSS grain (~3-5% opacity SVG noise on warm parchment) |
| Section dividers | Thin rules only — austere, lets typography carry the weight |

## Typography

- **Body**: Cormorant Garamond, ~18-20px, line-height ~1.7
- **Headings**: Cormorant Garamond, spaced uppercase tracking. Section numbers (§1, §2) prefix headings.
- **Code**: Geist Mono on paper bg. Thin 1px rules top/bottom. No dark background.
- **Nav links**: Cormorant Garamond, spaced small-caps or uppercase
- **Drop cap**: Landing page first paragraph. Cormorant Garamond ~4.5em, floated left, 3 lines

## Background

- Base: `#ede8df` (warm parchment)
- CSS noise overlay via SVG filter on `::before` pseudo, ~3-5% opacity
- Nav: same paper color + slight transparency + backdrop blur

## Layout

- **Nav**: Serif wordmark, spaced serif links, thin rule bottom border
- **Sidebar**: Serif type, no colored backgrounds. Active link: bold weight or `›` prefix. Section labels uppercase serif.
- **Content**: ~680px max-width for serif readability. Generous vertical spacing.
- **Code blocks**: Paper bg, thin rules top/bottom, generous padding, no border-radius
- **Tables**: Thin rules only, no hover highlights, no rounded cells
- **Page nav**: Thin rule borders, no rounded corners, serif arrows
- **Footer**: Thin rule above, centered small serif, minimal

## Files Changed

- `docs.module.scss` — complete restyle (biggest change)
- `DocsNav.tsx` — serif nav styling
- `page.tsx` — drop cap class, section flow adjustments
- `install/page.tsx` — § section numbers on headings
- `features/page.tsx` — § section numbers on headings

## What Stays

- All routes (/, /install, /features)
- DocsSidebar scroll-spy logic
- PageNav component structure
- DocsNav component structure
- All content/copy
