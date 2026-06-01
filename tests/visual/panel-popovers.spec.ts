import { test, expect } from "@playwright/test";
import { openDemo, sweepEachColorSwatch } from "./helpers";
import { geometricSweep } from "./sweep";

/**
 * Nested popover geometry — the color-picker portal.
 *
 * The color picker (ColorPickerEnhanced, opened from a swatch in ColorRow) is a
 * `[data-tuner-portal]` that positions itself with fixed coordinates and its own
 * edge-collision logic (flip-above when there's no room below, horizontal clamp
 * to the right edge). Earlier sweeps only exercised the Connect-variable list,
 * never this full hue/saturation picker — so its positioning math was untested.
 *
 * A portal is its own sweep surface, so if that math under-clamps, the picker can
 * escape the viewport. These tests open every color swatch and assert the picker
 * stays on-screen — at the default size, and (the real hunt) on short viewports
 * where the flip-above branch fires.
 */

test.describe("Panel geometry — color-picker popover @1440×900", () => {
  test("every color picker opens cleanly (no spill/clip/off-viewport)", async ({ page }) => {
    test.setTimeout(60_000);
    await openDemo(page);
    const { opened, problems } = await sweepEachColorSwatch(page);
    // Guard against a vacuous pass: the test is only meaningful if it actually
    // opened pickers to sweep.
    expect(opened, "no color picker ever opened — selector/trigger broke").toBeGreaterThan(0);
    expect(
      problems,
      `color-picker geometric findings:\n${JSON.stringify(problems, null, 2)}`
    ).toEqual([]);
  });
});

/**
 * On a SHORT viewport the picker flips above its swatch; if the flip math doesn't
 * clamp the top edge, the popover escapes off the top of the viewport. This is
 * the color-picker analogue of the short-viewport dropdown edge test.
 */
const SHORT = [
  { name: "short-1280x600", w: 1280, h: 600 },
  { name: "short-1440x580", w: 1440, h: 580 },
  { name: "short-1024x560", w: 1024, h: 560 },
];

for (const sz of SHORT) {
  test(`color picker stays within viewport @${sz.name} (${sz.w}×${sz.h})`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: sz.w, height: sz.h });
    await openDemo(page);

    // Panel itself must be in-viewport before opening anything.
    const base = (await geometricSweep(page)).filter((f) => f.type === "surface-offviewport");
    expect(base, `[${sz.name}] panel escapes viewport at rest:\n${JSON.stringify(base, null, 2)}`).toEqual([]);

    const { opened, problems } = await sweepEachColorSwatch(page, { onlyOffviewport: true });
    expect(opened, `[${sz.name}] no color picker ever opened — selector/trigger broke`).toBeGreaterThan(0);
    expect(
      problems,
      `[${sz.name}] color picker escaping viewport:\n${JSON.stringify(problems, null, 2)}`
    ).toEqual([]);
  });
}
