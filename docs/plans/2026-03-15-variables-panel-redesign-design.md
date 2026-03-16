# Variables Panel Redesign — Webflow-Style Master-Detail

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Layout redesign + collections + type icons + reference pills. Multi-mode columns deferred.

## Goal

Replace the current single-list GlobalVariablesPanel with a Webflow-style two-pane variables workspace: collection sidebar on the left, variable table on the right.

## Architecture

### Layout

- **Master-detail split**: ~170px sidebar + ~380px content area = ~550px total
- Panel width bumps to 550px when variables view is active, snaps back to 300px on exit
- Sidebar is collapsible via `<|` toggle (persisted to localStorage); collapsed = content gets full width

### Collection Sidebar (left pane)

- "Variables" header with `+` (create collection) and `<|` (collapse) buttons
- Flat list of collection names — user-defined collections first, then auto-collections
- Selected collection is highlighted
- Hover shows `...` context menu (rename, delete)
- Drag to reorder collections (reuse `useDragReorder`)
- No sidebar icons for collections (deferred)

### Variable Table (right pane)

- Header row: collection name as title, columns "Name" | "Base mode" (value)
- Variables organized into auto-derived subgroups based on name prefixes within the collection
- Each subgroup: bold header + variable rows + `+ New variable` button
- `+ New variable` pre-fills the subgroup prefix (e.g. clicking in "font" group → `--font-`)

### Variable Rows

- **Type icon**: `#` (number), `↗` (dimension), `●` (color swatch), `Ā` (font-family)
  - Mapped from existing `VarType` in `discoverVariables.ts`
- **Name**: variable display name (prefix stripped per subgroup context)
- **Value**: either:
  - **Reference pill** — colored badge showing the referenced variable name (for alias values like `var(--gray-050)`)
  - **Literal text** — plain text for direct values (`#b53333`, `0.25rem`, `clamp(...)`)
  - Detection uses existing `parseVarAlias` / `buildAliasGraph`
- Right-click context menu with "Move to collection..." submenu

### Collection CRUD

- **Create**: `+` in sidebar → inline text input
- **Rename**: via `...` context menu
- **Delete**: via `...` context menu (variables return to auto-collections pool)
- **Reorder**: drag in sidebar
- All backed by existing `tokenCollections.ts` store (add, remove, rename, assignVariable, etc.)

### Variable Assignment

- Context menu on variable row → "Move to collection..." → list of collections
- Auto-collections act as "unassigned" pool
- Moving a variable into a manual collection removes it from auto-grouping (existing `manuallyAssigned` set)

### Subgroups

- Pure auto-grouping from variable name prefixes within the collection context
- e.g. `--font-primary-family`, `--font-primary-medium` → "font" subgroup
- No manual subgroup creation (deferred)

## Data Model Changes

Minimal — the existing stores cover most needs:
- `tokenCollections.ts` — already has full CRUD for collections + assignment
- `autoCollections.ts` — already infers groups from prefixes
- `discoverVariables.ts` — already has `VarType`, `parseVarAlias`, `buildAliasGraph`

New state needed:
- Sidebar collapsed/expanded (localStorage boolean)
- Selected collection ID (component state)
- Panel width override when in variables view (pass to Overlay.tsx)

## File Impact

| File | Change |
|------|--------|
| `variables/GlobalVariablesPanel.tsx` | **Major rewrite** — new master-detail layout |
| `shell/Overlay.tsx` | Width logic — 550px when variables open, 300px otherwise |
| `variables/autoCollections.ts` | Minor — expose subgroup logic for within-collection grouping |
| `variables/tokenCollections.ts` | No changes needed |
| `variables/discoverVariables.ts` | No changes needed |
| `controls/VariablePicker.tsx` | No changes needed |

## Deferred to Future Session

- **Multi-mode columns** (Base mode + theme variants side-by-side) — needs its own design doc
- **Collection sidebar icons** (auto-derived type icons per collection)
- **Select/bulk mode** (`✓ Select` toggle for multi-variable operations)
- **Manual subgroups** (user-created groups within collections)
