/**
 * Tooltip.tsx — Lightweight fixed-position tooltip for computed value display
 */

import { useState, useRef, useCallback } from "react";

interface TooltipProps {
  text: string;
  x: number;
  y: number;
  visible: boolean;
}

export function Tooltip({ text, x, y, visible }: TooltipProps) {
  if (!visible || !text) return null;

  return (
    <div style={{
      position: "fixed",
      left: x,
      top: y - 28,
      zIndex: 2147483647,
      background: "rgba(0,0,0,0.9)",
      color: "#fff",
      fontSize: "10px",
      fontFamily: "ui-monospace, 'SF Mono', monospace",
      padding: "3px 8px",
      borderRadius: "4px",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      maxWidth: "280px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    }}>
      {text}
    </div>
  );
}

/**
 * useTooltip — Hook for 300ms delayed hover tooltips.
 * Returns props to spread on the target element + the Tooltip render props.
 */
export function useTooltip(text: string | undefined) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!text) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left, y: rect.top });
    timerRef.current = setTimeout(() => setVisible(true), 300);
  }, [text]);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return {
    /** Spread these on the target element */
    triggerProps: { onMouseEnter, onMouseLeave },
    /** Pass these to <Tooltip /> */
    tooltipProps: { text: text ?? '', x: pos.x, y: pos.y, visible: visible && !!text },
  };
}
