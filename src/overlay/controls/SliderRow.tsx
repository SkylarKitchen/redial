/**
 * controls/SliderRow.tsx — Labeled slider with value input, unit selector,
 * preset chips, label-drag scrubbing, and CSS variable linking.
 */

import React, { useCallback, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { type IndicatorType, primaryAlpha } from "../theme";
import { getIndicatorTitle } from "../panelUtils";
import { ComputedTooltip } from "./ComputedTooltip";
import { beginBatch, endBatch } from "../core/apply";
import { text, border, surface, font } from "../theme";
import { labelStyle, rowStyle, useResetPopover, PresetChips } from "./helpers";
import { ValueInput } from "./ValueInput";
import { VariablePicker } from "./VariablePicker";
import { Link2, Unlink, X } from "lucide-react";
import { ms } from "../timing";

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  units,
  onUnitChange,
  onChange,
  onReset,
  indicator,
  onContextMenu,
  computedProp,
  computedElement,
  conversionHint,
  snapPoints,
  snapThreshold,
  property,
  onPreset,
  annotation,
  onSelectVariable,
  activeVariable,
  variableElement,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** If provided, shows a UnitSelector dropdown instead of a static unit label */
  units?: string[];
  onUnitChange?: (unit: string) => void;
  onChange: (value: number) => void;
  /** Called when the label is clicked (not dragged) to reset the property */
  onReset?: () => void;
  indicator?: IndicatorType;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** CSS property name for computed tooltip (e.g. "font-size") */
  computedProp?: string;
  /** Target element for computed tooltip */
  computedElement?: Element;
  /** Conversion tooltip hint shown after unit change */
  conversionHint?: ConversionHint | null;
  /** Magnetic snap values (e.g. [0, 8, 16, 24, 32, 50, 100]) */
  snapPoints?: number[];
  /** Pixel distance for snap activation (default 3) */
  snapThreshold?: number;
  /** Key into theme presets (e.g. "opacity", "gap") */
  property?: string;
  /** Called when a string preset is selected (numeric presets use onChange) */
  onPreset?: (value: string | number) => void;
  /** Small hint label shown next to the value input (e.g. Tailwind class name) */
  annotation?: string;
  /** Called when a CSS variable is selected from the variable picker */
  onSelectVariable?: (varExpr: string) => void;
  /** Currently linked variable name (e.g. "--spacing-4"), enables variable mode */
  activeVariable?: string | null;
  /** Target element for variable picker scoped discovery */
  variableElement?: Element;
}) {
  const snapValue = useCallback((raw: number): number => {
    if (!snapPoints || snapPoints.length === 0) return raw;
    const threshold = snapThreshold ?? 3;
    const range = max - min;
    const valueThreshold = (threshold / 100) * range;

    for (const snap of snapPoints) {
      if (snap >= min && snap <= max && Math.abs(raw - snap) <= valueThreshold) {
        return snap;
      }
    }
    return raw;
  }, [snapPoints, snapThreshold, min, max]);

  const resetPopover = useResetPopover(indicator, onReset);
  const labelTitle = indicator ? getIndicatorTitle(indicator) : label;
  const labelContent = (
    <span
      ref={resetPopover.anchorRef}
      title={labelTitle}
      style={labelStyle(indicator)}
    >
      {label}
    </span>
  );
  const handlePresetSelect = useCallback((v: string | number) => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (!isNaN(n)) onChange(n);
    else if (onPreset) onPreset(v);
  }, [onChange, onPreset]);

  // Variable picker state
  const [varPickerOpen, setVarPickerOpen] = useState(false);
  const linkBtnRef = useRef<HTMLButtonElement>(null);

  const isLinked = !!activeVariable;
  const displayVarName = activeVariable ? activeVariable.replace(/^--/, "") : "";

  // Unlink: resolve the variable to its computed value
  const handleUnlink = useCallback(() => {
    if (!computedElement || !computedProp) return;
    const resolved = getComputedStyle(computedElement).getPropertyValue(computedProp).trim();
    const num = parseFloat(resolved);
    if (!isNaN(num)) onChange(num);
  }, [computedElement, computedProp, onChange]);

  // ─── Variable mode ─────────────────────────────────────────────
  if (isLinked) {
    return (
      <>
      <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
        <LabelScrub value={value} onChange={onChange} step={step} min={min} max={max} onAltClick={onReset} onClick={resetPopover.triggerOpen}>
          {computedProp && computedElement ? (
            <ComputedTooltip property={computedProp} element={computedElement}>
              {labelContent}
            </ComputedTooltip>
          ) : labelContent}
        </LabelScrub>
        {/* Variable name display */}
        <span
          title={`${activeVariable}\n${value}${unit}`}
          style={{
            flex: 1,
            fontSize: 10,
            fontFamily: font.mono,
            color: primaryAlpha(0.8),
            overflow: "clip",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {displayVarName}
        </span>
        {/* Unlink button */}
        <button
          type="button"
          title="Unlink variable"
          onClick={(e) => {
            e.stopPropagation();
            handleUnlink();
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: primaryAlpha(0.6),
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Unlink size={11} strokeWidth={2} />
        </button>
        {/* Reset button */}
        {indicator === "modified" && onReset && (
          <button
            type="button"
            title="Reset to original value"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: text.hint,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              opacity: 0.5,
              transition: `opacity ${ms("fast")}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        )}
      </div>
      {resetPopover.node}
      </>
    );
  }

  // ─── Numeric mode (default) ────────────────────────────────────
  return (
    <>
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      <LabelScrub value={value} onChange={onChange} step={step} min={min} max={max} onAltClick={onReset} onClick={resetPopover.triggerOpen}>
        {computedProp && computedElement ? (
          <ComputedTooltip property={computedProp} element={computedElement}>
            {labelContent}
          </ComputedTooltip>
        ) : labelContent}
      </LabelScrub>
      <Slider
        className="tuner-focusable"
        style={{ flex: 1 }}
        aria-label={`${label}: ${value}${unit}`}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(snapValue(v))}
        onPointerDown={() => beginBatch()}
        onPointerUp={() => endBatch()}
      />
      {annotation && (
        <span style={{ fontSize: 9, fontFamily: font.mono, color: text.hint, flexShrink: 0, whiteSpace: "nowrap" }}>{annotation}</span>
      )}
      <div style={{ display: "flex", alignItems: "center", height: 28, borderRadius: 4, border: `1px solid ${border.default}`, background: surface.subtle, flexShrink: 0 }}>
        <ValueInput value={value} onChange={onChange} onAltClick={onReset} embedded step={step} />
        {units && onUnitChange ? (
          <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
            <UnitSelector value={unit} options={units} onChange={onUnitChange} conversionHint={conversionHint} embedded />
          </div>
        ) : unit ? (
          <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: text.label }}>{unit}</span>
          </div>
        ) : null}
      </div>
      {/* Link to variable button */}
      {onSelectVariable && (
        <button
          ref={linkBtnRef}
          type="button"
          title="Link to variable"
          onClick={(e) => {
            e.stopPropagation();
            setVarPickerOpen(!varPickerOpen);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: text.hint,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            opacity: 0.6,
            transition: `opacity ${ms("fast")}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
        >
          <Link2 size={11} strokeWidth={2} />
        </button>
      )}
      {/* Reset button */}
      {indicator === "modified" && onReset && (
        <button
          type="button"
          title="Reset to original value"
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: text.hint,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            opacity: 0.5,
            transition: `opacity ${ms("fast")}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
    {/* Variable picker portal */}
    {varPickerOpen && linkBtnRef.current && (
      <VariablePicker
        anchor={linkBtnRef.current}
        type="length"
        element={variableElement}
        onSelect={(varExpr) => {
          onSelectVariable!(varExpr);
          setVarPickerOpen(false);
        }}
        onClose={() => setVarPickerOpen(false)}
        activeVariable={activeVariable}
      />
    )}
    {property && <PresetChips property={property} onSelect={handlePresetSelect} unit={unit} />}
    {resetPopover.node}
    </>
  );
}
