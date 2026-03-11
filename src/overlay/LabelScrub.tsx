/**
 * LabelScrub.tsx — Draggable label for scrubbing numeric values
 *
 * Webflow-style interaction: click and drag horizontally on a label
 * to adjust a numeric value. Shift = 10x, Alt = 0.1x.
 */

import { useRef, useCallback, useEffect, useState } from "react";

export interface LabelScrubProps {
  children: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export function LabelScrub({ children, value, onChange, step = 1, min, max }: LabelScrubProps) {
  const [scrubbing, setScrubbing] = useState(false);
  const startXRef = useRef(0);
  const startValueRef = useRef(0);
  const latestRef = useRef(value);
  latestRef.current = value;

  const clamp = useCallback(
    (v: number) => {
      let clamped = v;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only primary button
      if (e.button !== 0) return;
      e.preventDefault();

      startXRef.current = e.clientX;
      startValueRef.current = latestRef.current;
      setScrubbing(true);
    },
    []
  );

  // Attach global move/up listeners while scrubbing
  useEffect(() => {
    if (!scrubbing) return;

    function handleMove(e: MouseEvent) {
      const dx = e.clientX - startXRef.current;
      let multiplier = 1;
      if (e.shiftKey) multiplier = 10;
      else if (e.altKey) multiplier = 0.1;

      const delta = dx * step * multiplier;
      const raw = startValueRef.current + delta;
      // Round to avoid floating-point noise
      const precision = multiplier < 1 ? 2 : 0;
      const rounded = parseFloat(raw.toFixed(precision));
      onChange(clamp(rounded));
    }

    function handleUp() {
      setScrubbing(false);
    }

    // Prevent text selection during drag
    const prevSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [scrubbing, step, clamp, onChange]);

  return (
    <span
      onMouseDown={handleMouseDown}
      style={{
        cursor: "ew-resize",
        userSelect: "none",
        color: scrubbing ? "#6366f1" : "rgba(255,255,255,0.5)",
        fontSize: "11px",
        fontFamily: "system-ui, sans-serif",
        lineHeight: "20px",
        transition: scrubbing ? "none" : "color 100ms",
      }}
    >
      {children}
    </span>
  );
}
