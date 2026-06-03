/**
 * SpacingPreviewOverlay.tsx — Ghosted margin + padding visualization
 *
 * Shows margin (blue) and padding (green) zones as solid semi-transparent
 * fills whenever an element is selected. Zones intensify when the user
 * hovers over the corresponding group in the SpacingBoxModel panel.
 *
 * No dimension badges — those only appear during active scrubbing
 * via SpacingGuidesOverlay.
 *
 * Tracking is delegated to the shared `useTrackedOverlay` hook (the single home
 * for the old per-overlay requestAnimationFrame poll + ResizeObserver + skip-
 * render pattern): scroll is synchronous, size/style/class edits are rAF-
 * coalesced, and engine overrides re-measure for free. The hover group lives
 * inside the tracked metrics object (folded into `changeKey`), and
 * `subscribeScrubState` is passed as the extra invalidate source so a hover/
 * scrub change — which fires no DOM event — still triggers a re-measure. Zone
 * geometry comes from the shared `boxGeometry.buildZones` util.
 */

import React from "react";
import { getHoverGroup, getScrubGroup, subscribeScrubState } from "../core/scrubState";
import { useTrackedOverlay } from "../hooks/useTrackedOverlay";
import { parseBoxModel, buildZones, type BoxModel, type BoxRect } from "../util/boxGeometry";
import { spacingZone, zIndex } from "../theme";

// ---------------------------------------------------------------------------
// Constants — derived from theme tokens
// ---------------------------------------------------------------------------

const MARGIN_FILL_BASE = spacingZone.marginBase;
const MARGIN_FILL_HOVER = spacingZone.marginHover;
const MARGIN_BORDER_BASE = spacingZone.marginBorderBase;
const MARGIN_BORDER_HOVER = spacingZone.marginBorderHover;

const PADDING_FILL_BASE = spacingZone.paddingBase;
const PADDING_FILL_HOVER = spacingZone.paddingHover;
const PADDING_BORDER_BASE = spacingZone.paddingBorderBase;
const PADDING_BORDER_HOVER = spacingZone.paddingBorderHover;


// ---------------------------------------------------------------------------
// Types & measurement
// ---------------------------------------------------------------------------

/** Tracked metrics: border-box rect, parsed box model, and the hovered group. */
interface SpacingMetrics {
  rect: BoxRect;
  box: BoxModel;
  hover: "margin" | "padding" | null;
}

function measure(el: Element): SpacingMetrics | null {
  if (!el.isConnected) return null;
  const r = el.getBoundingClientRect();
  const rect: BoxRect = {
    top: r.top, left: r.left, width: r.width, height: r.height,
    right: r.right, bottom: r.bottom,
  };
  const box = parseBoxModel(el);
  // While scrubbing, suppress hover intensify (the scrub guides take over).
  const hover = getScrubGroup() ? null : getHoverGroup();
  return { rect, box, hover };
}

/**
 * Collapse metrics to a string so identical layout + hover doesn't re-render.
 * Mirrors the old metricsKey (rect top/left/width/height + the eight margin/
 * padding edges) and folds in the hover group so a hover change triggers a render.
 */
function changeKey(m: SpacingMetrics): string {
  const { rect, box } = m;
  return `${rect.top},${rect.left},${rect.width},${rect.height},${box.mt},${box.mr},${box.mb},${box.ml},${box.pt},${box.pr},${box.pb},${box.pl}|${m.hover}`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BASE: React.CSSProperties = {
  position: "fixed",
  pointerEvents: "none",
  zIndex: zIndex.backdrop,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpacingPreviewOverlay({ element }: { element: Element }) {
  const m = useTrackedOverlay(element, true, measure, changeKey, {
    extraInvalidate: subscribeScrubState,
  });

  if (!m) return null;

  const marginZones = buildZones(m.box, m.rect, "margin");
  const paddingZones = buildZones(m.box, m.rect, "padding");

  if (marginZones.length === 0 && paddingZones.length === 0) return null;

  const marginHovered = m.hover === "margin";
  const paddingHovered = m.hover === "padding";

  const marginFill = marginHovered ? MARGIN_FILL_HOVER : MARGIN_FILL_BASE;
  const marginBorder = marginHovered ? MARGIN_BORDER_HOVER : MARGIN_BORDER_BASE;
  const paddingFill = paddingHovered ? PADDING_FILL_HOVER : PADDING_FILL_BASE;
  const paddingBorder = paddingHovered ? PADDING_BORDER_HOVER : PADDING_BORDER_BASE;

  return (
    <div className="__tuner-overlay" style={{ ...BASE, top: 0, left: 0, width: "100vw", height: "100vh" }}>
      {/* Ghosted margin zones (blue) */}
      {marginZones.map((z, i) => (
        <div
          key={`m-${z.side}-${i}`}
          style={{
            ...BASE,
            left: z.x,
            top: z.y,
            width: z.w,
            height: z.h,
            background: marginFill,
            borderTop: z.side === "top" ? `1px solid ${marginBorder}` : undefined,
            borderBottom: z.side === "bottom" ? `1px solid ${marginBorder}` : undefined,
            borderLeft: z.side === "left" ? `1px solid ${marginBorder}` : undefined,
            borderRight: z.side === "right" ? `1px solid ${marginBorder}` : undefined,
            boxSizing: "border-box",
          }}
        />
      ))}

      {/* Ghosted padding zones (green) */}
      {paddingZones.map((z, i) => (
        <div
          key={`p-${z.side}-${i}`}
          style={{
            ...BASE,
            left: z.x,
            top: z.y,
            width: z.w,
            height: z.h,
            background: paddingFill,
            borderTop: z.side === "top" ? `1px solid ${paddingBorder}` : undefined,
            borderBottom: z.side === "bottom" ? `1px solid ${paddingBorder}` : undefined,
            borderLeft: z.side === "left" ? `1px solid ${paddingBorder}` : undefined,
            borderRight: z.side === "right" ? `1px solid ${paddingBorder}` : undefined,
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  );
}
