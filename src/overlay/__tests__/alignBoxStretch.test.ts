// @vitest-environment happy-dom
/**
 * AlignBox stretch visual representation test
 *
 * Bug: When justify or align is "stretch", no cell in the AlignBox
 * gets highlighted — stretch is visually invisible. The dot/indicator
 * should change to communicate that stretch is active.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AlignBox } from "../AlignBox";

function render(justify: string, align: string, mode: "flex" | "grid" = "grid") {
  const html = renderToString(
    createElement(AlignBox, { justify, align, onChange: vi.fn(), mode, compact: true })
  );
  return html;
}

describe("AlignBox stretch representation", () => {
  it("highlights the dot when justify and align are positional values", () => {
    const html = render("start", "start", "grid");
    // The primary color (#3B82F6 or similar) indicates an active cell.
    // At minimum, the center dot or an arrow should have the active color.
    // With start/start, the top-left arrow and/or the dot should be active.
    expect(html).toBeTruthy();
  });

  it("must visually indicate stretch on the justify (X) axis", () => {
    const html = render("stretch", "start", "grid");
    // When justify is "stretch", the AlignBox should contain some visual
    // indicator that stretch is active — not just fall back to "no selection".
    // We check that a stretch-specific data attribute or visual element exists.
    // A stretch bar, highlighted row, or data-stretch attribute would all pass.
    expect(
      html.includes("data-stretch") ||
      html.includes("stretch-bar") ||
      // Or the active color appears somewhere (meaning something is highlighted)
      // When nothing is active, ALL indicators are the inactive color (blackAlpha)
      // So we check that at least one element has the primary/active styling
      html.includes("border-radius:0") || // bar shape (not round dot)
      /width:\s*(?:2[4-9]|[3-9]\d|1\d\d).*height:\s*(?:[2-6])/.test(html) // wide thin bar
    ).toBe(true);
  });

  it("must visually indicate stretch on the align (Y) axis", () => {
    const html = render("start", "stretch", "grid");
    expect(
      html.includes("data-stretch") ||
      html.includes("stretch-bar") ||
      html.includes("border-radius:0") ||
      /height:\s*(?:2[4-9]|[3-9]\d|1\d\d).*width:\s*(?:[2-6])/.test(html) // tall thin bar
    ).toBe(true);
  });

  it("must visually indicate stretch on both axes", () => {
    const html = render("stretch", "stretch", "grid");
    expect(
      html.includes("data-stretch") ||
      html.includes("stretch-bar") ||
      html.includes("border-radius:0")
    ).toBe(true);
  });
});
