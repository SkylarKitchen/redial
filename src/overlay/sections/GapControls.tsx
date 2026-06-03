/**
 * GapControls.tsx — Gap row extracted from layoutControls.tsx
 *
 * GapInput (private) + GapRow.
 *
 * Pure inline styles with theme.ts tokens — no Tailwind or CSS variables.
 */

import { useState, useEffect } from "react";
import { useValueFlash } from "../controls";
import { evaluateMathExpr } from "../inputMath";
import { useDraftNumber } from "../hooks/useDraftNumber";
import { color, text, border, font, segment, layout } from "../theme";
import { UnlockIcon, LockIcon } from "../webflowIcons";
import { type IndicatorType } from "../theme";
import { RowLabel } from "./layoutPrimitives";

// ─── GapRow (Dual Inputs) ───────────────────────────────────────────

/** Webflow-style gap input: bordered field with integrated unit suffix */
function GapInput({ value, unit, onChange }: {
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const flashStyle = useValueFlash(value);

  const { draft, setDraft, inputProps } = useDraftNumber({
    value,
    // resync handled by the effect below to preserve the original's 2-decimal
    // rounding of the edit-draft seed (hook's built-in resync writes the raw value).
    resync: false,
    step: 1,
    shiftStep: 10,
    min: 0,
    revertOnEscape: true,
    onCommit: (d) => {
      setEditing(false);
      const mathResult = evaluateMathExpr(d, value);
      if (mathResult !== null) { onChange(mathResult); return; }
      const n = parseFloat(d);
      if (!isNaN(n) && n !== value) onChange(n);
    },
    onStep: (next) => onChange(next),
    onEscape: () => setEditing(false),
  });

  useEffect(() => {
    if (!editing) setDraft(String(Math.round(value * 100) / 100));
  }, [value, editing, setDraft]);

  const commit = inputProps.onBlur;
  const handleKeyDown = inputProps.onKeyDown;

  return (
    <div style={{
      display: "flex",
      flex: 1,
      minWidth: 0,
      height: 24,
      borderRadius: segment.radius,
      border: `1px solid ${border.default}`,
      overflow: "hidden",
      background: color.background,
    }}>
      {/* Value area */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        padding: 4,
        gap: 2,
        backgroundColor: segment.hoverBg,
        overflow: "hidden",
        ...flashStyle,
      }}>
        {editing ? (
          <input
            value={draft}
            onChange={inputProps.onChange}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 11.5,
              fontFamily: font.sans,
              letterSpacing: -0.115,
              color: text.primary,
              lineHeight: "16px",
            }}
          />
        ) : (
          <span
            tabIndex={0}
            onClick={() => setEditing(true)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
            style={{
              fontSize: 11.5,
              fontFamily: font.sans,
              letterSpacing: -0.115,
              color: text.primary,
              lineHeight: "16px",
              cursor: "text",
              outline: "none",
            }}
          >
            {value}
          </span>
        )}
      </div>
      {/* Unit suffix */}
      <div style={{
        width: 16,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: segment.activeBg,
        fontSize: 8,
        fontFamily: font.sans,
        fontWeight: 600,
        color: text.secondary,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        flexShrink: 0,
      }}>
        {unit}
      </div>
    </div>
  );
}

/** Gap row: dual Webflow-style inputs (column + row) with link toggle */
export function GapRow({ columnGap, rowGap, columnUnit, rowUnit, onColumnChange, onRowChange,
                          onColumnUnitChange, onRowUnitChange, linked, onLinkedChange, onReset,
                          indicator }: {
  columnGap: number;
  rowGap: number;
  columnUnit: string;
  rowUnit: string;
  onColumnChange: (v: number) => void;
  onRowChange: (v: number) => void;
  onColumnUnitChange: (u: string) => void;
  onRowUnitChange: (u: string) => void;
  linked: boolean;
  onLinkedChange: (v: boolean) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
}) {
  const isSet = columnGap !== 0 || rowGap !== 0;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding }}>
        <RowLabel label="Gap" indicator={indicator} isSet={isSet} onReset={onReset} />
        {/* Column gap input */}
        <GapInput value={columnGap} unit={columnUnit} onChange={(v) => {
          onColumnChange(v);
          if (linked) onRowChange(v);
        }} />
        {/* Link/unlock toggle */}
        <button
          onClick={() => onLinkedChange(!linked)}
          title={linked ? "Gap linked (column = row)" : "Gap unlinked"}
          style={{
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
            borderRadius: 4,
            color: text.secondary,
          }}
        >
          {linked ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
        </button>
        {/* Row gap input */}
        <GapInput value={rowGap} unit={rowUnit} onChange={(v) => {
          onRowChange(v);
          if (linked) onColumnChange(v);
        }} />
      </div>
      {/* Sub-labels: Columns / Rows — positioned under their respective inputs */}
      <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: layout.rowPadding, marginTop: 4 }}>
        <span style={{ width: layout.labelWidth, flexShrink: 0 }} />
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <RowLabel label="Columns" indicator={isSet ? "modified" : "none"} />
        </span>
        <span style={{ width: 24, flexShrink: 0 }} />
        <span style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <RowLabel label="Rows" indicator={isSet ? "modified" : "none"} />
        </span>
      </div>
    </div>
  );
}
