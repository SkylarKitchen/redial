/**
 * contrast.ts — Decision logic for the text-contrast badge.
 *
 * Kept separate from the JSX so the "what should we show" judgment is a pure,
 * fully-tested function. The badge component is a thin renderer over this.
 */
import {
  contrastRatio,
  hexToRgb,
  isValidHex,
  parseColorAlpha,
  wcagAssessment,
} from "../colorUtils";
import { resolveBackdropColor } from "./resolveBackdrop";

export type ContrastEval =
  | { kind: "unknown"; reason: string }
  | { kind: "ok"; ratio: number; level: "AAA" | "AA"; largeText: boolean }
  | { kind: "fail"; ratio: number; largeText: boolean };

/** WCAG "large text": ≥24px, or ≥18.66px when bold (≥700). */
function isLargeText(cs: CSSStyleDeclaration): boolean {
  const size = parseFloat(cs.fontSize || "16");
  const weight = parseInt(cs.fontWeight || "400", 10);
  const bold = !Number.isNaN(weight) && weight >= 700;
  return size >= 24 || (bold && size >= 18.66);
}

/**
 * Evaluate text-color contrast for `el`, with `foregroundHex` as the (current,
 * possibly-unsaved) text color from the panel. Returns an honest "unknown" when
 * the result can't be derived from color alone.
 */
export function evaluateContrast(el: Element, foregroundHex: string): ContrastEval {
  if (!isValidHex(foregroundHex)) {
    return { kind: "unknown", reason: "unsupported text color" };
  }

  const cs = getComputedStyle(el);
  if (parseColorAlpha(cs.color) < 1) {
    return { kind: "unknown", reason: "translucent text" };
  }

  const backdrop = resolveBackdropColor(el);
  if ("unknown" in backdrop) {
    return { kind: "unknown", reason: backdrop.reason };
  }

  const ratio = contrastRatio(hexToRgb(foregroundHex), hexToRgb(backdrop.hex));
  const largeText = isLargeText(cs);
  const level = wcagAssessment(ratio, largeText);

  return level === "fail"
    ? { kind: "fail", ratio, largeText }
    : { kind: "ok", ratio, level, largeText };
}
