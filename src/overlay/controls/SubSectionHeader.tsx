/**
 * controls/SubSectionHeader.tsx — Shared sub-section header with optional
 * indicator, reset, add, and menu buttons.
 */

import React from "react";
import { type IndicatorType, indicatorStyle } from "../theme";
import { ms } from "../timing";
import { text } from "../theme";
import { Plus, MoreHorizontal } from "lucide-react";
import { SUB_HEADER_ROW, SUB_HEADER } from "../panelStyles";
import { useResetPopover, usePressScale } from "./helpers";

export function SubSectionHeader({ label, onAdd, onMenu, indicator, onReset }: {
  label: string;
  onAdd?: () => void;
  onMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  indicator?: IndicatorType;
  onReset?: () => void;
}) {
  const resetPopover = useResetPopover(indicator, onReset, label);
  return (
    <div style={SUB_HEADER_ROW}>
      <span
        {...resetPopover.triggerProps}
        style={{ ...SUB_HEADER, display: "flex", alignItems: "center", gap: "4px", cursor: indicator === "modified" && onReset ? "pointer" : undefined }}
      >
        <span style={indicatorStyle(indicator)}>
          {label}
        </span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}
        onClick={(e) => e.stopPropagation()}>
        {onMenu && <SubHeaderButton onClick={onMenu}><MoreHorizontal size={14} strokeWidth={1.5} /></SubHeaderButton>}
        {onAdd && <SubHeaderButton onClick={onAdd}><Plus size={14} strokeWidth={1.5} /></SubHeaderButton>}
      </div>
      {resetPopover.node}
    </div>
  );
}

function SubHeaderButton({ onClick, children }: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode }) {
  const { pressHandlers, pressStyle } = usePressScale(0.93);
  return (
    <button
      onClick={onClick}
      onMouseDown={pressHandlers.onMouseDown}
      onMouseUp={pressHandlers.onMouseUp}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: "2px",
        color: text.disabled, display: "flex", alignItems: "center",
        borderRadius: "3px", transition: `color ${ms("fast")} ease`,
        ...pressStyle,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = text.label; }}
      onMouseLeave={(e) => { pressHandlers.onMouseLeave(); (e.currentTarget as HTMLElement).style.color = text.disabled; }}
    >
      {children}
    </button>
  );
}
