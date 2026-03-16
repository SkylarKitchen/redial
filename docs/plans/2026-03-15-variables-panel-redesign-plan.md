# Variables Panel Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-list GlobalVariablesPanel with a Webflow-style master-detail variables workspace — collection sidebar on the left, variable table on the right.

**Architecture:** The existing `GlobalVariablesPanel.tsx` (1505 lines) gets rewritten as a shell with two child components: `CollectionSidebar` and `CollectionDetail`. The data layer (`tokenCollections.ts`, `autoCollections.ts`, `discoverVariables.ts`) stays intact — only minor extensions needed. `Overlay.tsx` gets a width override when the variables panel is active.

**Tech Stack:** React (inline styles), useSyncExternalStore, Motion (AnimatePresence), Vitest

**Design doc:** `docs/plans/2026-03-15-variables-panel-redesign-design.md`

---

### Task 1: Add `inferSubgroups` to autoCollections.ts

Webflow auto-derives subgroups within a collection from variable name prefixes. We need a pure function that takes a list of variables and returns subgroups.

**Files:**
- Modify: `src/overlay/variables/autoCollections.ts`
- Test: `src/overlay/__tests__/autoCollections.test.ts`

**Step 1: Write the failing test**

Add to `autoCollections.test.ts`:

```ts
import { inferAutoCollections, inferSubgroups } from "../variables/autoCollections";

// ... existing tests ...

// ─── inferSubgroups ───────────────────────────────────────────────────

describe("inferSubgroups", () => {
  it("groups by first segment after --", () => {
    const vars = [
      makeVar("--font-primary-family", "string"),
      makeVar("--font-primary-medium", "number"),
      makeVar("--font-mono", "string"),
      makeVar("--letter-spacing-sm", "length"),
      makeVar("--letter-spacing-lg", "length"),
    ];
    const result = inferSubgroups(vars);
    expect(result).toHaveLength(2);
    expect(result.find((g) => g.name === "font")).toBeDefined();
    expect(result.find((g) => g.name === "letter-spacing")).toBeDefined();
    expect(result.find((g) => g.name === "font")!.variables).toHaveLength(3);
    expect(result.find((g) => g.name === "letter-spacing")!.variables).toHaveLength(2);
  });

  it("uses multi-segment prefix when shared", () => {
    const vars = [
      makeVar("--border-width-thin", "length"),
      makeVar("--border-width-medium", "length"),
      makeVar("--border-width-thick", "length"),
      makeVar("--border-color-default", "color"),
      makeVar("--border-color-accent", "color"),
    ];
    const result = inferSubgroups(vars);
    expect(result.find((g) => g.name === "border-width")).toBeDefined();
    expect(result.find((g) => g.name === "border-color")).toBeDefined();
  });

  it("single-segment vars go into unnamed group", () => {
    const vars = [
      makeVar("--background", "color"),
      makeVar("--foreground", "color"),
    ];
    const result = inferSubgroups(vars);
    // Single-segment vars can't be subgrouped — return one unnamed group
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("");
    expect(result[0].variables).toHaveLength(2);
  });

  it("empty input returns empty", () => {
    expect(inferSubgroups([])).toEqual([]);
  });

  it("returns display name with -- stripped from variables", () => {
    const vars = [
      makeVar("--space-sm", "length"),
      makeVar("--space-md", "length"),
    ];
    const result = inferSubgroups(vars);
    const spaceGroup = result.find((g) => g.name === "space")!;
    // Variables still have full names
    expect(spaceGroup.variables[0].name).toBe("--space-md");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run autoCollections`
Expected: FAIL — `inferSubgroups` is not exported

**Step 3: Write minimal implementation**

Add to the bottom of `autoCollections.ts`:

```ts
// ─── Within-Collection Subgroups ──────────────────────────────────

export interface Subgroup {
  name: string; // "" for ungrouped single-segment vars
  variables: CSSVariable[];
}

/**
 * Given a flat list of variables (all belonging to one collection),
 * group them by their first dash-separated prefix segment(s).
 *
 * e.g. --font-primary-family, --font-mono → "font" subgroup
 *      --letter-spacing-sm → "letter-spacing" subgroup
 *
 * Detects multi-segment prefixes when all variables under a first
 * segment share a common second segment (e.g. border-width-*, border-color-*).
 */
export function inferSubgroups(vars: CSSVariable[]): Subgroup[] {
  if (vars.length === 0) return [];

  // Group by first segment
  const byFirst = new Map<string, CSSVariable[]>();
  const ungrouped: CSSVariable[] = [];

  for (const v of vars) {
    const segs = v.name.slice(2).split("-"); // strip "--"
    if (segs.length === 1) {
      ungrouped.push(v);
    } else {
      const first = segs[0];
      if (!byFirst.has(first)) byFirst.set(first, []);
      byFirst.get(first)!.push(v);
    }
  }

  const result: Subgroup[] = [];

  for (const [first, groupVars] of byFirst) {
    // Check if this group should split into multi-segment subgroups
    // e.g. border-width-*, border-color-* → "border-width", "border-color"
    const bySecond = new Map<string, CSSVariable[]>();
    let allHaveThirdSeg = true;

    for (const v of groupVars) {
      const segs = v.name.slice(2).split("-");
      if (segs.length >= 3) {
        const key = `${segs[0]}-${segs[1]}`;
        if (!bySecond.has(key)) bySecond.set(key, []);
        bySecond.get(key)!.push(v);
      } else {
        allHaveThirdSeg = false;
      }
    }

    // Split into multi-segment subgroups if ALL vars have 3+ segments
    // AND there are multiple distinct second segments
    if (allHaveThirdSeg && bySecond.size > 1) {
      for (const [prefix, subVars] of bySecond) {
        result.push({
          name: prefix,
          variables: subVars.sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
    } else {
      result.push({
        name: first,
        variables: groupVars.sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
  }

  // Add ungrouped vars
  if (ungrouped.length > 0) {
    result.unshift({
      name: "",
      variables: ungrouped.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run autoCollections`
Expected: PASS

**Step 5: Commit**

```bash
git add src/overlay/variables/autoCollections.ts src/overlay/__tests__/autoCollections.test.ts
git commit -m "feat(variables): add inferSubgroups for within-collection grouping"
```

---

### Task 2: Add VarTypeIcon component

Type-aware icons for each variable row: `#` (number), `↗` (dimension), `●` (color), `Ā` (font-family).

**Files:**
- Create: `src/overlay/variables/VarTypeIcon.tsx`
- Test: `src/overlay/__tests__/varTypeIcon.test.ts`

**Step 1: Write the failing test**

Create `src/overlay/__tests__/varTypeIcon.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { getVarTypeIcon } from "../variables/VarTypeIcon";

describe("getVarTypeIcon", () => {
  it("returns # for number type", () => {
    expect(getVarTypeIcon("number")).toBe("#");
  });

  it("returns ↗ for length type", () => {
    expect(getVarTypeIcon("length")).toBe("↗");
  });

  it("returns ● for color type", () => {
    expect(getVarTypeIcon("color")).toBe("●");
  });

  it("returns Ā for string type (font-family heuristic)", () => {
    expect(getVarTypeIcon("string", "--font-primary-family")).toBe("Ā");
  });

  it("returns Ā for string type with font in name", () => {
    expect(getVarTypeIcon("string", "--heading-font")).toBe("Ā");
  });

  it("returns ↗ for generic string type", () => {
    expect(getVarTypeIcon("string")).toBe("↗");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run varTypeIcon`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/overlay/variables/VarTypeIcon.tsx`:

```tsx
import React from "react";
import type { VarType } from "./discoverVariables";
import { text, font } from "../theme";

const FONT_RE = /font/i;

/** Pure logic — returns the character for a VarType. Exported for testing. */
export function getVarTypeIcon(type: VarType, varName?: string): string {
  switch (type) {
    case "color":
      return "●";
    case "number":
      return "#";
    case "length":
      return "↗";
    case "string":
      return (varName && FONT_RE.test(varName)) ? "Ā" : "↗";
  }
}

/** React component rendering the type icon inline. */
export function VarTypeIcon({
  type,
  varName,
  colorValue,
}: {
  type: VarType;
  varName?: string;
  colorValue?: string;
}) {
  const icon = getVarTypeIcon(type, varName);

  if (type === "color" && colorValue) {
    return (
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: colorValue,
          border: "1px solid rgba(0,0,0,0.1)",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: font.mono,
        color: text.hint,
        width: 14,
        textAlign: "center",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {icon}
    </span>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run varTypeIcon`
Expected: PASS

**Step 5: Commit**

```bash
git add src/overlay/variables/VarTypeIcon.tsx src/overlay/__tests__/varTypeIcon.test.ts
git commit -m "feat(variables): add VarTypeIcon component with type-aware icons"
```

---

### Task 3: Add ReferencePill component

Visually distinguish alias values (colored badge pill) from literal values (plain text).

**Files:**
- Create: `src/overlay/variables/ReferencePill.tsx`
- Test: `src/overlay/__tests__/referencePill.test.ts`

**Step 1: Write the failing test**

Create `src/overlay/__tests__/referencePill.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { formatDisplayName } from "../variables/ReferencePill";

describe("formatDisplayName", () => {
  it("strips -- prefix from variable name", () => {
    expect(formatDisplayName("--gray-050")).toBe("gray-050");
  });

  it("returns name as-is if no -- prefix", () => {
    expect(formatDisplayName("gray-050")).toBe("gray-050");
  });

  it("handles empty string", () => {
    expect(formatDisplayName("")).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run referencePill`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/overlay/variables/ReferencePill.tsx`:

```tsx
import React from "react";
import { text, font, surface, border, color as themeColor } from "../theme";

/** Strip the `--` prefix for display. Exported for testing. */
export function formatDisplayName(varName: string): string {
  return varName.startsWith("--") ? varName.slice(2) : varName;
}

/**
 * Renders a variable value — either as a reference pill (for alias values)
 * or as plain text (for literal values).
 */
export function VariableValue({
  value,
  aliasOf,
  resolvedColor,
}: {
  value: string;
  aliasOf?: string;
  resolvedColor?: string;
}) {
  // Alias → render as pill
  if (aliasOf) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "1px 6px",
          borderRadius: 3,
          background: surface.subtle,
          border: `1px solid ${border.subtle}`,
          fontSize: 10,
          fontFamily: font.mono,
          color: text.secondary,
          maxWidth: "100%",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {resolvedColor && (
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: resolvedColor,
              border: "1px solid rgba(0,0,0,0.1)",
              flexShrink: 0,
            }}
          />
        )}
        {formatDisplayName(aliasOf)}
      </span>
    );
  }

  // Literal → plain text
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: font.mono,
        color: text.secondary,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      }}
    >
      {value}
    </span>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run referencePill`
Expected: PASS

**Step 5: Commit**

```bash
git add src/overlay/variables/ReferencePill.tsx src/overlay/__tests__/referencePill.test.ts
git commit -m "feat(variables): add ReferencePill for alias vs literal value display"
```

---

### Task 4: Build CollectionSidebar component

The left pane — list of collections with create, rename, delete, reorder, and collapsibility.

**Files:**
- Create: `src/overlay/variables/CollectionSidebar.tsx`

**Step 1: Write the component**

Create `src/overlay/variables/CollectionSidebar.tsx`:

```tsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Plus, ChevronLeft, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { createPortal } from "react-dom";
import { text, border, surface, font, color, shadow, zIndex } from "../theme";
import { ms } from "../timing";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { TokenCollection } from "./tokenCollections";
import type { AutoCollection } from "./autoCollections";

const SIDEBAR_WIDTH = 170;
const STORAGE_COLLAPSED_KEY = "__tuner_vars_sidebar_collapsed";

export interface CollectionSidebarProps {
  /** User-defined collections */
  collections: TokenCollection[];
  /** Auto-inferred collections (shown below manual) */
  autoCollections: AutoCollection[];
  /** Currently selected collection ID (manual or auto:*) */
  selectedId: string | null;
  /** Selection handler */
  onSelect: (id: string) => void;
  /** CRUD handlers */
  onAddCollection: (name: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  /** Panel close handler */
  onClose: () => void;
}

function loadCollapsed(): boolean {
  try { return localStorage.getItem(STORAGE_COLLAPSED_KEY) === "true"; }
  catch { return false; }
}

export function CollectionSidebar({
  collections,
  autoCollections,
  selectedId,
  onSelect,
  onAddCollection,
  onRenameCollection,
  onDeleteCollection,
  onClose,
}: CollectionSidebarProps) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_COLLAPSED_KEY, String(collapsed)); }
    catch {}
  }, [collapsed]);

  useEffect(() => {
    if (adding) addRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (renamingId) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [renamingId]);

  const handleAddSubmit = useCallback(() => {
    const name = addName.trim();
    if (name) onAddCollection(name);
    setAddName("");
    setAdding(false);
  }, [addName, onAddCollection]);

  const handleRenameSubmit = useCallback(() => {
    const name = renameDraft.trim();
    if (name && renamingId) onRenameCollection(renamingId, name);
    setRenamingId(null);
  }, [renameDraft, renamingId, onRenameCollection]);

  const handleMenuOpen = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setMenuPos({ x: rect.right, y: rect.top });
    setMenuId(id);
  }, []);

  if (collapsed) {
    return (
      <div style={{ width: 32, flexShrink: 0, borderRight: `1px solid ${border.subtle}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8 }}>
        <button
          onClick={() => setCollapsed(false)}
          style={{ width: 22, height: 22, border: "none", background: "transparent", borderRadius: 3, cursor: "pointer", color: text.label, display: "flex", alignItems: "center", justifyContent: "center" }}
          title="Expand sidebar"
        >
          <ChevronLeft size={12} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>
    );
  }

  const allItems: { id: string; name: string; isAuto: boolean }[] = [
    ...collections.map((c) => ({ id: c.id, name: c.name, isAuto: false })),
    ...autoCollections.map((c) => ({ id: c.id, name: c.name, isAuto: true })),
  ];

  // Auto-select first if nothing selected
  if (!selectedId && allItems.length > 0) {
    // Defer to parent — don't mutate here
  }

  return (
    <div style={{ width: SIDEBAR_WIDTH, flexShrink: 0, borderRight: `1px solid ${border.subtle}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Sidebar header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 8px 6px", borderBottom: `1px solid ${border.subtle}`, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: text.primary, fontFamily: font.sans }}>Variables</span>
        <div style={{ display: "flex", gap: 2 }}>
          <button
            onClick={() => setAdding(true)}
            style={{ width: 20, height: 20, border: "none", background: "transparent", borderRadius: 3, cursor: "pointer", color: text.label, display: "flex", alignItems: "center", justifyContent: "center" }}
            title="New collection"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            style={{ width: 20, height: 20, border: "none", background: "transparent", borderRadius: 3, cursor: "pointer", color: text.label, display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Collapse sidebar"
          >
            <ChevronLeft size={12} />
          </button>
        </div>
      </div>

      {/* Collection list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {/* Inline add */}
        {adding && (
          <div style={{ padding: "2px 8px" }}>
            <input
              ref={addRef}
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSubmit();
                if (e.key === "Escape") { setAdding(false); setAddName(""); }
              }}
              onBlur={handleAddSubmit}
              placeholder="Collection name"
              style={{ width: "100%", height: 24, border: `1px solid ${color.primary}`, background: surface.subtle, borderRadius: 3, padding: "0 6px", fontSize: 11, fontFamily: font.sans, color: text.primary, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        )}

        {allItems.map((item) => {
          const isSelected = item.id === selectedId;
          const isRenaming = item.id === renamingId;

          return (
            <CollectionRow
              key={item.id}
              name={item.name}
              isAuto={item.isAuto}
              isSelected={isSelected}
              isRenaming={isRenaming}
              renameDraft={renameDraft}
              renameRef={item.id === renamingId ? renameRef : undefined}
              onRenameDraftChange={setRenameDraft}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={() => setRenamingId(null)}
              onClick={() => onSelect(item.id)}
              onMenuOpen={item.isAuto ? undefined : (e) => handleMenuOpen(item.id, e)}
            />
          );
        })}
      </div>

      {/* Context menu portal */}
      {menuId && (
        <SidebarContextMenu
          x={menuPos.x}
          y={menuPos.y}
          onRename={() => {
            const coll = collections.find((c) => c.id === menuId);
            if (coll) { setRenameDraft(coll.name); setRenamingId(menuId); }
            setMenuId(null);
          }}
          onDelete={() => {
            onDeleteCollection(menuId);
            setMenuId(null);
          }}
          onClose={() => setMenuId(null)}
        />
      )}
    </div>
  );
}

export { SIDEBAR_WIDTH };

// ─── Sub-components ────────────────────────────────────────────────

function CollectionRow({
  name,
  isAuto,
  isSelected,
  isRenaming,
  renameDraft,
  renameRef,
  onRenameDraftChange,
  onRenameSubmit,
  onRenameCancel,
  onClick,
  onMenuOpen,
}: {
  name: string;
  isAuto: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  renameDraft: string;
  renameRef?: React.RefObject<HTMLInputElement | null>;
  onRenameDraftChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onClick: () => void;
  onMenuOpen?: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 8px",
        cursor: "pointer",
        background: isSelected ? surface.hover : hovered ? surface.subtleHover : "transparent",
        transition: `background ${ms("fast")}`,
        borderRadius: 0,
        userSelect: "none",
      }}
    >
      {isRenaming ? (
        <input
          ref={renameRef}
          value={renameDraft}
          onChange={(e) => onRenameDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameSubmit();
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={onRenameSubmit}
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 1, height: 20, border: `1px solid ${color.primary}`, background: surface.subtle, borderRadius: 3, padding: "0 4px", fontSize: 11, fontFamily: font.sans, color: text.primary, outline: "none", boxSizing: "border-box" }}
        />
      ) : (
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: font.sans,
            color: isSelected ? text.primary : text.secondary,
            fontWeight: isSelected ? 500 : 400,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {name}
          {isAuto && (
            <span style={{ fontSize: 9, color: text.hint, marginLeft: 4 }}>auto</span>
          )}
        </span>
      )}

      {/* ... menu button */}
      {onMenuOpen && (hovered || isSelected) && !isRenaming && (
        <button
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e); }}
          style={{ width: 18, height: 18, border: "none", background: "transparent", borderRadius: 3, cursor: "pointer", color: text.hint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <MoreHorizontal size={12} />
        </button>
      )}
    </div>
  );
}

function SidebarContextMenu({
  x,
  y,
  onRename,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(menuRef, true);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      data-tuner-portal
      style={{
        position: "fixed",
        zIndex: zIndex.max,
        minWidth: 120,
        background: color.popover,
        border: `1px solid ${border.default}`,
        borderRadius: 6,
        boxShadow: shadow.dropdown,
        padding: "4px 0",
        left: x,
        top: y,
      }}
    >
      <MenuItem icon={<Pencil size={11} />} label="Rename" onClick={() => { onRename(); onClose(); }} />
      <MenuItem icon={<Trash2 size={11} />} label="Delete" onClick={() => { onDelete(); onClose(); }} />
    </div>,
    document.body,
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        fontSize: 11,
        cursor: "pointer",
        background: hovered ? surface.hover : "transparent",
        color: text.primary,
        outline: "none",
        userSelect: "none",
        transition: `background ${ms("fast")}`,
      }}
    >
      <span style={{ color: text.hint }}>{icon}</span>
      {label}
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add src/overlay/variables/CollectionSidebar.tsx
git commit -m "feat(variables): add CollectionSidebar master-detail left pane"
```

---

### Task 5: Build CollectionDetail component

The right pane — variable table with subgroup headers, type icons, reference pills, per-subgroup add.

**Files:**
- Create: `src/overlay/variables/CollectionDetail.tsx`

**Step 1: Write the component**

Create `src/overlay/variables/CollectionDetail.tsx`. This component receives the selected collection's variables and renders them grouped by subgroups with:
- Collection name as header
- "Name" | "Base mode" column headers
- Subgroup headers (bold, lowercase)
- Variable rows: type icon + display name + value (pill or literal)
- Per-subgroup `+ New variable` button
- Right-click context menu for "Move to collection..."

Key implementation details:
- Import `VarTypeIcon` from `./VarTypeIcon`
- Import `VariableValue` from `./ReferencePill`
- Import `inferSubgroups` from `./autoCollections`
- Reuse existing `InlineAddRow` pattern from current `GlobalVariablesPanel.tsx` (lines 124-192)
- Reuse existing `VariableContextMenu` from current `GlobalVariablesPanel.tsx` (lines 202-318)
- Import `GlobalVariableRow` logic from current panel (lines 347-570) — adapt to new layout
- Variable display name: strip `--` prefix and subgroup prefix for cleaner display

The component should be ~300-400 lines. Extract the `VariableContextMenu`, `InlineAddRow`, and `GlobalVariableRow` from the current panel into this file (or keep them as shared internals).

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/overlay/variables/CollectionDetail.tsx
git commit -m "feat(variables): add CollectionDetail right pane with subgroups and type icons"
```

---

### Task 6: Rewrite GlobalVariablesPanel as master-detail shell

Replace the current panel with the two-pane layout. This is the main integration task.

**Files:**
- Modify: `src/overlay/variables/GlobalVariablesPanel.tsx` (major rewrite)

**Step 1: Rewrite the component**

The new `GlobalVariablesPanel` becomes a thin shell:
- Horizontal flexbox: `CollectionSidebar` | `CollectionDetail`
- Manages `selectedCollectionId` state
- Passes discovered variables, collections, autoCollections down
- Search bar moves to the right pane header (within CollectionDetail)
- Removes the 4-tab segmented control (Category/Prefix/Collections/Tier) — the sidebar IS the navigation now
- Preserves all existing CRUD logic (addCustomProperty, removeCustomProperty, etc.)
- Preserves the existing context menu with "Move to collection..." submenu

Key state:
```ts
const [selectedId, setSelectedId] = useState<string | null>(null);
```

Auto-select first collection on mount if nothing selected.

Reuse existing hooks:
- `useTokenCollections()` — already provides full CRUD
- `useSyncExternalStore(subscribeOverrides, getOverrideSnapshot)` — override detection
- `discoverAllVariables()` — variable discovery
- `inferAutoCollections()` — auto-grouping
- `buildAliasGraph()` — alias detection

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Run all tests**

Run: `npm test`
Expected: All existing tests pass (we haven't changed data layer)

**Step 4: Commit**

```bash
git add src/overlay/variables/GlobalVariablesPanel.tsx
git commit -m "feat(variables): rewrite panel as master-detail layout"
```

---

### Task 7: Width override in Overlay.tsx

Make the panel wider (550px) when variables view is active, snap back to 300px otherwise.

**Files:**
- Modify: `src/overlay/shell/Overlay.tsx:1621-1624`

**Step 1: Add width logic**

At line 1624, change the hardcoded `width: 300` to be dynamic:

```tsx
// In the motion.div style object (line ~1624):
width: activePanel.type === "variables" ? 550 : 300,
```

Add a transition for smooth width change:
```tsx
transition: snapping
  ? `top ${ms("expand")} ease, left ${ms("expand")} ease, width ${ms("expand")} ease, box-shadow ${ms("expand")}`
  : `width ${ms("expand")} ease, box-shadow ${ms("expand")}`,
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Manual test**

Open `http://localhost:3000/demo`, toggle the variables panel. Verify:
- Panel animates to 550px width
- Closing and reopening the CSS inspector panel returns to 300px
- Panel stays within viewport bounds

**Step 4: Commit**

```bash
git add src/overlay/shell/Overlay.tsx
git commit -m "feat(variables): widen panel to 550px when variables view active"
```

---

### Task 8: Smoke test and visual verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Manual browser test**

Open `http://localhost:3000/demo` and verify:

1. Open variables panel → shows master-detail layout at 550px
2. Collection sidebar shows auto-collections on the left
3. Clicking a collection shows its variables in the right pane
4. Variables grouped into subgroups with bold headers
5. Type icons appear per variable (●, #, ↗, Ā)
6. Alias values show as pills, literal values as plain text
7. Per-subgroup `+ New variable` works
8. Right-click context menu with "Move to collection..." works
9. `<|` collapses sidebar, click to re-expand
10. Creating a manual collection via `+` button works
11. Renaming/deleting via `...` context menu works
12. Closing variables panel → CSS inspector at 300px width

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(variables): complete Webflow-style master-detail variables panel"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | `inferSubgroups` pure function | autoCollections.ts + test |
| 2 | `VarTypeIcon` component | VarTypeIcon.tsx + test |
| 3 | `ReferencePill` component | ReferencePill.tsx + test |
| 4 | `CollectionSidebar` (left pane) | CollectionSidebar.tsx |
| 5 | `CollectionDetail` (right pane) | CollectionDetail.tsx |
| 6 | Rewrite `GlobalVariablesPanel` as shell | GlobalVariablesPanel.tsx |
| 7 | Width override in Overlay | Overlay.tsx |
| 8 | Smoke test + visual verification | — |

**Deferred (future session):**
- Multi-mode columns (Base mode + theme variants)
- Collection sidebar icons
- Select/bulk mode
- Manual subgroups
