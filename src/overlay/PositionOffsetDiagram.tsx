/**
 * PositionOffsetDiagram.tsx — Visual box diagram for position offsets (top/right/bottom/left)
 * Single-layer version of SpacingBoxModel for position offsets.
 */

import { useState, useCallback, useEffect } from "react";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { ms } from "./timing";

interface PositionOffsetDiagramProps {
  top: number;
  right: number;
  bottom: number;
  left: number;
  onChange: (prop: string, value: number) => void;
  units: { top: string; right: string; bottom: string; left: string };
  availableUnits: string[];
  onUnitChange: (prop: string, unit: string) => void;
  /** Conversion tooltip hint passed through to the shared UnitSelector */
  conversionHint?: ConversionHint | null;
}

export function PositionOffsetDiagram({ top, right, bottom, left, onChange, units, availableUnits, onUnitChange, conversionHint }: PositionOffsetDiagramProps) {
  // Set all 4 offsets to the same unit at once
  const handleUnitChangeAll = useCallback(
    (unit: string) => {
      onUnitChange("top", unit);
      onUnitChange("right", unit);
      onUnitChange("bottom", unit);
      onUnitChange("left", unit);
    },
    [onUnitChange]
  );

  // Show the first unit as the "current" for the shared selector (they may diverge if set individually)
  const sharedUnit = units.top;

  return (
    <div style={{ padding: "8px 12px 4px" }}>
      <div
        style={{
          position: "relative",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "4px",
          background: "rgba(139, 92, 246, 0.06)",
          padding: "0",
        }}
      >
        {/* OFFSET label + unit selector */}
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: "6px",
            display: "flex",
            alignItems: "center",
            gap: "3px",
            pointerEvents: "auto",
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(0,0,0,0.25)" }}>
            Offset
          </span>
          <UnitSelector value={sharedUnit} options={availableUnits} onChange={handleUnitChangeAll} conversionHint={conversionHint} />
        </div>

        {/* Top */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <EditableValue value={top} onChange={(v) => onChange("top", v)} suffix={units.top} />
        </div>

        {/* Left / element / Right */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <EditableValue value={left} onChange={(v) => onChange("left", v)} suffix={units.left} />
          </div>
          {/* Element placeholder */}
          <div
            style={{
              flex: 1,
              height: "24px",
              background: "rgba(0,0,0,0.04)",
              borderRadius: "2px",
              border: "1px dashed rgba(0,0,0,0.07)",
              margin: "0 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "8px", color: "rgba(0,0,0,0.15)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              element
            </span>
          </div>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <EditableValue value={right} onChange={(v) => onChange("right", v)} suffix={units.right} />
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          <EditableValue value={bottom} onChange={(v) => onChange("bottom", v)} suffix={units.bottom} />
        </div>
      </div>
    </div>
  );
}

// --- Editable inline value (same pattern as SpacingBoxModel) ---

function EditableValue({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed !== value) {
      onChange(parsed);
    }
  }, [draft, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
      } else if (e.key === "Escape") {
        setDraft(String(value));
        setEditing(false);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
        const direction = e.key === "ArrowUp" ? 1 : -1;
        const next = Math.round((value + step * direction) * 10) / 10;
        setDraft(String(next));
        onChange(next);
      }
    },
    [commit, value, onChange]
  );

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        style={{
          width: "32px",
          background: "rgba(0,0,0,0.07)",
          border: "1px solid rgba(193, 122, 80, 0.5)",
          borderRadius: "2px",
          color: "rgba(0,0,0,0.87)",
          fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          textAlign: "center",
          padding: "1px 2px",
          outline: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      style={{
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        color: value !== 0 ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.25)",
        cursor: "text",
        padding: "1px 3px",
        borderRadius: "2px",
        minWidth: "16px",
        textAlign: "center",
        transition: `background ${ms("normal")}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.05)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {value}
      {suffix && (
        <span style={{ fontSize: "8px", color: "rgba(0,0,0,0.2)", marginLeft: "1px" }}>
          {suffix}
        </span>
      )}
    </span>
  );
}
