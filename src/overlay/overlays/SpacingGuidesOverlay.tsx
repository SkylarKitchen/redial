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
 *
 * Position/size tracking goes through the shared `useTrackedOverlay` hook (the
 * event-driven element tracker): scroll is synchronous, size/style/class edits
 * are rAF-coalesced, and `subscribeScrubState` is passed as an extra invalidate
 * source so the guides re-measure when the active scrub/hover group changes
 * (those flags fire no DOM event). Box parsing and per-side zone math are the
 * shared `parseBoxModel` / `buildZones` geometry utils.
 */

import React from "react";
import { color, font, zIndex, overlay, blackAlpha } from "../theme";
import { getScrubGroup, subscribeScrubState } from "../core/scrubState";
import { useTrackedOverlay } from "../hooks/useTrackedOverlay";
import {
  parseBoxModel,
  buildZones,
  type BoxModel,
  type BoxRect,
  type Zone,
} from "../util/boxGeometry";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARGIN_COLOR = overlay.spacing.margin;
const MARGIN_FILL = overlay.spacing.marginFill;
const PADDING_COLOR = overlay.spacing.padding;
const PADDING_FILL = overlay.spacing.paddingFill;
const LABEL_FONT = font.mono;

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

interface Metrics {
  group: "margin" | "padding";
  rect: BoxRect;
  box: BoxModel;
}

function measure(el: Element): Metrics | null {
  const group = getScrubGroup();
  if (!group || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  const rect: BoxRect = {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    right: r.right,
    bottom: r.bottom,
  };
  return { group, rect, box: parseBoxModel(el) };
}

function changeKey(m: Metrics): string {
  const { group, rect: r, box: b } = m;
  return `${group},${r.top},${r.left},${r.width},${r.height},${b.mt},${b.mr},${b.mb},${b.ml},${b.pt},${b.pr},${b.pb},${b.pl}`;
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const BASE: React.CSSProperties = {
  position: "fixed",
  pointerEvents: "none",
  zIndex: zIndex.guide,
};

const BOX_LINE: React.CSSProperties = {
  ...BASE,
  boxSizing: "border-box",
};

function fillColor(group: "margin" | "padding") {
  return group === "margin" ? MARGIN_FILL : PADDING_FILL;
}

function guideColor(group: "margin" | "padding") {
  return group === "margin" ? MARGIN_COLOR : PADDING_COLOR;
}

const BADGE_BASE: React.CSSProperties = {
  ...BASE,
  color: color.primaryForeground,
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

export function SpacingGuidesOverlay({ element }: { element: Element }) {
  const m = useTrackedOverlay(element, true, measure, changeKey, {
    extraInvalidate: subscribeScrubState,
  });

  // Nothing to show when no scrub is active
  if (!m) return null;

  const { group, rect, box } = m;

  const zones = buildZones(box, rect, group);
  if (zones.length === 0) return null;

  // Boundary boxes for visual context
  const marginBox = {
    top: rect.top - box.mt,
    left: rect.left - box.ml,
    width: rect.width + box.ml + box.mr,
    height: rect.height + box.mt + box.mb,
  };

  const contentBox = {
    top: rect.top + box.bt + box.pt,
    left: rect.left + box.bl + box.pl,
    width: Math.max(0, rect.width - box.bl - box.br - box.pl - box.pr),
    height: Math.max(0, rect.height - box.bt - box.bb - box.pt - box.pb),
  };

  return (
    <div className="__tuner-overlay" style={{ ...BASE, top: 0, left: 0, width: "100vw", height: "100vh" }}>
      {group === "margin" ? (
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
            top: rect.top, left: rect.left,
            width: rect.width, height: rect.height,
            border: `1px solid ${MARGIN_COLOR}`, opacity: 0.4,
          }} />
        </>
      ) : (
        <>
          {/* Border-box boundary */}
          <div style={{
            ...BOX_LINE,
            top: rect.top, left: rect.left,
            width: rect.width, height: rect.height,
            border: `1px solid ${PADDING_COLOR}`, opacity: 0.4,
          }} />
          {/* Content-box dashed outline */}
          <div style={{
            ...BOX_LINE,
            top: contentBox.top, left: contentBox.left,
            width: contentBox.width, height: contentBox.height,
            border: `1px dashed ${blackAlpha(0.25)}`,
          }} />
        </>
      )}

      {/* Filled hatched zones + dimension badges */}
      {zones.map((z, i) => (
        <SpacingZone key={`${z.side}-${i}`} zone={z} group={group} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-side hatched zone with centered badge
// ---------------------------------------------------------------------------

function SpacingZone({ zone: z, group }: { zone: Zone; group: "margin" | "padding" }) {
  const label = Math.round(z.value);
  const color = guideColor(group);

  // Badge position: centered in the zone
  const badgeX = z.x + z.w / 2;
  const badgeY = z.y + z.h / 2;

  // Only show badge if zone is large enough to be readable
  const showBadge = z.w >= 20 && z.h >= 14;

  return (
    <>
      {/* Solid fill */}
      <div style={{
        ...BASE,
        left: z.x,
        top: z.y,
        width: z.w,
        height: z.h,
        background: fillColor(group),
        borderTop: z.side === "top" ? `1px solid ${color}` : undefined,
        borderBottom: z.side === "bottom" ? `1px solid ${color}` : undefined,
        borderLeft: z.side === "left" ? `1px solid ${color}` : undefined,
        borderRight: z.side === "right" ? `1px solid ${color}` : undefined,
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
