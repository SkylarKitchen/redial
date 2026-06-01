import { test, expect } from "@playwright/test";
import { openDemo, selectElement, selectByDisplay, expectClean } from "./helpers";
import { geometricSweep } from "./sweep";

/**
 * Drives the panel through interaction + element states and runs the geometric
 * sweep after each. This is the "command Claude to find them" surface: add a
 * state here and it is swept on every run. See docs/adr/0002.
 */

test.describe("Panel geometry — element archetypes @1440×900", () => {
  const archetypes: Array<{ name: string; sel?: string; display?: string }> = [
    { name: "text-heading", sel: "h1[data-tuner-demo]" },
    { name: "paragraph", sel: "section p" },
    { name: "flex-container", display: "flex" },
    { name: "grid-container", display: "grid" },
    { name: "image", sel: "img" },
    { name: "button", sel: "button" },
    { name: "section-block", sel: "section" },
    { name: "list", sel: "ul" },
    { name: "text-input", sel: "input" },
    { name: "link", sel: "a" },
    { name: "blockquote", sel: "blockquote" },
  ];

  for (const a of archetypes) {
    test(`no overflow after selecting ${a.name}`, async ({ page }) => {
      await openDemo(page);
      const ok = a.display
        ? await selectByDisplay(page, a.display)
        : await selectElement(page, a.sel!);
      expect(ok, `archetype "${a.name}" not present on /demo`).toBe(true);
      await expectClean(page, `archetype:${a.name}`);
    });
  }
});

test.describe("Panel geometry — dropdowns/popovers @1440×900", () => {
  test("opening each combobox clips nothing and escapes no viewport", async ({ page }) => {
    await openDemo(page);

    const comboboxes = page.locator('.__tuner-root [role="combobox"]');
    const count = await comboboxes.count();
    expect(count, "expected comboboxes in the style panel").toBeGreaterThan(0);

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
      const findings = await geometricSweep(page);
      if (findings.length) problems.push({ index: i, label, findings });
      // Close by toggling the trigger (re-click). NOT Escape — Escape dismisses
      // the whole panel, which would break the rest of the loop.
      await cb.click().catch(() => {});
      await page.waitForTimeout(120);
    }

    expect(problems, `dropdown findings:\n${JSON.stringify(problems, null, 2)}`).toEqual([]);
  });
});
