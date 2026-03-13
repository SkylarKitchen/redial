// @vitest-environment happy-dom
/**
 * spacing-reset.test.ts — Regression test for Option+Click reset in SpacingBoxModel
 *
 * Bug: Alt(Option)+click on a spacing value calls resetProp(element, prop) but
 * never calls onChange to propagate the new (default) value back to the parent.
 * The inline style is removed but the displayed number doesn't update because
 * the parent's React state is never notified.
 *
 * Fix: after resetProp, read back the computed value and call onChange so the
 * parent updates its state (same pattern as PositionSection, SizeSection, etc.).
 */

import { describe, it, expect } from "vitest";
import { applyInlineStyle, isDirty, resetProp, resetAndReadNum, resetAll } from "../apply";

// ── Unit test: resetProp works for spacing properties ──────────────────

describe("resetProp works for spacing CSS properties", () => {
  const spacingProps = [
    { prop: "margin-top", value: "24px" },
    { prop: "margin-right", value: "16px" },
    { prop: "margin-bottom", value: "24px" },
    { prop: "margin-left", value: "16px" },
    { prop: "padding-top", value: "12px" },
    { prop: "padding-right", value: "8px" },
    { prop: "padding-bottom", value: "12px" },
    { prop: "padding-left", value: "8px" },
  ];

  for (const { prop, value } of spacingProps) {
    it(`resetProp("${prop}") clears the dirty flag`, () => {
      const el = document.createElement("div");
      document.body.appendChild(el);

      applyInlineStyle(el, prop, value);
      expect(isDirty(el, prop)).toBe(true);

      resetProp(el, prop);
      expect(isDirty(el, prop)).toBe(false);

      document.body.removeChild(el);
      resetAll();
    });
  }
});

// ── Source-level test: alt+click must propagate new value to parent ─────

describe("SpacingBoxModel alt+click reset propagates value to parent", () => {
  let src: string;

  it("can read SpacingBoxModel source", async () => {
    const fs = await import("fs");
    const path = await import("path");
    src = fs.readFileSync(
      path.resolve(__dirname, "../SpacingBoxModel.tsx"),
      "utf-8",
    );
    expect(src).toBeTruthy();
  });

  it("alt+click handler calls onChange after resetProp (not just resetProp alone)", () => {
    // Find the alt+click block inside handleUp
    // The bug: only `resetProp(element, prop)` is called, without calling
    // onChange to propagate the new value back to the parent.
    //
    // After fix, the block should:
    //   1. Reset the prop (resetProp or resetAndReadNum)
    //   2. Call onChange/onChangeRef with the new computed value
    const altClickBlock = src.match(
      /if\s*\(pev\.altKey\)\s*\{[\s\S]*?\}/
    );
    expect(altClickBlock, "Could not find alt+click handler block").toBeTruthy();

    const block = altClickBlock![0];

    // The block must call onChange/onChangeRef to propagate the reset value
    const callsOnChange =
      block.includes("onChangeRef") || block.includes("onChange");
    expect(
      callsOnChange,
      "Alt+click handler must call onChange/onChangeRef after reset so the parent updates displayed values"
    ).toBe(true);
  });

  it("imports resetAndReadNum (not just resetProp) for value propagation", () => {
    // resetAndReadNum combines reset + getComputedStyle in one call —
    // it's the correct function to use when you need the new value back
    expect(
      src,
      "SpacingBoxModel should import resetAndReadNum to read back the value after reset"
    ).toContain("resetAndReadNum");
  });
});
