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
import { useResetPopover } from "./helpers";

export function SubSectionHeader({ label, onAdd, onMenu, indicator, onReset }: {
  label: string;
  onAdd?: () => void;
  onMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  indicator?: IndicatorType;
  onReset?: () => void;
}) {
  const resetPopover = useResetPopover(indicator, onReset);
  return (
    <div style={SUB_HEADER_ROW}>
      <span
        ref={resetPopover.anchorRef}
        style={{ ...SUB_HEADER, display: "flex", alignItems: "center", gap: "4px", cursor: indicator === "modified" && onReset ? "pointer" : undefined }}
        onClick={(e) => { if (e.altKey && onReset) { e.stopPropagation(); onReset(); return; } resetPopover.triggerOpen(); }}
      >
        <span style={indicatorStyle(indicator)}>
          {label}
        </span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}
        onClick={(e) => e.stopPropagation()}>
        {onMenu && (
          <button
            onClick={onMenu}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "2px",
              color: text.disabled, display: "flex", alignItems: "center",
              borderRadius: "3px", transition: `color ${ms("fast")} ease`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = text.label; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = text.disabled; }}
          >
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>
        )}
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "2px",
              color: text.disabled, display: "flex", alignItems: "center",
              borderRadius: "3px", transition: `color ${ms("fast")} ease`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = text.label; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = text.disabled; }}
          >
            <Plus size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
      {resetPopover.node}
    </div>
  );
}
