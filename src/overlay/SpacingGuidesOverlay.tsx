/**
 * SpacingGuidesOverlay.tsx — Webflow-style spacing visualization
 *
 * Shows green guide lines with arrows and dimension badges for margin
 * and padding on the selected element. Renders:
 * - Boundary rectangles for margin-box and border-box
 * - Dashed content-box outline
 * - Per-side measurement arrows with dimension badges
 *
 * Uses RAF loop + ResizeObserver for live position tracking.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUIDE_COLOR = "#4CAF50";
const Z_INDEX = 2147483645;
const ARROW = 4;
const MIN_ARROW_GAP = 10;
const LABEL_FONT = "ui-monospace, 'SF Mono', monospace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoxMetrics {
  top: number; left: number; width: number; height: number;
  right: number; bottom: number;
  mt: number; mr: number; mb: number; ml: number;
  pt: number; pr: number; pb: number; pl: number;
  bt: number; br: number; bb: number; bl: number;
}

interface Guide {
  value: number;
  vertical: boolean;
  /** Boundary A — top/left end (smaller coordinate) */
  ax: number; ay: number;
  /** Boundary B — bottom/right end (larger coordinate) */
  bx: number; by: number;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function px(v: string): number {
  return parseFloat(v) || 0;
}

function computeMetrics(el: Element): BoxMetrics | null {
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

function metricsKey(m: BoxMetrics): string {
  return `${m.top},${m.left},${m.width},${m.height},${m.mt},${m.mr},${m.mb},${m.ml},${m.pt},${m.pr},${m.pb},${m.pl},${m.bt},${m.br},${m.bb},${m.bl}`;
}

function buildGuides(m: BoxMetrics): Guide[] {
  const guides: Guide[] = [];
  const cx = m.left + m.width / 2;
  const cy = m.top + m.height / 2;

  // Margin guides (outward from border-box)
  if (m.mt > 0) guides.push({ value: m.mt, vertical: true,
    ax: cx, ay: m.top - m.mt, bx: cx, by: m.top });
  if (m.mr > 0) guides.push({ value: m.mr, vertical: false,
    ax: m.right, ay: cy, bx: m.right + m.mr, by: cy });
  if (m.mb > 0) guides.push({ value: m.mb, vertical: true,
    ax: cx, ay: m.bottom, bx: cx, by: m.bottom + m.mb });
  if (m.ml > 0) guides.push({ value: m.ml, vertical: false,
    ax: m.left - m.ml, ay: cy, bx: m.left, by: cy });

  // Padding guides (inward from padding-box edge to content edge)
  const pT = m.top + m.bt;
  const pR = m.right - m.br;
  const pB = m.bottom - m.bb;
  const pL = m.left + m.bl;

  if (m.pt > 0) guides.push({ value: m.pt, vertical: true,
    ax: cx, ay: pT, bx: cx, by: pT + m.pt });
  if (m.pr > 0) guides.push({ value: m.pr, vertical: false,
    ax: pR - m.pr, ay: cy, bx: pR, by: cy });
  if (m.pb > 0) guides.push({ value: m.pb, vertical: true,
    ax: cx, ay: pB - m.pb, bx: cx, by: pB });
  if (m.pl > 0) guides.push({ value: m.pl, vertical: false,
    ax: pL, ay: cy, bx: pL + m.pl, by: cy });

  return guides;
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const BASE: React.CSSProperties = {
  position: "fixed",
  pointerEvents: "none",
  zIndex: Z_INDEX,
};

const BOUNDARY_LINE: React.CSSProperties = {
  ...BASE,
  boxSizing: "border-box",
};

const BADGE_STYLE: React.CSSProperties = {
  ...BASE,
  background: GUIDE_COLOR,
  color: "#fff",
  fontSize: 10,
  fontFamily: LABEL_FONT,
  fontWeight: 600,
  padding: "2px 5px",
  borderRadius: 3,
  lineHeight: "14px",
  whiteSpace: "nowrap",
  letterSpacing: "0.02em",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpacingGuidesOverlay({
  element,
  refreshKey,
}: {
  element: Element;
  refreshKey?: number;
}) {
  const [metrics, setMetrics] = useState<BoxMetrics | null>(null);
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

  const m = metrics;
  const hasMargin = m.mt > 0 || m.mr > 0 || m.mb > 0 || m.ml > 0;
  const hasPadding = m.pt > 0 || m.pr > 0 || m.pb > 0 || m.pl > 0;

  if (!hasMargin && !hasPadding) return null;

  // Derived boxes
  const marginBox = {
    top: m.top - m.mt,
    left: m.left - m.ml,
    width: m.width + m.ml + m.mr,
    height: m.height + m.mt + m.mb,
  };

  const contentBox = {
    top: m.top + m.bt + m.pt,
    left: m.left + m.bl + m.pl,
    width: Math.max(0, m.width - m.bl - m.br - m.pl - m.pr),
    height: Math.max(0, m.height - m.bt - m.bb - m.pt - m.pb),
  };

  const guides = buildGuides(m);

  return (
    <div style={{ ...BASE, top: 0, left: 0, width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Margin-box boundary rectangle */}
      {hasMargin && (
        <div style={{
          ...BOUNDARY_LINE,
          top: marginBox.top,
          left: marginBox.left,
          width: marginBox.width,
          height: marginBox.height,
          border: `1px solid ${GUIDE_COLOR}`,
          opacity: 0.4,
        }} />
      )}

      {/* Border-box boundary rectangle */}
      <div style={{
        ...BOUNDARY_LINE,
        top: m.top,
        left: m.left,
        width: m.width,
        height: m.height,
        border: `1px solid ${GUIDE_COLOR}`,
        opacity: 0.4,
      }} />

      {/* Content-box dashed outline */}
      {hasPadding && (
        <div style={{
          ...BOUNDARY_LINE,
          top: contentBox.top,
          left: contentBox.left,
          width: contentBox.width,
          height: contentBox.height,
          border: "1px dashed rgba(255,255,255,0.3)",
        }} />
      )}

      {/* Per-side measurement guides */}
      {guides.map((g, i) => (
        <GuideLines key={i} guide={g} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-side guide (arrows + measurement line + badge)
// ---------------------------------------------------------------------------

function GuideLines({ guide: g }: { guide: Guide }) {
  const gap = g.vertical ? Math.abs(g.by - g.ay) : Math.abs(g.bx - g.ax);
  const showArrows = gap >= MIN_ARROW_GAP;
  const midX = (g.ax + g.bx) / 2;
  const midY = (g.ay + g.by) / 2;
  const label = Math.round(g.value);

  return (
    <>
      {/* Measurement line connecting A → B (between arrow tips) */}
      {g.vertical ? (
        <div style={{
          ...BASE, left: g.ax, top: g.ay + (showArrows ? ARROW : 0),
          width: 0,
          height: Math.max(0, gap - (showArrows ? ARROW * 2 : 0)),
          borderLeft: `1px solid ${GUIDE_COLOR}`,
          opacity: 0.7,
        }} />
      ) : (
        <div style={{
          ...BASE, left: g.ax + (showArrows ? ARROW : 0), top: g.ay,
          width: Math.max(0, gap - (showArrows ? ARROW * 2 : 0)),
          height: 0,
          borderTop: `1px solid ${GUIDE_COLOR}`,
          opacity: 0.7,
        }} />
      )}

      {/* Arrow at A (base at boundary, tip pointing into gap toward B) */}
      {showArrows && (
        g.vertical ? (
          <div style={{
            ...BASE, left: g.ax - ARROW, top: g.ay,
            width: 0, height: 0,
            borderLeft: `${ARROW}px solid transparent`,
            borderRight: `${ARROW}px solid transparent`,
            borderTop: `${ARROW}px solid ${GUIDE_COLOR}`,
            opacity: 0.7,
          }} />
        ) : (
          <div style={{
            ...BASE, left: g.ax, top: g.ay - ARROW,
            width: 0, height: 0,
            borderTop: `${ARROW}px solid transparent`,
            borderBottom: `${ARROW}px solid transparent`,
            borderLeft: `${ARROW}px solid ${GUIDE_COLOR}`,
            opacity: 0.7,
          }} />
        )
      )}

      {/* Arrow at B (base at boundary, tip pointing into gap toward A) */}
      {showArrows && (
        g.vertical ? (
          <div style={{
            ...BASE, left: g.bx - ARROW, top: g.by - ARROW,
            width: 0, height: 0,
            borderLeft: `${ARROW}px solid transparent`,
            borderRight: `${ARROW}px solid transparent`,
            borderBottom: `${ARROW}px solid ${GUIDE_COLOR}`,
            opacity: 0.7,
          }} />
        ) : (
          <div style={{
            ...BASE, left: g.bx - ARROW, top: g.by - ARROW,
            width: 0, height: 0,
            borderTop: `${ARROW}px solid transparent`,
            borderBottom: `${ARROW}px solid transparent`,
            borderRight: `${ARROW}px solid ${GUIDE_COLOR}`,
            opacity: 0.7,
          }} />
        )
      )}

      {/* Dimension badge */}
      <div style={{
        ...BADGE_STYLE,
        left: g.vertical ? midX + 8 : midX,
        top: g.vertical ? midY : midY - 20,
        transform: g.vertical ? "translateY(-50%)" : "translateX(-50%)",
      }}>
        {label}
      </div>
    </>
  );
}
