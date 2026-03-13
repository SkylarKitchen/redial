// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

/**
 * Footer button regression:
 * The Copy button's dropdown arrow was wrapping to a second line.
 *
 * Buttons use native <button> with inline style `display: "inline-flex"`
 * (preventing wrap). We verify the Footer uses inline-flex on its buttons.
 */

describe("ActionButton style contract", () => {
  it("buttons use inline-flex to prevent content wrapping", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(
      join(__dirname, "..", "Footer.tsx"),
      "utf-8"
    );

    // Footer must use inline-flex display on buttons
    expect(src).toContain('display: "inline-flex"');

    // All action buttons must use native <button> with inline styles
    const buttonUsages = src.match(/<button\b/g);
    expect(buttonUsages).toBeTruthy();
    expect(buttonUsages!.length).toBeGreaterThanOrEqual(3);
  });
});
