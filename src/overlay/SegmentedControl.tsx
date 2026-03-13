/**
 * SegmentedControl.tsx — Webflow-style segmented button group
 *
 * A neutral gray container with rounded active states.
 * Supports both icon-only and text segments. Used for Display, Direction,
 * Align, Justify, and Children controls in the Layout section.
 */

import { useCallback } from "react";
import { segment, text, font } from "./theme";

// ─── Types ──────────────────────────────────────────────────────────

export interface SegmentOption {
  value: string;
  /** Icon element (16x16 SVG) — displayed instead of label when provided */
  icon?: React.ReactNode;
  /** Text label — displayed when no icon */
  label?: string;
  /** Tooltip title */
  title?: string;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  /** Fixed width per segment in px. If omitted, segments flex equally. */
  segmentWidth?: number;
  "aria-label"?: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function SegmentedControl({
  options,
  value,
  onChange,
  segmentWidth,
  "aria-label": ariaLabel,
}: SegmentedControlProps) {
  const handleClick = useCallback(
    (optValue: string) => onChange(optValue),
    [onChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        alignItems: "flex-start",
        flex: 1,
        minWidth: 0,
        background: segment.bg,
        borderRadius: segment.radius,
        padding: segment.padding,
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
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleClick(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const siblings = Array.from(
                  e.currentTarget.parentElement?.children ?? [],
                ) as HTMLElement[];
                const idx = siblings.indexOf(e.currentTarget);
                const next =
                  e.key === "ArrowRight"
                    ? siblings[(idx + 1) % siblings.length]
                    : siblings[(idx - 1 + siblings.length) % siblings.length];
                next.focus();
                const nextOpt = options[siblings.indexOf(next)];
                if (nextOpt != null) handleClick(nextOpt.value);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: segment.height,
              width: segmentWidth,
              flex: segmentWidth ? undefined : 1,
              padding: "3px 8px",
              borderRadius: segment.segmentRadius,
              border: "none",
              outline: "none",
              cursor: "pointer",
              overflow: "hidden",
              background: isActive ? segment.activeBg : "transparent",
              color: isActive ? text.primary : text.secondary,
              fontFamily: font.sans,
              fontSize: 11.5,
              letterSpacing: -0.115,
              fontWeight: 400,
              lineHeight: "16px",
              transition: "background 75ms ease",
              whiteSpace: "nowrap",
            }}
          >
            {opt.icon ?? opt.label}
          </button>
        );
      })}
    </div>
  );
}
