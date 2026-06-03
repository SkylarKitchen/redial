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
import { ms } from "../timing";
import { useDraftNumber } from "../hooks/useDraftNumber";
import { color, focusRing, font, text, border, surface, blackAlpha, primaryAlpha } from "../theme";

export interface TransformOriginPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** When true, show Left/Top numeric inputs alongside the grid */
  showInputs?: boolean;
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

// ─── Origin → percent parsing ────────────────────────────────────────

/** Parse a CSS origin value to [leftPct, topPct]. Returns [50, 50] for unparseable values. */
function originToPercents(value: string): [number, number] {
  if (!value) return [50, 50];
  const parts = value.trim().split(/\s+/);
  const tokenToPct = (t: string): number => {
    if (t === "left" || t === "top") return 0;
    if (t === "center") return 50;
    if (t === "right" || t === "bottom") return 100;
    const pct = parseFloat(t);
    if (!isNaN(pct)) return pct;
    return 50;
  };
  if (parts.length === 1) {
    const v = tokenToPct(parts[0]);
    return [v, v];
  }
  if (parts.length >= 2) return [tokenToPct(parts[0]), tokenToPct(parts[1])];
  return [50, 50];
}

// ─── Component ───────────────────────────────────────────────────────

export function TransformOriginPicker({ value, onChange, showInputs }: TransformOriginPickerProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeCol, activeRow] = parseOrigin(value);

  const handleClick = useCallback(
    (origin: string) => {
      onChange(origin);
    },
    [onChange],
  );

  const [leftPct, topPct] = originToPercents(value);

  const handleLeftChange = useCallback(
    (v: number) => {
      onChange(`${v}% ${topPct}%`);
    },
    [onChange, topPct],
  );

  const handleTopChange = useCallback(
    (v: number) => {
      onChange(`${leftPct}% ${v}%`);
    },
    [onChange, leftPct],
  );

  const grid = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 18px)",
        gridTemplateRows: "repeat(3, 18px)",
        border: `1px solid ${border.default}`,
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
                (e.currentTarget as HTMLElement).style.boxShadow = focusRing;
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
                    ? primaryAlpha(0.2)
                    : "transparent",
                borderRight: ci < 2 ? `1px solid ${blackAlpha(0.07)}` : "none",
                borderBottom: ri < 2 ? `1px solid ${blackAlpha(0.07)}` : "none",
                transition: `background ${ms("fast")}, box-shadow ${ms("fast")}`,
              }}
            >
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: isActive ? color.primaryForeground : blackAlpha(0.25),
                }}
              />
            </div>
          );
        }),
      )}
    </div>
  );

  if (!showInputs) return grid;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {grid}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <OriginInput label="Left" value={leftPct} onChange={handleLeftChange} />
        <OriginInput label="Top" value={topPct} onChange={handleTopChange} />
      </div>
    </div>
  );
}

// ─── OriginInput ─────────────────────────────────────────────────────

function OriginInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  // The displayed/stepped value is always rounded to an integer; passing the
  // rounded value into the hook keeps resync (String(value)) and arrow-stepping
  // (value ± 1) byte-equivalent to the original Math.round(value)-based math.
  const rounded = Math.round(value);
  const { draft, setDraft, inputProps } = useDraftNumber({
    value: rounded,
    resync: true,
    step: 1,
    shiftStep: 1,
    min: 0,
    max: 100,
    onCommit: (d) => {
      const parsed = parseFloat(d);
      if (isNaN(parsed)) {
        setDraft(String(rounded));
        return;
      }
      const clamped = Math.max(0, Math.min(100, Math.round(parsed)));
      setDraft(String(clamped));
      onChange(clamped);
    },
    onStep: (next) => onChange(next),
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span
        style={{
          width: "24px",
          fontSize: "10px",
          color: text.label,
          fontFamily: font.sans,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      <input
        type="text"
        value={draft}
        onChange={inputProps.onChange}
        onBlur={inputProps.onBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
          }
          inputProps.onKeyDown(e);
        }}
        style={{
          width: "36px",
          height: "20px",
          fontSize: "10px",
          fontFamily: font.mono,
          color: text.primary,
          background: surface.subtle,
          border: `1px solid ${border.default}`,
          borderRadius: "3px",
          padding: "0 4px",
          textAlign: "right",
          outline: "none",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = color.primary;
        }}
        onBlurCapture={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = border.default;
        }}
      />
      <span
        style={{
          fontSize: "10px",
          color: text.label,
          fontFamily: font.sans,
          lineHeight: 1,
        }}
      >
        %
      </span>
    </div>
  );
}
