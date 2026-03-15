---
date: 2026-03-15
topic: ux-workflow
approach: B — Dev-Tool Hybrid
status: approved
---

# Redial UX Workflow Design

> Full end-to-end user workflow for Redial. Approach B: Dev-Tool Hybrid — fluid visual editing with pin toggle for normal app interaction.

## Target Users

- **Designer-developer hybrids** — comfortable in Figma/Webflow, want that same visual editing experience in their actual codebase
- **Developers on teams** — working on shared codebases, need changes to be reviewable and land in source files

## Core Principles

- Class scope by default (you're editing the style, not the instance)
- Save writes to source immediately (one click, no confirmation dialog)
- Click-to-select stays active while editing (Webflow-like fluidity)
- Pin toggle for when you need to interact with the actual page
- Three layers of change visibility: badge → dots → drawer

---

## Section 1: Installation & First Contact

1. `npm install redial`
2. Add `<Tuner />` to root layout (dev-only gated)
3. Dev server starts — **+ FAB visible bottom-right**
4. FAB is the only visible indicator that Redial is installed
5. First hover on FAB shows tooltip: "Inspect element"

## Section 2: Selection & Panel Open

1. **Click FAB** → enters selection mode immediately
   - Cursor changes to crosshair
   - Hovering any element shows indigo outline + tag.class + dimensions label
   - Backtick (`` ` ``) is the keyboard alternative to clicking the FAB

2. **Click element** → panel opens (right side, floating, 300px)
   - Panel animates in
   - Selected element gets a persistent outline
   - Breadcrumb shows ancestry: `body › section › div.hero › h2`
   - Scope defaults to class (if class detected), falls back to element

3. **Click-to-select stays active while panel is open**
   - Clicking any page element switches the panel to that element
   - Clicks are intercepted (links/buttons don't fire their default action)
   - Clicking inside the panel itself is ignored (normal panel interaction)
   - Right-click always passes through to browser native menu

4. **Pin toggle** in the header
   - **Unpinned** (default): clicks on page re-select elements
   - **Pinned**: clicks pass through to the page normally, panel stays locked
   - Small pin/lock icon in the header next to the close button
   - Keyboard shortcut: `P` to toggle pin
   - When pinned, panel still live-updates computed styles — locking selection, not observation

## Section 3: Editing & Live Preview

- 8 collapsible CSS sections render context-aware controls based on the selected element
- All edits apply instantly as inline styles (live preview)
- Changed properties show colored indicator dots:
  - **Blue** = class-scoped override
  - **Pink** = element-scoped override
  - **Orange** = inherited from parent/base class
  - **Green** = state-specific (editing while in :hover/:focus)
  - **No dot** = browser default
- Label scrubbing: drag a property label to adjust value. Shift for 10x, Alt for 0.1x
- Scope pills labeled with intent: **"All .hero-heading"** vs **"Just this"**
- Class scope is the default when a class is detected

## Section 4: Navigation

- **Arrow keys**: Up=parent, Down=first child, Left=prev sibling, Right=next sibling
- **Breadcrumb click**: jump to any ancestor
- **Navigator panel** (tree icon in toolbar): full DOM tree with search, keyboard nav, drag-to-reorder
- **Click on page**: switches panel to clicked element (unless pinned)

## Section 5: Change Tracking

Three layers of visibility, from glanceable to detailed:

1. **Badge count on Save button** — "Save (3)" always shows pending change count
2. **Indicator dots per-property** — colored dots next to each changed property in the panel
3. **Changes Drawer** — single drawer with two tabs:
   - **Pending tab**: all unsaved changes grouped by element → property → old/new value, per-change undo
   - **History tab**: chronological timeline of all changes with undo-to-point

## Section 6: Save & Persist

- **Save = one click**: writes all pending changes to source files via commit endpoint
- **Post-save toast**: "Saved 3 properties → components/Hero.tsx:42" — brief, auto-dismisses
- **No endpoint configured**: Save falls back to clipboard copy, toast says "Copied CSS to clipboard"
- **Session persistence**: unsaved changes survive in localStorage across page refreshes and HMR
- **Undo/Redo**: Cmd+Z / Cmd+Shift+Z, works across all changes in the session

## Section 7: Close & Unsaved Warning

- **Esc** or `` ` `` closes the panel
- If unsaved changes exist: lightweight inline warning — "3 unsaved changes — Discard?" with **Discard** / **Keep Editing** buttons
- If no unsaved changes: closes immediately, no friction
- Closing does NOT destroy the session — reopening and selecting the same element shows unsaved changes still applied

## Section 8: Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `` ` `` | Toggle selection mode / close panel |
| `Esc` | Close panel |
| `P` | Toggle pin |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+S` | Save |
| `Cmd+C` | Copy CSS |
| `Cmd+Alt+C` | Copy styles (internal clipboard) |
| `Cmd+Alt+V` | Paste styles |
| `Cmd+Shift+V` | Import CSS from clipboard |
| `D` (hold) | Diff peek — strip overrides while held |
| `S` | Cycle scope |
| `R` | Reset current element |
| `,` | Command palette |
| `?` | Shortcuts help |
| Arrow keys | Navigate DOM tree |
| `Tab` / `Shift+Tab` | Navigate controls within panel |

All shortcuts are disabled when a text input is focused.

## Section 9: Secondary Tools (Toolbar)

The FAB expands to a toolbar with secondary tools when the panel is open:

- **Crosshair** — re-enter selection mode (useful when pinned)
- **Tree** — toggle Navigator panel
- **Variables** — open Global Variables panel
- **AI** — open Prompt panel for natural-language editing
- **Changes** — open Changes Drawer

## Section 10: Hotkey Discoverability

Three layers, from passive to active:

1. **Tooltip hints on interactive elements**
   - Hovering any toolbar button or panel action shows its shortcut
   - Format: `Label (⌘S)` — tight and consistent
   - Examples: Save → "Save to source (⌘S)", Pin → "Pin element (P)"

2. **First-use contextual hint bar**
   - First time the panel opens, subtle bar at bottom: `Press ⌘S to save · ⌘Z to undo · ? for all shortcuts`
   - Auto-dismisses after 5 seconds or on any interaction
   - Never shows again (localStorage flag)

3. **Shortcuts reference modal**
   - Press `?` to open full shortcuts table
   - Also accessible via command palette (`,` → type "shortcuts")
   - Grouped by action: Selection, Editing, Navigation, Clipboard

---

## Summary: The 10-Step User Journey

```
 1. INSTALL      npm install redial → add <Tuner /> to layout
 2. DISCOVER     See + FAB in bottom-right corner
 3. ACTIVATE     Click FAB → enters selection mode (crosshair + outlines)
 4. SELECT       Click element → panel opens, scope defaults to class
 5. EDIT         Drag/scrub/pick — live preview, indicator dots show changes
 6. NAVIGATE     Click page elements, arrow keys, breadcrumb, Navigator
 7. REVIEW       Save badge (3), Changes Drawer for detailed review
 8. SAVE         One-click Save → writes to source, toast confirms
 9. ITERATE      Keep editing or select another element
10. CLOSE        Esc/` → warns if unsaved, session persists in localStorage
```
