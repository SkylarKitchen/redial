/**
 * DragHandle.tsx — Grip icon for drag-to-reorder lists
 *
 * Visible on parent hover, brighter during drag.
 */

import { GripVertical } from "lucide-react";

export interface DragHandleProps {
  isDragging?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  style?: React.CSSProperties;
}

export function DragHandle({ isDragging, onPointerDown, style }: DragHandleProps) {
  return (
    <span
      onPointerDown={onPointerDown}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "16px",
        height: "16px",
        flexShrink: 0,
        opacity: isDragging ? 0.7 : 0,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        transition: "opacity 100ms",
        ...style,
      }}
      // Show on parent hover via CSS-in-JS workaround:
      // Parent should set `&:hover .drag-handle { opacity: 0.4 }` equivalent
      className="__tuner-drag-handle"
    >
      <GripVertical size={12} color="rgba(255,255,255,0.5)" />
    </span>
  );
}
