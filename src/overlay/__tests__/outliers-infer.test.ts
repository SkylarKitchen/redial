// @vitest-environment happy-dom
/**
 * outliers-infer.test.ts — creative, untested outlier cases for the
 * inference + element-context layer (`core/infer.ts`, `core/elementContext.ts`).
 *
 * Focus areas that the existing infer.test.ts / util.test.ts / breadcrumb.test.ts
 * do NOT cover:
 *   - SVG elements whose `.className` is an SVGAnimatedString (real-browser), not a
 *     plain string. happy-dom exposes a plain string, so we simulate the real DOM by
 *     redefining `className` to return `{ baseVal, animVal }`.
 *   - class attributes with leading / interior whitespace.
 *   - boxless elements (display:contents) and invisible elements (display:none).
 *   - negative and percentage spacing values flowing through `parseNum`.
 *   - elementContext: the SVG class divergence vs infer, and HTML truncation.
 *
 * happy-dom notes: getComputedStyle reflects ONLY inline styles, verbatim, with no
 * cascade. getBoundingClientRect returns zeros — so geometry-dependent overlay code
 * (BoxModelOverlay et al.) cannot be asserted here; those paths are flagged
 * "needs-real-browser" in the report rather than tested against a fake rect.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { infer } from "../core/infer";
import { buildPromptContext } from "../core/elementContext";
import { getDisplayClass } from "../util";

beforeEach(() => {
  document.body.innerHTML = "";
});

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

/** Build an SVG element and make its `.className` behave like a real browser's
 *  read-only SVGAnimatedString (`{ baseVal, animVal }`), not a plain string. */
function makeSvgWithAnimatedClassName(tag: string, cls: string): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag) as SVGElement;
  el.setAttribute("class", cls);
  document.body.appendChild(el);
  Object.defineProperty(el, "className", {
    configurable: true,
    get() {
      return { baseVal: cls, animVal: cls };
    },
  });
  return el;
}

// ─── SVG internals ────────────────────────────────────────────────────

describe("infer — SVG elements", () => {
  it("uses the lowercase SVG tag name for internal shapes like <rect>", () => {
    // SVG element tagNames stay lowercase in both happy-dom and real browsers.
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    document.body.appendChild(rect);
    const result = infer(rect);
    expect(result.name).toBe("rect");
  });

  it("never throws and returns full spacing shape for an unclassed <path>", () => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    document.body.appendChild(path);
    const result = infer(path);
    expect(result.name).toBe("path");
    expect(result.spacing.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(result.spacing.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  // BUG: infer() reads el.className directly and bails when it is not a string.
  // For SVG elements className is an SVGAnimatedString (object), so the class is
  // dropped and the panel name loses the ".logo" suffix — even though
  // getAttribute("class") (used everywhere else, e.g. util.getDisplayClass) has it.
  it.fails("should include the SVG class in the name (uses className not getAttribute)", () => {
    const svg = makeSvgWithAnimatedClassName("svg", "logo");
    // Sanity: the attribute IS present and the rest of the codebase reads it.
    expect(svg.getAttribute("class")).toBe("logo");
    expect(getDisplayClass(svg)).toBe("logo");
    // But infer drops it because typeof el.className !== "string".
    expect(infer(svg).name).toBe("svg.logo");
  });

  it("honestly degrades SVG-with-animated-className name to the bare tag (documents current behavior)", () => {
    // The flip side of the bug above, asserted as the ACTUAL output so the file
    // stays green and the behavior is pinned until the bug is fixed.
    const svg = makeSvgWithAnimatedClassName("svg", "logo");
    expect(infer(svg).name).toBe("svg");
  });
});

// ─── className whitespace edge cases ──────────────────────────────────

describe("infer — className whitespace", () => {
  // BUG: a class attribute with leading whitespace ("   card primary") splits to
  // ["", "card", ...]; the loop finds no CSS-module match and the fallback
  // `list[0] || null` is the empty leading token -> null, so the class is lost.
  it.fails("should pick the first real class when the attribute has leading whitespace", () => {
    const el = makeEl("div");
    el.setAttribute("class", "   card primary");
    expect(infer(el).name).toBe("div.card");
  });

  it("honestly drops the class to a bare tag when className has leading whitespace (documents current behavior)", () => {
    const el = makeEl("div");
    el.setAttribute("class", "   card primary");
    expect(infer(el).name).toBe("div");
  });

  it("interior collapsed whitespace between two plain classes still names the first", () => {
    const el = makeEl("div");
    // No leading whitespace, but multiple interior spaces.
    el.className = "card    primary";
    expect(infer(el).name).toBe("div.card");
  });

  it("whitespace-only class attribute yields a bare tag name", () => {
    const el = makeEl("section");
    el.setAttribute("class", "  \t  ");
    expect(infer(el).name).toBe("section");
  });
});

// ─── CSS-module precedence regardless of order ────────────────────────

describe("infer — CSS module class precedence", () => {
  it("prefers a CSS-module class even when a plain class precedes it", () => {
    const el = makeEl("div");
    el.className = "plain Button_btn__a8f2k";
    expect(infer(el).name).toBe("div.btn");
  });

  it("prefers a CSS-module class even when a plain class follows it", () => {
    const el = makeEl("div");
    el.className = "Button_btn__a8f2k trailing";
    expect(infer(el).name).toBe("div.btn");
  });
});

// ─── Boxless / invisible elements ─────────────────────────────────────

describe("infer — boxless and invisible elements", () => {
  it("reads padding from a display:contents element (no box of its own)", () => {
    const el = makeEl("div");
    el.style.display = "contents";
    el.style.padding = "8px";
    const result = infer(el);
    // infer still extracts the authored padding; it does not zero it out just
    // because the element renders no box.
    expect(result.spacing.padding).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
    expect(result.name).toBe("div");
  });

  it("produces a valid result for a display:none element", () => {
    const el = makeEl("div");
    el.style.display = "none";
    el.style.marginTop = "12px";
    const result = infer(el);
    expect(result.name).toBe("div");
    expect(result.spacing.margin.top).toBe(12);
  });

  it("produces a valid result for an element with the hidden attribute", () => {
    const el = makeEl("div");
    el.setAttribute("hidden", "");
    el.style.paddingLeft = "4px";
    const result = infer(el);
    expect(result.name).toBe("div");
    // happy-dom does not apply the UA `hidden { display:none }` rule to computed
    // padding, so the inline padding still flows through.
    expect(result.spacing.padding.left).toBe(4);
  });
});

// ─── Spacing value parsing edge cases ─────────────────────────────────

describe("infer — spacing value parsing", () => {
  it("preserves negative margins (e.g. overlap layouts)", () => {
    const el = makeEl("div");
    el.style.marginTop = "-10px";
    el.style.marginLeft = "-4px";
    const result = infer(el);
    expect(result.spacing.margin.top).toBe(-10);
    expect(result.spacing.margin.left).toBe(-4);
  });

  it("strips the percent unit from a percentage margin, keeping only the number", () => {
    // Honest degradation: parseNum returns the leading number and discards "%".
    // The visual box model is px-based, so a 5% margin is stored as the raw 5.
    const el = makeEl("div");
    el.style.marginRight = "5%";
    expect(infer(el).spacing.margin.right).toBe(5);
  });

  it("parses only the leading number of an unresolved calc() value", () => {
    // happy-dom does not resolve calc(); the computed value is the literal
    // "calc(10px + 2px)". parseNum(parseFloat) reads "calc" -> NaN -> ... actually
    // parseFloat("calc(...)") is NaN, so parseNum returns 0. Pin that reality.
    const el = makeEl("div");
    el.style.paddingTop = "calc(10px + 2px)";
    expect(infer(el).spacing.padding.top).toBe(0);
  });

  it("treats an invalid spacing value as 0 rather than NaN", () => {
    const el = makeEl("div");
    el.style.marginTop = "NaNpx";
    const result = infer(el);
    expect(result.spacing.margin.top).toBe(0);
    expect(Number.isNaN(result.spacing.margin.top)).toBe(false);
  });
});

// ─── elementContext (buildPromptContext) ──────────────────────────────

describe("buildPromptContext — outliers", () => {
  it("keeps the SVG class in the prompt even when className is an SVGAnimatedString", () => {
    // Contrast with infer(): elementContext uses getDisplayClass (getAttribute),
    // so it correctly surfaces ".logo" for an SVG element. This locks the
    // divergence: the AI prompt path is robust where infer is not.
    const svg = makeSvgWithAnimatedClassName("svg", "logo");
    const ctx = buildPromptContext(svg, "make it bigger");
    expect(ctx).toContain("### 1. logo");
    expect(ctx).toContain("**Location:** .logo");
  });

  it("truncates an oversized outerHTML snippet with a marker", () => {
    const el = makeEl("div");
    el.textContent = "x".repeat(3000);
    const ctx = buildPromptContext(el, "shrink it");
    expect(ctx).toContain("<!-- ...truncated -->");
    // The truncation marker is appended after a 1500-char slice, so the html
    // block must be substantially shorter than the original 3000+ chars.
    expect(ctx.length).toBeLessThan(2000);
  });

  it("passes feedback through verbatim, including backticks and special chars", () => {
    const el = makeEl("button");
    el.className = "cta";
    const feedback = "use `var(--brand)` & make width 100% — pls";
    const ctx = buildPromptContext(el, feedback);
    expect(ctx).toContain(`**Feedback:** ${feedback}`);
    // The element name still resolves from the plain class.
    expect(ctx).toContain("### 1. cta");
  });

  it("falls back to the tag name when an element has no class at all", () => {
    const el = makeEl("nav");
    const ctx = buildPromptContext(el, "tidy this");
    expect(ctx).toContain("### 1. nav");
  });
});
