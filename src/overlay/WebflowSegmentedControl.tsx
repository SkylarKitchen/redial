/**
 * WebflowSegmentedControl.tsx — Flat segmented button group
 *
 * Neutral gray container, active segment is a flat darker background.
 * Used for overflow, box-sizing, and similar multi-option controls.
 */

import { useCallback } from "react";
import { text } from "./theme";

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

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        height: 24,
        background: "#F0F0F0",
        borderRadius: 4,
        padding: 1,
        overflow: "hidden",
      }}
    >
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
              height: 22,
              borderRadius: 3,
              border: "none",
              cursor: "pointer",
              padding: "0 8px",
              background: isActive ? "#E5E5E5" : "transparent",
              color: isActive ? text.primary : text.label,
              transition: "background 75ms, color 75ms",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px rgba(59,130,246,0.3)`;
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
                  fontFamily: "Inter, system-ui, sans-serif",
                  letterSpacing: "-0.115px",
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
