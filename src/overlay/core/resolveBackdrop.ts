/**
 * resolveBackdrop.ts — Determine the solid color rendered *behind* an element,
 * so text contrast can be judged honestly.
 *
 * The guiding principle is epistemic honesty: when the effective backdrop can't
 * be derived from color alone (images, gradients, translucent stacks, blend
 * modes, filters), we return `{ unknown }` rather than guess. A contrast badge
 * that lies erodes trust in every future proactive feature.
 */
import { cssColorToHex, parseColorAlpha } from "../colorUtils";

export type BackdropResult =
  | { hex: string }
  | { unknown: true; reason: string };

/**
 * If this layer makes the effective backdrop unknowable from color alone,
 * return a human-readable reason; otherwise null.
 * Note: `transform` is deliberately NOT disqualifying — it relocates pixels but
 * does not change color compositing.
 */
function disqualifier(cs: CSSStyleDeclaration): string | null {
  const bgImage = cs.backgroundImage;
  if (bgImage && bgImage !== "none") return "background image or gradient";

  const backdrop = (cs as unknown as { backdropFilter?: string }).backdropFilter;
  if (backdrop && backdrop !== "none") return "backdrop-filter";

  if (cs.filter && cs.filter !== "none") return "filter";

  if (cs.mixBlendMode && cs.mixBlendMode !== "normal") return "blend mode";

  const opacity = parseFloat(cs.opacity || "1");
  if (!Number.isNaN(opacity) && opacity < 1) return "translucent layer (opacity)";

  return null;
}

export function resolveBackdropColor(el: Element): BackdropResult {
  let node: Element | null = el;

  while (node) {
    const cs = getComputedStyle(node);

    const reason = disqualifier(cs);
    if (reason) return { unknown: true, reason };

    const bg = cs.backgroundColor;
    const alpha = parseColorAlpha(bg);

    if (alpha >= 1) {
      const hex = cssColorToHex(bg);
      if (/^#[0-9a-f]{6}$/i.test(hex)) return { hex };
      // Unexpected (e.g. named color) — keep walking rather than guess.
    } else if (alpha > 0) {
      // A translucent layer would need alpha-over compositing to resolve.
      return { unknown: true, reason: "translucent background" };
    }

    node = node.parentElement;
  }

  // Reached the root with only transparent layers: the visible backdrop is the
  // UA viewport canvas — white under a light color-scheme, unknowable otherwise.
  const scheme = (
    getComputedStyle(document.documentElement) as unknown as { colorScheme?: string }
  ).colorScheme;
  if (scheme && scheme.includes("dark")) {
    return { unknown: true, reason: "no opaque background (dark color-scheme)" };
  }
  return { hex: "#ffffff" };
}
