// @vitest-environment happy-dom
/**
 * sizeInputCellAltClickKeyword.test.ts — Regression test for Option+Click reset
 * on SizeInputCell when displaying "Auto", "None", or a CSS variable.
 *
 * Bug: When SizeInputCell was in keyword mode (showing "Auto"/"None") or
 * variable mode (showing a CSS var name), clicking with Alt/Option held did
 * NOT trigger onReset. Instead it cleared the keyword/variable and entered
 * editing mode.
 *
 * CONVERTED (issue #105): was a source-text test (regexes over
 * SizeInputCell.tsx looking for `altKey` inside the keyword/variable onClick
 * handlers and on the outer cell div). Now renders the real cell and fires
 * the actual clicks. Invariant mapping:
 *  - "keyword onClick checks altKey"  → Alt+click on the 'auto' keyword span
 *    fires onReset and does NOT clear the keyword / enter edit mode; a plain
 *    click still clears the keyword and starts editing (non-alt path intact).
 *  - "variable onClick checks altKey" → Alt+click on a variable-linked cell
 *    (label / cell chrome — the pill itself opens the picker by design, per
 *    the unlink-via-Unlink2 contract) fires onReset and does NOT unlink or
 *    change the variable. (The old regex targeted a value-area <span> that no
 *    longer exists — variable mode now renders a VariableField pill and
 *    alt+click is handled on the cell root — the behavioral form pins the
 *    real, current contract.)
 *  - "outer cell div altKey fallback" → Alt+click on the cell root (label /
 *    empty space, numeric mode) fires onReset.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { SizeInputCell } from "../sections/SizeInputCell";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    label: "Width",
    value: 100,
    unit: "px",
    units: ["px", "%"],
    onValueChange: vi.fn(),
    onUnitChange: vi.fn(),
    isModified: true,
    onReset: vi.fn(),
    ...overrides,
  };
}

function renderKeywordCell() {
  const onReset = vi.fn();
  const onKeywordChange = vi.fn();
  const utils = render(
    createElement(SizeInputCell, baseProps({
      keyword: "auto" as const,
      supportsAuto: true,
      onKeywordChange,
      onReset,
    }) as unknown as Parameters<typeof SizeInputCell>[0]),
  );
  const keywordSpan = Array.from(utils.container.querySelectorAll("span")).find(
    (s) => s.textContent === "auto",
  ) as HTMLElement;
  return { ...utils, keywordSpan, onReset, onKeywordChange };
}

describe("SizeInputCell Option+Click reset in keyword/variable mode", () => {
  it("keyword mode ('Auto'): Alt+click fires onReset — does not clear keyword or enter edit mode", () => {
    const { container, keywordSpan, onReset, onKeywordChange } = renderKeywordCell();
    expect(keywordSpan, "keyword span showing 'auto' should render").toBeTruthy();

    fireEvent.click(keywordSpan, { altKey: true });

    // Fires the reset (the span handler + bubbled cell-root fallback both
    // guard on altKey — reset is idempotent, so >=1 call is the contract).
    expect(onReset).toHaveBeenCalled();
    expect(onKeywordChange).not.toHaveBeenCalled();
    // Not in edit mode: no text input appeared
    expect(container.querySelector("input")).toBeNull();
  });

  it("keyword mode ('Auto'): plain click still clears the keyword (non-alt path unchanged)", () => {
    const { onReset, keywordSpan, onKeywordChange } = renderKeywordCell();

    fireEvent.click(keywordSpan);

    // Clears the keyword so the parent flips the cell back to numeric editing
    expect(onKeywordChange).toHaveBeenCalledWith(null);
    expect(onReset).not.toHaveBeenCalled();
  });

  it("variable mode (CSS var): Alt+click on the cell fires onReset — does not unlink or change the variable", () => {
    const onReset = vi.fn();
    const onCssVarChange = vi.fn();
    const { getByText } = render(
      createElement(SizeInputCell, baseProps({
        cssVar: "--panel-width",
        cssVarResolved: "300",
        onCssVarChange,
        onReset,
      }) as unknown as Parameters<typeof SizeInputCell>[0]),
    );

    // Variable mode really rendered: the pill shows the var name
    const pillText = Array.from(document.querySelectorAll("span, div")).find((n) =>
      n.textContent === "panel-width" || n.textContent === "--panel-width",
    );
    expect(pillText, "variable pill should render the linked var name").toBeTruthy();

    // Alt+click the label area (bubbles to the cell root's altKey fallback).
    // The pill itself intentionally swallows clicks — it opens the variable
    // picker; unlinking goes through the Unlink2 affordance, never alt+click.
    fireEvent.click(getByText("Width"), { altKey: true });

    expect(onReset).toHaveBeenCalled();
    expect(onCssVarChange).not.toHaveBeenCalled();
  });

  it("outer cell root: Alt+click on the label/empty space fires onReset (fallback handler)", () => {
    const onReset = vi.fn();
    const { container, getByText } = render(
      createElement(SizeInputCell, baseProps({ onReset }) as unknown as Parameters<typeof SizeInputCell>[0]),
    );
    // Numeric mode — click the cell root (bubbling from the label area)
    const label = getByText("Width");
    fireEvent.click(label, { altKey: true });
    expect(onReset).toHaveBeenCalledTimes(1);
    // And it did not open the reset popover / editing input
    expect(container.querySelector("input")).toBeNull();
  });
});
