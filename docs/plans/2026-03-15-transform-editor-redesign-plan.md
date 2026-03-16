# Transform Editor Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the TransformEditor to match Webflow's 2D & 3D transforms UI — summary pills, tabbed type-switching editor with per-axis sliders, scale lock, and a grouped Transform Settings panel.

**Architecture:** The existing `TransformEditor.tsx` (430 lines) is replaced entirely. The new editor is composed of internal sub-components: `TransformPill` (collapsed), `TransformExpanded` (tabbed editor), and `TransformSettings` (origin, backface, perspectives). The `TransformOriginPicker` gains Left/Top numeric inputs. CSS parsers expand to handle `scale3d`, `rotateX/Y/Z`, and `perspective()`. The Perspective and Backface controls move from EffectsSection into the TransformEditor.

**Tech Stack:** React (inline styles), existing controls (`SliderRow`, `SegmentedControl`, `ValueInput`), existing hooks (`useDragReorder`), Vitest

**Design doc:** `docs/plans/2026-03-15-transform-editor-redesign-design.md`

---

### Task 1: Update CSS parsers — parse new 3D transform functions

**Files:**
- Modify: `src/overlay/cssParsers.ts:130-185` (parseTransform + transformToCSS)
- Test: `src/overlay/__tests__/cssParsers.test.ts:227-317`

**Step 1: Write failing tests for new parse cases**

Add these test cases to the `parseTransform` describe block in `src/overlay/__tests__/cssParsers.test.ts`:

```ts
it("parses scale3d", () => {
  const result = parseTransform("scale3d(1.5, 2, 0.5)");
  expect(result[0]).toMatchObject({ type: "scale", x: 1.5, y: 2, z: 0.5 });
});

it("parses rotateX", () => {
  const result = parseTransform("rotateX(45deg)");
  expect(result[0]).toMatchObject({ type: "rotate", x: 45, y: 0, z: 0 });
});

it("parses rotateY", () => {
  const result = parseTransform("rotateY(30deg)");
  expect(result[0]).toMatchObject({ type: "rotate", x: 0, y: 30, z: 0 });
});

it("parses rotateZ", () => {
  const result = parseTransform("rotateZ(90deg)");
  expect(result[0]).toMatchObject({ type: "rotate", x: 0, y: 0, z: 90 });
});

it("merges multiple rotateX/Y/Z into one TransformValue", () => {
  const result = parseTransform("rotateX(10deg) rotateY(20deg) rotateZ(30deg)");
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ type: "rotate", x: 10, y: 20, z: 30 });
});

it("parses perspective() from transform string", () => {
  const result = parseTransform("perspective(500px) rotateY(30deg)");
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ type: "rotate", x: 0, y: 30, z: 0 });
});

it("extracts selfPerspective via parseSelfPerspective", () => {
  expect(parseSelfPerspective("perspective(500px) rotateY(30deg)")).toBe(500);
});

it("returns 0 for parseSelfPerspective when no perspective()", () => {
  expect(parseSelfPerspective("rotateY(30deg)")).toBe(0);
});
```

Add these to the `transformToCSS` describe block:

```ts
it("serializes scale3d with z", () => {
  expect(transformToCSS([{ type: "scale", x: 1.5, y: 2, z: 0.5 }])).toBe(
    "scale3d(1.5, 2, 0.5)"
  );
});

it("serializes scale without z (z=1 or undefined)", () => {
  expect(transformToCSS([{ type: "scale", x: 2, y: 1.5 }])).toBe("scale(2, 1.5)");
  expect(transformToCSS([{ type: "scale", x: 2, y: 1.5, z: 1 }])).toBe("scale(2, 1.5)");
});

it("serializes rotate with Y and Z axes", () => {
  expect(transformToCSS([{ type: "rotate", x: 10, y: 20, z: 30 }])).toBe(
    "rotateX(10deg) rotateY(20deg) rotateZ(30deg)"
  );
});

it("serializes rotate Z-only as rotateZ (not rotate())", () => {
  expect(transformToCSS([{ type: "rotate", x: 0, y: 0, z: 45 }])).toBe("rotateZ(45deg)");
});

it("serializes rotate X-only with no Y/Z", () => {
  expect(transformToCSS([{ type: "rotate", x: 45, y: 0, z: 0 }])).toBe("rotateX(45deg)");
  expect(transformToCSS([{ type: "rotate", x: 45, y: 0 }])).toBe("rotateX(45deg)");
});

it("prepends perspective() via transformToCSSWithPerspective", () => {
  expect(transformToCSSWithPerspective([{ type: "rotate", x: 0, y: 30, z: 0 }], 500)).toBe(
    "perspective(500px) rotateY(30deg)"
  );
});

it("skips perspective(0) prefix", () => {
  expect(transformToCSSWithPerspective([{ type: "rotate", x: 0, y: 30, z: 0 }], 0)).toBe(
    "rotateY(30deg)"
  );
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/overlay/__tests__/cssParsers.test.ts`
Expected: Multiple failures (new functions not yet defined, parse logic missing)

**Step 3: Update parseTransform in cssParsers.ts**

In `src/overlay/cssParsers.ts`, replace the `parseTransform` and `transformToCSS` functions, and add two new exports:

```ts
// ─── Transform ───────────────────────────────────────────────────────

/**
 * Extract the self-perspective value from a transform string.
 * Returns 0 if no perspective() function is present.
 */
export function parseSelfPerspective(raw: string): number {
  const m = raw.match(/perspective\(([^)]+)\)/);
  if (!m) return 0;
  return parseFloat(m[1]) || 0;
}

export function parseTransform(raw: string): TransformValue[] {
  if (!raw || raw === "none") return [];
  const transforms: TransformValue[] = [];

  // Match all transform functions
  const regex = /(perspective|translate3d|translate|scale3d|scale|rotateX|rotateY|rotateZ|rotate|skew)\(([^)]+)\)/g;
  let m;
  // Accumulator for merging rotateX/Y/Z into a single rotate entry
  let rotateAccum: { x: number; y: number; z: number } | null = null;

  while ((m = regex.exec(raw)) !== null) {
    const fn = m[1];
    const args = m[2].split(",").map((s) => parseFloat(s.trim()));

    if (fn === "perspective") {
      // Self-perspective — extracted separately via parseSelfPerspective, skip here
      continue;
    } else if (fn === "translate3d" || fn === "translate") {
      transforms.push({ type: "translate", x: args[0] ?? 0, y: args[1] ?? 0, z: args[2] ?? 0 });
    } else if (fn === "scale3d") {
      transforms.push({ type: "scale", x: args[0] ?? 1, y: args[1] ?? 1, z: args[2] ?? 1 });
    } else if (fn === "scale") {
      transforms.push({ type: "scale", x: args[0] ?? 1, y: args[1] ?? args[0] ?? 1 });
    } else if (fn === "rotateX") {
      if (!rotateAccum) rotateAccum = { x: 0, y: 0, z: 0 };
      rotateAccum.x = args[0] ?? 0;
    } else if (fn === "rotateY") {
      if (!rotateAccum) rotateAccum = { x: 0, y: 0, z: 0 };
      rotateAccum.y = args[0] ?? 0;
    } else if (fn === "rotateZ") {
      if (!rotateAccum) rotateAccum = { x: 0, y: 0, z: 0 };
      rotateAccum.z = args[0] ?? 0;
    } else if (fn === "rotate") {
      // Legacy 2D rotate(Xdeg) — treat as Z rotation
      if (!rotateAccum) rotateAccum = { x: 0, y: 0, z: 0 };
      rotateAccum.z = args[0] ?? 0;
    } else if (fn === "skew") {
      transforms.push({ type: "skew", x: args[0] ?? 0, y: args[1] ?? 0 });
    }
  }

  // Flush accumulated rotation
  if (rotateAccum) {
    transforms.push({ type: "rotate", x: rotateAccum.x, y: rotateAccum.y, z: rotateAccum.z });
  }

  // Handle matrix() — extract rough rotation from a 2D matrix
  if (transforms.length === 0 && raw.startsWith("matrix(")) {
    const nums = raw.match(/matrix\(([^)]+)\)/)?.[1]?.split(",").map(Number);
    if (nums && nums.length >= 6) {
      const angle = Math.round(Math.atan2(nums[1], nums[0]) * (180 / Math.PI));
      const scaleX = Math.sqrt(nums[0] * nums[0] + nums[1] * nums[1]);
      const scaleY = Math.sqrt(nums[2] * nums[2] + nums[3] * nums[3]);
      if (Math.abs(angle) > 0.5) transforms.push({ type: "rotate", x: 0, y: 0, z: angle });
      if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
        transforms.push({ type: "scale", x: Math.round(scaleX * 100) / 100, y: Math.round(scaleY * 100) / 100 });
      }
      if (Math.abs(nums[4]) > 0.5 || Math.abs(nums[5]) > 0.5) {
        transforms.push({ type: "translate", x: Math.round(nums[4]), y: Math.round(nums[5]) });
      }
    }
  }
  return transforms;
}

export function transformToCSS(transforms: TransformValue[]): string {
  if (transforms.length === 0) return "none";
  return transforms
    .map((t) => {
      switch (t.type) {
        case "translate":
          return t.z ? `translate3d(${t.x}px, ${t.y}px, ${t.z}px)` : `translate(${t.x}px, ${t.y}px)`;
        case "scale":
          return (t.z !== undefined && t.z !== 1)
            ? `scale3d(${t.x}, ${t.y}, ${t.z})`
            : `scale(${t.x}, ${t.y})`;
        case "rotate": {
          const parts: string[] = [];
          if (t.x) parts.push(`rotateX(${t.x}deg)`);
          if (t.y) parts.push(`rotateY(${t.y}deg)`);
          if (t.z ?? 0) parts.push(`rotateZ(${t.z}deg)`);
          // If all zero, still emit rotateZ(0deg) for roundtrip
          if (parts.length === 0) parts.push(`rotateX(${t.x}deg)`);
          return parts.join(" ");
        }
        case "skew":
          return `skew(${t.x}deg, ${t.y}deg)`;
      }
    })
    .join(" ");
}

/**
 * Like transformToCSS but prepends perspective(Npx) when selfPerspective > 0.
 */
export function transformToCSSWithPerspective(transforms: TransformValue[], selfPerspective: number): string {
  const base = transformToCSS(transforms);
  if (selfPerspective > 0 && base !== "none") {
    return `perspective(${selfPerspective}px) ${base}`;
  }
  return base;
}
```

**Important:** The existing `parseTransform` regex `rotate(...)` will now be caught by specific `rotateX/Y/Z` branches first since they appear earlier in the regex alternation. The legacy `rotate()` still works as a Z-rotation fallback. Also, update the existing matrix fallback to use `z` for rotation instead of `x` to match the new 3-axis model.

**Step 4: Update the test for matrix rotation to use z axis**

The existing matrix test expects `result[0].x` to be 45 for rotation. With the new model, matrix rotation maps to `z`. Update:

```ts
it("extracts rotation from matrix()", () => {
  const cos45 = Math.cos(Math.PI / 4);
  const sin45 = Math.sin(Math.PI / 4);
  const result = parseTransform(
    `matrix(${cos45}, ${sin45}, ${-sin45}, ${cos45}, 0, 0)`
  );
  expect(result).toHaveLength(1);
  expect(result[0].type).toBe("rotate");
  expect(result[0].z).toBe(45);
});
```

And the existing `serializes rotate` test:

```ts
it("serializes rotate (legacy x-only becomes rotateX)", () => {
  expect(transformToCSS([{ type: "rotate", x: 45, y: 0 }])).toBe("rotateX(45deg)");
});
```

**Step 5: Update import in test file**

Add `parseSelfPerspective` and `transformToCSSWithPerspective` to the import at the top of `cssParsers.test.ts`.

**Step 6: Run all tests to verify they pass**

Run: `npm test -- src/overlay/__tests__/cssParsers.test.ts`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/overlay/cssParsers.ts src/overlay/__tests__/cssParsers.test.ts
git commit -m "feat(transforms): update CSS parsers for 3D rotate, scale3d, self-perspective"
```

---

### Task 2: Update TransformValue interface and defaults

**Files:**
- Modify: `src/overlay/sections/TransformEditor.tsx:15-52` (interface + constants)

**Step 1: Update the TransformValue interface**

```ts
export interface TransformValue {
  type: "translate" | "scale" | "rotate" | "skew";
  x: number;
  y: number;
  z?: number;           // translate, scale, rotate (not skew)
  scaleLocked?: boolean; // scale only — uniform X/Y/Z lock
}
```

Add `scaleLocked` to the interface. The `z` field is already there.

**Step 2: Update TRANSFORM_DEFAULTS**

```ts
const TRANSFORM_DEFAULTS: Record<TransformType, TransformValue> = {
  translate: { type: "translate", x: 0, y: 0, z: 0 },
  scale: { type: "scale", x: 1, y: 1, z: 1, scaleLocked: true },
  rotate: { type: "rotate", x: 0, y: 0, z: 0 },
  skew: { type: "skew", x: 0, y: 0 },
};
```

**Step 3: Update TRANSFORM_RANGES — add specific axis ranges**

```ts
const TRANSFORM_RANGES: Record<TransformType, { min: number; max: number; step: number }> = {
  translate: { min: -500, max: 500, step: 1 },
  scale: { min: 0, max: 5, step: 0.01 },
  rotate: { min: -360, max: 360, step: 1 },
  skew: { min: -90, max: 90, step: 1 },
};
```

(Scale step changed from 0.1 to 0.01 for finer control with sliders.)

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no downstream breakage — `scaleLocked` is optional)

**Step 5: Commit**

```bash
git add src/overlay/sections/TransformEditor.tsx
git commit -m "feat(transforms): update TransformValue interface and defaults for 3D"
```

---

### Task 3: Update TransformOriginPicker — add Left/Top numeric inputs

**Files:**
- Modify: `src/overlay/sections/TransformOriginPicker.tsx`
- Test: `src/overlay/__tests__/cssParsers.test.ts` (add origin parsing tests if needed)

**Step 1: Update TransformOriginPickerProps**

Add props for Left/Top percentage values and an optional `compact` flag:

```ts
export interface TransformOriginPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** When true, show Left/Top numeric inputs alongside the grid */
  showInputs?: boolean;
}
```

**Step 2: Add percentage extraction helper**

Add this helper inside TransformOriginPicker.tsx:

```ts
/** Parse CSS origin value to [leftPct, topPct]. Returns [50, 50] for unparseable. */
function originToPercents(value: string): [number, number] {
  if (!value) return [50, 50];
  const parts = value.trim().split(/\s+/);

  const tokenToPct = (t: string): number => {
    if (t === "left" || t === "top") return 0;
    if (t === "center") return 50;
    if (t === "right" || t === "bottom") return 100;
    const pct = parseFloat(t);
    if (!isNaN(pct)) return pct;
    return 50;
  };

  if (parts.length === 1) {
    const v = tokenToPct(parts[0]);
    return [v, v];
  }
  if (parts.length >= 2) {
    return [tokenToPct(parts[0]), tokenToPct(parts[1])];
  }
  return [50, 50];
}
```

**Step 3: Update the component to render Left/Top inputs when showInputs is true**

After the existing grid `<div>`, conditionally render:

```tsx
export function TransformOriginPicker({ value, onChange, showInputs }: TransformOriginPickerProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeCol, activeRow] = parseOrigin(value);
  const [leftPct, topPct] = originToPercents(value);

  const handleClick = useCallback(
    (origin: string) => onChange(origin),
    [onChange],
  );

  const handleLeftChange = useCallback(
    (v: number) => onChange(`${v}% ${topPct}%`),
    [topPct, onChange],
  );

  const handleTopChange = useCallback(
    (v: number) => onChange(`${leftPct}% ${v}%`),
    [leftPct, onChange],
  );

  return (
    <div style={{ display: "flex", alignItems: showInputs ? "flex-start" : "center", gap: 8 }}>
      {/* 3x3 grid — unchanged */}
      <div style={{ /* existing grid styles */ }}>
        {/* existing grid cells */}
      </div>

      {/* Left/Top numeric inputs */}
      {showInputs && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <OriginInput label="Left" value={leftPct} onChange={handleLeftChange} />
          <OriginInput label="Top" value={topPct} onChange={handleTopChange} />
        </div>
      )}
    </div>
  );
}
```

**Step 4: Add the OriginInput helper component**

Add this at the bottom of TransformOriginPicker.tsx:

```tsx
function OriginInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(Math.round(value)));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(Math.min(100, Math.max(0, parsed)));
  }, [draft, onChange]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 10, fontFamily: font.sans, color: text.label, width: 24 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", height: 24, borderRadius: 3, border: `1px solid ${border.default}`, background: surface.subtle }}>
        <input
          value={focused ? draft : String(Math.round(value))}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); }
            else if (e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(100, value + 1)); }
            else if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, value - 1)); }
          }}
          style={{
            width: 36, background: "transparent", border: "none", color: text.secondary,
            fontSize: 10, fontFamily: font.mono, textAlign: "center", padding: "2px", outline: "none",
          }}
        />
        <span style={{ fontSize: 9, color: text.label, paddingRight: 4 }}>%</span>
      </div>
    </div>
  );
}
```

**Step 5: Add required imports**

Add `useEffect` to the import from "react", and import `font, text, border, surface` from `../theme`.

**Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add src/overlay/sections/TransformOriginPicker.tsx
git commit -m "feat(transforms): add Left/Top numeric inputs to TransformOriginPicker"
```

---

### Task 4: Build TransformPill — collapsed summary row

**Files:**
- Modify: `src/overlay/sections/TransformEditor.tsx` (add TransformPill component)

**Step 1: Add transform type icons**

Add icon SVGs at the top of TransformEditor.tsx (below imports). These are small inline SVGs matching Webflow's transform type icons:

```tsx
const TRANSFORM_ICONS: Record<TransformType, React.ReactNode> = {
  translate: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M7 2v10M2 7h10M4 4l3-2 3 2M4 10l3 2 3-2M10 4l2 3-2 3M4 4L2 7l2 3" />
    </svg>
  ),
  scale: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2" y="2" width="10" height="10" rx="1" />
      <rect x="5" y="5" width="4" height="4" rx="0.5" />
    </svg>
  ),
  rotate: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M11.5 7A4.5 4.5 0 1 1 7 2.5" />
      <path d="M7 2.5L9 1v3H7" />
    </svg>
  ),
  skew: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M4 12L6 2h4L8 12H4z" />
    </svg>
  ),
};
```

**Step 2: Add summary text formatter**

```tsx
function formatTransformSummary(t: TransformValue): string {
  const { type, x, y, z } = t;
  switch (type) {
    case "translate":
      return `Move: ${x}px, ${y}px, ${z ?? 0}px`;
    case "scale":
      return z !== undefined ? `Scale: ${x}, ${y}, ${z}` : `Scale: ${x}, ${y}`;
    case "rotate":
      return `Rotate: ${x}deg, ${y}deg, ${z ?? 0}deg`;
    case "skew":
      return `Skew: ${x}deg, ${y}deg`;
  }
}
```

**Step 3: Build TransformPill component**

```tsx
function TransformPill({
  transform,
  isExpanded,
  onClick,
  onRemove,
  dragHandleProps,
  isDragging,
}: {
  transform: TransformValue;
  isExpanded: boolean;
  onClick: () => void;
  onRemove: () => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
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
        gap: 6,
        padding: "6px 8px",
        background: isExpanded ? blackAlpha(0.05) : hovered ? blackAlpha(0.03) : blackAlpha(0.02),
        borderRadius: 4,
        cursor: "pointer",
        transition: `background ${ms("fast")} ease`,
      }}
    >
      {dragHandleProps && (
        <div onClick={(e) => e.stopPropagation()}>
          <DragHandle isDragging={isDragging} onPointerDown={dragHandleProps.onPointerDown} style={{ alignSelf: "center" }} />
        </div>
      )}

      <span style={{ color: text.label, flexShrink: 0, display: "flex" }}>
        {TRANSFORM_ICONS[transform.type]}
      </span>

      <span style={{ fontSize: 11, fontFamily: font.sans, color: text.primary, flex: 1 }}>
        {formatTransformSummary(transform)}
      </span>

      {(hovered || isExpanded) && (
        <div onClick={(e) => e.stopPropagation()}>
          <EditorRemoveButton onClick={onRemove} />
        </div>
      )}
    </div>
  );
}
```

**Step 4: Import `ms` from timing**

Add `import { ms } from "../timing";` to the existing imports at the top of TransformEditor.tsx.

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/overlay/sections/TransformEditor.tsx
git commit -m "feat(transforms): add TransformPill collapsed summary component"
```

---

### Task 5: Build TransformExpanded — tabbed editor with sliders

**Files:**
- Modify: `src/overlay/sections/TransformEditor.tsx`

This is the main editing UI shown when a pill is expanded. It contains:
- A SegmentedControl tab bar (Move / Scale / Rotate / Skew) for type switching
- Per-axis slider rows (X, Y, Z where applicable)
- A scale lock toggle button for the Scale type

**Step 1: Add the scale lock icon**

```tsx
function LockIcon({ locked }: { locked: boolean }) {
  return locked ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="3" y="6" width="8" height="6" rx="1" />
      <path d="M5 6V4a2 2 0 0 1 4 0v2" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="3" y="6" width="8" height="6" rx="1" />
      <path d="M5 6V4a2 2 0 0 1 4 0" />
    </svg>
  );
}
```

**Step 2: Build the TransformExpanded component**

```tsx
import { SegmentedControl, type SegmentOption } from "../controls/SegmentedControl";
import { Slider } from "@/components/ui/slider";
import { beginBatch, endBatch } from "../core/apply";

const TYPE_TABS: SegmentOption[] = [
  { value: "translate", label: "Move" },
  { value: "scale", label: "Scale" },
  { value: "rotate", label: "Rotate" },
  { value: "skew", label: "Skew" },
];

function TransformExpanded({
  transform,
  onUpdate,
  onTypeChange,
}: {
  transform: TransformValue;
  onUpdate: (field: "x" | "y" | "z" | "scaleLocked", value: number | boolean) => void;
  onTypeChange: (newType: TransformType) => void;
}) {
  const { type, x, y, z, scaleLocked } = transform;
  const range = TRANSFORM_RANGES[type];
  const hasZ = type !== "skew";
  const unit = getUnit(type, "x");
  const locked = type === "scale" && (scaleLocked ?? true);

  const handleAxisChange = useCallback(
    (axis: "x" | "y" | "z", value: number) => {
      if (locked && type === "scale") {
        // Uniform scale: set all axes to the same value
        onUpdate("x", value);
        onUpdate("y", value);
        if (hasZ) onUpdate("z", value);
      } else {
        onUpdate(axis, value);
      }
    },
    [locked, type, hasZ, onUpdate],
  );

  const toggleLock = useCallback(() => {
    onUpdate("scaleLocked", !scaleLocked);
  }, [scaleLocked, onUpdate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 0 2px" }}>
      {/* Type tab bar */}
      <div style={{ padding: "0 8px" }}>
        <SegmentedControl
          options={TYPE_TABS}
          value={type}
          onChange={(v) => onTypeChange(v as TransformType)}
          aria-label="Transform type"
        />
      </div>

      {/* Axis rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <AxisSliderRow label="X" value={x} range={range} unit={unit} onChange={(v) => handleAxisChange("x", v)} />
        <AxisSliderRow label="Y" value={y} range={range} unit={unit} onChange={(v) => handleAxisChange("y", v)} />
        {hasZ && (
          <AxisSliderRow label="Z" value={z ?? (type === "scale" ? 1 : 0)} range={range} unit={unit} onChange={(v) => handleAxisChange("z", v)} />
        )}
      </div>

      {/* Scale lock */}
      {type === "scale" && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 8px" }}>
          <button
            onClick={toggleLock}
            title={locked ? "Unlock axes" : "Lock axes (uniform scale)"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              color: locked ? color.primary : text.disabled,
              display: "flex",
              alignItems: "center",
              transition: `color ${ms("fast")} ease`,
            }}
          >
            <LockIcon locked={locked} />
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Build the AxisSliderRow helper**

This is a compact per-axis row with label + slider + input + unit, designed for the transform expanded area:

```tsx
function AxisSliderRow({
  label,
  value,
  range,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  range: { min: number; max: number; step: number };
  unit: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(Math.min(range.max, Math.max(range.min, parsed)));
  }, [draft, range.min, range.max, onChange]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 8px", height: 28 }}>
      {/* Axis label */}
      <span style={{ fontSize: 10, fontFamily: font.sans, color: text.disabled, width: 12, flexShrink: 0, textAlign: "center" }}>
        {label}
      </span>

      {/* Slider */}
      <Slider
        className="tuner-focusable"
        style={{ flex: 1 }}
        aria-label={`${label}: ${value}${unit}`}
        min={range.min}
        max={range.max}
        step={range.step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onPointerDown={() => beginBatch()}
        onPointerUp={() => endBatch()}
      />

      {/* Numeric input + unit */}
      <div style={{ display: "flex", alignItems: "center", height: 24, borderRadius: 3, border: `1px solid ${border.default}`, background: surface.subtle, flexShrink: 0 }}>
        <input
          value={focused ? draft : String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); }
            else if (e.key === "ArrowUp") { e.preventDefault(); const inc = e.shiftKey ? range.step * 10 : range.step; onChange(Math.min(range.max, Math.round((value + inc) * 1000) / 1000)); }
            else if (e.key === "ArrowDown") { e.preventDefault(); const inc = e.shiftKey ? range.step * 10 : range.step; onChange(Math.max(range.min, Math.round((value - inc) * 1000) / 1000)); }
          }}
          style={{
            width: 40, background: "transparent", border: "none", color: text.secondary,
            fontSize: 10, fontFamily: font.mono, textAlign: "center", padding: "2px", outline: "none",
          }}
        />
        {unit && (
          <span style={{ fontSize: 9, color: text.label, paddingRight: 4, textTransform: "uppercase" }}>{unit}</span>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/overlay/sections/TransformEditor.tsx
git commit -m "feat(transforms): add TransformExpanded tabbed editor with per-axis sliders"
```

---

### Task 6: Build TransformSettings — origin, backface, perspectives

**Files:**
- Modify: `src/overlay/sections/TransformEditor.tsx`

**Step 1: Define the TransformSettings props**

```ts
interface TransformSettingsProps {
  origin: string;
  onOriginChange: (v: string) => void;
  backfaceVisibility: string;
  onBackfaceChange: (v: string) => void;
  selfPerspective: number;
  onSelfPerspectiveChange: (v: number) => void;
  childrenPerspective: number;
  onChildrenPerspectiveChange: (v: number) => void;
  perspectiveOrigin: string;
  onPerspectiveOriginChange: (v: string) => void;
}
```

**Step 2: Build TransformSettings component**

```tsx
function TransformSettings({
  origin, onOriginChange,
  backfaceVisibility, onBackfaceChange,
  selfPerspective, onSelfPerspectiveChange,
  childrenPerspective, onChildrenPerspectiveChange,
  perspectiveOrigin, onPerspectiveOriginChange,
}: TransformSettingsProps) {
  const BACKFACE_TABS: SegmentOption[] = [
    { value: "visible", label: "Visible" },
    { value: "hidden", label: "Hidden" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
      {/* Section label */}
      <span style={{ ...SUB_HEADER, padding: "0 12px" }}>Transform settings</span>

      {/* Origin */}
      <div style={{ ...ROW, alignItems: "flex-start" }}>
        <span style={{ ...LABEL, paddingTop: 4 }}>Origin</span>
        <TransformOriginPicker value={origin} onChange={onOriginChange} showInputs />
      </div>

      {/* Backface */}
      <div style={ROW}>
        <span style={LABEL}>Backface</span>
        <SegmentedControl options={BACKFACE_TABS} value={backfaceVisibility} onChange={onBackfaceChange} aria-label="Backface visibility" />
      </div>

      {/* Self perspective */}
      <span style={{ ...SUB_HEADER, padding: "4px 12px 0" }}>Self perspective</span>
      <SliderRow label="Distance" value={selfPerspective} min={0} max={2000} step={1} unit="px" onChange={onSelfPerspectiveChange} />

      {/* Children perspective */}
      <span style={{ ...SUB_HEADER, padding: "4px 12px 0" }}>Children perspective</span>
      <SliderRow label="Distance" value={childrenPerspective} min={0} max={2000} step={1} unit="px" onChange={onChildrenPerspectiveChange} />

      {/* Children perspective origin */}
      <div style={{ ...ROW, alignItems: "flex-start" }}>
        <span style={{ ...LABEL, paddingTop: 4 }}>Origin</span>
        <TransformOriginPicker value={perspectiveOrigin} onChange={onPerspectiveOriginChange} showInputs />
      </div>
    </div>
  );
}
```

**Step 3: Add required imports at top of file**

```ts
import { SliderRow } from "../controls";
import { SegmentedControl, type SegmentOption } from "../controls/SegmentedControl";
import { ROW, LABEL, SUB_HEADER } from "../panelStyles";
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/overlay/sections/TransformEditor.tsx
git commit -m "feat(transforms): add TransformSettings sub-panel component"
```

---

### Task 7: Rewrite TransformEditor orchestrator

**Files:**
- Modify: `src/overlay/sections/TransformEditor.tsx`

This is the main component rewrite. It replaces the old `TransformEditor` export with the new orchestrator that renders pills, expanded editors, the add dropdown, and the settings panel.

**Step 1: Update TransformEditorProps**

```ts
export interface TransformEditorProps {
  transforms: TransformValue[];
  onChange: (transforms: TransformValue[]) => void;
  origin: string;
  onOriginChange: (origin: string) => void;
  // New props for settings panel
  backfaceVisibility: string;
  onBackfaceChange: (v: string) => void;
  selfPerspective: number;
  onSelfPerspectiveChange: (v: number) => void;
  childrenPerspective: number;
  onChildrenPerspectiveChange: (v: number) => void;
  perspectiveOrigin: string;
  onPerspectiveOriginChange: (v: string) => void;
}
```

**Step 2: Rewrite the TransformEditor function**

Replace the existing `TransformEditor` function body entirely:

```tsx
export function TransformEditor({
  transforms, onChange,
  origin, onOriginChange,
  backfaceVisibility, onBackfaceChange,
  selfPerspective, onSelfPerspectiveChange,
  childrenPerspective, onChildrenPerspectiveChange,
  perspectiveOrigin, onPerspectiveOriginChange,
}: TransformEditorProps) {
  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(transforms, onChange);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  // Close add dropdown on outside click
  useEffect(() => {
    if (!addDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setAddDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addDropdownOpen]);

  const handleAdd = useCallback(
    (type: TransformType) => {
      const newTransform = { ...TRANSFORM_DEFAULTS[type] };
      onChange([...transforms, newTransform]);
      setExpandedIndex(transforms.length); // Auto-expand the new one
      setAddDropdownOpen(false);
    },
    [transforms, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(transforms.filter((_, i) => i !== index));
      if (expandedIndex === index) setExpandedIndex(null);
      else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
    },
    [transforms, onChange, expandedIndex],
  );

  const handleUpdate = useCallback(
    (index: number, field: "x" | "y" | "z" | "scaleLocked", value: number | boolean) => {
      const next = transforms.map((t, i) => {
        if (i !== index) return t;
        return { ...t, [field]: value };
      });
      onChange(next);
    },
    [transforms, onChange],
  );

  const handleTypeChange = useCallback(
    (index: number, newType: TransformType) => {
      const next = transforms.map((t, i) => {
        if (i !== index) return t;
        // Preserve position in list, reset values to defaults for new type
        return { ...TRANSFORM_DEFAULTS[newType] };
      });
      onChange(next);
    },
    [transforms, onChange],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Transform pills list */}
      <div style={{ position: "relative" }}>
        {transforms.map((t, index) => {
          const dragProps = handleProps(index);
          const isExpanded = expandedIndex === index;
          return (
            <div key={index} ref={registerRef(index)} style={{ ...itemStyle(index), marginBottom: 4 }}>
              <TransformPill
                transform={t}
                isExpanded={isExpanded}
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                onRemove={() => handleRemove(index)}
                dragHandleProps={dragProps}
                isDragging={isDragging}
              />
              {isExpanded && (
                <TransformExpanded
                  transform={t}
                  onUpdate={(field, value) => handleUpdate(index, field, value)}
                  onTypeChange={(newType) => handleTypeChange(index, newType)}
                />
              )}
            </div>
          );
        })}
        {(() => {
          const style = dropLineStyle();
          return style ? <div style={style} /> : null;
        })()}
      </div>

      {/* Add dropdown — only shown when triggered by SubSectionHeader "+" */}
      {/* The "+" and "..." buttons are on SubSectionHeader in EffectsSection */}

      {/* Settings panel — toggled by "..." */}
      {settingsOpen && (
        <TransformSettings
          origin={origin}
          onOriginChange={onOriginChange}
          backfaceVisibility={backfaceVisibility}
          onBackfaceChange={onBackfaceChange}
          selfPerspective={selfPerspective}
          onSelfPerspectiveChange={onSelfPerspectiveChange}
          childrenPerspective={childrenPerspective}
          onChildrenPerspectiveChange={onChildrenPerspectiveChange}
          perspectiveOrigin={perspectiveOrigin}
          onPerspectiveOriginChange={onPerspectiveOriginChange}
        />
      )}
    </div>
  );
}
```

**Important:** The add dropdown and settings toggle are actually controlled by `SubSectionHeader`'s `onAdd` and `onMenu` in EffectsSection. So TransformEditor needs to expose `settingsOpen` / `setSettingsOpen`. The simplest approach: accept `settingsOpen` as a prop and let EffectsSection control it.

Update the props:

```ts
export interface TransformEditorProps {
  transforms: TransformValue[];
  onChange: (transforms: TransformValue[]) => void;
  origin: string;
  onOriginChange: (origin: string) => void;
  backfaceVisibility: string;
  onBackfaceChange: (v: string) => void;
  selfPerspective: number;
  onSelfPerspectiveChange: (v: number) => void;
  childrenPerspective: number;
  onChildrenPerspectiveChange: (v: number) => void;
  perspectiveOrigin: string;
  onPerspectiveOriginChange: (v: string) => void;
  settingsOpen: boolean;
}
```

**Step 3: Delete the old TransformCard, AxisLabel, UnitLabel, and AxisInput components**

These are all replaced by TransformPill, TransformExpanded, and AxisSliderRow. Remove them entirely.

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: FAIL on EffectsSection.tsx (new props not passed yet — fixed in Task 8)

**Step 5: Commit**

```bash
git add src/overlay/sections/TransformEditor.tsx
git commit -m "feat(transforms): rewrite TransformEditor orchestrator with pills and settings"
```

---

### Task 8: Update EffectsSection integration

**Files:**
- Modify: `src/overlay/sections/EffectsSection.tsx:164-347`

**Step 1: Add new state variables for settings panel and perspective-origin**

In the state block (around line 169-186), add:

```ts
const [transformSettingsOpen, setTransformSettingsOpen] = useState(false);
const [perspectiveOrigin, setPerspectiveOrigin] = useState(() => cs.getPropertyValue("perspective-origin") || "50% 50%");
const [selfPerspective, setSelfPerspective] = useState(() => parseSelfPerspective(cs.transform));
```

**Step 2: Add new handler for perspective-origin**

```ts
const handlePerspectiveOriginChange = useCallback(
  (v: string) => { setPerspectiveOrigin(v); apply("perspective-origin", v); },
  [apply],
);
```

**Step 3: Update handleTransformsChange to include self-perspective**

```ts
const handleTransformsChange = useCallback(
  (t: TransformValue[]) => {
    setTransforms(t);
    apply("transform", transformToCSSWithPerspective(t, selfPerspective));
  },
  [apply, selfPerspective],
);
```

**Step 4: Add selfPerspective handler**

```ts
const handleSelfPerspectiveChange = useCallback(
  (v: number) => {
    setSelfPerspective(v);
    apply("transform", transformToCSSWithPerspective(transforms, v));
  },
  [apply, transforms],
);
```

**Step 5: Update the SubSectionHeader for transforms**

Replace the current SubSectionHeader line (around line 335):

```tsx
<SubSectionHeader
  label="2D & 3D transforms"
  onAdd={handleAddTransform}
  onMenu={() => setTransformSettingsOpen((o) => !o)}
  indicator={ind("transform")}
  onReset={() => {
    resetProp(element, "transform"); resetProp(element, "transform-origin");
    resetProp(element, "perspective"); resetProp(element, "backface-visibility");
    resetProp(element, "perspective-origin");
    const fresh = getComputedStyle(element);
    setTransforms(parseTransform(fresh.transform));
    setTransformOrigin(fresh.transformOrigin || "center");
    setPerspective(parseNum(fresh.getPropertyValue("perspective")));
    setBackfaceVisibility(fresh.getPropertyValue("backface-visibility") || "visible");
    setPerspectiveOrigin(fresh.getPropertyValue("perspective-origin") || "50% 50%");
    setSelfPerspective(parseSelfPerspective(fresh.transform));
  }}
/>
```

**Step 6: Replace the TransformEditor usage block**

Replace the current conditional render block (lines 336-345) and the Perspective/Backface rows (lines 346-347) with:

```tsx
{(transforms.length > 0 || transformSettingsOpen) && (
  <div style={{ padding: "4px 12px" }}>
    <TransformEditor
      transforms={transforms}
      onChange={handleTransformsChange}
      origin={transformOrigin}
      onOriginChange={handleTransformOriginChange}
      backfaceVisibility={backfaceVisibility}
      onBackfaceChange={handleBackfaceVisibilityChange}
      selfPerspective={selfPerspective}
      onSelfPerspectiveChange={handleSelfPerspectiveChange}
      childrenPerspective={perspective}
      onChildrenPerspectiveChange={handlePerspectiveChange}
      perspectiveOrigin={perspectiveOrigin}
      onPerspectiveOriginChange={handlePerspectiveOriginChange}
      settingsOpen={transformSettingsOpen}
    />
  </div>
)}
```

**Step 7: Remove the old Perspective NumberRow and Backface SelectRow**

Delete these two lines entirely (they are now inside TransformSettings):
```
<NumberRow label="Perspective" ... />
<SelectRow label="Backface" ... />
```

**Step 8: Update imports**

At the top of EffectsSection.tsx, add `parseSelfPerspective` and `transformToCSSWithPerspective` to the import from `../cssParsers`:

```ts
import {
  parseNum,
  parseBoxShadow,
  parseFilter,
  parseTransform,
  parseSelfPerspective,
  parseTransitions,
  shadowToCSS,
  filterToCSS,
  transformToCSSWithPerspective,
  transitionsToCSS,
} from "../cssParsers";
```

Remove `transformToCSS` from the import (replaced by `transformToCSSWithPerspective`).

**Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 10: Run all tests**

Run: `npm test`
Expected: Existing tests PASS (cssParsers tests pass, no component render tests affected)

**Step 11: Commit**

```bash
git add src/overlay/sections/EffectsSection.tsx src/overlay/sections/TransformEditor.tsx src/overlay/cssParsers.ts
git commit -m "feat(transforms): integrate new TransformEditor into EffectsSection, move perspective/backface inside"
```

---

### Task 9: Manual verification and polish

**Files:**
- All files from tasks 1-8

**Step 1: Start the dev server and test**

Run: `cd test-app && npm run dev`

Open `http://localhost:3000/demo` in Chrome.

**Step 2: Test the following scenarios**

1. Select an element, scroll to Effects > "2D & 3D transforms"
2. Click `+` to add a Move transform — verify pill appears and auto-expands
3. Drag the X slider — verify the element moves
4. Switch to Scale tab — verify type changes to Scale, values reset
5. Click the pill to collapse — verify summary shows correct values
6. Click `+` again to add a Rotate — verify second pill appears
7. Expand Rotate, set X to 45 — verify element rotates
8. Drag-reorder the two pills — verify order changes and CSS updates
9. Click `...` to open Transform Settings — verify Origin, Backface, Perspectives appear
10. Change Origin to "top left" via grid picker — verify Left=0%, Top=0%
11. Type 25 in the Left input — verify origin updates
12. Toggle Backface to "Hidden" — verify CSS applies
13. Set Self Perspective distance to 500 — verify `perspective(500px)` appears in transform string
14. Set Children Perspective distance to 800 — verify `perspective: 800px` applies
15. Scale lock: add Scale, change X to 2 with lock on — verify Y and Z also become 2
16. Click lock to unlock — change X to 3, verify Y and Z stay at 2

**Step 3: Fix any visual issues**

Adjust padding, spacing, or colors as needed based on the visual test.

**Step 4: Run full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit any polish fixes**

```bash
git add -A
git commit -m "fix(transforms): polish spacing and visual alignment after manual testing"
```
