/**
 * displayDirectionAlignment.test.ts — Ensure Display and Direction rows
 * use consistent padding so their labels and controls align horizontally.
 *
 * Bug: The DisplayTabs row and FlexDirectionRow use layout.rowPadding ("2px 8px")
 * but the segmented controls have different widths because FlexDirectionRow has
 * extra buttons (wrap + chevron) compressing its SegmentedControl. The rows
 * should use consistent padding (matching ROW from panelStyles) so labels and
 * controls are aligned with the rest of the panel.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const overlayDir = join(__dirname, "..");

describe("Display and Direction row alignment", () => {
  const layoutControlsSrc = readFileSync(
    join(overlayDir, "layoutControls.tsx"),
    "utf-8",
  );

  /**
   * Both DisplayTabs and FlexDirectionRow render their own wrapper div.
   * They must use the same horizontal padding as the ROW constant
   * (paddingLeft: 12, paddingRight: 12) so they align with Align, Gap,
   * and other rows in the section that use ROW.
   *
   * layout.rowPadding is "2px 8px" — this gives 8px left padding,
   * while ROW gives 12px. The mismatch causes Display and Direction
   * labels/controls to sit 4px further left than sibling rows.
   */
  it("DisplayTabs should use ROW-consistent padding (12px horizontal)", () => {
    // Extract the DisplayTabs function body
    const displayTabsMatch = layoutControlsSrc.match(
      /export function DisplayTabs\b[\s\S]*?^}/m,
    );
    expect(displayTabsMatch).not.toBeNull();
    const displayTabsBody = displayTabsMatch![0];

    // Should NOT use layout.rowPadding (which is "2px 8px" = 8px horizontal)
    // when sibling rows use paddingLeft: 12
    const usesRowPadding = displayTabsBody.includes("layout.rowPadding");
    expect(
      usesRowPadding,
      "DisplayTabs should not use layout.rowPadding — it misaligns with ROW (12px padding). Use paddingLeft: 12, paddingRight: 12 or import ROW.",
    ).toBe(false);
  });

  it("FlexDirectionRow should use ROW-consistent padding (12px horizontal)", () => {
    // Extract the FlexDirectionRow function body
    const flexDirMatch = layoutControlsSrc.match(
      /export function FlexDirectionRow\b[\s\S]*?^}/m,
    );
    expect(flexDirMatch).not.toBeNull();
    const flexDirBody = flexDirMatch![0];

    // Should NOT use layout.rowPadding (which is "2px 8px" = 8px horizontal)
    const usesRowPadding = flexDirBody.includes("layout.rowPadding");
    expect(
      usesRowPadding,
      "FlexDirectionRow should not use layout.rowPadding — it misaligns with ROW (12px padding). Use paddingLeft: 12, paddingRight: 12 or import ROW.",
    ).toBe(false);
  });

  it("DisplayTabs and FlexDirectionRow should use the same horizontal padding", () => {
    // Both functions should use the same padding string/pattern for horizontal alignment.
    // Extract padding values from both.

    const displayTabsMatch = layoutControlsSrc.match(
      /export function DisplayTabs\b[\s\S]*?^}/m,
    );
    const flexDirMatch = layoutControlsSrc.match(
      /export function FlexDirectionRow\b[\s\S]*?^}/m,
    );

    expect(displayTabsMatch).not.toBeNull();
    expect(flexDirMatch).not.toBeNull();

    const displayBody = displayTabsMatch![0];
    const flexBody = flexDirMatch![0];

    // Both should reference the same padding approach
    // Option A: both use ROW spread
    // Option B: both use identical paddingLeft values
    const displayUsesROW = displayBody.includes("...ROW") || displayBody.includes("ROW,");
    const flexUsesROW = flexBody.includes("...ROW") || flexBody.includes("ROW,");

    const displayPaddingLeft = displayBody.match(/paddingLeft:\s*(\d+)/);
    const flexPaddingLeft = flexBody.match(/paddingLeft:\s*(\d+)/);

    // They should either both use ROW or both have the same paddingLeft
    const aligned =
      (displayUsesROW && flexUsesROW) ||
      (displayPaddingLeft &&
        flexPaddingLeft &&
        displayPaddingLeft[1] === flexPaddingLeft[1]);

    expect(
      aligned,
      "DisplayTabs and FlexDirectionRow must use the same horizontal padding for alignment",
    ).toBe(true);
  });
});
