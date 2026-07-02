/**
 * controls/helpers.tsx — Shared types, hooks, styles, and small utilities
 * used across all control components.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo, createContext } from "react";
import { type IndicatorType, indicatorStyle, altClickReset } from "../theme";
import { ResetPopover } from "./ResetPopover";
import { getIndicatorTitle, convertPresets } from "../panelUtils";
import { ms, cssTransition, easeRelease } from "../timing";
import { color, text, border, surface, font, layout, primaryAlpha, presets, presetBaseUnit, labelIndicator, zIndex } from "../theme";

// ─── Types ──────────────────────────────────────────────────────────

export type SpacingSide = 'top' | 'right' | 'bottom' | 'left';
export type SpacingProperty = `margin-${SpacingSide}` | `padding-${SpacingSide}`;
export type SpacingUnit = 'px' | '%' | 'em' | 'rem' | 'vw' | 'vh';

// ─── Value Flash Hook ───────────────────────────────────────────────

/** Brief background flash when a numeric value changes — confirms the change registered. */
export function useValueFlash(value: number) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(false), 200);
    }
    return () => clearTimeout(timer.current);
  }, [value]);

  return flash
    ? { backgroundColor: primaryAlpha(0.12), transform: "scale(1.02)", transition: `background-color ${ms("layout")}, transform ${ms("fast")} ${easeRelease}` }
    : { transition: `background-color ${ms("layout")}, transform ${ms("release")} ${easeRelease}` };
}

// ─── Helper ─────────────────────────────────────────────────────────

/** Double-click on a value input selects all text for quick replacement. */
export const selectAllOnDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
  e.currentTarget.select();
};

// ─── Shared styles ──────────────────────────────────────────────────

export const labelStyle = (indicator?: IndicatorType): React.CSSProperties => {
  const base: React.CSSProperties = {
    fontSize: 11,
    width: layout.labelWidth,
    flexShrink: 0,
    textTransform: "capitalize",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    cursor: "default",
    color: labelIndicator.none.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  return { ...base, ...indicatorStyle(indicator) };
};

export const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: layout.controlGap,
  padding: "2px 12px",
};

/** Absolute overlay for ColorRow action buttons — prevents layout shift on hover. */
export const actionsOverlayStyle: React.CSSProperties = {
  position: "absolute",
  left: 12,
  top: 0,
  bottom: 0,
  display: "flex",
  alignItems: "center",
  gap: 2,
  zIndex: zIndex.above,
  background: color.background,
};

// ─── Section Memory Context ─────────────────────────────────────────

interface SectionMemoryCtx {
  memory: Record<string, boolean>;
  update: (name: string, open: boolean) => void;
}

export const SectionMemoryContext = createContext<SectionMemoryCtx | null>(null);

export function SectionMemoryProvider({ memory, onUpdate, children }: {
  memory: Record<string, boolean>;
  onUpdate: (name: string, open: boolean) => void;
  children: React.ReactNode;
}) {
  const ctx = useMemo(() => ({ memory, update: onUpdate }), [memory, onUpdate]);
  return <SectionMemoryContext.Provider value={ctx}>{children}</SectionMemoryContext.Provider>;
}

// ─── Reset Popover Hook ─────────────────────────────────────────────

/** Trigger wiring returned by useResetPopover — spread onto the anchor span. */
export interface ResetTriggerProps {
  ref: React.RefObject<HTMLSpanElement | null>;
  onClick: (e: React.MouseEvent) => void;
  role?: "button";
  tabIndex?: number;
  "aria-haspopup"?: "dialog";
  "aria-label"?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/**
 * Shared hook for the click-on-modified-label reset popover.
 *
 * `triggerProps` centralizes the whole trigger contract (issue #85):
 * click opens the popover, Alt+click resets directly, and — while the
 * indicator is "modified" with an onReset — the anchor becomes a focusable
 * role="button" that opens the same popover on Enter/Space, labelled
 * "Reset <label>". Spread it onto the anchor instead of hand-wiring
 * ref + onClick at every site.
 */
export function useResetPopover(indicator?: IndicatorType, onReset?: () => void, label?: string) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const triggerOpen = useCallback(() => {
    if (indicator === "modified" && onReset) setOpen(true);
  }, [indicator, onReset]);
  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the trigger so keyboard users don't fall off the panel.
    anchorRef.current?.focus?.();
  }, []);
  const node = open && anchorRef.current && onReset ? (
    <ResetPopover anchor={anchorRef.current} onReset={onReset} onClose={close} />
  ) : null;

  const interactive = indicator === "modified" && !!onReset;
  const triggerProps: ResetTriggerProps = {
    ref: anchorRef,
    onClick: (e: React.MouseEvent) => {
      if (e.altKey && onReset) { e.stopPropagation(); onReset(); return; }
      triggerOpen();
    },
    ...(interactive
      ? {
          role: "button" as const,
          tabIndex: 0,
          "aria-haspopup": "dialog" as const,
          "aria-label": label ? `Reset ${label}` : "Reset",
          onKeyDown: (e: React.KeyboardEvent) => {
            // Ignore keystrokes bubbling from nested controls.
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              triggerOpen();
            }
          },
        }
      : {}),
  };

  return { anchorRef, triggerOpen, triggerProps, node };
}

// ─── Press Scale Hook ────────────────────────────────────────────────

/** Tactile press feedback — scale down on mouseDown, spring back on release.
 *  Spread `pressHandlers` onto the element and merge `pressStyle` into its style. */
export function usePressScale(scale = 0.97) {
  const [pressed, setPressed] = useState(false);

  const pressHandlers = useMemo(() => ({
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
  }), []);

  const pressStyle: React.CSSProperties = useMemo(() => ({
    transform: pressed ? `scale(${scale})` : undefined,
    transition: cssTransition("transform", pressed ? "fast" : "release"),
  }), [pressed, scale]);

  return { pressHandlers, pressStyle };
}

// ─── Animated List Item ──────────────────────────────────────────────

/** Wrapper for list editor items — entrance animation on mount (scale+fade). */
export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div style={{
      opacity: mounted ? 1 : 0,
      transform: mounted ? "scale(1)" : "scale(0.95)",
      transition: cssTransition(["opacity", "transform"], "expand"),
    }}>
      {children}
    </div>
  );
}

// ─── PresetChips ────────────────────────────────────────────────────

export function PresetChips({ property, onSelect, unit }: {
  property: string;
  onSelect: (value: string | number) => void;
  unit?: string;
}) {
  const raw = presets[property];
  if (!raw || raw.length === 0) return null;
  const base = presetBaseUnit[property];
  const values = (raw && base && unit && unit !== base)
    ? convertPresets(raw, base, unit)
    : raw;

  return (
    <div style={{ display: "flex", gap: 4, padding: "1px 12px 2px 82px" }}>
      {values.map((v) => (
        <button
          key={String(v)}
          onClick={() => onSelect(v)}
          style={{
            fontFamily: font.mono,
            fontSize: 10,
            color: text.label,
            background: "transparent",
            border: `1px solid ${border.default}`,
            borderRadius: 3,
            padding: "1px 6px",
            cursor: "pointer",
            lineHeight: "16px",
            transition: "transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.93)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = surface.hover;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.transform = "";
          }}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
