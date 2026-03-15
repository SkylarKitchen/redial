/**
 * displayDirectionAlignment.test.ts — Ensure Display and Direction rows
 * use consistent padding so their labels and controls align horizontally.
 *
 * Bug: The DisplayTabs row and FlexDirectionRow use layout.rowPadding ("2px 8px")
 * but sibling rows (Align, Gap) use ROW from panelStyles (paddingLeft: 12).
 * The 8px vs 12px mismatch causes Display/Direction labels and controls to
 * sit 4px further left than the rest of the panel.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const overlayDir = join(__dirname, "..");

/**
 * Extract lines between a function declaration and the next top-level export.
 * More robust than regex for multi-line function bodies.
 */
function extractFunctionBody(src: string, fnName: string): string {
  const lines = src.split("\n");
  const startIdx = lines.findIndex((l) => l.includes(`function ${fnName}`));
  if (startIdx === -1) return "";

  // Find the next top-level export/function after this one
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^(?:export )?(?:function |const |class )/.test(lines[i]) && i > startIdx + 5) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}

describe("Display and Direction row alignment", () => {
  const layoutControlsSrc = readFileSync(
    join(overlayDir, "sections", "layoutControls.tsx"),
    "utf-8",
  );

  const displayTabsBody = extractFunctionBody(layoutControlsSrc, "DisplayTabs");
  const flexDirBody = extractFunctionBody(layoutControlsSrc, "FlexDirectionRow");

  it("DisplayTabs function body is found", () => {
    expect(displayTabsBody.length).toBeGreaterThan(0);
  });

  it("FlexDirectionRow function body is found", () => {
    expect(flexDirBody.length).toBeGreaterThan(0);
  });

  it("DisplayTabs should not use layout.rowPadding (8px misaligns with ROW 12px)", () => {
    expect(
      displayTabsBody.includes("layout.rowPadding"),
      "DisplayTabs uses layout.rowPadding ('2px 8px') but sibling rows use ROW (12px). Replace with padding: '2px 12px' or use ROW spread.",
    ).toBe(false);
  });

  it("FlexDirectionRow should not use layout.rowPadding (8px misaligns with ROW 12px)", () => {
    expect(
      flexDirBody.includes("layout.rowPadding"),
      "FlexDirectionRow uses layout.rowPadding ('2px 8px') but sibling rows use ROW (12px). Replace with padding: '2px 12px' or use ROW spread.",
    ).toBe(false);
  });

  it("DisplayTabs and FlexDirectionRow use matching horizontal padding", () => {
    // Both should reference the same padding mechanism
    const displayPad = displayTabsBody.match(/paddingLeft:\s*(\d+)/)?.[1];
    const flexPad = flexDirBody.match(/paddingLeft:\s*(\d+)/)?.[1];

    const displayUsesROW = displayTabsBody.includes("...ROW");
    const flexUsesROW = flexDirBody.includes("...ROW");

    const aligned =
      (displayUsesROW && flexUsesROW) ||
      (displayPad != null && flexPad != null && displayPad === flexPad);

    expect(
      aligned,
      `DisplayTabs (pad=${displayPad ?? "ROW?" }) and FlexDirectionRow (pad=${flexPad ?? "ROW?"}) must use the same horizontal padding`,
    ).toBe(true);
  });
});
