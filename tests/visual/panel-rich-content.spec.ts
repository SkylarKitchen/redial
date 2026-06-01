import { test, expect } from "@playwright/test";
import { openDemo, expectClean } from "./helpers";

/**
 * Sub-editors render lists / pill-summaries that grow with the element's CSS
 * (multiple shadows, gradient stops, transform functions, filters, transitions).
 * These are the most likely place for content to spill a fixed-width panel.
 *
 * Instead of driving icon-only "add" buttons, we inject rich CSS onto a host
 * element and select it — Redial infers from getComputedStyle and renders the
 * populated editors. The sweep then checks nothing spills or clips.
 */
test.describe("Panel geometry — rich sub-editor content @1440×900", () => {
  const RICH: Record<string, string> = {
    boxShadow:
      "0 1px 2px rgba(0,0,0,.2), 0 2px 4px rgba(0,0,0,.2), 0 4px 8px rgba(0,0,0,.2), inset 0 0 12px rgba(255,0,0,.3)",
    background:
      "linear-gradient(135deg, #ff0000 0%, #00ff88 25%, #0066ff 50%, #ffcc00 75%, #ff00ff 100%)",
    transform: "translate(12px, 24px) rotate(45deg) scale(1.5, 0.8) skewX(10deg)",
    filter: "blur(2px) brightness(1.2) contrast(1.1) saturate(1.4) hue-rotate(30deg)",
    transition: "all .3s ease, transform .5s cubic-bezier(.2,.8,.2,1), opacity .2s linear",
  };

  test("multi-value shadow/gradient/transform/filter/transition do not spill", async ({ page }) => {
    await openDemo(page);

    const applied = await page.evaluate((rich) => {
      const el = [...document.querySelectorAll("section, div")].find(
        (e) => !e.closest(".__tuner-root")
      ) as HTMLElement | undefined;
      if (!el) return false;
      Object.assign(el.style, rich);
      document.dispatchEvent(new CustomEvent("tuner:select", { detail: el }));
      return true;
    }, RICH);
    expect(applied, "no host element to apply rich CSS to").toBe(true);
    await page.waitForTimeout(700);

    await expectClean(page, "rich-content");
  });
});
