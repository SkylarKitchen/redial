import { test, expect } from "@playwright/test";
import { openDemo, selectElement, selectByDisplay, expectClean, sweepEachDropdown } from "./helpers";

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
    test.setTimeout(90_000);
    await openDemo(page);
    const problems = await sweepEachDropdown(page);
    expect(problems, `dropdown findings:\n${JSON.stringify(problems, null, 2)}`).toEqual([]);
  });
});
