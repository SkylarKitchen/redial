/**
 * SpacingBoxModel.tsx — Webflow-style visual box model for margin/padding
 *
 * Renders a nested rectangle diagram:
 * ┌─── MARGIN ────────────────────┐
 * │          top                   │
 * │  left ┌─ PADDING ──┐  right   │
 * │       │   top       │          │
 * │       │ l  ████  r  │          │
 * │       │   bottom    │          │
 * │       └─────────────┘          │
 * │          bottom                │
 * └────────────────────────────────┘
 *
 * Each value is click-to-edit with arrow key increment.
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface SpacingBoxModelProps {
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
  onChange: (prop: string, value: number) => void;
}

export function SpacingBoxModel({ margin, padding, onChange }: SpacingBoxModelProps) {
  return (
    <div style={{ padding: "8px 12px 4px" }}>
      {/* Margin box (outer) */}
      <div
        style={{
          position: "relative",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "4px",
          background: "rgba(255, 152, 87, 0.08)",
          padding: "0",
        }}
      >
        {/* MARGIN label */}
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
          Margin
        </div>

        {/* Margin top */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <EditableValue value={margin.top} onChange={(v) => onChange("margin-top", v)} onAltClick={() => { onChange("margin-top", margin.top); onChange("margin-bottom", margin.top); }} />
        </div>

        {/* Margin left / Padding box / Margin right */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <EditableValue value={margin.left} onChange={(v) => onChange("margin-left", v)} onAltClick={() => { onChange("margin-left", margin.left); onChange("margin-right", margin.left); }} />
          </div>

          {/* Padding box (inner) */}
          <div
            style={{
              flex: 1,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "3px",
              background: "rgba(87, 168, 255, 0.08)",
              margin: "2px 0",
              position: "relative",
            }}
          >
            {/* PADDING label */}
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
              Padding
            </div>

            {/* Padding top */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
              <EditableValue value={padding.top} onChange={(v) => onChange("padding-top", v)} onAltClick={() => { onChange("padding-top", padding.top); onChange("padding-bottom", padding.top); }} />
            </div>

            {/* Padding left / content / Padding right */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                <EditableValue value={padding.left} onChange={(v) => onChange("padding-left", v)} onAltClick={() => { onChange("padding-left", padding.left); onChange("padding-right", padding.left); }} />
              </div>
              {/* Content placeholder */}
              <div
                style={{
                  flex: 1,
                  height: "20px",
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: "2px",
                  margin: "0 4px",
                }}
              />
              <div style={{ flex: "0 0 36px", display: "flex", justifyContent: "center" }}>
                <EditableValue value={padding.right} onChange={(v) => onChange("padding-right", v)} onAltClick={() => { onChange("padding-left", padding.right); onChange("padding-right", padding.right); }} />
              </div>
            </div>

            {/* Padding bottom */}
            <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
              <EditableValue value={padding.bottom} onChange={(v) => onChange("padding-bottom", v)} />
            </div>
          </div>

          <div style={{ flex: "0 0 40px", display: "flex", justifyContent: "center" }}>
            <EditableValue value={margin.right} onChange={(v) => onChange("margin-right", v)} />
          </div>
        </div>

        {/* Margin bottom */}
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          <EditableValue value={margin.bottom} onChange={(v) => onChange("margin-bottom", v)} />
        </div>
      </div>
    </div>
  );
}

// --- Editable inline value ---

function EditableValue({
  value,
  onChange,
  onAltClick,
}: {
  value: number;
  onChange: (value: number) => void;
  onAltClick?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when external value changes
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
        const step = e.shiftKey ? 10 : 1;
        const next = value + step;
        setDraft(String(next));
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const next = value - step;
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
          width: "28px",
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
        if (e.altKey && onAltClick) {
          onAltClick();
          return;
        }
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
