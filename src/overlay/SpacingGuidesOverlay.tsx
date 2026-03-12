/**
 * SpacingGuidesOverlay.tsx — Webflow-style spacing visualization
 *
 * Shows filled rectangular zones with horizontal hatching lines while the user
 * is actively scrubbing a spacing value.  Only the property group being
 * edited is visualised (margin OR padding, never both at once).
 *
 * Each side of the active group gets a filled zone with a striped pattern
 * and a centered dimension badge showing the current pixel value.
 *
 * Visibility is driven by getScrubGroup() — the component self-hides
 * when no scrub is active, so it can be rendered unconditionally.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getScrubGroup } from "./scrubState";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARGIN_COLOR = "#57A8FF";
const MARGIN_HATCH = "rgba(87,168,255,0.18)";
const PADDING_COLOR = "#4CAF50";
const PADDING_HATCH = "rgba(76,175,80,0.18)";
const HATCH_SPACING = 4; // px between hatching lines
const Z_INDEX = 2147483645;
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

interface ZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;
  side: "top" | "right" | "bottom" | "left";
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

// ---------------------------------------------------------------------------
// Zone computation
// ---------------------------------------------------------------------------

function buildZones(snap: Snapshot): ZoneRect[] {
  const zones: ZoneRect[] = [];

  if (snap.group === "margin") {
    // Top margin — full outer width
    if (snap.mt > 0) zones.push({
      x: snap.left - snap.ml, y: snap.top - snap.mt,
      w: snap.width + snap.ml + snap.mr, h: snap.mt,
      value: snap.mt, side: "top",
    });
    // Bottom margin — full outer width
    if (snap.mb > 0) zones.push({
      x: snap.left - snap.ml, y: snap.bottom,
      w: snap.width + snap.ml + snap.mr, h: snap.mb,
      value: snap.mb, side: "bottom",
    });
    // Left margin — excludes top/bottom corners
    if (snap.ml > 0) zones.push({
      x: snap.left - snap.ml, y: snap.top,
      w: snap.ml, h: snap.height,
      value: snap.ml, side: "left",
    });
    // Right margin — excludes top/bottom corners
    if (snap.mr > 0) zones.push({
      x: snap.right, y: snap.top,
      w: snap.mr, h: snap.height,
      value: snap.mr, side: "right",
    });
  } else {
    // Padding zones — inside the border box
    const iT = snap.top + snap.bt;
    const iR = snap.right - snap.br;
    const iB = snap.bottom - snap.bb;
    const iL = snap.left + snap.bl;
    const innerW = iR - iL;
    const innerH = iB - iT;

    // Top padding — full inner width
    if (snap.pt > 0) zones.push({
      x: iL, y: iT,
      w: innerW, h: snap.pt,
      value: snap.pt, side: "top",
    });
    // Bottom padding — full inner width
    if (snap.pb > 0) zones.push({
      x: iL, y: iB - snap.pb,
      w: innerW, h: snap.pb,
      value: snap.pb, side: "bottom",
    });
    // Left padding — excludes top/bottom corners
    if (snap.pl > 0) zones.push({
      x: iL, y: iT + snap.pt,
      w: snap.pl, h: Math.max(0, innerH - snap.pt - snap.pb),
      value: snap.pl, side: "left",
    });
    // Right padding — excludes top/bottom corners
    if (snap.pr > 0) zones.push({
      x: iR - snap.pr, y: iT + snap.pt,
      w: snap.pr, h: Math.max(0, innerH - snap.pt - snap.pb),
      value: snap.pr, side: "right",
    });
  }

  return zones;
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

function hatchBg(group: "margin" | "padding") {
  const fg = group === "margin" ? MARGIN_HATCH : PADDING_HATCH;
  return `repeating-linear-gradient(45deg, ${fg} 0px, ${fg} 1px, transparent 1px, transparent ${HATCH_SPACING}px)`;
}

function guideColor(group: "margin" | "padding") {
  return group === "margin" ? MARGIN_COLOR : PADDING_COLOR;
}

const BADGE_BASE: React.CSSProperties = {
  ...BASE,
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

  const zones = buildZones(snap);
  if (zones.length === 0) return null;

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
            border: `1px solid ${MARGIN_COLOR}`, opacity: 0.4,
          }} />
          {/* Border-box boundary */}
          <div style={{
            ...BOX_LINE,
            top: snap.top, left: snap.left,
            width: snap.width, height: snap.height,
            border: `1px solid ${MARGIN_COLOR}`, opacity: 0.4,
          }} />
        </>
      ) : (
        <>
          {/* Border-box boundary */}
          <div style={{
            ...BOX_LINE,
            top: snap.top, left: snap.left,
            width: snap.width, height: snap.height,
            border: `1px solid ${PADDING_COLOR}`, opacity: 0.4,
          }} />
          {/* Content-box dashed outline */}
          <div style={{
            ...BOX_LINE,
            top: contentBox.top, left: contentBox.left,
            width: contentBox.width, height: contentBox.height,
            border: "1px dashed rgba(0,0,0,0.25)",
          }} />
        </>
      )}

      {/* Filled hatched zones + dimension badges */}
      {zones.map((z, i) => (
        <SpacingZone key={`${z.side}-${i}`} zone={z} group={snap.group} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-side hatched zone with centered badge
// ---------------------------------------------------------------------------

function SpacingZone({ zone: z, group }: { zone: ZoneRect; group: "margin" | "padding" }) {
  const label = Math.round(z.value);
  const color = guideColor(group);

  // Badge position: centered in the zone
  const badgeX = z.x + z.w / 2;
  const badgeY = z.y + z.h / 2;

  // Only show badge if zone is large enough to be readable
  const showBadge = z.w >= 20 && z.h >= 14;

  return (
    <>
      {/* Hatched fill */}
      <div style={{
        ...BASE,
        left: z.x,
        top: z.y,
        width: z.w,
        height: z.h,
        background: hatchBg(group),
        borderTop: z.side === "top" ? `1px solid ${color}` : undefined,
        borderBottom: z.side === "bottom" ? `1px solid ${color}` : undefined,
        borderLeft: z.side === "left" ? `1px solid ${color}` : undefined,
        borderRight: z.side === "right" ? `1px solid ${color}` : undefined,
        opacity: 0.9,
        boxSizing: "border-box",
      }} />

      {/* Dimension badge */}
      {showBadge && (
        <div style={{
          ...BADGE_BASE,
          background: color,
          left: badgeX,
          top: badgeY,
          transform: "translate(-50%, -50%)",
        }}>
          {label}
        </div>
      )}
    </>
  );
}
