# Overlay Improvements

All improvements from the dropdown portal audit have been implemented.

---

## 1. ~~Extract `usePortalDropdown` hook (DRY)~~ DONE

Created `src/overlay/usePortalDropdown.ts` encapsulating:
- `dropdownPos` state + `updateDropdownPos()` with flip-above logic
- Ref-based click-outside via `portalRef` (not querySelector)
- Dynamic height correction via `useLayoutEffect`

Adopted by all 4 components: UnitSelector, PositionSelector, SelectRowCustom, TextStyleRow.

---

## 2. ~~SideSelector focus ring (a11y)~~ DONE

Added `onFocus`/`onBlur` handlers with `focusRing` boxShadow to all 3 SideSelector modes (default tab bar, compact, cross). Satisfies WCAG 2.1 SC 2.4.7.

---

## 3. ~~Dynamic dropdown height measurement (robustness)~~ DONE

Integrated into `usePortalDropdown` hook. Uses `useLayoutEffect` to measure actual portal height after mount and correct flip direction if the estimate was wrong. Hardcoded `DROPDOWN_HEIGHT` constants replaced with `estimatedHeight` parameter.

---

## 4. ~~Ref-based click-outside (robustness)~~ DONE

Integrated into `usePortalDropdown` hook. Uses `portalRef.current?.contains(target)` instead of `document.querySelector("[data-*-portal]")`. Instance-safe. Data attributes preserved on portal divs for page-level click-through handling in Overlay.tsx.
