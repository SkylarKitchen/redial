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

// Webflow's standard spacing presets
const PRESETS = [0, 10, 20, 40, 60, 100, 140, 220];

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
}: SpacingValuePopoverProps) {
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
        const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
        const next = Math.round((value + step) * 10) / 10;
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
        const next = Math.round((value - step) * 10) / 10;
        const clamped = isMargin ? next : Math.max(0, next);
        onChange(clamped);
      }
    },
    [commitInput, value, onChange, isMargin],
  );

  // --- Positioning: below anchor, centered, clamped to viewport ---
  const popoverWidth = 220;
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
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
        background: "#2a2a2a",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "6px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 999999,
        padding: "8px",
        fontFamily: "system-ui, -apple-system, sans-serif",
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
          background: #6366f1;
          border: 2px solid #fff;
          cursor: pointer;
          margin-top: -4.5px;
        }
        .spacing-popover-slider::-moz-range-thumb {
          width: 12px; height: 12px;
          border-radius: 50%;
          background: #6366f1;
          border: 2px solid #fff;
          cursor: pointer;
        }
      `,
        }}
      />

      {/* Top row: icon, input, slider, unit */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        {/* Direction indicator */}
        <div
          style={{
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.08)",
            borderRadius: "3px",
            fontSize: "12px",
            color: "rgba(255,255,255,0.5)",
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
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
          }}
          onKeyDown={handleInputKeyDown}
          style={{
            width: "36px",
            height: "24px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "3px",
            color: "rgba(255,255,255,0.9)",
            fontSize: "11px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            textAlign: "center",
            padding: "0 2px",
            outline: "none",
            flexShrink: 0,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.6)";
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
            step={1}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{
              width: "100%",
              height: "3px",
              appearance: "none",
              WebkitAppearance: "none",
              background: `linear-gradient(to right, #6366f1 ${sliderPct}%, rgba(255,255,255,0.15) ${sliderPct}%)`,
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
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: "3px",
              color: "rgba(255,255,255,0.8)",
              fontSize: "10px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
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
                background: "#333",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "4px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                zIndex: 10,
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
                    fontFamily: "ui-monospace, 'SF Mono', monospace",
                    color: u === unit ? "#fff" : "rgba(255,255,255,0.6)",
                    background: u === unit ? "#6366f1" : "transparent",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    textAlign: "left",
                    border: "none",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (u !== unit)
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
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
      </div>

      {/* Preset grid: 2 rows × 4 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
        {PRESETS.map((preset) => (
          <button
            type="button"
            key={preset}
            onClick={() => onChange(preset)}
            style={{
              height: "28px",
              background:
                value === preset ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
              border:
                value === preset
                  ? "1px solid rgba(99,102,241,0.4)"
                  : "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              color: value === preset ? "#fff" : "rgba(255,255,255,0.6)",
              fontSize: "11px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              cursor: "pointer",
              outline: "none",
              transition: "background 80ms, border-color 80ms",
            }}
            onMouseEnter={(e) => {
              if (value !== preset) {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (value !== preset) {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
              }
            }}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
