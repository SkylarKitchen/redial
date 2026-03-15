/**
 * controls/ValueInput.tsx — Numeric input with arrow key stepping,
 * math expression support, and scroll-to-adjust.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { evaluateMathExpr } from "../inputMath";
import { color, font } from "../theme";
import { useWheelAdjust } from "../hooks/useWheelAdjust";
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
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashStyle = useValueFlash(value);
  useWheelAdjust(inputRef, value, onChange);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    if (draft.trim() === '' && emptyKeyword && onKeywordCommit) {
      onKeywordCommit(emptyKeyword);
      return;
    }
    const mathResult = evaluateMathExpr(draft, value);
    if (mathResult !== null) { onChange(mathResult); return; }
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(parsed);
  }, [draft, value, onChange, emptyKeyword, onKeywordCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        setDraft(String(value));
        setFocused(false);
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        const base = stepProp ?? 1;
        const inc = e.altKey ? base * 0.1 : e.shiftKey ? base * 10 : base;
        onChange(Math.round((value + inc) * 10) / 10);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const base = stepProp ?? 1;
        const inc = e.altKey ? base * 0.1 : e.shiftKey ? base * 10 : base;
        onChange(Math.round((value - inc) * 10) / 10);
      }
    },
    [commit, value, onChange, stepProp]
  );

  return (
    <input
      ref={inputRef}
      aria-label="Value"
      value={focused ? draft : String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => { if (e.altKey && onAltClick) { e.preventDefault(); onAltClick(); } }}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onDoubleClick={selectAllOnDoubleClick}
      className="tuner-focusable"
      style={{
        ...flashStyle,
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
      }}
    />
  );
}
