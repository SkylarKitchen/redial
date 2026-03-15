// @vitest-environment happy-dom
/**
 * size-reset.test.ts — Regression test for Option+Click reset in SizeInputCell
 *
 * Bug: SizeSection never passes onReset to SizeInputCell, so the alt+click
 * handler (if (e.altKey && onReset)) always fails silently.
 */

import { describe, it, expect } from "vitest";
import { applyInlineStyle, isDirty, resetProp, resetAll } from "../core/apply";

describe("SizeInputCell reset via resetProp", () => {
  it("resetProp clears the dirty flag and restores original value", () => {
    const el = document.createElement("div");
    el.style.width = "200px";
    document.body.appendChild(el);

    // Modify width
    applyInlineStyle(el, "width", "152px");
    expect(isDirty(el, "width")).toBe(true);

    // Reset should clear dirty
    resetProp(el, "width");
    expect(isDirty(el, "width")).toBe(false);

    // Cleanup
    document.body.removeChild(el);
    resetAll();
  });

  it("SizeSection must pass onReset to SizeInputCell for width", async () => {
    // Verify that the SizeSection source code includes onReset for width
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../SizeSection.tsx"),
      "utf-8"
    );

    // Find all SizeInputCell blocks and check each has onReset
    const cellBlocks = src.split(/(?=<SizeInputCell\b)/);
    const cellInstances = cellBlocks.filter(b => b.startsWith("<SizeInputCell"));

    expect(cellInstances.length).toBeGreaterThanOrEqual(6); // width, height, min-w, min-h, max-w, max-h

    for (const block of cellInstances) {
      const labelMatch = block.match(/label="([^"]+)"/);
      const label = labelMatch ? labelMatch[1] : "unknown";
      expect(block, `SizeInputCell "${label}" must have onReset prop`).toContain("onReset");
    }
  });
});
