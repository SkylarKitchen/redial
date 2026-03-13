/**
 * AlignBox.tsx — Webflow-style alignment control
 *
 * Directional arrows radiating from a center indicator box:
 *    ↖  ↑  ↗
 *    ←  ●  →
 *    ↙  ↓  ↘
 *
 * The center square shows a dot at the active alignment position.
 * Clicking any arrow or the center sets justify + align simultaneously.
 * Plus optional spacing buttons (space-between, space-around, space-evenly).
 */

import { useState, useCallback } from "react";
import { ms } from "./timing";
import { color, text, border, surface, font, primaryAlpha, blackAlpha } from "./theme";

export interface AlignBoxProps {
  justify: string;
  align: string;
  onChange: (justify: string, align: string) => void;
  mode?: "flex" | "grid";
  /** When true, hides spacing buttons and shows only the arrow grid */
  compact?: boolean;
}

const JUSTIFY_COLS_FLEX = ["flex-start", "center", "flex-end"] as const;
const ALIGN_ROWS_FLEX = ["flex-start", "center", "flex-end"] as const;
const JUSTIFY_COLS_GRID = ["start", "center", "end"] as const;
const ALIGN_ROWS_GRID = ["start", "center", "end"] as const;

const SPACING_OPTIONS = [
  { value: "space-between", label: "Between" },
  { value: "space-around", label: "Around" },
  { value: "space-evenly", label: "Evenly" },
] as const;

/** Map a justify/align value to its 0/1/2 column/row index */
function toIndex(value: string): number {
  if (value === "flex-start" || value === "start") return 0;
  if (value === "center") return 1;
  if (value === "flex-end" || value === "end") return 2;
  return -1; // spacing value — no cell selected
}

/** SVG arrow pointing in one of 8 directions */
function DirectionArrow({ direction, size = 10 }: { direction: string; size?: number }) {
  const rotations: Record<string, number> = {
    "up": 0, "up-right": 45, "right": 90, "down-right": 135,
    "down": 180, "down-left": 225, "left": 270, "up-left": 315,
  };
  const rotation = rotations[direction] ?? 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      style={{ transform: `rotate(${rotation}deg)`, display: "block" }}
    >
      <path d="M5 2 L7.5 6.5 L2.5 6.5 Z" fill="currentColor" />
    </svg>
  );
}

/** Direction labels for the 3x3 positions (row-major) */
const DIRECTIONS = [
  ["up-left", "up", "up-right"],
  ["left", "center", "right"],
  ["down-left", "down", "down-right"],
] as const;

export function AlignBox({ justify, align, onChange, mode = "flex", compact = false }: AlignBoxProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const justifyCols = mode === "flex" ? JUSTIFY_COLS_FLEX : JUSTIFY_COLS_GRID;
  const alignRows = mode === "flex" ? ALIGN_ROWS_FLEX : ALIGN_ROWS_GRID;

  const stretchX = justify === "stretch";
  const stretchY = align === "stretch";
  const activeCol = toIndex(justify);
  const activeRow = toIndex(align);
  const isSpacingActive = SPACING_OPTIONS.some((o) => o.value === justify);

  const handleCellClick = useCallback(
    (col: number, row: number) => {
      onChange(justifyCols[col], alignRows[row]);
    },
    [onChange, justifyCols, alignRows]
  );

  return (
    <div
      {...(stretchX ? { "data-stretch-x": true } : {})}
      {...(stretchY ? { "data-stretch-y": true } : {})}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
    >
      {/* Arrow grid: 8 directional arrows around a center indicator */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "20px 32px 20px",
          gridTemplateRows: "20px 32px 20px",
          gap: "1px",
          alignItems: "center",
          justifyItems: "center",
        }}
      >
        {DIRECTIONS.flatMap((row, r) =>
          row.map((dir, c) => {
            const key = `${r}-${c}`;
            const isActive =
              !isSpacingActive &&
              (stretchX && stretchY
                ? true
                : stretchX
                  ? r === activeRow
                  : stretchY
                    ? c === activeCol
                    : c === activeCol && r === activeRow);
            const isHovered = hoveredCell === key;
            const isCenter = r === 1 && c === 1;
            const hasStretch = stretchX || stretchY;

            if (isCenter) {
              // Center indicator box — dot normally, bar(s) when stretch
              const centerIndicator = hasStretch ? (
                <div style={{ position: "relative", width: 24, height: 24 }}>
                  {stretchX && (
                    <div style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 24,
                      height: 4,
                      borderRadius: 2,
                      background: color.primary,
                    }} />
                  )}
                  {stretchY && (
                    <div style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: 4,
                      height: 24,
                      borderRadius: 2,
                      background: color.primary,
                    }} />
                  )}
                </div>
              ) : (
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: isActive
                    ? color.primary
                    : isHovered
                      ? primaryAlpha(0.5)
                      : blackAlpha(0.2),
                  transition: `background ${ms("fast")}`,
                }} />
              );

              return (
                <div
                  key={key}
                  tabIndex={0}
                  role="button"
                  aria-label="Align center center"
                  onClick={() => handleCellClick(c, r)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCellClick(c, r); } }}
                  onMouseEnter={() => setHoveredCell(key)}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{
                    width: 32,
                    height: 32,
                    background: color.input,
                    border: `1px solid ${border.hover}`,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    outline: "none",
                    transition: `border-color ${ms("fast")}`,
                    borderColor: isHovered ? blackAlpha(0.2) : border.hover,
                  }}
                >
                  {centerIndicator}
                </div>
              );
            }

            // Directional arrow button
            return (
              <div
                key={key}
                tabIndex={0}
                role="button"
                aria-label={`Align ${dir}`}
                onClick={() => handleCellClick(c, r)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCellClick(c, r); } }}
                onMouseEnter={() => setHoveredCell(key)}
                onMouseLeave={() => setHoveredCell(null)}
                style={{
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  outline: "none",
                  color: isActive
                    ? color.primary
                    : isHovered
                      ? blackAlpha(0.5)
                      : blackAlpha(0.2),
                  transition: `color ${ms("fast")}`,
                }}
              >
                <DirectionArrow direction={dir} size={10} />
              </div>
            );
          })
        )}
      </div>

      {/* Spacing options (hidden in compact mode) */}
      {!compact && (
        <div style={{ display: "flex", gap: "4px" }}>
          {SPACING_OPTIONS.map((opt) => {
            const active = justify === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value, align)}
                style={{
                  background: active ? color.primary : "transparent",
                  color: active ? color.primaryForeground : text.label,
                  border: `1px solid ${color.border}`,
                  borderRadius: "3px",
                  fontSize: "9px",
                  fontFamily: font.sans,
                  padding: "2px 6px",
                  cursor: "pointer",
                  lineHeight: "16px",
                  transition: `background ${ms("fast")}, color ${ms("fast")}`,
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = surface.hover;
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
