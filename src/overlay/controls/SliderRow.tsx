/**
 * controls/SliderRow.tsx — Labeled slider with value input, unit selector,
 * preset chips, and label-drag scrubbing.
 */

import React, { useCallback, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector, type ConversionHint } from "./UnitSelector";
import { type IndicatorType } from "../theme";
import { getIndicatorTitle } from "../panelUtils";
import { ComputedTooltip } from "./ComputedTooltip";
import { beginBatch, endBatch } from "../core/apply";
import { text, border, surface, font, primaryAlpha } from "../theme";
import { labelStyle, rowStyle, useResetPopover, PresetChips } from "./helpers";
import { ValueInput } from "./ValueInput";
import { VariableLinkDot } from "./VariableLinkDot";
import { VariableField } from "./VariableField";
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
  onUnlink,
  variableType,
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
  /** Called when user selects a variable from the picker; receives `var(--name)` */
  onSelectVariable?: (varExpr: string) => void;
  /** When set (e.g. `--spacing-4`), renders variable mode instead of slider */
  activeVariable?: string | null;
  /** Target element for resolving computed value on unlink */
  variableElement?: Element;
  /** Called on unlink instead of onChange when the display scale differs from CSS value (e.g. opacity 0-100 display vs 0-1 CSS) */
  onUnlink?: (resolvedValue: number) => void;
  /** VariablePicker filter type (default: "length") */
  variableType?: "color" | "length" | "all";
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

  const [rowHovered, setRowHovered] = useState(false);

  const handleUnlink = useCallback(() => {
    if (!variableElement || !computedProp) return;
    const computed = getComputedStyle(variableElement).getPropertyValue(computedProp);
    const num = parseFloat(computed);
    if (!isNaN(num)) {
      if (onUnlink) onUnlink(num);
      else onChange(num);
    }
  }, [variableElement, computedProp, onChange, onUnlink]);

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

  // Variable mode: show variable name + unlink/reset instead of slider
  if (activeVariable) {
    return (
      <>
      <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }} onMouseEnter={() => setRowHovered(true)} onMouseLeave={() => setRowHovered(false)}>
        <LabelScrub value={value} onChange={() => {}} step={step} min={min} max={max} onAltClick={onReset} onClick={resetPopover.triggerOpen}>
          {computedProp && computedElement ? (
            <ComputedTooltip property={computedProp} element={computedElement}>
              {labelContent}
            </ComputedTooltip>
          ) : labelContent}
        </LabelScrub>
        <VariableField
          variableName={activeVariable}
          variableType={variableType ?? "length"}
          element={variableElement}
          onSelectVariable={(varExpr) => { onSelectVariable?.(varExpr); }}
          onUnlink={handleUnlink}
        />
      </div>
      {resetPopover.node}
      </>
    );
  }

  // Numeric mode (default): slider + input + unit + optional link icon
  return (
    <>
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }} onMouseEnter={() => setRowHovered(true)} onMouseLeave={() => setRowHovered(false)}>
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
      <div style={{ display: "flex", alignItems: "center", height: 28, borderRadius: 4, border: `1px solid ${border.default}`, background: surface.subtle, flexShrink: 0, position: "relative" }}>
        {onSelectVariable && (
          <VariableLinkDot
            rowHovered={rowHovered}
            variableType={variableType ?? "length"}
            element={variableElement}
            onSelect={(varExpr) => { onSelectVariable(varExpr); }}
            activeVariable={activeVariable}
          />
        )}
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
    </div>
    {property && <PresetChips property={property} onSelect={handlePresetSelect} unit={unit} />}
    {resetPopover.node}
    </>
  );
}
