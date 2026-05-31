/**
 * layoutMisc.tsx — Misc layout/typography cells extracted from layoutControls.tsx
 *
 * ChildrenRow, TypoValueCell.
 *
 * Pure inline styles with theme.ts tokens — no Tailwind or CSS variables.
 */

import { useState, useRef, useEffect } from "react";
import { UnitSelector, type ConversionHint, type VariableOption } from "../controls/UnitSelector";
import { selectAllOnDoubleClick, useValueFlash } from "../controls";
import { evaluateMathExpr } from "../inputMath";
import { color, text, border, surface, font, blackAlpha, layout, type IndicatorType } from "../theme";
import { SegmentedControl } from "../controls/SegmentedControl";
import { useWheelAdjust } from "../hooks/useWheelAdjust";
import { VariableLinkDot } from "../controls/VariableLinkDot";
import { VariableField } from "../controls/VariableField";
import { RowLabel, ReverseButton } from "./layoutPrimitives";

// ─── ChildrenRow ────────────────────────────────────────────────────

/** Children row: Don't wrap / Wrap segmented control + reverse button */
export function ChildrenRow({ wrap, onWrapChange, indicator, onReset }: {
  wrap: string;
  onWrapChange: (v: string) => void;
  indicator?: IndicatorType;
  onReset?: () => void;
}) {
  const isWrap = wrap === "wrap" || wrap === "wrap-reverse";
  const isReverse = wrap === "wrap-reverse";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: layout.controlGap, padding: "0 12px" }}>
      <RowLabel label="Children" indicator={indicator} isSet={isWrap} onReset={onReset} />
      <SegmentedControl
        options={[
          { value: "nowrap", label: "Don\u2019t wrap" },
          { value: "wrap", label: "Wrap" },
        ]}
        value={isWrap ? "wrap" : "nowrap"}
        onChange={(v) => onWrapChange(v === "wrap" ? "wrap" : "nowrap")}
        aria-label="Flex wrap"
      />
      <ReverseButton
        active={isReverse}
        onClick={() => onWrapChange(isReverse ? "wrap" : "wrap-reverse")}
      />
    </div>
  );
}

// ─── TypoValueCell ──────────────────────────────────────────────────

/** Compact bordered input cell for typography properties (Size, Height, etc.) */
export function TypoValueCell({
  value,
  onChange,
  unit,
  onUnitChange,
  units,
  step = 1,
  keyword,
  conversionHint,
  cssVar,
  cssVarResolved,
  onCssVarChange,
  variableOptions,
}: {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  onUnitChange?: (u: string) => void;
  units?: string[];
  step?: number;
  keyword?: string | null;
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
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [rowHovered, setRowHovered] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const flashStyle = useValueFlash(value);
  const isVariable = keyword == null && (cssVar ?? null) !== null;
  useWheelAdjust(cellRef, value, onChange, { step, disabled: keyword != null || isVariable });

  useEffect(() => {
    if (!editing) setDraft(String(Math.round(value * 100) / 100));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const mathResult = evaluateMathExpr(draft, value);
    if (mathResult !== null) { onChange(mathResult); return; }
    const n = parseFloat(draft);
    if (!isNaN(n) && n !== value) onChange(n);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const s = e.shiftKey ? 10 : e.altKey ? 0.1 : step;
      const next = Math.round((value + s) * 100) / 100;
      setDraft(String(next));
      onChange(next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const s = e.shiftKey ? 10 : e.altKey ? 0.1 : step;
      const next = Math.round((value - s) * 100) / 100;
      setDraft(String(next));
      onChange(next);
    }
  };

  const isKeyword = keyword != null;

  return (
    <div
      ref={cellRef}
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
      style={{
        position: "relative",
        display: "flex",
        flex: 1,
        alignItems: "center",
        borderRadius: 4,
        minWidth: 0,
        height: 28,
        border: `1px solid ${border.default}`,
        backgroundColor: surface.subtle,
        ...flashStyle,
      }}
    >
      {!isKeyword && !isVariable && variableOptions && onCssVarChange && (
        <VariableLinkDot
          rowHovered={rowHovered}
          isLinked={false}
          variableType="length"
          onSelect={(varExpr) => {
            const match = varExpr.match(/^var\((.+)\)$/);
            if (match) onCssVarChange?.(match[1]);
          }}
          activeVariable={cssVar}
        />
      )}
      {isVariable ? (
        <VariableField
          variableName={cssVar!}
          variableType="length"
          onSelectVariable={(varExpr) => {
            const match = varExpr.match(/^var\((.+)\)$/);
            if (match) onCssVarChange?.(match[1]);
          }}
          onUnlink={() => onCssVarChange?.(null)}
        />
      ) : isKeyword ? (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: font.mono,
            paddingLeft: 6,
            paddingRight: 6,
            cursor: "text",
            outline: "none",
            color: text.label,
          }}
        >
          {keyword}
        </span>
      ) : editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onDoubleClick={selectAllOnDoubleClick}
          autoFocus
          style={{
            flex: 1,
            width: 0,
            background: "transparent",
            border: "none",
            fontSize: 11,
            fontFamily: font.mono,
            paddingLeft: 6,
            paddingRight: 6,
            outline: "none",
            color: color.foreground,
          }}
        />
      ) : (
        <span
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: font.mono,
            paddingLeft: 6,
            paddingRight: 6,
            cursor: "text",
            outline: "none",
            color: text.label,
          }}
        >
          {value}
        </span>
      )}
      {!isVariable && <div style={{
        flexShrink: 0,
        paddingRight: 3,
        borderLeft: `1px solid ${blackAlpha(0.07)}`,
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
      }}>
        {units && onUnitChange ? (
          <UnitSelector
            value={unit}
            options={units}
            onChange={(u) => { if (isVariable) onCssVarChange?.(null); onUnitChange(u); }}
            conversionHint={conversionHint}
            variableOptions={variableOptions}
            onVariableSelect={(name) => onCssVarChange?.(name)}
            embedded
          />
        ) : (
          <span style={{
            fontSize: 9,
            textTransform: "uppercase",
            paddingRight: 4,
            flexShrink: 0,
            fontFamily: font.mono,
            color: text.disabled,
          }}>
            {unit}
          </span>
        )}
      </div>}
    </div>
  );
}
