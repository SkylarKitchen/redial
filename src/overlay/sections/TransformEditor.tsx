/**
 * TransformEditor.tsx — Transform property editor
 *
 * Add/remove translate, scale, rotate, skew transforms.
 * Includes a 9-cell visual origin picker for transform-origin.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { TransformOriginPicker } from "./TransformOriginPicker";
import { EditorRemoveButton } from "../controls";
import { DragHandle } from "../DragHandle";
import { useDragReorder } from "../useDragReorder";
import { color, text, border, surface, font, shadow, zIndex, blackAlpha, focusBorder } from "../theme";

export interface TransformValue {
  type: "translate" | "scale" | "rotate" | "skew";
  x: number;
  y: number;
  z?: number;
}

export interface TransformEditorProps {
  transforms: TransformValue[];
  onChange: (transforms: TransformValue[]) => void;
  origin: string;
  onOriginChange: (origin: string) => void;
}

type TransformType = TransformValue["type"];

const TRANSFORM_TYPES: TransformType[] = ["translate", "scale", "rotate", "skew"];

const TRANSFORM_LABELS: Record<TransformType, string> = {
  translate: "Move",
  scale: "Scale",
  rotate: "Rotate",
  skew: "Skew",
};

const TRANSFORM_DEFAULTS: Record<TransformType, TransformValue> = {
  translate: { type: "translate", x: 0, y: 0, z: 0 },
  scale: { type: "scale", x: 1, y: 1 },
  rotate: { type: "rotate", x: 0, y: 0 },
  skew: { type: "skew", x: 0, y: 0 },
};

const TRANSFORM_RANGES: Record<TransformType, { min: number; max: number; step: number }> = {
  translate: { min: -500, max: 500, step: 1 },
  scale: { min: 0, max: 5, step: 0.1 },
  rotate: { min: -360, max: 360, step: 1 },
  skew: { min: -90, max: 90, step: 1 },
};


function getUnit(type: TransformType, axis: "x" | "y" | "z"): string {
  if (type === "translate") return "px";
  if (type === "rotate") return "deg";
  if (type === "skew") return "deg";
  return "";
}

export function TransformEditor({ transforms, onChange, origin, onOriginChange }: TransformEditorProps) {
  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(transforms, onChange);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const handleAdd = useCallback(
    (type: TransformType) => {
      onChange([...transforms, { ...TRANSFORM_DEFAULTS[type] }]);
      setDropdownOpen(false);
    },
    [transforms, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(transforms.filter((_, i) => i !== index));
    },
    [transforms, onChange]
  );

  const handleUpdate = useCallback(
    (index: number, field: "x" | "y" | "z", value: number) => {
      const next = transforms.map((t, i) => {
        if (i !== index) return t;
        return { ...t, [field]: value };
      });
      onChange(next);
    },
    [transforms, onChange]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Transform cards */}
      <div style={{ position: "relative" }}>
        {transforms.map((t, index) => {
          const dragProps = handleProps(index);
          return (
            <div key={index} ref={registerRef(index)} style={{ ...itemStyle(index), marginBottom: "6px" }}>
              <TransformCard
                transform={t}
                onUpdate={(field, value) => handleUpdate(index, field, value)}
                onRemove={() => handleRemove(index)}
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
      </div>

      {/* Add transform */}
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          style={{
            background: "transparent",
            border: `1px solid ${surface.active}`,
            borderRadius: "3px",
            color: text.label,
            fontSize: "10px",
            fontFamily: font.sans,
            padding: "3px 8px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = color.input;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          + Add transform
        </button>

        {dropdownOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "2px",
              background: color.popover,
              border: `1px solid ${border.input}`,
              borderRadius: "4px",
              padding: "2px 0",
              zIndex: zIndex.dropdown,
              minWidth: "100px",
              boxShadow: shadow.dropdown,
            }}
          >
            {TRANSFORM_TYPES.map((type) => (
              <div
                key={type}
                onClick={() => handleAdd(type)}
                style={{
                  padding: "4px 10px",
                  fontSize: "10px",
                  fontFamily: font.sans,
                  color: text.label,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = surface.hover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {TRANSFORM_LABELS[type]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transform origin */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
        <span
          style={{
            fontSize: "10px",
            fontFamily: font.sans,
            color: text.disabled,
          }}
        >
          Origin
        </span>
        <TransformOriginPicker value={origin} onChange={onOriginChange} />
      </div>
    </div>
  );
}

/** Single transform card row */
function TransformCard({
  transform,
  onUpdate,
  onRemove,
  dragHandleProps,
  isDragging,
}: {
  transform: TransformValue;
  onUpdate: (field: "x" | "y" | "z", value: number) => void;
  onRemove: () => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
}) {
  const { type } = transform;
  const range = TRANSFORM_RANGES[type];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        background: blackAlpha(0.03),
        border: `1px solid ${surface.hover}`,
        borderRadius: "3px",
        padding: "4px 6px",
        height: "28px",
        overflow: "hidden",
      }}
    >
      {/* Drag handle */}
      {dragHandleProps && (
        <DragHandle
          isDragging={isDragging}
          onPointerDown={dragHandleProps.onPointerDown}
          style={{ alignSelf: "center" }}
        />
      )}

      {/* Label */}
      <span
        style={{
          width: "38px",
          fontSize: "10px",
          fontFamily: font.sans,
          color: text.label,
          flexShrink: 0,
        }}
      >
        {TRANSFORM_LABELS[type]}
      </span>

      {/* Rotate: single value */}
      {type === "rotate" ? (
        <>
          <AxisInput
            value={transform.x}
            min={range.min}
            max={range.max}
            step={range.step}
            onChange={(v) => onUpdate("x", v)}
          />
          <UnitLabel unit="deg" />
        </>
      ) : (
        <>
          {/* X */}
          <AxisLabel label="X" />
          <AxisInput
            value={transform.x}
            min={range.min}
            max={range.max}
            step={range.step}
            onChange={(v) => onUpdate("x", v)}
          />
          <UnitLabel unit={getUnit(type, "x")} />

          {/* Y */}
          <AxisLabel label="Y" />
          <AxisInput
            value={transform.y}
            min={range.min}
            max={range.max}
            step={range.step}
            onChange={(v) => onUpdate("y", v)}
          />
          <UnitLabel unit={getUnit(type, "y")} />

          {/* Z (translate only) */}
          {type === "translate" && (
            <>
              <AxisLabel label="Z" />
              <AxisInput
                value={transform.z ?? 0}
                min={range.min}
                max={range.max}
                step={range.step}
                onChange={(v) => onUpdate("z", v)}
              />
              <UnitLabel unit="px" />
            </>
          )}
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Remove */}
      <EditorRemoveButton onClick={onRemove} />
    </div>
  );
}

function AxisLabel({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: "9px",
        fontFamily: font.sans,
        color: text.disabled,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function UnitLabel({ unit }: { unit: string }) {
  if (!unit) return null;
  return (
    <span
      style={{
        fontSize: "9px",
        fontFamily: font.mono,
        color: text.disabled,
        flexShrink: 0,
        width: "14px",
      }}
    >
      {unit}
    </span>
  );
}

/** Numeric input with arrow key increment */
function AxisInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  }, [draft, min, max, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const inc = e.shiftKey ? step * 10 : step;
        const next = Math.min(max, Math.round((value + inc) * 1000) / 1000);
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const inc = e.shiftKey ? step * 10 : step;
        const next = Math.max(min, Math.round((value - inc) * 1000) / 1000);
        onChange(next);
      }
    },
    [commit, value, min, max, step, onChange]
  );

  return (
    <input
      value={focused ? draft : String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      style={{
        width: "36px",
        background: color.input,
        border: focusBorder(focused),
        borderRadius: "2px",
        color: text.secondary,
        fontSize: "10px",
        fontFamily: font.mono,
        textAlign: "center",
        padding: "2px 2px",
        outline: "none",
        flexShrink: 0,
      }}
    />
  );
}

