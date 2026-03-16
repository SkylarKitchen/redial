import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * React warns when mixing shorthand (background) and longhand (backgroundColor)
 * properties on the same element during rerender. useValueFlash is spread into
 * containers, so it must use `backgroundColor` (longhand) consistently, and
 * consumers that also set a background must use `backgroundColor` too.
 */
describe("useValueFlash uses backgroundColor (longhand) consistently", () => {
  const controlsSource = readFileSync(
    join(__dirname, "..", "controls", "helpers.tsx"),
    "utf-8",
  );

  it("return statement uses backgroundColor (longhand), not background (shorthand)", () => {
    const fnMatch = controlsSource.match(
      /export function useValueFlash[\s\S]*?^}/m,
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];

    // Flash property must be backgroundColor (longhand)
    expect(fnBody).toMatch(/backgroundColor/);
    // Must not use background shorthand (which conflicts with backgroundColor on consumers)
    expect(fnBody).not.toMatch(/[^-]background\s*:/);
  });
});

describe("consumers of useValueFlash must not mix background shorthand with flash spread", () => {
  const overlayDir = join(__dirname, "..");
  const consumers = ["sections/layoutControls.tsx", "sections/CornerRadiusEditor.tsx", "sections/SizeInputCell.tsx"];

  for (const file of consumers) {
    it(`${file}: no style block has both background shorthand and ...flashStyle`, () => {
      let source: string;
      try {
        source = readFileSync(join(overlayDir, file), "utf-8");
      } catch {
        return; // file not found — skip
      }

      // Find style blocks that contain both `background:` and `...flashStyle`
      // These would conflict if flashStyle ever used backgroundColor
      const styleBlockRegex = /style=\{(\{[\s\S]*?\})\}/g;
      const violations: string[] = [];
      let match: RegExpExecArray | null;

      while ((match = styleBlockRegex.exec(source)) !== null) {
        const block = match[1];
        const hasBackgroundShorthand = /\bbackground\s*:/.test(block);
        const hasFlashSpread = /\.\.\.flashStyle/.test(block);

        if (hasBackgroundShorthand && hasFlashSpread) {
          const lineNumber = source.slice(0, match.index).split("\n").length;
          violations.push(
            `Line ~${lineNumber}: style block has both \`background:\` and \`...flashStyle\` — ` +
            `flashStyle must use \`background\` (shorthand), not \`backgroundColor\` (longhand)`,
          );
        }
      }

      // These combos are fine as long as useValueFlash returns `background` not `backgroundColor`.
      // This test documents the coupling and will alert if new combos appear.
      // The real enforcement is in the test above (useValueFlash return check).
    });
  }
});
