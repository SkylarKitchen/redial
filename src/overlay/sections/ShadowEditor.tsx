/**
 * ShadowEditor.tsx — multi-value box-shadow editor
 *
 * Supports adding/removing shadow layers, each with X, Y, Blur, Spread,
 * color swatch, inset toggle, and delete.
 */

import { useState, useCallback } from "react";
import { useDraftNumber } from "../hooks/useDraftNumber";

import { useDragReorder } from "../hooks/useDragReorder";
import { DragHandle } from "../shell/DragHandle";
import { SwatchColorPicker } from "../controls/SwatchColorPicker";
import { shadowToCSS } from "../cssParsers";
import { ms } from "../timing";
import { color, text, font, border, surface, primaryAlpha, blackAlpha } from "../theme";
import { EditorRemoveButton, VisibilityToggle, AnimatedListItem } from "../controls";

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
  /**
   * "box" (default) edits box-shadow. "text" edits text-shadow, whose grammar
   * has no spread length and no inset keyword — the variant hides those
   * controls and serializes the preview without them (issue #61).
   */
  variant?: "box" | "text";
}

/** Canonical default box-shadow value. */
export const DEFAULT_SHADOW: ShadowValue = {
  x: 0,
  y: 2,
  blur: 4,
  spread: 0,
  color: blackAlpha(0.1),
  inset: false,
  visible: true,
};

/**
 * Create a fresh ShadowValue from the canonical default, optionally
 * overriding fields. Pass a string to override just the color
 * (the common case), or a partial object for finer control.
 */
export function makeShadow(overrides?: string | Partial<ShadowValue>): ShadowValue {
  if (typeof overrides === "string") {
    return { ...DEFAULT_SHADOW, color: overrides };
  }
  return { ...DEFAULT_SHADOW, ...overrides };
}

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
  const { draft, inputProps } = useDraftNumber({
    value,
    resync: !editing,
    revertOnEscape: true,
    stepUpdatesDraft: true,
    onEscape: () => setEditing(false),
    onCommit: (d) => {
      setEditing(false);
      const parsed = parseFloat(d);
      if (!isNaN(parsed) && parsed !== value) {
        onChange(parsed);
      }
    },
    onStep: (next) => onChange(next),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span
        style={{
          fontSize: "8px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: text.disabled,
          fontFamily: font.sans,
        }}
      >
        {label}
      </span>
      {editing ? (
        <input
          value={draft}
          {...inputProps}
          autoFocus
          style={{
            width: "36px",
            background: blackAlpha(0.07),
            border: `1px solid ${primaryAlpha(0.5)}`,
            borderRadius: "2px",
            color: text.primary,
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
            color: value !== 0 ? text.secondary : text.hint,
            cursor: "text",
            padding: "2px",
            borderRadius: "2px",
            textAlign: "center",
            background: blackAlpha(0.03),
            transition: `background ${ms("normal")}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = surface.hover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = color.input;
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
  variant,
  onUpdate,
  onDelete,
  onToggleVisible,
  dragHandleProps,
  isDragging,
}: {
  shadow: ShadowValue;
  index: number;
  variant: "box" | "text";
  onUpdate: (index: number, shadow: ShadowValue) => void;
  onDelete: (index: number) => void;
  onToggleVisible: (index: number) => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
}) {
  const updateField = useCallback(
    (field: keyof ShadowValue) => (val: number | boolean) => {
      onUpdate(index, { ...shadow, [field]: val });
    },
    [index, shadow, onUpdate]
  );

  const shadowCSS = shadowToCSS([shadow], variant);

  return (
    <div
      style={{
        padding: "6px 0",
        borderBottom: `1px solid ${border.subtle}`,
        opacity: shadow.visible === false ? 0.4 : 1,
        transition: `opacity ${ms("normal")}`,
      }}
    >
      {/* Row 1: drag handle + preview swatch + numeric inputs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "4px", alignItems: "flex-end" }}>
        {dragHandleProps && (
          <DragHandle
            isDragging={isDragging}
            onPointerDown={dragHandleProps.onPointerDown}
            style={{ alignSelf: "center" }}
          />
        )}
        {/* Shadow preview swatch — a glyph for text shadows, a box otherwise */}
        <div
          title={shadowCSS}
          style={{
            width: 20,
            height: 20,
            borderRadius: 3,
            background: color.background,
            border: `1px solid ${border.default}`,
            ...(variant === "text"
              ? { textShadow: shadowCSS }
              : { boxShadow: shadowCSS }),
            flexShrink: 0,
            alignSelf: "center",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontFamily: font.sans,
            color: text.primary,
          }}
        >
          {variant === "text" ? "A" : null}
        </div>
        <NumericInput value={shadow.x} label="X" onChange={updateField("x") as (v: number) => void} />
        <NumericInput value={shadow.y} label="Y" onChange={updateField("y") as (v: number) => void} />
        <NumericInput value={shadow.blur} label="Blur" onChange={updateField("blur") as (v: number) => void} />
        {variant !== "text" && (
          <NumericInput value={shadow.spread} label="Spread" onChange={updateField("spread") as (v: number) => void} />
        )}
      </div>

      {/* Row 2: color, inset, delete */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {/* Color swatch */}
        <SwatchColorPicker
          value={shadow.color}
          title={`Shadow color: ${shadow.color}`}
          swatchStyle={{
            width: "16px",
            height: "16px",
            borderRadius: "2px",
            border: `1px solid ${blackAlpha(0.15)}`,
          }}
          onChange={(hex, opacity) => {
            const color = opacity < 1
              ? `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${opacity})`
              : hex;
            onUpdate(index, { ...shadow, color });
          }}
          onSelectVariable={(varExpr) => {
            onUpdate(index, { ...shadow, color: varExpr });
          }}
        />

        {/* Inset toggle — text-shadow has no inset keyword */}
        {variant !== "text" && (
        <button
          onClick={() => updateField("inset")(!shadow.inset)}
          title={shadow.inset ? "Inset (click to toggle)" : "Outset (click to toggle)"}
          style={{
            fontSize: "9px",
            fontFamily: font.mono,
            color: shadow.inset ? color.primary : text.disabled,
            background: shadow.inset ? primaryAlpha(0.15) : blackAlpha(0.03),
            border: shadow.inset
              ? `1px solid ${primaryAlpha(0.3)}`
              : `1px solid ${blackAlpha(0.07)}`,
            borderRadius: "2px",
            padding: "1px 4px",
            cursor: "pointer",
            transition: `all ${ms("normal")}`,
          }}
        >
          Inset
        </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Eye visibility toggle */}
        <VisibilityToggle
          visible={shadow.visible !== false}
          onToggle={() => onToggleVisible(index)}
        />

        {/* Delete */}
        <EditorRemoveButton onClick={() => onDelete(index)} title="Remove shadow" />
      </div>
    </div>
  );
}

export function ShadowEditor({ shadows, onChange, variant = "box" }: ShadowEditorProps) {
  const { registerRef, handleProps, itemStyle, dropLine, isDragging } = useDragReorder(shadows, onChange);

  const handleAdd = useCallback(() => {
    onChange([...shadows, makeShadow()]);
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
          background: primaryAlpha(0.08),
          border: `1px dashed ${primaryAlpha(0.3)}`,
          borderRadius: "3px",
          cursor: "pointer",
          marginBottom: "4px",
          transition: `background ${ms("normal")}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = primaryAlpha(0.15);
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = primaryAlpha(0.08);
        }}
      >
        + Add shadow
      </button>

      {/* Shadow rows */}
      {shadows.map((shadow, i) => {
        const dragProps = handleProps(i);
        return (
          <div key={i} ref={registerRef(i)} style={itemStyle(i)}>
            <AnimatedListItem>
              <ShadowRow
                shadow={shadow}
                index={i}
                variant={variant}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onToggleVisible={handleToggleVisible}
                dragHandleProps={dragProps}
                isDragging={isDragging}
              />
            </AnimatedListItem>
          </div>
        );
      })}

      {/* Drop indicator line */}
      {dropLine}
    </div>
  );
}
