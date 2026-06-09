// @vitest-environment happy-dom
/**
 * breakpointPreview.ts — live media-gated <style> for breakpoint edits (#35).
 *
 * Non-base breakpoint edits are tracked by the engine but deliberately NOT
 * written to inline style (ADR-0005). To make "set media-query-scoped values"
 * visible, this module renders the element's breakpoint diffs into a
 * <style id="redial-breakpoint-preview"> as @media rules targeting a stable
 * per-element [data-redial-bp] selector — so the edit takes effect when the
 * viewport matches, and never clobbers the base inline style.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { styleEngine } from "../core/engine";
import {
  renderBreakpointPreview,
  startBreakpointPreview,
  destroyBreakpointPreview,
} from "../breakpointPreview";

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function previewText(): string {
  return document.getElementById("redial-breakpoint-preview")?.textContent ?? "";
}

beforeEach(() => {
  styleEngine.resetAll();
  destroyBreakpointPreview();
  document.body.innerHTML = "";
});

afterEach(() => {
  destroyBreakpointPreview();
  styleEngine.resetAll();
});

describe("breakpoint live preview (#35)", () => {
  it("renders a breakpoint edit as a media-gated rule targeting the element", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "red");

    renderBreakpointPreview();

    // The element got a stable preview id...
    const id = el.getAttribute("data-redial-bp");
    expect(id).toBeTruthy();
    // ...and the <style> media-gates the edit to it.
    const css = previewText();
    expect(css).toContain("@media (min-width: 768px)");
    expect(css).toContain(`[data-redial-bp="${id}"]`);
    expect(css).toContain("color: red");
  });

  it("does NOT write the breakpoint edit to the base inline style", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "black"); // base
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "red"); // bp
    renderBreakpointPreview();

    // Base inline is untouched by the breakpoint edit.
    expect(el.style.getPropertyValue("color")).toBe("black");
  });

  it("emits nothing when only base edits exist", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    renderBreakpointPreview();
    expect(previewText()).toBe("");
  });

  it("auto-updates via subscription, and clears when the breakpoint is reset", () => {
    startBreakpointPreview(); // subscribes to engine changes + initial render
    const el = makeEl();

    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "width", "100px");
    // No manual render() call — the subscription drove it.
    expect(previewText()).toContain("width: 100px");

    styleEngine.resetScope(el, {
      scope: "element",
      activeClassName: null,
      activeState: "none",
      activeBreakpoint: "768",
    });
    expect(previewText()).toBe("");
  });

  it("reuses the same preview id for an element across renders", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "red");
    renderBreakpointPreview();
    const first = el.getAttribute("data-redial-bp");
    styleEngine.apply({ scope: "element", el, breakpoint: "1024" }, "margin", "8px");
    renderBreakpointPreview();
    expect(el.getAttribute("data-redial-bp")).toBe(first);
  });
});
