import { test, expect } from "@playwright/test";
import { openDemo, sweepEachDropdown } from "./helpers";
import { geometricSweep } from "./sweep";

/**
 * Popover collision near viewport edges. The style panel is right-docked and
 * caps its height to the viewport; on a SHORT viewport its lower controls sit
 * near the bottom, so a downward-opening dropdown can escape the viewport
 * bottom unless Redial flips it upward. The closed-state viewport tests never
 * exercise an OPEN popover near an edge — this does.
 */
const SHORT = [
  { name: "short-1280x600", w: 1280, h: 600 },
  { name: "short-1024x560", w: 1024, h: 560 },
];

for (const sz of SHORT) {
  test(`open dropdowns don't escape the viewport @${sz.name}`, async ({ page }) => {
    test.setTimeout(90_000); // ~15 comboboxes × open+sweep+close per viewport
    await page.setViewportSize({ width: sz.w, height: sz.h });
    await openDemo(page);

    // Panel itself must stay in-viewport even before opening anything.
    const base = (await geometricSweep(page)).filter((f) => f.type === "surface-offviewport");
    expect(base, `[${sz.name}] panel escapes viewport at rest:\n${JSON.stringify(base, null, 2)}`).toEqual([]);

    // Any OPEN popover escaping the viewport is the bug we're hunting here.
    const problems = await sweepEachDropdown(page, { onlyOffviewport: true });
    expect(problems, `[${sz.name}] dropdowns escaping viewport:\n${JSON.stringify(problems, null, 2)}`).toEqual([]);
  });
}
