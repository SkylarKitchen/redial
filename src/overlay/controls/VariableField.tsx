/**
 * VariableField.tsx — Webflow-style purple pill for the linked variable state.
 *
 * Replaces the value area in any control when a CSS variable is linked.
 * Shows the variable name in a purple pill. Hover reveals a pencil icon
 * for editing. Click the pill to open the VariablePicker (to switch/unlink).
 * Click the pencil to open EditVariablePopover (stub — implemented in Task 2).
 */

import { useState, useRef, useCallback } from "react";
import { color, font, layout, variableAlpha } from "../theme";
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

// ─── Stub: EditVariablePopover ──────────────────────────────────────

function EditVariablePopover(_props: {
  anchor: HTMLElement;
  variableName: string;
  onClose: () => void;
}) {
  return null; // Implemented in Task 2
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
