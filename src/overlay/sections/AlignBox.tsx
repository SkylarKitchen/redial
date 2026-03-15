/**
 * AlignBox.tsx — Webflow-style alignment control
 *
 * Three visual modes based on stretch state:
 *   1. Dot grid — 3×3 dots with active position(s) as small squares
 *   2. Bar — rounded rectangle spanning the stretch axis, positioned by other axis
 *   3. Crosshair — 4 arrows from center when both axes are stretch
 *
 * Plus optional spacing buttons (space-between, space-around, space-evenly).
 */

import { useState, useCallback } from "react";
import { ms } from "../timing";
import { color, text, border, surface, font, blackAlpha } from "../theme";

export interface AlignBoxProps {
  justify: string;
  align: string;
  onChange: (justify: string, align: string) => void;
  mode?: "flex" | "grid";
  /** When true, hides spacing buttons and shows only the alignment box */
  compact?: boolean;
}

const JUSTIFY_COLS_FLEX = ["flex-start", "center", "flex-end"] as const;
const ALIGN_ROWS_FLEX = ["flex-start", "center", "flex-end"] as const;
const JUSTIFY_COLS_GRID = ["start", "center", "end"] as const;
const ALIGN_ROWS_GRID = ["start", "center", "end"] as const;

export const SPACING_OPTIONS = [
  { value: "space-between", label: "Between" },
  { value: "space-around", label: "Around" },
  { value: "space-evenly", label: "Evenly" },
] as const;

/** Map a justify value to its active column indices */
export function toColIndices(value: string): number[] {
  if (value === "flex-start" || value === "start") return [0];
  if (value === "center") return [1];
  if (value === "flex-end" || value === "end") return [2];
  if (value === "space-between" || value === "space-around" || value === "space-evenly")
    return [0, 1, 2];
  return [];
}

/** Map an align value to its active row indices */
export function toRowIndices(value: string): number[] {
  if (value === "flex-start" || value === "start") return [0];
  if (value === "center") return [1];
  if (value === "flex-end" || value === "end") return [2];
  if (value === "stretch") return [0, 1, 2];
  return []; // baseline, unknown — no grid representation
}

// ─── Crosshair Arrow SVG ──────────────────────────────────────────

function CrosshairArrow({ direction, size = 10 }: { direction: "up" | "down" | "left" | "right"; size?: number }) {
  const rotations = { up: 0, right: 90, down: 180, left: 270 };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      style={{ transform: `rotate(${rotations[direction]}deg)`, display: "block" }}
    >
      <path d="M5 1 L8 5 L6 5 L6 9 L4 9 L4 5 L2 5 Z" fill="currentColor" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function AlignBox({ justify, align, onChange, mode = "flex", compact = false }: AlignBoxProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const justifyCols = mode === "flex" ? JUSTIFY_COLS_FLEX : JUSTIFY_COLS_GRID;
  const alignRows = mode === "flex" ? ALIGN_ROWS_FLEX : ALIGN_ROWS_GRID;

  const stretchX = justify === "stretch";
  const stretchY = align === "stretch";
  const activeCols = toColIndices(justify);
  const activeRows = toRowIndices(align);

  const handleCellClick = useCallback(
    (col: number, row: number) => {
      onChange(justifyCols[col], alignRows[row]);
    },
    [onChange, justifyCols, alignRows]
  );

  // Determine visual mode
  // Bar mode only when the non-stretch axis has a mappable position;
  // otherwise fall back to dot-grid (e.g. "normal" has no column/row).
  const visualMode = stretchX && stretchY
    ? "crosshair"
    : stretchY && !stretchX && activeCols.length > 0
      ? "bar"
      : stretchX && !stretchY && activeRows.length > 0
        ? "bar"
        : "dot-grid";

  return (
    <div
      {...(stretchX ? { "data-stretch-x": true } : {})}
      {...(stretchY ? { "data-stretch-y": true } : {})}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
    >
      {/* Main alignment box */}
      <div
        data-mode={visualMode}
        style={{
          position: "relative",
          width: 56,
          height: 56,
          background: color.input,
          border: `1px solid ${color.border}`,
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {visualMode === "dot-grid" && (
          <DotGrid
            activeCols={activeCols}
            activeRows={activeRows}
            hoveredCell={hoveredCell}
            onCellClick={handleCellClick}
            onCellHover={setHoveredCell}
          />
        )}
        {visualMode === "bar" && (
          <BarIndicator
            stretchX={stretchX}
            stretchY={stretchY}
            activeCols={activeCols}
            activeRows={activeRows}
            onCellClick={handleCellClick}
            onCellHover={setHoveredCell}
          />
        )}
        {visualMode === "crosshair" && (
          <CrosshairIndicator />
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

// ─── Dot Grid Mode ────────────────────────────────────────────────

function DotGrid({
  activeCols,
  activeRows,
  hoveredCell,
  onCellClick,
  onCellHover,
}: {
  activeCols: number[];
  activeRows: number[];
  hoveredCell: string | null;
  onCellClick: (col: number, row: number) => void;
  onCellHover: (key: string | null) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr 1fr",
        width: "100%",
        height: "100%",
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => {
          const key = `${row}-${col}`;
          const isActive = activeCols.includes(col) && activeRows.includes(row);
          const isHovered = hoveredCell === key;

          return (
            <div
              key={key}
              {...(isActive ? { "data-active": true } : {})}
              tabIndex={0}
              role="button"
              aria-label={`Align column ${col} row ${row}`}
              onClick={() => onCellClick(col, row)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCellClick(col, row);
                }
              }}
              onMouseEnter={() => onCellHover(key)}
              onMouseLeave={() => onCellHover(null)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {isActive ? (
                <div style={{
                  width: 5,
                  height: 5,
                  borderRadius: 1,
                  background: color.foreground,
                  transition: `background ${ms("fast")}`,
                }} />
              ) : (
                <div style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: isHovered ? blackAlpha(0.25) : blackAlpha(0.15),
                  transition: `background ${ms("fast")}`,
                }} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Bar Mode ─────────────────────────────────────────────────────

const COL_POSITIONS = ["25%", "50%", "75%"];
const ROW_POSITIONS = ["25%", "50%", "75%"];

function BarIndicator({
  stretchX,
  stretchY,
  activeCols,
  activeRows,
  onCellClick,
  onCellHover,
}: {
  stretchX: boolean;
  stretchY: boolean;
  activeCols: number[];
  activeRows: number[];
  onCellClick: (col: number, row: number) => void;
  onCellHover: (key: string | null) => void;
}) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Faded dot backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateRows: "1fr 1fr 1fr",
          padding: 8,
          boxSizing: "border-box",
          opacity: 0.5,
        }}
      >
        {[0, 1, 2].flatMap((row) =>
          [0, 1, 2].map((col) => (
            <div
              key={`${row}-${col}`}
              tabIndex={0}
              role="button"
              aria-label={`Align column ${col} row ${row}`}
              onClick={() => onCellClick(col, row)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCellClick(col, row);
                }
              }}
              onMouseEnter={() => onCellHover(`${row}-${col}`)}
              onMouseLeave={() => onCellHover(null)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <div style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: blackAlpha(0.15),
              }} />
            </div>
          ))
        )}
      </div>

      {/* Vertical bar(s): Y=stretch, positioned at X column(s) */}
      {stretchY && !stretchX && activeCols.map((col) => (
        <div
          key={`vbar-${col}`}
          data-bar="vertical"
          style={{
            position: "absolute",
            left: COL_POSITIONS[col],
            top: "10%",
            width: 6,
            height: "80%",
            borderRadius: 3,
            background: color.foreground,
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Horizontal bar(s): X=stretch, positioned at Y row(s) */}
      {stretchX && !stretchY && activeRows.map((row) => (
        <div
          key={`hbar-${row}`}
          data-bar="horizontal"
          style={{
            position: "absolute",
            top: ROW_POSITIONS[row],
            left: "10%",
            height: 6,
            width: "80%",
            borderRadius: 3,
            background: color.foreground,
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── Crosshair Mode ───────────────────────────────────────────────

function CrosshairIndicator() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gridTemplateRows: "1fr 1fr 1fr",
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyItems: "center",
      color: blackAlpha(0.4),
    }}>
      <div />
      <CrosshairArrow direction="up" size={10} />
      <div />
      <CrosshairArrow direction="left" size={10} />
      <div />
      <CrosshairArrow direction="right" size={10} />
      <div />
      <CrosshairArrow direction="down" size={10} />
      <div />
    </div>
  );
}
