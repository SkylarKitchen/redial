/**
 * controls/VisibilityToggle.tsx — Standardized Eye/EyeOff toggle for editor rows.
 */

import React from "react";
import { text } from "../theme";
import { Eye, EyeOff } from "lucide-react";
import { usePressScale } from "./helpers";
import { ms } from "../timing";

export function VisibilityToggle({ visible, onToggle, title }: {
  visible: boolean;
  onToggle: () => void;
  title?: string;
}) {
  const { pressHandlers, pressStyle } = usePressScale(0.93);
  // pressStyle carries its own `transition` (transform spring). Spread it first
  // for the press `transform`, then merge both transitions so the opacity fade
  // survives instead of being clobbered by the later spread.
  const { transition: pressTransition, ...pressRest } = pressStyle;
  return (
    <button
      onClick={onToggle}
      {...pressHandlers}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px",
        color: visible ? text.label : text.hint,
        flexShrink: 0,
        ...pressRest,
        transition: `opacity ${ms("fast")}, ${pressTransition}`,
      }}
      title={title ?? (visible ? "Hide layer" : "Show layer")}
    >
      {visible ? <Eye size={12} /> : <EyeOff size={12} />}
    </button>
  );
}
