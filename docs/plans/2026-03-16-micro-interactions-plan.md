# Micro-Interactions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tactile micro-interactions across all 4 tiers of the Redial panel — CSS-only + lightweight hooks, no Motion library expansion.

**Architecture:** New `usePressScale` hook in `controls/helpers.tsx` provides `pressHandlers` + `pressStyle` to spread onto any element. New timing tokens (`release`, `easeRelease`) in `timing.ts`. All transitions respect `getReducedMotion()`. No `motion.*` wrappers added.

**Tech Stack:** React hooks, CSS transitions, inline styles, existing timing.ts/theme.ts token system

---

### Task 1: Timing Infrastructure

**Files:**
- Modify: `src/overlay/timing.ts`
- Modify: `src/overlay/__tests__/timing.test.ts`

**Step 1: Write the failing tests**

Add to `src/overlay/__tests__/timing.test.ts`:

```ts
// Inside "timing tokens" describe block:
it("includes release token", () => {
  expect(timing.release).toBe(120);
});

it("includes dismissal token", () => {
  expect(timing.dismissal).toBe(1700);
});

// New describe block:
describe("easeRelease", () => {
  it("exports easeRelease cubic-bezier string", () => {
    expect(easeRelease).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
  });
});

describe("cssTransition()", () => {
  it("builds single-property transition string", () => {
    expect(cssTransition("transform", "release")).toBe("transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)");
  });

  it("builds multi-property transition string", () => {
    expect(cssTransition(["transform", "opacity"], "fast")).toBe(
      "transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 80ms cubic-bezier(0.34, 1.56, 0.64, 1)"
    );
  });

  it("returns 0ms when reduced motion is active", () => {
    setReducedMotion(true);
    expect(cssTransition("transform", "release")).toBe("transform 0ms cubic-bezier(0.34, 1.56, 0.64, 1)");
  });
});
```

Update the import at the top:
```ts
import { timing, type TimingKey, setReducedMotion, getReducedMotion, ms, easeRelease, cssTransition } from "../timing";
```

Update existing tests:
- `"exports all expected keys"` — add `"release"`, `"toolbar"`, `"dismissal"` to the keys array
- `"tokens are in ascending order"` — add `"toolbar"`, `"dismissal"` to the ordered array
- `"slow is the largest"` — change to `"dismissal is the largest"` and expect `timing.dismissal` to be `1700`

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/overlay/__tests__/timing.test.ts`
Expected: FAIL — `easeRelease` and `cssTransition` not exported

**Step 3: Write minimal implementation**

In `src/overlay/timing.ts`, add to the `timing` object (between `slow` and `toolbar`):

```ts
release: 120,  // spring-back from press/drag (between fast and expand)
```

Add after `springConfig()`:

```ts
// ─── CSS Easing ──────────────────────────────────────────────────

/** Overshoot ease for press-release, drop-settle — slight bounce, fast settle */
export const easeRelease = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Build a CSS transition string: `cssTransition("transform", "release")` → `"transform 120ms cubic-bezier(...)"` */
export function cssTransition(props: string | string[], duration: TimingKey): string {
  const d = _reducedMotion ? 0 : timing[duration];
  const arr = Array.isArray(props) ? props : [props];
  return arr.map(p => `${p} ${d}ms ${easeRelease}`).join(", ");
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/overlay/__tests__/timing.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/overlay/timing.ts src/overlay/__tests__/timing.test.ts
git commit -m "feat: add release timing token, easeRelease curve, cssTransition helper"
```

---

### Task 2: `usePressScale` Hook

**Files:**
- Modify: `src/overlay/controls/helpers.tsx`
- Modify: `src/overlay/controls/index.ts`
- Create: `src/overlay/__tests__/usePressScale.test.ts`

**Step 1: Write the failing test**

Create `src/overlay/__tests__/usePressScale.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePressScale } from "../controls/helpers";

describe("usePressScale", () => {
  it("returns pressStyle with default transform: none", () => {
    const { result } = renderHook(() => usePressScale());
    expect(result.current.pressStyle.transform).toBeUndefined();
  });

  it("returns pressHandlers with onMouseDown, onMouseUp, onMouseLeave", () => {
    const { result } = renderHook(() => usePressScale());
    expect(typeof result.current.pressHandlers.onMouseDown).toBe("function");
    expect(typeof result.current.pressHandlers.onMouseUp).toBe("function");
    expect(typeof result.current.pressHandlers.onMouseLeave).toBe("function");
  });

  it("sets scale on mouseDown", () => {
    const { result } = renderHook(() => usePressScale(0.95));
    act(() => {
      result.current.pressHandlers.onMouseDown();
    });
    expect(result.current.pressStyle.transform).toBe("scale(0.95)");
  });

  it("clears scale on mouseUp", () => {
    const { result } = renderHook(() => usePressScale());
    act(() => { result.current.pressHandlers.onMouseDown(); });
    act(() => { result.current.pressHandlers.onMouseUp(); });
    expect(result.current.pressStyle.transform).toBeUndefined();
  });

  it("clears scale on mouseLeave", () => {
    const { result } = renderHook(() => usePressScale());
    act(() => { result.current.pressHandlers.onMouseDown(); });
    act(() => { result.current.pressHandlers.onMouseLeave(); });
    expect(result.current.pressStyle.transform).toBeUndefined();
  });

  it("uses default scale of 0.97", () => {
    const { result } = renderHook(() => usePressScale());
    act(() => { result.current.pressHandlers.onMouseDown(); });
    expect(result.current.pressStyle.transform).toBe("scale(0.97)");
  });

  it("accepts custom scale", () => {
    const { result } = renderHook(() => usePressScale(0.92));
    act(() => { result.current.pressHandlers.onMouseDown(); });
    expect(result.current.pressStyle.transform).toBe("scale(0.92)");
  });

  it("includes transition in pressStyle", () => {
    const { result } = renderHook(() => usePressScale());
    expect(result.current.pressStyle.transition).toContain("transform");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/overlay/__tests__/usePressScale.test.ts`
Expected: FAIL — `usePressScale` not exported

**Step 3: Write minimal implementation**

Add to `src/overlay/controls/helpers.tsx` (after the `useResetPopover` function):

```ts
import { cssTransition } from "../timing";

// ─── Press Scale Hook ────────────────────────────────────────────────

/** Tactile press feedback — scale down on mouseDown, spring back on release.
 *  Spread `pressHandlers` onto the element and merge `pressStyle` into its style. */
export function usePressScale(scale = 0.97) {
  const [pressed, setPressed] = useState(false);

  const pressHandlers = useMemo(() => ({
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
  }), []);

  const pressStyle: React.CSSProperties = useMemo(() => ({
    transform: pressed ? `scale(${scale})` : undefined,
    transition: cssTransition("transform", pressed ? "fast" : "release"),
  }), [pressed, scale]);

  return { pressHandlers, pressStyle };
}
```

Add to `src/overlay/controls/index.ts`:
```ts
export { usePressScale } from "./helpers";
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/overlay/__tests__/usePressScale.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/overlay/controls/helpers.tsx src/overlay/controls/index.ts src/overlay/__tests__/usePressScale.test.ts
git commit -m "feat: add usePressScale hook for tactile press feedback"
```

---

### Task 3: Wire Press Scale Into Small Buttons

**Files:**
- Modify: `src/overlay/controls/EditorRemoveButton.tsx`
- Modify: `src/overlay/controls/VisibilityToggle.tsx`
- Modify: `src/overlay/controls/SubSectionHeader.tsx`
- Modify: `src/overlay/controls/helpers.tsx` (PresetChips)

**Step 1: EditorRemoveButton**

In `src/overlay/controls/EditorRemoveButton.tsx`:
- Add import: `import { usePressScale } from "./helpers";`
- Inside the component, add: `const { pressHandlers, pressStyle } = usePressScale(0.9);`
- Spread onto the `<button>`: `{...pressHandlers}` and merge `pressStyle` into the `style` prop

The button becomes:
```tsx
export function EditorRemoveButton({ onClick, title }: { onClick: () => void; title?: string }) {
  const { pressHandlers, pressStyle } = usePressScale(0.9);
  return (
    <button
      onClick={onClick}
      title={title}
      {...pressHandlers}
      style={{
        width: "14px",
        height: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        color: text.disabled,
        cursor: "pointer",
        padding: 0,
        borderRadius: "2px",
        flexShrink: 0,
        lineHeight: 1,
        ...pressStyle,
      }}
      // existing onMouseEnter/Leave stay as-is
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = surface.hover;
        (e.currentTarget as HTMLElement).style.color = text.label;
      }}
      onMouseLeave={(e) => {
        pressHandlers.onMouseLeave();
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = text.disabled;
      }}
    >
      <X size={11} strokeWidth={2} />
    </button>
  );
}
```

**Important:** The `onMouseLeave` must call both `pressHandlers.onMouseLeave()` AND the existing style reset. Chain them.

**Step 2: VisibilityToggle**

In `src/overlay/controls/VisibilityToggle.tsx`:
- Add import: `import { usePressScale } from "./helpers";`
- Add: `const { pressHandlers, pressStyle } = usePressScale(0.93);`
- Add `transition: "opacity 80ms ease"` for the visible/invisible crossfade
- Spread handlers and style onto the button:

```tsx
export function VisibilityToggle({ visible, onToggle, title }: {
  visible: boolean; onToggle: () => void; title?: string;
}) {
  const { pressHandlers, pressStyle } = usePressScale(0.93);
  return (
    <button
      onClick={onToggle}
      {...pressHandlers}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px",
        color: visible ? text.label : text.hint,
        flexShrink: 0,
        transition: "opacity 80ms ease",
        ...pressStyle,
      }}
      title={title ?? (visible ? "Hide layer" : "Show layer")}
    >
      {visible ? <Eye size={12} /> : <EyeOff size={12} />}
    </button>
  );
}
```

**Step 3: SubSectionHeader buttons (+ and ... icons)**

In `src/overlay/controls/SubSectionHeader.tsx`:
- Add import: `import { usePressScale } from "./helpers";`
- Extract the menu/add buttons into a small `SubHeaderButton` component at the bottom of the file with `usePressScale(0.93)`:

```tsx
function SubHeaderButton({ onClick, children }: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode }) {
  const { pressHandlers, pressStyle } = usePressScale(0.93);
  return (
    <button
      onClick={onClick}
      {...pressHandlers}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: "2px",
        color: text.disabled, display: "flex", alignItems: "center",
        borderRadius: "3px", transition: `color ${ms("fast")} ease`,
        ...pressStyle,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = text.label; }}
      onMouseLeave={(e) => { pressHandlers.onMouseLeave(); (e.currentTarget as HTMLElement).style.color = text.disabled; }}
    >
      {children}
    </button>
  );
}
```

Replace the two inline `<button>` elements (lines ~36-56) with:
```tsx
{onMenu && <SubHeaderButton onClick={onMenu}><MoreHorizontal size={14} strokeWidth={1.5} /></SubHeaderButton>}
{onAdd && <SubHeaderButton onClick={onAdd}><Plus size={14} strokeWidth={1.5} /></SubHeaderButton>}
```

**Step 4: PresetChips buttons**

In `src/overlay/controls/helpers.tsx`, the `PresetChips` component's buttons (lines ~149-174):
- Can't use hook inside map. Instead, add CSS transition + active pseudo-class approach:
- Add to each button's style: `transition: "transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1)"`
- Add `onMouseDown` / `onMouseUp` handlers inline:

```tsx
onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.93)"; }}
onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
```

And chain with existing onMouseLeave:
```tsx
onMouseLeave={(e) => {
  (e.currentTarget as HTMLElement).style.background = "transparent";
  (e.currentTarget as HTMLElement).style.transform = "";
}}
```

**Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: All passing (no behavioral changes, only visual)

**Step 6: Commit**

```bash
git add src/overlay/controls/EditorRemoveButton.tsx src/overlay/controls/VisibilityToggle.tsx src/overlay/controls/SubSectionHeader.tsx src/overlay/controls/helpers.tsx
git commit -m "feat: wire usePressScale into small buttons (remove, visibility, sub-headers, presets)"
```

---

### Task 4: Wire Press Scale Into IconButtonGroup

**Files:**
- Modify: `src/overlay/controls/IconButtonGroup.tsx`

**Step 1: Add press scale to IconButtonItem**

The `IconButtonItem` component (line 104) already tracks `hovered` and `focused` state. Add press scale:

- Add import: `import { usePressScale } from "./helpers";`
- Inside `IconButtonItem`, add: `const { pressHandlers, pressStyle } = usePressScale(0.93);`
- Spread `{...pressHandlers}` on the `<ToggleGroupItem>` BEFORE existing handlers (so onClick still works)
- Merge `pressStyle` into the `style` prop
- Chain `pressHandlers.onMouseLeave` with existing `onMouseLeave`

```tsx
// In IconButtonItem:
const { pressHandlers, pressStyle } = usePressScale(0.93);

// On ToggleGroupItem:
onMouseDown={(e) => { pressHandlers.onMouseDown(); }}
onMouseLeave={() => { setHovered(false); pressHandlers.onMouseLeave(); }}
// ... keep existing onMouseEnter, onFocus, onBlur
style={{
  // ... existing styles ...
  ...pressStyle,
}}
```

**Note:** `ToggleGroupItem` from Radix uses `onMouseDown` differently. The `pressHandlers.onMouseDown` should be called within a wrapper, not spread. Don't spread `{...pressHandlers}` directly — instead call individual handlers to avoid overriding Radix's internal handlers.

**Step 2: Run tests**

Run: `npm test -- --run src/overlay/__tests__/iconButtonActiveState.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/overlay/controls/IconButtonGroup.tsx
git commit -m "feat: add press scale to IconButtonGroup items"
```

---

### Task 5: Wire Press Scale Into ColorRow Swatch

**Files:**
- Modify: `src/overlay/controls/ColorRow.tsx`

**Step 1: Add press scale to the color swatch div**

The swatch is the `<div ref={swatchRef}>` at line 141. Add:

- Add import: `import { usePressScale } from "./helpers";`
- Add: `const { pressHandlers: swatchPress, pressStyle: swatchPressStyle } = usePressScale(0.92);`
- Spread onto the swatch div and merge style:

```tsx
<div
  ref={swatchRef}
  className="tuner-focusable"
  tabIndex={0}
  role="button"
  onClick={() => setPickerOpen(!pickerOpen)}
  {...swatchPress}
  onMouseLeave={() => swatchPress.onMouseLeave()}
  onKeyDown={/* keep existing */}
  style={{
    width: 20,
    height: 20,
    borderRadius: 2,
    cursor: "pointer",
    flexShrink: 0,
    background: displayColor === "transparent" ? checkerboard : displayColor,
    border: varName ? `2px solid ${primaryAlpha(0.6)}` : `1px solid ${color.border}`,
    boxShadow: varName ? undefined : `inset 0 0 0 1px ${blackAlpha(0.06)}`,
    ...swatchPressStyle,
  }}
  title={aliasChainTitle}
/>
```

**Step 2: Add press scale to link/unlink buttons**

For the link button (line ~206) and unlink button (line ~184), add inline `onMouseDown`/`onMouseUp` handlers (can't use hooks here since they're conditional renders):

```tsx
onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.9)"; }}
onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
```

Add to their style: `transition: "transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1)"`

**Step 3: Run tests**

Run: `npm test -- --run src/overlay/__tests__/colorRowHoverShift.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/overlay/controls/ColorRow.tsx
git commit -m "feat: add press scale to ColorRow swatch and link buttons"
```

---

### Task 6: Segmented Control Sliding Indicator

**Files:**
- Modify: `src/overlay/controls/SegmentedControl.tsx`
- Modify: `src/overlay/controls/WebflowSegmentedControl.tsx`

**Step 1: SegmentedControl — add sliding active background**

The current approach sets `background: isActive ? segment.activeBg : "transparent"` per button. Replace with a positioned indicator that slides.

Refactor the container to use `position: relative` and add an absolutely positioned active-bg div:

```tsx
import { useState, useCallback, useRef, useEffect } from "react";
import { segment, text, font } from "../theme";
import { cssTransition } from "../timing";

export function SegmentedControl({ options, value, onChange, segmentWidth, "aria-label": ariaLabel }: SegmentedControlProps) {
  const handleClick = useCallback((optValue: string) => onChange(optValue), [onChange]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  // Measure active button position and animate indicator
  useEffect(() => {
    if (!containerRef.current) return;
    const activeIdx = options.findIndex(o => o.value === value);
    if (activeIdx < 0) return;
    const buttons = containerRef.current.querySelectorAll<HTMLElement>('[role="radio"]');
    const btn = buttons[activeIdx];
    if (!btn) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicatorStyle({
      position: "absolute",
      left: btnRect.left - containerRect.left,
      top: segment.padding,
      width: btnRect.width,
      height: segment.height,
      borderRadius: segment.segmentRadius,
      background: segment.activeBg,
      transition: cssTransition(["left", "width"], "normal"),
      pointerEvents: "none" as const,
    });
  }, [value, options]);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        alignItems: "flex-start",
        flex: 1,
        minWidth: 0,
        background: segment.bg,
        borderRadius: segment.radius,
        padding: segment.padding,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Sliding indicator */}
      <div style={indicatorStyle} />
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            /* ... keep all existing props ... */
            style={{
              /* ... keep all existing styles EXCEPT: */
              background: "transparent",  // ← always transparent, indicator handles active bg
              /* ... rest unchanged ... */
              position: "relative",  // ← above indicator
              zIndex: 1,
            }}
          >
            {opt.icon ?? opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: WebflowSegmentedControl — same pattern**

Apply the same sliding indicator approach. The structure is nearly identical.

**Step 3: Run tests**

Run: `npm test -- --run`
Expected: All passing

**Step 4: Commit**

```bash
git add src/overlay/controls/SegmentedControl.tsx src/overlay/controls/WebflowSegmentedControl.tsx
git commit -m "feat: add sliding active indicator to segmented controls"
```

---

### Task 7: Section Chevron Easing Update

**Files:**
- Modify: `src/overlay/controls/Section.tsx`

**Step 1: Update chevron transition**

In `src/overlay/controls/Section.tsx`, line 111, the chevron span has:
```ts
transition: `transform ${ms("expand")} ease`,
```

Change to:
```ts
transition: cssTransition("transform", "expand"),
```

This replaces `ease` with the `easeRelease` overshoot curve, making the chevron rotation feel springy.

- Add import: `import { cssTransition } from "../timing";`

**Step 2: Run tests**

Run: `npm test -- --run src/overlay/__tests__/sections.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/overlay/controls/Section.tsx
git commit -m "feat: update section chevron to use easeRelease spring curve"
```

---

### Task 8: Enhance useValueFlash With Micro-Scale

**Files:**
- Modify: `src/overlay/controls/helpers.tsx`

**Step 1: Update useValueFlash**

Current implementation (lines 29-45) returns `{ backgroundColor, transition }`. Enhance to include a brief scale bump:

```ts
export function useValueFlash(value: number) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(false), 200);
    }
    return () => clearTimeout(timer.current);
  }, [value]);

  return flash
    ? {
        backgroundColor: primaryAlpha(0.12),
        transform: "scale(1.02)",
        transition: `background-color ${ms("layout")}, transform ${ms("fast")} ${easeRelease}`,
      }
    : {
        transition: `background-color ${ms("layout")}, transform ${ms("release")} ${easeRelease}`,
      };
}
```

Add imports at the top of helpers.tsx: `import { ms, easeRelease } from "../timing";` (update existing `ms` import line)

**Step 2: Run tests**

Run: `npm test -- --run src/overlay/__tests__/flashShorthandConflict.test.ts`
Expected: PASS (test checks flash behavior, not specific CSS properties)

**Step 3: Commit**

```bash
git add src/overlay/controls/helpers.tsx
git commit -m "feat: enhance useValueFlash with micro-scale bump on value change"
```

---

### Task 9: Footer Button Press Scale

**Files:**
- Modify: `src/overlay/shell/Footer.tsx`

**Step 1: Add press scale to Clipboard button**

The clipboard button (line 274) already tracks `clipboardHovered`. Add press:

- Add import: `import { usePressScale } from "../controls/helpers";`
- Add: `const { pressHandlers: clipPress, pressStyle: clipPressStyle } = usePressScale(0.97);`
- Spread `{...clipPress}` and merge style. Chain `onMouseLeave`:

```tsx
onMouseLeave={() => { clipPress.onMouseLeave(); setClipboardHovered(false); }}
```

**Step 2: Add press scale to Save button**

- Add: `const { pressHandlers: savePress, pressStyle: savePressStyle } = usePressScale(0.97);`
- Spread and merge onto the save button (line 365)
- Chain `onMouseLeave`

**Step 3: Add press scale to DropdownItem**

The `DropdownItem` subcomponent (line 437) already tracks `hovered`. Add inline press handlers (can't use hook in sub-component easily without making it heavier):

```tsx
onMouseDown={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.transform = "scale(0.98)"; }}
onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
onMouseLeave={(e) => { setHovered(false); (e.currentTarget as HTMLElement).style.transform = ""; }}
```

Add to DropdownItem button style: `transition: \`transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1), background ${timing.fast}ms\``

**Note:** The Reset button uses `motion.button` for shake animation. Don't add usePressScale to it — the motion wrapper already handles transforms and they would conflict.

**Step 4: Run tests**

Run: `npm test -- --run`
Expected: All passing

**Step 5: Commit**

```bash
git add src/overlay/shell/Footer.tsx
git commit -m "feat: add press scale to footer buttons and dropdown items"
```

---

### Task 10: Header Chrome

**Files:**
- Modify: `src/overlay/shell/Header.tsx`

**Step 1: Read Header.tsx fully** (it was only read to line 80)

Read the full file to understand scope pills, close button, pin button structure.

**Step 2: Add press scale to close button and pin button**

Both buttons already track hover state. Add inline press handlers:

For close button:
```tsx
onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.9)"; }}
onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
```

Add to its style: `transition: "transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1), ..."` (merge with any existing transition)

Same for pin button.

**Step 3: Add press scale to scope pills**

Scope pills are the `<button>` elements for class/element scope. Add:
```tsx
onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.95)"; }}
onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
```

**Step 4: Breadcrumb hover underline**

For breadcrumb segments, add a bottom-border that scales in on hover:

```tsx
style={{
  // existing styles...
  borderBottom: "1px solid transparent",
  transition: "border-color 100ms ease",
}}
onMouseEnter={(e) => {
  // existing hover logic...
  (e.currentTarget as HTMLElement).style.borderColor = blackAlpha(0.2);
}}
onMouseLeave={(e) => {
  // existing hover logic...
  (e.currentTarget as HTMLElement).style.borderColor = "transparent";
}}
```

**Step 5: Run tests**

Run: `npm test -- --run src/overlay/__tests__/breadcrumb.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/overlay/shell/Header.tsx
git commit -m "feat: add press scale to header buttons and breadcrumb hover underline"
```

---

### Task 11: List Editor Item Transitions

**Files:**
- Modify: `src/overlay/sections/ShadowEditor.tsx`
- Modify: `src/overlay/sections/FilterSliders.tsx`
- Modify: `src/overlay/sections/TransformEditor.tsx`
- Modify: `src/overlay/sections/TransitionEditor.tsx`
- Modify: `src/overlay/sections/BackgroundLayerList.tsx`

All 5 list editors follow the same pattern: items are rendered in a loop with `useDragReorder` providing `itemStyle(i)`. The task is to add entrance/exit transitions when items are added or removed.

**Step 1: Read one editor to understand the pattern**

Read `ShadowEditor.tsx` to see how items are rendered and how add/remove works.

**Step 2: Create a shared wrapper component**

Add to `src/overlay/controls/helpers.tsx`:

```tsx
/** Wrapper for list editor items — handles add/remove entrance/exit animations.
 *  Wrap each item in the list editor's map() call. */
export function AnimatedListItem({ children, itemKey }: { children: React.ReactNode; itemKey: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger entrance animation on next frame
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div style={{
      opacity: mounted ? 1 : 0,
      transform: mounted ? "scale(1)" : "scale(0.95)",
      transition: cssTransition(["opacity", "transform"], "expand"),
    }}>
      {children}
    </div>
  );
}
```

Add to barrel: `export { AnimatedListItem } from "./helpers";`

**Step 3: Wire into each editor's item render**

For each of the 5 editors, wrap each list item in `<AnimatedListItem>`. Example for ShadowEditor:

```tsx
{shadows.map((shadow, i) => (
  <AnimatedListItem key={shadow._key ?? i} itemKey={String(shadow._key ?? i)}>
    <div ref={registerRef(i)} style={itemStyle(i)}>
      {/* existing item content */}
    </div>
  </AnimatedListItem>
))}
```

**Note:** For remove, items unmount immediately (React default). A proper exit animation would require a `useTransitionGroup` or similar — skip exit animations for now as the entrance alone adds significant feel. Exit can be added later if desired.

**Step 4: Run tests**

Run: `npm test -- --run`
Expected: All passing

**Step 5: Commit**

```bash
git add src/overlay/controls/helpers.tsx src/overlay/controls/index.ts src/overlay/sections/ShadowEditor.tsx src/overlay/sections/FilterSliders.tsx src/overlay/sections/TransformEditor.tsx src/overlay/sections/TransitionEditor.tsx src/overlay/sections/BackgroundLayerList.tsx
git commit -m "feat: add entrance animation to list editor items"
```

---

### Task 12: Drag Reorder Settle Bounce

**Files:**
- Modify: `src/overlay/hooks/useDragReorder.ts`

**Step 1: Verify existing easing**

The settle transition at line 192 already uses `cubic-bezier(0.34, 1.56, 0.64, 1)` — this IS the `easeRelease` curve! Good. Just update to use the shared token:

- Add import: `import { timing, ms, easeRelease } from "../timing";` (update existing import)
- Line 192: Replace the hardcoded cubic-bezier with the `easeRelease` token:

```ts
transition: `transform ${ms("layout")} ${easeRelease}`,
```

- Also update the displaced items transition at line 217:

```ts
transition: `transform ${ms("layout")} ${easeRelease}`,
```

This was already using `ease` — switching to `easeRelease` gives displaced items a subtle bounce as they shift.

**Step 2: Run tests**

Run: `npm test -- --run src/overlay/__tests__/useDragReorder.test.ts`
Expected: PASS (tests pure computation functions, not CSS strings)

**Step 3: Commit**

```bash
git add src/overlay/hooks/useDragReorder.ts
git commit -m "refactor: use shared easeRelease token in drag reorder transitions"
```

---

### Final: Full Verification

**Step 1: Run complete test suite**

Run: `npm test -- --run`
Expected: All 2688+ tests passing

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Browser verification**

Open `http://localhost:3000/demo` and verify:
- Press any button — should scale down and spring back
- Toggle segmented controls — active indicator should slide
- Open/close sections — chevron should rotate with slight overshoot
- Drag reorder a shadow/filter — displaced items should bounce
- Add a new shadow/filter — item should fade+scale in
- Adjust a slider — value flash should include micro-scale
- Click color swatch — should press down before picker opens

**Step 4: Final commit**

If any fixes needed from browser testing, commit them as a separate fix commit.
