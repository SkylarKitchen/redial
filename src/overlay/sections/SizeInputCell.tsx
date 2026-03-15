/**
 * SizeInputCell.tsx — Compact bordered input cell for size properties
 *
 * Replaces SliderRow in the Size section with a Webflow-style layout:
 * ┌──────────────────────────┐
 * │ Label  │  200  │ PX ▾   │  (numeric mode)
 * │ Label  │  Auto │  - ▾   │  (keyword mode)
 * └──────────────────────────┘
 *
 * Modified values get blue highlighting (label + cell background).
 * LabelScrub wraps the label for drag-to-scrub in numeric mode.
 *
 * All styles use inline React styles referencing theme.ts tokens.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { LabelScrub } from "../controls/LabelScrub";
import { UnitSelector, type SpecialOption, type ConversionHint, type VariableOption } from "../controls/UnitSelector";
import { selectAllOnDoubleClick, useValueFlash, useResetPopover } from "../controls";
import { color, text, border, surface, font, primaryAlpha } from "../theme";
import type { IndicatorType } from "../theme";
import { parseValueWithUnit } from "../parseValueWithUnit";
import { evaluateMathExpr } from "../inputMath";
import { useWheelAdjust } from "../hooks/useWheelAdjust";

export interface SizeInputCellProps {
  label: string;
  value: number;
  unit: string;
  units: string[];
  keyword?: "auto" | "none" | null;
  onValueChange: (v: number) => void;
  onUnitChange: (u: string) => void;
  onKeywordChange?: (k: "auto" | "none" | null) => void;
  isModified: boolean;
  supportsAuto?: boolean;
  supportsNone?: boolean;
  step?: number;
  min?: number;
  max?: number;
  /** Conversion tooltip hint passed through to UnitSelector */
  conversionHint?: ConversionHint | null;
  /** Currently selected CSS variable name, or null */
  cssVar?: string | null;
  /** Resolved display value of the variable (e.g. "16") */
  cssVarResolved?: string;
  /** Called when a CSS variable is selected from the dropdown */
  onCssVarChange?: (varName: string | null) => void;
  /** CSS variable options for the UnitSelector dropdown */
  variableOptions?: VariableOption[];
  /** Called on alt+click the value to reset to default */
  onReset?: () => void;
}

export function SizeInputCell({
  label,
  value,
  unit,
  units,
  keyword = null,
  onValueChange,
  onUnitChange,
  onKeywordChange,  // optional — only needed when supportsAuto or supportsNone
  isModified,
  supportsAuto = false,
  supportsNone = false,
  step = 1,
  min,
  max,
  conversionHint,
  cssVar,
  cssVarResolved,
  onCssVarChange,
  variableOptions,
  onReset,
}: SizeInputCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const isVariable = keyword === null && (cssVar ?? null) !== null;
  const flashStyle = useValueFlash(value);
  useWheelAdjust(cellRef, value, onValueChange, { step, min, max, disabled: keyword !== null || isVariable });
  const indicator: IndicatorType = isModified ? "modified" : "none";
  const resetPopover = useResetPopover(indicator, onReset);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    // Empty field → contextual keyword (e.g. "auto" for width, "none" for max-width)
    if (draft.trim() === '') {
      if (supportsAuto) { onKeywordChange?.("auto"); return; }
      if (supportsNone) { onKeywordChange?.("none"); return; }
      return;
    }
    // Try math expression first (e.g. "*2", "+10")
    const mathResult = evaluateMathExpr(draft, value);
    if (mathResult !== null) { onValueChange(mathResult); return; }
    const { value: parsed, unit: parsedUnit } = parseValueWithUnit(draft, units);
    if (isNaN(parsed)) return;
    if (parsedUnit && parsedUnit !== unit) {
      // User typed a unit suffix (e.g. "68em") — switch unit and value
      if (keyword !== null) onKeywordChange?.(null);
      onUnitChange(parsedUnit);
      onValueChange(parsed);
    } else if (parsed !== value) {
      onValueChange(parsed);
    }
  }, [draft, units, unit, value, keyword, onValueChange, onUnitChange, onKeywordChange, supportsAuto, supportsNone]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
      } else if (e.key === "Escape") {
        setDraft(String(value));
        setEditing(false);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const s = e.shiftKey ? 10 : e.altKey ? 0.1 : step;
        let next = Math.round((value + s) * 10) / 10;
        if (max !== undefined) next = Math.min(next, max);
        if (min !== undefined) next = Math.max(next, min);
        setDraft(String(next));
        onValueChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const s = e.shiftKey ? 10 : e.altKey ? 0.1 : step;
        let next = Math.round((value - s) * 10) / 10;
        if (max !== undefined) next = Math.min(next, max);
        if (min !== undefined) next = Math.max(next, min);
        setDraft(String(next));
        onValueChange(next);
      }
    },
    [commit, value, onValueChange, step, min, max]
  );

  // Build special options for the unit dropdown
  const specialOptions: SpecialOption[] = [];
  if (supportsAuto) specialOptions.push({ value: "auto", label: "Auto" });
  if (supportsNone) specialOptions.push({ value: "none", label: "None" });

  const handleSpecialSelect = useCallback(
    (val: string) => {
      onKeywordChange?.(val as "auto" | "none");
    },
    [onKeywordChange]
  );

  const handleUnitSelect = useCallback(
    (u: string) => {
      // Switching to a numeric unit clears keyword
      if (keyword !== null) onKeywordChange?.(null);
      onUnitChange(u);
    },
    [keyword, onKeywordChange, onUnitChange]
  );

  const isKeyword = keyword !== null;

  return (
    <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2 }}>
    <div
      ref={cellRef}
      onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}
      style={{
        display: "flex",
        alignItems: "center",
        height: 28,
        borderRadius: 4,
        border: `1px solid ${border.default}`,
        background: surface.subtle,
      }}
    >
      {/* Modified dot + Label — click opens reset popover */}
      {isModified && <span ref={resetPopover.anchorRef} onClick={(e) => { e.stopPropagation(); if (e.altKey && onReset) { onReset(); return; } resetPopover.triggerOpen(); }} style={{ width: 5, height: 5, borderRadius: '50%', background: color.primary, flexShrink: 0, marginLeft: 4, cursor: "pointer" }} title="Click to reset" />}
      {/* Label */}
      <div
        onClick={(e) => { if (isModified && !e.altKey) { e.stopPropagation(); resetPopover.triggerOpen(); } }}
        style={{
          padding: "0 6px",
          fontSize: 10,
          fontFamily: font.sans,
          flexShrink: 0,
          whiteSpace: "nowrap",
          lineHeight: "28px",
          color: text.disabled,
          cursor: isModified ? "pointer" : undefined,
        }}
      >
        {isKeyword || isVariable ? (
          <span style={{ cursor: "default" }}>{label}</span>
        ) : (
          <LabelScrub
            value={value}
            onChange={onValueChange}
            step={step}
            min={min}
            max={max}
          >
            {label}
          </LabelScrub>
        )}
      </div>

      {/* Value area */}
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end", paddingRight: 2, minWidth: 0, borderRadius: 2, ...flashStyle }}>
        {isKeyword ? (
          <span
            tabIndex={0}
            onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); return; } onKeywordChange?.(null); setEditing(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onKeywordChange?.(null); setEditing(true); } }}
            style={{ fontSize: 10, fontFamily: font.mono, fontStyle: "italic", textTransform: "capitalize", paddingRight: 4, cursor: "text", outline: "none", color: text.disabled }}
          >
            {keyword}
          </span>
        ) : isVariable ? (
          <span
            tabIndex={0}
            onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); return; } onCssVarChange?.(null); setEditing(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onCssVarChange?.(null); setEditing(true); } }}
            title={`${cssVar}: ${cssVarResolved ?? ""}`}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: font.mono, paddingRight: 4, cursor: "text", outline: "none", overflow: "hidden", minWidth: 0 }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: color.primary }}>
              {cssVar!.replace(/^--/, "")}
            </span>
            {cssVarResolved && (
              <span style={{ flexShrink: 0, color: text.hint }}>
                {parseFloat(cssVarResolved) || cssVarResolved}
              </span>
            )}
          </span>
        ) : editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => { e.stopPropagation(); if (e.altKey && onReset) { e.preventDefault(); onReset(); setEditing(false); } }}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            onDoubleClick={selectAllOnDoubleClick}
            autoFocus
            style={{
              width: "100%",
              border: `1px solid ${primaryAlpha(0.5)}`,
              borderRadius: 2,
              fontSize: 10,
              fontFamily: font.mono,
              textAlign: "right",
              padding: "1px 3px",
              outline: "none",
              background: surface.active,
              color: text.secondary,
            }}
          />
        ) : (
          <span
            tabIndex={0}
            onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); return; } setEditing(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(true); } }}
            style={{ fontSize: 10, fontFamily: font.mono, cursor: "text", paddingRight: 4, outline: "none", minWidth: 16, textAlign: "right", color: value !== 0 ? text.label : text.disabled }}
          >
            {value}
          </span>
        )}
      </div>

      {/* Unit / keyword toggle */}
      <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
        <UnitSelector
          value={isVariable ? "VAR" : isKeyword ? "–" : unit}
          options={units}
          onChange={handleUnitSelect}
          specialOptions={specialOptions}
          onSpecialSelect={handleSpecialSelect}
          conversionHint={conversionHint}
          variableOptions={variableOptions}
          onVariableSelect={(name) => onCssVarChange?.(name)}
          embedded
        />
      </div>
    </div>
    {resetPopover.node}
    </div>
  );
}
