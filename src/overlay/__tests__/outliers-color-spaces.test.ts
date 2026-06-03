// @vitest-environment happy-dom
//
// Outlier coverage: modern CSS color spaces & syntaxes flowing through
//   colorUtils.cssColorToHex / hexToRgb / isValidHex / hexToRgba
//   core/contrast.evaluateContrast (+ its internal colorAlpha)
//   core/resolveBackdrop.resolveBackdropColor (+ its internal parseAlpha)
//
// The contrast gauge's promise is "epistemic honesty" — when the answer can't
// be derived from color alone it must say "unknown", never invent a rating.
// These tests probe color values the regexes were never written for:
// oklch/lab/lch/hwb/color-mix/color(), the CSS Color 4 space-separated and
// slash-alpha rgb() syntaxes, percentage rgb(), 4/8-digit hex, and named/system
// colors. Several reveal the gauge silently rating translucent or unparseable
// colors as fully opaque.
//
// happy-dom caveat: getComputedStyle reflects ONLY inline styles, verbatim,
// with NO cascade/normalization, and DROPS color values it can't parse
// (e.g. oklch()) to "". Where that materially changes a path vs a real browser
// it is called out inline and in the report ("needs-real-browser").

import { describe, it, expect, afterEach } from "vitest";
import {
  cssColorToHex,
  hexToRgb,
  isValidHex,
  hexToRgba,
} from "../colorUtils";
import { evaluateContrast } from "../core/contrast";
import { resolveBackdropColor } from "../core/resolveBackdrop";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.style.colorScheme = "";
});

function textEl(styles: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = document.createElement("p");
  Object.assign(el.style, { fontSize: "16px", ...styles });
  document.body.appendChild(el);
  return el;
}

function bgEl(parent: Element, styles: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = document.createElement("div");
  Object.assign(el.style, styles);
  parent.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// cssColorToHex with modern color functions: returns input UNCHANGED (honest).
// The downstream contract is that callers treat a non-#hex return as "can't
// parse", so leaving the string intact is the correct degradation here.
// ---------------------------------------------------------------------------
describe("cssColorToHex — modern color spaces are returned unchanged", () => {
  it.each([
    "oklch(0.7 0.15 200)",
    "oklab(0.5 0.1 -0.1)",
    "lab(50% 40 59.5)",
    "lch(52.2% 72.2 50)",
    "hwb(194 0% 0%)",
    "color-mix(in srgb, red, blue)",
    "color(display-p3 1 0.5 0)",
    "currentColor",
    "Canvas",
    "CanvasText",
  ])("leaves %s untouched (no #hex fabricated)", (input) => {
    const out = cssColorToHex(input);
    expect(out).toBe(input);
    expect(out.startsWith("#")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CSS Color 4 space / slash syntaxes. cssColorToHex's regex demands commas and
// integer channels, so none of these match — returned verbatim.
// ---------------------------------------------------------------------------
describe("cssColorToHex — space/slash/percentage rgb syntaxes", () => {
  it("does not convert space-separated rgb(255 0 0) (regex requires commas)", () => {
    expect(cssColorToHex("rgb(255 0 0)")).toBe("rgb(255 0 0)");
  });

  it("does not convert slash-alpha rgb(0 0 0 / 50%)", () => {
    expect(cssColorToHex("rgb(0 0 0 / 50%)")).toBe("rgb(0 0 0 / 50%)");
  });

  it("does not convert percentage rgb(100%, 0%, 0%) (regex requires integers)", () => {
    expect(cssColorToHex("rgb(100%, 0%, 0%)")).toBe("rgb(100%, 0%, 0%)");
  });
});

// ---------------------------------------------------------------------------
// isValidHex correctly rejects 3/4/8-digit forms (honest gate).
// ---------------------------------------------------------------------------
describe("isValidHex — alpha-bearing & shorthand hex are rejected", () => {
  it("rejects 4-digit #fff0", () => {
    expect(isValidHex("#fff0")).toBe(false);
  });
  it("rejects 8-digit #ffffffff", () => {
    expect(isValidHex("#ffffffff")).toBe(false);
  });
  it("rejects 3-digit shorthand #fff", () => {
    expect(isValidHex("#fff")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hexToRgb is UNGUARDED. It blindly slices 2-char windows, so 3-digit and
// 4-digit hex (which the codebase never validates before some callers reach
// hexToRgb / hexToRgba) yield NaN channels rather than a parsed shorthand.
// ---------------------------------------------------------------------------
describe("hexToRgb / hexToRgba — unguarded shorthand handling", () => {
  // BUG: hexToRgb does no validation/expansion. "#fff" should expand to
  // {r:255,g:255,b:255}; instead it slices "ff"/"f"/"" → blue is NaN.
  it.fails("expands 3-digit shorthand #fff to white", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("documents the actual (broken) 3-digit slicing: blue channel is NaN", () => {
    const { r, g, b } = hexToRgb("#fff");
    expect(r).toBe(255); // "ff"
    expect(g).toBe(15); // "f"  → 0x0f
    expect(Number.isNaN(b)).toBe(true); // "" → NaN
  });

  // BUG: hexToRgba calls hexToRgb with no validation, so a shorthand hex
  // produces an rgba() string containing a literal "NaN" channel — an invalid
  // CSS color that would silently break any style it's written into.
  it.fails("produces a valid rgba() string for shorthand #fff", () => {
    const out = hexToRgba("#fff", 0.5);
    expect(out).not.toMatch(/NaN/);
  });

  it("documents that hexToRgba('#fff', .5) emits a NaN channel", () => {
    expect(hexToRgba("#fff", 0.5)).toBe("rgba(255, 15, NaN, 0.5)");
  });

  // 8-digit hex happens to slice cleanly for r/g/b (alpha pair ignored), so
  // this is the one shorthand variant that survives — worth locking.
  it("ignores the alpha pair of an 8-digit hex (slices first 6 cleanly)", () => {
    expect(hexToRgb("#11223344")).toEqual({ r: 0x11, g: 0x22, b: 0x33 });
  });
});

// ---------------------------------------------------------------------------
// CONTRAST — translucent text expressed in the CSS Color 4 slash syntax.
// The comma form rgba(0,0,0,0.5) is already correctly flagged "unknown"
// (see contrast.test.ts). The slash form should behave IDENTICALLY.
// happy-dom preserves the slash string verbatim, so this path is fully
// exercisable here.
// ---------------------------------------------------------------------------
describe("evaluateContrast — translucent text via slash syntax", () => {
  // BUG: colorAlpha() splits on "," — "rgb(0 0 0 / 0.5)" has zero commas, so
  // parts.length === 1 → alpha defaults to 1 (opaque). 50%-translucent text is
  // mis-judged fully opaque and rated AAA instead of "unknown".
  it.fails(
    "treats slash-syntax translucent text as unknown (parity with rgba comma form)",
    () => {
      const el = textEl({ color: "rgb(0 0 0 / 0.5)" });
      expect(evaluateContrast(el, "#000000").kind).toBe("unknown");
    },
  );

  it("documents the actual bug: slash-translucent text is rated AAA opaque", () => {
    const el = textEl({ color: "rgb(0 0 0 / 0.5)" });
    const result = evaluateContrast(el, "#000000");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.level).toBe("AAA");
  });

  it("still correctly flags the comma form as unknown (regression lock)", () => {
    const el = textEl({ color: "rgba(0, 0, 0, 0.5)" });
    expect(evaluateContrast(el, "#000000").kind).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// CONTRAST — unsupported foreground hex shapes. evaluateContrast gates on
// isValidHex(foregroundHex) first, so a shorthand panel value degrades to a
// clean "unknown" BEFORE it can reach the NaN-spewing hexToRgb. Lock that the
// gate protects the gauge.
// ---------------------------------------------------------------------------
describe("evaluateContrast — foreground hex gate", () => {
  it("returns unknown for a 3-digit foreground hex (gate before hexToRgb)", () => {
    const el = textEl({ color: "rgb(0, 0, 0)" });
    const r = evaluateContrast(el, "#fff");
    expect(r.kind).toBe("unknown");
    if (r.kind === "unknown") expect(r.reason).toBe("unsupported text color");
  });

  it("returns unknown for an 8-digit (alpha) foreground hex", () => {
    const el = textEl({ color: "rgb(0, 0, 0)" });
    expect(evaluateContrast(el, "#000000ff").kind).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// CONTRAST — modern-space TEXT color (oklch). In happy-dom an unparseable
// color value drops to "" on getComputedStyle, so colorAlpha("") returns 0 and
// the gauge reports "unknown" — but via the "translucent text" reason, not an
// "unsupported"/unparseable reason. We assert the user-visible contract that
// SURVIVES the engine difference: the gauge does not fabricate a rating.
// NOTE (needs-real-browser): a real browser returns a resolved color for oklch
// text (alpha 1), so this exact "translucent" reason is a happy-dom artifact;
// the real-browser concern is the OPAQUE oklch *background* case below.
// ---------------------------------------------------------------------------
describe("evaluateContrast — oklch text color does not fabricate a rating", () => {
  it("never returns a concrete pass/fail for oklch text (stays unknown)", () => {
    const el = textEl({ color: "oklch(0.7 0.15 200)" });
    const r = evaluateContrast(el, "#000000");
    expect(r.kind).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// BACKDROP — translucent slash-syntax background.
// parseAlpha() has the same comma-split flaw as colorAlpha(). A 40%-opaque
// slash-syntax background should be reported "unknown" (needs compositing),
// exactly like the comma form rgba(0,0,0,0.4) already is
// (see resolveBackdrop.test.ts). Instead parseAlpha returns 1 (opaque), the
// value fails the #hex check, the layer is silently skipped, and the walk
// falls through to the white canvas.
// ---------------------------------------------------------------------------
describe("resolveBackdropColor — translucent slash-syntax background", () => {
  // BUG: parseAlpha("rgba(0 0 0 / 0.4)") → 1 (split on "," gives length 1).
  // The translucent layer is treated as opaque-but-unparseable, skipped, and
  // the backdrop resolves to white instead of "unknown" (needs compositing).
  it.fails("reports a translucent slash background as unknown", () => {
    const el = bgEl(document.body, { backgroundColor: "rgba(0 0 0 / 0.4)" });
    expect(resolveBackdropColor(el)).toHaveProperty("unknown", true);
  });

  it("documents the actual bug: slash-translucent backdrop resolves to white", () => {
    const el = bgEl(document.body, { backgroundColor: "rgba(0 0 0 / 0.4)" });
    expect(resolveBackdropColor(el)).toEqual({ hex: "#ffffff" });
  });

  it("still correctly flags the comma form as unknown (regression lock)", () => {
    const el = bgEl(document.body, { backgroundColor: "rgba(0, 0, 0, 0.4)" });
    expect(resolveBackdropColor(el)).toHaveProperty("unknown", true);
  });
});

// ---------------------------------------------------------------------------
// BACKDROP — OPAQUE but non-#hex backgrounds (named, percentage-rgb, and in a
// real browser, oklch/lab/color()). parseAlpha treats them as opaque (alpha 1),
// cssColorToHex can't produce a #hex, so the layer is intentionally skipped
// ("keep walking rather than guess") and the walk continues upward — landing on
// the white canvas here. This is the documented honest-degradation path, so we
// assert the ACTUAL behavior rather than treating it as a bug. (Arguably the
// color IS knowable and walking past it yields a WRONG backdrop, not "unknown"
// — flagged as a design concern in the report.)
// ---------------------------------------------------------------------------
describe("resolveBackdropColor — opaque non-hex backgrounds are walked past", () => {
  it("walks past a named-color background to the white canvas", () => {
    const el = bgEl(document.body, { backgroundColor: "rebeccapurple" });
    expect(resolveBackdropColor(el)).toEqual({ hex: "#ffffff" });
  });

  it("walks past a percentage-rgb background to the white canvas", () => {
    const el = bgEl(document.body, { backgroundColor: "rgb(100%, 0%, 0%)" });
    expect(resolveBackdropColor(el)).toEqual({ hex: "#ffffff" });
  });

  it("does NOT see a named-color ancestor as the backdrop for its child", () => {
    // A child sitting on a solid 'rebeccapurple' parent has a perfectly
    // knowable backdrop, yet the walk skips the unparseable parent and reports
    // white — the contrast gauge would judge against the wrong color.
    const parent = bgEl(document.body, { backgroundColor: "rebeccapurple" });
    const child = bgEl(parent, {});
    expect(resolveBackdropColor(child)).toEqual({ hex: "#ffffff" });
  });
});

// ---------------------------------------------------------------------------
// cssColorToHex — whitespace tolerance of the channel regex. The pattern is
// `(\d+),\s*(\d+)`: it allows whitespace AFTER a comma (the canonical computed
// form) but NOT before one. A value with space-before-comma — which is exactly
// what some engines emit when serializing certain authored colors — fails to
// match and is returned unchanged. (Locks the actual asymmetry.)
// ---------------------------------------------------------------------------
describe("cssColorToHex — comma whitespace tolerance is asymmetric", () => {
  it("converts the canonical space-after-comma form", () => {
    expect(cssColorToHex("rgb(0, 128, 255)")).toBe("#0080ff");
  });

  // BUG-ADJACENT (regex strictness): `\s*` sits only after the comma, so a
  // space *before* the comma breaks the match and the value passes through
  // unconverted instead of resolving to #0080ff.
  it("fails to convert a space-before-comma rgb and returns it unchanged", () => {
    expect(cssColorToHex("rgb(0, 128 , 255)")).toBe("rgb(0, 128 , 255)");
  });
});
