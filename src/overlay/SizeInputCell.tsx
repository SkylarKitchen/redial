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
import { UnitSelector, type SpecialOption } from "./UnitSelector";

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
}: SizeInputCellProps) {
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
      onValueChange(parsed);
    }
  }, [draft, value, onValueChange]);

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
    [commit, value, onValueChange, step]
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

  // Colors based on modified state
  const labelColor = isModified ? "#6ea8fe" : "rgba(255,255,255,0.5)";
  const cellBg = isModified ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.06)";
  const cellBorder = isModified
    ? "1px solid rgba(99,102,241,0.25)"
    : "1px solid rgba(255,255,255,0.1)";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        height: "28px",
        background: cellBg,
        border: cellBorder,
        borderRadius: "4px",
        overflow: "hidden",
        transition: "background 100ms, border-color 100ms",
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
          transition: "color 100ms",
        }}
      >
        {isKeyword ? (
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
        ) : editing ? (
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
              textAlign: "right",
              padding: "1px 3px",
              outline: "none",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            tabIndex={0}
            onClick={() => setEditing(true)}
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
        {isKeyword ? (
          <UnitSelector
            value="–"
            options={units}
            onChange={handleUnitSelect}
            specialOptions={specialOptions}
            onSpecialSelect={handleSpecialSelect}
          />
        ) : (
          <UnitSelector
            value={unit}
            options={units}
            onChange={handleUnitSelect}
            specialOptions={specialOptions}
            onSpecialSelect={handleSpecialSelect}
          />
        )}
      </div>
    </div>
  );
}
