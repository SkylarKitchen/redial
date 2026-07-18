import { test, expect, type Page } from "@playwright/test";
import { openDemo } from "./helpers";

/**
 * animation-smoothness.spec.ts — the QA_CHECKLIST "Transitions" smoothness
 * spot-check that happy-dom can't do (flagged in the checklist notes: the
 * iteration-2 tests verified the state machinery; whether an animation
 * actually interpolates is real-browser rendering).
 *
 * "Smooth animation, no jump" decomposes into testable invariants:
 *   1. The section chevron's 150ms `expand` transition really interpolates —
 *      many distinct intermediate transform values — and settles exactly at
 *      its rotation target (the "no jump" half). easeRelease overshoots by
 *      design (cubic-bezier y > 1), so monotonicity is NOT asserted; the
 *      overshoot is bounded instead.
 *   2. No IN-FLOW element in the panel transitions a layout-triggering
 *      property (width/height/top/left/margin/padding/font-size) — animating
 *      those reflows the surrounding document every frame, which is the
 *      mechanical definition of jank. Out-of-flow elements (absolute/fixed)
 *      are exempt: their reflow is self-contained. Census 2026-07-18: the
 *      panel's only layout-prop transitions are the fixed panel/navigator
 *      roots animating their own collapse geometry and the absolute sliding
 *      tab-indicator pills (left/width) — all out of flow, all deliberate.
 *      `transition-property: all` is tolerated: the three known sites are
 *      tiny buttons whose only changing properties are paint-cheap.
 *   3. Every non-zero transition duration in the panel comes from the
 *      timing.ts token set — "Every animation duration in the overlay must
 *      reference these tokens" (timing.ts header), verified at runtime.
 *   4. Under emulated prefers-reduced-motion, the same chevron toggle snaps
 *      with no intermediate frames — the Overlay media-query wiring plus
 *      ms()/cssTransition zeroing, proven end-to-end. (QA loop iteration 9
 *      found three hardcoded durations this pipeline missed; the happy-dom
 *      reducedMotionTransitions.test.tsx guards those per-component.)
 */

/** timing.ts token durations, in ms. */
const TIMING_TOKENS = [50, 60, 80, 100, 120, 150, 200, 300, 400, 1700];

/** Properties whose animation forces layout every frame. */
const LAYOUT_PROPS = /^(width|height|top|left|right|bottom|margin|padding|font-size|flex-basis|min-width|min-height|max-width|max-height|inset)/;

/**
 * Find the style panel root and its first section header + chevron span,
 * record the chevron's transform BEFORE the toggle (with 0ms transitions the
 * move completes before the first rAF frame), then start a rAF sampler
 * recording its computed transform each frame while the toggle animates.
 */
async function armChevronSampler(page: Page): Promise<{ before: string; samples: string[] }> {
  const before = await page.evaluate(`(() => {
    const root = [...document.querySelectorAll(".__tuner-root")].find((r) =>
      r.querySelector('div[role="button"][aria-expanded]')
    );
    if (!root) return null;
    const header = root.querySelector('div[role="button"][aria-expanded]');
    const svgs = [...header.querySelectorAll("svg")];
    if (!svgs.length) return null;
    const chevron = svgs[svgs.length - 1].parentElement; // chevron is the header's last icon
    const before = getComputedStyle(chevron).transform;
    window.__smoothSamples = [];
    const tick = () => {
      window.__smoothSamples.push(getComputedStyle(chevron).transform);
      if (window.__smoothSamples.length < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    header.click();
    return before;
  })()`);
  expect(before, "panel header + chevron must be present").not.toBeNull();
  await page.waitForTimeout(1200); // 60 frames at 60fps, with slack
  const samples = (await page.evaluate("window.__smoothSamples")) as string[];
  return { before: before as string, samples };
}

/** Rotation angle in degrees from a computed transform matrix. */
function angleOf(transform: string): number {
  if (transform === "none") return 0;
  const m = transform.match(/matrix\(([-\d.e]+),\s*([-\d.e]+)/);
  if (!m) return NaN;
  return (Math.atan2(parseFloat(m[2]), parseFloat(m[1])) * 180) / Math.PI;
}

test.describe("Animation smoothness — style panel @1440×900", () => {
  test("chevron rotation interpolates through intermediate frames and settles at its target", async ({ page }) => {
    await openDemo(page);
    const { before, samples } = await armChevronSampler(page);

    const distinct = [...new Set(samples)];
    expect(
      distinct.length,
      `a 150ms transition must produce intermediate frames, not a snap (samples: ${JSON.stringify(distinct)})`
    ).toBeGreaterThanOrEqual(4);

    const angles = samples.map(angleOf);
    expect(angles.some(Number.isNaN), "all sampled transforms must parse").toBe(false);

    // Settles exactly at a 90°-apart target — the "no jump" contract.
    const start = angleOf(before);
    const end = angles[angles.length - 1];
    expect(
      Math.abs(Math.abs(end - start) - 90),
      `rotation must travel exactly 90° (start ${start.toFixed(1)}°, end ${end.toFixed(1)}°)`
    ).toBeLessThan(1.5);

    // The tail is stable: the last few frames agree (the animation finished
    // inside the sampling window and didn't keep drifting).
    const tail = angles.slice(-5);
    expect(
      Math.max(...tail) - Math.min(...tail),
      "the final frames must be settled, not still moving"
    ).toBeLessThan(0.5);

    // easeRelease overshoots by design, but boundedly (bezier peak ≈ 1.1).
    const lo = Math.min(start, end) - 25;
    const hi = Math.max(start, end) + 25;
    expect(
      angles.every((a) => a >= lo && a <= hi),
      `overshoot must stay bounded (angles: ${angles.map((a) => a.toFixed(1)).join(", ")})`
    ).toBe(true);
  });

  test("no layout-triggering transitions; all durations come from the timing tokens", async ({ page }) => {
    await openDemo(page);
    const result = (await page.evaluate(`(() => {
      const roots = [...document.querySelectorAll(".__tuner-root")];
      const layoutOffenders = [];
      const offTokenDurations = new Set();
      let transitioned = 0;
      for (const root of roots) {
        for (const el of [root, ...root.querySelectorAll("*")]) {
          const cs = getComputedStyle(el);
          const props = cs.transitionProperty.split(",").map((s) => s.trim());
          const durs = cs.transitionDuration.split(",").map((s) => s.trim());
          const inFlow = !["absolute", "fixed", "sticky"].includes(cs.position);
          props.forEach((prop, i) => {
            const ms = parseFloat(durs[i % durs.length]) * (durs[i % durs.length].endsWith("ms") ? 1 : 1000);
            if (!ms) return;
            transitioned++;
            if (inFlow && ${LAYOUT_PROPS.toString()}.test(prop)) {
              layoutOffenders.push(el.tagName.toLowerCase() + " transitions " + prop + " over " + ms + "ms");
            }
            if (![${TIMING_TOKENS.join(",")}].includes(Math.round(ms))) offTokenDurations.add(prop + " " + ms + "ms");
          });
        }
      }
      return { layoutOffenders, offTokenDurations: [...offTokenDurations], transitioned };
    })()`)) as { layoutOffenders: string[]; offTokenDurations: string[]; transitioned: number };

    // Anti-vacuous: the sweep must actually be seeing the panel's transitions.
    expect(result.transitioned, "the panel must contain transitioned elements").toBeGreaterThanOrEqual(30);
    expect(result.layoutOffenders, "no panel element may animate a layout-triggering property").toEqual([]);
    expect(result.offTokenDurations, "every transition duration must be a timing.ts token").toEqual([]);
  });

  test("prefers-reduced-motion: the chevron toggle snaps with no intermediate frames", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDemo(page);
    const { before, samples } = await armChevronSampler(page);

    const angles = samples.map(angleOf);
    const start = angleOf(before);
    const end = angles[angles.length - 1];
    expect(
      Math.abs(Math.abs(end - start) - 90),
      "the toggle must still reach its target under reduced motion"
    ).toBeLessThan(1.5);

    // Every frame sits at an endpoint — nothing in between means no animation.
    const intermediate = angles.filter(
      (a) => Math.abs(a - start) > 0.5 && Math.abs(a - end) > 0.5
    );
    expect(
      intermediate.length,
      `reduced motion must snap, not animate (intermediate angles: ${intermediate.map((a) => a.toFixed(1)).join(", ")})`
    ).toBe(0);
  });
});
