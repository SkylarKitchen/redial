import { test, expect } from "@playwright/test";
import { openDemo } from "./helpers";
import { geometricSweep } from "./sweep";

/**
 * Surfaces must stay within the viewport across common editor window sizes.
 * The style panel is right-docked and tall; on shorter laptops its footer
 * (Save/Reset) must not fall below the fold. Only `surface-offviewport`
 * findings are asserted here (the unambiguous "you can't see/reach it" class).
 */
const SIZES = [
  { name: "laptop-13in", w: 1280, h: 800 },
  { name: "laptop-short", w: 1366, h: 720 },
  { name: "small-desktop", w: 1024, h: 768 },
  { name: "half-window", w: 960, h: 700 },
];

for (const sz of SIZES) {
  test(`surfaces stay within viewport @${sz.name} (${sz.w}×${sz.h})`, async ({ page }) => {
    await page.setViewportSize({ width: sz.w, height: sz.h });
    await openDemo(page);
    const offviewport = (await geometricSweep(page)).filter((f) => f.type === "surface-offviewport");
    expect(
      offviewport,
      `[${sz.name}] surfaces escaping viewport:\n${JSON.stringify(offviewport, null, 2)}`
    ).toEqual([]);
  });
}
