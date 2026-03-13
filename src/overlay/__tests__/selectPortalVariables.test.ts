// @vitest-environment happy-dom
/**
 * Test: Radix Select portal content must have access to tuner CSS variables.
 *
 * Bug: CSS variables (--popover, --border, etc.) are scoped to .__tuner-root
 * in globals.css. But Radix Select portals its content to document.body via
 * <SelectPrimitive.Portal>, outside .__tuner-root. The portal content can't
 * resolve any CSS variables, so backgrounds are transparent and borders invisible.
 *
 * Fix: The SelectContent component must include the __tuner-root class on the
 * portaled content so CSS variables are inherited.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SELECT_PATH = join(__dirname, "../../components/ui/select.tsx");

function readSrc(path: string) {
  return readFileSync(path, "utf-8");
}

describe("Bug: Select portal content has no access to CSS variables", () => {
  const src = readSrc(SELECT_PATH);

  it("SelectContent must include __tuner-root class for CSS variable inheritance", () => {
    // The portaled SelectPrimitive.Content needs __tuner-root so that
    // CSS variables defined on .__tuner-root { } in globals.css are available.
    // Without this, bg-popover -> var(--popover) -> undefined -> transparent background.
    expect(
      src.includes("__tuner-root"),
      "select.tsx SelectContent must include '__tuner-root' class so CSS variables " +
      "(--popover, --border, etc.) resolve inside the portal. Without it, " +
      "the dropdown background is transparent because the portal renders at document.body."
    ).toBe(true);
  });
});
