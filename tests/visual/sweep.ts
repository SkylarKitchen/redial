/**
 * Geometric visual-bug sweep — the "measurable visual bug" oracle.
 *
 * Runs entirely in the page (via page.evaluate) so it measures REAL layout
 * (getBoundingClientRect / scrollWidth / clientWidth) against the live,
 * Tailwind-styled, fully-composed Redial panel. See CONTEXT.md
 * ("Measurable visual bug") and docs/adr/0002-visual-tests-in-browser-mode.md.
 *
 * It treats every Redial surface as a bounded box and flags three classes of
 * geometric defect:
 *   - surface-offviewport   a panel/portal whose rect escapes the viewport
 *   - h-spill               a descendant whose rect exceeds its surface horizontally
 *                           AND whose ancestor chain (incl. the surface) is entirely
 *                           overflow-x:visible — i.e. it actually pokes out, not just
 *                           overflows a clipping/scrolling ancestor
 *   - h-content-clipped     content hard-cut with overflow-x:hidden and no ellipsis
 *                           (text chopped with no scroll/ellipsis affordance)
 *
 * Deliberately NOT flagged (intentional containment, verified against the live panel):
 *   - overflow-x:visible content that stays within the surface (paints, isn't clipped)
 *   - the style-panel root itself is overflow-x:hidden, so internal overflow is clipped
 *     at the panel edge rather than spilling — that's by design
 *   - overflow-x:auto/scroll regions (e.g. the breadcrumb) — they scroll on purpose
 *   - text-overflow:ellipsis truncation (variable pills, long class names)
 *   - the 1px-clip screen-reader-only pattern (clientWidth <= 8)
 *
 * Surfaces = `.__tuner-root` (style panel, navigator, variables) plus any open
 * `[data-tuner-portal]` (dropdowns, color/connect pickers, popovers). The
 * selection-highlight overlay (`.__tuner-selected-outline`) is excluded — it is
 * intentionally sized to the page element, not the panel.
 */
import type { Page } from "@playwright/test";

export interface Finding {
  type: "surface-offviewport" | "h-spill" | "h-content-clipped";
  kind?: "root" | "portal";
  si: number;
  txt?: string;
  edges?: string[];
  tag?: string;
  cls?: string;
  overR?: number;
  overL?: number;
  scrollW?: number;
  clientW?: number;
}

export async function geometricSweep(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    const TOL = 2;
    const clsOf = (el: Element) =>
      ((el as HTMLElement).className &&
      (el as { className?: { baseVal?: string } }).className?.baseVal !== undefined
        ? (el as unknown as { className: { baseVal: string } }).className.baseVal
        : (el as HTMLElement).className || ""
      )
        .toString()
        .slice(0, 40);
    const skip = (el: Element) =>
      el.classList?.contains("__tuner-selected-outline") ||
      !!el.closest?.(".__tuner-selected-outline");

    const findings: Finding[] = [];
    const surfaces = [
      ...[...document.querySelectorAll(".__tuner-root")].map((el) => ({ el, kind: "root" as const })),
      ...[...document.querySelectorAll("[data-tuner-portal]")].map((el) => ({ el, kind: "portal" as const })),
    ];

    surfaces.forEach((s, si) => {
      const root = s.el as HTMLElement;
      if (skip(root)) return;
      const rr = root.getBoundingClientRect();
      if (rr.width < 1 && rr.height < 1) return;

      const edges: string[] = [];
      if (rr.left < -TOL) edges.push("L" + Math.round(rr.left));
      if (rr.top < -TOL) edges.push("T" + Math.round(rr.top));
      if (rr.right > window.innerWidth + TOL) edges.push("R+" + Math.round(rr.right - window.innerWidth));
      if (rr.bottom > window.innerHeight + TOL) edges.push("B+" + Math.round(rr.bottom - window.innerHeight));
      if (edges.length)
        findings.push({
          type: "surface-offviewport",
          kind: s.kind,
          si,
          txt: (root.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24),
          edges,
        });

      root.querySelectorAll("*").forEach((node) => {
        const el = node as HTMLElement;
        if (skip(el)) return;
        const r = el.getBoundingClientRect();
        if (r.width < 1 && r.height < 1) return;
        const cs = getComputedStyle(el);
        // Positioned children are their own surfaces (handled via [data-tuner-portal]); skip here.
        if (
          (r.right > rr.right + TOL || r.left < rr.left - TOL) &&
          cs.position !== "fixed" &&
          cs.position !== "absolute"
        ) {
          // Only a real spill if NOTHING between el and the surface (inclusive)
          // clips horizontally — otherwise it's contained (clipped or scrolled).
          let clipped = false;
          for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
            if (getComputedStyle(n).overflowX !== "visible") {
              clipped = true;
              break;
            }
            if (n === root) break;
          }
          if (!clipped) {
            findings.push({
              type: "h-spill",
              kind: s.kind,
              si,
              tag: el.tagName.toLowerCase(),
              cls: clsOf(el),
              txt: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24),
              overR: Math.round(r.right - rr.right),
              overL: Math.round(rr.left - r.left),
            });
          }
        }
        // Genuine hard cut-off only: overflow-x:hidden with no ellipsis affordance.
        //  - auto/scroll regions scroll on purpose (e.g. the breadcrumb)
        //  - text-overflow:ellipsis truncates on purpose (variable pills, class names)
        //  - clientWidth <= 8 is the 1px screen-reader-only clip
        //  - REQUIRE text content: this class targets "text chopped with no
        //    affordance". A no-text box whose only overflow is a decorative,
        //    out-of-flow position marker (e.g. the color picker's saturation/
        //    hue/opacity handle, centred on the selected value and thus half
        //    outside its overflow:hidden track at the extremes) is intentional
        //    containment, not chopped content — don't flag it.
        const hasText = (el.textContent || "").replace(/\s+/g, " ").trim().length > 0;
        if (
          hasText &&
          el.clientWidth > 8 &&
          cs.overflowX === "hidden" &&
          cs.textOverflow !== "ellipsis" &&
          el.scrollWidth > el.clientWidth + TOL
        ) {
          findings.push({
            type: "h-content-clipped",
            kind: s.kind,
            si,
            tag: el.tagName.toLowerCase(),
            cls: clsOf(el),
            txt: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24),
            scrollW: el.scrollWidth,
            clientW: el.clientWidth,
          });
        }
      });
    });

    // Dedupe structurally-identical findings.
    const seen = new Set<string>();
    return findings.filter((f) => {
      const k = JSON.stringify(f);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });
}
