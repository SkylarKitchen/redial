/**
 * VariableField.tsx — Webflow-style purple pill for the linked variable state.
 *
 * Replaces the value area in any control when a CSS variable is linked.
 * Shows the variable name in a purple pill. Hover reveals a pencil icon
 * for editing. Click the pill to open the VariablePicker (to switch/unlink).
 * Click the pencil to open EditVariablePopover (stub — implemented in Task 2).
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { color, font, layout, variableAlpha, text, border, surface, shadow, zIndex } from "../theme";
import { ms } from "../timing";
import { VariablePicker } from "./VariablePicker";
import { Pencil } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

export interface VariableFieldProps {
  /** Variable name with -- prefix, e.g. "--size" */
  variableName: string;
  /** Filter type for picker */
  variableType?: "color" | "length" | "all";
  /** Element for scoped variable discovery */
  element?: Element;
  /** Called when user selects a variable — receives var(--name) */
  onSelectVariable: (varExpr: string) => void;
  /** Called when user unlinks the variable */
  onUnlink: () => void;
}

// ─── EditVariablePopover ─────────────────────────────────────────────

function EditVariablePopover({
  anchor,
  variableName,
  onClose,
}: {
  anchor: HTMLElement;
  variableName: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Strip -- prefix for the name field
  const bareNameInit = variableName.startsWith("--")
    ? variableName.slice(2)
    : variableName;
  const [name, setName] = useState(bareNameInit);

  // Read current computed value
  const computedInit = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  const [value, setValue] = useState(computedInit);

  // Position below anchor, clamped to viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ar = anchor.getBoundingClientRect();
    const mr = el.getBoundingClientRect();
    let top = ar.bottom + 4;
    let left = ar.left;
    if (left + mr.width > window.innerWidth - 8)
      left = window.innerWidth - mr.width - 8;
    if (top + mr.height > window.innerHeight - 8)
      top = ar.top - mr.height - 4;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchor]);

  // Click-outside → close (capture phase)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  // Escape → close (capture phase)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  // Commit name rename globally
  const commitName = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === bareNameInit) return;
    const currentValue = getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();
    document.documentElement.style.removeProperty(variableName);
    document.documentElement.style.setProperty(`--${trimmed}`, currentValue);
  }, [name, bareNameInit, variableName]);

  // Commit value update globally
  const commitValue = useCallback(() => {
    document.documentElement.style.setProperty(variableName, value);
  }, [variableName, value]);

  const inputStyle: React.CSSProperties = {
    height: 28,
    background: surface.subtle,
    border: `1px solid ${border.default}`,
    borderRadius: 4,
    padding: "0 8px",
    fontSize: 11,
    fontFamily: font.mono,
    color: text.primary,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return createPortal(
    <div
      ref={ref}
      data-tuner-portal
      style={{
        position: "fixed",
        zIndex: zIndex.max,
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
        width: 240,
        background: color.background,
        border: `1px solid ${border.default}`,
        borderRadius: 6,
        boxShadow: shadow.dropdown,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: text.primary,
        }}
      >
        Edit variable
      </div>

      {/* Name field */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 10, color: text.label }}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitName();
            }
          }}
          style={inputStyle}
        />
      </div>

      {/* Value field */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 10, color: text.label }}>Value</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitValue();
            }
          }}
          style={inputStyle}
        />
      </div>
    </div>,
    document.body,
  );
}

// ─── VariableField ──────────────────────────────────────────────────

export function VariableField({
  variableName,
  variableType = "all",
  element,
  onSelectVariable,
  onUnlink,
}: VariableFieldProps) {
  const [hovered, setHovered] = useState(false);
  const [pencilHovered, setPencilHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);

  // Strip -- prefix for display
  const displayName = variableName.startsWith("--")
    ? variableName.slice(2)
    : variableName;

  const handlePillClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setPickerOpen((prev) => !prev);
    },
    [],
  );

  const handlePencilClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditOpen((prev) => !prev);
    },
    [],
  );

  const handlePickerSelect = useCallback(
    (varExpr: string) => {
      onSelectVariable(varExpr);
      setPickerOpen(false);
    },
    [onSelectVariable],
  );

  return (
    <>
      <div
        ref={pillRef}
        role="button"
        tabIndex={0}
        onClick={handlePillClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePillClick(e as unknown as React.MouseEvent);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPencilHovered(false);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
          height: 26,
          padding: "0 6px",
          borderRadius: layout.pillRadius,
          background: hovered
            ? variableAlpha(0.22)
            : variableAlpha(0.15),
          border: `1px solid ${variableAlpha(0.3)}`,
          cursor: "pointer",
          transition: `background ${ms("fast")}`,
          position: "relative",
          gap: 4,
        }}
      >
        {/* Variable name */}
        <span
          style={{
            color: color.variable,
            fontSize: 11,
            fontFamily: font.mono,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            minWidth: 0,
            lineHeight: "26px",
          }}
        >
          {displayName}
        </span>

        {/* Pencil icon — appears on hover */}
        <button
          ref={pencilRef}
          type="button"
          title="Edit variable"
          onClick={handlePencilClick}
          onMouseEnter={() => setPencilHovered(true)}
          onMouseLeave={() => setPencilHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            opacity: hovered ? (pencilHovered ? 1 : 0.7) : 0,
            transition: `opacity ${ms("fast")}`,
            flexShrink: 0,
            outline: "none",
            pointerEvents: hovered ? "auto" : "none",
          }}
        >
          <Pencil
            size={11}
            color={color.variable}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* VariablePicker portal */}
      {pickerOpen && pillRef.current && (
        <VariablePicker
          anchor={pillRef.current}
          type={variableType}
          element={element}
          onSelect={handlePickerSelect}
          onClose={() => setPickerOpen(false)}
          activeVariable={variableName}
          onUnlink={onUnlink}
        />
      )}

      {/* EditVariablePopover (stub — Task 2) */}
      {editOpen && pencilRef.current && (
        <EditVariablePopover
          anchor={pencilRef.current}
          variableName={variableName}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
