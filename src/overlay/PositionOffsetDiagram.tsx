/**
 * PositionOffsetDiagram.tsx — Visual box diagram for position offsets (top/right/bottom/left)
 * Single-layer version of SpacingBoxModel for position offsets.
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface PositionOffsetDiagramProps {
  top: number;
  right: number;
  bottom: number;
  left: number;
  onChange: (prop: string, value: number) => void;
}

export function PositionOffsetDiagram({ top, right, bottom, left, onChange }: PositionOffsetDiagramProps) {
  return (
    <div style={{ padding: "8px 12px 4px" }}>
      <div
        style={{
          position: "relative",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "4px",
          background: "rgba(139, 92, 246, 0.06)",
          padding: "0",
        }}
      >
        {/* OFFSET label */}
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: "6px",
            fontSize: "8px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "rgba(255,255,255,0.3)",
            pointerEvents: "none",
          }}
        >
          Offset
        </div>

        {/* Top */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <EditableValue value={top} onChange={(v) => onChange("top", v)} />
        </div>

        {/* Left / element / Right */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <EditableValue value={left} onChange={(v) => onChange("left", v)} />
          </div>
          {/* Element placeholder */}
          <div
            style={{
              flex: 1,
              height: "24px",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "2px",
              border: "1px dashed rgba(255,255,255,0.1)",
              margin: "0 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              element
            </span>
          </div>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <EditableValue value={right} onChange={(v) => onChange("right", v)} />
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          <EditableValue value={bottom} onChange={(v) => onChange("bottom", v)} />
        </div>
      </div>
    </div>
  );
}

// --- Editable inline value (same pattern as SpacingBoxModel) ---

function EditableValue({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

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
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
        const next = Math.round((value + step) * 10) / 10;
        setDraft(String(next));
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
        const next = Math.round((value - step) * 10) / 10;
        setDraft(String(next));
        onChange(next);
      }
    },
    [commit, value, onChange]
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        style={{
          width: "32px",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(99, 102, 241, 0.5)",
          borderRadius: "2px",
          color: "rgba(255,255,255,0.9)",
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
        color: value !== 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
        cursor: "text",
        padding: "1px 3px",
        borderRadius: "2px",
        minWidth: "16px",
        textAlign: "center",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.background = "transparent";
      }}
    >
      {value}
    </span>
  );
}
