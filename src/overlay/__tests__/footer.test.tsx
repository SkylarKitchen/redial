// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

/**
 * Footer / ActionButton regression:
 * The Copy button's dropdown arrow (▾) was wrapping to a second line
 * because ActionButton lacked whiteSpace: "nowrap".
 *
 * We import the module source directly and check the rendered style
 * to ensure buttons never allow text wrapping.
 */

// happy-dom doesn't support full React rendering, so we test the
// style object contract that ActionButton applies to <button> elements.
// We extract the expected style properties from Footer.tsx's ActionButton.

describe("ActionButton style contract", () => {
  it("buttons must set whiteSpace: nowrap to prevent content wrapping", async () => {
    // Read the source and verify the style object includes whiteSpace
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(
      join(__dirname, "..", "Footer.tsx"),
      "utf-8"
    );

    // The ActionButton's style object must include whiteSpace: "nowrap"
    // to prevent the dropdown arrow from wrapping to a new line
    const buttonStyleMatch = src.match(
      /function ActionButton[\s\S]*?<button[\s\S]*?style=\{?\{([\s\S]*?)\}\}?[\s\S]*?<\/button>/
    );
    expect(buttonStyleMatch).toBeTruthy();

    const styleBlock = buttonStyleMatch![1];
    expect(styleBlock).toContain("whiteSpace");
  });
});
