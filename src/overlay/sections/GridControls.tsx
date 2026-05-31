/**
 * GridControls.tsx — Grid track row extracted from layoutControls.tsx
 *
 * TrackCountInput (private) + GridTrackRow.
 *
 * Pure inline styles with theme.ts tokens — no Tailwind or CSS variables.
 */

import { useState, useRef, useEffect } from "react";
import { Link, Settings } from "lucide-react";
import { GridSettingsPopup } from "./GridSettingsPopup";
import { useValueFlash } from "../controls";
import { color, text, border, font, primaryAlpha, segment, layout, type IndicatorType } from "../theme";
import { ms } from "../timing";
import { RowLabel } from "./layoutPrimitives";

// ─── GridTrackRow ───────────────────────────────────────────────────

/** Numeric stepper input for grid column/row count (Webflow-style dark bg) */
function TrackCountInput({ value, onChange }: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const flashStyle = useValueFlash(value);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 1 && n !== value) onChange(n);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
    else if (e.key === "ArrowUp") { e.preventDefault(); onChange(value + 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(1, value - 1)); }
  };

  return (
    <div style={{
      display: "flex",
      flex: 1,
      minWidth: 0,
      height: 28,
      borderRadius: segment.radius,
      border: `1px solid ${border.default}`,
      overflow: "hidden",
      backgroundColor: segment.hoverBg,
      alignItems: "center",
      ...flashStyle,
    }}>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 13,
            fontFamily: font.sans,
            color: color.foreground,
            textAlign: "center",
            padding: layout.rowPadding,
          }}
        />
      ) : (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          style={{
            flex: 1,
            fontSize: 13,
            fontFamily: font.sans,
            color: color.foreground,
            textAlign: "center",
            cursor: "text",
            outline: "none",
            lineHeight: "28px",
          }}
        >
          {value}
        </span>
      )}
      {/* Stepper arrows */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        width: 14,
        flexShrink: 0,
        marginRight: 2,
      }}>
        <button
          tabIndex={-1}
          onClick={() => onChange(value + 1)}
          style={{
            height: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: text.label,
            fontSize: 8,
          }}
        >▲</button>
        <button
          tabIndex={-1}
          onClick={() => onChange(Math.max(1, value - 1))}
          style={{
            height: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: text.label,
            fontSize: 8,
          }}
        >▼</button>
      </div>
    </div>
  );
}

/** Grid track row: dual count inputs for Columns/Rows + link toggle + settings gear (Webflow-style) */
export function GridTrackRow({ columns, rows, onColumnsChange, onRowsChange,
                               linked, onLinkedChange, onReset, indicator,
                               gridCols, gridRows, onGridColsChange, onGridRowsChange }: {
  columns: number;
  rows: number;
  onColumnsChange: (v: number) => void;
  onRowsChange: (v: number) => void;
  linked: boolean;
  onLinkedChange: (v: boolean) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
  gridCols?: string;
  gridRows?: string;
  onGridColsChange?: (css: string) => void;
  onGridRowsChange?: (css: string) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<DOMRect | null>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  const handleGearClick = () => {
    if (gearRef.current) {
      setSettingsAnchor(gearRef.current.getBoundingClientRect());
    }
    setSettingsOpen(o => !o);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding }}>
        <RowLabel label="Grid" indicator={indicator} onReset={onReset} />
        <TrackCountInput value={columns} onChange={(v) => {
          onColumnsChange(v);
          if (linked) onRowsChange(v);
        }} />
        <TrackCountInput value={rows} onChange={(v) => {
          onRowsChange(v);
          if (linked) onColumnsChange(v);
        }} />
        <button
          onClick={() => onLinkedChange(!linked)}
          title={linked ? "Columns/rows linked" : "Columns/rows independent"}
          style={{
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 10,
            borderRadius: 3,
            flexShrink: 0,
            color: text.disabled,
          }}
        >
          {linked ? <Link size={12} strokeWidth={1.5} /> : <Link size={12} strokeWidth={1.5} style={{ opacity: 0.4 }} />}
        </button>
        {/* Grid settings gear icon */}
        {onGridColsChange && onGridRowsChange && (
          <button
            ref={gearRef}
            onClick={handleGearClick}
            title="Grid settings"
            style={{
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: settingsOpen ? primaryAlpha(0.12) : "transparent",
              border: "none",
              cursor: "pointer",
              borderRadius: 3,
              flexShrink: 0,
              color: settingsOpen ? color.primary : text.disabled,
              transition: `background ${ms("fast")}, color ${ms("fast")}`,
            }}
          >
            <Settings size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
      {/* Sub-labels: Columns / Rows */}
      <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding, marginTop: 2 }}>
        <span style={{ width: layout.labelWidth, flexShrink: 0 }} />
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans }}>Columns</span>
        </span>
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: text.label, fontFamily: font.sans }}>Rows</span>
        </span>
        <span style={{ width: 20, flexShrink: 0 }} />
        <span style={{ width: 20, flexShrink: 0 }} />
      </div>
      {/* Grid settings popup */}
      {settingsOpen && settingsAnchor && gridCols != null && gridRows != null && onGridColsChange && onGridRowsChange && (
        <GridSettingsPopup
          gridCols={gridCols}
          gridRows={gridRows}
          onGridColsChange={onGridColsChange}
          onGridRowsChange={onGridRowsChange}
          anchorRect={settingsAnchor}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
