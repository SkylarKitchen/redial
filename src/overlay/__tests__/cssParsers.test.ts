import { describe, it, expect } from "vitest";
import {
  parseNum,
  parseVarRef,
  extractUnit,
  splitCSSList,
  parseBoxShadow,
  shadowToCSS,
  parseFilterItems,
  filterItemsToCSS,
  parseTransform,
  transformToCSS,
  parseSelfPerspective,
  transformToCSSWithPerspective,
  parseTransitions,
  transitionsToCSS,
} from "../cssParsers";

// ─── parseVarRef ─────────────────────────────────────────────────────

describe("parseVarRef — whitespace tolerance (issue #50)", () => {
  it("extracts the name from a clean var() expression", () => {
    expect(parseVarRef("var(--foo)")).toBe("--foo");
  });

  it("tolerates leading/trailing whitespace (getComputedStyle returns it)", () => {
    // getComputedStyle().getPropertyValue() commonly returns a leading space and
    // can carry a trailing one; VAR_RE must match ALIAS_RE's tolerance so
    // variable linking doesn't silently break on i18n names.
    expect(parseVarRef("var(--primário) ")).toBe("--primário");
    expect(parseVarRef(" var(--primário)")).toBe("--primário");
    expect(parseVarRef("  var( --foo )  ")).toBe("--foo");
  });

  it("still rejects non-var values", () => {
    expect(parseVarRef("notavar")).toBeNull();
    expect(parseVarRef("16px")).toBeNull();
  });
});

// ─── parseNum ────────────────────────────────────────────────────────

describe("parseNum", () => {
  it("parses integer strings", () => {
    expect(parseNum("42")).toBe(42);
  });

  it("parses float strings", () => {
    expect(parseNum("3.14")).toBe(3.14);
  });

  it("parses px values (ignores unit suffix)", () => {
    expect(parseNum("16px")).toBe(16);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(parseNum("auto")).toBe(0);
    expect(parseNum("")).toBe(0);
    expect(parseNum("none")).toBe(0);
  });

  it("handles negative values", () => {
    expect(parseNum("-5")).toBe(-5);
  });
});

// ─── extractUnit ──────────────────────────────────────────────────────

describe("extractUnit", () => {
  it("extracts px from pixel values", () => {
    expect(extractUnit("16px")).toBe("px");
  });

  it("extracts em from em values", () => {
    expect(extractUnit("1.5em")).toBe("em");
  });

  it("extracts rem from rem values", () => {
    expect(extractUnit("2rem")).toBe("rem");
  });

  it("extracts % from percentage values", () => {
    expect(extractUnit("50%")).toBe("%");
  });

  it("extracts vw and vh", () => {
    expect(extractUnit("100vw")).toBe("vw");
    expect(extractUnit("80vh")).toBe("vh");
  });

  it("handles negative values", () => {
    expect(extractUnit("-10px")).toBe("px");
    expect(extractUnit("-0.5em")).toBe("em");
  });

  it("handles decimal values", () => {
    expect(extractUnit("0.875rem")).toBe("rem");
    expect(extractUnit(".5em")).toBe("em");
  });

  it("returns fallback for keyword values", () => {
    expect(extractUnit("auto")).toBe("px");
    expect(extractUnit("none")).toBe("px");
    expect(extractUnit("inherit")).toBe("px");
  });

  it("returns fallback for unitless numbers", () => {
    expect(extractUnit("1.5", "—")).toBe("—");
    expect(extractUnit("0", "px")).toBe("px");
  });

  it("returns custom fallback", () => {
    expect(extractUnit("auto", "em")).toBe("em");
    expect(extractUnit("normal", "—")).toBe("—");
  });

  it("handles whitespace", () => {
    expect(extractUnit("  16px  ")).toBe("px");
    expect(extractUnit(" 2rem ")).toBe("rem");
  });
});

// ─── parseBoxShadow ──────────────────────────────────────────────────

describe("parseBoxShadow", () => {
  it("returns empty array for 'none'", () => {
    expect(parseBoxShadow("none")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseBoxShadow("")).toEqual([]);
  });

  it("parses single shadow with color at end", () => {
    const result = parseBoxShadow("2px 4px 6px 0px rgba(0, 0, 0, 0.1)");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      x: 2,
      y: 4,
      blur: 6,
      spread: 0,
      inset: false,
    });
    expect(result[0].color).toContain("rgba");
  });

  it("parses inset shadow", () => {
    const result = parseBoxShadow("inset 0px 2px 4px 0px #000000");
    expect(result[0].inset).toBe(true);
  });

  it("parses multiple shadows", () => {
    const result = parseBoxShadow(
      "2px 2px 4px rgba(0,0,0,0.5), 0px 0px 8px rgba(0,0,0,0.3)"
    );
    expect(result).toHaveLength(2);
  });

  it("handles shadow with no spread value", () => {
    const result = parseBoxShadow("0px 4px 8px rgba(0,0,0,0.2)");
    expect(result[0]).toMatchObject({ x: 0, y: 4, blur: 8, spread: 0 });
  });
});

describe("shadowToCSS", () => {
  it("returns 'none' for empty array", () => {
    expect(shadowToCSS([])).toBe("none");
  });

  it("serializes single shadow", () => {
    expect(
      shadowToCSS([{ x: 2, y: 4, blur: 6, spread: 0, color: "#000", inset: false, visible: true }])
    ).toBe("2px 4px 6px 0px #000");
  });

  it("serializes inset shadow", () => {
    expect(
      shadowToCSS([{ x: 0, y: 2, blur: 4, spread: 0, color: "#000", inset: true, visible: true }])
    ).toBe("inset 0px 2px 4px 0px #000");
  });

  it("serializes multiple shadows joined by commas", () => {
    const css = shadowToCSS([
      { x: 1, y: 1, blur: 2, spread: 0, color: "#000", inset: false, visible: true },
      { x: 0, y: 0, blur: 8, spread: 0, color: "red", inset: false, visible: true },
    ]);
    expect(css).toBe("1px 1px 2px 0px #000, 0px 0px 8px 0px red");
  });
});

// ─── shadowToCSS — text variant (issue #61) ───────────────────────────

describe("shadowToCSS text variant", () => {
  it("emits three lengths and no spread for text shadows", () => {
    // A fourth length is invalid text-shadow — browsers drop the whole
    // declaration, so the Typography section's edits visibly did nothing.
    expect(
      shadowToCSS([{ x: 0, y: 2, blur: 4, spread: 0, color: "rgba(0, 0, 0, 0.25)", inset: false, visible: true }], "text")
    ).toBe("0px 2px 4px rgba(0, 0, 0, 0.25)");
  });

  it("omits spread and inset even when set on the value", () => {
    expect(
      shadowToCSS([{ x: 1, y: 1, blur: 2, spread: 9, color: "#000", inset: true, visible: true }], "text")
    ).toBe("1px 1px 2px #000");
  });

  it("round-trips a computed text-shadow through parse and serialize", () => {
    // getComputedStyle returns color-first, three lengths.
    const parsed = parseBoxShadow("rgba(0, 0, 0, 0.25) 0px 2px 4px");
    expect(shadowToCSS(parsed, "text")).toBe("0px 2px 4px rgba(0, 0, 0, 0.25)");
  });

  it("never contains four consecutive lengths or the inset keyword", () => {
    const css = shadowToCSS(
      [
        { x: 1, y: 2, blur: 3, spread: 4, color: "#abc", inset: true, visible: true },
        { x: 5, y: 6, blur: 7, spread: 8, color: "red", inset: false, visible: true },
      ],
      "text"
    );
    expect(css).not.toContain("inset");
    for (const item of css.split(", ")) {
      const lengths = item.match(/-?[\d.]+px/g) ?? [];
      expect(lengths.length).toBeLessThanOrEqual(3);
    }
  });

  it("defaults to the box variant with spread and inset", () => {
    expect(
      shadowToCSS([{ x: 0, y: 2, blur: 4, spread: 6, color: "#000", inset: true, visible: true }])
    ).toBe("inset 0px 2px 4px 6px #000");
  });
});

// ─── splitCSSList ─────────────────────────────────────────────────────

describe("splitCSSList", () => {
  it("splits a plain comma list", () => {
    expect(splitCSSList("opacity, transform")).toEqual(["opacity", "transform"]);
  });

  it("keeps commas inside parentheses with the item", () => {
    expect(splitCSSList("cubic-bezier(0.4, 0, 0.2, 1), ease-in")).toEqual([
      "cubic-bezier(0.4, 0, 0.2, 1)",
      "ease-in",
    ]);
  });

  it("handles nested parentheses", () => {
    expect(splitCSSList("drop-shadow(0 0 2px rgba(0, 0, 0, 0.5)), blur(2px)")).toEqual([
      "drop-shadow(0 0 2px rgba(0, 0, 0, 0.5))",
      "blur(2px)",
    ]);
  });

  it("returns [] for an empty string", () => {
    expect(splitCSSList("")).toEqual([]);
  });
});

// ─── parseTransitions — paren-aware easing split (issue #62) ──────────

describe("parseTransitions with function-valued easings", () => {
  const makeCs = (overrides: Record<string, string>) =>
    ({
      transitionProperty: "opacity",
      transitionDuration: "0.3s",
      transitionTimingFunction: "ease",
      transitionDelay: "0s",
      ...overrides,
    }) as unknown as CSSStyleDeclaration;

  it("keeps a cubic-bezier easing intact", () => {
    // Tailwind's default `transition` utility uses exactly this easing; a
    // naive split shredded it into four garbage tokens that misaligned
    // every per-property easing after it.
    const result = parseTransitions(
      makeCs({ transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" })
    );
    expect(result).toHaveLength(1);
    expect(result[0].easing).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
  });

  it("aligns easings with properties across a mixed list", () => {
    const result = parseTransitions(
      makeCs({
        transitionProperty: "opacity, transform",
        transitionDuration: "0.3s, 0.5s",
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1), ease-in",
        transitionDelay: "0s, 0.1s",
      })
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      property: "opacity",
      duration: 300,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      delay: 0,
    });
    expect(result[1]).toMatchObject({
      property: "transform",
      duration: 500,
      easing: "ease-in",
      delay: 100,
    });
  });

  it("keeps a steps() easing intact", () => {
    const result = parseTransitions(
      makeCs({ transitionTimingFunction: "steps(4, end)" })
    );
    expect(result[0].easing).toBe("steps(4, end)");
  });

  it("re-serializes to a valid transition shorthand", () => {
    const result = parseTransitions(
      makeCs({ transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" })
    );
    expect(transitionsToCSS(result)).toBe(
      "opacity 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
    );
  });
});

// ─── parseFilterItems ─────────────────────────────────────────────────

describe("parseFilterItems", () => {
  it("returns empty array for 'none'", () => {
    expect(parseFilterItems("none")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseFilterItems("")).toEqual([]);
  });

  it("parses blur with px value", () => {
    const result = parseFilterItems("blur(4px)");
    expect(result).toEqual([
      { type: "blur", values: [4], visible: true, expanded: false },
    ]);
  });

  it("parses percentage filter (brightness) — scales decimal to 0-100", () => {
    const result = parseFilterItems("brightness(0.8)");
    expect(result).toEqual([
      { type: "brightness", values: [80], visible: true, expanded: false },
    ]);
  });

  it("parses hue-rotate in degrees", () => {
    const result = parseFilterItems("hue-rotate(90deg)");
    expect(result).toEqual([
      { type: "hue-rotate", values: [90], visible: true, expanded: false },
    ]);
  });

  it("parses multiple filters preserving order", () => {
    const result = parseFilterItems("blur(2px) brightness(0.9) contrast(1.1)");
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ type: "blur", values: [2] });
    expect(result[1]).toMatchObject({ type: "brightness", values: [90] });
    expect(result[2]).toMatchObject({ type: "contrast", values: [110] });
  });

  it("parses drop-shadow with color", () => {
    const result = parseFilterItems("drop-shadow(2px 4px 6px rgba(0,0,0,0.3))");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "drop-shadow",
      values: [2, 4, 6],
      color: "rgba(0,0,0,0.3)",
    });
  });

  it("parses drop-shadow without explicit color", () => {
    const result = parseFilterItems("drop-shadow(2px 4px 6px)");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "drop-shadow",
      values: [2, 4, 6],
    });
  });

  it("parses grayscale", () => {
    const result = parseFilterItems("grayscale(0.5)");
    expect(result).toEqual([
      { type: "grayscale", values: [50], visible: true, expanded: false },
    ]);
  });

  it("handles mixed filters including drop-shadow", () => {
    const result = parseFilterItems("blur(5px) drop-shadow(1px 2px 3px #000) sepia(0.5)");
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("blur");
    expect(result[1].type).toBe("drop-shadow");
    expect(result[2].type).toBe("sepia");
  });
});

describe("filterItemsToCSS", () => {
  it("returns 'none' for empty array", () => {
    expect(filterItemsToCSS([])).toBe("none");
  });

  it("serializes blur", () => {
    expect(filterItemsToCSS([
      { type: "blur", values: [4], visible: true, expanded: false },
    ])).toBe("blur(4px)");
  });

  it("serializes hue-rotate", () => {
    expect(filterItemsToCSS([
      { type: "hue-rotate", values: [90], visible: true, expanded: false },
    ])).toBe("hue-rotate(90deg)");
  });

  it("serializes percentage filter back to decimal", () => {
    expect(filterItemsToCSS([
      { type: "brightness", values: [80], visible: true, expanded: false },
    ])).toBe("brightness(0.8)");
  });

  it("serializes drop-shadow with color", () => {
    expect(filterItemsToCSS([
      { type: "drop-shadow", values: [2, 4, 6], color: "rgba(0,0,0,0.3)", visible: true, expanded: false },
    ])).toBe("drop-shadow(2px 4px 6px rgba(0,0,0,0.3))");
  });

  it("serializes drop-shadow without color (uses default)", () => {
    expect(filterItemsToCSS([
      { type: "drop-shadow", values: [2, 4, 6], visible: true, expanded: false },
    ])).toBe("drop-shadow(2px 4px 6px rgba(0,0,0,0.25))");
  });

  it("excludes hidden items", () => {
    expect(filterItemsToCSS([
      { type: "blur", values: [4], visible: false, expanded: false },
      { type: "brightness", values: [80], visible: true, expanded: false },
    ])).toBe("brightness(0.8)");
  });

  it("returns 'none' when all items hidden", () => {
    expect(filterItemsToCSS([
      { type: "blur", values: [4], visible: false, expanded: false },
    ])).toBe("none");
  });

  it("serializes multiple items in order", () => {
    const css = filterItemsToCSS([
      { type: "blur", values: [2], visible: true, expanded: false },
      { type: "brightness", values: [80], visible: true, expanded: false },
    ]);
    expect(css).toBe("blur(2px) brightness(0.8)");
  });
});

// ─── parseTransform ──────────────────────────────────────────────────

describe("parseTransform", () => {
  it("returns empty array for 'none'", () => {
    expect(parseTransform("none")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseTransform("")).toEqual([]);
  });

  it("parses translate3d", () => {
    const result = parseTransform("translate3d(10px, 20px, 0px)");
    expect(result[0]).toMatchObject({ type: "translate", x: 10, y: 20, z: 0 });
  });

  it("parses translate()", () => {
    const result = parseTransform("translate(5px, 10px)");
    expect(result[0]).toMatchObject({ type: "translate", x: 5, y: 10 });
  });

  it("parses scale", () => {
    const result = parseTransform("scale(1.5, 2)");
    expect(result[0]).toMatchObject({ type: "scale", x: 1.5, y: 2 });
  });

  it("parses rotate (legacy rotate maps to z-rotation)", () => {
    const result = parseTransform("rotate(45deg)");
    expect(result[0]).toMatchObject({ type: "rotate", x: 0, y: 0, z: 45 });
  });

  it("parses scale3d", () => {
    const result = parseTransform("scale3d(1.5, 2, 0.5)");
    expect(result[0]).toMatchObject({ type: "scale", x: 1.5, y: 2, z: 0.5 });
  });

  it("parses rotateX", () => {
    const result = parseTransform("rotateX(45deg)");
    expect(result[0]).toMatchObject({ type: "rotate", x: 45, y: 0, z: 0 });
  });

  it("parses rotateY", () => {
    const result = parseTransform("rotateY(30deg)");
    expect(result[0]).toMatchObject({ type: "rotate", x: 0, y: 30, z: 0 });
  });

  it("parses rotateZ", () => {
    const result = parseTransform("rotateZ(90deg)");
    expect(result[0]).toMatchObject({ type: "rotate", x: 0, y: 0, z: 90 });
  });

  it("merges multiple rotateX/Y/Z into one rotate", () => {
    const result = parseTransform("rotateX(10deg) rotateY(20deg) rotateZ(30deg)");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "rotate", x: 10, y: 20, z: 30 });
  });

  it("skips perspective() in parseTransform, only parses rotate", () => {
    const result = parseTransform("perspective(500px) rotateY(30deg)");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "rotate", x: 0, y: 30, z: 0 });
  });

  it("parses skew", () => {
    const result = parseTransform("skew(10deg, 5deg)");
    expect(result[0]).toMatchObject({ type: "skew", x: 10, y: 5 });
  });

  it("parses multiple transforms", () => {
    const result = parseTransform("translate(10px, 20px) rotate(90deg) scale(2, 2)");
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("translate");
    // rotate is accumulated and appended after all non-rotate transforms
    expect(result[1].type).toBe("scale");
    expect(result[2].type).toBe("rotate");
  });

  it("extracts rotation from matrix()", () => {
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);
    const result = parseTransform(
      `matrix(${cos45}, ${sin45}, ${-sin45}, ${cos45}, 0, 0)`
    );
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("rotate");
    expect(result[0].z).toBe(45);
  });

  it("extracts translation from matrix()", () => {
    const result = parseTransform("matrix(1, 0, 0, 1, 100, 200)");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "translate", x: 100, y: 200 });
  });
});

describe("transformToCSS", () => {
  it("returns 'none' for empty array", () => {
    expect(transformToCSS([])).toBe("none");
  });

  it("serializes translate without z", () => {
    expect(transformToCSS([{ type: "translate", x: 10, y: 20 }])).toBe(
      "translate(10px, 20px)"
    );
  });

  it("serializes translate3d with z", () => {
    expect(transformToCSS([{ type: "translate", x: 10, y: 20, z: 5 }])).toBe(
      "translate3d(10px, 20px, 5px)"
    );
  });

  it("serializes rotate with x only (legacy, no z)", () => {
    expect(transformToCSS([{ type: "rotate", x: 45, y: 0 }])).toBe("rotateX(45deg)");
  });

  it("serializes scale", () => {
    expect(transformToCSS([{ type: "scale", x: 2, y: 1.5 }])).toBe("scale(2, 1.5)");
  });

  it("serializes skew", () => {
    expect(transformToCSS([{ type: "skew", x: 10, y: 5 }])).toBe("skew(10deg, 5deg)");
  });

  it("serializes scale3d when z is defined and not 1", () => {
    expect(transformToCSS([{ type: "scale", x: 1.5, y: 2, z: 0.5 }])).toBe(
      "scale3d(1.5, 2, 0.5)"
    );
  });

  it("serializes scale without z when z is undefined", () => {
    expect(transformToCSS([{ type: "scale", x: 2, y: 1.5 }])).toBe("scale(2, 1.5)");
  });

  it("serializes scale without z when z is 1", () => {
    expect(transformToCSS([{ type: "scale", x: 2, y: 1.5, z: 1 }])).toBe("scale(2, 1.5)");
  });

  it("serializes rotate with x, y, z axes", () => {
    expect(transformToCSS([{ type: "rotate", x: 10, y: 20, z: 30 }])).toBe(
      "rotateX(10deg) rotateY(20deg) rotateZ(30deg)"
    );
  });

  it("serializes rotate z-only", () => {
    expect(transformToCSS([{ type: "rotate", x: 0, y: 0, z: 45 }])).toBe("rotateZ(45deg)");
  });

  it("serializes rotate x-only", () => {
    expect(transformToCSS([{ type: "rotate", x: 45, y: 0, z: 0 }])).toBe("rotateX(45deg)");
  });
});

describe("parseSelfPerspective", () => {
  it("extracts perspective value from transform string", () => {
    expect(parseSelfPerspective("perspective(500px) rotateY(30deg)")).toBe(500);
  });

  it("returns 0 when no perspective is present", () => {
    expect(parseSelfPerspective("rotateY(30deg)")).toBe(0);
  });
});

describe("transformToCSSWithPerspective", () => {
  it("prepends perspective when value > 0", () => {
    expect(
      transformToCSSWithPerspective([{ type: "rotate", x: 0, y: 30, z: 0 }], 500)
    ).toBe("perspective(500px) rotateY(30deg)");
  });

  it("omits perspective when value is 0", () => {
    expect(
      transformToCSSWithPerspective([{ type: "rotate", x: 0, y: 30, z: 0 }], 0)
    ).toBe("rotateY(30deg)");
  });
});
