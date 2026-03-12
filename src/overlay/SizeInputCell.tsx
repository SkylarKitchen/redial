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
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type SpecialOption, type ConversionHint, type VariableOption } from "./UnitSelector";
import { selectAllOnDoubleClick, VALUE_PRESETS, PresetChips } from "./controls";
import { ms } from "./timing";
import { parseValueWithUnit } from "./parseValueWithUnit";
import { evaluateMathExpr } from "./inputMath";
import { useWheelAdjust } from "./useWheelAdjust";

export interface SizeInputCellProps {
  label: string;
  value: number;
  unit: string;
  units: string[];
  keyword: "auto" | "none" | null;
  onValueChange: (v: number) => void;
  onUnitChange: (u: string) => void;
  onKeywordChange: (k: "auto" | "none" | null) => void;
  isModified: boolean;
  supportsAuto?: boolean;
  supportsNone?: boolean;
  step?: number;
  min?: number;
  max?: number;
  /** Conversion tooltip hint passed through to UnitSelector */
  conversionHint?: ConversionHint | null;
  /** CSS property name — enables preset chips when VALUE_PRESETS has entries */
  property?: string;
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
  keyword,
  onValueChange,
  onUnitChange,
  onKeywordChange,
  isModified,
  supportsAuto = false,
  supportsNone = false,
  step = 1,
  min,
  max,
  conversionHint,
  property,
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
  useWheelAdjust(cellRef, value, onValueChange, { step, min, max, disabled: keyword !== null || isVariable });

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    // Empty field → contextual keyword (e.g. "auto" for width, "none" for max-width)
    if (draft.trim() === '') {
      if (supportsAuto) { onKeywordChange("auto"); return; }
      if (supportsNone) { onKeywordChange("none"); return; }
      return;
    }
    // Try math expression first (e.g. "*2", "+10")
    const mathResult = evaluateMathExpr(draft, value);
    if (mathResult !== null) { onValueChange(mathResult); return; }
    const { value: parsed, unit: parsedUnit } = parseValueWithUnit(draft, units);
    if (isNaN(parsed)) return;
    if (parsedUnit && parsedUnit !== unit) {
      // User typed a unit suffix (e.g. "68em") — switch unit and value
      if (keyword !== null) onKeywordChange(null);
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
      onKeywordChange(val as "auto" | "none");
    },
    [onKeywordChange]
  );

  const handleUnitSelect = useCallback(
    (u: string) => {
      // Switching to a numeric unit clears keyword
      if (keyword !== null) onKeywordChange(null);
      onUnitChange(u);
    },
    [keyword, onKeywordChange, onUnitChange]
  );

  const isKeyword = keyword !== null;

  const handlePresetSelect = useCallback((v: string) => {
    // Keywords: "auto", "none"
    if ((v === "auto" && supportsAuto) || (v === "none" && supportsNone)) {
      onKeywordChange(v as "auto" | "none");
      return;
    }
    // Values with unit suffix like "100%" — parse value and switch unit
    const numMatch = v.match(/^(-?[\d.]+)(%|px|em|rem|vw|vh)$/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      const u = numMatch[2];
      if (keyword !== null) onKeywordChange(null);
      if (u !== unit && units.includes(u)) onUnitChange(u);
      onValueChange(num);
      return;
    }
    // Pure numeric string
    const parsed = parseFloat(v);
    if (!isNaN(parsed)) {
      if (keyword !== null) onKeywordChange(null);
      onValueChange(parsed);
    }
  }, [keyword, onKeywordChange, onValueChange, onUnitChange, unit, units, supportsAuto, supportsNone]);

  const hasPresets = property && VALUE_PRESETS[property];

  // Colors based on modified state
  const labelColor = isModified ? "#6ea8fe" : "rgba(255,255,255,0.5)";
  const cellBg = isModified ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.06)";
  const cellBorder = isModified
    ? "1px solid rgba(99,102,241,0.25)"
    : "1px solid rgba(255,255,255,0.1)";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
    <div
      ref={cellRef}
      style={{
        display: "flex",
        alignItems: "center",
        height: "28px",
        background: cellBg,
        border: cellBorder,
        borderRadius: "4px",
        overflow: "hidden",
        transition: `background ${ms("normal")}, border-color ${ms("normal")}`,
      }}
    >
      {/* Label */}
      <div
        style={{
          padding: "0 6px",
          fontSize: "10px",
          color: labelColor,
          fontFamily: "system-ui, sans-serif",
          flexShrink: 0,
          whiteSpace: "nowrap",
          lineHeight: "28px",
          transition: `color ${ms("normal")}`,
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
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: "2px",
          minWidth: 0,
        }}
      >
        {isKeyword ? (
          <span
            tabIndex={0}
            onClick={() => { onKeywordChange(null); setEditing(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onKeywordChange(null); setEditing(true); } }}
            style={{
              fontSize: "10px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: "rgba(255,255,255,0.6)",
              textTransform: "capitalize",
              paddingRight: "4px",
              cursor: "text",
              outline: "none",
            }}
          >
            {keyword}
          </span>
        ) : isVariable ? (
          <span
            tabIndex={0}
            onClick={() => { onCssVarChange?.(null); setEditing(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onCssVarChange?.(null); setEditing(true); } }}
            title={`${cssVar}: ${cssVarResolved ?? ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              paddingRight: "4px",
              cursor: "text",
              outline: "none",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            <span style={{ color: "#a78bfa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cssVar!.replace(/^--/, "")}
            </span>
            {cssVarResolved && (
              <span style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
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
              width: "36px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(99,102,241,0.5)",
              borderRadius: "2px",
              color: "rgba(255,255,255,0.9)",
              fontSize: "10px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              textAlign: "right",
              padding: "1px 3px",
              outline: "none",
            }}
          />
        ) : (
          <span
            tabIndex={0}
            onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); return; } setEditing(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(true); } }}
            style={{
              fontSize: "10px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: value !== 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
              cursor: "text",
              paddingRight: "4px",
              outline: "none",
              minWidth: "16px",
              textAlign: "right",
            }}
          >
            {value}
          </span>
        )}
      </div>

      {/* Unit / keyword toggle */}
      <div style={{ flexShrink: 0, paddingRight: "3px" }}>
        <UnitSelector
          value={isVariable ? "VAR" : isKeyword ? "–" : unit}
          options={units}
          onChange={handleUnitSelect}
          specialOptions={specialOptions}
          onSpecialSelect={handleSpecialSelect}
          conversionHint={conversionHint}
          variableOptions={variableOptions}
          onVariableSelect={(name) => onCssVarChange?.(name)}
        />
      </div>
    </div>
    {hasPresets && <PresetChips property={property!} onSelect={handlePresetSelect} />}
    </div>
  );
}
