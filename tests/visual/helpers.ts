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
