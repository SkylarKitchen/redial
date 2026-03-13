/**
 * SideSelector.tsx — icon group for selecting which border side to style
 *
 * Options: All, Top, Right, Bottom, Left
 * Three layout modes:
 *   - default: horizontal tab bar
 *   - compact: small square icon buttons in a horizontal row
 *   - cross: Webflow-style cross/plus pattern (Top above, Left/All/Right middle, Bottom below)
 *
 * Full keyboard navigation (arrow keys + roving tabindex) and ARIA radiogroup semantics.
 * All colors use theme tokens — no hardcoded rgba strings.
 */

import React, { useCallback } from "react";
import { ms } from "./timing";
import { surface, border as borderToken, text, color, blackAlpha, focusRing } from "./theme";

export type Side = "all" | "top" | "right" | "bottom" | "left";

export interface SideSelectorProps {
  value: Side;
  onChange: (side: Side) => void;
  /** Compact mode: small square icons instead of full-width tab bar */
  compact?: boolean;
  /** Cross mode: Webflow-style cross/plus pattern layout */
  cross?: boolean;
}

const SIDES: Side[] = ["all", "top", "right", "bottom", "left"];

// ─── Spatial arrow-key mapping for cross mode ──────────────────────

const CROSS_NAV: Record<Side, Partial<Record<string, Side>>> = {
  all: { ArrowUp: "top", ArrowDown: "bottom", ArrowLeft: "left", ArrowRight: "right" },
  top: { ArrowDown: "all", ArrowLeft: "left", ArrowRight: "right" },
  bottom: { ArrowUp: "all", ArrowLeft: "left", ArrowRight: "right" },
  left: { ArrowRight: "all", ArrowUp: "top", ArrowDown: "bottom" },
  right: { ArrowLeft: "all", ArrowUp: "top", ArrowDown: "bottom" },
};

/** Linear arrow-key navigation for tab/compact modes */
function linearNextSide(current: Side, key: string): Side | null {
  const idx = SIDES.indexOf(current);
  if (key === "ArrowRight" || key === "ArrowDown") return SIDES[(idx + 1) % SIDES.length];
  if (key === "ArrowLeft" || key === "ArrowUp") return SIDES[(idx - 1 + SIDES.length) % SIDES.length];
  return null;
}

// ─── 8×8 line-based icons (compact/tab modes) ────────────────────────

function SideIcon({ side, active }: { side: Side; active: boolean }) {
  const thin = active ? blackAlpha(0.25) : blackAlpha(0.15);
  const thick = blackAlpha(0.55);
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
      <line x1="0" y1="0.5" x2="8" y2="0.5" stroke={top} strokeWidth={topW} />
      <line x1="7.5" y1="0" x2="7.5" y2="8" stroke={right_} strokeWidth={rightW} />
      <line x1="0" y1="7.5" x2="8" y2="7.5" stroke={bottom} strokeWidth={bottomW} />
      <line x1="0.5" y1="0" x2="0.5" y2="8" stroke={left} strokeWidth={leftW} />
    </svg>
  );
}

// ─── 16×16 Webflow-style border icons (cross mode) ───────────────────

function BorderAllIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
      <path fillRule="evenodd" clipRule="evenodd" d="M2 3C2 2.44772 2.44772 2 3 2H13C13.5523 2 14 2.44772 14 3V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V3ZM13 3L3 3V13H13V3Z" fill="currentColor" />
    </svg>
  );
}

function BorderTopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
      <path opacity="0.4" fillRule="evenodd" clipRule="evenodd" d="M2 13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V5H13V13H3V5H2V13Z" fill="currentColor" />
      <path d="M13.5 2.5V1.5H2.5V2.5H13.5Z" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

function BorderRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
      <path opacity="0.4" fillRule="evenodd" clipRule="evenodd" d="M3 2C2.44772 2 2 2.44772 2 3L2 13C2 13.5523 2.44772 14 3 14L11 14L11 13L3 13L3 3L11 3L11 2L3 2Z" fill="currentColor" />
      <path d="M13.5 13.5L14.5 13.5L14.5 2.5L13.5 2.5L13.5 13.5Z" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

function BorderBottomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
      <path opacity="0.4" fillRule="evenodd" clipRule="evenodd" d="M2 3C2 2.44772 2.44772 2 3 2H13C13.5523 2 14 2.44772 14 3V11H13V3H3V11H2V3Z" fill="currentColor" />
      <path d="M13.5 13.5V14.5H2.5V13.5H13.5Z" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

function BorderLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
      <path opacity="0.4" fillRule="evenodd" clipRule="evenodd" d="M13 2C13.5523 2 14 2.44772 14 3L14 13C14 13.5523 13.5523 14 13 14L5 14L5 13L13 13L13 3L5 3L5 2L13 2Z" fill="currentColor" />
      <path d="M2.5 13.5L1.5 13.5L1.5 2.5L2.5 2.5L2.5 13.5Z" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

const CROSS_ICONS: Record<Side, () => React.ReactElement> = {
  all: BorderAllIcon,
  top: BorderTopIcon,
  right: BorderRightIcon,
  bottom: BorderBottomIcon,
  left: BorderLeftIcon,
};

// ─── Cross-pattern side selector (Webflow style) ─────────────────────

function CrossSideSelector({ value, onChange }: { value: Side; onChange: (side: Side) => void }) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentSide: Side) => {
      const nextSide = CROSS_NAV[currentSide]?.[e.key];
      if (nextSide) {
        e.preventDefault();
        onChange(nextSide);
        requestAnimationFrame(() => {
          const container = (e.currentTarget as HTMLElement).parentElement;
          const btn = container?.querySelector(`[data-side="${nextSide}"]`) as HTMLElement;
          btn?.focus();
        });
      }
    },
    [onChange]
  );

  const btn = (side: Side, gridArea: string) => {
    const active = value === side;
    const Icon = CROSS_ICONS[side];
    return (
      <button
        key={side}
        data-side={side}
        role="radio"
        aria-checked={active}
        aria-label={side.charAt(0).toUpperCase() + side.slice(1)}
        tabIndex={active ? 0 : -1}
        onClick={() => onChange(side)}
        onKeyDown={(e) => handleKeyDown(e, side)}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = focusRing;
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "none";
        }}
        title={side.charAt(0).toUpperCase() + side.slice(1)}
        style={{
          gridArea,
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          outline: "none",
          color: active ? color.foreground : text.disabled,
          background: active ? surface.active : "transparent",
          transition: `background ${ms("fast")}, color ${ms("fast")}`,
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = surface.hover;
            e.currentTarget.style.color = text.secondary;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = active ? surface.active : "transparent";
          e.currentTarget.style.color = active ? color.foreground : text.disabled;
        }}
      >
        <Icon />
      </button>
    );
  };

  return (
    <div
      role="radiogroup"
      aria-label="Border side"
      style={{
        display: "grid",
        gridTemplateAreas: `". top ." "left all right" ". bottom ."`,
        gridTemplateColumns: "24px 24px 24px",
        gridTemplateRows: "24px 24px 24px",
        gap: 4,
        justifyItems: "center",
        alignItems: "center",
      }}
    >
      {btn("top", "top")}
      {btn("left", "left")}
      {btn("all", "all")}
      {btn("right", "right")}
      {btn("bottom", "bottom")}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────

export function SideSelector({ value, onChange, compact, cross }: SideSelectorProps) {
  const handleClick = useCallback(
    (side: Side) => () => onChange(side),
    [onChange]
  );

  const handleLinearKeyDown = useCallback(
    (e: React.KeyboardEvent, currentSide: Side) => {
      const nextSide = linearNextSide(currentSide, e.key);
      if (nextSide) {
        e.preventDefault();
        onChange(nextSide);
        requestAnimationFrame(() => {
          const container = (e.currentTarget as HTMLElement).parentElement;
          const btn = container?.querySelector(`[data-side="${nextSide}"]`) as HTMLElement;
          btn?.focus();
        });
      }
    },
    [onChange]
  );

  if (cross) {
    return <CrossSideSelector value={value} onChange={onChange} />;
  }

  if (compact) {
    return (
      <div role="radiogroup" aria-label="Border side" style={{ display: "flex", gap: 2, padding: "2px 12px 4px" }}>
        {SIDES.map((side) => {
          const active = value === side;
          return (
            <button
              key={side}
              data-side={side}
              role="radio"
              aria-checked={active}
              aria-label={side.charAt(0).toUpperCase() + side.slice(1)}
              tabIndex={active ? 0 : -1}
              onClick={handleClick(side)}
              onKeyDown={(e) => handleLinearKeyDown(e, side)}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = focusRing;
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
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
      role="radiogroup"
      aria-label="Border side"
      style={{
        display: "flex",
        height: "24px",
        borderBottom: `1px solid ${borderToken.subtle}`,
      }}
    >
      {SIDES.map((side) => {
        const active = value === side;
        return (
          <button
            key={side}
            data-side={side}
            role="radio"
            aria-checked={active}
            aria-label={side.charAt(0).toUpperCase() + side.slice(1)}
            tabIndex={active ? 0 : -1}
            onClick={handleClick(side)}
            onKeyDown={(e) => handleLinearKeyDown(e, side)}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = focusRing;
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            title={side.charAt(0).toUpperCase() + side.slice(1)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "24px",
              padding: 0,
              border: "none",
              borderBottom: active ? `2px solid ${blackAlpha(0.35)}` : "2px solid transparent",
              background: active ? borderToken.subtle : "transparent",
              cursor: "pointer",
              outline: "none",
              transition: `background ${ms("normal")}`,
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = color.input;
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = active
                ? borderToken.subtle
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
