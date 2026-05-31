// @vitest-environment happy-dom
/**
 * formatCSSDiff — the CSS-text generator behind the footer's "Copy as CSS"
 * (and "Copy as SCSS") and the ChangesDrawer "Copy All" actions.
 *
 * Verified live: clicking the footer Clipboard → "Copy as CSS" surfaced a
 * "Copied CSS!" toast. Footer.tsx and ChangesDrawer.tsx both build the copied
 * text via formatCSSDiff(el, changes); this locks down its output shape.
 */
import { describe, it, expect } from "vitest";
import { formatCSSDiff } from "../util";

describe("formatCSSDiff — Copy-as-CSS output", () => {
  it("emits a CSS rule block: selector { decl } with the new value and an old-value comment", () => {
    const el = document.createElement("div");
    el.className = "card";
    document.body.appendChild(el);

    const css = formatCSSDiff(el, [{ prop: "color", from: "rgb(0, 0, 0)", to: "red" }]);

    expect(css).toMatch(/\{[\s\S]*\}/); // wrapped in a rule block
    expect(css.trimEnd().endsWith("}")).toBe(true);
    expect(css).toContain("color: red;");
    expect(css).toContain("/* was rgb(0, 0, 0) */");
  });

  it("emits one declaration line per change", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const css = formatCSSDiff(el, [
      { prop: "display", from: "block", to: "flex" },
      { prop: "gap", from: "0px", to: "8px" },
    ]);

    expect(css).toContain("display: flex;");
    expect(css).toContain("gap: 8px;");
    const declLines = css.split("\n").filter((l) => /:\s/.test(l) && l.includes(";"));
    expect(declLines.length).toBe(2);
  });

  it("opens the block with a selector line for the element", () => {
    const el = document.createElement("div");
    el.id = "hero";
    document.body.appendChild(el);

    const css = formatCSSDiff(el, [{ prop: "color", from: "a", to: "b" }]);
    const firstLine = css.split("\n")[0];

    // First line is "<selector> {" — non-empty selector before the brace.
    expect(firstLine.trim().endsWith("{")).toBe(true);
    expect(firstLine.replace("{", "").trim().length).toBeGreaterThan(0);
  });
});
