/**
 * SpacingGuidesOverlay.tsx — Webflow-style spacing visualization
 *
 * Shows green guide lines with arrows and dimension badges while the user
 * is actively scrubbing a spacing value.  Only the property group being
 * edited is visualised (margin OR padding, never both at once).
 *
 * Visibility is driven by getScrubGroup() — the component self-hides
 * when no scrub is active, so it can be rendered unconditionally.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getScrubGroup } from "./scrubState";

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

interface Snapshot {
  group: "margin" | "padding";
  top: number; left: number; width: number; height: number;
  right: number; bottom: number;
  mt: number; mr: number; mb: number; ml: number;
  pt: number; pr: number; pb: number; pl: number;
  bt: number; br: number; bb: number; bl: number;
}

interface Guide {
  value: number;
  vertical: boolean;
  ax: number; ay: number;
  bx: number; by: number;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function px(v: string): number {
  return parseFloat(v) || 0;
}

function computeSnapshot(el: Element): Snapshot | null {
  const group = getScrubGroup();
  if (!group || !el.isConnected) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    group,
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

function snapshotKey(s: Snapshot): string {
  return `${s.group},${s.top},${s.left},${s.width},${s.height},${s.mt},${s.mr},${s.mb},${s.ml},${s.pt},${s.pr},${s.pb},${s.pl}`;
}

function buildGuides(s: Snapshot): Guide[] {
  const guides: Guide[] = [];
  const cx = s.left + s.width / 2;
  const cy = s.top + s.height / 2;

  if (s.group === "margin") {
    if (s.mt > 0) guides.push({ value: s.mt, vertical: true,
      ax: cx, ay: s.top - s.mt, bx: cx, by: s.top });
    if (s.mr > 0) guides.push({ value: s.mr, vertical: false,
      ax: s.right, ay: cy, bx: s.right + s.mr, by: cy });
    if (s.mb > 0) guides.push({ value: s.mb, vertical: true,
      ax: cx, ay: s.bottom, bx: cx, by: s.bottom + s.mb });
    if (s.ml > 0) guides.push({ value: s.ml, vertical: false,
      ax: s.left - s.ml, ay: cy, bx: s.left, by: cy });
  } else {
    const pT = s.top + s.bt;
    const pR = s.right - s.br;
    const pB = s.bottom - s.bb;
    const pL = s.left + s.bl;
    if (s.pt > 0) guides.push({ value: s.pt, vertical: true,
      ax: cx, ay: pT, bx: cx, by: pT + s.pt });
    if (s.pr > 0) guides.push({ value: s.pr, vertical: false,
      ax: pR - s.pr, ay: cy, bx: pR, by: cy });
    if (s.pb > 0) guides.push({ value: s.pb, vertical: true,
      ax: cx, ay: pB - s.pb, bx: cx, by: pB });
    if (s.pl > 0) guides.push({ value: s.pl, vertical: false,
      ax: pL, ay: cy, bx: pL + s.pl, by: cy });
  }

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

const BOX_LINE: React.CSSProperties = {
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
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const rafRef = useRef(0);
  const prevRef = useRef("");

  const measure = useCallback(() => {
    const s = computeSnapshot(element);
    const key = s ? snapshotKey(s) : "";
    if (key !== prevRef.current) {
      prevRef.current = key;
      setSnap(s);
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

  // Nothing to show when no scrub is active
  if (!snap) return null;

  const guides = buildGuides(snap);
  if (guides.length === 0) return null;

  // Boundary boxes for visual context
  const marginBox = {
    top: snap.top - snap.mt,
    left: snap.left - snap.ml,
    width: snap.width + snap.ml + snap.mr,
    height: snap.height + snap.mt + snap.mb,
  };

  const contentBox = {
    top: snap.top + snap.bt + snap.pt,
    left: snap.left + snap.bl + snap.pl,
    width: Math.max(0, snap.width - snap.bl - snap.br - snap.pl - snap.pr),
    height: Math.max(0, snap.height - snap.bt - snap.bb - snap.pt - snap.pb),
  };

  return (
    <div style={{ ...BASE, top: 0, left: 0, width: "100vw", height: "100vh" }}>
      {snap.group === "margin" ? (
        <>
          {/* Margin-box boundary */}
          <div style={{
            ...BOX_LINE,
            top: marginBox.top, left: marginBox.left,
            width: marginBox.width, height: marginBox.height,
            border: `1px solid ${GUIDE_COLOR}`, opacity: 0.4,
          }} />
          {/* Border-box boundary */}
          <div style={{
            ...BOX_LINE,
            top: snap.top, left: snap.left,
            width: snap.width, height: snap.height,
            border: `1px solid ${GUIDE_COLOR}`, opacity: 0.4,
          }} />
        </>
      ) : (
        <>
          {/* Border-box boundary */}
          <div style={{
            ...BOX_LINE,
            top: snap.top, left: snap.left,
            width: snap.width, height: snap.height,
            border: `1px solid ${GUIDE_COLOR}`, opacity: 0.4,
          }} />
          {/* Content-box dashed outline */}
          <div style={{
            ...BOX_LINE,
            top: contentBox.top, left: contentBox.left,
            width: contentBox.width, height: contentBox.height,
            border: "1px dashed rgba(255,255,255,0.3)",
          }} />
        </>
      )}

      {guides.map((g, i) => (
        <GuideLine key={i} guide={g} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-side guide (arrows + measurement line + badge)
// ---------------------------------------------------------------------------

function GuideLine({ guide: g }: { guide: Guide }) {
  const gap = g.vertical ? Math.abs(g.by - g.ay) : Math.abs(g.bx - g.ax);
  const showArrows = gap >= MIN_ARROW_GAP;
  const midX = (g.ax + g.bx) / 2;
  const midY = (g.ay + g.by) / 2;
  const label = Math.round(g.value);

  return (
    <>
      {/* Measurement line */}
      {g.vertical ? (
        <div style={{
          ...BASE, left: g.ax, top: g.ay + (showArrows ? ARROW : 0),
          width: 0,
          height: Math.max(0, gap - (showArrows ? ARROW * 2 : 0)),
          borderLeft: `1px solid ${GUIDE_COLOR}`, opacity: 0.7,
        }} />
      ) : (
        <div style={{
          ...BASE, left: g.ax + (showArrows ? ARROW : 0), top: g.ay,
          width: Math.max(0, gap - (showArrows ? ARROW * 2 : 0)),
          height: 0,
          borderTop: `1px solid ${GUIDE_COLOR}`, opacity: 0.7,
        }} />
      )}

      {/* Arrow at A (pointing toward B) */}
      {showArrows && (
        g.vertical ? (
          <div style={{
            ...BASE, left: g.ax - ARROW, top: g.ay,
            width: 0, height: 0,
            borderLeft: `${ARROW}px solid transparent`,
            borderRight: `${ARROW}px solid transparent`,
            borderTop: `${ARROW}px solid ${GUIDE_COLOR}`, opacity: 0.7,
          }} />
        ) : (
          <div style={{
            ...BASE, left: g.ax, top: g.ay - ARROW,
            width: 0, height: 0,
            borderTop: `${ARROW}px solid transparent`,
            borderBottom: `${ARROW}px solid transparent`,
            borderLeft: `${ARROW}px solid ${GUIDE_COLOR}`, opacity: 0.7,
          }} />
        )
      )}

      {/* Arrow at B (pointing toward A) */}
      {showArrows && (
        g.vertical ? (
          <div style={{
            ...BASE, left: g.bx - ARROW, top: g.by - ARROW,
            width: 0, height: 0,
            borderLeft: `${ARROW}px solid transparent`,
            borderRight: `${ARROW}px solid transparent`,
            borderBottom: `${ARROW}px solid ${GUIDE_COLOR}`, opacity: 0.7,
          }} />
        ) : (
          <div style={{
            ...BASE, left: g.bx - ARROW, top: g.by - ARROW,
            width: 0, height: 0,
            borderTop: `${ARROW}px solid transparent`,
            borderBottom: `${ARROW}px solid transparent`,
            borderRight: `${ARROW}px solid ${GUIDE_COLOR}`, opacity: 0.7,
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
