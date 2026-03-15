/**
 * controls/EditorRemoveButton.tsx — Standardized 14x14 remove button
 * for editor rows (transforms, shadows, filters, transitions).
 */

import React from "react";
import { text, surface } from "../theme";
import { X } from "lucide-react";

export function EditorRemoveButton({ onClick, title }: { onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "14px",
        height: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        color: text.disabled,
        cursor: "pointer",
        padding: 0,
        borderRadius: "2px",
        flexShrink: 0,
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = surface.hover;
        (e.currentTarget as HTMLElement).style.color = text.label;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = text.disabled;
      }}
    >
      <X size={11} strokeWidth={2} />
    </button>
  );
}
