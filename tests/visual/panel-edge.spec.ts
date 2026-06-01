import { test, expect } from "@playwright/test";
import { openDemo } from "./helpers";
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
    await page.setViewportSize({ width: sz.w, height: sz.h });
    await openDemo(page);

    // Panel itself must stay in-viewport even before opening anything.
    const base = (await geometricSweep(page)).filter((f) => f.type === "surface-offviewport");
    expect(base, `[${sz.name}] panel escapes viewport at rest:\n${JSON.stringify(base, null, 2)}`).toEqual([]);

    const comboboxes = page.locator('.__tuner-root [role="combobox"]');
    const count = await comboboxes.count();
    const problems: Array<{ index: number; label: string; findings: unknown }> = [];

    for (let i = 0; i < count; i++) {
      const cb = comboboxes.nth(i);
      if (!(await cb.isVisible())) continue;
      const label = ((await cb.getAttribute("aria-label")) || (await cb.textContent()) || "")
        .trim()
        .slice(0, 24);
      await cb.scrollIntoViewIfNeeded();
      await cb.click();
      await page.waitForTimeout(220);
      // any open popover escaping the viewport is the bug we're hunting here
      const findings = (await geometricSweep(page)).filter((f) => f.type === "surface-offviewport");
      if (findings.length) problems.push({ index: i, label, findings });
      await cb.click().catch(() => {}); // toggle closed (not Escape — that dismisses the panel)
      await page.waitForTimeout(120);
    }

    expect(problems, `[${sz.name}] dropdowns escaping viewport:\n${JSON.stringify(problems, null, 2)}`).toEqual([]);
  });
}
