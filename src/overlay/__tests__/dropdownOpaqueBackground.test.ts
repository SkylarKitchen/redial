// @vitest-environment happy-dom
/**
 * Test: Every dropdown/popover in the overlay must have an explicit opaque background.
 *
 * Bug: Dropdowns that rely on Tailwind's `bg-popover` class for their background
 * color can appear transparent/see-through when portaled outside of `.__tuner-root`
 * scope, because Tailwind v4 CSS variable resolution may fail in that context.
 *
 * Fix: All dropdowns must use an explicit inline `background` or `backgroundColor`
 * with an opaque value (from theme.ts), never relying solely on Tailwind classes.
 *
 * Two categories:
 * 1. Shadcn SelectContent — the base component must hardcode an opaque background
 * 2. Custom dropdown containers — must include `background: color.popover` or similar
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const COMPONENTS_DIR = join(__dirname, "../../components/ui");
const OVERLAY_DIR = join(__dirname, "..");

function readSrc(path: string) {
  return readFileSync(path, "utf-8");
}

describe("Dropdown opaque background", () => {
  it("select.tsx SelectContent must have an explicit inline backgroundColor", () => {
    const src = readSrc(join(COMPONENTS_DIR, "select.tsx"));

    // The SelectPrimitive.Content element must have an inline style with an opaque background.
    // bg-popover Tailwind class alone is NOT sufficient because CSS variables
    // may not resolve when the portal renders outside .__tuner-root.
    const hasInlineBg =
      /SelectPrimitive\.Content[\s\S]*?style=\{[\s\S]*?background(?:Color)?\s*:/m.test(src);

    expect(
      hasInlineBg,
      "select.tsx: SelectContent relies only on Tailwind bg-popover class for background. " +
      "Add an explicit inline backgroundColor (e.g., '#F5F5F5') so the dropdown is opaque " +
      "even when portaled outside .__tuner-root scope."
    ).toBe(true);
  });

  it("StateSelector.tsx SelectContent must have an explicit backgroundColor in its style", () => {
    const src = readSrc(join(OVERLAY_DIR, "StateSelector.tsx"));

    // Find the SelectContent JSX and check for backgroundColor/background in its style prop
    const selectContentMatch = src.match(/<SelectContent[\s\S]*?>/);
    expect(selectContentMatch, "StateSelector.tsx must contain a <SelectContent>").toBeTruthy();

    const tag = selectContentMatch![0];
    const hasStyleBg = /style=\{[\s\S]*?background(?:Color)?\s*:/m.test(tag);

    expect(
      hasStyleBg,
      "StateSelector.tsx: SelectContent has no inline background/backgroundColor. " +
      "The dropdown appears transparent because bg-popover Tailwind class doesn't resolve in portal context."
    ).toBe(true);
  });

  it("controls.tsx SelectContent must have an explicit backgroundColor in its style", () => {
    const src = readSrc(join(OVERLAY_DIR, "controls.tsx"));

    const selectContentBlocks = src.split("<SelectContent");
    // Skip first chunk (before any SelectContent)
    for (let i = 1; i < selectContentBlocks.length; i++) {
      const block = selectContentBlocks[i];
      const closingIdx = block.indexOf(">");
      const tag = block.slice(0, closingIdx + 1);

      const hasStyleBg = /style=\{[\s\S]*?background(?:Color)?\s*:/m.test(tag);
      expect(
        hasStyleBg,
        `controls.tsx: SelectContent #${i} is missing an inline background/backgroundColor. ` +
        "Dropdown may appear transparent in portal context."
      ).toBe(true);
    }
  });
});
