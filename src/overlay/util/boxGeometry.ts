/**
 * boxGeometry.ts — pure box-model math shared by the on-page overlays.
 *
 * Three overlays used to each parse the same twelve computed box-model values
 * and rebuild the same margin/padding rectangles inline. This module is the
 * single home for that math, so the geometry is defined once and tested once:
 *   - parseBoxModel(el) — read margins, paddings and border widths.
 *   - boxRects(box, rect) — margin / padding / content rectangles (BoxModelOverlay).
 *   - buildZones(box, rect, group) — per-side spacing zones (the spacing overlays).
 *
 * Everything here is pure: parseBoxModel reads the DOM once into a plain
 * BoxModel, and the rest operate on plain objects so they need no DOM to test.
 */

/** Parsed box-model edge widths, in CSS pixels. */
export interface BoxModel {
  mt: number; mr: number; mb: number; ml: number;
  pt: number; pr: number; pb: number; pl: number;
  bt: number; br: number; bb: number; bl: number;
}

/** The minimal border-box rect the geometry reads (a DOMRect satisfies it). */
export interface BoxRect {
  top: number; left: number; width: number; height: number;
  right: number; bottom: number;
}

/** A positioned rectangle (top-left origin + size). */
export interface Rectangle {
  top: number; left: number; width: number; height: number;
}

/** A per-side spacing zone with the side's pixel value, for badges. */
export interface Zone {
  x: number; y: number; w: number; h: number;
  side: "top" | "right" | "bottom" | "left";
  value: number;
}

function px(v: string): number {
  return parseFloat(v) || 0;
}

/** Read an element's margin, padding and border-width edges from computed style. */
export function parseBoxModel(el: Element): BoxModel {
  const cs = getComputedStyle(el);
  return {
    mt: px(cs.marginTop), mr: px(cs.marginRight), mb: px(cs.marginBottom), ml: px(cs.marginLeft),
    pt: px(cs.paddingTop), pr: px(cs.paddingRight), pb: px(cs.paddingBottom), pl: px(cs.paddingLeft),
    bt: px(cs.borderTopWidth), br: px(cs.borderRightWidth),
    bb: px(cs.borderBottomWidth), bl: px(cs.borderLeftWidth),
  };
}

/**
 * The three nested rectangles of the box model, in viewport coordinates:
 *   - margin: the border box grown outward by the margins,
 *   - padding: the area inside the borders,
 *   - content: the area inside the padding.
 * Widths/heights are clamped at 0 only implicitly (callers clamp where shown).
 */
export function boxRects(box: BoxModel, rect: BoxRect): {
  margin: Rectangle; padding: Rectangle; content: Rectangle;
} {
  return {
    margin: {
      top: rect.top - box.mt,
      left: rect.left - box.ml,
      width: rect.width + box.ml + box.mr,
      height: rect.height + box.mt + box.mb,
    },
    padding: {
      top: rect.top + box.bt,
      left: rect.left + box.bl,
      width: rect.width - box.bl - box.br,
      height: rect.height - box.bt - box.bb,
    },
    content: {
      top: rect.top + box.bt + box.pt,
      left: rect.left + box.bl + box.pl,
      width: rect.width - box.bl - box.br - box.pl - box.pr,
      height: rect.height - box.bt - box.bb - box.pt - box.pb,
    },
  };
}

/**
 * Per-side spacing zones for one group. The top/bottom zones span the full
 * outer (margin) / inner (padding) width; the left/right zones span only the
 * border-box height, so the four zones tile without overlapping at the corners.
 * Sides whose value is 0 are omitted.
 */
export function buildZones(box: BoxModel, rect: BoxRect, group: "margin" | "padding"): Zone[] {
  const zones: Zone[] = [];

  if (group === "margin") {
    if (box.mt > 0) zones.push({
      x: rect.left - box.ml, y: rect.top - box.mt,
      w: rect.width + box.ml + box.mr, h: box.mt, side: "top", value: box.mt,
    });
    if (box.mb > 0) zones.push({
      x: rect.left - box.ml, y: rect.bottom,
      w: rect.width + box.ml + box.mr, h: box.mb, side: "bottom", value: box.mb,
    });
    if (box.ml > 0) zones.push({
      x: rect.left - box.ml, y: rect.top,
      w: box.ml, h: rect.height, side: "left", value: box.ml,
    });
    if (box.mr > 0) zones.push({
      x: rect.right, y: rect.top,
      w: box.mr, h: rect.height, side: "right", value: box.mr,
    });
    return zones;
  }

  // Padding zones — inside the border box.
  const iT = rect.top + box.bt;
  const iR = rect.right - box.br;
  const iB = rect.bottom - box.bb;
  const iL = rect.left + box.bl;
  const innerW = iR - iL;
  const innerH = iB - iT;

  if (box.pt > 0) zones.push({
    x: iL, y: iT, w: innerW, h: box.pt, side: "top", value: box.pt,
  });
  if (box.pb > 0) zones.push({
    x: iL, y: iB - box.pb, w: innerW, h: box.pb, side: "bottom", value: box.pb,
  });
  if (box.pl > 0) zones.push({
    x: iL, y: iT + box.pt,
    w: box.pl, h: Math.max(0, innerH - box.pt - box.pb), side: "left", value: box.pl,
  });
  if (box.pr > 0) zones.push({
    x: iR - box.pr, y: iT + box.pt,
    w: box.pr, h: Math.max(0, innerH - box.pt - box.pb), side: "right", value: box.pr,
  });
  return zones;
}
