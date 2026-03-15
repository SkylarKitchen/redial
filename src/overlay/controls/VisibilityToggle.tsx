/**
 * controls/VisibilityToggle.tsx — Standardized Eye/EyeOff toggle for editor rows.
 */

import React from "react";
import { text } from "../theme";
import { Eye, EyeOff } from "lucide-react";

export function VisibilityToggle({ visible, onToggle, title }: {
  visible: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px",
        color: visible ? text.label : text.hint,
        flexShrink: 0,
      }}
      title={title ?? (visible ? "Hide layer" : "Show layer")}
    >
      {visible ? <Eye size={12} /> : <EyeOff size={12} />}
    </button>
  );
}
