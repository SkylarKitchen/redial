/**
 * ResetPopover.tsx — Click-on-modified-label popover with Reset action
 *
 * Light-mode popover that appears below a modified (blue) property label.
 * Shows a clickable Reset row with the Option+Click shortcut hint.
 * Portal-rendered to document.body so it escapes panel overflow.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Undo2 } from "lucide-react";
import { color, text, surface, border, shadow, font, zIndex } from "../theme";
import { ms } from "../timing";
import { usePortalTarget } from "../hooks/usePortalTarget";
import { composedTarget } from "../core/shadowRoot";

export interface ResetPopoverProps {
  /** Element to position below */
  anchor: HTMLElement;
  /** Fire the property reset */
  onReset: () => void;
  /** Close the popover */
  onClose: () => void;
}

export function ResetPopover({ anchor, onReset, onClose }: ResetPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const portalTarget = usePortalTarget();

  // Position below anchor, clamped to viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ar = anchor.getBoundingClientRect();
    const mr = el.getBoundingClientRect();
    let top = ar.bottom + 4;
    let left = ar.left;
    if (left + mr.width > window.innerWidth - 8) left = window.innerWidth - mr.width - 8;
    if (top + mr.height > window.innerHeight - 8) top = ar.top - mr.height - 4;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchor]);

  // Click-outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = composedTarget(e);
      if (ref.current && target && !ref.current.contains(target)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  // Escape → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const handleReset = useCallback(() => { onReset(); onClose(); }, [onReset, onClose]);

  return createPortal(
    <div
      ref={ref}
      data-tuner-portal
      style={{
        position: "fixed",
        zIndex: zIndex.max,
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
        minWidth: 200,
        background: color.background,
        border: `1px solid ${border.default}`,
        borderRadius: 6,
        boxShadow: shadow.dropdown,
        padding: 4,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleReset}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleReset(); }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderRadius: 4,
          cursor: "pointer",
          outline: "none",
          background: hovered ? surface.hover : "transparent",
          transition: `background ${ms("fast")}`,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: text.primary }}>
          <Undo2 size={13} strokeWidth={2} />
          Reset
        </span>
        <span style={{ fontSize: 11, color: text.hint, fontFamily: font.sans }}>
          Option + click
        </span>
      </div>
    </div>,
    portalTarget,
  );
}
