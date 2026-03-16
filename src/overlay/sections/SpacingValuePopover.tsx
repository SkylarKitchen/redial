/**
 * SpacingValuePopover.tsx — Webflow-style floating panel for editing spacing values
 *
 * Opens on click of a margin/padding value in SpacingBoxModel.
 * Contains: direction indicator, value input, horizontal slider,
 * unit selector, and 2×4 preset button grid.
 *
 * Rendered via portal to escape panel overflow/z-index constraints.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { selectAllOnDoubleClick } from "../controls";
import { VariableLinkDot } from "../controls/VariableLinkDot";
import { ms } from "../timing";
import { text, color, font, border, surface, shadow, blackAlpha, primaryAlpha, zIndex } from "../theme";

// 8px grid spacing presets
const PRESETS = [0, 8, 16, 32, 48, 64, 96, 128];

// Direction arrows for each side
const SIDE_ICONS: Record<string, string> = {
  top: "↓",
  right: "←",
  bottom: "↑",
  left: "→",
};

// Estimated popover height for vertical clamping
const POPOVER_HEIGHT = 110;

export interface SpacingValuePopoverProps {
  value: number;
  onChange: (value: number) => void;
  unit: string;
  units: string[];
  onUnitChange: (unit: string) => void;
  /** Full property name: "margin-top", "padding-left", etc. */
  property: string;
  isMargin: boolean;
  /** Rect of the clicked value element, for positioning */
  anchorRect: DOMRect;
  onClose: () => void;
  /** True when the element uses Tailwind utility classes */
  isTailwind?: boolean;
  /** Target element for variable discovery */
  element?: Element;
  /** Currently linked variable name (e.g. "--space-4") or null */
  activeVariable?: string | null;
  /** Called when user selects a variable — receives "var(--name)" */
  onSelectVariable?: (varExpr: string) => void;
  /** Called when user unlinks the variable */
  onUnlink?: () => void;
}

export function SpacingValuePopover({
  value,
  onChange,
  unit,
  units,
  onUnitChange,
  property,
  isMargin,
  anchorRect,
  onClose,
  isTailwind = false,
  element,
  activeVariable,
  onSelectVariable,
  onUnlink,
}: SpacingValuePopoverProps) {
  const isLinked = !!activeVariable;
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));
  const [unitOpen, setUnitOpen] = useState(false);

  // Stable ref for onClose to avoid re-registering global listeners on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Slider range
  const sliderMin = isMargin ? -200 : 0;
  const sliderMax = 220;

  // Extract the side (top/right/bottom/left) from property
  const side = property.split("-").pop() || "top";
  const icon = SIDE_ICONS[side] || "↓";

  // Sync draft when external value changes
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  // Focus input on open
  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  }, []);

  // Close on Escape (uses ref, so no dependency churn)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  // Close on click outside (uses ref, so no dependency churn)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    // Use timeout so the opening click doesn't immediately close
    const id = setTimeout(() => {
      document.addEventListener("mousedown", handler, true);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler, true);
    };
  }, []);

  const commitInput = useCallback(() => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      const clamped = isMargin ? parsed : Math.max(0, parsed);
      onChange(clamped);
    }
  }, [draft, onChange, isMargin]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitInput();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const base = isTailwind ? 4 : 1;
        const step = e.shiftKey ? base * 10 : e.altKey ? base * 0.1 : base;
        const next = Math.round((value + step) * 10) / 10;
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const base = isTailwind ? 4 : 1;
        const step = e.shiftKey ? base * 10 : e.altKey ? base * 0.1 : base;
        const next = Math.round((value - step) * 10) / 10;
        const clamped = isMargin ? next : Math.max(0, next);
        onChange(clamped);
      }
    },
    [commitInput, value, onChange, isMargin],
  );

  // --- Positioning: below anchor, centered, clamped to viewport ---
  const popoverWidth = 240;
  const left = Math.max(
    8,
    Math.min(
      anchorRect.left + anchorRect.width / 2 - popoverWidth / 2,
      window.innerWidth - popoverWidth - 8,
    ),
  );
  // Vertical: prefer below, flip above if not enough space
  const spaceBelow = window.innerHeight - anchorRect.bottom - 8;
  const top =
    spaceBelow >= POPOVER_HEIGHT
      ? anchorRect.bottom + 6
      : anchorRect.top - POPOVER_HEIGHT - 6;

  // Slider percentage for track fill
  const sliderPct = ((value - sliderMin) / (sliderMax - sliderMin)) * 100;

  return createPortal(
    <div
      ref={popoverRef}
      data-tuner-portal
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
        background: color.popover,
        border: `1px solid ${border.default}`,
        borderRadius: "6px",
        boxShadow: shadow.dropdown,
        zIndex: zIndex.max,
        padding: "8px",
        fontFamily: font.sans,
      }}
    >
      {/* Scoped slider thumb styles (pseudo-elements can't be inline-styled) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .spacing-popover-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: ${color.primary};
          border: 2px solid #fff;
          cursor: pointer;
          margin-top: -4.5px;
        }
        .spacing-popover-slider::-moz-range-thumb {
          width: 12px; height: 12px;
          border-radius: 50%;
          background: ${color.primary};
          border: 2px solid #fff;
          cursor: pointer;
        }
      `,
        }}
      />

      {/* Top row: linked variable pill OR icon+input+slider+unit */}
      {isLinked ? (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
          <div style={{
            flex: 1, height: 24, display: "flex", alignItems: "center", padding: "0 8px",
            background: `${color.variable}1a`, borderRadius: 4,
            border: `1px solid ${color.variable}4d`,
          }}>
            <span style={{
              fontSize: 11, fontFamily: font.mono, color: color.variable,
              fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {activeVariable!.replace(/^--/, "")}
            </span>
          </div>
          {onSelectVariable && (
            <VariableLinkDot
              rowHovered={true}
              isLinked={true}
              onUnlink={onUnlink}
              variableType="length"
              element={element}
              onSelect={(varExpr) => onSelectVariable?.(varExpr)}
              activeVariable={activeVariable}
              inline
            />
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
          {/* Direction indicator */}
          <div
            style={{
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: surface.hover,
              borderRadius: "3px",
              fontSize: "12px",
              color: text.secondary,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>

          {/* Value input */}
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => {
              commitInput();
              (e.currentTarget as HTMLElement).style.borderColor = border.default;
            }}
            onKeyDown={handleInputKeyDown}
            onDoubleClick={selectAllOnDoubleClick}
            style={{
              width: "36px",
              height: "24px",
              background: surface.hover,
              border: `1px solid ${border.default}`,
              borderRadius: "3px",
              color: text.secondary,
              fontSize: "11px",
              fontFamily: font.mono,
              textAlign: "center",
              padding: "0 2px",
              outline: "none",
              flexShrink: 0,
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = primaryAlpha(0.6);
            }}
          />

          {/* Slider */}
          <div
            style={{
              flex: 1,
              position: "relative",
              height: "24px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              type="range"
              className="spacing-popover-slider"
              min={sliderMin}
              max={sliderMax}
              step={4}
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              style={{
                width: "100%",
                height: "3px",
                appearance: "none",
                WebkitAppearance: "none",
                background: `linear-gradient(to right, ${color.primary} ${sliderPct}%, ${border.default} ${sliderPct}%)`,
                borderRadius: "2px",
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>

          {/* Unit selector */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              aria-expanded={unitOpen}
              aria-haspopup="listbox"
              onClick={() => setUnitOpen(!unitOpen)}
              style={{
                height: "24px",
                padding: "0 6px",
                background: surface.hover,
                border: `1px solid ${primaryAlpha(0.4)}`,
                borderRadius: "3px",
                color: text.secondary,
                fontSize: "10px",
                fontFamily: font.mono,
                cursor: "pointer",
                textTransform: "uppercase",
                outline: "none",
                minWidth: "32px",
              }}
            >
              {unit}
            </button>
            {unitOpen && (
              <div
                role="listbox"
                style={{
                  position: "absolute",
                  top: "calc(100% + 2px)",
                  right: 0,
                  minWidth: "48px",
                  background: color.popover,
                  border: `1px solid ${border.default}`,
                  borderRadius: "4px",
                  boxShadow: shadow.dropdown,
                  zIndex: zIndex.float,
                  padding: "2px 0",
                }}
              >
                {units.map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="option"
                    aria-selected={u === unit}
                    onClick={() => {
                      onUnitChange(u);
                      setUnitOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "3px 8px",
                      fontSize: "10px",
                      fontFamily: font.mono,
                      color: u === unit ? "#fff" : text.secondary,
                      background: u === unit ? color.primary : "transparent",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      textAlign: "left",
                      border: "none",
                      outline: "none",
                    }}
                    onMouseEnter={(e) => {
                      if (u !== unit)
                        (e.currentTarget as HTMLElement).style.background = surface.hover;
                    }}
                    onMouseLeave={(e) => {
                      if (u !== unit)
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Variable link dot (unlinked state) */}
          {onSelectVariable && (
            <VariableLinkDot
              rowHovered={true}
              isLinked={false}
              variableType="length"
              element={element}
              onSelect={(varExpr) => onSelectVariable?.(varExpr)}
              activeVariable={activeVariable}
              inline
            />
          )}
        </div>
      )}

      {/* Preset grid: 2 rows × 4 columns (hidden when linked to variable) */}
      {!isLinked && <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
        {PRESETS.map((preset) => (
          <button
            type="button"
            key={preset}
            onClick={() => onChange(preset)}
            style={{
              height: "28px",
              background:
                value === preset ? primaryAlpha(0.2) : surface.subtle,
              border:
                value === preset
                  ? `1px solid ${primaryAlpha(0.4)}`
                  : `1px solid ${blackAlpha(0.07)}`,
              borderRadius: "4px",
              color: value === preset ? "#fff" : text.secondary,
              fontSize: "11px",
              fontFamily: font.mono,
              cursor: "pointer",
              outline: "none",
              transition: `background ${ms("fast")}, border-color ${ms("fast")}`,
            }}
            onMouseEnter={(e) => {
              if (value !== preset) {
                (e.currentTarget as HTMLElement).style.background = blackAlpha(0.07);
                (e.currentTarget as HTMLElement).style.borderColor = blackAlpha(0.15);
              }
            }}
            onMouseLeave={(e) => {
              if (value !== preset) {
                (e.currentTarget as HTMLElement).style.background = surface.subtle;
                (e.currentTarget as HTMLElement).style.borderColor = blackAlpha(0.07);
              }
            }}
          >
            {preset}
          </button>
        ))}
      </div>}
    </div>,
    document.body,
  );
}
