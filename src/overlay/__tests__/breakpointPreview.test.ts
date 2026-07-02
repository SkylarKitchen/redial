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
import { diff } from "../core/apply";
import { serializeElementBreakpointCSS } from "../breakpoints";
import {
  renderBreakpointPreview,
  startBreakpointPreview,
  destroyBreakpointPreview,
  getBreakpointPreviewCss,
} from "../breakpointPreview";

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function previewText(): string {
  return getBreakpointPreviewCss() ?? "";
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

  it("removes data-redial-bp attributes from elements on destroy (#83)", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "red");
    renderBreakpointPreview();
    expect(el.hasAttribute("data-redial-bp")).toBe(true);

    destroyBreakpointPreview();

    // Teardown must not leave stamped attributes in the user's DOM.
    expect(el.hasAttribute("data-redial-bp")).toBe(false);
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

  describe("cascade priority: injected declarations carry !important", () => {
    it("appends !important to every injected declaration so the preview beats matching author CSS", () => {
      // Author CSS with (0,2,0) specificity — beats the preview's single
      // [data-redial-bp="N"] attribute selector (0,1,0) unless the preview
      // declarations carry !important (mirrors statePreview.ts / scope.ts).
      const authorSheet = document.createElement("style");
      authorSheet.textContent = ".list .item { gap: 8px; color: blue; }";
      document.head.appendChild(authorSheet);

      const wrapper = document.createElement("div");
      wrapper.className = "list";
      const el = document.createElement("div");
      el.className = "item";
      wrapper.appendChild(el);
      document.body.appendChild(wrapper);

      styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "gap", "24px");
      styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "red");
      renderBreakpointPreview();

      const css = previewText();
      expect(css).toContain("gap: 24px !important;");
      expect(css).toContain("color: red !important;");

      // Structural guarantee: EVERY declaration line ends with !important —
      // base edits win via inline styles, so the media-gated preview must win
      // the cascade the same way or breakpoint editing silently no-ops.
      const decls = css.match(/^\s+[a-z-]+:.*;$/gim) ?? [];
      expect(decls.length).toBe(2);
      for (const decl of decls) {
        expect(decl).toMatch(/ !important;$/);
      }

      authorSheet.remove();
    });

    it("does not double-append when a value already carries !important", () => {
      const el = makeEl();
      styleEngine.apply(
        { scope: "element", el, breakpoint: "768" },
        "color",
        "red !important",
      );
      renderBreakpointPreview();

      const css = previewText();
      expect(css).toContain("color: red !important;");
      expect(css).not.toContain("!important !important");
    });

    it("keeps the clipboard/export serialization clean — no !important in saved CSS", () => {
      const el = makeEl();
      styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "gap", "24px");
      renderBreakpointPreview();

      // Preview injection carries !important…
      expect(previewText()).toContain("gap: 24px !important;");

      // …but the export path (Footer Copy / Save side-channel) must stay clean.
      const exported = serializeElementBreakpointCSS(el, diff(el));
      expect(exported).toContain("gap: 24px;");
      expect(exported).not.toContain("!important");
    });
  });
});
