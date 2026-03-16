/**
 * WebflowSegmentedControl.tsx — Flat segmented button group
 *
 * Neutral gray container, active segment is a flat darker background.
 * Used for overflow, box-sizing, and similar multi-option controls.
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { text, font, segment, focusRing } from "../theme";
import { ms, cssTransition } from "../timing";

export interface SegmentOption {
  value: string;
  icon?: React.ReactNode;
  label?: string;
  title?: string;
}

export interface WebflowSegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
}

export function WebflowSegmentedControl({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
}: WebflowSegmentedControlProps) {
  const handleClick = useCallback(
    (optValue: string) => {
      onChange(optValue === value ? value : optValue);
    },
    [value, onChange],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorPos, setIndicatorPos] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const activeIdx = options.findIndex(o => o.value === value);
    if (activeIdx < 0) { setIndicatorPos(null); return; }
    const buttons = containerRef.current.querySelectorAll<HTMLElement>('[role="radio"]');
    const btn = buttons[activeIdx];
    if (!btn) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicatorPos({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
    });
  }, [value, options]);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        height: 24,
        background: segment.bg,
        borderRadius: segment.radius,
        padding: segment.padding,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {indicatorPos && (
        <div style={{
          position: "absolute",
          left: indicatorPos.left,
          top: segment.padding,
          width: indicatorPos.width,
          height: segment.height,
          borderRadius: segment.segmentRadius,
          background: segment.activeBg,
          transition: cssTransition(["left", "width"], "normal"),
          pointerEvents: "none" as const,
        }} />
      )}
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            aria-label={opt.title ?? opt.label ?? opt.value}
            title={opt.title ?? opt.label ?? opt.value}
            onClick={() => handleClick(opt.value)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: segment.height,
              borderRadius: segment.segmentRadius,
              border: "none",
              cursor: "pointer",
              padding: "0 8px",
              position: "relative" as const,
              zIndex: 1,
              background: "transparent",
              color: isActive ? text.primary : text.label,
              transition: `background ${ms("fast")}, color ${ms("fast")}`,
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = focusRing;
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            {opt.icon && (
              <span style={{ display: "flex", width: 16, height: 16, flexShrink: 0 }}>
                {opt.icon}
              </span>
            )}
            {opt.label && !opt.icon && (
              <span
                style={{
                  fontSize: 11.5,
                  fontFamily: font.sans,
                  letterSpacing: -0.115,
                  lineHeight: "16px",
                }}
              >
                {opt.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
