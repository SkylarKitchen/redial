/**
 * CornerRadiusEditor.tsx — 2×2 grid of corner radius inputs
 *
 * Webflow-style layout: each cell has a corner bracket icon, numeric value, and unit.
 * All cells share the same unit — changing any one changes all.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { UnitSelector } from "../controls/UnitSelector";
import { selectAllOnDoubleClick, useValueFlash } from "../controls";
import { useWheelAdjust } from "../hooks/useWheelAdjust";
import { color, text, border, surface, font, primaryAlpha, type IndicatorType, indicatorStyle } from "../theme";

export interface CornerRadiusEditorProps {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
  onChange: (corner: string, value: number) => void;
  unit: string;
  units: string[];
  onUnitChange: (unit: string) => void;
  /** Per-corner indicator: key = CSS property name, value = IndicatorType */
  indicators?: Record<string, IndicatorType>;
  /** Per-corner reset: key = CSS property name */
  onCornerReset?: (corner: string) => void;
}

// ─── Corner bracket SVGs ─────────────────────────────────────────────

function CornerIcon({ corner }: { corner: "tl" | "tr" | "br" | "bl" }) {
  const paths: Record<string, string> = {
    tl: "M3 11V6C3 4.34 4.34 3 6 3H11",
    tr: "M11 11V6C11 4.34 9.66 3 8 3H3",
    br: "M11 3V8C11 9.66 9.66 11 8 11H3",
    bl: "M3 3V8C3 9.66 4.34 11 6 11H11",
  };
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <path d={paths[corner]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Corner order: TL, TR, BL, BR (2×2 grid, left-to-right top-to-bottom) ──

const CORNERS = [
  { key: "border-top-left-radius", corner: "tl" as const, prop: "topLeft" as const, label: "Top-left radius" },
  { key: "border-top-right-radius", corner: "tr" as const, prop: "topRight" as const, label: "Top-right radius" },
  { key: "border-bottom-left-radius", corner: "bl" as const, prop: "bottomLeft" as const, label: "Bottom-left radius" },
  { key: "border-bottom-right-radius", corner: "br" as const, prop: "bottomRight" as const, label: "Bottom-right radius" },
];

// ─── Individual corner cell ──────────────────────────────────────────

function CornerCell({
  value,
  onChange,
  corner,
  label,
  unit,
  units,
  onUnitChange,
  indicator,
  onReset,
}: {
  value: number;
  onChange: (v: number) => void;
  corner: "tl" | "tr" | "br" | "bl";
  label: string;
  unit: string;
  units: string[];
  onUnitChange: (u: string) => void;
  indicator?: IndicatorType;
  onReset?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const cellRef = useRef<HTMLDivElement>(null);
  const flashStyle = useValueFlash(value);
  useWheelAdjust(cellRef, value, onChange, { step: 1, min: 0 });

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed !== value) {
      onChange(Math.max(0, Math.min(999, parsed)));
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
        const next = Math.min(999, value + step);
        setDraft(String(next));
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const next = Math.max(0, value - step);
        setDraft(String(next));
        onChange(next);
      }
    },
    [commit, value, onChange]
  );

  return (
    <div
      ref={cellRef}
      style={{
        display: "flex",
        alignItems: "center",
        height: 28,
        borderRadius: 4,
        border: `1px solid ${border.default}`,
        background: surface.subtle,
      }}
    >
      {/* Corner icon — tinted when modified, alt-click to reset */}
      <div
        style={{ padding: "0 4px 0 6px", color: indicator === "modified" ? color.primary : text.disabled, display: "flex", alignItems: "center", cursor: onReset ? "default" : undefined }}
        title={indicator === "modified" ? "Modified — Option+Click to reset" : label}
        onClick={(e) => { if (e.altKey && onReset) { e.stopPropagation(); onReset(); } }}
      >
        <CornerIcon corner={corner} />
      </div>

      {/* Value */}
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end", paddingRight: 2, minWidth: 0, borderRadius: 2, ...flashStyle }}>
        {editing ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            onDoubleClick={selectAllOnDoubleClick}
            autoFocus
            title={label}
            style={{
              width: 36,
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
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            tabIndex={0}
            onClick={() => setEditing(true)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
            title={label}
            style={{
              fontSize: 10,
              fontFamily: font.mono,
              cursor: "text",
              paddingRight: 4,
              outline: "none",
              minWidth: 16,
              textAlign: "right",
              color: value !== 0 ? text.label : text.disabled,
            }}
          >
            {value}
          </span>
        )}
      </div>

      {/* Unit */}
      <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
        <UnitSelector
          value={unit}
          options={units}
          onChange={onUnitChange}
          embedded
        />
      </div>
    </div>
  );
}

// ─── Main 2×2 grid ──────────────────────────────────────────────────

export function CornerRadiusEditor({
  topLeft,
  topRight,
  bottomRight,
  bottomLeft,
  onChange,
  unit,
  units,
  onUnitChange,
  indicators,
  onCornerReset,
}: CornerRadiusEditorProps) {
  const values = { topLeft, topRight, bottomRight, bottomLeft };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: "2px 12px 2px 76px" }}>
      {CORNERS.map((c) => (
        <CornerCell
          key={c.key}
          value={values[c.prop]}
          onChange={(v) => onChange(c.key, v)}
          corner={c.corner}
          label={c.label}
          unit={unit}
          units={units}
          onUnitChange={onUnitChange}
          indicator={indicators?.[c.key]}
          onReset={onCornerReset ? () => onCornerReset(c.key) : undefined}
        />
      ))}
    </div>
  );
}
