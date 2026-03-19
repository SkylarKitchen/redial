// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  stripPseudoClasses,
  getMatchingRules,
} from "../navigator/cssRuleGatherer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove all <style> tags from <head> and clear <body>. */
function cleanup() {
  document.body.innerHTML = "";
  document.head
    .querySelectorAll("style")
    .forEach((s) => s.remove());
}

/** Inject a <style> tag with the given CSS text. */
function addStyle(css: string) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

beforeEach(cleanup);

// ---------------------------------------------------------------------------
// stripPseudoClasses
// ---------------------------------------------------------------------------

describe("stripPseudoClasses", () => {
  it("strips :hover", () => {
    expect(stripPseudoClasses(".card:hover")).toEqual({
      base: ".card",
      pseudo: "hover",
    });
  });

  it("strips :focus", () => {
    expect(stripPseudoClasses(".btn:focus")).toEqual({
      base: ".btn",
      pseudo: "focus",
    });
  });

  it("strips compound :hover:focus and returns first pseudo", () => {
    const result = stripPseudoClasses(".btn:hover:focus");
    expect(result.base).toBe(".btn");
    expect(result.pseudo).toBe("hover");
  });

  it("returns no pseudo for plain selectors", () => {
    expect(stripPseudoClasses(".card")).toEqual({
      base: ".card",
      pseudo: undefined,
    });
  });

  it("strips pseudo-elements without reporting them as pseudo-state", () => {
    const result = stripPseudoClasses(".card::before");
    expect(result.base).toBe(".card");
    expect(result.pseudo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getMatchingRules
// ---------------------------------------------------------------------------

describe("getMatchingRules", () => {
  it("returns matching class rules", () => {
    addStyle(".test-cls { color: red; }");
    const div = document.createElement("div");
    div.className = "test-cls";
    document.body.appendChild(div);

    const blocks = getMatchingRules(div);
    const match = blocks.find((b) => b.selector === ".test-cls");
    expect(match).toBeTruthy();
    expect(match!.declarations).toContainEqual({
      prop: "color",
      value: "red",
    });
  });

  it("includes element.style block when inline styles present", () => {
    const div = document.createElement("div");
    div.style.fontSize = "16px";
    document.body.appendChild(div);

    const blocks = getMatchingRules(div);
    const inline = blocks.find((b) => b.source === "inline");
    expect(inline).toBeTruthy();
    expect(inline!.selector).toBe("element.style");
    expect(
      inline!.declarations.some((d) => d.prop === "font-size"),
    ).toBe(true);
  });

  it("excludes non-matching rules", () => {
    addStyle(".other { margin: 0; }");
    const div = document.createElement("div");
    div.className = "nope";
    document.body.appendChild(div);

    const blocks = getMatchingRules(div);
    // Should have no stylesheet blocks (no inline styles either)
    expect(blocks.length).toBe(0);
  });

  it("marks pseudo-state rules correctly", () => {
    addStyle(".test-cls:hover { color: blue; }");
    const div = document.createElement("div");
    div.className = "test-cls";
    document.body.appendChild(div);

    const blocks = getMatchingRules(div);
    const hover = blocks.find((b) => b.isState);
    expect(hover).toBeTruthy();
    expect(hover!.pseudoState).toBe("hover");
  });

  // happy-dom does not implement CSSMediaRule — the walkRulesWithMedia branch
  // for @media rules cannot be exercised. In a real browser, @media-wrapped
  // rules would produce blocks with a `mediaCondition` string.
  it.skip("captures @media wrapping condition (requires real browser)", () => {
    // Would test:
    // addStyle("@media (min-width: 768px) { .test-cls { padding: 8px; } }");
    // const div = document.createElement("div");
    // div.className = "test-cls";
    // document.body.appendChild(div);
    // const blocks = getMatchingRules(div);
    // expect(blocks[0]?.mediaCondition).toBe("(min-width: 768px)");
  });

  it("handles cross-origin sheets gracefully", () => {
    // Simulate a sheet whose .cssRules getter throws SecurityError
    const fakeSheet = {
      get cssRules(): never {
        throw new DOMException("Blocked", "SecurityError");
      },
      href: "https://external.com/style.css",
    };

    const original = document.styleSheets;
    Object.defineProperty(document, "styleSheets", {
      value: [fakeSheet],
      configurable: true,
    });

    const div = document.createElement("div");
    document.body.appendChild(div);

    // Should not throw
    const blocks = getMatchingRules(div);
    expect(Array.isArray(blocks)).toBe(true);

    // Restore
    Object.defineProperty(document, "styleSheets", {
      value: original,
      configurable: true,
    });
  });

  it("skips --* custom property declarations", () => {
    addStyle(".test-cls { --my-var: blue; color: red; }");
    const div = document.createElement("div");
    div.className = "test-cls";
    document.body.appendChild(div);

    const blocks = getMatchingRules(div);
    // happy-dom may not expose custom properties through CSSStyleRule.style
    // iteration at all. If a block is returned, verify --my-var is excluded.
    const match = blocks.find((b) => b.selector === ".test-cls");
    if (match) {
      const props = match.declarations.map((d) => d.prop);
      expect(props).not.toContain("--my-var");
      expect(props).toContain("color");
    } else {
      // happy-dom dropped the rule or returned no iterable properties —
      // at minimum, confirm no block contains --my-var
      const allProps = blocks.flatMap((b) => b.declarations.map((d) => d.prop));
      expect(allProps).not.toContain("--my-var");
    }
  });
});
