---
title: Showcase Full Panel Compositions — All Panels, Default Numeric State
type: feat
date: 2026-03-17
deepened: true
---

# Showcase Full Panel Compositions

Update Section C of `test-app/app/showcase/page.tsx` with accurate static mockups of **all 4 panel types** using theme.ts tokens — for Figma export via html.to.design.

## Enhancement Summary

**Deepened on:** 2026-03-17
**Research:** Pixel specs extracted from NavigatorPanel.tsx, Toolbar.tsx, GlobalVariablesPanel.tsx, CollectionDetail.tsx, CollectionSidebar.tsx, VarTypeIcon.tsx

### Key Improvements
1. Exact pixel specs from real components (not approximations)
2. Correct sidebar width (170px), button hit size (32px), row height (26px)
3. Accurate toolbar button labels: Select, Variables, AI, Changes

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
- **Left sidebar** (170px):
  - Header: `padding: "8px 8px 6px"`, `borderBottom: 1px border.subtle`
  - Header label: `fontSize: 11, fontWeight: 600, font.sans`
  - 5 collection items: Border, Color, Container, Font, Spacing
  - Items: `padding: "4px 8px"`, `borderRadius: 3`, `margin: "0 4px"`, `fontSize: 11, font.sans`
  - Selected (Spacing): `background: surface.hover`
  - Divider between manual/auto: `height: 1px, background: border.subtle, margin: "4px 8px"`
- **Right detail** (~410px):
  - Header: `padding: "10px 12px 6px"`, `borderBottom: 1px border.subtle`
  - Title: `fontSize: 13, fontWeight: 600, font.sans`
  - Column headers: `fontSize: 10, fontWeight: 500, text.hint, textTransform: uppercase, letterSpacing: 0.04em`
  - Single-mode layout: icon spacer 14px + name 120px + value flex:1 right-aligned + action spacer 38px
  - Subgroup header: `fontSize: 11, fontWeight: 600, font.sans, color: text.label, padding: "6px 12px 2px"`
  - Variable rows: `display: flex, gap: 6, padding: "8px 12px", minHeight: 26`
  - VarTypeIcon: `width: 14px, fontSize: 10, font.mono, color: text.hint` — length glyph: `↗`
  - Name: `fontSize: 11, font.mono, color: text.primary, width: 120px`
  - Value: `fontSize: 11, font.mono, flex: 1, textAlign: right`
  - Sample data: sm=8px, md=16px, lg=32px, xl=64px
- Panel shell: `color.background`, `layout.panelRadius`, `shadow.panel`

### 3. Add Navigator Panel (`data-component="NavigatorPanel"`)

300px wide DOM tree mockup:
- **Header** (36px):
  - Padding: `0 8px`, `borderBottom: 1px border.subtle`
  - Title: `fontSize: 12, fontWeight: 600, text.primary`
  - Count: `fontSize: 10, color: text.hint` — "134 elements"
  - Collapse button: 24×24px, `fontSize: 14, color: text.label, borderRadius: 4`
- **Tree rows** (ROW_HEIGHT=26px each):
  - `font.mono`, `fontSize: 11`, `cursor: pointer`
  - Indent: `paddingLeft: depth × 16 + 4`, `paddingRight: 8`
  - Expand chevron: `width: 16px, fontSize: 9, color: text.label` — "▶" rotated 90° when expanded
  - Tag: `color: text.secondary` (default) / `color.primary` (selected)
  - Class: `color: text.hint` (default) / `primaryAlpha(0.7)` (selected)
  - Dot separator between tag and class
  - Selected: `background: primaryAlpha(0.08)`, `borderLeft: 2px solid color.primary`
  - Unselected: `borderLeft: 2px solid transparent`
- **Node data** (realistic DOM tree):
  - depth 0: `html` (expanded)
  - depth 1: `body` (expanded)
  - depth 2: `div.page` (expanded)
  - depth 3: `main.layout` (expanded)
  - depth 4: `section.hero` (expanded, **selected**)
  - depth 5: `h1.title`
  - depth 5: `p.subtitle`
  - depth 5: `div.cta`
  - depth 4: `section.features` (collapsed)
  - depth 4: `section.pricing` (collapsed)
  - depth 4: `footer.footer` (collapsed)
  - depth 3: `aside.sidebar` (collapsed)
- Panel: `color.background`, `layout.panelRadius`, `shadow.panel`, `border: 1px solid blackAlpha(0.07)`

### 4. Add Toolbar (`data-component="Toolbar"`)

Dark pill mockup:
- **Container**: height 48px, `borderRadius: 24`, `background: surface.darkToolbar`, `padding: "0 8px"`
- **Border**: `1px solid darkToolbar.border`
- **Shadow**: `0 4px 20px ${blackAlpha(0.25)}, 0 0 0 0.5px ${bgAlpha(0.06)}`
- **Button gap**: 2px
- **ToolButton** (×4): `height: 32px (HIT_SIZE)`, `borderRadius: 6`, `padding: "0 10px"`, `fontSize: 12`, `font.sans`
  - **Select** (active): `fontWeight: 500, color: darkToolbar.text, background: darkToolbar.active`
  - **Variables** (idle): `fontWeight: 400, color: darkToolbar.textMuted, background: transparent`
  - **AI** (idle): same
  - **Changes** (idle): same

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
| `text.hint` | #757575 | Column headers, counts |
| `text.primary` | #171717 | Variable names, titles |
| `text.secondary` | #404040 | Navigator tag names |
| `surface.hover` | rgba(0,0,0,0.05) | Sidebar selected |
| `surface.darkToolbar` | #1e1e1e | Toolbar bg |
| `darkToolbar.text` | white | Active button text |
| `darkToolbar.textMuted` | 70% white | Idle button text |
| `darkToolbar.active` | 18% white | Active button bg |
| `darkToolbar.border` | 8% white | Toolbar pill border |
| `darkToolbar.hover` | 10% white | Button hover |
| `primaryAlpha(0.08)` | blue 8% | Selected row bg |
| `color.primary` | #3B82F6 | Selected border/text |
| `border.subtle` | rgba(0,0,0,0.06) | Section dividers |
| `font.sans` | Inter, system-ui | UI text |
| `font.mono` | ui-monospace, SF Mono | Values, tree nodes |

## Verification

1. `npm run build` — no TS errors
2. `http://localhost:3000/showcase` — scroll to Section C
3. All 4+ panels render with correct `data-component` attributes
4. Visual match against real panel components in demo page
