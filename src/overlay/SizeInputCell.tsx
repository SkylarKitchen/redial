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
import { cn } from "@/lib/utils";
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

  return (
    <div className="flex flex-1 flex-col gap-0.5">
    <div
      ref={cellRef}
      className={cn(
        "flex items-center h-[28px] rounded overflow-hidden",
        isModified
          ? "bg-[#D97757]/10 border border-[#D97757]/25"
          : "bg-[rgba(0,0,0,0.04)] border border-black/7"
      )}
      style={{ transition: `background ${ms("normal")}, border-color ${ms("normal")}` }}
    >
      {/* Label */}
      <div
        className={cn(
          "px-1.5 text-[10px] font-[system-ui,sans-serif] shrink-0 whitespace-nowrap leading-[28px]",
          isModified ? "text-[#D97757]" : "text-black/45"
        )}
        style={{ transition: `color ${ms("normal")}` }}
      >
        {isKeyword || isVariable ? (
          <span className="cursor-default">{label}</span>
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
      <div className="flex flex-1 items-center justify-end pr-0.5 min-w-0">
        {isKeyword ? (
          <span
            tabIndex={0}
            onClick={() => { onKeywordChange(null); setEditing(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onKeywordChange(null); setEditing(true); } }}
            className="text-[10px] font-mono text-black/50 capitalize pr-1 cursor-text outline-none"
          >
            {keyword}
          </span>
        ) : isVariable ? (
          <span
            tabIndex={0}
            onClick={() => { onCssVarChange?.(null); setEditing(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onCssVarChange?.(null); setEditing(true); } }}
            title={`${cssVar}: ${cssVarResolved ?? ""}`}
            className="flex items-center gap-1 text-[10px] font-mono pr-1 cursor-text outline-none overflow-hidden min-w-0"
          >
            <span className="text-[#D97757] overflow-hidden text-ellipsis whitespace-nowrap">
              {cssVar!.replace(/^--/, "")}
            </span>
            {cssVarResolved && (
              <span className="text-black/25 shrink-0">
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
            className="w-9 bg-black/7 border border-[#D97757]/50 rounded-sm text-black/75 text-[10px] font-mono text-right px-[3px] py-px outline-none"
          />
        ) : (
          <span
            tabIndex={0}
            onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); return; } setEditing(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(true); } }}
            className={cn(
              "text-[10px] font-mono cursor-text pr-1 outline-none min-w-[16px] text-right",
              value !== 0 ? "text-black/70" : "text-black/25"
            )}
          >
            {value}
          </span>
        )}
      </div>

      {/* Unit / keyword toggle */}
      <div className="shrink-0 pr-[3px]">
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
