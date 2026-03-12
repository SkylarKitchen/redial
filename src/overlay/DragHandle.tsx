/**
 * DragHandle.tsx — Grip icon for drag-to-reorder lists
 *
 * Visible on parent hover, brighter during drag.
 */

import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DragHandleProps {
  isDragging?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  style?: React.CSSProperties;
}

export function DragHandle({ isDragging, onPointerDown, style }: DragHandleProps) {
  return (
    <span
      onPointerDown={onPointerDown}
      className={cn(
        "inline-flex items-center justify-center w-4 h-4 shrink-0 cursor-grab touch-none transition-opacity __tuner-drag-handle",
        isDragging ? "opacity-70 cursor-grabbing" : "opacity-0",
      )}
      style={style}
    >
      <GripVertical size={12} color="rgba(0,0,0,0.45)" />
    </span>
  );
}
