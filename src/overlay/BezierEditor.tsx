/**
 * BezierEditor.tsx — Visual cubic-bezier curve editor
 *
 * Standalone component for editing cubic-bezier(x1, y1, x2, y2) values
 * with a draggable canvas, preset buttons, and preview animation.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { X } from "lucide-react";

export interface BezierEditorProps {
  value: [number, number, number, number]; // [x1, y1, x2, y2]
  onChange: (value: [number, number, number, number]) => void;
  onClose?: () => void;
}

const PRESETS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

const CANVAS_SIZE = 200;
const PAD = 20;

export function BezierEditor({ value, onChange, onClose }: BezierEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animKey, setAnimKey] = useState(0);

  // Restart preview animation when value changes
  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [value[0], value[1], value[2], value[3]]);

  // Inject keyframe animation style
  useEffect(() => {
    const id = "tuner-bezier-anim";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent =
        "@keyframes tuner-bezier-preview { from { left: 4px; } to { left: calc(100% - 20px); } }";
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  // Draw the bezier curve on canvas
  const drawCurve = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    ctx.scale(dpr, dpr);

    const w = CANVAS_SIZE;
    const h = CANVAS_SIZE;
    const pad = PAD;

    ctx.clearRect(0, 0, w, h);

    // Map normalized (0-1) to canvas coords
    const toX = (v: number) => pad + v * (w - 2 * pad);
    const toY = (v: number) => h - pad - v * (h - 2 * pad); // flip Y

    // Background grid
    ctx.strokeStyle = "rgba(0,0,0,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = pad + (i / 4) * (w - 2 * pad);
      const y = pad + (i / 4) * (h - 2 * pad);
      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, h - pad);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    }

    // Diagonal reference (linear)
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.lineTo(toX(1), toY(1));
    ctx.stroke();
    ctx.setLineDash([]);

    // Control point lines (dashed)
    ctx.strokeStyle = "rgba(193, 122, 80, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.lineTo(toX(value[0]), toY(value[1]));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(toX(1), toY(1));
    ctx.lineTo(toX(value[2]), toY(value[3]));
    ctx.stroke();
    ctx.setLineDash([]);

    // Bezier curve
    ctx.strokeStyle = "#c17a50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.bezierCurveTo(
      toX(value[0]),
      toY(value[1]),
      toX(value[2]),
      toY(value[3]),
      toX(1),
      toY(1)
    );
    ctx.stroke();

    // Control points (circles)
    const drawPoint = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toX(x), toY(y), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    drawPoint(value[0], value[1], "#c17a50");
    drawPoint(value[2], value[3], "#c17a50");
  }, [value]);

  // Redraw on mount and value change
  useEffect(() => {
    drawCurve();
  }, [drawCurve]);

  // Drag handling
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pad = PAD;
      const w = CANVAS_SIZE;
      const h = CANVAS_SIZE;

      const toNormX = (px: number) => (px - pad) / (w - 2 * pad);
      const toNormY = (py: number) => 1 - (py - pad) / (h - 2 * pad);

      const scaleX = w / rect.width;
      const scaleY = h / rect.height;

      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      // Canvas coords of each control point
      const p1x = pad + value[0] * (w - 2 * pad);
      const p1y = h - pad - value[1] * (h - 2 * pad);
      const p2x = pad + value[2] * (w - 2 * pad);
      const p2y = h - pad - value[3] * (h - 2 * pad);

      const d1 = Math.hypot(mx - p1x, my - p1y);
      const d2 = Math.hypot(mx - p2x, my - p2y);
      const point = d1 < d2 ? 0 : 1; // 0 = P1, 1 = P2

      // Capture current value to avoid stale closures
      let currentValue: [number, number, number, number] = [...value];

      const update = (clientX: number, clientY: number) => {
        const px = (clientX - rect.left) * scaleX;
        const py = (clientY - rect.top) * scaleY;
        const nx = Math.max(0, Math.min(1, toNormX(px)));
        const ny = Math.max(-0.5, Math.min(1.5, toNormY(py)));
        const newValue: [number, number, number, number] = [...currentValue];
        newValue[point * 2] = Math.round(nx * 100) / 100;
        newValue[point * 2 + 1] = Math.round(ny * 100) / 100;
        currentValue = newValue;
        onChange(newValue);
      };

      update(e.clientX, e.clientY);

      const onMove = (ev: MouseEvent) => update(ev.clientX, ev.clientY);
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [value, onChange]
  );

  return (
    <div
      style={{
        background: "#eae5df",
        borderRadius: "6px",
        padding: "10px",
        width: "240px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Close button (if onClose provided) */}
      {onClose && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "4px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(0,0,0,0.35)",
              cursor: "pointer",
              fontSize: "14px",
              fontFamily: "system-ui, sans-serif",
              padding: "0 2px",
              lineHeight: 1,
              borderRadius: "2px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                "rgba(0,0,0,0.7)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                "rgba(0,0,0,0.35)";
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE * 2}
          height={CANVAS_SIZE * 2}
          onMouseDown={handleMouseDown}
          style={{
            width: `${CANVAS_SIZE}px`,
            height: `${CANVAS_SIZE}px`,
            borderRadius: "4px",
            border: "1px solid rgba(0,0,0,0.07)",
            cursor: "crosshair",
            background: "rgba(0,0,0,0.2)",
          }}
        />
      </div>

      {/* Preview animation */}
      <div
        style={{
          position: "relative",
          height: "24px",
          background: "rgba(0,0,0,0.04)",
          borderRadius: "4px",
          marginTop: "8px",
        }}
      >
        <div
          key={animKey}
          style={{
            position: "absolute",
            top: "4px",
            left: "4px",
            width: "16px",
            height: "16px",
            borderRadius: "3px",
            background: "#c17a50",
            animation: `tuner-bezier-preview 1.5s cubic-bezier(${value.join(",")}) infinite alternate`,
          }}
        />
      </div>

      {/* Preset buttons */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginTop: "8px",
          flexWrap: "wrap",
        }}
      >
        {Object.entries(PRESETS).map(([name, preset]) => {
          const isActive =
            value[0] === preset[0] &&
            value[1] === preset[1] &&
            value[2] === preset[2] &&
            value[3] === preset[3];
          return (
            <button
              key={name}
              onClick={() => onChange(preset)}
              style={{
                padding: "2px 6px",
                fontSize: "9px",
                borderRadius: "3px",
                border: "1px solid rgba(0,0,0,0.12)",
                cursor: "pointer",
                background: isActive ? "#c17a50" : "transparent",
                color: isActive ? "#fff" : "rgba(0,0,0,0.45)",
                fontFamily: "system-ui, sans-serif",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(0,0,0,0.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                }
              }}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Value display */}
      <div
        style={{
          fontSize: "10px",
          color: "rgba(0,0,0,0.35)",
          textAlign: "center",
          marginTop: "6px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
        }}
      >
        cubic-bezier({value.map((v) => v.toFixed(2)).join(", ")})
      </div>
    </div>
  );
}
