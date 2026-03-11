# Redial — Iteration Log

Tracks progress through the Webflow UI spec implementation. Each entry records what was done in a single iteration.

---

## Completed

### Iteration 1 — LabelScrub + UnitSelector in SliderRow (2026-03-11)
- Wrapped SliderRow label text with `<LabelScrub>` so every numeric slider label is now drag-to-scrub
- Added optional `units` and `onUnitChange` props to SliderRow for UnitSelector dropdown
- When `units` is provided, renders `<UnitSelector>` instead of a static unit label
- Typecheck: PASS

### Iteration 2 — UnitSelector wired into Size + Position sections (2026-03-11)
- Added per-property unit state: `widthUnit`, `heightUnit`, `minWidthUnit`, `maxWidthUnit`, `minHeightUnit`, `maxHeightUnit`, `topUnit`, `rightUnit`, `bottomUnit`, `leftUnit`
- All Size sliders now show UnitSelector dropdown (px, %, vw/vh, em, rem, ch)
- All Position offset sliders now show UnitSelector dropdown (px, %, vw, vh)
- Handlers compose value + unit dynamically (`${v}${unit}`)
- Added `SIZE_UNITS_W`, `SIZE_UNITS_H`, `POSITION_UNITS`, `TYPO_SIZE_UNITS` constants
- Typecheck: PASS

---

## Next Up

**Phase B-6:** Grid track editors (grid-template-columns, grid-template-rows text inputs)
