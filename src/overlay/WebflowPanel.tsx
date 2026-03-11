/**
 * WebflowPanel.tsx — Central CSS property panel (Webflow-style)
 *
 * Replaces the DialKit-based Panel.tsx with custom inline-styled sections.
 * Each section is collapsible and maps to a CSS category:
 * Layout, Spacing, Size, Position, Typography, Backgrounds, Borders, Effects.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { AlignBox } from "./AlignBox";
import { IconButtonGroup } from "./IconButtonGroup";
import { SideSelector } from "./SideSelector";
import { CornerRadiusEditor } from "./CornerRadiusEditor";
import { ShadowEditor, type ShadowValue } from "./ShadowEditor";
import { FilterSliders, type FilterValues } from "./FilterSliders";
import { TransformEditor, type TransformValue } from "./TransformEditor";
import { TransitionEditor, type TransitionValue } from "./TransitionEditor";
import { BackgroundLayerList, type BackgroundLayer } from "./BackgroundLayerList";
import { SpacingBoxModel } from "./SpacingBoxModel";
import type { SpacingValues } from "./infer";
import { applyInlineStyle } from "./apply";
import { LabelScrub } from "./LabelScrub";
import { UnitSelector } from "./UnitSelector";

// ─── Props ───────────────────────────────────────────────────────────

export interface WebflowPanelProps {
  element: Element;
  spacing: SpacingValues;
  onSpacingChange: (prop: string, value: number) => void;
  onDirtyChange?: () => void;
}

// ─── CSS Value Helpers ───────────────────────────────────────────────

function rgbToHex(rgb: string): string {
  if (rgb === "rgba(0, 0, 0, 0)" || rgb === "transparent") return "transparent";
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  return (
    "#" +
    [match[1], match[2], match[3]]
      .map((c) => parseInt(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

function parseNum(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function parseBoxShadow(raw: string): ShadowValue[] {
  if (!raw || raw === "none") return [];
  const shadows: ShadowValue[] = [];
  // Split on commas that are NOT inside parentheses (for rgba colors)
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const inset = part.includes("inset");
    const cleaned = part.replace("inset", "").trim();
    // Extract color (rgb/rgba/hex/named) — browsers may place color first or last
    const colorStartMatch = cleaned.match(/^(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})\s+/i);
    const colorEndMatch = cleaned.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|\b(?!(?:\d|inset\b))[a-z]{3,}\b)$/i);
    const color = (colorStartMatch?.[1] ?? colorEndMatch?.[1]) || "rgba(0,0,0,0.1)";
    // Strip the matched color from the string before parsing numbers
    let numStr = cleaned;
    if (colorStartMatch) {
      numStr = numStr.slice(colorStartMatch[0].length);
    } else if (colorEndMatch) {
      numStr = numStr.slice(0, colorEndMatch.index).trim();
    }
    numStr = numStr.replace(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/g, "").trim();
    const nums = numStr.split(/\s+/).map(parseFloat).filter((n) => !isNaN(n));
    shadows.push({
      x: nums[0] ?? 0,
      y: nums[1] ?? 0,
      blur: nums[2] ?? 0,
      spread: nums[3] ?? 0,
      color,
      inset,
    });
  }
  return shadows;
}

function parseFilter(raw: string): Partial<FilterValues> {
  if (!raw || raw === "none") return {};
  const result: Partial<FilterValues> = {};
  const regex = /(blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)\(([^)]+)\)/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    const key = m[1] as keyof FilterValues;
    let val = parseFloat(m[2]);
    // brightness/contrast/saturate come as decimals from computed style, need * 100
    if (key === "brightness" || key === "contrast" || key === "saturate") {
      val = Math.round(val * 100);
    } else if (key === "grayscale" || key === "invert" || key === "sepia") {
      val = Math.round(val * 100);
    }
    result[key] = val;
  }
  return result;
}

function parseTransform(raw: string): TransformValue[] {
  if (!raw || raw === "none") return [];
  const transforms: TransformValue[] = [];
  const regex = /(translate3d|translate|scale|rotate|skew)\(([^)]+)\)/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    const fn = m[1];
    const args = m[2].split(",").map((s) => parseFloat(s.trim()));
    if (fn === "translate3d" || fn === "translate") {
      transforms.push({ type: "translate", x: args[0] ?? 0, y: args[1] ?? 0, z: args[2] ?? 0 });
    } else if (fn === "scale") {
      transforms.push({ type: "scale", x: args[0] ?? 1, y: args[1] ?? args[0] ?? 1 });
    } else if (fn === "rotate") {
      transforms.push({ type: "rotate", x: args[0] ?? 0, y: 0 });
    } else if (fn === "skew") {
      transforms.push({ type: "skew", x: args[0] ?? 0, y: args[1] ?? 0 });
    }
  }
  // Also handle matrix() — extract rough rotation from a 2D matrix
  if (transforms.length === 0 && raw.startsWith("matrix(")) {
    const nums = raw.match(/matrix\(([^)]+)\)/)?.[1]?.split(",").map(Number);
    if (nums && nums.length >= 6) {
      const angle = Math.round(Math.atan2(nums[1], nums[0]) * (180 / Math.PI));
      const scaleX = Math.sqrt(nums[0] * nums[0] + nums[1] * nums[1]);
      const scaleY = Math.sqrt(nums[2] * nums[2] + nums[3] * nums[3]);
      if (Math.abs(angle) > 0.5) transforms.push({ type: "rotate", x: angle, y: 0 });
      if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
        transforms.push({ type: "scale", x: Math.round(scaleX * 100) / 100, y: Math.round(scaleY * 100) / 100 });
      }
      if (Math.abs(nums[4]) > 0.5 || Math.abs(nums[5]) > 0.5) {
        transforms.push({ type: "translate", x: Math.round(nums[4]), y: Math.round(nums[5]) });
      }
    }
  }
  return transforms;
}

function shadowToCSS(shadows: ShadowValue[]): string {
  if (shadows.length === 0) return "none";
  return shadows
    .map((s) => {
      const inset = s.inset ? "inset " : "";
      return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
    })
    .join(", ");
}

function filterToCSS(values: Partial<FilterValues>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(values)) {
    if (val === undefined) continue;
    const k = key as keyof FilterValues;
    if (k === "blur") parts.push(`blur(${val}px)`);
    else if (k === "hue-rotate") parts.push(`hue-rotate(${val}deg)`);
    else if (k === "brightness" || k === "contrast" || k === "saturate") parts.push(`${k}(${val / 100})`);
    else parts.push(`${k}(${val / 100})`);
  }
  return parts.length > 0 ? parts.join(" ") : "none";
}

function transformToCSS(transforms: TransformValue[]): string {
  if (transforms.length === 0) return "none";
  return transforms
    .map((t) => {
      switch (t.type) {
        case "translate":
          return t.z ? `translate3d(${t.x}px, ${t.y}px, ${t.z}px)` : `translate(${t.x}px, ${t.y}px)`;
        case "scale":
          return `scale(${t.x}, ${t.y})`;
        case "rotate":
          return `rotate(${t.x}deg)`;
        case "skew":
          return `skew(${t.x}deg, ${t.y}deg)`;
      }
    })
    .join(" ");
}

function parseTransitions(cs: CSSStyleDeclaration): TransitionValue[] {
  const props = cs.transitionProperty;
  if (!props || props === "none") return [];
  const properties = props.split(",").map((s) => s.trim());
  const durations = cs.transitionDuration.split(",").map((s) => parseFloat(s.trim()) * 1000);
  const easings = cs.transitionTimingFunction.split(",").map((s) => s.trim());
  const delays = cs.transitionDelay.split(",").map((s) => parseFloat(s.trim()) * 1000);
  return properties.map((p, i) => ({
    property: p,
    duration: durations[i % durations.length] ?? 300,
    easing: easings[i % easings.length] ?? "ease",
    delay: delays[i % delays.length] ?? 0,
  }));
}

function transitionsToCSS(transitions: TransitionValue[]): string {
  if (transitions.length === 0) return "none";
  return transitions
    .map((t) => `${t.property} ${t.duration}ms ${t.easing} ${t.delay}ms`)
    .join(", ");
}

// ─── Text Detection ──────────────────────────────────────────────────

const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "label",
  "button", "li", "td", "th", "input", "textarea", "strong", "em",
  "b", "i", "small", "blockquote",
]);

function isTextBearing(el: Element): boolean {
  if (TEXT_TAGS.has(el.tagName.toLowerCase())) return true;
  if (el.matches("[role=button], [role=heading], [contenteditable]")) return true;
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return true;
  }
  return false;
}

// ─── Text Alignment Icons ────────────────────────────────────────────

const TEXT_ALIGN_OPTIONS = [
  {
    value: "left",
    title: "Align left",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="1" y1="3" x2="10" y2="3" stroke="currentColor" strokeWidth="1.2" />
        <line x1="1" y1="6" x2="7" y2="6" stroke="currentColor" strokeWidth="1.2" />
        <line x1="1" y1="9" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: "center",
    title: "Align center",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="1" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2" />
        <line x1="3" y1="6" x2="9" y2="6" stroke="currentColor" strokeWidth="1.2" />
        <line x1="2" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: "right",
    title: "Align right",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="2" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2" />
        <line x1="5" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" />
        <line x1="3" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: "justify",
    title: "Justify",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="1" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2" />
        <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2" />
        <line x1="1" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
];

const TEXT_DECORATION_OPTIONS = [
  {
    value: "underline",
    title: "Underline",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <text x="6" y="8" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="bold">U</text>
        <line x1="2" y1="11" x2="10" y2="11" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
  {
    value: "line-through",
    title: "Strikethrough",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="bold">S</text>
        <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
  {
    value: "overline",
    title: "Overline",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="2" y1="1" x2="10" y2="1" stroke="currentColor" strokeWidth="1" />
        <text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="bold">O</text>
      </svg>
    ),
  },
];

const TEXT_TRANSFORM_OPTIONS = [
  {
    value: "uppercase",
    title: "Uppercase",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">AA</text>
      </svg>
    ),
  },
  {
    value: "capitalize",
    title: "Capitalize",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">Aa</text>
      </svg>
    ),
  },
  {
    value: "lowercase",
    title: "Lowercase",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <text x="6" y="9" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">aa</text>
      </svg>
    ),
  },
];

// ─── Shared Inline Components ────────────────────────────────────────

function Section({
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
        onClick={() => setOpen(!open)}
        style={{
          padding: "10px 12px 6px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
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

function ValueInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
        onChange(value + (e.shiftKey ? 10 : 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onChange(value - (e.shiftKey ? 10 : 1));
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
      }}
    />
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  units,
  onUnitChange,
  onChange,
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
            display: "inline-block",
          }}
        >
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

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
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
        }}
      >
        {label}
      </span>
      <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
        <button
          onClick={() => setOpen((o) => !o)}
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
            transition: "background 80ms",
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

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 12px" }}>
      <span
        style={{
          width: "64px",
          fontSize: "11px",
          color: "rgba(255,255,255,0.5)",
          flexShrink: 0,
        }}
      >
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

function TextRow({ label, value, placeholder, onChange }: {
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
        }}
      />
    </div>
  );
}

// ─── Display Options ─────────────────────────────────────────────────

const DISPLAY_OPTIONS = [
  { value: "block", label: "Block" },
  { value: "flex", label: "Flex" },
  { value: "inline-flex", label: "Inline Flex" },
  { value: "grid", label: "Grid" },
  { value: "inline-grid", label: "Inline Grid" },
  { value: "inline-block", label: "Inline Block" },
  { value: "inline", label: "Inline" },
  { value: "none", label: "None" },
];

const FONT_WEIGHT_OPTIONS = [
  { value: "100", label: "100 - Thin" },
  { value: "200", label: "200 - Extra Light" },
  { value: "300", label: "300 - Light" },
  { value: "400", label: "400 - Regular" },
  { value: "500", label: "500 - Medium" },
  { value: "600", label: "600 - Semi Bold" },
  { value: "700", label: "700 - Bold" },
  { value: "800", label: "800 - Extra Bold" },
  { value: "900", label: "900 - Black" },
];

const WHITE_SPACE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "nowrap", label: "No Wrap" },
  { value: "pre", label: "Pre" },
  { value: "pre-wrap", label: "Pre Wrap" },
  { value: "pre-line", label: "Pre Line" },
  { value: "break-spaces", label: "Break Spaces" },
];

const WORD_BREAK_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "break-all", label: "Break All" },
  { value: "keep-all", label: "Keep All" },
  { value: "break-word", label: "Break Word" },
];

const FLOAT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const CLEAR_OPTIONS = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "both", label: "Both" },
];

// Unit option lists for SliderRow unit selectors
const SIZE_UNITS_W = ["px", "%", "vw", "em", "rem", "ch"];
const SIZE_UNITS_H = ["px", "%", "vh", "em", "rem"];
const POSITION_UNITS = ["px", "%", "vw", "vh"];
const TYPO_SIZE_UNITS = ["px", "em", "rem"];

const OVERFLOW_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" },
  { value: "auto", label: "Auto" },
];

const POSITION_OPTIONS = [
  { value: "static", label: "Static" },
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" },
  { value: "fixed", label: "Fixed" },
  { value: "sticky", label: "Sticky" },
];

const BORDER_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "double", label: "Double" },
  { value: "groove", label: "Groove" },
  { value: "ridge", label: "Ridge" },
  { value: "inset", label: "Inset" },
  { value: "outset", label: "Outset" },
  { value: "none", label: "None" },
];

const BLEND_MODE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

const CURSOR_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "pointer", label: "Pointer" },
  { value: "default", label: "Default" },
  { value: "text", label: "Text" },
  { value: "move", label: "Move" },
  { value: "grab", label: "Grab" },
  { value: "grabbing", label: "Grabbing" },
  { value: "not-allowed", label: "Not Allowed" },
  { value: "crosshair", label: "Crosshair" },
  { value: "wait", label: "Wait" },
  { value: "help", label: "Help" },
  { value: "zoom-in", label: "Zoom In" },
  { value: "zoom-out", label: "Zoom Out" },
  { value: "none", label: "None" },
];

const POINTER_EVENTS_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "none", label: "None" },
];

const VISIBILITY_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "collapse", label: "Collapse" },
];

const FLEX_WRAP_OPTIONS = [
  { value: "nowrap", label: "No Wrap" },
  { value: "wrap", label: "Wrap" },
  { value: "wrap-reverse", label: "Wrap Reverse" },
];

const FLEX_DIRECTION_ICONS = [
  {
    value: "row",
    title: "Row (→)",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="2" y1="6" x2="9" y2="6" stroke="currentColor" strokeWidth="1.2" />
        <polyline points="7,3.5 9.5,6 7,8.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "column",
    title: "Column (↓)",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="6" y1="2" x2="6" y2="9" stroke="currentColor" strokeWidth="1.2" />
        <polyline points="3.5,7 6,9.5 8.5,7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "row-reverse",
    title: "Row Reverse (←)",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="3" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.2" />
        <polyline points="5,3.5 2.5,6 5,8.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "column-reverse",
    title: "Column Reverse (↑)",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="6" y1="3" x2="6" y2="10" stroke="currentColor" strokeWidth="1.2" />
        <polyline points="3.5,5 6,2.5 8.5,5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const ALIGN_SELF_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "stretch", label: "Stretch" },
  { value: "baseline", label: "Baseline" },
];

// ─── Main Component ──────────────────────────────────────────────────

export function WebflowPanel({ element, spacing, onSpacingChange, onDirtyChange }: WebflowPanelProps) {
  // Read computed styles once on mount
  const [cs] = useState(() => getComputedStyle(element));

  // ── Layout state ──
  const [display, setDisplay] = useState(() => cs.display);
  const [flexDirection, setFlexDirection] = useState(() => cs.flexDirection);
  const [justifyContent, setJustifyContent] = useState(() => cs.justifyContent);
  const [alignItems, setAlignItems] = useState(() => cs.alignItems);
  const [flexWrap, setFlexWrap] = useState(() => cs.flexWrap);
  const [gap, setGap] = useState(() => parseNum(cs.gap));

  // Grid track definitions
  const [gridCols, setGridCols] = useState(() => cs.gridTemplateColumns === "none" ? "" : cs.gridTemplateColumns);
  const [gridRows, setGridRows] = useState(() => cs.gridTemplateRows === "none" ? "" : cs.gridTemplateRows);

  // Flex child controls
  const [flexGrow, setFlexGrow] = useState(() => parseNum(cs.flexGrow));
  const [flexShrink, setFlexShrink] = useState(() => parseNum(cs.flexShrink));
  const [flexBasis, setFlexBasis] = useState(() => parseNum(cs.flexBasis));
  const [alignSelf, setAlignSelf] = useState(() => cs.alignSelf);
  const [flexOrder, setFlexOrder] = useState(() => parseNum(cs.order));

  // ── Size state ──
  const [width, setWidth] = useState(() => parseNum(cs.width));
  const [height, setHeight] = useState(() => parseNum(cs.height));
  const [minWidth, setMinWidth] = useState(() => parseNum(cs.minWidth));
  const [maxWidth, setMaxWidth] = useState(() => parseNum(cs.maxWidth === "none" ? "0" : cs.maxWidth));
  const [minHeight, setMinHeight] = useState(() => parseNum(cs.minHeight));
  const [maxHeight, setMaxHeight] = useState(() => parseNum(cs.maxHeight === "none" ? "0" : cs.maxHeight));
  const [overflow, setOverflow] = useState(() => cs.overflow.split(" ")[0] || "visible");

  // Size units
  const [widthUnit, setWidthUnit] = useState("px");
  const [heightUnit, setHeightUnit] = useState("px");
  const [minWidthUnit, setMinWidthUnit] = useState("px");
  const [maxWidthUnit, setMaxWidthUnit] = useState("px");
  const [minHeightUnit, setMinHeightUnit] = useState("px");
  const [maxHeightUnit, setMaxHeightUnit] = useState("px");

  // Size keyword toggles
  const [widthAuto, setWidthAuto] = useState(() => cs.width === "auto");
  const [heightAuto, setHeightAuto] = useState(() => cs.height === "auto");
  const [maxWidthNone, setMaxWidthNone] = useState(() => cs.maxWidth === "none");
  const [maxHeightNone, setMaxHeightNone] = useState(() => cs.maxHeight === "none");

  // ── Position state ──
  const [position, setPosition] = useState(() => cs.position);
  const [top, setTop] = useState(() => parseNum(cs.top));
  const [right, setRight] = useState(() => parseNum(cs.right));
  const [bottom, setBottom] = useState(() => parseNum(cs.bottom));
  const [left, setLeft] = useState(() => parseNum(cs.left));
  const [zIndex, setZIndex] = useState(() => parseInt(cs.zIndex) || 0);
  const [float_, setFloat] = useState(() => cs.cssFloat || "none");
  const [clear_, setClear] = useState(() => cs.clear || "none");

  // Position units
  const [topUnit, setTopUnit] = useState("px");
  const [rightUnit, setRightUnit] = useState("px");
  const [bottomUnit, setBottomUnit] = useState("px");
  const [leftUnit, setLeftUnit] = useState("px");

  // ── Typography state ──
  const [fontSize, setFontSize] = useState(() => parseNum(cs.fontSize));
  const [fontWeight, setFontWeight] = useState(() => cs.fontWeight);
  const [lineHeight, setLineHeight] = useState(() => {
    const lh = parseNum(cs.lineHeight);
    const fs = parseNum(cs.fontSize);
    return fs > 0 ? Math.round((lh / fs) * 100) / 100 : 1.4;
  });
  const [letterSpacing, setLetterSpacing] = useState(() => parseNum(cs.letterSpacing));
  const [fontSizeUnit, setFontSizeUnit] = useState("px");
  const [letterSpacingUnit, setLetterSpacingUnit] = useState("px");
  const [color, setColor] = useState(() => rgbToHex(cs.color));
  const [textAlign, setTextAlign] = useState(() => cs.textAlign);
  const [textDecoration, setTextDecoration] = useState(() => {
    const td = cs.textDecorationLine || cs.textDecoration;
    return td === "none" ? "none" : td;
  });
  const [textTransform, setTextTransform] = useState(() => cs.textTransform);
  const [fontStyle, setFontStyle] = useState(() => cs.fontStyle);
  const [showTypoAdvanced, setShowTypoAdvanced] = useState(false);
  const [wordSpacing, setWordSpacing] = useState(() => parseNum(cs.wordSpacing));
  const [whiteSpace, setWhiteSpace] = useState(() => cs.whiteSpace);
  const [textIndent, setTextIndent] = useState(() => parseNum(cs.textIndent));
  const [wordBreak, setWordBreak] = useState(() => cs.wordBreak);
  const [columnCount, setColumnCount] = useState(() => {
    const v = cs.columnCount;
    return v === "auto" ? 1 : parseNum(cs.columnCount);
  });

  // ── Background state ──
  const [bgColor, setBgColor] = useState(() => rgbToHex(cs.backgroundColor));
  const [bgLayers, setBgLayers] = useState<BackgroundLayer[]>(() => {
    const bg = rgbToHex(cs.backgroundColor);
    if (bg !== "transparent") {
      return [{ id: "initial_color", type: "color", color: bg, opacity: 1, blendMode: "normal" }];
    }
    return [];
  });

  // ── Border state ──
  const [borderSide, setBorderSide] = useState<"all" | "top" | "right" | "bottom" | "left">("all");
  const [borderStyle, setBorderStyle] = useState(() => cs.borderStyle.split(" ")[0] || "none");
  const [borderWidth, setBorderWidth] = useState(() => parseNum(cs.borderWidth));
  const [borderColor, setBorderColor] = useState(() => rgbToHex(cs.borderColor));
  const [radiusTL, setRadiusTL] = useState(() => parseNum(cs.borderTopLeftRadius));
  const [radiusTR, setRadiusTR] = useState(() => parseNum(cs.borderTopRightRadius));
  const [radiusBR, setRadiusBR] = useState(() => parseNum(cs.borderBottomRightRadius));
  const [radiusBL, setRadiusBL] = useState(() => parseNum(cs.borderBottomLeftRadius));
  const [radiusLinked, setRadiusLinked] = useState(() => {
    const tl = parseNum(cs.borderTopLeftRadius);
    const tr = parseNum(cs.borderTopRightRadius);
    const br = parseNum(cs.borderBottomRightRadius);
    const bl = parseNum(cs.borderBottomLeftRadius);
    return tl === tr && tr === br && br === bl;
  });

  // ── Effects state ──
  const [opacity, setOpacity] = useState(() => parseFloat(cs.opacity) || 1);
  const [mixBlendMode, setMixBlendMode] = useState(() => cs.mixBlendMode);
  const [shadows, setShadows] = useState<ShadowValue[]>(() => parseBoxShadow(cs.boxShadow));
  const [transforms, setTransforms] = useState<TransformValue[]>(() => parseTransform(cs.transform));
  const [transformOrigin, setTransformOrigin] = useState(() => cs.transformOrigin || "center");
  const [filterValues, setFilterValues] = useState<Partial<FilterValues>>(() => parseFilter(cs.filter));
  const [backdropFilterValues, setBackdropFilterValues] = useState<Partial<FilterValues>>(() =>
    parseFilter((cs as unknown as Record<string, string>).backdropFilter || (cs as unknown as Record<string, string>).webkitBackdropFilter || "")
  );
  const [transitions, setTransitions] = useState<TransitionValue[]>(() => parseTransitions(cs));
  const [cursor, setCursor] = useState(() => cs.cursor);
  const [pointerEvents, setPointerEvents] = useState(() => cs.pointerEvents);
  const [visibility, setVisibility] = useState(() => cs.visibility);

  // ── Derived flags ──
  const isFlex = display === "flex" || display === "inline-flex";
  const isGrid = display === "grid" || display === "inline-grid";
  const parentIsFlex = (() => {
    const parent = element.parentElement;
    if (!parent) return false;
    const pd = getComputedStyle(parent).display;
    return pd === "flex" || pd === "inline-flex";
  })();
  const showTypography = isTextBearing(element);

  // ── Apply helper ──
  const apply = useCallback(
    (prop: string, value: string) => {
      applyInlineStyle(element, prop, value);
      onDirtyChange?.();
    },
    [element, onDirtyChange]
  );

  // ─── Section Handlers ──────────────────────────────────────────────

  // Layout
  const handleDisplayChange = useCallback(
    (v: string) => {
      setDisplay(v);
      apply("display", v);
    },
    [apply]
  );

  const handleFlexDirectionChange = useCallback(
    (v: string) => {
      const dir = v === "none" ? "row" : v;
      setFlexDirection(dir);
      apply("flex-direction", dir);
    },
    [apply]
  );

  const handleAlignChange = useCallback(
    (justify: string, align: string) => {
      setJustifyContent(justify);
      setAlignItems(align);
      apply("justify-content", justify);
      apply("align-items", align);
    },
    [apply]
  );

  const handleFlexWrapChange = useCallback(
    (v: string) => {
      setFlexWrap(v);
      apply("flex-wrap", v);
    },
    [apply]
  );

  const handleGapChange = useCallback(
    (v: number) => {
      setGap(v);
      apply("gap", `${v}px`);
    },
    [apply]
  );

  const handleGridColsChange = useCallback(
    (v: string) => { setGridCols(v); if (v.trim()) apply("grid-template-columns", v); },
    [apply]
  );
  const handleGridRowsChange = useCallback(
    (v: string) => { setGridRows(v); if (v.trim()) apply("grid-template-rows", v); },
    [apply]
  );

  const handleFlexGrowChange = useCallback(
    (v: number) => {
      setFlexGrow(v);
      apply("flex-grow", String(v));
    },
    [apply]
  );

  const handleFlexShrinkChange = useCallback(
    (v: number) => {
      setFlexShrink(v);
      apply("flex-shrink", String(v));
    },
    [apply]
  );

  const handleFlexBasisChange = useCallback(
    (v: number) => {
      setFlexBasis(v);
      apply("flex-basis", `${v}px`);
    },
    [apply]
  );

  const handleAlignSelfChange = useCallback(
    (v: string) => {
      setAlignSelf(v);
      apply("align-self", v);
    },
    [apply]
  );

  const handleFlexOrderChange = useCallback(
    (v: number) => {
      setFlexOrder(v);
      apply("order", String(v));
    },
    [apply]
  );

  // Size
  const handleWidthChange = useCallback((v: number) => { setWidth(v); apply("width", `${v}${widthUnit}`); }, [apply, widthUnit]);
  const handleHeightChange = useCallback((v: number) => { setHeight(v); apply("height", `${v}${heightUnit}`); }, [apply, heightUnit]);
  const handleMinWidthChange = useCallback((v: number) => { setMinWidth(v); apply("min-width", `${v}${minWidthUnit}`); }, [apply, minWidthUnit]);
  const handleMaxWidthChange = useCallback((v: number) => { setMaxWidth(v); apply("max-width", v === 0 ? "none" : `${v}${maxWidthUnit}`); }, [apply, maxWidthUnit]);
  const handleMinHeightChange = useCallback((v: number) => { setMinHeight(v); apply("min-height", `${v}${minHeightUnit}`); }, [apply, minHeightUnit]);
  const handleMaxHeightChange = useCallback((v: number) => { setMaxHeight(v); apply("max-height", v === 0 ? "none" : `${v}${maxHeightUnit}`); }, [apply, maxHeightUnit]);
  const handleOverflowChange = useCallback((v: string) => { setOverflow(v); apply("overflow", v); }, [apply]);

  // Size keyword toggles
  const handleWidthAutoToggle = useCallback(() => {
    const next = !widthAuto;
    setWidthAuto(next);
    apply("width", next ? "auto" : `${width}${widthUnit}`);
  }, [widthAuto, width, widthUnit, apply]);

  const handleHeightAutoToggle = useCallback(() => {
    const next = !heightAuto;
    setHeightAuto(next);
    apply("height", next ? "auto" : `${height}${heightUnit}`);
  }, [heightAuto, height, heightUnit, apply]);

  const handleMaxWidthNoneToggle = useCallback(() => {
    const next = !maxWidthNone;
    setMaxWidthNone(next);
    apply("max-width", next ? "none" : `${maxWidth}${maxWidthUnit}`);
  }, [maxWidthNone, maxWidth, maxWidthUnit, apply]);

  const handleMaxHeightNoneToggle = useCallback(() => {
    const next = !maxHeightNone;
    setMaxHeightNone(next);
    apply("max-height", next ? "none" : `${maxHeight}${maxHeightUnit}`);
  }, [maxHeightNone, maxHeight, maxHeightUnit, apply]);

  // Position
  const handlePositionChange = useCallback((v: string) => { setPosition(v); apply("position", v); }, [apply]);
  const handleTopChange = useCallback((v: number) => { setTop(v); apply("top", `${v}${topUnit}`); }, [apply, topUnit]);
  const handleRightChange = useCallback((v: number) => { setRight(v); apply("right", `${v}${rightUnit}`); }, [apply, rightUnit]);
  const handleBottomChange = useCallback((v: number) => { setBottom(v); apply("bottom", `${v}${bottomUnit}`); }, [apply, bottomUnit]);
  const handleLeftChange = useCallback((v: number) => { setLeft(v); apply("left", `${v}${leftUnit}`); }, [apply, leftUnit]);
  const handleZIndexChange = useCallback((v: number) => { setZIndex(v); apply("z-index", String(v)); }, [apply]);
  const handleFloatChange = useCallback((v: string) => { setFloat(v); apply("float", v); }, [apply]);
  const handleClearChange = useCallback((v: string) => { setClear(v); apply("clear", v); }, [apply]);

  // Typography
  const handleFontSizeChange = useCallback((v: number) => { setFontSize(v); apply("font-size", `${v}${fontSizeUnit}`); }, [apply, fontSizeUnit]);
  const handleFontWeightChange = useCallback((v: string) => { setFontWeight(v); apply("font-weight", v); }, [apply]);
  const handleLineHeightChange = useCallback((v: number) => { setLineHeight(v); apply("line-height", String(v)); }, [apply]);
  const handleLetterSpacingChange = useCallback((v: number) => { setLetterSpacing(v); apply("letter-spacing", `${v}${letterSpacingUnit}`); }, [apply, letterSpacingUnit]);
  const handleColorChange = useCallback((v: string) => { setColor(v); apply("color", v); }, [apply]);
  const handleTextAlignChange = useCallback((v: string) => { setTextAlign(v); apply("text-align", v); }, [apply]);
  const handleTextDecorationChange = useCallback((v: string) => { setTextDecoration(v); apply("text-decoration-line", v); }, [apply]);
  const handleTextTransformChange = useCallback((v: string) => { setTextTransform(v); apply("text-transform", v); }, [apply]);
  const handleFontStyleChange = useCallback(() => {
    const next = fontStyle === "italic" ? "normal" : "italic";
    setFontStyle(next);
    apply("font-style", next);
  }, [fontStyle, apply]);

  // Backgrounds
  const handleBgColorChange = useCallback((v: string) => { setBgColor(v); apply("background-color", v); }, [apply]);
  const handleBgLayersChange = useCallback(
    (layers: BackgroundLayer[]) => {
      setBgLayers(layers);
      // Build background parts from all layers
      const bgParts: string[] = [];
      let bgColor = "transparent";
      for (const layer of layers) {
        if (layer.type === "color") {
          bgColor = layer.color || "transparent";
        } else if (layer.type === "gradient" && layer.gradient) {
          const g = layer.gradient;
          const stops = g.stops
            .map((s) => `${s.color} ${s.position}%`)
            .join(", ");
          if (g.type === "linear") {
            bgParts.push(`linear-gradient(${g.angle}deg, ${stops})`);
          } else if (g.type === "radial") {
            bgParts.push(`radial-gradient(${stops})`);
          } else if (g.type === "conic") {
            bgParts.push(`conic-gradient(from ${g.angle}deg, ${stops})`);
          }
        } else if (layer.type === "image" && layer.image) {
          const img = layer.image;
          bgParts.push(
            `url(${img.url}) ${img.position} / ${img.size} ${img.repeat}`
          );
        }
      }
      // CSS background: gradients/images first, then color as the last layer
      if (bgParts.length > 0) {
        apply("background", bgParts.join(", "));
        apply("background-color", bgColor);
      } else {
        apply("background", "none");
        apply("background-color", bgColor);
      }
    },
    [apply]
  );

  // Borders
  const handleBorderStyleChange = useCallback((v: string) => {
    setBorderStyle(v);
    const prop = borderSide === "all" ? "border-style" : `border-${borderSide}-style`;
    apply(prop, v);
  }, [apply, borderSide]);
  const handleBorderWidthChange = useCallback((v: number) => {
    setBorderWidth(v);
    const prop = borderSide === "all" ? "border-width" : `border-${borderSide}-width`;
    apply(prop, `${v}px`);
  }, [apply, borderSide]);
  const handleBorderColorChange = useCallback((v: string) => {
    setBorderColor(v);
    const prop = borderSide === "all" ? "border-color" : `border-${borderSide}-color`;
    apply(prop, v);
  }, [apply, borderSide]);
  const handleCornerChange = useCallback(
    (corner: string, value: number) => {
      apply(corner, `${value}px`);
      if (corner === "border-top-left-radius") setRadiusTL(value);
      else if (corner === "border-top-right-radius") setRadiusTR(value);
      else if (corner === "border-bottom-right-radius") setRadiusBR(value);
      else if (corner === "border-bottom-left-radius") setRadiusBL(value);
    },
    [apply]
  );

  // Effects
  const handleOpacityChange = useCallback((v: number) => { setOpacity(v); apply("opacity", String(v)); }, [apply]);
  const handleOpacitySliderChange = useCallback((v: number) => handleOpacityChange(v / 100), [handleOpacityChange]);
  const handleMixBlendModeChange = useCallback((v: string) => { setMixBlendMode(v); apply("mix-blend-mode", v); }, [apply]);
  const handleShadowsChange = useCallback(
    (s: ShadowValue[]) => {
      setShadows(s);
      apply("box-shadow", shadowToCSS(s));
    },
    [apply]
  );
  const handleTransformsChange = useCallback(
    (t: TransformValue[]) => {
      setTransforms(t);
      apply("transform", transformToCSS(t));
    },
    [apply]
  );
  const handleTransformOriginChange = useCallback(
    (o: string) => {
      setTransformOrigin(o);
      apply("transform-origin", o);
    },
    [apply]
  );
  const handleFilterChange = useCallback(
    (key: string, value: number) => {
      const next = { ...filterValues, [key]: value };
      setFilterValues(next);
      apply("filter", filterToCSS(next));
    },
    [filterValues, apply]
  );
  const handleBackdropFilterChange = useCallback(
    (key: string, value: number) => {
      const next = { ...backdropFilterValues, [key]: value };
      setBackdropFilterValues(next);
      apply("backdrop-filter", filterToCSS(next));
    },
    [backdropFilterValues, apply]
  );
  const handleTransitionsChange = useCallback(
    (t: TransitionValue[]) => {
      setTransitions(t);
      apply("transition", transitionsToCSS(t));
    },
    [apply]
  );
  const handleCursorChange = useCallback((v: string) => { setCursor(v); apply("cursor", v); }, [apply]);
  const handlePointerEventsChange = useCallback((v: string) => { setPointerEvents(v); apply("pointer-events", v); }, [apply]);
  const handleVisibilityChange = useCallback((v: string) => { setVisibility(v); apply("visibility", v); }, [apply]);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* 1. Layout */}
      <Section title="Layout">
        <SelectRow label="Display" value={display} options={DISPLAY_OPTIONS} onChange={handleDisplayChange} />

        {isFlex && (
          <>
            <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
                Direction
              </span>
              <IconButtonGroup options={FLEX_DIRECTION_ICONS} value={flexDirection} onChange={handleFlexDirectionChange} />
            </div>
            <div style={{ padding: "6px 12px" }}>
              <AlignBox
                justify={justifyContent}
                align={alignItems}
                onChange={handleAlignChange}
                mode="flex"
              />
            </div>
            <SelectRow label="Wrap" value={flexWrap} options={FLEX_WRAP_OPTIONS} onChange={handleFlexWrapChange} />
            <SliderRow label="Gap" value={gap} min={0} max={200} step={1} unit="px" onChange={handleGapChange} />
          </>
        )}

        {isGrid && (
          <>
            <TextRow label="Columns" value={gridCols} placeholder="1fr 1fr 1fr" onChange={handleGridColsChange} />
            <TextRow label="Rows" value={gridRows} placeholder="auto" onChange={handleGridRowsChange} />
            <div style={{ padding: "6px 12px" }}>
              <AlignBox
                justify={justifyContent}
                align={alignItems}
                onChange={handleAlignChange}
                mode="grid"
              />
            </div>
            <SliderRow label="Gap" value={gap} min={0} max={200} step={1} unit="px" onChange={handleGapChange} />
          </>
        )}

        {parentIsFlex && (
          <>
            <div style={{ padding: "6px 12px 2px", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Flex Child
            </div>
            <SliderRow label="Grow" value={flexGrow} min={0} max={10} step={1} unit="" onChange={handleFlexGrowChange} />
            <SliderRow label="Shrink" value={flexShrink} min={0} max={10} step={1} unit="" onChange={handleFlexShrinkChange} />
            <SliderRow label="Basis" value={flexBasis} min={0} max={500} step={1} unit="px" onChange={handleFlexBasisChange} />
            <SelectRow label="Align Self" value={alignSelf} options={ALIGN_SELF_OPTIONS} onChange={handleAlignSelfChange} />
            <SliderRow label="Order" value={flexOrder} min={-10} max={100} step={1} unit="" onChange={handleFlexOrderChange} />
          </>
        )}
      </Section>

      {/* 2. Spacing */}
      <Section title="Spacing">
        <SpacingBoxModel
          margin={spacing.margin}
          padding={spacing.padding}
          onChange={onSpacingChange}
        />
      </Section>

      {/* 3. Size */}
      <Section title="Size">
        <SliderRow label="Width" value={width} min={0} max={1920} step={1} unit={widthUnit} units={SIZE_UNITS_W} onUnitChange={setWidthUnit} onChange={handleWidthChange} />
        <SliderRow label="Height" value={height} min={0} max={1200} step={1} unit={heightUnit} units={SIZE_UNITS_H} onUnitChange={setHeightUnit} onChange={handleHeightChange} />
        <SliderRow label="Min W" value={minWidth} min={0} max={1920} step={1} unit={minWidthUnit} units={SIZE_UNITS_W} onUnitChange={setMinWidthUnit} onChange={handleMinWidthChange} />
        <SliderRow label="Max W" value={maxWidth} min={0} max={1920} step={1} unit={maxWidthUnit} units={SIZE_UNITS_W} onUnitChange={setMaxWidthUnit} onChange={handleMaxWidthChange} />
        <SliderRow label="Min H" value={minHeight} min={0} max={1200} step={1} unit={minHeightUnit} units={SIZE_UNITS_H} onUnitChange={setMinHeightUnit} onChange={handleMinHeightChange} />
        <SliderRow label="Max H" value={maxHeight} min={0} max={1200} step={1} unit={maxHeightUnit} units={SIZE_UNITS_H} onUnitChange={setMaxHeightUnit} onChange={handleMaxHeightChange} />
        <SelectRow label="Overflow" value={overflow} options={OVERFLOW_OPTIONS} onChange={handleOverflowChange} />
      </Section>

      {/* 4. Position */}
      <Section title="Position" collapsed={position === "static"}>
        <SelectRow label="Position" value={position} options={POSITION_OPTIONS} onChange={handlePositionChange} />
        {position !== "static" && (
          <>
            <SliderRow label="Top" value={top} min={-200} max={200} step={1} unit={topUnit} units={POSITION_UNITS} onUnitChange={setTopUnit} onChange={handleTopChange} />
            <SliderRow label="Right" value={right} min={-200} max={200} step={1} unit={rightUnit} units={POSITION_UNITS} onUnitChange={setRightUnit} onChange={handleRightChange} />
            <SliderRow label="Bottom" value={bottom} min={-200} max={200} step={1} unit={bottomUnit} units={POSITION_UNITS} onUnitChange={setBottomUnit} onChange={handleBottomChange} />
            <SliderRow label="Left" value={left} min={-200} max={200} step={1} unit={leftUnit} units={POSITION_UNITS} onUnitChange={setLeftUnit} onChange={handleLeftChange} />
            <SliderRow label="Z-Index" value={zIndex} min={-10} max={9999} step={1} unit="" onChange={handleZIndexChange} />
          </>
        )}
        <SelectRow label="Float" value={float_} options={FLOAT_OPTIONS} onChange={handleFloatChange} />
        <SelectRow label="Clear" value={clear_} options={CLEAR_OPTIONS} onChange={handleClearChange} />
      </Section>

      {/* 5. Typography */}
      {showTypography && (
        <Section title="Typography">
          <SliderRow label="Size" value={fontSize} min={8} max={200} step={1} unit={fontSizeUnit} units={TYPO_SIZE_UNITS} onUnitChange={setFontSizeUnit} onChange={handleFontSizeChange} />
          <SelectRow label="Weight" value={fontWeight} options={FONT_WEIGHT_OPTIONS} onChange={handleFontWeightChange} />
          <SliderRow label="Line H" value={lineHeight} min={0.8} max={3} step={0.05} unit="" onChange={handleLineHeightChange} />
          <SliderRow label="Spacing" value={letterSpacing} min={-5} max={20} step={0.25} unit={letterSpacingUnit} units={TYPO_SIZE_UNITS} onUnitChange={setLetterSpacingUnit} onChange={handleLetterSpacingChange} />
          <ColorRow label="Color" value={color} onChange={handleColorChange} />

          <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
              Align
            </span>
            <IconButtonGroup options={TEXT_ALIGN_OPTIONS} value={textAlign} onChange={handleTextAlignChange} />
          </div>

          <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
              Decorate
            </span>
            <IconButtonGroup options={TEXT_DECORATION_OPTIONS} value={textDecoration} onChange={handleTextDecorationChange} multi />
          </div>

          <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
              Transform
            </span>
            <IconButtonGroup options={TEXT_TRANSFORM_OPTIONS} value={textTransform} onChange={handleTextTransformChange} />
          </div>

          <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "64px", fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
              Style
            </span>
            <button
              onClick={handleFontStyleChange}
              style={{
                height: "28px",
                minWidth: "28px",
                padding: "0 8px",
                cursor: "pointer",
                background: fontStyle === "italic" ? "#6366f1" : "transparent",
                color: fontStyle === "italic" ? "#fff" : "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "4px",
                fontSize: "12px",
                fontStyle: "italic",
                fontFamily: "Georgia, serif",
                lineHeight: 1,
                transition: "background 80ms, color 80ms",
              }}
            >
              I
            </button>
          </div>
        </Section>
      )}

      {/* 6. Backgrounds */}
      <Section title="Backgrounds">
        {bgLayers.length > 0 ? (
          <div style={{ padding: "0 12px" }}>
            <BackgroundLayerList layers={bgLayers} onChange={handleBgLayersChange} />
          </div>
        ) : (
          <ColorRow label="Color" value={bgColor} onChange={handleBgColorChange} />
        )}
      </Section>

      {/* 7. Borders */}
      <Section title="Borders">
        <SideSelector value={borderSide} onChange={setBorderSide} />
        <SelectRow label="Style" value={borderStyle} options={BORDER_STYLE_OPTIONS} onChange={handleBorderStyleChange} />
        <SliderRow label="Width" value={borderWidth} min={0} max={20} step={1} unit="px" onChange={handleBorderWidthChange} />
        <ColorRow label="Color" value={borderColor} onChange={handleBorderColorChange} />
        <div style={{ padding: "4px 12px 0", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Radius
        </div>
        <CornerRadiusEditor
          topLeft={radiusTL}
          topRight={radiusTR}
          bottomRight={radiusBR}
          bottomLeft={radiusBL}
          linked={radiusLinked}
          onChange={handleCornerChange}
          onLinkedChange={setRadiusLinked}
        />
      </Section>

      {/* 8. Effects */}
      <Section title="Effects">
        <SliderRow label="Opacity" value={Math.round(opacity * 100)} min={0} max={100} step={1} unit="%" onChange={handleOpacitySliderChange} />
        <SelectRow label="Blend" value={mixBlendMode} options={BLEND_MODE_OPTIONS} onChange={handleMixBlendModeChange} />

        <div style={{ padding: "8px 12px 0", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Box Shadow
        </div>
        <ShadowEditor shadows={shadows} onChange={handleShadowsChange} />

        <div style={{ padding: "8px 12px 0", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Transform
        </div>
        <div style={{ padding: "4px 12px" }}>
          <TransformEditor
            transforms={transforms}
            onChange={handleTransformsChange}
            origin={transformOrigin}
            onOriginChange={handleTransformOriginChange}
          />
        </div>

        <div style={{ padding: "4px 12px" }}>
          <FilterSliders values={filterValues} onChange={handleFilterChange} type="filter" />
        </div>

        <div style={{ padding: "4px 12px" }}>
          <FilterSliders values={backdropFilterValues} onChange={handleBackdropFilterChange} type="backdrop-filter" />
        </div>

        <div style={{ padding: "8px 12px 0", fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Transition
        </div>
        <div style={{ padding: "4px 12px" }}>
          <TransitionEditor transitions={transitions} onChange={handleTransitionsChange} />
        </div>

        <SelectRow label="Cursor" value={cursor} options={CURSOR_OPTIONS} onChange={handleCursorChange} />
        <SelectRow label="Pointer" value={pointerEvents} options={POINTER_EVENTS_OPTIONS} onChange={handlePointerEventsChange} />
        <SelectRow label="Visibility" value={visibility} options={VISIBILITY_OPTIONS} onChange={handleVisibilityChange} />
      </Section>
    </div>
  );
}
