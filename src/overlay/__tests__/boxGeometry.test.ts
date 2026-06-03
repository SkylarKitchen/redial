// @vitest-environment happy-dom
/**
 * boxGeometry.ts — pure box-model math shared by the box-model and spacing
 * overlays. These tests pin the exact geometry the three overlays
 * (BoxModelOverlay, SpacingGuidesOverlay, SpacingPreviewOverlay) currently
 * compute inline, so the extraction is provably behavior-preserving.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { parseBoxModel, boxRects, buildZones } from "../util/boxGeometry";

afterEach(() => vi.restoreAllMocks());

/** A border-box rect (only the fields the geometry reads). */
function rect(top: number, left: number, width: number, height: number) {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

describe("parseBoxModel", () => {
  it("reads all twelve margin/padding/border values from computed style", () => {
    const el = document.createElement("div");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      marginTop: "1px", marginRight: "2px", marginBottom: "3px", marginLeft: "4px",
      paddingTop: "5px", paddingRight: "6px", paddingBottom: "7px", paddingLeft: "8px",
      borderTopWidth: "9px", borderRightWidth: "10px",
      borderBottomWidth: "11px", borderLeftWidth: "12px",
    } as CSSStyleDeclaration);

    expect(parseBoxModel(el)).toEqual({
      mt: 1, mr: 2, mb: 3, ml: 4,
      pt: 5, pr: 6, pb: 7, pl: 8,
      bt: 9, br: 10, bb: 11, bl: 12,
    });
  });

  it("treats non-numeric values (e.g. 'auto') as 0", () => {
    const el = document.createElement("div");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      marginTop: "auto", marginRight: "", marginBottom: "0px", marginLeft: "5px",
      paddingTop: "", paddingRight: "", paddingBottom: "", paddingLeft: "",
      borderTopWidth: "", borderRightWidth: "", borderBottomWidth: "", borderLeftWidth: "",
    } as CSSStyleDeclaration);

    const box = parseBoxModel(el);
    expect(box.mt).toBe(0);
    expect(box.mr).toBe(0);
    expect(box.ml).toBe(5);
  });
});

describe("boxRects", () => {
  it("computes margin/padding/content rectangles around the border box", () => {
    const box = { mt: 10, mr: 10, mb: 10, ml: 10, pt: 5, pr: 5, pb: 5, pl: 5, bt: 2, br: 2, bb: 2, bl: 2 };
    const r = rect(100, 100, 200, 50);

    const { margin, padding, content } = boxRects(box, r);

    // Margin box: border box expanded outward by margin.
    expect(margin).toEqual({ top: 90, left: 90, width: 220, height: 70 });
    // Padding box: inside the border.
    expect(padding).toEqual({ top: 102, left: 102, width: 196, height: 46 });
    // Content box: inside the padding.
    expect(content).toEqual({ top: 107, left: 107, width: 186, height: 36 });
  });
});

describe("buildZones — margin group", () => {
  it("produces four side zones with the full-outer-width top/bottom convention", () => {
    const box = { mt: 10, mr: 20, mb: 30, ml: 40, pt: 0, pr: 0, pb: 0, pl: 0, bt: 0, br: 0, bb: 0, bl: 0 };
    const r = rect(100, 100, 200, 50); // right=300, bottom=150

    const zones = buildZones(box, r, "margin");
    const by = (side: string) => zones.find((z) => z.side === side)!;

    expect(zones).toHaveLength(4);
    // Top: full outer width, sits above the border box.
    expect(by("top")).toEqual({ x: 60, y: 90, w: 260, h: 10, side: "top", value: 10 });
    // Bottom: full outer width, below the border box.
    expect(by("bottom")).toEqual({ x: 60, y: 150, w: 260, h: 30, side: "bottom", value: 30 });
    // Left/right: only the border-box height (corners belong to top/bottom).
    expect(by("left")).toEqual({ x: 60, y: 100, w: 40, h: 50, side: "left", value: 40 });
    expect(by("right")).toEqual({ x: 300, y: 100, w: 20, h: 50, side: "right", value: 20 });
  });

  it("omits sides whose value is zero", () => {
    const box = { mt: 10, mr: 0, mb: 0, ml: 0, pt: 0, pr: 0, pb: 0, pl: 0, bt: 0, br: 0, bb: 0, bl: 0 };
    const zones = buildZones(box, rect(0, 0, 100, 100), "margin");
    expect(zones.map((z) => z.side)).toEqual(["top"]);
  });
});

describe("buildZones — padding group", () => {
  it("produces inner zones measured inside the border box", () => {
    const box = { mt: 0, mr: 0, mb: 0, ml: 0, pt: 10, pr: 20, pb: 30, pl: 40, bt: 5, br: 5, bb: 5, bl: 5 };
    const r = rect(100, 100, 200, 100); // right=300, bottom=200
    // inner box: iT=105, iR=295, iB=195, iL=105 -> innerW=190, innerH=90
    const zones = buildZones(box, r, "padding");
    const by = (side: string) => zones.find((z) => z.side === side)!;

    expect(by("top")).toEqual({ x: 105, y: 105, w: 190, h: 10, side: "top", value: 10 });
    expect(by("bottom")).toEqual({ x: 105, y: 165, w: 190, h: 30, side: "bottom", value: 30 });
    // Left/right exclude the top/bottom padding bands (corners).
    expect(by("left")).toEqual({ x: 105, y: 115, w: 40, h: 50, side: "left", value: 40 });
    expect(by("right")).toEqual({ x: 275, y: 115, w: 20, h: 50, side: "right", value: 20 });
  });
});
