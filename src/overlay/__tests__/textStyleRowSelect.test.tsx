// @vitest-environment happy-dom
/**
 * Behavioral coverage for the cmdk → SearchableMenu migration in TextStyleRow.
 *
 * The dropdown is portaled to document.body. Clicking the trigger opens it;
 * clicking (mousedown) an option must call onApply with the matching style.
 * This proves the SearchableMenu wiring (items/getKey/getSearchText/onSelect)
 * preserves the old "select a text style" behavior.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TextStyleRow } from "../sections/TextStyleRow";
import type { TextStyle } from "../textStyleScanner";

// React's act() requires this global flag in test environments.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeStyle(partial: Partial<TextStyle> & Pick<TextStyle, "tag" | "name">): TextStyle {
  return {
    fontFamily: "sans-serif",
    fontWeight: "400",
    fontSize: "16px",
    lineHeight: "24px",
    letterSpacing: "normal",
    color: "rgb(0, 0, 0)",
    textTransform: "none",
    ...partial,
  };
}

const STYLES: TextStyle[] = [
  makeStyle({ tag: "h1", name: "Heading 1", fontSize: "32px", fontWeight: "700" }),
  makeStyle({ tag: "h2", name: "Heading 2", fontSize: "24px", fontWeight: "700" }),
  makeStyle({ tag: "p", name: "Paragraph", fontSize: "16px", fontWeight: "400" }),
];

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  // Clean any portaled dropdown left on body.
  document.body.querySelectorAll("[data-textstyle-portal]").forEach((n) => n.remove());
});

function renderRow(onApply: (s: TextStyle) => void) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<TextStyleRow styles={STYLES} matchedStyle={null} onApply={onApply} />);
  });
}

describe("TextStyleRow selection", () => {
  it("calls onApply with the clicked style", () => {
    const onApply = vi.fn();
    renderRow(onApply);

    // Open the dropdown via the trigger button.
    const trigger = container!.querySelector("button");
    expect(trigger).toBeTruthy();
    act(() => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Dropdown is portaled to document.body.
    const options = document.body.querySelectorAll('[role="option"]');
    expect(options.length).toBe(STYLES.length);

    // Find and click (mousedown) the "Heading 2" option.
    const target = Array.from(options).find((o) =>
      o.textContent?.includes("Heading 2"),
    );
    expect(target).toBeTruthy();
    act(() => {
      target!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    });

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(STYLES[1]);
  });
});
