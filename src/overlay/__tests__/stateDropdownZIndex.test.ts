// @vitest-environment happy-dom
/**
 * Test: StateSelector dropdown z-index must match the panel z-index.
 *
 * Bug: The SelectContent in select.tsx has className "z-50" (Tailwind) AND
 * inline style zIndex: 2147483647. Tailwind is configured with
 * `important: true`, so z-50 compiles to `z-index: 50 !important` — which
 * OVERRIDES inline styles. The panel itself uses z-[2147483647] (→ 2147483647
 * !important). Result: dropdown renders at z-index 50, panel at 2147483647.
 * Dropdown appears behind the panel content.
 *
 * Fix: Remove the z-50 class from SelectContent so the inline style applies,
 * OR replace both with a consistent Tailwind class z-[2147483647].
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PANEL_Z = 2147483647;
const SELECT_CONTENT_PATH = join(__dirname, "../../components/ui/select.tsx");
const TAILWIND_CONFIG_PATH = join(__dirname, "../../../tailwind.config.ts");

describe("Bug: State dropdown z-index is behind the panel", () => {
  const selectSrc = readFileSync(SELECT_CONTENT_PATH, "utf-8");
  const tailwindSrc = readFileSync(TAILWIND_CONFIG_PATH, "utf-8");

  it("tailwind config has important: true (precondition)", () => {
    expect(tailwindSrc).toContain("important: true");
  });

  it("SelectContent must not have a Tailwind z-* class that conflicts with inline zIndex", () => {
    // Extract the SelectContent className string.
    // The component definition applies cn("relative z-50 ...", ...)
    // With important: true, z-50 → z-index: 50 !important, overriding any inline style.
    //
    // This test FAILS with the current code (z-50 is present)
    // and PASSES after removing the conflicting class.
    const hasTailwindZClass = /SelectPrimitive\.Content[\s\S]*?className=\{cn\(\s*"[^"]*\bz-\d+\b/.test(
      selectSrc
    );
    expect(
      hasTailwindZClass,
      "SelectContent has a Tailwind z-* class which, with important: true, overrides inline zIndex"
    ).toBe(false);
  });

  it("SelectContent inline zIndex matches the panel z-index", () => {
    // Verify the inline style still targets the correct z-index value
    expect(selectSrc).toContain(`zIndex: ${PANEL_Z}`);
  });
});
