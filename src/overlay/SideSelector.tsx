/**
 * SideSelector.tsx — tab bar for selecting which border side to style
 *
 * Tabs: All, Top, Right, Bottom, Left
 * Each tab renders a small 8x8 SVG icon with the relevant side highlighted.
 */

import { useCallback } from "react";
import { ms } from "./timing";

type Side = "all" | "top" | "right" | "bottom" | "left";

export interface SideSelectorProps {
  value: Side;
  onChange: (side: Side) => void;
}

const SIDES: Side[] = ["all", "top", "right", "bottom", "left"];

function SideIcon({ side, active }: { side: Side; active: boolean }) {
  const thin = active ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.2)";
  const thick = "#6366f1";
  const strokeWidth = 1;
  const thickWidth = 2;

  const top = side === "all" || side === "top" ? thick : thin;
  const right_ = side === "all" || side === "right" ? thick : thin;
  const bottom = side === "all" || side === "bottom" ? thick : thin;
  const left = side === "all" || side === "left" ? thick : thin;

  const topW = side === "all" || side === "top" ? thickWidth : strokeWidth;
  const rightW = side === "all" || side === "right" ? thickWidth : strokeWidth;
  const bottomW = side === "all" || side === "bottom" ? thickWidth : strokeWidth;
  const leftW = side === "all" || side === "left" ? thickWidth : strokeWidth;

  return (
    <svg width="8" height="8" viewBox="0 0 8 8" style={{ display: "block" }}>
      {/* Top */}
      <line x1="0" y1="0.5" x2="8" y2="0.5" stroke={top} strokeWidth={topW} />
      {/* Right */}
      <line x1="7.5" y1="0" x2="7.5" y2="8" stroke={right_} strokeWidth={rightW} />
      {/* Bottom */}
      <line x1="0" y1="7.5" x2="8" y2="7.5" stroke={bottom} strokeWidth={bottomW} />
      {/* Left */}
      <line x1="0.5" y1="0" x2="0.5" y2="8" stroke={left} strokeWidth={leftW} />
    </svg>
  );
}

export function SideSelector({ value, onChange }: SideSelectorProps) {
  const handleClick = useCallback(
    (side: Side) => () => onChange(side),
    [onChange]
  );

  return (
    <div
      style={{
        display: "flex",
        height: "24px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {SIDES.map((side) => {
        const active = value === side;
        return (
          <button
            key={side}
            onClick={handleClick(side)}
            title={side.charAt(0).toUpperCase() + side.slice(1)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "24px",
              padding: 0,
              border: "none",
              borderBottom: active ? "2px solid #6366f1" : "2px solid transparent",
              background: active ? "rgba(99,102,241,0.15)" : "transparent",
              cursor: "pointer",
              outline: "none",
              transition: `background ${ms("normal")}`,
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = active
                ? "rgba(99,102,241,0.15)"
                : "transparent";
            }}
          >
            <SideIcon side={side} active={active} />
          </button>
        );
      })}
    </div>
  );
}
