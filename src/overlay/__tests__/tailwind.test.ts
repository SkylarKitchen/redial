import { describe, it, expect } from "vitest";
import { formatTailwindDiff } from "../tailwind";
import type { DiffEntry } from "../apply";

/** Helper to test a single CSS property → Tailwind class conversion. */
function tw(prop: string, value: string): string {
  return formatTailwindDiff([{ prop, from: "", to: value }]);
}

// ─── Spacing scale ───────────────────────────────────────────────────

describe("spacing scale", () => {
  it("converts 16px → 4 (standard scale: px / 4)", () => {
    expect(tw("width", "16px")).toBe("w-4");
  });

  it("converts 24px → 6", () => {
    expect(tw("width", "24px")).toBe("w-6");
  });

  it("converts 1px → px (exception)", () => {
    expect(tw("width", "1px")).toBe("w-px");
  });

  it("converts 0px → 0", () => {
    expect(tw("width", "0px")).toBe("w-0");
  });

  it("handles fractional scale values (e.g. 2px → 0.5)", () => {
    expect(tw("width", "2px")).toBe("w-0.5");
  });

  it("handles 6px → 1.5", () => {
    expect(tw("padding-top", "6px")).toBe("pt-1.5");
  });
});

// ─── Display and Position ────────────────────────────────────────────

describe("display and position", () => {
  it("display: flex → flex", () => {
    expect(tw("display", "flex")).toBe("flex");
  });

  it("display: none → hidden", () => {
    expect(tw("display", "none")).toBe("hidden");
  });

  it("display: grid → grid", () => {
    expect(tw("display", "grid")).toBe("grid");
  });

  it("display: block → block", () => {
    expect(tw("display", "block")).toBe("block");
  });

  it("position: absolute → absolute", () => {
    expect(tw("position", "absolute")).toBe("absolute");
  });

  it("position: relative → relative", () => {
    expect(tw("position", "relative")).toBe("relative");
  });

  it("position: fixed → fixed", () => {
    expect(tw("position", "fixed")).toBe("fixed");
  });

  it("position: static → filtered out (null)", () => {
    expect(tw("position", "static")).toBe("");
  });
});

// ─── Width / Height sizing ───────────────────────────────────────────

describe("width / height sizing", () => {
  it("width: auto → w-auto", () => {
    expect(tw("width", "auto")).toBe("w-auto");
  });

  it("width: 16px → w-4", () => {
    expect(tw("width", "16px")).toBe("w-4");
  });

  it("height: 32px → h-8", () => {
    expect(tw("height", "32px")).toBe("h-8");
  });

  it("max-width: none → max-w-none", () => {
    expect(tw("max-width", "none")).toBe("max-w-none");
  });

  it("max-height: none → max-h-none", () => {
    expect(tw("max-height", "none")).toBe("max-h-none");
  });

  it("min-width: 0px → min-w-0", () => {
    expect(tw("min-width", "0px")).toBe("min-w-0");
  });

  it("max-width with spacing value", () => {
    expect(tw("max-width", "64px")).toBe("max-w-16");
  });
});

// ─── Margin with negatives ───────────────────────────────────────────

describe("margin with negatives", () => {
  it("margin-top: 16px → mt-4", () => {
    expect(tw("margin-top", "16px")).toBe("mt-4");
  });

  it("margin-top: -8px → -mt-2", () => {
    expect(tw("margin-top", "-8px")).toBe("-mt-2");
  });

  it("margin-left: auto → ml-auto", () => {
    expect(tw("margin-left", "auto")).toBe("ml-auto");
  });

  it("margin-bottom: -16px → -mb-4", () => {
    expect(tw("margin-bottom", "-16px")).toBe("-mb-4");
  });

  it("margin-right: 0px → mr-0", () => {
    expect(tw("margin-right", "0px")).toBe("mr-0");
  });
});

// ─── Padding ─────────────────────────────────────────────────────────

describe("padding", () => {
  it("padding-top: 8px → pt-2", () => {
    expect(tw("padding-top", "8px")).toBe("pt-2");
  });

  it("padding-right: 4px → pr-1", () => {
    expect(tw("padding-right", "4px")).toBe("pr-1");
  });

  it("padding-bottom: auto → pb-auto", () => {
    expect(tw("padding-bottom", "auto")).toBe("pb-auto");
  });

  it("padding-left: 1px → pl-px", () => {
    expect(tw("padding-left", "1px")).toBe("pl-px");
  });
});

// ─── Colors ──────────────────────────────────────────────────────────

describe("colors", () => {
  it("color: #ff0000 → text-[#ff0000]", () => {
    expect(tw("color", "#ff0000")).toBe("text-[#ff0000]");
  });

  it("background-color: rgb(0,0,0) → bg-[rgb(0,0,0)]", () => {
    expect(tw("background-color", "rgb(0,0,0)")).toBe("bg-[rgb(0,0,0)]");
  });

  it("border-color: #333 → border-[#333]", () => {
    expect(tw("border-color", "#333")).toBe("border-[#333]");
  });

  it("escapes spaces in color values", () => {
    expect(tw("color", "rgb(255, 0, 0)")).toBe("text-[rgb(255,_0,_0)]");
  });
});

// ─── Typography ──────────────────────────────────────────────────────

describe("typography", () => {
  it("text-align: center → text-center", () => {
    expect(tw("text-align", "center")).toBe("text-center");
  });

  it("text-align: left → text-left", () => {
    expect(tw("text-align", "left")).toBe("text-left");
  });

  it("text-decoration-line: underline → underline", () => {
    expect(tw("text-decoration-line", "underline")).toBe("underline");
  });

  it("text-decoration-line: none → no-underline", () => {
    expect(tw("text-decoration-line", "none")).toBe("no-underline");
  });

  it("text-decoration-line: overline → overline", () => {
    expect(tw("text-decoration-line", "overline")).toBe("overline");
  });

  it("text-decoration-line: line-through → line-through", () => {
    expect(tw("text-decoration-line", "line-through")).toBe("line-through");
  });

  it("text-decoration-line: unknown → decoration-[…] (no space escape)", () => {
    // The converter returns `decoration-[${v}]` without escaping spaces
    expect(tw("text-decoration-line", "underline overline")).toBe(
      "decoration-[underline overline]"
    );
  });

  it("text-transform: uppercase → uppercase", () => {
    expect(tw("text-transform", "uppercase")).toBe("uppercase");
  });

  it("text-transform: lowercase → lowercase", () => {
    expect(tw("text-transform", "lowercase")).toBe("lowercase");
  });

  it("text-transform: capitalize → capitalize", () => {
    expect(tw("text-transform", "capitalize")).toBe("capitalize");
  });

  it("text-transform: none → normal-case", () => {
    expect(tw("text-transform", "none")).toBe("normal-case");
  });

  it("font-size → text-[…]", () => {
    expect(tw("font-size", "14px")).toBe("text-[14px]");
  });

  it("font-weight → font-[…]", () => {
    expect(tw("font-weight", "700")).toBe("font-[700]");
  });

  it("line-height → leading-[…]", () => {
    expect(tw("line-height", "1.5")).toBe("leading-[1.5]");
  });

  it("letter-spacing → tracking-[…]", () => {
    expect(tw("letter-spacing", "0.05em")).toBe("tracking-[0.05em]");
  });
});

// ─── Layout (Flexbox) ───────────────────────────────────────────────

describe("flexbox layout", () => {
  it("flex-direction: column → flex-col", () => {
    expect(tw("flex-direction", "column")).toBe("flex-col");
  });

  it("flex-direction: row → flex-row", () => {
    expect(tw("flex-direction", "row")).toBe("flex-row");
  });

  it("flex-direction: row-reverse → flex-row-reverse", () => {
    expect(tw("flex-direction", "row-reverse")).toBe("flex-row-reverse");
  });

  it("flex-direction: column-reverse → flex-col-reverse", () => {
    expect(tw("flex-direction", "column-reverse")).toBe("flex-col-reverse");
  });

  it("justify-content: center → justify-center", () => {
    expect(tw("justify-content", "center")).toBe("justify-center");
  });

  it("justify-content: flex-start → justify-start", () => {
    expect(tw("justify-content", "flex-start")).toBe("justify-start");
  });

  it("justify-content: flex-end → justify-end", () => {
    expect(tw("justify-content", "flex-end")).toBe("justify-end");
  });

  it("justify-content: space-between → justify-between", () => {
    expect(tw("justify-content", "space-between")).toBe("justify-between");
  });

  it("justify-content: space-around → justify-around", () => {
    expect(tw("justify-content", "space-around")).toBe("justify-around");
  });

  it("justify-content: space-evenly → justify-evenly", () => {
    expect(tw("justify-content", "space-evenly")).toBe("justify-evenly");
  });

  it("align-items: flex-start → items-start", () => {
    expect(tw("align-items", "flex-start")).toBe("items-start");
  });

  it("align-items: flex-end → items-end", () => {
    expect(tw("align-items", "flex-end")).toBe("items-end");
  });

  it("align-items: center → items-center", () => {
    expect(tw("align-items", "center")).toBe("items-center");
  });

  it("align-items: stretch → items-stretch", () => {
    expect(tw("align-items", "stretch")).toBe("items-stretch");
  });

  it("align-items: baseline → items-baseline", () => {
    expect(tw("align-items", "baseline")).toBe("items-baseline");
  });

  it("flex-grow: 1 → grow", () => {
    expect(tw("flex-grow", "1")).toBe("grow");
  });

  it("flex-grow: 0 → grow-0", () => {
    expect(tw("flex-grow", "0")).toBe("grow-0");
  });

  it("flex-grow: 2 → grow-[2]", () => {
    expect(tw("flex-grow", "2")).toBe("grow-[2]");
  });

  it("flex-shrink: 1 → shrink", () => {
    expect(tw("flex-shrink", "1")).toBe("shrink");
  });

  it("flex-shrink: 0 → shrink-0", () => {
    expect(tw("flex-shrink", "0")).toBe("shrink-0");
  });

  it("flex-basis with spacing", () => {
    expect(tw("flex-basis", "32px")).toBe("basis-8");
  });

  it("flex-basis: auto → basis-auto", () => {
    expect(tw("flex-basis", "auto")).toBe("basis-auto");
  });

  it("flex-wrap: wrap → flex-wrap", () => {
    expect(tw("flex-wrap", "wrap")).toBe("flex-wrap");
  });

  it("flex-wrap: nowrap → flex-nowrap", () => {
    expect(tw("flex-wrap", "nowrap")).toBe("flex-nowrap");
  });

  it("flex-wrap: wrap-reverse → flex-wrap-reverse", () => {
    expect(tw("flex-wrap", "wrap-reverse")).toBe("flex-wrap-reverse");
  });

  it("order → order-[…]", () => {
    expect(tw("order", "3")).toBe("order-[3]");
  });
});

// ─── Gap ─────────────────────────────────────────────────────────────

describe("gap", () => {
  it("gap: 8px → gap-2", () => {
    expect(tw("gap", "8px")).toBe("gap-2");
  });

  it("row-gap: 16px → gap-y-4", () => {
    expect(tw("row-gap", "16px")).toBe("gap-y-4");
  });

  it("column-gap: 4px → gap-x-1", () => {
    expect(tw("column-gap", "4px")).toBe("gap-x-1");
  });
});

// ─── Position offsets ────────────────────────────────────────────────

describe("position offsets", () => {
  it("top: 0px → top-0", () => {
    expect(tw("top", "0px")).toBe("top-0");
  });

  it("right: 16px → right-4", () => {
    expect(tw("right", "16px")).toBe("right-4");
  });

  it("bottom: auto → bottom-auto", () => {
    expect(tw("bottom", "auto")).toBe("bottom-auto");
  });

  it("left: 8px → left-2", () => {
    expect(tw("left", "8px")).toBe("left-2");
  });
});

// ─── Effects ─────────────────────────────────────────────────────────

describe("effects", () => {
  it("z-index: auto → z-auto", () => {
    expect(tw("z-index", "auto")).toBe("z-auto");
  });

  it("z-index: 10 → z-[10]", () => {
    expect(tw("z-index", "10")).toBe("z-[10]");
  });

  it("border-width: 1px → border", () => {
    expect(tw("border-width", "1px")).toBe("border");
  });

  it("border-width: 2px → border-[2px]", () => {
    expect(tw("border-width", "2px")).toBe("border-[2px]");
  });

  it("overflow: hidden → overflow-hidden", () => {
    expect(tw("overflow", "hidden")).toBe("overflow-hidden");
  });

  it("overflow: auto → overflow-auto", () => {
    expect(tw("overflow", "auto")).toBe("overflow-auto");
  });

  it("opacity → opacity-[…]", () => {
    expect(tw("opacity", "0.5")).toBe("opacity-[0.5]");
  });

  it("border-radius → rounded-[…]", () => {
    expect(tw("border-radius", "8px")).toBe("rounded-[8px]");
  });

  it("cursor → cursor-…", () => {
    expect(tw("cursor", "pointer")).toBe("cursor-pointer");
  });

  it("mix-blend-mode → mix-blend-…", () => {
    expect(tw("mix-blend-mode", "multiply")).toBe("mix-blend-multiply");
  });

  it("visibility: hidden → invisible", () => {
    expect(tw("visibility", "hidden")).toBe("invisible");
  });

  it("visibility: visible → visible", () => {
    expect(tw("visibility", "visible")).toBe("visible");
  });
});

// ─── Arbitrary value fallback (PROP_PREFIX) ──────────────────────────

describe("arbitrary value fallback", () => {
  it("box-shadow → shadow-[…]", () => {
    expect(tw("box-shadow", "0 4px 6px rgba(0,0,0,0.1)")).toBe(
      "shadow-[0_4px_6px_rgba(0,0,0,0.1)]"
    );
  });

  it("filter → filter-[…]", () => {
    expect(tw("filter", "blur(4px)")).toBe("filter-[blur(4px)]");
  });

  it("backdrop-filter → backdrop-[…]", () => {
    expect(tw("backdrop-filter", "blur(10px)")).toBe("backdrop-[blur(10px)]");
  });

  it("transform → transform-[…]", () => {
    expect(tw("transform", "rotate(45deg)")).toBe("transform-[rotate(45deg)]");
  });

  it("transition → transition-[…]", () => {
    expect(tw("transition", "all 0.3s ease")).toBe(
      "transition-[all_0.3s_ease]"
    );
  });

  it("object-fit → object-[…]", () => {
    expect(tw("object-fit", "cover")).toBe("object-[cover]");
  });

  it("object-position → object-[…]", () => {
    expect(tw("object-position", "center top")).toBe("object-[center_top]");
  });

  it("aspect-ratio → aspect-[…]", () => {
    expect(tw("aspect-ratio", "16/9")).toBe("aspect-[16/9]");
  });

  it("pointer-events → pointer-events-[…]", () => {
    expect(tw("pointer-events", "none")).toBe("pointer-events-[none]");
  });

  it("user-select → select-[…]", () => {
    expect(tw("user-select", "none")).toBe("select-[none]");
  });
});

// ─── Escape arbitrary values ─────────────────────────────────────────

describe("escape arbitrary values", () => {
  it("replaces spaces with underscores", () => {
    expect(tw("box-shadow", "0 2px 4px black")).toBe(
      "shadow-[0_2px_4px_black]"
    );
  });

  it("escapes underscores in original value", () => {
    expect(tw("filter", "blur(4_px)")).toBe("filter-[blur(4\\_px)]");
  });
});

// ─── Unknown properties ──────────────────────────────────────────────

describe("unknown properties", () => {
  it("returns empty string for completely unknown properties", () => {
    expect(tw("some-unknown-prop", "value")).toBe("");
  });
});

// ─── formatTailwindDiff (full integration) ───────────────────────────

describe("formatTailwindDiff", () => {
  it("returns empty string for empty changes", () => {
    expect(formatTailwindDiff([])).toBe("");
  });

  it("combines multiple changes space-separated", () => {
    const changes: DiffEntry[] = [
      { prop: "display", from: "", to: "flex" },
      { prop: "width", from: "", to: "16px" },
      { prop: "color", from: "", to: "#fff" },
    ];
    expect(formatTailwindDiff(changes)).toBe("flex w-4 text-[#fff]");
  });

  it("filters out null results (e.g. position: static)", () => {
    const changes: DiffEntry[] = [
      { prop: "position", from: "", to: "static" },
      { prop: "display", from: "", to: "flex" },
    ];
    expect(formatTailwindDiff(changes)).toBe("flex");
  });

  it("handles mix of known converters and arbitrary fallbacks", () => {
    const changes: DiffEntry[] = [
      { prop: "display", from: "", to: "flex" },
      { prop: "box-shadow", from: "", to: "0 1px 3px black" },
    ];
    expect(formatTailwindDiff(changes)).toBe("flex shadow-[0_1px_3px_black]");
  });

  it("handles mix of known, arbitrary, and unknown properties", () => {
    const changes: DiffEntry[] = [
      { prop: "display", from: "", to: "grid" },
      { prop: "filter", from: "", to: "blur(5px)" },
      { prop: "unknown-prop", from: "", to: "whatever" },
    ];
    expect(formatTailwindDiff(changes)).toBe("grid filter-[blur(5px)]");
  });

  it("handles all null results gracefully", () => {
    const changes: DiffEntry[] = [
      { prop: "position", from: "", to: "static" },
      { prop: "unknown", from: "", to: "val" },
    ];
    expect(formatTailwindDiff(changes)).toBe("");
  });
});

// ─── Non-standard spacing values ─────────────────────────────────────

describe("non-standard spacing values", () => {
  it("non-numeric value falls back to bracket syntax", () => {
    expect(tw("width", "calc(100% - 20px)")).toBe("w-[calc(100%_-_20px)]");
  });

  it("percentage values: parseFloat succeeds so spacing scale is used", () => {
    // parseFloat("50%") = 50, so spacingValue returns 50/4 = 12.5
    expect(tw("width", "50%")).toBe("w-12.5");
  });
});
