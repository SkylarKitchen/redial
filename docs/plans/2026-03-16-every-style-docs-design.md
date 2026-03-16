# Every.to-Style Docs Redesign

**Date:** 2026-03-16
**Goal:** Pivot docs from "technical manuscript" to "clean editorial" inspired by every.to's article pages — trust the typography, remove decoration.

## Reference

Every.to article pages: off-white bg, large serif body (~20px), bold normal-case headings, generous whitespace, no decoration. Centered reading column ~650px. Minimal nav.

## What Changes

### Typography
- **Headings**: Remove `text-transform: uppercase` and `letter-spacing` from all headings
- **Section headings (h2)**: 22px, bold (600), normal case, no border-bottom rule
- **Page titles (h1)**: 32px, bold (700), normal case, no border-bottom rule
- **Body text**: Keep 18-19px Cormorant Garamond (already good)
- **Nav links**: Normal case, 15px, no uppercase/tracking

### Decoration Removal
- **Paper grain**: Remove `::before` SVG noise pseudo-element from `.docsPage`
- **§ markers**: Remove from all h2 text in install and features pages (JSX)
- **Thin rules**: Remove `<hr className={styles.rule}>` from landing, install, features pages (JSX)
- **`.rule` class**: Remove from SCSS (no longer used)
- **`.sectionHeading` border-bottom**: Remove
- **`.pageTitle` border-bottom**: Remove
- **Feature card rule-tops**: Remove `border-top` from `.featureCard` and `.panelSectionCard`

### Nav
- Links: normal case, slightly larger, warmer weight
- Active state: bold only (already correct)
- Logo: keep italic Cormorant (that's nice)

### Feature Cards
- Remove `border-top: 1px solid` from `.featureCard`
- Card heading: normal case, bold, 17px (not uppercase tracked)
- Just typography creates the hierarchy

### Panel Section Cards (features page)
- Same treatment: remove border-top, normal-case headings

### Stats Row
- Keep vertical rules between stats (that works)
- Stat labels: normal case, smaller size (already fine)

### What Stays
- Cream background (`#f2ede5`)
- Cormorant Garamond throughout
- Warm color palette (`#2a2520`, `#3d372e`, `#5a5148`)
- No border-radius anywhere
- Code blocks with thin top/bottom rules (clean, works well)
- Sidebar with scroll-spy
- Page nav prev/next with thin border
- Footer with thin rule above
- Drop cap on landing hero subtitle

## Files to Modify

1. `test-app/app/docs.module.scss` — Remove grain, uppercase/tracking from headings, remove rule borders from cards/titles
2. `test-app/app/page.tsx` — Remove `<hr>` rule elements
3. `test-app/app/install/page.tsx` — Remove § from h2 text, remove `<hr>` rules
4. `test-app/app/features/page.tsx` — Remove § from h2 text, remove `<hr>` rules
