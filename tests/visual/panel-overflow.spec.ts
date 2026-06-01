import { test } from "@playwright/test";
import { openDemo, expectClean } from "./helpers";

test.describe("Panel geometry — default state @1440×900", () => {
  test("no surface overflows, spills, or escapes the viewport", async ({ page }) => {
    await openDemo(page);
    await expectClean(page, "default");
  });
});
