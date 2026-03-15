/**
 * controls/TextRow.tsx — Simple text input row with label and reset support.
 */

import React from "react";
import { type IndicatorType } from "../theme";
import { color, font } from "../theme";
import { labelStyle, rowStyle, selectAllOnDoubleClick } from "./helpers";

export function TextRow({ label, value, placeholder, onChange, onReset, onContextMenu, computedProp, computedElement, indicator }: {
  label: string; value: string; placeholder?: string; onChange: (value: string) => void;
  /** Called on alt+click label to reset property */
  onReset?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  computedProp?: string;
  computedElement?: Element;
  indicator?: IndicatorType;
}) {
  return (
    <div style={rowStyle} onContextMenu={onContextMenu} onClick={(e) => { if (e.altKey && onReset) { e.preventDefault(); onReset(); } }}>
      <span
        onClick={(e) => { if (e.altKey && onReset) onReset(); }}
        title={label}
        style={labelStyle(indicator)}
      >
        {label}
      </span>
      <input
        type="text"
        className="tuner-focusable"
        style={{
          flex: 1,
          height: 24,
          borderRadius: 2,
          fontSize: 10,
          fontFamily: font.mono,
          padding: "0 6px",
          outline: "none",
          backgroundColor: color.input,
          border: `1px solid ${color.border}`,
          color: color.foreground,
        }}
        tabIndex={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onDoubleClick={selectAllOnDoubleClick}
      />
    </div>
  );
}
