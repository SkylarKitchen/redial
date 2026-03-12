/**
 * PositionSelector.tsx — Webflow-style CSS position selector
 *
 * Rich dropdown with icons per position mode and a description area
 * explaining what each mode does. Replaces the plain SelectRow for
 * the `position` CSS property.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { StyleIndicator, type IndicatorType } from "./StyleIndicator";
import { ChevronDown, X, Move, LocateFixed, Pin, StickyNote } from "lucide-react";
import { ms } from "./timing";
import { color, text, border, surface, blackAlpha, primaryAlpha, font } from "./theme";

// ─── Icons ──────────────────────────────────────────────────────────

const StaticIcon = () => <X size={16} strokeWidth={1.5} />;
const RelativeIcon = () => <Move size={16} strokeWidth={1.5} />;
const AbsoluteIcon = () => <LocateFixed size={16} strokeWidth={1.5} />;
const FixedIcon = () => <Pin size={16} strokeWidth={1.5} />;
const StickyIcon = () => <StickyNote size={16} strokeWidth={1.5} />;

// ─── Option data ────────────────────────────────────────────────────

interface PositionOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const POSITION_ITEMS: PositionOption[] = [
  {
    value: "static",
    label: "Static",
    icon: <StaticIcon />,
    description: "Static is the default position and displays an element based on styles in the Layout section.",
  },
  {
    value: "relative",
    label: "Relative",
    icon: <RelativeIcon />,
    description: "Relative positions an element relative to its normal position. Offset values shift it from where it would normally be.",
  },
  {
    value: "absolute",
    label: "Absolute",
    icon: <AbsoluteIcon />,
    description: "Absolute removes the element from normal flow and positions it relative to its closest positioned ancestor.",
  },
  {
    value: "fixed",
    label: "Fixed",
    icon: <FixedIcon />,
    description: "Fixed positions an element relative to the viewport. It stays in place when the page scrolls.",
  },
  {
    value: "sticky",
    label: "Sticky",
    icon: <StickyIcon />,
    description: "Sticky toggles between relative and fixed based on scroll position. Set a top offset to define when it sticks.",
  },
];

// ─── Component ──────────────────────────────────────────────────────

export function PositionSelector({
  value,
  onChange,
  indicator,
}: {
  value: string;
  onChange: (value: string) => void;
  indicator?: IndicatorType;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = POSITION_ITEMS.find((o) => o.value === value) ?? POSITION_ITEMS[0];
  const descriptionItem = hoveredValue
    ? POSITION_ITEMS.find((o) => o.value === hoveredValue) ?? current
    : current;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const handleSelect = useCallback(
    (v: string) => {
      onChange(v);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
      <span
        style={{
          width: "64px",
          fontSize: "11px",
          color: text.label,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {indicator && <StyleIndicator type={indicator} />}
        Position
      </span>
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        {/* Trigger button */}
        <button
          className="tuner-focusable"
          tabIndex={0}
          onClick={() => setOpen((o) => !o)}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px ${color.ring}`;
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
          style={{
            width: "100%",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: open ? border.input : color.input,
            border: `1px solid ${color.border}`,
            borderRadius: "3px",
            color: text.secondary,
            fontSize: "11px",
            fontFamily: font.mono,
            padding: "0 6px",
            cursor: "pointer",
            outline: "none",
            transition: `background ${ms("fast")}, box-shadow ${ms("fast")}`,
          }}
          onMouseEnter={(e) => {
            if (!open) (e.currentTarget as HTMLElement).style.background = border.input;
          }}
          onMouseLeave={(e) => {
            if (!open) (e.currentTarget as HTMLElement).style.background = color.input;
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: text.label, display: "flex" }}>{current.icon}</span>
            {current.label}
          </span>
          <ChevronDown size={10} strokeWidth={2} style={{ color: blackAlpha(0.3), flexShrink: 0, marginLeft: "4px" }} />
        </button>

        {/* Dropdown */}
        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 2px)",
              left: 0,
              right: 0,
              minWidth: "200px",
              background: color.popover,
              border: `1px solid ${border.hover}`,
              borderRadius: "4px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              zIndex: 200,
              overflow: "hidden",
            }}
          >
            {/* Options list */}
            <div style={{ padding: "4px 0" }}>
              {POSITION_ITEMS.map((opt) => {
                const isActive = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={(e) => {
                      setHoveredValue(opt.value);
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.background = color.input;
                    }}
                    onMouseLeave={(e) => {
                      setHoveredValue(null);
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 10px",
                      cursor: "pointer",
                      background: isActive ? primaryAlpha(0.15) : "transparent",
                      transition: `background ${ms("micro")}`,
                    }}
                  >
                    {/* Checkmark column */}
                    <span
                      style={{
                        width: "14px",
                        fontSize: "11px",
                        color: isActive ? color.primary : "transparent",
                        flexShrink: 0,
                        textAlign: "center",
                      }}
                    >
                      ✓
                    </span>

                    {/* Icon */}
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "20px",
                        height: "20px",
                        color: isActive ? color.foreground : blackAlpha(0.4),
                        flexShrink: 0,
                      }}
                    >
                      {opt.icon}
                    </span>

                    {/* Label */}
                    <span
                      style={{
                        fontSize: "12px",
                        color: isActive ? color.foreground : blackAlpha(0.6),
                        fontWeight: isActive ? 500 : 400,
                      }}
                    >
                      {opt.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Description area */}
            <div
              style={{
                borderTop: `1px solid ${surface.hover}`,
                padding: "10px 12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  lineHeight: 1.45,
                  color: blackAlpha(0.5),
                }}
              >
                <strong style={{ color: text.secondary }}>{descriptionItem.label}</strong>{" "}
                {descriptionItem.description.replace(`${descriptionItem.label} `, "")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
