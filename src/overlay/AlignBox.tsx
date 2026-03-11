/**
 * AlignBox.tsx — Webflow-style 3x3 alignment grid
 *
 * Clickable grid representing flex/grid alignment:
 * ┌───┬───┬───┐
 * │ ● │ ● │ ● │  ← align: start
 * ├───┼───┼───┤
 * │ ● │ ● │ ● │  ← align: center
 * ├───┼───┼───┤
 * │ ● │ ● │ ● │  ← align: end
 * └───┴───┴───┘
 *   ↑   ↑   ↑
 *  start center end  (justify)
 *
 * Plus extra buttons for space-between, space-around, space-evenly.
 */

import { useState, useCallback } from "react";
import { ms } from "./timing";

export interface AlignBoxProps {
  justify: string;
  align: string;
  onChange: (justify: string, align: string) => void;
  mode?: "flex" | "grid";
  /** When true, hides spacing buttons and shows only the 3x3 grid */
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

/**
 * Tiny alignment icon: 3 bars positioned according to the cell's
 * justify (col) and align (row) meaning.
 */
function CellIcon({ col, row }: { col: number; row: number }) {
  // The bars represent items. Their position inside the cell
  // illustrates the alignment that cell represents.
  const justifyMap: Record<number, string> = {
    0: "flex-start",
    1: "center",
    2: "flex-end",
  };
  const alignMap: Record<number, string> = {
    0: "flex-start",
    1: "center",
    2: "flex-end",
  };

  return (
    <div
      style={{
        width: "16px",
        height: "16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: alignMap[row],
        alignItems: justifyMap[col],
        gap: "1.5px",
      }}
    >
      <div style={{ width: "8px", height: "2px", borderRadius: "0.5px", background: "currentColor", opacity: 0.9 }} />
      <div style={{ width: "5px", height: "2px", borderRadius: "0.5px", background: "currentColor", opacity: 0.9 }} />
      <div style={{ width: "7px", height: "2px", borderRadius: "0.5px", background: "currentColor", opacity: 0.9 }} />
    </div>
  );
}

export function AlignBox({ justify, align, onChange, mode = "flex", compact = false }: AlignBoxProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const justifyCols = mode === "flex" ? JUSTIFY_COLS_FLEX : JUSTIFY_COLS_GRID;
  const alignRows = mode === "flex" ? ALIGN_ROWS_FLEX : ALIGN_ROWS_GRID;

  const activeCol = toIndex(justify);
  const activeRow = toIndex(align);

  const handleCellClick = useCallback(
    (col: number, row: number) => {
      onChange(justifyCols[col], alignRows[row]);
    },
    [onChange, justifyCols, alignRows]
  );

  const isSpacingActive = SPACING_OPTIONS.some((o) => o.value === justify);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      {/* 3x3 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 28px)",
          gridTemplateRows: "repeat(3, 28px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {alignRows.map((_, row) =>
          justifyCols.map((_, col) => {
            const key = `${col}-${row}`;
            const isActive = col === activeCol && row === activeRow && !isSpacingActive;
            const isHovered = hoveredCell === key;

            return (
              <div
                key={key}
                tabIndex={0}
                role="button"
                onClick={() => handleCellClick(col, row)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCellClick(col, row); } }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px rgba(99,102,241,0.3)"; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                onMouseEnter={() => setHoveredCell(key)}
                onMouseLeave={() => setHoveredCell(null)}
                style={{
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  outline: "none",
                  background: isActive
                    ? "#6366f1"
                    : isHovered
                      ? "rgba(99,102,241,0.2)"
                      : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                  borderRight: col < 2 ? "1px solid rgba(255,255,255,0.1)" : "none",
                  borderBottom: row < 2 ? "1px solid rgba(255,255,255,0.1)" : "none",
                  transition: `background ${ms("fast")}, color ${ms("fast")}, box-shadow ${ms("fast")}`,
                }}
              >
                <CellIcon col={col} row={row} />
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
                  background: active ? "#6366f1" : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.45)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "3px",
                  fontSize: "9px",
                  fontFamily: "system-ui, sans-serif",
                  padding: "2px 6px",
                  cursor: "pointer",
                  lineHeight: "16px",
                  transition: `background ${ms("fast")}, color ${ms("fast")}`,
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
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
