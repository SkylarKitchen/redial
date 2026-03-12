/**
 * ComputedTooltip.tsx — Hover tooltip showing the computed CSS value
 *
 * Wraps any label element; on mouseenter (with 300ms delay) reads
 * getComputedStyle(element).getPropertyValue(property) and displays
 * a small tooltip above the label.
 */

import React, { useState, useRef, useCallback } from "react";

export interface ComputedTooltipProps {
  property: string;
  element: Element;
  /** The currently-displayed value so we can skip showing when identical */
  displayValue?: string;
  children: React.ReactNode;
}

export function ComputedTooltip({ property, element, displayValue, children }: ComputedTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [computedValue, setComputedValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      try {
        const val = getComputedStyle(element).getPropertyValue(property).trim();
        // Don't show if empty or matches what's already displayed
        if (!val || (displayValue && val === displayValue)) {
          return;
        }
        setComputedValue(val);
        setVisible(true);
      } catch {
        // Element may have been removed
      }
    }, 300);
  }, [element, property, displayValue]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <span
      ref={containerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      {children}
      {visible && computedValue && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#333",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "4px",
            padding: "3px 8px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.7)",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            whiteSpace: "nowrap",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          Computed: {computedValue}
        </span>
      )}
    </span>
  );
}
