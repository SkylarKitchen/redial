// @vitest-environment happy-dom
/**
 * sizeInputCellAltClickKeyword.test.ts — Regression test for Option+Click reset
 * on SizeInputCell when displaying "Auto", "None", or a CSS variable.
 *
 * Bug: When SizeInputCell is in keyword mode (showing "Auto"/"None") or variable
 * mode (showing a CSS var name), clicking with Alt/Option held does NOT trigger
 * onReset. Instead it clears the keyword/variable and enters editing mode.
 *
 * The keyword onClick handler is:
 *   onClick={() => { onKeywordChange?.(null); setEditing(true); }}
 *
 * It should check e.altKey first:
 *   onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); return; } ... }}
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const src = fs.readFileSync(
  path.resolve(__dirname, "../sections/SizeInputCell.tsx"),
  "utf-8"
);

describe("SizeInputCell Option+Click reset in keyword/variable mode", () => {
  it("keyword mode ('Auto'/'None') click handler must check altKey for reset", () => {
    // Find the isKeyword branch — the <span> that shows "Auto"/"None"
    // It should check e.altKey before clearing keyword and entering edit mode.
    //
    // Current (broken): onClick={() => { onKeywordChange?.(null); setEditing(true); }}
    // Expected: onClick handler checks e.altKey and calls onReset() if alt is held

    // Extract the onClick handler for the keyword span
    // The keyword span is inside the `isKeyword ?` ternary branch
    const keywordBranch = src.match(/isKeyword\s*\?\s*\(\s*<span[\s\S]*?<\/span>\s*\)/);
    expect(keywordBranch, "Could not find keyword branch in SizeInputCell").toBeTruthy();

    const keywordBlock = keywordBranch![0];

    // The onClick handler MUST reference altKey (or e.altKey) for reset
    expect(
      keywordBlock,
      "Keyword mode click handler must check altKey to support Option+Click reset"
    ).toMatch(/altKey/);
  });

  it("variable mode (CSS var) click handler must check altKey for reset", () => {
    // Find the value-area variable branch — the <span> that shows CSS variable name
    // and has onClick={() => { onCssVarChange?.(null); ... }}
    // It must check e.altKey before clearing variable and entering edit mode.

    // Match the span with onCssVarChange in its onClick (the value area, not the label)
    const variableBranch = src.match(/onClick=\{[\s\S]*?onCssVarChange[\s\S]*?<\/span>\s*\)/);
    expect(variableBranch, "Could not find variable value-area branch in SizeInputCell").toBeTruthy();

    const variableBlock = variableBranch![0];

    // The onClick handler MUST reference altKey for reset
    expect(
      variableBlock,
      "Variable mode click handler must check altKey to support Option+Click reset"
    ).toMatch(/altKey/);
  });

  it("outer cell div should have an altKey fallback handler", () => {
    // As a defense-in-depth measure, the outermost clickable div should
    // also intercept alt+click to call onReset, like SliderRow/SelectRow do.
    // This ensures alt+click works even when clicking the label or empty space.

    // Find the outer cell div (the one with ref={cellRef})
    const cellDiv = src.match(/ref=\{cellRef\}[\s\S]*?(?=\n\s*\{\/\*\s*Modified)/);
    expect(cellDiv, "Could not find outer cell div in SizeInputCell").toBeTruthy();

    // It should have an onClick that checks altKey
    // Currently there's no onClick on this div at all
    expect(
      cellDiv![0],
      "Outer cell div should have an onClick handler that checks altKey for reset"
    ).toMatch(/onClick.*altKey/s);
  });
});
