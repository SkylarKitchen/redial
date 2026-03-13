/**
 * ShadowEditor.tsx — multi-value box-shadow editor
 *
 * Supports adding/removing shadow layers, each with X, Y, Blur, Spread,
 * color swatch, inset toggle, and delete.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { useDragReorder } from "./useDragReorder";
import { DragHandle } from "./DragHandle";
import { ColorPickerEnhanced } from "./ColorPickerEnhanced";
import { cssColorToHex } from "./colorUtils";
import { ms } from "./timing";
import { color, font } from "./theme";

export interface ShadowValue {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
  visible: boolean;
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
  visible: true,
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
          color: "#737373",
          fontFamily: font.sans,
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
            background: "rgba(0,0,0,0.07)",
            border: "1px solid rgba(59,130,246,0.5)",
            borderRadius: "2px",
            color: "#171717",
            fontSize: "10px",
            fontFamily: font.mono,
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
            fontFamily: font.mono,
            color: value !== 0 ? "#525252" : "#A3A3A3",
            cursor: "text",
            padding: "2px",
            borderRadius: "2px",
            textAlign: "center",
            background: "rgba(0,0,0,0.03)",
            transition: `background ${ms("normal")}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.05)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)";
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
  onToggleVisible,
  dragHandleProps,
  isDragging,
}: {
  shadow: ShadowValue;
  index: number;
  onUpdate: (index: number, shadow: ShadowValue) => void;
  onDelete: (index: number) => void;
  onToggleVisible: (index: number) => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
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
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        opacity: shadow.visible === false ? 0.4 : 1,
        transition: "opacity 100ms",
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
            onClick={() => setPickerOpen(!pickerOpen)}
            title={`Shadow color: ${shadow.color}`}
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "2px",
              border: "1px solid rgba(0,0,0,0.15)",
              background: shadow.color,
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          />
          {pickerOpen && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 2147483647, marginTop: "4px" }}>
              <ColorPickerEnhanced
                color={cssColorToHex(shadow.color)}
                onChange={(hex, opacity) => {
                  const color = opacity < 1
                    ? `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${opacity})`
                    : hex;
                  onUpdate(index, { ...shadow, color });
                }}
                onClose={() => setPickerOpen(false)}
              />
            </div>
          )}
        </div>

        {/* Inset toggle */}
        <button
          onClick={() => updateField("inset")(!shadow.inset)}
          title={shadow.inset ? "Inset (click to toggle)" : "Outset (click to toggle)"}
          style={{
            fontSize: "9px",
            fontFamily: font.mono,
            color: shadow.inset ? color.primary : "#737373",
            background: shadow.inset ? "rgba(59,130,246,0.15)" : "rgba(0,0,0,0.03)",
            border: shadow.inset
              ? "1px solid rgba(59,130,246,0.3)"
              : "1px solid rgba(0,0,0,0.07)",
            borderRadius: "2px",
            padding: "1px 4px",
            cursor: "pointer",
            transition: `all ${ms("normal")}`,
          }}
        >
          Inset
        </button>

        <div style={{ flex: 1 }} />

        {/* Eye visibility toggle */}
        <button
          onClick={() => onToggleVisible(index)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            color: shadow.visible !== false ? "#525252" : "#A3A3A3",
            pointerEvents: isDragging ? "none" : "auto",
          }}
          title={shadow.visible !== false ? "Hide layer" : "Show layer"}
        >
          {shadow.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(index)}
          title="Remove shadow"
          style={{
            fontSize: "12px",
            color: "#737373",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 4px",
            lineHeight: 1,
            transition: `color ${ms("normal")}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#525252";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#737373";
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

  const handleToggleVisible = useCallback(
    (index: number) => {
      const next = [...shadows];
      next[index] = { ...next[index], visible: next[index].visible === false ? true : false };
      onChange(next);
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
          fontFamily: font.sans,
          color: color.primary,
          background: "rgba(59,130,246,0.08)",
          border: "1px dashed rgba(59,130,246,0.3)",
          borderRadius: "3px",
          cursor: "pointer",
          marginBottom: "4px",
          transition: `background ${ms("normal")}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.08)";
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
              onToggleVisible={handleToggleVisible}
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
            color: "#A3A3A3",
            textAlign: "center",
            fontFamily: font.sans,
          }}
        >
          No shadows
        </div>
      )}
    </div>
  );
}
