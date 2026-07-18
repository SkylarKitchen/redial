import { test, expect, type Page } from "@playwright/test";
import { openDemo } from "./helpers";

/**
 * panel-alignment.spec.ts — QA_CHECKLIST "Visual → Alignment", verified as
 * real-browser geometry (happy-dom has no box model, so this scope lives in
 * the Playwright sweep instead of src/overlay/__tests__).
 *
 * Unlike sweep.ts (absolute defects: spill/clip/off-viewport), these are
 * CONSISTENCY oracles: no measured value is asserted against a constant taken
 * on faith — each element must agree with its siblings.
 *
 *   1. Property labels align vertically across all sections. Labels are
 *      identified by the labelStyle signature (64px-wide capitalize spans)
 *      inside top-level rows (the shared rowStyle `2px 12px` padding);
 *      compact sub-layout rows override that padding and are exempt by
 *      construction.
 *   2. Section headers share identical padding and identical left edge/width.
 *   3. Footer buttons are evenly spaced: equal heights, aligned tops, the
 *      designed 6px Reset↔Save gap, and symmetric left/right insets.
 */

/** The style-panel surface: the `.__tuner-root` that renders Section headers. */
function stylePanelRoot(): Element | undefined {
  return [...document.querySelectorAll(".__tuner-root")].find((r) =>
    r.querySelector('div[role="button"][aria-expanded]')
  );
}

/** Expand every collapsed Section (headers are DIVs; sub-expanders are BUTTONs). */
async function expandAllSections(page: Page) {
  for (let i = 0; i < 12; i++) {
    const remaining = await page.evaluate(`(() => {
      const root = [...document.querySelectorAll(".__tuner-root")].find((r) =>
        r.querySelector('div[role="button"][aria-expanded]')
      );
      if (!root) return -1;
      const closed = [...root.querySelectorAll('div[role="button"][aria-expanded="false"]')];
      if (closed.length === 0) return 0;
      closed[0].click();
      return closed.length;
    })()`);
    if ((remaining as number) <= 0) break;
    await page.waitForTimeout(150);
  }
}

test.describe("Panel alignment — QA checklist Visual → Alignment @1440×900", () => {
  test("property labels share a single left edge across all sections", async ({ page }) => {
    await openDemo(page);
    await expandAllSections(page);

    const result = await page.evaluate(`(() => {
      const root = [...document.querySelectorAll(".__tuner-root")].find((r) =>
        r.querySelector('div[role="button"][aria-expanded]')
      );
      if (!root) return { error: "no style panel" };

      // A label span per labelStyle: fixed 64px width, capitalize, inside a
      // top-level row (rowStyle padding "2px 12px"). Compact sub-layouts
      // override the row padding, so they don't dilute the invariant.
      const labels = [...root.querySelectorAll("span")].filter((s) => {
        const cs = getComputedStyle(s);
        if (cs.width !== "64px" || cs.textTransform !== "capitalize") return false;
        const rect = s.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        let el = s.parentElement, depth = 0;
        while (el && el !== root && depth < 5) {
          const pcs = getComputedStyle(el);
          if (pcs.display === "flex" && pcs.padding === "2px 12px") return true;
          el = el.parentElement; depth++;
        }
        return false;
      });

      const groups = {};
      for (const s of labels) {
        const x = Math.round(s.getBoundingClientRect().left);
        (groups[x] ??= []).push((s.textContent || "").trim().slice(0, 20));
      }
      return { count: labels.length, groups };
    })()`) as { error?: string; count: number; groups: Record<string, string[]> };

    expect(result.error).toBeUndefined();
    // Guard against a vacuous pass (e.g. sections silently not expanding).
    // Census 2026-07-18: the labelStyle+rowStyle system is used by exactly 13
    // top-level rows — Typography 5, Backgrounds 2, Effects 6. Spacing/Size/
    // Position use bespoke layouts (box model, input-cell grid, offset
    // diagram) with no standard labels, so 13 IS the full population.
    expect(result.count, "should find the standard-row label population").toBeGreaterThanOrEqual(12);
    expect(
      Object.keys(result.groups),
      `labels must share one left edge; got ${JSON.stringify(result.groups, null, 2)}`
    ).toHaveLength(1);
  });

  test("all section headers share padding, left edge, and width", async ({ page }) => {
    await openDemo(page);

    const result = await page.evaluate(`(() => {
      const root = [...document.querySelectorAll(".__tuner-root")].find((r) =>
        r.querySelector('div[role="button"][aria-expanded]')
      );
      if (!root) return { error: "no style panel" };
      const headers = [...root.querySelectorAll('div[role="button"][aria-expanded]')];
      return {
        sections: headers.map((h) => {
          const cs = getComputedStyle(h);
          const rect = h.getBoundingClientRect();
          return {
            title: (h.textContent || "").trim().slice(0, 24),
            padding: cs.padding,
            left: Math.round(rect.left),
            width: Math.round(rect.width),
          };
        }),
      };
    })()`) as { error?: string; sections: Array<{ title: string; padding: string; left: number; width: number }> };

    expect(result.error).toBeUndefined();
    const { sections } = result;
    expect(sections.length, "the style panel renders its full section stack").toBeGreaterThanOrEqual(8);

    const distinct = (vals: Array<string | number>) => [...new Set(vals)];
    expect(
      distinct(sections.map((s) => s.padding)),
      `section header padding must be uniform; got ${JSON.stringify(sections, null, 2)}`
    ).toHaveLength(1);
    expect(distinct(sections.map((s) => s.left)), "headers share a left edge").toHaveLength(1);
    expect(distinct(sections.map((s) => s.width)), "headers share a width").toHaveLength(1);
  });

  test("footer buttons are evenly spaced and vertically aligned", async ({ page }) => {
    await openDemo(page);

    const result = await page.evaluate(`(() => {
      const root = [...document.querySelectorAll(".__tuner-root")].find((r) =>
        r.querySelector('div[role="button"][aria-expanded]')
      );
      if (!root) return { error: "no style panel" };
      const buttons = [...root.querySelectorAll("button")];
      const byText = (t) => buttons.find((b) => (b.textContent || "").includes(t));
      const clipboard = byText("Clipboard");
      const reset = byText("Reset");
      const save = byText("Save");
      if (!clipboard || !reset || !save) return { error: "footer buttons not found" };

      const r = (el) => {
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, height: b.height };
      };
      // Footer row: the flex container holding both the clipboard group and
      // the reset/save group.
      const row = clipboard.parentElement.parentElement;
      const wrapperCs = getComputedStyle(row.parentElement);
      const rowRect = row.getBoundingClientRect();
      return {
        clipboard: r(clipboard), reset: r(reset), save: r(save),
        row: { left: rowRect.left, right: rowRect.right },
        wrapperPadding: { left: wrapperCs.paddingLeft, right: wrapperCs.paddingRight },
      };
    })()`) as {
      error?: string;
      clipboard: { left: number; right: number; top: number; height: number };
      reset: { left: number; right: number; top: number; height: number };
      save: { left: number; right: number; top: number; height: number };
      row: { left: number; right: number };
      wrapperPadding: { left: string; right: string };
    };

    expect(result.error).toBeUndefined();
    const { clipboard, reset, save, row, wrapperPadding } = result;

    // Even vertical rhythm: same height, same top edge.
    expect(reset.height).toBeCloseTo(clipboard.height, 0);
    expect(save.height).toBeCloseTo(clipboard.height, 0);
    expect(reset.top).toBeCloseTo(clipboard.top, 0);
    expect(save.top).toBeCloseTo(clipboard.top, 0);

    // Designed 6px gap between Reset and Save.
    expect(save.left - reset.right).toBeGreaterThanOrEqual(5);
    expect(save.left - reset.right).toBeLessThanOrEqual(7);

    // Symmetric insets: Clipboard flush with the row's left edge, Save flush
    // with its right edge, and the wrapper pads both sides equally.
    expect(clipboard.left - row.left).toBeLessThanOrEqual(1);
    expect(row.right - save.right).toBeLessThanOrEqual(1);
    expect(wrapperPadding.left).toBe(wrapperPadding.right);
  });
});
