/**
 * GradientEditor.tsx — Visual gradient editor with draggable color stops
 *
 * Supports linear, radial, and conic gradients. Stops are dragged along
 * a preview bar; click empty space to add, × to delete (min 2).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { ms } from "./timing";

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

function buildGradientCSS(
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
                background: isActive ? "#6366f1" : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderLeft: isFirst ? "1px solid rgba(255,255,255,0.15)" : "none",
                borderRadius: isFirst ? "4px 0 0 4px" : isLast ? "0 4px 4px 0" : "0",
                fontSize: "11px",
                fontFamily: "system-ui, sans-serif",
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
              fontFamily: "system-ui, sans-serif",
              color: "rgba(255,255,255,0.5)",
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
            style={{ flex: 1, accentColor: "#6366f1" }}
          />
          <span
            style={{
              fontSize: "11px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: "rgba(255,255,255,0.7)",
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
          onClick={handleBarClick}
          style={{
            width: "100%",
            height: "24px",
            borderRadius: "4px",
            background: buildGradientCSS(type, angle, stops),
            border: "1px solid rgba(255,255,255,0.15)",
            cursor: "crosshair",
          }}
        />

        {/* Stop markers */}
        {stops.map((stop, i) => {
          const isSelected = i === selectedIndex;
          return (
            <div
              key={i}
              data-marker="true"
              onMouseDown={(e) => handleMarkerDown(e, i)}
              style={{
                position: "absolute",
                left: `${stop.position}%`,
                top: "24px",
                transform: "translateX(-4px)",
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderBottom: `8px solid ${isSelected ? "#6366f1" : "rgba(255,255,255,0.7)"}`,
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>

      {/* Selected stop controls */}
      {selected && selectedIndex !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Color swatch + input */}
          <div style={{ position: "relative", width: "24px", height: "24px", flexShrink: 0 }}>
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "4px",
                background: selected.color,
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            />
            <input
              type="color"
              value={selected.color}
              onChange={(e) => {
                const next = stops.map((s, i) =>
                  i === selectedIndex ? { ...s, color: e.target.value } : s
                );
                emit({ stops: next });
              }}
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
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "3px",
              color: "rgba(255,255,255,0.9)",
              fontSize: "11px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              padding: "0 4px",
              textAlign: "right",
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: "rgba(255,255,255,0.4)",
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
              color: stops.length <= 2 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.4)",
              fontSize: "14px",
              cursor: stops.length <= 2 ? "default" : "pointer",
              fontFamily: "system-ui, sans-serif",
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
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          color: "rgba(255,255,255,0.35)",
          wordBreak: "break-all",
          lineHeight: "14px",
        }}
      >
        {buildGradientCSS(type, angle, stops)}
      </div>
    </div>
  );
}
