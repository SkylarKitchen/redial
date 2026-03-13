# Overlay Improvements

Future improvement opportunities identified during the dropdown portal audit.
Each entry includes enough context to execute in a standalone session.

---

## 1. Extract `usePortalDropdown` hook (DRY)

**Problem:** Four components (UnitSelector, PositionSelector, SelectRowCustom, TextStyleRow) each duplicate the same portal dropdown pattern: `dropdownPos` state, `updateDropdownPos()` callback with flip-above logic, click-outside listener, and the `{open && dropdownPos && createPortal(...)}` render gate. Any future dropdown will copy-paste the same ~30 lines.

**Affected files:**
- `src/overlay/UnitSelector.tsx` — lines 70, 158–168, 170–184, 244
- `src/overlay/PositionSelector.tsx` — lines 88, 114–122, 124–136, 223
- `src/overlay/controls.tsx` (SelectRowCustom) — lines ~670, 690–701, 728–735, 769
- `src/overlay/TextStyleRow.tsx` — lines 33, 38–49, 52–65, 79

**Fix approach:**
Create `src/overlay/usePortalDropdown.ts` that encapsulates:
1. `dropdownPos` state + `updateDropdownPos(triggerRef, estimatedHeight)` callback
2. Click-outside effect (takes `containerRef`, portal data-attribute selector, `setOpen`)
3. Returns `{ dropdownPos, updateDropdownPos, clickOutsideEffect }` or a combined `portalProps` object

**Reference implementation:** TextStyleRow's `updatePos` + click-outside effect is the cleanest version to use as the base.

---

## 2. SideSelector focus ring (a11y)

**Problem:** The `SideSelector` component (used for margin/padding side toggles) has no visible focus indicator. When a keyboard user tabs into the side grid, there's no visual feedback showing which cell is focused. This fails WCAG 2.1 SC 2.4.7 (Focus Visible).

**Affected files:**
- `src/overlay/SideSelector.tsx` — the grid buttons

**Fix approach:**
Add `onFocus`/`onBlur` handlers (or use the `tuner-focusable` class pattern from other components) to apply `focusRing` from `theme.ts` as a `boxShadow` on the focused grid cell. Follow the same pattern used in PositionSelector's trigger button (lines 185–190).

---

## 3. Dynamic dropdown height measurement (robustness)

**Problem:** Every dropdown flip-above calculation uses a hardcoded `DROPDOWN_HEIGHT` constant (150, 220, 250, 280 depending on component). If option counts change dynamically (e.g., variable options in UnitSelector, filtered results in SelectRowCustom), the constant can be wrong — either clipping content or flipping unnecessarily.

**Affected files:**
- `src/overlay/UnitSelector.tsx` — `DROPDOWN_HEIGHT = 150` (line 159)
- `src/overlay/PositionSelector.tsx` — `DROPDOWN_HEIGHT = 280` (line 115)
- `src/overlay/controls.tsx` (SelectRowCustom) — `DROPDOWN_HEIGHT = 220` (line 731)
- `src/overlay/TextStyleRow.tsx` — `DROPDOWN_HEIGHT = 250` (line 27)

**Fix approach:**
After the dropdown mounts, measure its actual height via `getBoundingClientRect()` in a `useLayoutEffect` and reposition if the flip direction was wrong. This is a two-pass render:
1. First render: use the estimated height for initial placement
2. `useLayoutEffect`: measure actual height, recompute `top` if it overflows, update `dropdownPos`

This can be integrated into the `usePortalDropdown` hook from improvement #1.

---

## 4. Ref-based click-outside (robustness)

**Problem:** Click-outside handlers use `document.querySelector("[data-*-portal]")` to find the portal element. This is fragile — if two instances of the same component are open simultaneously, the selector matches the first one in DOM order, not necessarily the one that owns the click-outside handler.

**Affected files:**
- `src/overlay/UnitSelector.tsx` — line 177: `querySelector("[data-unit-selector-portal]")`
- `src/overlay/PositionSelector.tsx` — line 130: `querySelector("[data-position-selector-portal]")`
- `src/overlay/controls.tsx` — line 695: `querySelector("[data-select-custom-portal]")`
- `src/overlay/TextStyleRow.tsx` — line 59: `querySelector("[data-textstyle-portal]")`

**Fix approach:**
Use a `portalRef = useRef<HTMLDivElement>(null)` attached directly to the portal wrapper `<div>`. In the click-outside handler, check `portalRef.current?.contains(target)` instead of querying the DOM. This is instance-safe and avoids the global DOM query.

Example:
```tsx
const portalRef = useRef<HTMLDivElement>(null);

// In the click-outside effect:
if (portalRef.current?.contains(target)) return;

// In the portal JSX:
<div ref={portalRef} data-tuner-portal ...>
```

This can also be integrated into the `usePortalDropdown` hook from improvement #1.
