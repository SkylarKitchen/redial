/**
 * ModeValueCell.tsx — Editable per-mode value cell for the variables detail pane.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { VariableValue } from "./ReferencePill";
import type { InferredMode } from "./modeDiscovery";
import {
  applyModeOverride,
  isModeOverrideDirty,
  beginModeCoalesce,
  endModeCoalesce,
} from "./modeOverrides";
import { ColorPickerEnhanced } from "../controls/ColorPickerEnhanced";
import { VariableLinkDot } from "../controls/VariableLinkDot";
import { VariableField } from "../controls/VariableField";
import { cssColorToHex, hexToRgba } from "../colorUtils";
import { parseVarRef } from "./colorVariables";
import {
  text,
  border,
  surface,
  font,
  color,
  zIndex,
  labelIndicator,
  labelHighlight,
} from "../theme";

export function ModeValueCell({
  varName,
  mode,
  value,
  varType,
}: {
  varName: string;
  mode: InferredMode;
  value: string | undefined;
  varType: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cellHovered, setCellHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      const id = setTimeout(() => inputRef.current?.select(), 0);
      return () => clearTimeout(id);
    }
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && mode.selector) {
      applyModeOverride(mode.selector, varName, trimmed);
    }
    setEditing(false);
  }, [draft, mode.selector, varName]);

  const editable = mode.source !== "media";
  const isOverridden = isModeOverrideDirty(mode.selector ?? "", varName);
  const linkedVarName = value ? parseVarRef(value) : null;
  const isLinked = !!linkedVarName;

  const handleVarSelect = useCallback((varExpr: string) => {
    if (mode.selector) {
      applyModeOverride(mode.selector, varName, varExpr);
    }
  }, [mode.selector, varName]);

  const handleUnlink = useCallback(() => {
    if (!linkedVarName || !mode.selector) return;
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(linkedVarName).trim();
    if (resolved) {
      applyModeOverride(mode.selector, varName, resolved);
    }
  }, [linkedVarName, mode.selector, varName]);

  // ── Editing state ──
  if (editing) {
    return (
      <div style={{ flex: 1, minWidth: 120, overflow: "hidden" }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setEditing(false); e.stopPropagation(); }
          }}
          onBlur={commit}
          data-tuner-portal
          style={{
            width: "100%",
            fontSize: 11,
            fontFamily: font.mono,
            background: surface.hover,
            border: `1px solid ${color.primary}`,
            borderRadius: 3,
            padding: "1px 4px",
            outline: "none",
            color: text.primary,
            textAlign: "right",
            boxSizing: "border-box" as const,
          }}
        />
      </div>
    );
  }

  // ── Linked state: VariableField purple pill ──
  if (isLinked && editable) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 120,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          ...(isOverridden ? {
            borderRadius: 3,
            outline: `1px solid ${labelIndicator.modified.bg}`,
          } : {}),
        }}
      >
        <VariableField
          variableName={linkedVarName}
          variableType={varType === "color" ? "color" : "all"}
          onSelectVariable={handleVarSelect}
          onUnlink={handleUnlink}
        />
      </div>
    );
  }

  // ── Linked state but read-only (base/media) ──
  if (isLinked && !editable) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          overflow: "hidden",
          borderRadius: 3,
          padding: "1px 3px",
        }}
      >
        {varType === "color" && value && (
          <div style={{
            width: 12, height: 12, borderRadius: 3, flexShrink: 0, marginRight: 4,
            background: value, border: `1px solid ${border.default}`,
          }} />
        )}
        <VariableValue value={value!} />
      </div>
    );
  }

  // ── Unlinked state: VariableLinkDot + raw value ──
  return (
    <div
      onMouseEnter={() => setCellHovered(true)}
      onMouseLeave={() => setCellHovered(false)}
      onClick={editable ? () => setEditing(true) : undefined}
      style={{
        flex: 1,
        minWidth: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        cursor: editable ? "text" : "default",
        borderRadius: 3,
        padding: "1px 3px",
        position: "relative",
        ...(isOverridden ? {
          background: labelIndicator.modified.bg,
          color: labelIndicator.modified.text,
          ...labelHighlight,
        } : {}),
      }}
    >
      {/* VariableLinkDot at top-left corner (absolute, default mode) */}
      {editable && (
        <VariableLinkDot
          rowHovered={cellHovered}
          isLinked={false}
          variableType={varType === "color" ? "color" : "all"}
          onSelect={handleVarSelect}
          activeVariable={null}
        />
      )}

      {/* Color dot for color-type variables */}
      {varType === "color" && value && (
        <div
          ref={dotRef}
          onClick={(e) => {
            if (!editable) return;
            e.stopPropagation();
            setPickerOpen(true);
          }}
          style={{
            width: 12, height: 12, borderRadius: 3, flexShrink: 0, marginRight: 4,
            background: value, border: `1px solid ${border.default}`,
            cursor: editable ? "pointer" : "default",
          }}
        />
      )}

      {value !== undefined ? (
        <VariableValue value={value} />
      ) : (
        <span style={{ color: text.disabled, fontSize: 11, fontFamily: font.mono }}>
          {editable ? "+" : "\u2014"}
        </span>
      )}

      {/* Color picker portal */}
      {pickerOpen && dotRef.current && (() => {
        const rect = dotRef.current!.getBoundingClientRect();
        const pickerWidth = 264;
        const pickerHeight = 300;
        const gap = 4;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < pickerHeight + gap
          ? rect.top - pickerHeight - gap : rect.bottom + gap;
        const left = Math.min(rect.left, window.innerWidth - pickerWidth - gap);
        return createPortal(
          <div data-tuner-portal style={{ position: "fixed", top, left, zIndex: zIndex.max }}>
            <ColorPickerEnhanced
              color={value ? cssColorToHex(value) : "#000000"}
              onChange={(hex, opacity) => {
                if (mode.selector) {
                  beginModeCoalesce();
                  const final = opacity < 1 ? hexToRgba(hex, opacity) : hex;
                  applyModeOverride(mode.selector, varName, final);
                }
              }}
              onClose={() => { endModeCoalesce(); setPickerOpen(false); }}
            />
          </div>,
          document.body,
        );
      })()}
    </div>
  );
}
