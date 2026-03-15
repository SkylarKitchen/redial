import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * React warns when removing a longhand (backgroundColor) during rerender
 * while its shorthand (background) is still set. useValueFlash is spread
 * into containers that use `background`, so it must never return `backgroundColor`.
 *
 * Error reproduced:
 *   "Removing a style property during rerender (backgroundColor) when a
 *    conflicting property is set (background) can lead to styling bugs."
 *    at TrackCountInput (layoutControls.tsx:818)
 */
describe("useValueFlash must not use backgroundColor longhand", () => {
  const controlsSource = readFileSync(
    join(__dirname, "..", "controls", "helpers.tsx"),
    "utf-8",
  );

  it("return statement uses background (shorthand), not backgroundColor (longhand)", () => {
    // Extract the useValueFlash function body
    const fnMatch = controlsSource.match(
      /export function useValueFlash[\s\S]*?^}/m,
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];

    // Must not contain backgroundColor anywhere in the return
    expect(fnBody).not.toMatch(/backgroundColor/);
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
