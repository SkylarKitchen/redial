/**
 * shell/Modal.tsx — Portaled, focus-trapped modal (no shadcn/Radix).
 *
 * Drop-in replacement for the Radix `Dialog` the overlay used in ShortcutsHelp
 * and CommandPalette. It reproduces the accessibility machinery the Dialog gave
 * us for free:
 *   - portals to <body> with the portal contract the panel requires
 *     (data-tuner-portal + zIndex.max + the __tuner-root class so the panel's
 *     global scrollbar/range styles apply) — see feedback_portal_* memories
 *   - role="dialog" + aria-modal + a label
 *   - Esc to close, backdrop-click to close
 *   - a focus trap: focus moves into the modal on open, Tab/Shift+Tab cycle
 *     within it, and focus is restored to the previously-focused element on close
 *
 * Rendering, content, and any in-modal keyboard handling stay with the caller.
 */

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { color, border, blackAlpha, zIndex } from "../theme";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Max content width in px. */
  maxWidth?: number;
  /** Accessible name for the dialog (use when there's no visible title element). */
  ariaLabel?: string;
  /** id of a visible element that titles the dialog (alternative to ariaLabel). */
  labelledBy?: string;
  /** Style overrides merged onto the content container. */
  contentStyle?: React.CSSProperties;
  /** Clicking the backdrop closes the modal (default true). */
  closeOnBackdrop?: boolean;
}

export function Modal({
  onClose,
  children,
  maxWidth = 400,
  ariaLabel,
  labelledBy,
  contentStyle,
  closeOnBackdrop = true,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Move focus into the modal on open; restore it on close.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const content = contentRef.current;
    if (content) {
      const first = content.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? content).focus();
    }
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const content = contentRef.current;
    if (!content) return;
    const focusable = Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
      // Nothing focusable but the container — keep focus inside.
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === content)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="__tuner-root"
      data-tuner-portal
      data-tuner-modal
      onMouseDown={(e) => {
        // Only the backdrop itself (not bubbled content clicks) closes.
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: zIndex.max,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        background: blackAlpha(0.4),
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          outline: "none",
          width: "100%",
          maxWidth,
          maxHeight: "80vh",
          overflowY: "auto",
          background: color.background,
          border: `1px solid ${border.default}`,
          borderRadius: 8,
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
