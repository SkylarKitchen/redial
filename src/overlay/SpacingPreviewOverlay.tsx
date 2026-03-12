/**
 * SpacingPreviewOverlay.tsx — Ghosted margin + padding visualization
 *
 * Always shows both margin (blue) and padding (green) zones at reduced
 * opacity whenever an element is selected. No dimension badges — those
 * only appear during active scrubbing via SpacingGuidesOverlay.
 *
 * This gives persistent visual context about spacing, similar to how
 * Chrome DevTools or Figma show box-model zones on selection.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARGIN_COLOR = "#57A8FF";
const MARGIN_HATCH = "rgba(87,168,255,0.10)";
const PADDING_COLOR = "#4CAF50";
const PADDING_HATCH = "rgba(76,175,80,0.10)";
const HATCH_SPACING = 4;
const Z_INDEX = 2147483644; // Below the active spacing guides (2147483645)

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

function metricsKey(m: SpacingMetrics): string {
  return `${m.top},${m.left},${m.width},${m.height},${m.mt},${m.mr},${m.mb},${m.ml},${m.pt},${m.pr},${m.pb},${m.pl}`;
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
  zIndex: Z_INDEX,
};

function hatchBg(group: "margin" | "padding") {
  const fg = group === "margin" ? MARGIN_HATCH : PADDING_HATCH;
  return `repeating-linear-gradient(45deg, ${fg} 0px, ${fg} 1px, transparent 1px, transparent ${HATCH_SPACING}px)`;
}

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
  const rafRef = useRef(0);
  const prevRef = useRef("");

  const measure = useCallback(() => {
    const m = computeMetrics(element);
    const key = m ? metricsKey(m) : "";
    if (key !== prevRef.current) {
      prevRef.current = key;
      setMetrics(m);
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

  return (
    <div style={{ ...BASE, top: 0, left: 0, width: "100vw", height: "100vh" }}>
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
            background: hatchBg("margin"),
            borderTop: z.side === "top" ? `1px solid ${MARGIN_COLOR}` : undefined,
            borderBottom: z.side === "bottom" ? `1px solid ${MARGIN_COLOR}` : undefined,
            borderLeft: z.side === "left" ? `1px solid ${MARGIN_COLOR}` : undefined,
            borderRight: z.side === "right" ? `1px solid ${MARGIN_COLOR}` : undefined,
            opacity: 0.5,
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
            background: hatchBg("padding"),
            borderTop: z.side === "top" ? `1px solid ${PADDING_COLOR}` : undefined,
            borderBottom: z.side === "bottom" ? `1px solid ${PADDING_COLOR}` : undefined,
            borderLeft: z.side === "left" ? `1px solid ${PADDING_COLOR}` : undefined,
            borderRight: z.side === "right" ? `1px solid ${PADDING_COLOR}` : undefined,
            opacity: 0.5,
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  );
}
