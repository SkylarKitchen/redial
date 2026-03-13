// @vitest-environment happy-dom
/**
 * AlignBox stretch visual representation test
 *
 * Bug: When justify or align is "stretch", no cell in the AlignBox
 * gets highlighted — stretch is visually invisible. The indicator
 * should change to communicate that stretch is active (e.g. a bar
 * instead of a dot, or a data-stretch attribute on the container).
 */
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AlignBox } from "../AlignBox";

function render(justify: string, align: string, mode: "flex" | "grid" = "grid") {
  return renderToString(
    createElement(AlignBox, { justify, align, onChange: vi.fn(), mode, compact: true })
  );
}

describe("AlignBox stretch representation", () => {
  it("marks stretch on justify (X) axis with a data attribute", () => {
    const html = render("stretch", "start", "grid");
    // The component must include data-stretch-x to indicate stretch is active on X
    expect(html).toContain("data-stretch-x");
  });

  it("marks stretch on align (Y) axis with a data attribute", () => {
    const html = render("start", "stretch", "grid");
    expect(html).toContain("data-stretch-y");
  });

  it("marks stretch on both axes", () => {
    const html = render("stretch", "stretch", "grid");
    expect(html).toContain("data-stretch-x");
    expect(html).toContain("data-stretch-y");
  });

  it("does NOT mark stretch when values are positional", () => {
    const html = render("start", "center", "grid");
    expect(html).not.toContain("data-stretch-x");
    expect(html).not.toContain("data-stretch-y");
  });
});
