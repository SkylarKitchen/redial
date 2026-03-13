/**
 * FlexGapOverlay.tsx — Figma-style gap visualization for flex containers
 *
 * When a flex container is selected, renders pink dashed hatched rectangles
 * in the gap spaces between direct children. Measures child bounding rects
 * and computes gap regions along the main axis (row or column).
 *
 * Uses a RAF loop + ResizeObserver to stay in sync with layout changes,
 * following the same pattern as GridOverlay and SpacingGuidesOverlay.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { font } from "./theme";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAP_COLOR = "#FF44CC";
const GAP_HATCH = "rgba(255,68,204,0.15)";
const GAP_BORDER = "rgba(255,68,204,0.5)";
const HATCH_SPACING = 5;
const Z_INDEX = 2147483645;
const LABEL_FONT = font.mono;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GapRect {
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;
}

interface FlexMetrics {
  direction: "row" | "column";
  gaps: GapRect[];
}

// ---------------------------------------------------------------------------
// Metric computation
// ---------------------------------------------------------------------------

function computeMetrics(el: Element): FlexMetrics | null {
  const style = getComputedStyle(el);
  const display = style.display;
  if (display !== "flex" && display !== "inline-flex") return null;

  const dir = style.flexDirection;
  const isRow = dir === "row" || dir === "row-reverse";
  const direction: "row" | "column" = isRow ? "row" : "column";

  // Get visible direct children bounding rects
  const children = Array.from(el.children).filter((child) => {
    const cs = getComputedStyle(child);
    return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
  });

  if (children.length < 2) return { direction, gaps: [] };

  const rects = children.map((child) => child.getBoundingClientRect());

  // Sort by position along main axis
  if (isRow) {
    const indexed = rects.map((r, i) => ({ r, i }));
    indexed.sort((a, b) => a.r.left - b.r.left);
    const sorted = indexed.map((item) => item.r);

    // Build gap rects between adjacent children
    const gaps: GapRect[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const gapLeft = curr.right;
      const gapRight = next.left;
      const gapWidth = gapRight - gapLeft;

      if (gapWidth > 0.5) {
        // Vertical extent: union of the two children's top/bottom
        const top = Math.min(curr.top, next.top);
        const bottom = Math.max(curr.bottom, next.bottom);
        gaps.push({
          x: gapLeft,
          y: top,
          w: gapWidth,
          h: bottom - top,
          value: Math.round(gapWidth),
        });
      }
    }

    return { direction, gaps };
  } else {
    const indexed = rects.map((r, i) => ({ r, i }));
    indexed.sort((a, b) => a.r.top - b.r.top);
    const sorted = indexed.map((item) => item.r);

    const gaps: GapRect[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const gapTop = curr.bottom;
      const gapBottom = next.top;
      const gapHeight = gapBottom - gapTop;

      if (gapHeight > 0.5) {
        const left = Math.min(curr.left, next.left);
        const right = Math.max(curr.right, next.right);
        gaps.push({
          x: left,
          y: gapTop,
          w: right - left,
          h: gapHeight,
          value: Math.round(gapHeight),
        });
      }
    }

    return { direction, gaps };
  }
}

function metricsKey(m: FlexMetrics): string {
  return `${m.direction},${m.gaps.map((g) => `${g.x},${g.y},${g.w},${g.h}`).join("|")}`;
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const hatchBg = `repeating-linear-gradient(45deg, ${GAP_HATCH} 0px, ${GAP_HATCH} 1px, transparent 1px, transparent ${HATCH_SPACING}px)`;

const BADGE_STYLE: React.CSSProperties = {
  position: "fixed",
  pointerEvents: "none",
  zIndex: Z_INDEX,
  color: "#fff",
  fontSize: 10,
  fontFamily: LABEL_FONT,
  fontWeight: 600,
  padding: "2px 5px",
  borderRadius: 3,
  lineHeight: "14px",
  whiteSpace: "nowrap",
  letterSpacing: "0.02em",
  background: GAP_COLOR,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FlexGapOverlay({
  element,
  refreshKey,
}: {
  element: Element;
  refreshKey?: number;
}) {
  const [metrics, setMetrics] = useState<FlexMetrics | null>(null);
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

  if (!metrics || metrics.gaps.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: Z_INDEX,
        overflow: "hidden",
      }}
    >
      {metrics.gaps.map((gap, i) => {
        const showBadge = gap.w >= 20 && gap.h >= 14;
        return (
          <React.Fragment key={i}>
            {/* Hatched gap region */}
            <div
              style={{
                position: "fixed",
                pointerEvents: "none",
                zIndex: Z_INDEX,
                left: gap.x,
                top: gap.y,
                width: gap.w,
                height: gap.h,
                background: hatchBg,
                border: `1px dashed ${GAP_BORDER}`,
                boxSizing: "border-box",
                opacity: 0.9,
              }}
            />
            {/* Dimension badge */}
            {showBadge && (
              <div
                style={{
                  ...BADGE_STYLE,
                  left: gap.x + gap.w / 2,
                  top: gap.y + gap.h / 2,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {gap.value}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
