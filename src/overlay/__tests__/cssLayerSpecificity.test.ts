import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * CSS @layer specificity test.
 *
 * Redial is injected into arbitrary host pages. Host pages commonly have
 * aggressive global resets like `* { padding: 0; margin: 0; }` that are
 * UNLAYERED. Per the CSS cascade spec, unlayered styles always beat
 * @layer-wrapped styles regardless of selector specificity.
 *
 * Tailwind v4 wraps all utilities in `@layer utilities { ... }`, which means
 * a host page's `* { padding: 0; }` overrides our `.px-3 { padding: ... }`.
 * This breaks all spacing, layout, and sizing in the panel.
 *
 * This test ensures the built CSS uses `!important` on utility declarations
 * so they survive host page resets.
 */
describe("built CSS survives host page resets", () => {
  const cssPath = join(__dirname, "../../../dist/index.css");

  let css: string;
  try {
    css = readFileSync(cssPath, "utf-8");
  } catch {
    css = "";
  }

  it("should have built CSS available", () => {
    expect(css.length).toBeGreaterThan(0);
  });

  it("utility classes inside @layer should use !important to beat host page resets", () => {
    // Extract the @layer utilities block
    const layerMatch = css.match(/@layer utilities\s*\{([\s\S]*?)\n\}/);
    if (!layerMatch) {
      // If there's no @layer utilities wrapper, utilities are unlayered and
      // will naturally beat host page `*` resets via selector specificity.
      // This is fine.
      return;
    }

    const utilitiesBlock = layerMatch[1];

    // Check critical spacing/layout utilities that break with host resets
    const criticalPatterns = [
      { class: "px-3", prop: "padding" },
      { class: "py-0\\.5", prop: "padding" },
      { class: "gap-2", prop: "gap" },
      { class: "gap-1", prop: "gap" },
      { class: "pt-2\\.5", prop: "padding" },
      { class: "pb-1\\.5", prop: "padding" },
    ];

    const failures: string[] = [];

    for (const { class: cls, prop } of criticalPatterns) {
      const classRegex = new RegExp(
        `\\.${cls}\\s*\\{([^}]+)\\}`,
        "s"
      );
      const match = utilitiesBlock.match(classRegex);
      if (!match) continue; // class not in output, skip

      const declarations = match[1];
      // Check that ALL declarations containing the property use !important
      const propLines = declarations
        .split(";")
        .filter((line) => line.includes(prop) || line.includes("inline") || line.includes("block"));

      for (const line of propLines) {
        if (line.trim() && !line.includes("!important")) {
          failures.push(
            `.${cls.replace(/\\\./g, ".")}: "${line.trim()}" is missing !important — ` +
            `host page \`* { ${prop}: 0; }\` will override this`
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("the __tuner-root scope should not reset padding on descendant elements", () => {
    // The globals.css resets `margin: 0` on `.__tuner-root *`, which is fine
    // since Tailwind margin utilities should use !important. But we should NOT
    // also reset padding on all descendants since that compounds the problem.
    const resetMatch = css.match(
      /\.__tuner-root\s*\*[^{]*\{[^}]*padding\s*:\s*0[^}]*\}/
    );

    if (resetMatch) {
      expect.fail(
        `Found padding reset on .__tuner-root descendants: "${resetMatch[0]}". ` +
        "This compounds the @layer specificity issue."
      );
    }
  });
});
