/**
 * DragHandle.tsx — Grip icon for drag-to-reorder lists
 *
 * Visible on parent hover, brighter during drag.
 */

import { GripVertical } from "lucide-react";
import { text } from "./theme";
import { ms } from "./timing";

export interface DragHandleProps {
  isDragging?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  style?: React.CSSProperties;
}

export function DragHandle({ isDragging, onPointerDown, style }: DragHandleProps) {
  return (
    <span
      onPointerDown={onPointerDown}
      className="__tuner-drag-handle"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        flexShrink: 0,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        opacity: isDragging ? 0.7 : 0,
        transition: `opacity ${ms("normal")}`,
        ...style,
      }}
    >
      <GripVertical size={12} color={text.label} />
    </span>
  );
}
