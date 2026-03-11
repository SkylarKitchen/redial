/**
 * PositionSelector.tsx — Webflow-style CSS position selector
 *
 * Rich dropdown with icons per position mode and a description area
 * explaining what each mode does. Replaces the plain SelectRow for
 * the `position` CSS property.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { StyleIndicator, type IndicatorType } from "./StyleIndicator";

// ─── Icons ──────────────────────────────────────────────────────────

const StaticIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const RelativeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="7" height="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1" opacity="0.4" />
    <rect x="5" y="5" width="7" height="7" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <path d="M5.5 5L3.5 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" markerEnd="" />
    <circle cx="3.5" cy="3" r="0.8" fill="currentColor" opacity="0.5" />
  </svg>
);

const AbsoluteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="1.5" width="13" height="13" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1" opacity="0.4" />
    <rect x="2" y="2" width="6" height="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <path d="M2 2L1.5 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

const FixedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="1.5" width="13" height="13" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <rect x="2" y="2" width="6" height="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <path d="M12 5V11M10 8h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
  </svg>
);

const StickyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="1.5" width="10" height="13" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <rect x="4" y="3" width="8" height="4" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <line x1="5" y1="10" x2="11" y2="10" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
    <line x1="5" y1="12" x2="11" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
  </svg>
);

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
          color: "rgba(255,255,255,0.5)",
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
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px rgba(99,102,241,0.3)";
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
            background: open ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "3px",
            color: "rgba(255,255,255,0.8)",
            fontSize: "11px",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            padding: "0 6px",
            cursor: "pointer",
            outline: "none",
            transition: "background 80ms, box-shadow 80ms",
          }}
          onMouseEnter={(e) => {
            if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            if (!open) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", display: "flex" }}>{current.icon}</span>
            {current.label}
          </span>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", flexShrink: 0, marginLeft: "4px" }}>▾</span>
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
              background: "#2a2a2a",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "4px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
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
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
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
                      background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                      transition: "background 60ms",
                    }}
                  >
                    {/* Checkmark column */}
                    <span
                      style={{
                        width: "14px",
                        fontSize: "11px",
                        color: isActive ? "#6366f1" : "transparent",
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
                        color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
                        flexShrink: 0,
                      }}
                    >
                      {opt.icon}
                    </span>

                    {/* Label */}
                    <span
                      style={{
                        fontSize: "12px",
                        color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
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
                borderTop: "1px solid rgba(255,255,255,0.08)",
                padding: "10px 12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  lineHeight: 1.45,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                <strong style={{ color: "rgba(255,255,255,0.8)" }}>{descriptionItem.label}</strong>{" "}
                {descriptionItem.description.replace(`${descriptionItem.label} `, "")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
