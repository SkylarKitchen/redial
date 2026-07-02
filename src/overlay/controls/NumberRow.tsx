/**
 * controls/NumberRow.tsx — Label + full-width number input + unit suffix.
 * Same width as SelectRow (no slider).
 */

import React from "react";
import { LabelScrub } from "./LabelScrub";
import { type IndicatorType } from "../theme";
import { getIndicatorTitle } from "../panelUtils";
import { ComputedTooltip } from "./ComputedTooltip";
import { text, border, surface } from "../theme";
import { labelStyle, rowStyle, useResetPopover } from "./helpers";
import { ValueInput } from "./ValueInput";

export function NumberRow({
  label,
  value,
  unit,
  onChange,
  onReset,
  indicator,
  onContextMenu,
  computedProp,
  computedElement,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  onReset?: () => void;
  indicator?: IndicatorType;
  onContextMenu?: (e: React.MouseEvent) => void;
  computedProp?: string;
  computedElement?: Element;
}) {
  const resetPopover = useResetPopover(indicator, onReset, label);
  const labelTitle = indicator ? getIndicatorTitle(indicator) : label;
  const labelContent = (
    // Keyboard-only trigger: mouse clicks flow through LabelScrub's onClick,
    // Enter/Space opens the reset popover directly (issue #85).
    <span {...resetPopover.triggerProps} onClick={undefined} title={labelTitle} style={labelStyle(indicator)}>
      {label}
    </span>
  );

  return (
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      <LabelScrub value={value} onChange={onChange} step={10} min={0} max={2000} onAltClick={onReset} onClick={resetPopover.triggerOpen}>
        {computedProp && computedElement ? (
          <ComputedTooltip property={computedProp} element={computedElement}>
            {labelContent}
          </ComputedTooltip>
        ) : labelContent}
      </LabelScrub>
      <div style={{ display: "flex", alignItems: "center", flex: 1, height: 28, borderRadius: 4, border: `1px solid ${border.default}`, background: surface.subtle }}>
        <ValueInput value={value} onChange={onChange} onAltClick={onReset} embedded />
        <div style={{ borderLeft: `1px solid ${border.default}`, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: text.label }}>{unit}</span>
        </div>
      </div>
      {resetPopover.node}
    </div>
  );
}
