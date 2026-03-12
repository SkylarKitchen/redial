/**
 * WebflowSegmentedControl.tsx — Figma-faithful segmented button group
 *
 * Matches Webflow's design: light container with drop shadow, rounded corners,
 * active segment gets inset shadow + slightly lighter background.
 * Used for overflow, box-sizing, and similar multi-option controls.
 */

import { useCallback } from "react";
import { text, blackAlpha } from "./theme";

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

/** Inset shadow for the active/pressed segment — matches Figma's [Dark] Input inner shadow. */
const ACTIVE_INSET_SHADOW = [
  "inset 0px 1px 1px -1px rgba(0,0,0,0.13)",
  "inset 0px 3px 3px -3px rgba(0,0,0,0.17)",
  "inset 0px 4px 4px -4px rgba(0,0,0,0.17)",
  "inset 0px 8px 8px -8px rgba(0,0,0,0.17)",
  "inset 0px 12px 12px -12px rgba(0,0,0,0.13)",
  "inset 0px 16px 16px -16px rgba(0,0,0,0.13)",
].join(", ");

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
        height: 24,
        background: "#f3f3f0",
        borderRadius: 4,
        padding: 1,
        boxShadow: "0px 0.5px 1px 0px rgba(0,0,0,0.3)",
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
              position: "relative",
              background: isActive ? "#f0efec" : "transparent",
              color: isActive ? text.primary : text.label,
              transition: "background 75ms, color 75ms",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px rgba(217,119,87,0.3)`;
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = isActive ? "none" : "none";
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
            {/* Inset shadow overlay for active state */}
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "inherit",
                  boxShadow: ACTIVE_INSET_SHADOW,
                  pointerEvents: "none",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
