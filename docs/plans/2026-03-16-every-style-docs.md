# Every.to-Style Docs Simplification

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strip manuscript decorations from docs site, leaving clean editorial serif typography inspired by every.to.

**Architecture:** SCSS edits (remove uppercase/tracking/grain/card-borders) + JSX edits (remove § markers and `<hr>` rules). No structural changes. All 3 pages affected.

**Tech Stack:** SCSS Modules, Next.js, Cormorant Garamond

---

### Task 1: SCSS — remove grain + simplify headings

**Files:**
- Modify: `test-app/app/docs.module.scss`

**Step 1: Remove paper grain pseudo-element**

Delete the entire `&::before` block (lines ~32-43) from `.docsPage`.

**Step 2: Remove uppercase/tracking from `tracked-heading` mixin**

Replace:
```scss
@mixin tracked-heading {
  font-family: var(--font-cormorant);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
}
```
With:
```scss
@mixin tracked-heading {
  font-family: var(--font-cormorant);
  font-weight: 600;
}
```

**Step 3: Increase heading sizes**

- `.sectionHeading` font-size: `16px` → `22px`. Remove `border-bottom` and `padding-bottom`.
- `.pageTitle` font-size: `28px` → `32px`. Remove `border-bottom` and `padding-bottom`.
- `.contentSection h2` font-size: `16px` → `22px`
- `.featureSection h2` font-size: `16px` → `22px`

**Step 4: Remove uppercase/tracking from nav links**

In `.navLinks a` and `.navLinksRight a`: remove `text-transform: uppercase` and `letter-spacing: 0.15em`. Change `font-size: 13px` → `font-size: 15px`.

**Step 5: Remove card border-tops**

- `.featureCard`: remove `border-top: 1px solid #c4b9a8`
- `.featureCard h3`: remove the mixin usage, set `font-size: 17px; font-weight: 600;` (normal case)
- `.panelSectionCard`: remove `border-top: 1px solid #c4b9a8`
- `.panelSectionCard h4`: remove the mixin usage, set `font-size: 14px; font-weight: 600;` (normal case)
- `.statLabel`: remove `text-transform: uppercase` and `letter-spacing: 0.12em`

**Step 6: Remove `.rule` class**

Delete the entire `.rule { ... }` block.

**Step 7: Remove uppercase from sidebar section headers**

In `.sidebarSection h4`: remove `text-transform: uppercase` and `letter-spacing: 0.15em`. Change `font-size: 11px` → `font-size: 13px`.

**Step 8: Verify**

Run: `npm run typecheck`
Expected: Clean pass

**Step 9: Commit**

```
git commit -m "style: every.to editorial simplification — remove manuscript decorations"
```

---

### Task 2: JSX — remove § markers and hr rules

**Files:**
- Modify: `test-app/app/page.tsx`
- Modify: `test-app/app/install/page.tsx`
- Modify: `test-app/app/features/page.tsx`

**Step 1: Landing page — remove hr rules**

In `page.tsx`, delete both `<hr className={styles.rule} />` elements (before "How it works" and "Feature highlights").

**Step 2: Install page — remove § markers and hr rules**

In `install/page.tsx`:
- `§1 Install` → `Install`
- `§2 Next.js Plugin` → `Next.js Plugin`
- `§3 API Route` → `API Route`
- `§4 Component` → `Component`
- `§5 Configuration` → `Configuration`
- `§6 Exports` → `Exports`
- `§7 Requirements` → `Requirements`
- Delete all 6 `<hr className={styles.rule} />` elements

**Step 3: Features page — remove § markers and hr rules**

In `features/page.tsx`:
- `§1 Panel Sections` → `Panel Sections`
- `§2 CSS Variables` → `CSS Variables`
- `§3 Scoping` → `Scoping`
- `§4 State Editing` → `State Editing`
- `§5 Undo / Redo` → `Undo / Redo`
- `§6 Session Persistence` → `Session Persistence`
- `§7 Visual Overlays` → `Visual Overlays`
- `§8 Commit Flow` → `Commit Flow`
- `§9 Copy / Export` → `Copy / Export`
- `§10 Keyboard Shortcuts` → `Keyboard Shortcuts`
- `§11 Label-Drag Scrubbing` → `Label-Drag Scrubbing`
- Delete all 10 `<hr className={styles.rule} />` elements

**Step 4: Verify**

Run: `npm run typecheck`
Expected: Clean pass

**Step 5: Commit**

```
git commit -m "content: remove § markers and hr rules from docs pages"
```

---

### Task 3: Visual verification

**Step 1: Check all 3 pages in Chrome**

- `http://localhost:3000` — normal-case headings, no grain, no hr rules, drop cap still works
- `http://localhost:3000/install` — no § in headings, no hr rules, sidebar still works
- `http://localhost:3000/features` — same treatment, panel section cards have no border-top

**Step 2: Fix any spacing issues**

Removing borders and rules may leave awkward gaps. Adjust margins if needed.

**Step 3: Final typecheck**

Run: `npm run typecheck`

**Step 4: Commit**

```
git commit -m "polish: visual fixes after editorial simplification"
```

---

## Verification

1. `npm run typecheck` — clean
2. All 3 pages render with clean editorial serif (no uppercase headings, no §, no grain)
3. Sidebar scroll-spy still works
4. Drop cap still renders on landing page
5. Code blocks still have thin top/bottom rules (kept)
6. No horizontal overflow
