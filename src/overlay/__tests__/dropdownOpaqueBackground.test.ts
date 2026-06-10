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

  it("PortalListboxSelect.tsx dropdown content must have an explicit opaque backgroundColor", () => {
    // StateSelector and BreakpointSelector are now thin declarations over
    // PortalListboxSelect (code-review step 8 refactor). The listbox container
    // and its opaque background live in PortalListboxSelect.tsx.
    const src = readSrc(join(OVERLAY_DIR, "controls", "PortalListboxSelect.tsx"));

    // PortalListboxSelect was extracted from StateSelector's portal-dropdown pattern
    // (createPortal + role="listbox"). The dropdown content container must carry an
    // explicit opaque inline background so it isn't see-through when portaled to
    // document.body, outside .__tuner-root scope where Tailwind CSS variables
    // (e.g. bg-popover) may not resolve.
    const listboxIdx = src.indexOf('role="listbox"');
    expect(
      listboxIdx,
      'PortalListboxSelect.tsx must render a role="listbox" dropdown content container.'
    ).toBeGreaterThan(-1);

    // Scope the check to the listbox container's OWN opening tag/style block —
    // before its mapped option items — so a transparent option background can't
    // accidentally satisfy the guard.
    const containerStyle = src.slice(listboxIdx, listboxIdx + 400);
    const hasStyleBg = /style=\{[\s\S]*?background(?:Color)?\s*:/m.test(containerStyle);

    expect(
      hasStyleBg,
      'PortalListboxSelect.tsx: the role="listbox" dropdown container has no inline ' +
      "background/backgroundColor. The dropdown appears transparent because a " +
      "bg-popover Tailwind class doesn't resolve in portal context."
    ).toBe(true);
  });

  it("controls SelectContent must have an explicit backgroundColor in its style", () => {
    const src = readSrc(join(OVERLAY_DIR, "controls", "SelectRow.tsx"));

    const selectContentBlocks = src.split("<SelectContent");
    // Skip first chunk (before any SelectContent)
    for (let i = 1; i < selectContentBlocks.length; i++) {
      const block = selectContentBlocks[i];
      const closingIdx = block.indexOf(">");
      const tag = block.slice(0, closingIdx + 1);

      const hasStyleBg = /style=\{[\s\S]*?background(?:Color)?\s*:/m.test(tag);
      expect(
        hasStyleBg,
        `SelectRow.tsx: SelectContent #${i} is missing an inline background/backgroundColor. ` +
        "Dropdown may appear transparent in portal context."
      ).toBe(true);
    }
  });
});
