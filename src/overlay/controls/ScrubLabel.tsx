/**
 * ScrubLabel.tsx — Webflow-style draggable property label.
 *
 * Bundles the three pieces every numeric label needs into one component:
 *   1. LabelScrub  — click-and-drag-horizontally to scrub the value
 *   2. indicator   — the inheritance dot (blue = set here, etc.)
 *   3. resetPopover — click opens reset, alt+click resets immediately
 *
 * This is the same trio `BordersSection` and `NumberRow` assemble inline; it
 * exists so callers (e.g. TypographySection's TypoValueCell rows) get the
 * scrub interaction without re-wiring LabelScrub + useResetPopover by hand.
 *
 * Pass `indicator`/`onReset` for primary rows (Size, Height); omit them for
 * caption labels (advanced rows) that only need the drag interaction.
 */

import React from "react";
import { LabelScrub } from "./LabelScrub";
import { useResetPopover } from "./helpers";
import { indicatorStyle, type IndicatorType } from "../theme";

export interface ScrubLabelProps {
  children: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Inheritance indicator dot. Omit for captions that don't show one. */
  indicator?: IndicatorType;
  /** Reset handler: alt+click resets, plain click opens the reset popover. */
  onReset?: () => void;
  /** Style for the label text span (e.g. LABEL, LABEL_INLINE, HINT). */
  style?: React.CSSProperties;
  title?: string;
}

export function ScrubLabel({
  children,
  value,
  onChange,
  step,
  min,
  max,
  indicator,
  onReset,
  style,
  title,
}: ScrubLabelProps) {
  const resetPopover = useResetPopover(indicator, onReset);
  return (
    <>
      <LabelScrub
        value={value}
        onChange={onChange}
        step={step}
        min={min}
        max={max}
        onClick={onReset ? resetPopover.triggerOpen : undefined}
        onAltClick={onReset}
      >
        <span
          ref={resetPopover.anchorRef}
          title={title}
          style={{ ...style, cursor: "ew-resize" }}
        >
          {indicator ? (
            <span style={indicatorStyle(indicator)}>{children}</span>
          ) : (
            children
          )}
        </span>
      </LabelScrub>
      {resetPopover.node}
    </>
  );
}
