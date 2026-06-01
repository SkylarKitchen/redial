import { type Page, expect } from "@playwright/test";
import { geometricSweep, type Finding } from "./sweep";

/** Load /demo and wait for the panel surfaces to mount + settle. */
export async function openDemo(page: Page) {
  await page.goto("/demo", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelectorAll(".__tuner-root").length >= 3,
    undefined,
    { timeout: 15_000 }
  );
  await page.waitForTimeout(600);
}

/**
 * Select a host-page element by CSS selector via Redial's own `tuner:select`
 * event (the same channel the demo uses to auto-select the hero). Re-selecting
 * re-renders the style panel for that element's archetype. Returns false if the
 * selector matched nothing.
 */
export async function selectElement(page: Page, selector: string): Promise<boolean> {
  const ok = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    document.dispatchEvent(new CustomEvent("tuner:select", { detail: el }));
    return true;
  }, selector);
  if (ok) await page.waitForTimeout(450);
  return ok;
}

/**
 * Select the first host-page element (outside the panel) whose computed
 * `display` matches — robust way to hit flex/grid archetypes despite hashed
 * CSS-module class names. Returns false if none found.
 */
export async function selectByDisplay(page: Page, display: string): Promise<boolean> {
  const ok = await page.evaluate((disp) => {
    const el = [...document.querySelectorAll("body *")].find(
      (e) => !e.closest(".__tuner-root") && getComputedStyle(e).display === disp
    );
    if (!el) return false;
    document.dispatchEvent(new CustomEvent("tuner:select", { detail: el }));
    return true;
  }, display);
  if (ok) await page.waitForTimeout(450);
  return ok;
}

/** Run the sweep and assert no measurable findings, with a readable diff. */
export async function expectClean(page: Page, label: string) {
  const findings: Finding[] = await geometricSweep(page);
  expect(findings, `[${label}] geometric findings:\n${JSON.stringify(findings, null, 2)}`).toEqual([]);
}

/**
 * Open each combobox in the style panel one at a time, sweep, and close by
 * toggling the trigger (NOT Escape — that dismisses the whole panel). Returns
 * findings per dropdown.
 *
 * Robust to non-actionable comboboxes: disabled/obscured triggers (e.g. the "–"
 * unit selectors with no value) are skipped with a short per-action timeout
 * rather than hanging the test. Those are inert by design, not sweep findings.
 *
 * `onlyOffviewport` narrows to surfaces escaping the viewport (the edge-collision
 * question), otherwise all finding types are reported.
 */
export async function sweepEachDropdown(
  page: Page,
  opts: { onlyOffviewport?: boolean } = {}
): Promise<Array<{ index: number; label: string; findings: Finding[] }>> {
  const comboboxes = page.locator('.__tuner-root [role="combobox"]');
  const count = await comboboxes.count();
  const problems: Array<{ index: number; label: string; findings: Finding[] }> = [];

  for (let i = 0; i < count; i++) {
    const cb = comboboxes.nth(i);
    let label = "";
    try {
      if (!(await cb.isVisible())) continue;
      if (await cb.isDisabled().catch(() => false)) continue;
      label = ((await cb.getAttribute("aria-label")) || (await cb.textContent()) || "")
        .trim()
        .slice(0, 24);
      await cb.scrollIntoViewIfNeeded({ timeout: 3000 });
      await cb.click({ timeout: 3000 });
    } catch {
      continue; // non-actionable (disabled/obscured) — skip, not a defect
    }
    await page.waitForTimeout(220);
    let findings: Finding[] = await geometricSweep(page);
    if (opts.onlyOffviewport) findings = findings.filter((f) => f.type === "surface-offviewport");
    if (findings.length) problems.push({ index: i, label, findings });
    await cb.click({ timeout: 3000 }).catch(() => {}); // toggle closed
    await page.waitForTimeout(120);
  }
  return problems;
}

/**
 * Open each color swatch in the style panel one at a time and sweep its picker
 * popover. The picker is a `[data-tuner-portal]` (a separate sweep surface) that
 * computes its own fixed position with edge-collision logic — so unlike inline
 * controls it can escape the viewport if that math under-clamps. This is the
 * color-picker analogue of `sweepEachDropdown`.
 *
 * Swatches are `[role="button"].tuner-focusable` (20×20, distinct from the
 * unclassed 18×18 spacing box-model cells). A click is only counted as a real
 * picker test if it actually opens the ColorPickerEnhanced portal (canvas
 * `aria-label="Saturation and brightness"`); a focusable that opens nothing is
 * skipped, so this never spuriously fails on a non-swatch.
 *
 * Closes by re-clicking the swatch (toggles `setPickerOpen`) — NOT Escape, which
 * dismisses the whole panel.
 */
export async function sweepEachColorSwatch(
  page: Page,
  opts: { onlyOffviewport?: boolean } = {}
): Promise<{ opened: number; problems: Array<{ index: number; findings: Finding[] }> }> {
  const swatches = page.locator('.__tuner-root [role="button"].tuner-focusable');
  const count = await swatches.count();
  const problems: Array<{ index: number; findings: Finding[] }> = [];
  // The hue/sat region carries aria-label="Saturation and brightness" (on its
  // wrapper div, not the <canvas>) — its presence in an open portal is the
  // signal the full ColorPickerEnhanced actually mounted.
  const pickerMarker = page.locator('[data-tuner-portal] [aria-label="Saturation and brightness"]');
  let opened = 0;

  for (let i = 0; i < count; i++) {
    const sw = swatches.nth(i);
    try {
      if (!(await sw.isVisible())) continue;
      await sw.scrollIntoViewIfNeeded({ timeout: 3000 });
      await sw.click({ timeout: 3000 });
    } catch {
      continue; // non-actionable — skip
    }
    await page.waitForTimeout(200);
    // Only sweep if the click actually opened the color picker portal.
    if ((await pickerMarker.count()) === 0) {
      await sw.click({ timeout: 3000 }).catch(() => {}); // undo any toggle
      continue;
    }
    opened++;
    let findings: Finding[] = await geometricSweep(page);
    if (opts.onlyOffviewport) findings = findings.filter((f) => f.type === "surface-offviewport");
    if (findings.length) problems.push({ index: i, findings });
    await sw.click({ timeout: 3000 }).catch(() => {}); // toggle closed
    await page.waitForTimeout(120);
  }
  return { opened, problems };
}
