/**
 * SideSelector.tsx — icon group for selecting which border side to style
 *
 * Options: All, Top, Right, Bottom, Left
 * Each button renders a small 8x8 SVG icon with the relevant side highlighted.
 * Compact mode: small square icon buttons in a horizontal row (no tab bar).
 */

import { useCallback } from "react";
import { ms } from "./timing";
import { surface, border as borderToken } from "./theme";

export type Side = "all" | "top" | "right" | "bottom" | "left";

export interface SideSelectorProps {
  value: Side;
  onChange: (side: Side) => void;
  /** Compact mode: small square icons instead of full-width tab bar */
  compact?: boolean;
}

const SIDES: Side[] = ["all", "top", "right", "bottom", "left"];

function SideIcon({ side, active }: { side: Side; active: boolean }) {
  const thin = active ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.15)";
  const thick = "rgba(0,0,0,0.55)";
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

export function SideSelector({ value, onChange, compact }: SideSelectorProps) {
  const handleClick = useCallback(
    (side: Side) => () => onChange(side),
    [onChange]
  );

  if (compact) {
    return (
      <div style={{ display: "flex", gap: 2, padding: "2px 12px 4px" }}>
        {SIDES.map((side) => {
          const active = value === side;
          return (
            <button
              key={side}
              onClick={handleClick(side)}
              title={side.charAt(0).toUpperCase() + side.slice(1)}
              style={{
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                border: active ? `1px solid ${borderToken.hover}` : "1px solid transparent",
                borderRadius: 3,
                background: active ? surface.active : "transparent",
                cursor: "pointer",
                outline: "none",
                transition: `background ${ms("normal")}, border-color ${ms("normal")}`,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = surface.hover;
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = active
                  ? surface.active
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

  return (
    <div
      style={{
        display: "flex",
        height: "24px",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
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
              borderBottom: active ? "2px solid rgba(0,0,0,0.35)" : "2px solid transparent",
              background: active ? "rgba(0,0,0,0.06)" : "transparent",
              cursor: "pointer",
              outline: "none",
              transition: `background ${ms("normal")}`,
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = active
                ? "rgba(0,0,0,0.06)"
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
