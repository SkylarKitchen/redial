// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Footer } from "../shell/Footer";
import { resetAll } from "../core/apply";

/**
 * Footer button regression:
 * The Copy button's dropdown arrow was wrapping to a second line.
 *
 * CONVERTED (issue #105): was a source-text test (readFileSync on Footer.tsx
 * asserting the literal `display: "inline-flex"` and counting `<button`
 * occurrences). Now renders the real Footer and asserts on the rendered DOM:
 *  - same invariant 1: action buttons are native <button> elements (>= 3);
 *  - same invariant 2: every action button carries display:inline-flex in its
 *    inline style, so its label + icon cannot wrap to a second line.
 * The behavioral form is strictly stronger: it checks the styles that actually
 * land on the buttons, not that a string appears somewhere in the file.
 */

afterEach(() => {
  cleanup();
  resetAll();
  document.body.innerHTML = "";
});

describe("ActionButton style contract", () => {
  it("buttons use inline-flex to prevent content wrapping", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const { container } = render(<Footer element={el} onReset={() => {}} />);

    // All action buttons are native <button> with inline styles
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThanOrEqual(3);

    // Every footer action button must be inline-flex so its content can't wrap
    for (const btn of buttons) {
      expect(
        (btn as HTMLElement).style.display,
        `Footer <button> "${btn.textContent?.trim()}" must use display:inline-flex to prevent wrapping`,
      ).toBe("inline-flex");
    }
  });
});
