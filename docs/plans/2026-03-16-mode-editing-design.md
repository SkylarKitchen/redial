# Mode Editing — Design

> Date: 2026-03-16
> Status: Approved
> Depends on: modeDiscovery.ts (complete), CollectionDetail multi-mode columns (complete)

## Goal

Make multi-mode value cells in the Variables panel editable. Edits are runtime overrides via an injected `<style>` tag scoped to the mode's CSS selector. Save copies override CSS to clipboard. Variables can be added to existing mode blocks; new modes cannot be created.

## Override Mechanism

New module: `src/overlay/variables/modeOverrides.ts`

- **Store**: `Map<selector, Map<varName, value>>` — outer key is mode selector (`.dark-1`, `[data-theme="dark"]`), inner key is variable name (`--bg-primary`), value is the override string.
- **DOM**: Single `<style id="redial-mode-overrides">` element. On every mutation, rebuild contents — one rule block per selector, each containing its overridden custom properties.
- **Undo**: Integrate with `apply.ts` undo stack. Each mode edit is one undo entry that removes the override from the map and re-renders the style tag.
- **Reset**: "Reset all" clears the entire map and empties the style tag.

Example injected CSS:
```css
.dark-1 { --bg-primary: #1E1E1E; --border-error: #FF6B6B; }
.dark-2 { --bg-primary: #0D0D0D; }
```

## Editing UX

### Color variables
Click the color dot in a mode cell → opens `ColorPickerEnhanced` in a portal anchored to the cell. Picking a color writes the override. The dot updates to show the overridden color.

### All other types
Click the value text → inline text input. Enter commits, Escape cancels.

### Override indicator
Overridden cells get a blue dot (same `indicator="modified"` pattern) so users see what changed.

### Adding variables to modes
If a variable exists in Base but not in `.dark-1`, the dark-1 cell shows `—` (em-dash). Clicking `—` starts an edit. Committing adds that variable to the mode's override block.

## Save Action

Footer "Save" (or Cmd+S) serializes the override map into CSS text and copies to clipboard with a toast: "Mode overrides copied to clipboard". The CSS output matches the source file's selector structure so the user can paste directly into their stylesheet.

Future: upgrade to file-write when the commit pipeline supports stylesheet edits.

## Scope

**In scope:**
- Editing existing mode values
- Adding variables to existing modes
- Undo/redo integration
- Clipboard save
- Override indicators on edited cells
- Color picker for color-type variables
- Inline text input for non-color variables

**Out of scope:**
- Creating new modes
- Mode switching/preview (activate a mode on the page)
- File write-through
- Media query mode overrides (only class/data-attr modes editable in v1)

## Key Files

| File | Role |
|------|------|
| `variables/modeOverrides.ts` | **New.** Override store + `<style>` tag management |
| `variables/CollectionDetail.tsx` | Wire editable cells, color picker trigger, indicator |
| `variables/modeDiscovery.ts` | Existing. Provides mode metadata (selector, source type) |
| `controls/ColorPickerEnhanced.tsx` | Existing. Portal color picker |
| `core/apply.ts` | Existing. Undo stack integration |
| `shell/Footer.tsx` | Existing. Save action serializes mode overrides to clipboard |
