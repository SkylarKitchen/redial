import { test, expect, type Page } from "@playwright/test";
import { openDemo } from "./helpers";

/**
 * keyboard-traversal.spec.ts — real-browser Tab traversal of the style panel.
 *
 * QA_CHECKLIST's keyboard scopes were locked in as happy-dom behavioral tests
 * (keyboardTabOrderAria.test.tsx et al.), but those can only verify the
 * FOCUSABILITY CONTRACT — tabIndex values, native buttons, roving tabIndex
 * attributes. Whether pressing Tab actually walks the whole panel and gets
 * out the other side is sequential focus navigation, which only a real
 * browser implements. This spec closes that gap (flagged in the checklist as
 * "needs a real browser") — and its first run caught a real WCAG 2.1.2
 * keyboard trap: SpacingBoxModel's Tab handler wrapped `% 8` forever, making
 * everything below Spacing keyboard-unreachable.
 *
 * Invariants (composite widgets like the box model may legitimately reorder
 * Tab within themselves, so DOM-order monotonicity is NOT asserted globally):
 *   1. No element is ever focused twice — a revisit is a focus cycle, i.e. a
 *      keyboard trap.
 *   2. Traversal EXITS the panel before the press cap — Tab always gets you
 *      out the other side.
 *   3. Every section header is visited, in DOM order.
 *   4. Only visible elements take focus; nothing with tabindex="-1".
 *   5. Roving tabIndex holds under real traversal: each radiogroup
 *      contributes exactly one tab stop.
 *   6. The injected `.tuner-focusable:focus-visible` rule actually paints a
 *      ring on keyboard focus.
 */

const PRESS_CAP = 400;

/** Expand every collapsed Section so traversal covers the full panel. */
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

type Stop = {
  inPanel: boolean;
  nodeId: number;
  visible: boolean;
  tabindexAttr: string | null;
  isHeader: boolean;
  radiogroupId: number;
  hasRing: boolean;
  isTunerFocusable: boolean;
  label: string;
};

/** Read the current activeElement relative to the style panel. */
async function readFocus(page: Page): Promise<Stop> {
  return (await page.evaluate(`(() => {
    const root = [...document.querySelectorAll(".__tuner-root")].find((r) =>
      r.querySelector('div[role="button"][aria-expanded]')
    );
    const a = document.activeElement;
    if (!a || !root || !root.contains(a)) return { inPanel: false };

    // Stable per-node identity — a repeated id means a focus cycle.
    window.__qaNextId ??= 1;
    if (a.__qaNodeId === undefined) a.__qaNodeId = window.__qaNextId++;

    // Stable ids for radiogroups as we meet them.
    window.__qaGroups ??= [];
    const group = a.closest('[role="radiogroup"]');
    let radiogroupId = -1;
    if (group) {
      let idx = window.__qaGroups.indexOf(group);
      if (idx === -1) { idx = window.__qaGroups.length; window.__qaGroups.push(group); }
      radiogroupId = idx;
    }

    const cs = getComputedStyle(a);
    const rect = a.getBoundingClientRect();
    return {
      inPanel: true,
      nodeId: a.__qaNodeId,
      visible: rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden",
      tabindexAttr: a.getAttribute("tabindex"),
      isHeader: a.matches('div[role="button"][aria-expanded]'),
      radiogroupId,
      hasRing: cs.outlineStyle !== "none" || (cs.boxShadow && cs.boxShadow !== "none"),
      isTunerFocusable: a.classList.contains("tuner-focusable"),
      label: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 24),
    };
  })()`)) as Stop;
}

test.describe("Real-browser Tab traversal — style panel @1440×900", () => {
  test("Tab traverses the whole panel without cycles and exits the other side", async ({ page }) => {
    await openDemo(page);
    await expandAllSections(page);

    // Section headers in DOM order — the expected header visit order.
    const headerOrder = (await page.evaluate(`(() => {
      const root = [...document.querySelectorAll(".__tuner-root")].find((r) =>
        r.querySelector('div[role="button"][aria-expanded]')
      );
      return [...root.querySelectorAll('div[role="button"][aria-expanded]')].map((h) =>
        (h.textContent || "").trim().slice(0, 24)
      );
    })()`)) as string[];
    expect(headerOrder.length, "the panel renders its full section stack").toBeGreaterThanOrEqual(9);

    // Anchor traversal at the panel's first section header.
    await page.evaluate(`(() => {
      const root = [...document.querySelectorAll(".__tuner-root")].find((r) =>
        r.querySelector('div[role="button"][aria-expanded]')
      );
      root.querySelector('div[role="button"][aria-expanded]').focus();
    })()`);

    const stops: Stop[] = [await readFocus(page)];
    let exited = false;
    for (let i = 0; i < PRESS_CAP; i++) {
      await page.keyboard.press("Tab");
      const stop = await readFocus(page);
      if (!stop.inPanel) { exited = true; break; }
      stops.push(stop);
    }

    // 1. + 2. No cycles, and Tab gets you out the other side. A revisited
    // nodeId is a keyboard trap (WCAG 2.1.2) — report which element loops.
    const seen = new Map<number, string>();
    const revisited: string[] = [];
    for (const s of stops) {
      if (seen.has(s.nodeId)) revisited.push(s.label);
      seen.set(s.nodeId, s.label);
    }
    expect(revisited, "no element may be Tab-focused twice (focus cycle = keyboard trap)").toHaveLength(0);
    expect(exited, `Tab must exit the panel within ${PRESS_CAP} presses`).toBe(true);

    // Anti-vacuous guard: with every section expanded, the panel has far more
    // than a handful of tab stops (headers alone are 9).
    expect(stops.length, `tab stops inside the panel: ${JSON.stringify(stops.map((s) => s.label))}`).toBeGreaterThanOrEqual(25);

    // 3. Every section header is visited, in DOM order.
    const visitedHeaders = stops.filter((s) => s.isHeader).map((s) => s.label);
    expect(visitedHeaders, "every section header is a tab stop, in document order").toEqual(headerOrder);

    // 4. Only visible elements receive focus, and nothing opted out.
    expect(stops.filter((s) => !s.visible), "no invisible element may take focus").toHaveLength(0);
    expect(stops.filter((s) => s.tabindexAttr === "-1"), 'no tabindex="-1" element may take focus').toHaveLength(0);

    // 5. Roving tabIndex under real traversal: one stop per radiogroup.
    const perGroup = new Map<number, number>();
    for (const s of stops) {
      if (s.radiogroupId >= 0) perGroup.set(s.radiogroupId, (perGroup.get(s.radiogroupId) ?? 0) + 1);
    }
    expect(perGroup.size, "traversal must encounter at least one radiogroup").toBeGreaterThanOrEqual(1);
    for (const [id, count] of perGroup) {
      expect(count, `radiogroup #${id} must contribute exactly one tab stop`).toBe(1);
    }

    // 6. Focus ring: every keyboard-focused .tuner-focusable paints a ring
    // (index 0 was focused programmatically, so :focus-visible heuristics
    // start from the first real Tab press).
    const focusables = stops.slice(1).filter((s) => s.isTunerFocusable);
    expect(focusables.length, "traversal must hit tuner-focusable controls").toBeGreaterThanOrEqual(5);
    const ringless = focusables.filter((s) => !s.hasRing).map((s) => s.label);
    expect(ringless, "keyboard focus must paint the focus ring on tuner-focusable controls").toHaveLength(0);
  });
});
