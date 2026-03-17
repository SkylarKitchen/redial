---
title: Showcase Full Panel Compositions — All Panels, Default Numeric State
type: feat
date: 2026-03-17
---

# Showcase Full Panel Compositions

Update Section C of `test-app/app/showcase/page.tsx` with accurate static mockups of **all 4 panel types** using theme.ts tokens — for Figma export via html.to.design.

## File

`test-app/app/showcase/page.tsx` — single file, all changes.

## Tasks

### 1. Fix Interactive Panel (existing)

- Size section: show numeric `W 200 px` / `H Auto –` values (no variable pills)
- Typography: add `Color` row with swatch + hex value (#171717)
- Backgrounds `Color` row: show swatch + hex text, not just swatch
- All labels use correct `labelStyle` with indicator dot support

### 2. Add Variables Panel (`data-component="VariablesPanel"`)

580px wide master-detail mockup:
- **Left sidebar** (170px): "Collections" header, 5 collection names (Border, Color, Container, Font, Spacing), Spacing has active bg (`primaryAlpha(0.08)`)
- **Right detail** (~410px): column headers "NAME" / "VALUE", "spacing" subgroup header, 4–5 variable rows with `VarTypeIcon` (↗ glyph) + name + value (e.g. `sm 8px`, `md 16px`, `lg 32px`, `xl 64px`)
- Panel shell: white bg, panelRadius, panel shadow

### 3. Add Navigator Panel (`data-component="NavigatorPanel"`)

300px wide DOM tree mockup:
- **Header**: "Navigator" label + "134 elements" count badge + collapse chevron
- **Tree**: 12–15 nodes at varying depths (0–3), expand arrows on parents
- Format: `tag.className` in 11px mono, INDENT_PX=16 per level
- One node selected: `primaryAlpha(0.08)` bg + `2px solid primary` left border
- Node data: `html` → `body` → `div.page` → `main.layout` → `section.hero` → etc.

### 4. Add Toolbar (`data-component="Toolbar"`)

Dark pill mockup (~220×48):
- `surface.darkToolbar` (#1e1e1e) background, pill radius 24
- 4 text buttons: **Select** (active — `darkToolbar.text` white), **Variables**, **AI**, **Changes** (idle — `darkToolbar.textMuted` 70% white)
- Active button has `darkToolbar.active` (18% white) background
- 12px font, `font.sans`

### 5. Cleanup

- Remove "Search Empty" variant (low Figma value)
- Replace "All Collapsed" with accurate collapsed panel (8 sections collapsed, proper header)
- Ensure all compositions have `data-component` attributes

## Token Reference

| Token | Value | Usage |
|-------|-------|-------|
| `color.background` | #FFFFFF | Panel bg |
| `layout.panelRadius` | 10px | Panel corners |
| `shadow.panel` | 0 8px 32px ... | Panel elevation |
| `layout.panelWidth` | 340px | Style/Nav panel width |
| `layout.rowPadding` | 2px 8px | Row padding |
| `layout.labelWidth` | 64px | Label column |
| `text.label` | #525252 | Label color |
| `surface.darkToolbar` | #1e1e1e | Toolbar bg |
| `darkToolbar.text` | white | Active button text |
| `darkToolbar.textMuted` | 70% white | Idle button text |
| `darkToolbar.active` | 18% white | Active button bg |
| `primaryAlpha(0.08)` | blue 8% | Selected row bg |
| `color.primary` | #3B82F6 | Selected border/text |

## Verification

1. `npm run build` — no TS errors
2. `http://localhost:3000/showcase` — scroll to Section C
3. All 4+ panels render with correct `data-component` attributes
4. Visual match against real panel components in demo page
