/**
 * SpacingPreviewOverlay.tsx — Ghosted margin + padding visualization
 *
 * Shows margin (blue) and padding (green) zones as solid semi-transparent
 * fills whenever an element is selected. Zones intensify when the user
 * hovers over the corresponding group in the SpacingBoxModel panel.
 *
 * No dimension badges — those only appear during active scrubbing
 * via SpacingGuidesOverlay.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getHoverGroup, getScrubGroup } from "../core/scrubState";
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
// Types
// ---------------------------------------------------------------------------

interface SpacingMetrics {
  top: number; left: number; width: number; height: number;
  right: number; bottom: number;
  mt: number; mr: number; mb: number; ml: number;
  pt: number; pr: number; pb: number; pl: number;
  bt: number; br: number; bb: number; bl: number;
}

interface ZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
  side: "top" | "right" | "bottom" | "left";
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

function px(v: string): number {
  return parseFloat(v) || 0;
}

function computeMetrics(el: Element): SpacingMetrics | null {
  if (!el.isConnected) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    top: r.top, left: r.left, width: r.width, height: r.height,
    right: r.right, bottom: r.bottom,
    mt: px(cs.marginTop), mr: px(cs.marginRight),
    mb: px(cs.marginBottom), ml: px(cs.marginLeft),
    pt: px(cs.paddingTop), pr: px(cs.paddingRight),
    pb: px(cs.paddingBottom), pl: px(cs.paddingLeft),
    bt: px(cs.borderTopWidth), br: px(cs.borderRightWidth),
    bb: px(cs.borderBottomWidth), bl: px(cs.borderLeftWidth),
  };
}

// ---------------------------------------------------------------------------
// Zone builders
// ---------------------------------------------------------------------------

function buildMarginZones(m: SpacingMetrics): ZoneRect[] {
  const zones: ZoneRect[] = [];
  if (m.mt > 0) zones.push({
    x: m.left - m.ml, y: m.top - m.mt,
    w: m.width + m.ml + m.mr, h: m.mt, side: "top",
  });
  if (m.mb > 0) zones.push({
    x: m.left - m.ml, y: m.bottom,
    w: m.width + m.ml + m.mr, h: m.mb, side: "bottom",
  });
  if (m.ml > 0) zones.push({
    x: m.left - m.ml, y: m.top,
    w: m.ml, h: m.height, side: "left",
  });
  if (m.mr > 0) zones.push({
    x: m.right, y: m.top,
    w: m.mr, h: m.height, side: "right",
  });
  return zones;
}

function buildPaddingZones(m: SpacingMetrics): ZoneRect[] {
  const iT = m.top + m.bt;
  const iR = m.right - m.br;
  const iB = m.bottom - m.bb;
  const iL = m.left + m.bl;
  const innerW = iR - iL;
  const innerH = iB - iT;

  const zones: ZoneRect[] = [];
  if (m.pt > 0) zones.push({
    x: iL, y: iT, w: innerW, h: m.pt, side: "top",
  });
  if (m.pb > 0) zones.push({
    x: iL, y: iB - m.pb, w: innerW, h: m.pb, side: "bottom",
  });
  if (m.pl > 0) zones.push({
    x: iL, y: iT + m.pt,
    w: m.pl, h: Math.max(0, innerH - m.pt - m.pb), side: "left",
  });
  if (m.pr > 0) zones.push({
    x: iR - m.pr, y: iT + m.pt,
    w: m.pr, h: Math.max(0, innerH - m.pt - m.pb), side: "right",
  });
  return zones;
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

export function SpacingPreviewOverlay({
  element,
  refreshKey,
}: {
  element: Element;
  refreshKey?: number;
}) {
  const [metrics, setMetrics] = useState<SpacingMetrics | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<"margin" | "padding" | null>(null);
  const rafRef = useRef(0);
  const prevMetricsRef = useRef("");
  const prevHoverRef = useRef<"margin" | "padding" | null>(null);

  const measure = useCallback(() => {
    const m = computeMetrics(element);
    const metricsKey = m
      ? `${m.top},${m.left},${m.width},${m.height},${m.mt},${m.mr},${m.mb},${m.ml},${m.pt},${m.pr},${m.pb},${m.pl}`
      : "";
    const hover = getScrubGroup() ? null : getHoverGroup();

    const metricsChanged = metricsKey !== prevMetricsRef.current;
    const hoverChanged = hover !== prevHoverRef.current;

    if (metricsChanged) {
      prevMetricsRef.current = metricsKey;
      setMetrics(m);
    }
    if (hoverChanged) {
      prevHoverRef.current = hover;
      setHoveredGroup(hover);
    }
  }, [element]);

  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      measure();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      if (!cancelled) measure();
    });
    ro.observe(element);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [element, refreshKey, measure]);

  if (!metrics) return null;

  const marginZones = buildMarginZones(metrics);
  const paddingZones = buildPaddingZones(metrics);

  if (marginZones.length === 0 && paddingZones.length === 0) return null;

  const marginHovered = hoveredGroup === "margin";
  const paddingHovered = hoveredGroup === "padding";

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
