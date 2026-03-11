/**
 * ShadowEditor.tsx — multi-value box-shadow editor
 *
 * Supports adding/removing shadow layers, each with X, Y, Blur, Spread,
 * color swatch, inset toggle, and delete.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useDragReorder } from "./useDragReorder";
import { DragHandle } from "./DragHandle";

export interface ShadowValue {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

export interface ShadowEditorProps {
  shadows: ShadowValue[];
  onChange: (shadows: ShadowValue[]) => void;
}

const DEFAULT_SHADOW: ShadowValue = {
  x: 0,
  y: 2,
  blur: 4,
  spread: 0,
  color: "rgba(0,0,0,0.1)",
  inset: false,
};

function NumericInput({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span
        style={{
          fontSize: "8px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "rgba(255,255,255,0.35)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: "36px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(99,102,241,0.5)",
            borderRadius: "2px",
            color: "rgba(255,255,255,0.9)",
            fontSize: "10px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            textAlign: "center",
            padding: "2px",
            outline: "none",
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          style={{
            display: "inline-block",
            width: "36px",
            fontSize: "10px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: value !== 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
            cursor: "text",
            padding: "2px",
            borderRadius: "2px",
            textAlign: "center",
            background: "rgba(255,255,255,0.04)",
            transition: "background 100ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function ShadowRow({
  shadow,
  index,
  onUpdate,
  onDelete,
  dragHandleProps,
  isDragging,
}: {
  shadow: ShadowValue;
  index: number;
  onUpdate: (index: number, shadow: ShadowValue) => void;
  onDelete: (index: number) => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const updateField = useCallback(
    (field: keyof ShadowValue) => (val: number | boolean) => {
      onUpdate(index, { ...shadow, [field]: val });
    },
    [index, shadow, onUpdate]
  );

  return (
    <div
      style={{
        padding: "6px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Row 1: drag handle + numeric inputs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "4px", alignItems: "flex-end" }}>
        {dragHandleProps && (
          <DragHandle
            isDragging={isDragging}
            onPointerDown={dragHandleProps.onPointerDown}
            style={{ alignSelf: "center" }}
          />
        )}
        <NumericInput value={shadow.x} label="X" onChange={updateField("x") as (v: number) => void} />
        <NumericInput value={shadow.y} label="Y" onChange={updateField("y") as (v: number) => void} />
        <NumericInput value={shadow.blur} label="Blur" onChange={updateField("blur") as (v: number) => void} />
        <NumericInput value={shadow.spread} label="Spread" onChange={updateField("spread") as (v: number) => void} />
      </div>

      {/* Row 2: color, inset, delete */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {/* Color swatch */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => colorInputRef.current?.click()}
            title={`Shadow color: ${shadow.color}`}
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "2px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: shadow.color,
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          />
          <input
            ref={colorInputRef}
            type="color"
            value={shadow.color.startsWith("#") ? shadow.color : (() => {
              // Convert rgba/hsla to closest hex for native color picker (no alpha support)
              const m = shadow.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
              if (m) return "#" + [m[1], m[2], m[3]].map(c => parseInt(c).toString(16).padStart(2, "0")).join("");
              return "#000000";
            })()}
            onChange={(e) => onUpdate(index, { ...shadow, color: e.target.value })}
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              opacity: 0,
              overflow: "hidden",
            }}
          />
        </div>

        {/* Inset toggle */}
        <button
          onClick={() => updateField("inset")(!shadow.inset)}
          title={shadow.inset ? "Inset (click to toggle)" : "Outset (click to toggle)"}
          style={{
            fontSize: "9px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: shadow.inset ? "#6366f1" : "rgba(255,255,255,0.35)",
            background: shadow.inset ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
            border: shadow.inset
              ? "1px solid rgba(99,102,241,0.3)"
              : "1px solid rgba(255,255,255,0.1)",
            borderRadius: "2px",
            padding: "1px 4px",
            cursor: "pointer",
            transition: "all 100ms",
          }}
        >
          Inset
        </button>

        <div style={{ flex: 1 }} />

        {/* Delete */}
        <button
          onClick={() => onDelete(index)}
          title="Remove shadow"
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.35)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 4px",
            lineHeight: 1,
            transition: "color 100ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)";
          }}
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export function ShadowEditor({ shadows, onChange }: ShadowEditorProps) {
  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(shadows, onChange);

  const handleAdd = useCallback(() => {
    onChange([...shadows, { ...DEFAULT_SHADOW }]);
  }, [shadows, onChange]);

  const handleUpdate = useCallback(
    (index: number, shadow: ShadowValue) => {
      const next = [...shadows];
      next[index] = shadow;
      onChange(next);
    },
    [shadows, onChange]
  );

  const handleDelete = useCallback(
    (index: number) => {
      onChange(shadows.filter((_, i) => i !== index));
    },
    [shadows, onChange]
  );

  return (
    <div style={{ padding: "4px 12px", position: "relative" }}>
      {/* Add button */}
      <button
        onClick={handleAdd}
        style={{
          width: "100%",
          padding: "4px 0",
          fontSize: "10px",
          fontFamily: "system-ui, sans-serif",
          color: "#6366f1",
          background: "rgba(99,102,241,0.08)",
          border: "1px dashed rgba(99,102,241,0.3)",
          borderRadius: "3px",
          cursor: "pointer",
          marginBottom: "4px",
          transition: "background 100ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.08)";
        }}
      >
        + Add shadow
      </button>

      {/* Shadow rows */}
      {shadows.map((shadow, i) => {
        const dragProps = handleProps(i);
        return (
          <div key={i} ref={registerRef(i)} style={itemStyle(i)}>
            <ShadowRow
              shadow={shadow}
              index={i}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              dragHandleProps={dragProps}
              isDragging={isDragging}
            />
          </div>
        );
      })}

      {/* Drop indicator line */}
      {(() => {
        const style = dropLineStyle();
        return style ? <div style={style} /> : null;
      })()}

      {shadows.length === 0 && (
        <div
          style={{
            padding: "8px 0",
            fontSize: "10px",
            color: "rgba(255,255,255,0.25)",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          No shadows
        </div>
      )}
    </div>
  );
}
