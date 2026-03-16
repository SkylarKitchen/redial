# Filter Section Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat-slider FilterSliders with a Webflow-style list-of-items editor — collapsible cards, categorized add dropdown, per-item type selector, drop-shadow support.

**Architecture:** Each filter becomes a `FilterItem` in an ordered array (like `ShadowValue[]`). The component renders collapsed summary rows that expand to show type dropdown + parameter controls. `parseFilter`/`filterToCSS` in `cssParsers.ts` switch from flat map to ordered array. EffectsSection state changes from `Partial<FilterValues>` to `FilterItem[]`.

**Tech Stack:** React (inline styles), Vitest, existing controls (`DragHandle`, `VisibilityToggle`, `EditorRemoveButton`), `useDragReorder` hook.

---

### Task 1: Update data model and parser — types + parseFilterItems

**Files:**
- Modify: `src/overlay/sections/FilterSliders.tsx` (replace `FilterValues` interface and exports)
- Modify: `src/overlay/cssParsers.ts:86-128` (replace `parseFilter` and `filterToCSS`)
- Test: `src/overlay/__tests__/cssParsers.test.ts`

**Step 1: Write failing tests for the new parseFilterItems + filterItemsToCSS**

Add these tests to `src/overlay/__tests__/cssParsers.test.ts`, replacing the existing `parseFilter` and `filterToCSS` describe blocks:

```ts
// ─── parseFilterItems ─────────────────────────────────────────────────

describe("parseFilterItems", () => {
  it("returns empty array for 'none'", () => {
    expect(parseFilterItems("none")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseFilterItems("")).toEqual([]);
  });

  it("parses blur with px value", () => {
    const result = parseFilterItems("blur(4px)");
    expect(result).toEqual([
      { type: "blur", values: [4], visible: true, expanded: false },
    ]);
  });

  it("parses percentage filter (brightness) — scales decimal to 0-100", () => {
    const result = parseFilterItems("brightness(0.8)");
    expect(result).toEqual([
      { type: "brightness", values: [80], visible: true, expanded: false },
    ]);
  });

  it("parses hue-rotate in degrees", () => {
    const result = parseFilterItems("hue-rotate(90deg)");
    expect(result).toEqual([
      { type: "hue-rotate", values: [90], visible: true, expanded: false },
    ]);
  });

  it("parses multiple filters preserving order", () => {
    const result = parseFilterItems("blur(2px) brightness(0.9) contrast(1.1)");
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ type: "blur", values: [2] });
    expect(result[1]).toMatchObject({ type: "brightness", values: [90] });
    expect(result[2]).toMatchObject({ type: "contrast", values: [110] });
  });

  it("parses drop-shadow with color", () => {
    const result = parseFilterItems("drop-shadow(2px 4px 6px rgba(0,0,0,0.3))");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "drop-shadow",
      values: [2, 4, 6],
      color: "rgba(0,0,0,0.3)",
    });
  });

  it("parses drop-shadow without explicit color", () => {
    const result = parseFilterItems("drop-shadow(2px 4px 6px)");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "drop-shadow",
      values: [2, 4, 6],
    });
  });

  it("parses grayscale", () => {
    const result = parseFilterItems("grayscale(0.5)");
    expect(result).toEqual([
      { type: "grayscale", values: [50], visible: true, expanded: false },
    ]);
  });

  it("handles mixed filters including drop-shadow", () => {
    const result = parseFilterItems("blur(5px) drop-shadow(1px 2px 3px #000) sepia(0.5)");
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("blur");
    expect(result[1].type).toBe("drop-shadow");
    expect(result[2].type).toBe("sepia");
  });
});

describe("filterItemsToCSS", () => {
  it("returns 'none' for empty array", () => {
    expect(filterItemsToCSS([])).toBe("none");
  });

  it("serializes blur", () => {
    expect(filterItemsToCSS([
      { type: "blur", values: [4], visible: true, expanded: false },
    ])).toBe("blur(4px)");
  });

  it("serializes hue-rotate", () => {
    expect(filterItemsToCSS([
      { type: "hue-rotate", values: [90], visible: true, expanded: false },
    ])).toBe("hue-rotate(90deg)");
  });

  it("serializes percentage filter back to decimal", () => {
    expect(filterItemsToCSS([
      { type: "brightness", values: [80], visible: true, expanded: false },
    ])).toBe("brightness(0.8)");
  });

  it("serializes drop-shadow with color", () => {
    expect(filterItemsToCSS([
      { type: "drop-shadow", values: [2, 4, 6], color: "rgba(0,0,0,0.3)", visible: true, expanded: false },
    ])).toBe("drop-shadow(2px 4px 6px rgba(0,0,0,0.3))");
  });

  it("serializes drop-shadow without color (uses default)", () => {
    expect(filterItemsToCSS([
      { type: "drop-shadow", values: [2, 4, 6], visible: true, expanded: false },
    ])).toBe("drop-shadow(2px 4px 6px rgba(0,0,0,0.25))");
  });

  it("excludes hidden items", () => {
    expect(filterItemsToCSS([
      { type: "blur", values: [4], visible: false, expanded: false },
      { type: "brightness", values: [80], visible: true, expanded: false },
    ])).toBe("brightness(0.8)");
  });

  it("returns 'none' when all items hidden", () => {
    expect(filterItemsToCSS([
      { type: "blur", values: [4], visible: false, expanded: false },
    ])).toBe("none");
  });

  it("serializes multiple items in order", () => {
    const css = filterItemsToCSS([
      { type: "blur", values: [2], visible: true, expanded: false },
      { type: "brightness", values: [80], visible: true, expanded: false },
    ]);
    expect(css).toBe("blur(2px) brightness(0.8)");
  });
});
```

Also update the imports at the top of the test file — replace `parseFilter, filterToCSS` with `parseFilterItems, filterItemsToCSS`.

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/overlay/__tests__/cssParsers.test.ts`
Expected: FAIL — `parseFilterItems` and `filterItemsToCSS` not found

**Step 3: Define FilterItem type and implement parsers**

In `src/overlay/sections/FilterSliders.tsx`, replace the `FilterValues` interface and `FilterKey`/`FilterMeta` types at the top with:

```ts
export type FilterType =
  | "blur"
  | "drop-shadow"
  | "brightness"
  | "contrast"
  | "hue-rotate"
  | "saturate"
  | "grayscale"
  | "invert"
  | "sepia";

export interface FilterItem {
  type: FilterType;
  values: number[];    // [radius] for simple, [x, y, blur] for drop-shadow
  color?: string;      // only for drop-shadow
  visible: boolean;
  expanded: boolean;
}
```

Keep the old `FilterValues` type as a deprecated alias for now (EffectsSection still references it). We'll remove it in Task 3.

In `src/overlay/cssParsers.ts`, replace the `parseFilter` and `filterToCSS` functions (lines 86-128) with:

```ts
import type { FilterItem, FilterType } from "./sections/FilterSliders";

// (keep the old parseFilter/filterToCSS temporarily as parseFilterLegacy/filterLegacyToCSS
// for the backdropFilterRemove test, remove in Task 3)

export function parseFilterItems(raw: string): FilterItem[] {
  if (!raw || raw === "none") return [];
  const items: FilterItem[] = [];

  // Match drop-shadow separately (its args contain spaces and parens for color)
  const dsRegex = /drop-shadow\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
  const simpleRegex = /(blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)\(([^)]+)\)/g;

  // Build position map for ordering
  const matches: { index: number; item: FilterItem }[] = [];

  let m: RegExpExecArray | null;
  while ((m = dsRegex.exec(raw)) !== null) {
    const inner = m[1].trim();
    // Extract color (rgba/hsla/hex) from the end
    const colorMatch = inner.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*$/i);
    const color = colorMatch?.[1];
    const numStr = color ? inner.slice(0, colorMatch!.index).trim() : inner;
    const nums = numStr.split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
    matches.push({
      index: m.index,
      item: {
        type: "drop-shadow",
        values: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0],
        color: color || undefined,
        visible: true,
        expanded: false,
      },
    });
  }

  while ((m = simpleRegex.exec(raw)) !== null) {
    const type = m[1] as FilterType;
    let val = parseFloat(m[2]);
    if (type !== "blur" && type !== "hue-rotate") {
      val = Math.round(val * 100);
    }
    matches.push({
      index: m.index,
      item: { type, values: [val], visible: true, expanded: false },
    });
  }

  // Sort by position in original string to preserve order
  matches.sort((a, b) => a.index - b.index);
  return matches.map(m => m.item);
}

export function filterItemsToCSS(items: FilterItem[]): string {
  const visible = items.filter(i => i.visible);
  if (visible.length === 0) return "none";
  return visible.map(item => {
    if (item.type === "blur") return `blur(${item.values[0]}px)`;
    if (item.type === "hue-rotate") return `hue-rotate(${item.values[0]}deg)`;
    if (item.type === "drop-shadow") {
      const [x, y, blur] = item.values;
      const c = item.color || "rgba(0,0,0,0.25)";
      return `drop-shadow(${x}px ${y}px ${blur}px ${c})`;
    }
    // percentage-based: brightness, contrast, grayscale, invert, saturate, sepia
    return `${item.type}(${item.values[0] / 100})`;
  }).join(" ");
}
```

Update the import at the top of `cssParsers.ts` — change:
```ts
import type { FilterValues } from "./sections/FilterSliders";
```
to:
```ts
import type { FilterItem, FilterType } from "./sections/FilterSliders";
```

Keep the old `parseFilter`/`filterToCSS` functions temporarily (rename to add `Legacy` suffix or leave as-is) — they're still used by EffectsSection and tests. We remove them in Task 3.

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/overlay/__tests__/cssParsers.test.ts`
Expected: All parseFilterItems/filterItemsToCSS tests PASS. Old parseFilter/filterToCSS tests still pass (not removed yet).

**Step 5: Commit**

```
feat: add FilterItem type, parseFilterItems, filterItemsToCSS
```

---

### Task 2: Rewrite FilterSliders component as FilterEditor

**Files:**
- Rewrite: `src/overlay/sections/FilterSliders.tsx` (full rewrite → `FilterEditor`)
- Test: `src/overlay/__tests__/effectsSection.test.ts` (update "Filter sliders" describe block)

**Step 1: Write failing tests for the new FilterEditor**

Replace the `"Filter sliders cover all 8 filter types"` describe block in `src/overlay/__tests__/effectsSection.test.ts` with:

```ts
// Update the file read at top:
const filterSrc = readFileSync(
  join(__dirname, "../sections/FilterSliders.tsx"),
  "utf-8",
);

describe("FilterEditor — Webflow-style filter list", () => {
  it("exports FilterItem interface with type, values, color, visible, expanded", () => {
    expect(filterSrc).toMatch(/export interface FilterItem/);
    expect(filterSrc).toMatch(/type:\s*FilterType/);
    expect(filterSrc).toMatch(/values:\s*number\[\]/);
    expect(filterSrc).toMatch(/color\?:\s*string/);
    expect(filterSrc).toMatch(/visible:\s*boolean/);
    expect(filterSrc).toMatch(/expanded:\s*boolean/);
  });

  it("exports FilterType union with all 9 types including drop-shadow", () => {
    expect(filterSrc).toMatch(/export type FilterType/);
    expect(filterSrc).toMatch(/"blur"/);
    expect(filterSrc).toMatch(/"drop-shadow"/);
    expect(filterSrc).toMatch(/"brightness"/);
    expect(filterSrc).toMatch(/"contrast"/);
    expect(filterSrc).toMatch(/"hue-rotate"/);
    expect(filterSrc).toMatch(/"saturate"/);
    expect(filterSrc).toMatch(/"grayscale"/);
    expect(filterSrc).toMatch(/"invert"/);
    expect(filterSrc).toMatch(/"sepia"/);
  });

  it("defines FILTER_CATEGORIES with 3 groups: General, Color Adjustments, Color Effects", () => {
    expect(filterSrc).toMatch(/FILTER_CATEGORIES/);
    expect(filterSrc).toMatch(/General/);
    expect(filterSrc).toMatch(/Color Adjustments/);
    expect(filterSrc).toMatch(/Color Effects/);
  });

  it("renders collapsed summary rows with type:value format", () => {
    // Should format like "Blur: 5px" in summary
    expect(filterSrc).toMatch(/formatFilterSummary|summaryText|summary/i);
  });

  it("uses useDragReorder for reordering filter items", () => {
    expect(filterSrc).toMatch(/useDragReorder/);
  });

  it("renders DragHandle, VisibilityToggle, and EditorRemoveButton per item", () => {
    expect(filterSrc).toMatch(/DragHandle/);
    expect(filterSrc).toMatch(/VisibilityToggle/);
    expect(filterSrc).toMatch(/EditorRemoveButton/);
  });

  it("accepts items: FilterItem[] and onChange: (items: FilterItem[]) => void", () => {
    expect(filterSrc).toMatch(/items:\s*FilterItem\[\]/);
    expect(filterSrc).toMatch(/onChange:\s*\(items:\s*FilterItem\[\]\)\s*=>\s*void/);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/overlay/__tests__/effectsSection.test.ts`
Expected: FAIL — new assertions don't match old FilterSliders code

**Step 3: Rewrite FilterSliders.tsx as FilterEditor**

Replace the entire content of `src/overlay/sections/FilterSliders.tsx` with the new component. Key structure:

```tsx
/**
 * FilterSliders.tsx — Webflow-style filter list editor
 *
 * Each filter is a collapsible card: summary row → expanded editor.
 * Categorized add dropdown. Supports drag-to-reorder, visibility toggle,
 * and per-item type changing.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useDragReorder } from "../hooks/useDragReorder";
import { DragHandle } from "../shell/DragHandle";
import { EditorRemoveButton, VisibilityToggle } from "../controls";
import { color, text, surface, font, shadow, zIndex, border, primaryAlpha, blackAlpha, filledTrackBg, focusBorder } from "../theme";
import { ms } from "../timing";

// ─── Types (exported for cssParsers.ts) ───────────────────────────────

export type FilterType =
  | "blur"
  | "drop-shadow"
  | "brightness"
  | "contrast"
  | "hue-rotate"
  | "saturate"
  | "grayscale"
  | "invert"
  | "sepia";

export interface FilterItem {
  type: FilterType;
  values: number[];
  color?: string;
  visible: boolean;
  expanded: boolean;
}

// ─── Metadata ─────────────────────────────────────────────────────────

interface FilterMeta {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValues: number[];
  paramLabels: string[];    // ["Radius"] for blur, ["X","Y","Blur"] for drop-shadow
  defaultColor?: string;
}

const FILTER_META: Record<FilterType, FilterMeta> = {
  "blur":        { label: "Blur",        unit: "px",  min: 0, max: 50,  step: 0.5, defaultValues: [0],       paramLabels: ["Radius"] },
  "drop-shadow": { label: "Drop shadow", unit: "px",  min: -50, max: 50, step: 1,  defaultValues: [0, 2, 4], paramLabels: ["X", "Y", "Blur"], defaultColor: "rgba(0,0,0,0.25)" },
  "brightness":  { label: "Brightness",  unit: "%",   min: 0, max: 200, step: 1,   defaultValues: [100],     paramLabels: ["Amount"] },
  "contrast":    { label: "Contrast",    unit: "%",   min: 0, max: 200, step: 1,   defaultValues: [100],     paramLabels: ["Amount"] },
  "hue-rotate":  { label: "Hue rotate",  unit: "deg", min: 0, max: 360, step: 1,   defaultValues: [0],       paramLabels: ["Angle"] },
  "saturate":    { label: "Saturate",    unit: "%",   min: 0, max: 200, step: 1,   defaultValues: [100],     paramLabels: ["Amount"] },
  "grayscale":   { label: "Grayscale",   unit: "%",   min: 0, max: 100, step: 1,   defaultValues: [0],       paramLabels: ["Amount"] },
  "invert":      { label: "Invert",      unit: "%",   min: 0, max: 100, step: 1,   defaultValues: [0],       paramLabels: ["Amount"] },
  "sepia":       { label: "Sepia",       unit: "%",   min: 0, max: 100, step: 1,   defaultValues: [0],       paramLabels: ["Amount"] },
};

// ─── Categorized dropdown ─────────────────────────────────────────────

interface FilterCategory {
  label: string;
  types: FilterType[];
}

const FILTER_CATEGORIES: FilterCategory[] = [
  { label: "General",           types: ["blur", "drop-shadow"] },
  { label: "Color Adjustments", types: ["brightness", "contrast", "hue-rotate", "saturate"] },
  { label: "Color Effects",     types: ["grayscale", "invert", "sepia"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────

function formatFilterSummary(item: FilterItem): string {
  const meta = FILTER_META[item.type];
  if (item.type === "drop-shadow") {
    return `Drop shadow: ${item.values[0]}px ${item.values[1]}px ${item.values[2]}px`;
  }
  return `${meta.label}: ${item.values[0]}${meta.unit}`;
}

function createDefaultFilter(type: FilterType): FilterItem {
  const meta = FILTER_META[type];
  return {
    type,
    values: [...meta.defaultValues],
    color: meta.defaultColor,
    visible: true,
    expanded: true,
  };
}

// ─── Props ────────────────────────────────────────────────────────────

export interface FilterEditorProps {
  items: FilterItem[];
  onChange: (items: FilterItem[]) => void;
  type?: "filter" | "backdrop-filter";
}

// ─── Main Component ───────────────────────────────────────────────────

export function FilterEditor({ items, onChange, type = "filter" }: FilterEditorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(items, onChange);

  // Active types set for checkmarks in dropdown
  const activeTypes = new Set(items.map(i => i.type));

  const handleAdd = useCallback((filterType: FilterType) => {
    // If type already active, scroll to it / expand it
    const existingIndex = items.findIndex(i => i.type === filterType);
    if (existingIndex >= 0) {
      const next = [...items];
      next[existingIndex] = { ...next[existingIndex], expanded: true };
      onChange(next);
    } else {
      onChange([...items, createDefaultFilter(filterType)]);
    }
    setDropdownOpen(false);
  }, [items, onChange]);

  const handleRemove = useCallback((index: number) => {
    onChange(items.filter((_, i) => i !== index));
  }, [items, onChange]);

  const handleToggleVisible = useCallback((index: number) => {
    const next = [...items];
    next[index] = { ...next[index], visible: !next[index].visible };
    onChange(next);
  }, [items, onChange]);

  const handleToggleExpanded = useCallback((index: number) => {
    const next = [...items];
    next[index] = { ...next[index], expanded: !next[index].expanded };
    onChange(next);
  }, [items, onChange]);

  const handleUpdateItem = useCallback((index: number, updated: FilterItem) => {
    const next = [...items];
    next[index] = updated;
    onChange(next);
  }, [items, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {/* Filter items */}
      <div style={{ position: "relative" }}>
        {items.map((item, index) => {
          const dragProps = handleProps(index);
          return (
            <div key={index} ref={registerRef(index)} style={itemStyle(index)}>
              <FilterItemRow
                item={item}
                index={index}
                onUpdate={handleUpdateItem}
                onRemove={handleRemove}
                onToggleVisible={handleToggleVisible}
                onToggleExpanded={handleToggleExpanded}
                dragHandleProps={dragProps}
                isDragging={isDragging}
              />
            </div>
          );
        })}

        {/* Drop indicator line */}
        {(() => {
          const style = dropLineStyle();
          return style ? <div style={style} /> : null;
        })()}
      </div>

      {/* Categorized add dropdown */}
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(o => !o)}
          style={{
            background: "transparent",
            border: `1px solid ${surface.active}`,
            borderRadius: "3px",
            color: text.label,
            fontSize: "10px",
            fontFamily: font.sans,
            padding: "3px 8px",
            cursor: "pointer",
            marginTop: "4px",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = color.input; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          + Add {type === "backdrop-filter" ? "backdrop filter" : "filter"}
        </button>

        {dropdownOpen && (
          <CategorizedDropdown
            categories={FILTER_CATEGORIES}
            activeTypes={activeTypes}
            onSelect={handleAdd}
          />
        )}
      </div>

      {items.length === 0 && (
        <div style={{ padding: "8px 0", fontSize: "10px", color: text.hint, textAlign: "center", fontFamily: font.sans }}>
          No {type === "backdrop-filter" ? "backdrop filters" : "filters"}
        </div>
      )}
    </div>
  );
}

// ─── CategorizedDropdown ──────────────────────────────────────────────

function CategorizedDropdown({ categories, activeTypes, onSelect }: {
  categories: FilterCategory[];
  activeTypes: Set<FilterType>;
  onSelect: (type: FilterType) => void;
}) {
  return (
    <div style={{
      position: "absolute",
      top: "100%",
      left: 0,
      marginTop: "2px",
      background: color.popover,
      border: `1px solid ${surface.track}`,
      borderRadius: "6px",
      padding: "4px 0",
      zIndex: zIndex.dropdown,
      minWidth: "180px",
      boxShadow: shadow.dropdown,
    }}>
      {categories.map((cat) => (
        <div key={cat.label}>
          {/* Category header */}
          <div style={{
            padding: "4px 10px 2px",
            fontSize: "9px",
            fontFamily: font.sans,
            color: text.disabled,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontWeight: 600,
          }}>
            {cat.label}
          </div>
          {/* Items */}
          {cat.types.map((filterType) => (
            <DropdownItem
              key={filterType}
              label={FILTER_META[filterType].label}
              active={activeTypes.has(filterType)}
              onClick={() => onSelect(filterType)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DropdownItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "4px 10px 4px 24px",
        fontSize: "11px",
        fontFamily: font.sans,
        color: hovered ? text.primary : text.label,
        cursor: "pointer",
        background: hovered ? primaryAlpha(0.15) : "transparent",
        position: "relative",
        transition: `background ${ms("fast")}`,
      }}
    >
      {active && (
        <span style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "10px" }}>
          ✓
        </span>
      )}
      {label}
    </div>
  );
}

// ─── FilterItemRow (collapsed/expanded card) ──────────────────────────

function FilterItemRow({ item, index, onUpdate, onRemove, onToggleVisible, onToggleExpanded, dragHandleProps, isDragging }: {
  item: FilterItem;
  index: number;
  onUpdate: (index: number, item: FilterItem) => void;
  onRemove: (index: number) => void;
  onToggleVisible: (index: number) => void;
  onToggleExpanded: (index: number) => void;
  dragHandleProps: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging: boolean;
}) {
  const summaryText = formatFilterSummary(item);

  return (
    <div style={{
      borderBottom: `1px solid ${border.subtle}`,
      opacity: item.visible ? 1 : 0.4,
      transition: `opacity ${ms("normal")}`,
    }}>
      {/* Collapsed summary row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          height: "28px",
          padding: "0 2px",
          cursor: "pointer",
        }}
        onClick={() => onToggleExpanded(index)}
      >
        <DragHandle
          isDragging={isDragging}
          onPointerDown={(e) => { e.stopPropagation(); dragHandleProps.onPointerDown(e); }}
        />
        <span style={{
          flex: 1,
          fontSize: "10px",
          fontFamily: font.sans,
          color: text.secondary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {summaryText}
        </span>
        <VisibilityToggle
          visible={item.visible}
          onToggle={() => { onToggleVisible(index); }}
        />
        <EditorRemoveButton onClick={() => onRemove(index)} />
      </div>

      {/* Expanded editor */}
      {item.expanded && (
        <FilterItemEditor item={item} index={index} onUpdate={onUpdate} />
      )}
    </div>
  );
}

// ─── FilterItemEditor (expanded controls) ─────────────────────────────

function FilterItemEditor({ item, index, onUpdate }: {
  item: FilterItem;
  index: number;
  onUpdate: (index: number, item: FilterItem) => void;
}) {
  const meta = FILTER_META[item.type];

  const handleTypeChange = useCallback((newType: FilterType) => {
    const newMeta = FILTER_META[newType];
    onUpdate(index, {
      ...item,
      type: newType,
      values: [...newMeta.defaultValues],
      color: newMeta.defaultColor,
    });
  }, [index, item, onUpdate]);

  const handleValueChange = useCallback((valueIndex: number, val: number) => {
    const next = [...item.values];
    next[valueIndex] = val;
    onUpdate(index, { ...item, values: next });
  }, [index, item, onUpdate]);

  const handleColorChange = useCallback((c: string) => {
    onUpdate(index, { ...item, color: c });
  }, [index, item, onUpdate]);

  return (
    <div style={{ padding: "4px 8px 8px 20px", display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Filter type dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "10px", fontFamily: font.sans, color: text.label, width: "44px", flexShrink: 0 }}>
          Filter
        </span>
        <select
          value={item.type}
          onChange={(e) => handleTypeChange(e.target.value as FilterType)}
          style={{
            flex: 1,
            background: color.input,
            border: `1px solid ${border.default}`,
            borderRadius: "3px",
            color: text.secondary,
            fontSize: "10px",
            fontFamily: font.sans,
            padding: "3px 6px",
            outline: "none",
          }}
        >
          {FILTER_CATEGORIES.flatMap(cat => cat.types).map(t => (
            <option key={t} value={t}>{FILTER_META[t].label}</option>
          ))}
        </select>
      </div>

      {/* Parameter sliders */}
      {meta.paramLabels.map((paramLabel, vi) => {
        const val = item.values[vi] ?? meta.defaultValues[vi] ?? 0;
        const pct = ((val - meta.min) / (meta.max - meta.min)) * 100;
        return (
          <div key={paramLabel} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", fontFamily: font.sans, color: text.label, width: "44px", flexShrink: 0 }}>
              {paramLabel}
            </span>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <input
                type="range"
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={val}
                onChange={(e) => handleValueChange(vi, parseFloat(e.target.value))}
                style={{
                  width: "100%",
                  height: "3px",
                  appearance: "none",
                  WebkitAppearance: "none",
                  background: filledTrackBg(Math.max(0, Math.min(100, pct))),
                  borderRadius: "2px",
                  outline: "none",
                  cursor: "pointer",
                }}
              />
            </div>
            <NumberInput
              value={val}
              min={meta.min}
              max={meta.max}
              step={meta.step}
              onChange={(v) => handleValueChange(vi, v)}
            />
            <span style={{ width: "18px", fontSize: "9px", fontFamily: font.mono, color: text.disabled, flexShrink: 0 }}>
              {meta.unit}
            </span>
          </div>
        );
      })}

      {/* Color swatch for drop-shadow */}
      {item.type === "drop-shadow" && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", fontFamily: font.sans, color: text.label, width: "44px", flexShrink: 0 }}>
            Color
          </span>
          <input
            type="color"
            value={item.color || "#000000"}
            onChange={(e) => handleColorChange(e.target.value)}
            style={{ width: 20, height: 20, border: `1px solid ${border.default}`, borderRadius: 3, padding: 0, cursor: "pointer" }}
          />
          <span style={{ fontSize: "9px", fontFamily: font.mono, color: text.hint }}>
            {item.color || "rgba(0,0,0,0.25)"}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── NumberInput (reused from original) ───────────────────────────────

function NumberInput({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
  }, [draft, min, max, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(max, value + (e.shiftKey ? step * 10 : step))); }
    else if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(min, value - (e.shiftKey ? step * 10 : step))); }
  }, [commit, value, min, max, step, onChange]);

  return (
    <input
      value={focused ? draft : String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      style={{
        width: "36px",
        background: color.input,
        border: focusBorder(focused),
        borderRadius: "2px",
        color: text.secondary,
        fontSize: "10px",
        fontFamily: font.mono,
        textAlign: "center",
        padding: "2px 2px",
        outline: "none",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Legacy re-exports (removed in Task 3) ────────────────────────────

/** @deprecated Use FilterItem instead */
export interface FilterValues {
  blur: number;
  brightness: number;
  contrast: number;
  grayscale: number;
  "hue-rotate": number;
  invert: number;
  saturate: number;
  sepia: number;
}

/** @deprecated Use FilterEditor instead */
export const FilterSliders = FilterEditor as any;
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/overlay/__tests__/effectsSection.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat: rewrite FilterSliders as Webflow-style FilterEditor
```

---

### Task 3: Wire FilterEditor into EffectsSection

**Files:**
- Modify: `src/overlay/sections/EffectsSection.tsx:16,176-244,357-371`
- Modify: `src/overlay/cssParsers.ts` (remove old parseFilter/filterToCSS, update import)
- Modify: `src/overlay/__tests__/backdropFilterRemove.test.ts` (update to new API)
- Test: `src/overlay/__tests__/cssParsers.test.ts` (remove old describe blocks)

**Step 1: Update EffectsSection imports and state**

In `src/overlay/sections/EffectsSection.tsx`, change:

```ts
// Old:
import { FilterSliders, type FilterValues } from "./FilterSliders";
// New:
import { FilterEditor, type FilterItem } from "./FilterSliders";
```

```ts
// Old:
import { parseFilter, filterToCSS } from "../cssParsers";
// New:
import { parseFilterItems, filterItemsToCSS } from "../cssParsers";
```

Replace the filter state declarations (lines ~176-178):

```ts
// Old:
const [filterValues, setFilterValues] = useState<Partial<FilterValues>>(() => parseFilter(cs.filter));
const [backdropFilterValues, setBackdropFilterValues] = useState<Partial<FilterValues>>(() =>
  parseFilter(cs.getPropertyValue("backdrop-filter") || cs.getPropertyValue("-webkit-backdrop-filter") || "")
);

// New:
const [filterItems, setFilterItems] = useState<FilterItem[]>(() => parseFilterItems(cs.filter));
const [backdropFilterItems, setBackdropFilterItems] = useState<FilterItem[]>(() =>
  parseFilterItems(cs.getPropertyValue("backdrop-filter") || cs.getPropertyValue("-webkit-backdrop-filter") || "")
);
```

Replace filter handlers (lines ~230-244):

```ts
// Old:
const handleFilterChange = useCallback(
  (key: string, value: number) => {
    const next = { ...filterValues, [key]: value };
    setFilterValues(next);
    apply("filter", filterToCSS(next));
  },
  [filterValues, apply]
);
const handleBackdropFilterChange = useCallback(
  (key: string, value: number) => {
    const next = { ...backdropFilterValues, [key]: value };
    setBackdropFilterValues(next);
    apply("backdrop-filter", filterToCSS(next));
  },
  [backdropFilterValues, apply]
);

// New:
const handleFiltersChange = useCallback(
  (items: FilterItem[]) => {
    setFilterItems(items);
    apply("filter", filterItemsToCSS(items));
  },
  [apply]
);
const handleBackdropFiltersChange = useCallback(
  (items: FilterItem[]) => {
    setBackdropFilterItems(items);
    apply("backdrop-filter", filterItemsToCSS(items));
  },
  [apply]
);
```

Update the collapsed-by-default state — auto-expand now checks array length:

```ts
// Old:
const [filtersExpanded, setFiltersExpanded] = useState(() => {
  const f = cs.filter;
  return !!f && f !== "none" && f !== "";
});

// New — no longer needed, remove filtersExpanded/backdropFiltersExpanded.
// The SubSectionHeader "+" now directly adds a filter item.
```

Update the JSX render — replace the Filters and Backdrop filters sections (~lines 357-371):

```tsx
{/* 7. Filters */}
<SubSectionHeader
  label="Filters"
  onAdd={() => handleFiltersChange([...filterItems, { type: "blur", values: [0], visible: true, expanded: true }])}
  indicator={ind("filter")}
  onReset={() => { resetProp(element, "filter"); setFilterItems(parseFilterItems(getComputedStyle(element).filter)); }}
/>
{filterItems.length > 0 && (
  <div style={{ padding: "4px 12px" }}>
    <FilterEditor items={filterItems} onChange={handleFiltersChange} type="filter" />
  </div>
)}

{/* 8. Backdrop filters */}
<SubSectionHeader
  label="Backdrop filters"
  onAdd={() => handleBackdropFiltersChange([...backdropFilterItems, { type: "blur", values: [0], visible: true, expanded: true }])}
  indicator={ind("backdrop-filter")}
  onReset={() => { resetProp(element, "backdrop-filter"); const fresh = getComputedStyle(element); setBackdropFilterItems(parseFilterItems(fresh.getPropertyValue("backdrop-filter") || fresh.getPropertyValue("-webkit-backdrop-filter") || "")); }}
/>
{backdropFilterItems.length > 0 && (
  <div style={{ padding: "4px 12px" }}>
    <FilterEditor items={backdropFilterItems} onChange={handleBackdropFiltersChange} type="backdrop-filter" />
  </div>
)}
```

**Step 2: Remove legacy parseFilter/filterToCSS from cssParsers.ts**

Delete the old `parseFilter` function (lines 88-104), the `FILTER_DEFAULTS` constant (lines 106-115), and the old `filterToCSS` function (lines 117-128). Update the import line to only import from FilterSliders what's needed:

```ts
import type { FilterItem, FilterType } from "./sections/FilterSliders";
```

Remove the `FilterValues` import entirely.

**Step 3: Update backdropFilterRemove.test.ts**

Replace the test to use the new API:

```ts
import { describe, it, expect } from "vitest";
import { filterItemsToCSS } from "../cssParsers";
import type { FilterItem } from "../sections/FilterSliders";

describe("backdrop-filter remove via ×", () => {
  it("filterItemsToCSS returns 'none' for empty array", () => {
    expect(filterItemsToCSS([])).toBe("none");
  });

  it("filterItemsToCSS returns 'none' when all items hidden", () => {
    const items: FilterItem[] = [
      { type: "blur", values: [5], visible: false, expanded: false },
    ];
    expect(filterItemsToCSS(items)).toBe("none");
  });

  it("filterItemsToCSS includes only visible items", () => {
    const items: FilterItem[] = [
      { type: "blur", values: [5], visible: true, expanded: false },
      { type: "contrast", values: [80], visible: false, expanded: false },
    ];
    expect(filterItemsToCSS(items)).toBe("blur(5px)");
  });
});
```

**Step 4: Remove old parseFilter/filterToCSS tests from cssParsers.test.ts**

Delete the old `describe("parseFilter", ...)` and `describe("filterToCSS", ...)` blocks. The new `parseFilterItems`/`filterItemsToCSS` tests from Task 1 remain.

**Step 5: Remove legacy re-exports from FilterSliders.tsx**

At the bottom of `src/overlay/sections/FilterSliders.tsx`, delete:
- The deprecated `FilterValues` interface
- The `FilterSliders` alias

**Step 6: Run all tests**

Run: `npm test -- --run`
Expected: ALL PASS

**Step 7: Commit**

```
feat: wire FilterEditor into EffectsSection, remove legacy filter API
```

---

### Task 4: Update ancillary references

**Files:**
- Modify: `src/overlay/__tests__/reset-audit.test.ts` (update file name reference if needed)
- Modify: `src/overlay/__tests__/effectsSection.test.ts` (remove old FilterValues references)
- Modify: `src/overlay/DIRECTORY.md` (update FilterSliders description)

**Step 1: Update reset-audit.test.ts**

The file references `"FilterSliders.tsx"` by name — keep as-is since the filename doesn't change. Verify no code reads `FilterValues` or `FILTER_META` from the old API.

**Step 2: Update DIRECTORY.md**

Change the Effects section row for FilterSliders:

```
| `EffectsSection.tsx` | Effects (shadow, transform, transition, filter) | `ShadowEditor.tsx`, `TransformEditor.tsx`, `TransformOriginPicker.tsx`, `TransitionEditor.tsx`, `BezierEditor.tsx`, `FilterSliders.tsx` |
```

No change needed — filename stays the same. But update the comment in DIRECTORY.md controls table if `VisibilityToggle` or `EditorRemoveButton` usage lists changed.

**Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: ALL PASS

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Commit**

```
chore: update ancillary references for filter redesign
```

---

### Task 5: Build verification

**Step 1: Run build**

Run: `npm run build`
Expected: Clean build, no errors

**Step 2: Run full test suite one more time**

Run: `npm test -- --run`
Expected: ALL PASS

**Step 3: Visual verification**

Open `http://localhost:3000/demo` in browser. Select an element, go to Effects section. Verify:
- "+" on Filters opens categorized dropdown with General / Color Adjustments / Color Effects
- Adding "Blur" creates a collapsible card with summary "Blur: 0px"
- Clicking the card expands it to show type dropdown + Radius slider
- Drag handle reorders filter items
- Eye toggle hides/shows individual filters
- × removes individual filters
- Drop shadow shows X/Y/Blur sliders + color picker
- Backdrop filters section works identically

**Step 4: Final commit if any visual fixes needed**

```
fix: filter editor visual polish
```
