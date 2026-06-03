/**
 * controls/Slider.tsx — Inline range slider (no shadcn/Radix).
 *
 * Drop-in replacement for the former `@/components/ui/slider` (Radix) Slider:
 * it keeps the same array-based value API (`value={[n]}` /
 * `onValueChange={([v]) => ...}`) so the call sites (SliderRow, BordersSection,
 * TransformEditor) only had to change their import, not their JSX.
 *
 * Internally it's a native `<input type="range">` — the exact pattern the rest
 * of the panel already uses (FilterSliders, GradientEditor, TransitionEditor…).
 * All visuals (track, thumb, hover/active) come from the global
 * `.__tuner-root input[type="range"]` rules in OverlayStyles.tsx, so it matches
 * every other slider in the panel automatically.
 */

import React from "react";

export interface SliderProps {
  /** Single-thumb value, wrapped in an array to mirror the old Radix API. */
  value: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  onPointerDown?: React.PointerEventHandler<HTMLInputElement>;
  onPointerUp?: React.PointerEventHandler<HTMLInputElement>;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
  style,
  onPointerDown,
  onPointerUp,
  "aria-label": ariaLabel,
}: SliderProps) {
  return (
    <input
      type="range"
      className={className}
      // width:100% matches the old Radix `w-full`; callers' `flex: 1` still wins
      // for sizing inside the flex rows, so layout is unchanged.
      style={{ width: "100%", ...style }}
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value[0] ?? 0}
      disabled={disabled}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    />
  );
}
