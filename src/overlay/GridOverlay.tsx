/**
 * GridOverlay.tsx — Visual grid overlay for CSS Grid containers
 *
 * Renders grid lines, gap bands, and column/row number labels on top of
 * any element with display: grid or inline-grid. Uses a RAF loop +
 * ResizeObserver to stay in sync with layout changes.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTrackSizes(value: string): number[] {
  if (!value || value === "none") return [];
  return value
    .split(/\s+/)
    .map((s) => parseFloat(s))
    .filter((n) => !isNaN(n));
}

function parsePx(value: string): number {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GridMetrics {
  /** Element bounding rect (viewport coords) */
  top: number;
  left: number;
  /** Content-box origin offsets (inside padding) */
  contentTop: number;
  contentLeft: number;
  /** Content-box dimensions */
  contentWidth: number;
  contentHeight: number;
  /** Track sizes */
  cols: number[];
  rows: number[];
  /** Gaps */
  colGap: number;
  rowGap: number;
}

// ---------------------------------------------------------------------------
// Metric computation
// ---------------------------------------------------------------------------

function computeMetrics(el: Element): GridMetrics | null {
  const style = getComputedStyle(el);
  const display = style.display;
  if (display !== "grid" && display !== "inline-grid") return null;

  const rect = el.getBoundingClientRect();

  const paddingTop = parsePx(style.paddingTop);
  const paddingRight = parsePx(style.paddingRight);
  const paddingBottom = parsePx(style.paddingBottom);
  const paddingLeft = parsePx(style.paddingLeft);

  const borderTop = parsePx(style.borderTopWidth);
  const borderLeft = parsePx(style.borderLeftWidth);

  const contentTop = rect.top + borderTop + paddingTop;
  const contentLeft = rect.left + borderLeft + paddingLeft;
  const contentWidth =
    rect.width -
    parsePx(style.borderLeftWidth) -
    parsePx(style.borderRightWidth) -
    paddingLeft -
    paddingRight;
  const contentHeight =
    rect.height -
    borderTop -
    parsePx(style.borderBottomWidth) -
    paddingTop -
    paddingBottom;

  const cols = parseTrackSizes(style.gridTemplateColumns);
  const rows = parseTrackSizes(style.gridTemplateRows);
  const colGap = parsePx(style.columnGap);
  const rowGap = parsePx(style.rowGap);

  return {
    top: rect.top,
    left: rect.left,
    contentTop,
    contentLeft,
    contentWidth,
    contentHeight,
    cols,
    rows,
    colGap,
    rowGap,
  };
}

// ---------------------------------------------------------------------------
// Styles (constants)
// ---------------------------------------------------------------------------

const LINE_COLOR = "rgba(99, 102, 241, 0.4)";
const GAP_COLOR = "rgba(99, 102, 241, 0.08)";
const LABEL_COLOR = "rgba(99, 102, 241, 0.8)";
const LABEL_BG = "rgba(30, 30, 30, 0.85)";
const OUTLINE_COLOR = "rgba(99, 102, 241, 0.25)";

const LABEL_STYLE: React.CSSProperties = {
  position: "absolute",
  fontSize: 10,
  fontFamily: "ui-monospace, 'SF Mono', monospace",
  color: LABEL_COLOR,
  background: LABEL_BG,
  borderRadius: 3,
  padding: "1px 4px",
  lineHeight: "14px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GridOverlay({
  element,
  refreshKey,
}: {
  element: Element;
  refreshKey?: number;
}) {
  const [metrics, setMetrics] = useState<GridMetrics | null>(null);
  const rafRef = useRef(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    setMetrics(computeMetrics(element));
  }, [element]);

  useEffect(() => {
    let cancelled = false;

    const loop = () => {
      if (cancelled) return;
      measure();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    // ResizeObserver for immediate response to size changes
    observerRef.current = new ResizeObserver(() => {
      if (!cancelled) measure();
    });
    observerRef.current.observe(element);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      observerRef.current?.disconnect();
    };
  }, [element, refreshKey, measure]);

  if (!metrics) return null;
  if (metrics.cols.length === 0 && metrics.rows.length === 0) return null;

  const { contentTop, contentLeft, contentWidth, contentHeight, cols, rows, colGap, rowGap } =
    metrics;

  // -----------------------------------------------------------------------
  // Build column line positions (x offsets from content-box left edge)
  // Lines sit between tracks. Line i is after track i (0-indexed).
  // With gaps: track0 | gap | track1 | gap | track2
  // -----------------------------------------------------------------------

  const colLinePositions: number[] = [];
  {
    let x = 0;
    for (let i = 0; i < cols.length - 1; i++) {
      x += cols[i];
      // Line sits at the center of the gap
      colLinePositions.push(x + colGap / 2);
      x += colGap;
    }
  }

  const rowLinePositions: number[] = [];
  {
    let y = 0;
    for (let i = 0; i < rows.length - 1; i++) {
      y += rows[i];
      rowLinePositions.push(y + rowGap / 2);
      y += rowGap;
    }
  }

  // -----------------------------------------------------------------------
  // Gap band positions (top-left corner + size, relative to content box)
  // -----------------------------------------------------------------------

  const colGapBands: { x: number; width: number }[] = [];
  if (colGap > 0) {
    let x = 0;
    for (let i = 0; i < cols.length - 1; i++) {
      x += cols[i];
      colGapBands.push({ x, width: colGap });
      x += colGap;
    }
  }

  const rowGapBands: { y: number; height: number }[] = [];
  if (rowGap > 0) {
    let y = 0;
    for (let i = 0; i < rows.length - 1; i++) {
      y += rows[i];
      rowGapBands.push({ y, height: rowGap });
      y += rowGap;
    }
  }

  // -----------------------------------------------------------------------
  // Column/row label positions (center of each track)
  // -----------------------------------------------------------------------

  const colLabelPositions: number[] = [];
  {
    let x = 0;
    for (let i = 0; i < cols.length; i++) {
      colLabelPositions.push(x + cols[i] / 2);
      x += cols[i] + (i < cols.length - 1 ? colGap : 0);
    }
  }

  const rowLabelPositions: number[] = [];
  {
    let y = 0;
    for (let i = 0; i < rows.length; i++) {
      rowLabelPositions.push(y + rows[i] / 2);
      y += rows[i] + (i < rows.length - 1 ? rowGap : 0);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 2147483645,
        overflow: "hidden",
      }}
    >
      {/* Container outline */}
      <div
        style={{
          position: "absolute",
          top: contentTop,
          left: contentLeft,
          width: contentWidth,
          height: contentHeight,
          border: `1px solid ${OUTLINE_COLOR}`,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      />

      {/* Column gap bands (full height of content box) */}
      {colGapBands.map((band, i) => (
        <div
          key={`cg-${i}`}
          style={{
            position: "absolute",
            top: contentTop,
            left: contentLeft + band.x,
            width: band.width,
            height: contentHeight,
            background: GAP_COLOR,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Row gap bands (full width of content box) */}
      {rowGapBands.map((band, i) => (
        <div
          key={`rg-${i}`}
          style={{
            position: "absolute",
            top: contentTop + band.y,
            left: contentLeft,
            width: contentWidth,
            height: band.height,
            background: GAP_COLOR,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Vertical grid lines (between columns) */}
      {colLinePositions.map((x, i) => (
        <div
          key={`cl-${i}`}
          style={{
            position: "absolute",
            top: contentTop,
            left: contentLeft + x,
            width: 0,
            height: contentHeight,
            borderLeft: `1px dashed ${LINE_COLOR}`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Horizontal grid lines (between rows) */}
      {rowLinePositions.map((y, i) => (
        <div
          key={`rl-${i}`}
          style={{
            position: "absolute",
            top: contentTop + y,
            left: contentLeft,
            width: contentWidth,
            height: 0,
            borderTop: `1px dashed ${LINE_COLOR}`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Column number labels (above the grid) */}
      {colLabelPositions.map((x, i) => (
        <div
          key={`cn-${i}`}
          style={{
            ...LABEL_STYLE,
            top: contentTop - 18,
            left: contentLeft + x,
            transform: "translateX(-50%)",
          }}
        >
          {i + 1}
        </div>
      ))}

      {/* Row number labels (left of the grid) */}
      {rowLabelPositions.map((y, i) => (
        <div
          key={`rn-${i}`}
          style={{
            ...LABEL_STYLE,
            top: contentTop + y,
            left: contentLeft - 6,
            transform: "translate(-100%, -50%)",
          }}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}
