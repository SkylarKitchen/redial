/**
 * controls.tsx — Shared inline-styled UI components
 *
 * Section, ValueInput, SliderRow, SelectRow, ColorRow, TextRow, EditableValue.
 * Extracted from WebflowPanel.tsx and SpacingBoxModel.tsx.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector } from "./UnitSelector";
import { StyleIndicator, type IndicatorType } from "./StyleIndicator";

const FOCUS_RING = "0 0 0 2px rgba(99,102,241,0.3)";
const onFocusRing = (e: React.FocusEvent) => { (e.currentTarget as HTMLElement).style.boxShadow = FOCUS_RING; };
const onBlurRing = (e: React.FocusEvent) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; };

// ─── Section ────────────────────────────────────────────────────────

export function Section({
  title,
  collapsed,
  children,
}: {
  title: string;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div
        tabIndex={0}
        role="button"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
        onFocus={onFocusRing}
        onBlur={onBlurRing}
        style={{
          padding: "10px 12px 6px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          borderRadius: "2px",
          outline: "none",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>
          {title}
        </span>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
          {open ? "\u25BE" : "\u25B8"}
        </span>
      </div>
      {open && <div style={{ paddingBottom: "8px" }}>{children}</div>}
    </div>
  );
}

// ─── ValueInput ─────────────────────────────────────────────────────

export function ValueInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onChange(parsed);
  }, [draft, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
        onChange(Math.round((value + step) * 10) / 10);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const step = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
        onChange(Math.round((value - step) * 10) / 10);
      }
    },
    [commit, value, onChange]
  );

  return (
    <input
      value={focused ? draft : String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      style={{
        width: "40px",
        background: "rgba(255,255,255,0.06)",
        border: focused ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: "2px",
        color: "rgba(255,255,255,0.8)",
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        textAlign: "center",
        padding: "2px",
        outline: "none",
        flexShrink: 0,
        boxShadow: focused ? FOCUS_RING : "none",
      }}
    />
  );
}

// ─── SliderRow ──────────────────────────────────────────────────────

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  units,
  onUnitChange,
  onChange,
  indicator,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** If provided, shows a UnitSelector dropdown instead of a static unit label */
  units?: string[];
  onUnitChange?: (unit: string) => void;
  onChange: (value: number) => void;
  indicator?: IndicatorType;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
      <LabelScrub value={value} onChange={onChange} step={step} min={min} max={max}>
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
          {label}
        </span>
      </LabelScrub>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onFocus={onFocusRing}
        onBlur={onBlurRing}
        style={{
          flex: 1,
          height: "3px",
          appearance: "none",
          WebkitAppearance: "none",
          background: `linear-gradient(to right, #6366f1 ${pct}%, rgba(255,255,255,0.15) ${pct}%)`,
          borderRadius: "2px",
          outline: "none",
          cursor: "pointer",
        }}
      />
      <ValueInput value={value} onChange={onChange} />
      {units && onUnitChange ? (
        <UnitSelector value={unit} options={units} onChange={onUnitChange} />
      ) : unit ? (
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", width: "16px" }}>{unit}</span>
      ) : null}
    </div>
  );
}

// ─── SelectRow ──────────────────────────────────────────────────────

export function SelectRow({
  label,
  value,
  options,
  onChange,
  indicator,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  indicator?: IndicatorType;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

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
        {label}
      </span>
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          onFocus={onFocusRing}
          onBlur={onBlurRing}
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
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current?.label ?? value}
          </span>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", flexShrink: 0, marginLeft: "4px" }}>▾</span>
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 2px)",
              left: 0,
              right: 0,
              minWidth: "100%",
              maxHeight: "180px",
              overflowY: "auto",
              background: "#2a2a2a",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "4px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              zIndex: 200,
              padding: "2px 0",
            }}
          >
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontFamily: "ui-monospace, 'SF Mono', monospace",
                    color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                    background: isActive ? "#6366f1" : "transparent",
                    cursor: "pointer",
                    lineHeight: "16px",
                    transition: "background 60ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {opt.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ColorRow ───────────────────────────────────────────────────────

export function ColorRow({
  label,
  value,
  onChange,
  indicator,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  indicator?: IndicatorType;
}) {
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
        {label}
      </span>
      <div style={{ position: "relative", width: "24px", height: "24px", flexShrink: 0 }}>
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            background: value === "transparent" ? "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/8px 8px" : value,
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        />
        <input
          type="color"
          value={value === "transparent" ? "#000000" : value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            cursor: "pointer",
            width: "24px",
            height: "24px",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── TextRow ────────────────────────────────────────────────────────

export function TextRow({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder?: string; onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
      <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{label}</span>
      <input
        type="text" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          flex: 1, height: "24px", background: "rgba(255,255,255,0.06)",
          border: focused ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
          borderRadius: "3px", color: "rgba(255,255,255,0.8)", fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace", padding: "0 6px", outline: "none",
          boxShadow: focused ? FOCUS_RING : "none",
        }}
      />
    </div>
  );
}

// ─── EditableValue (from SpacingBoxModel) ───────────────────────────

export function EditableValue({
  value,
  onChange,
  onAltClick,
}: {
  value: number;
  onChange: (value: number) => void;
  onAltClick?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when external value changes
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed !== value) {
      onChange(parsed);
    }
  }, [draft, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
      } else if (e.key === "Escape") {
        setDraft(String(value));
        setEditing(false);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const next = value + step;
        setDraft(String(next));
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const next = value - step;
        setDraft(String(next));
        onChange(next);
      }
    },
    [commit, value, onChange]
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        style={{
          width: "28px",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(99, 102, 241, 0.5)",
          borderRadius: "2px",
          color: "rgba(255,255,255,0.9)",
          fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          textAlign: "center",
          padding: "1px 2px",
          outline: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        if (e.altKey && onAltClick) {
          onAltClick();
          return;
        }
        setEditing(true);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(true); } }}
      onFocus={onFocusRing}
      onBlur={onBlurRing}
      style={{
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        color: value !== 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
        cursor: "text",
        padding: "1px 3px",
        borderRadius: "2px",
        minWidth: "16px",
        textAlign: "center",
        outline: "none",
        transition: "background 100ms, box-shadow 80ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {value}
    </span>
  );
}
