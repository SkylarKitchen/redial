/**
 * controls/ValueInput.tsx — Numeric input with arrow key stepping,
 * math expression support, and scroll-to-adjust.
 */

import { useState, useRef } from "react";
import { evaluateMathExpr } from "../inputMath";
import { color, font } from "../theme";
import { useWheelAdjust } from "../hooks/useWheelAdjust";
import { useDraftNumber } from "../hooks/useDraftNumber";
import { selectAllOnDoubleClick, useValueFlash } from "./helpers";

export function ValueInput({ value, onChange, onAltClick, emptyKeyword, onKeywordCommit, embedded, step: stepProp }: {
  value: number;
  onChange: (v: number) => void;
  /** Called when alt+click is detected (resets value to default) */
  onAltClick?: () => void;
  /** When draft is empty on commit, apply this keyword instead of ignoring */
  emptyKeyword?: string;
  /** Called when the empty keyword is applied (e.g. "auto", "none") */
  onKeywordCommit?: (keyword: string) => void;
  /** When true, renders without own bg/border (for use inside styled containers) */
  embedded?: boolean;
  /** Base step for arrow key increments (default 1). Shift multiplies x10, Alt x0.1 */
  step?: number;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashStyle = useValueFlash(value);
  useWheelAdjust(inputRef, value, onChange);

  const base = stepProp ?? 1;
  const { draft, inputProps } = useDraftNumber({
    value,
    resync: !focused,
    step: base,
    shiftStep: base * 10,
    altStep: base * 0.1,
    round: 1,
    blurOnEnter: true,
    revertOnEscape: true,
    onCommit: (d) => {
      setFocused(false);
      if (d.trim() === "" && emptyKeyword && onKeywordCommit) {
        onKeywordCommit(emptyKeyword);
        return;
      }
      const mathResult = evaluateMathExpr(d, value);
      if (mathResult !== null) { onChange(mathResult); return; }
      const parsed = parseFloat(d);
      if (!isNaN(parsed)) onChange(parsed);
    },
    onStep: (next) => onChange(next),
    onEscape: () => {
      setFocused(false);
      inputRef.current?.blur();
    },
  });

  return (
    <input
      ref={inputRef}
      aria-label="Value"
      value={focused ? draft : String(value)}
      onChange={inputProps.onChange}
      onClick={(e) => { if (e.altKey && onAltClick) { e.preventDefault(); onAltClick(); } }}
      onFocus={() => setFocused(true)}
      onBlur={inputProps.onBlur}
      onKeyDown={(e) => {
        // Preserve the original's event isolation: Escape/arrows must not bubble
        // to panel-level hotkeys. The hook only calls preventDefault on arrows.
        if (e.key === "Escape" || e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.stopPropagation();
        }
        inputProps.onKeyDown(e);
      }}
      onDoubleClick={selectAllOnDoubleClick}
      className="tuner-focusable"
      style={{
        width: 0,
        minWidth: 40,
        flex: 1,
        height: 28,
        borderRadius: 2,
        padding: "0 6px",
        fontSize: 11,
        fontFamily: font.mono,
        outline: "none",
        textAlign: "right" as const,
        color: color.foreground,
        ...(embedded ? { backgroundColor: "transparent", border: "none" } : {
          backgroundColor: color.input,
          border: `1px solid ${color.border}`,
        }),
        // Last so the active flash's backgroundColor wins over the resting
        // background above (spread order is the cascade here).
        ...flashStyle,
      }}
    />
  );
}
