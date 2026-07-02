/**
 * GradientEditor.tsx — Visual gradient editor with draggable color stops
 *
 * Supports linear, radial, and conic gradients. Stops are dragged along
 * a preview bar; click empty space to add, × to delete (min 2).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { SwatchColorPicker } from "../controls/SwatchColorPicker";
import { hexToRgba } from "../colorUtils";
import { parseVarRef } from "../variables/colorVariables";
import { splitCSSList } from "../cssParsers";
import { ms } from "../timing";
import { color, text, surface, font, blackAlpha, border, primaryAlpha } from "../theme";

export interface GradientStop {
  color: string;
  position: number; // 0-100
}

export interface GradientEditorProps {
  type: "linear" | "radial" | "conic";
  angle: number;
  stops: GradientStop[];
  onChange: (gradient: { type: string; angle: number; stops: GradientStop[] }) => void;
}

export function buildGradientCSS(
  type: "linear" | "radial" | "conic",
  angle: number,
  stops: GradientStop[]
): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const stopStr = sorted.map((s) => `${s.color} ${s.position}%`).join(", ");
  if (type === "linear") return `linear-gradient(${angle}deg, ${stopStr})`;
  if (type === "radial") return `radial-gradient(circle, ${stopStr})`;
  return `conic-gradient(from ${angle}deg, ${stopStr})`;
}

/** `to <side-or-corner>` keywords mapped to their equivalent angles. */
const DIR_TO_ANGLE: Record<string, number> = {
  "top": 0, "right": 90, "bottom": 180, "left": 270,
  "top right": 45, "right top": 45,
  "bottom right": 135, "right bottom": 135,
  "bottom left": 225, "left bottom": 225,
  "top left": 315, "left top": 315,
};

/**
 * Inverse of buildGradientCSS — parse a gradient string (authored or computed)
 * back into the editor's { type, angle, stops } model. Conservative: returns
 * null for anything the editor can't round-trip losslessly (repeating
 * gradients, px-positioned or double-position stops, interpolation hints,
 * explicit radial shapes/positions), so callers can pass those through raw
 * instead of mangling them.
 */
export function parseGradientCSS(
  css: string,
): { type: "linear" | "radial" | "conic"; angle: number; stops: GradientStop[] } | null {
  const m = css.trim().match(/^(linear|radial|conic)-gradient\((.*)\)$/s);
  if (!m) return null;
  const type = m[1] as "linear" | "radial" | "conic";
  const args = splitCSSList(m[2]);
  if (args.length === 0) return null;

  let angle = type === "linear" ? 180 : 0;
  let rest = args;
  const head = args[0];
  const numRe = /^-?\d+(?:\.\d+)?/;

  if (type === "linear") {
    const deg = head.match(/^(-?\d+(?:\.\d+)?)deg$/);
    if (deg) {
      angle = parseFloat(deg[1]);
      rest = args.slice(1);
    } else if (head.startsWith("to ")) {
      const mapped = DIR_TO_ANGLE[head.slice(3).trim()];
      if (mapped === undefined) return null;
      angle = mapped;
      rest = args.slice(1);
    }
  } else if (type === "radial") {
    if (head === "circle") rest = args.slice(1);
    else if (/^(circle|ellipse)\b|\bat\b|closest-|farthest-/.test(head)) return null;
  } else {
    const from = head.match(/^from\s+(-?\d+(?:\.\d+)?)deg$/);
    if (from) {
      angle = parseFloat(from[1]);
      rest = args.slice(1);
    } else if (/^(from|at)\b/.test(head)) return null;
  }

  const stops: GradientStop[] = [];
  for (let i = 0; i < rest.length; i++) {
    const s = rest[i].trim();
    const pm = s.match(/^(.*?)\s+(-?\d+(?:\.\d+)?)%$/s);
    let stopColor: string;
    let position: number;
    if (pm) {
      stopColor = pm[1].trim();
      // A trailing length/percent on the color part means a double-position
      // or px-positioned stop — not representable in the editor.
      if (/\s-?\d+(?:\.\d+)?(%|[a-z]+)$/i.test(stopColor)) return null;
      position = parseFloat(pm[2]);
    } else {
      if (/\d(px|em|rem|ch|vw|vh)$/i.test(s)) return null;
      stopColor = s;
      position = rest.length === 1 ? 0 : Math.round((i / (rest.length - 1)) * 100);
    }
    // Bare numbers are interpolation hints, not colors.
    if (!stopColor || numRe.test(stopColor)) return null;
    stops.push({ color: stopColor, position });
  }
  if (stops.length < 2) return null;
  return { type, angle, stops };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function GradientEditor({ type, angle, stops, onChange }: GradientEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const emit = useCallback(
    (patch: Partial<{ type: string; angle: number; stops: GradientStop[] }>) => {
      onChange({ type, angle, stops, ...patch });
    },
    [type, angle, stops, onChange]
  );

  // --- Drag logic ---
  const positionFromEvent = useCallback((clientX: number): number => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 0, 100);
  }, []);

  const handleMarkerDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      e.preventDefault();
      setSelectedIndex(index);
      dragIndexRef.current = index;
      setDragging(true);
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;

    function handleMove(e: MouseEvent) {
      const idx = dragIndexRef.current;
      if (idx === null) return;
      const pos = positionFromEvent(e.clientX);
      const next = stops.map((s, i) => (i === idx ? { ...s, position: pos } : s));
      emit({ stops: next });
    }

    function handleUp() {
      setDragging(false);
      dragIndexRef.current = null;
    }

    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, stops, emit, positionFromEvent]);

  // --- Add stop on bar click ---
  const handleBarClick = useCallback(
    (e: React.MouseEvent) => {
      // Ignore if click originated from a marker
      if ((e.target as HTMLElement).dataset.marker) return;
      const pos = positionFromEvent(e.clientX);
      // Interpolate color from nearest neighbours (simple: just use white)
      const newStop: GradientStop = { color: "#ffffff", position: pos };
      const next = [...stops, newStop];
      setSelectedIndex(next.length - 1);
      emit({ stops: next });
    },
    [stops, emit, positionFromEvent]
  );

  // --- Delete selected stop ---
  const handleDelete = useCallback(() => {
    if (selectedIndex === null || stops.length <= 2) return;
    const next = stops.filter((_, i) => i !== selectedIndex);
    setSelectedIndex(null);
    emit({ stops: next });
  }, [selectedIndex, stops, emit]);

  // --- Keyboard equivalent of marker dragging (issue #85) ---
  // Arrows nudge ±1 (Shift = ±10), Home/End jump to the rail ends,
  // Enter/Space select, Delete/Backspace remove (min 2 stops, like mouse).
  const handleMarkerKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const stop = stops[index];
      if (!stop) return;
      const moveTo = (position: number) => {
        e.preventDefault();
        setSelectedIndex(index);
        const next = stops.map((s, i) =>
          i === index ? { ...s, position: clamp(position, 0, 100) } : s
        );
        emit({ stops: next });
      };
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          moveTo(stop.position - (e.shiftKey ? 10 : 1));
          break;
        case "ArrowRight":
        case "ArrowUp":
          moveTo(stop.position + (e.shiftKey ? 10 : 1));
          break;
        case "Home":
          moveTo(0);
          break;
        case "End":
          moveTo(100);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          setSelectedIndex(index);
          break;
        case "Delete":
        case "Backspace":
          if (stops.length > 2) {
            e.preventDefault();
            setSelectedIndex(null);
            emit({ stops: stops.filter((_, i) => i !== index) });
          }
          break;
      }
    },
    [stops, emit]
  );

  // --- Keyboard equivalent of click-to-add: Enter/Space on the bar adds a
  // stop at the 50% midpoint (mouse adds at the pointer position) ---
  const handleBarKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const newStop: GradientStop = { color: "#ffffff", position: 50 };
      const next = [...stops, newStop];
      setSelectedIndex(next.length - 1);
      emit({ stops: next });
    },
    [stops, emit]
  );

  const selected = selectedIndex !== null ? stops[selectedIndex] : null;

  const typeOptions: Array<"linear" | "radial" | "conic"> = ["linear", "radial", "conic"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Type selector */}
      <div style={{ display: "inline-flex" }}>
        {typeOptions.map((t, i) => {
          const isActive = t === type;
          const isFirst = i === 0;
          const isLast = i === typeOptions.length - 1;
          return (
            <button
              key={t}
              onClick={() => emit({ type: t })}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "28px",
                padding: "0 10px",
                cursor: "pointer",
                background: isActive ? color.primary : "transparent",
                color: isActive ? color.primaryForeground : text.label,
                border: `1px solid ${surface.track}`,
                borderLeft: isFirst ? `1px solid ${surface.track}` : "none",
                borderRadius: isFirst ? "4px 0 0 4px" : isLast ? "0 4px 4px 0" : "0",
                fontSize: "11px",
                fontFamily: font.sans,
                lineHeight: 1,
                textTransform: "capitalize",
                transition: `background ${ms("fast")}, color ${ms("fast")}`,
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Angle slider — linear only */}
      {type === "linear" && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "11px",
              fontFamily: font.sans,
              color: text.label,
              minWidth: "36px",
            }}
          >
            Angle
          </span>
          <input
            type="range"
            min={0}
            max={360}
            value={angle}
            onChange={(e) => emit({ angle: Number(e.target.value) })}
            style={{ flex: 1, accentColor: color.primary }}
          />
          <span
            style={{
              fontSize: "11px",
              fontFamily: font.mono,
              color: text.label,
              minWidth: "32px",
              textAlign: "right",
            }}
          >
            {angle}°
          </span>
        </div>
      )}

      {/* Gradient preview bar + markers */}
      <div style={{ position: "relative", paddingBottom: "14px" }}>
        <div
          ref={barRef}
          role="button"
          tabIndex={0}
          aria-label="Add gradient stop"
          onClick={handleBarClick}
          onKeyDown={handleBarKeyDown}
          style={{
            width: "100%",
            height: "24px",
            borderRadius: "4px",
            background: buildGradientCSS(type, angle, stops),
            border: `1px solid ${blackAlpha(0.12)}`,
            cursor: "crosshair",
          }}
        />

        {/* Stop markers — focusable sliders: focusing selects, arrows nudge,
            Delete removes (issue #85). Mouse dragging is unchanged. */}
        {stops.map((stop, i) => {
          const isSelected = i === selectedIndex;
          return (
            <div
              key={i}
              data-marker="true"
              role="slider"
              tabIndex={0}
              aria-label={`Gradient stop ${i + 1} of ${stops.length}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stop.position}
              aria-valuetext={`${stop.position}%`}
              onFocus={() => setSelectedIndex(i)}
              onMouseDown={(e) => handleMarkerDown(e, i)}
              onKeyDown={(e) => handleMarkerKeyDown(e, i)}
              style={{
                position: "absolute",
                left: `${stop.position}%`,
                top: "24px",
                transform: "translateX(-4px)",
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderBottom: `8px solid ${isSelected ? color.primary : blackAlpha(0.6)}`,
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>

      {/* Selected stop controls */}
      {selected && selectedIndex !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Color swatch + picker */}
          <SwatchColorPicker
            key={selectedIndex}
            value={selected.color}
            title={`Stop color: ${selected.color}`}
            swatchStyle={{
              width: "24px",
              height: "24px",
              borderRadius: "4px",
              border: parseVarRef(selected.color)
                ? `2px solid ${primaryAlpha(0.6)}`
                : `1px solid ${border.default}`,
            }}
            onChange={(hex, opacity) => {
              const c = opacity < 1 ? hexToRgba(hex, opacity) : hex;
              const next = stops.map((s, i) =>
                i === selectedIndex ? { ...s, color: c } : s
              );
              emit({ stops: next });
            }}
            onSelectVariable={(varExpr) => {
              const next = stops.map((s, i) =>
                i === selectedIndex ? { ...s, color: varExpr } : s
              );
              emit({ stops: next });
            }}
          />

          {/* Position */}
          <input
            type="number"
            min={0}
            max={100}
            value={selected.position}
            onChange={(e) => {
              const pos = clamp(Number(e.target.value), 0, 100);
              const next = stops.map((s, i) =>
                i === selectedIndex ? { ...s, position: pos } : s
              );
              emit({ stops: next });
            }}
            style={{
              width: "48px",
              height: "24px",
              background: color.input,
              border: `1px solid ${blackAlpha(0.08)}`,
              borderRadius: "3px",
              color: text.primary,
              fontSize: "11px",
              fontFamily: font.mono,
              padding: "0 4px",
              textAlign: "right",
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontFamily: font.mono,
              color: text.disabled,
            }}
          >
            %
          </span>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={stops.length <= 2}
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              background: "transparent",
              border: "none",
              borderRadius: "3px",
              color: stops.length <= 2 ? blackAlpha(0.23) : text.disabled,
              fontSize: "14px",
              cursor: stops.length <= 2 ? "default" : "pointer",
              fontFamily: font.sans,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* CSS output */}
      <div
        style={{
          fontSize: "10px",
          fontFamily: font.mono,
          color: text.disabled,
          wordBreak: "break-all",
          lineHeight: "14px",
        }}
      >
        {buildGradientCSS(type, angle, stops)}
      </div>
    </div>
  );
}
