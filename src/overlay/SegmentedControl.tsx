/**
 * SegmentedControl.tsx — Webflow-style segmented button group
 *
 * A neutral gray container with rounded active states.
 * Supports both icon-only and text segments. Used for Display, Direction,
 * Align, Justify, and Children controls in the Layout section.
 */

import { useCallback } from "react";

// ─── Tokens (matching Figma: Webflow ButtonGroup) ───────────────────

const tokens = {
  /** Container background */
  bg: "#F0F0F0",
  /** Active segment background */
  activeBg: "#E5E5E5",
  /** Default hover background */
  hoverBg: "#EBEBEB",
  /** Container border radius */
  radius: 4,
  /** Segment border radius (inside container) */
  segmentRadius: 3,
  /** Container padding — creates the border effect */
  padding: 1,
  /** Segment height */
  segmentHeight: 22,
  /** Text color for active segment */
  activeText: "#131313",
  /** Text color for inactive segment */
  inactiveText: "#404040",
  /** Font */
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 11.5,
  letterSpacing: -0.115,
} as const;

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
        background: tokens.bg,
        borderRadius: tokens.radius,
        padding: tokens.padding,
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
              height: tokens.segmentHeight,
              width: segmentWidth,
              flex: segmentWidth ? undefined : 1,
              padding: "3px 8px",
              borderRadius: tokens.segmentRadius,
              border: "none",
              outline: "none",
              cursor: "pointer",
              overflow: "hidden",
              background: isActive ? tokens.activeBg : "transparent",
              color: isActive ? tokens.activeText : tokens.inactiveText,
              fontFamily: tokens.fontFamily,
              fontSize: tokens.fontSize,
              letterSpacing: tokens.letterSpacing,
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
