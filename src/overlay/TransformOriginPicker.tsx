/**
 * TransformOriginPicker.tsx — 3x3 visual picker for CSS transform-origin
 *
 * Each cell maps to a named origin value:
 * ┌────────────┬──────────────┬─────────────┐
 * │ top left   │ top center   │ top right   │
 * ├────────────┼──────────────┼─────────────┤
 * │ center left│ center       │ center right│
 * ├────────────┼──────────────┼─────────────┤
 * │ bottom left│ bottom center│ bottom right│
 * └────────────┴──────────────┴─────────────┘
 *
 * Parses incoming CSS values (keywords, percentages, px) to find the active cell.
 */

import { useState, useCallback } from "react";
import { ms } from "./timing";
import { color } from "./theme";

export interface TransformOriginPickerProps {
  value: string;
  onChange: (value: string) => void;
}

// ─── Grid mapping ────────────────────────────────────────────────────

const ORIGIN_GRID = [
  ["top left", "top center", "top right"],
  ["center left", "center", "center right"],
  ["bottom left", "bottom center", "bottom right"],
] as const;

const ORIGIN_LABELS = [
  ["TL", "TC", "TR"],
  ["ML", "MC", "MR"],
  ["BL", "BC", "BR"],
] as const;

// ─── Value → cell parsing ────────────────────────────────────────────

/** Map a single axis token to its 0/1/2 index (col or row) */
function tokenToIndex(token: string): number {
  const t = token.trim().toLowerCase();
  // Keywords
  if (t === "left" || t === "top") return 0;
  if (t === "center") return 1;
  if (t === "right" || t === "bottom") return 2;
  // Percentages
  const pctMatch = t.match(/^([\d.]+)%$/);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    if (pct <= 5) return 0;
    if (pct >= 45 && pct <= 55) return 1;
    if (pct >= 95) return 2;
  }
  // px values — can't reliably map without element size, treat as unknown
  return -1;
}

/**
 * Parse a CSS transform-origin value and return [col, row].
 *
 * getComputedStyle typically returns "Xpx Ypx" or "X% Y%".
 * Authored values can be keywords like "top left", "center", etc.
 *
 * Returns [-1, -1] if the value doesn't map to a grid cell.
 */
function parseOrigin(value: string): [col: number, row: number] {
  if (!value) return [-1, -1];
  const v = value.trim().toLowerCase();

  // Exact keyword match first (fast path)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (v === ORIGIN_GRID[row][col]) return [col, row];
    }
  }

  // Parse tokens — transform-origin accepts 1, 2, or 3 values
  // We only care about the X and Y components for the 2D picker
  const parts = v.split(/\s+/);

  if (parts.length === 1) {
    // Single value: used for both X and Y
    const idx = tokenToIndex(parts[0]);
    return [idx, idx];
  }

  if (parts.length >= 2) {
    // Two+ values: first is X, second is Y
    // But keywords can be in any order; "top left" means X=left, Y=top
    // getComputedStyle always returns X Y order as numbers/percentages

    let xIdx: number;
    let yIdx: number;

    // Check if the tokens are directional keywords that imply axes
    const isXKeyword = (t: string) => t === "left" || t === "right";
    const isYKeyword = (t: string) => t === "top" || t === "bottom";

    if (isYKeyword(parts[0]) && (isXKeyword(parts[1]) || parts[1] === "center")) {
      // Swapped order: "top left" means Y=top, X=left
      xIdx = tokenToIndex(parts[1]);
      yIdx = tokenToIndex(parts[0]);
    } else {
      // Normal order: X Y
      xIdx = tokenToIndex(parts[0]);
      yIdx = tokenToIndex(parts[1]);
    }

    return [xIdx, yIdx];
  }

  return [-1, -1];
}

// ─── Component ───────────────────────────────────────────────────────

export function TransformOriginPicker({ value, onChange }: TransformOriginPickerProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeCol, activeRow] = parseOrigin(value);

  const handleClick = useCallback(
    (origin: string) => {
      onChange(origin);
    },
    [onChange],
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 18px)",
        gridTemplateRows: "repeat(3, 18px)",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: "3px",
        overflow: "hidden",
      }}
    >
      {ORIGIN_GRID.map((row, ri) =>
        row.map((origin, ci) => {
          const isActive = ci === activeCol && ri === activeRow;
          const isHov = hovered === origin;

          return (
            <div
              key={origin}
              tabIndex={0}
              role="button"
              onClick={() => handleClick(origin)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick(origin);
                }
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 0 2px rgba(59,130,246,0.3)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
              onMouseEnter={() => setHovered(origin)}
              onMouseLeave={() => setHovered(null)}
              title={ORIGIN_LABELS[ri][ci]}
              style={{
                width: "18px",
                height: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                outline: "none",
                background: isActive
                  ? color.primary
                  : isHov
                    ? "rgba(59,130,246,0.2)"
                    : "transparent",
                borderRight: ci < 2 ? "1px solid rgba(0,0,0,0.07)" : "none",
                borderBottom: ri < 2 ? "1px solid rgba(0,0,0,0.07)" : "none",
                transition: `background ${ms("fast")}, box-shadow ${ms("fast")}`,
              }}
            >
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: isActive ? "#fff" : "rgba(0,0,0,0.25)",
                }}
              />
            </div>
          );
        }),
      )}
    </div>
  );
}
