/**
 * ColorPickerEnhanced.tsx — Custom color picker matching Webflow Designer
 *
 * Features:
 * - 2D saturation/brightness canvas (click/drag)
 * - Hue slider (0-360)
 * - Opacity slider (0-100%)
 * - Hex text input
 * - Popover with click-outside dismissal
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { hexToRgb, rgbToHex, isValidHex } from "./colorUtils";

// ─── Color Math (picker-specific — HSB conversions) ──────────────

function rgbToHsb(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; b: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, b: max };
}

function hsbToRgb(
  h: number,
  s: number,
  brightness: number,
): { r: number; g: number; b: number } {
  const c = brightness * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = brightness - c;
  let r = 0,
    g = 0,
    bl = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    bl = x;
  } else if (h < 240) {
    g = x;
    bl = c;
  } else if (h < 300) {
    r = x;
    bl = c;
  } else {
    r = c;
    bl = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((bl + m) * 255),
  };
}

// ─── Types ───────────────────────────────────────────────────────

export interface ColorPickerEnhancedProps {
  color: string; // Current hex color (e.g., "#ff0000")
  opacity?: number; // 0-1, default 1
  onChange: (hex: string, opacity: number) => void;
  onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────

const CANVAS_W = 216;
const CANVAS_H = 150;
const SLIDER_H = 12;
const HANDLE_SIZE = 14;

// ─── Checkerboard pattern for opacity backgrounds ────────────────

const CHECKER =
  "repeating-conic-gradient(#444 0% 25%, #666 0% 50%) 50%/8px 8px";

// ─── Component ───────────────────────────────────────────────────

export function ColorPickerEnhanced({
  color,
  opacity = 1,
  onChange,
  onClose,
}: ColorPickerEnhancedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Parse initial color into HSB
  const initial = hexToRgb(isValidHex(color) ? color : "#ff0000");
  const initialHsb = rgbToHsb(initial.r, initial.g, initial.b);

  const [hue, setHue] = useState(initialHsb.h);
  const [sat, setSat] = useState(initialHsb.s);
  const [bri, setBri] = useState(initialHsb.b);
  const [alpha, setAlpha] = useState(opacity);
  const [hexInput, setHexInput] = useState(color.toUpperCase());

  // Derived hex from HSB
  const currentRgb = hsbToRgb(hue, sat, bri);
  const currentHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);

  // Emit changes
  const emitChange = useCallback(
    (h: number, s: number, b: number, a: number) => {
      const rgb = hsbToRgb(h, s, b);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      onChange(hex, a);
    },
    [onChange],
  );

  // ─── Drag state (suppresses click-outside during drag) ──────
  const isDraggingRef = useRef(false);

  // ─── Click-outside dismissal ─────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isDraggingRef.current) return;
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // ─── Draw the 2D canvas ──────────────────────────────────────

  const drawCanvas = useCallback(
    (h: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const hCanvas = canvas.height;

      // Fill with hue color
      const hueRgb = hsbToRgb(h, 1, 1);
      ctx.fillStyle = `rgb(${hueRgb.r},${hueRgb.g},${hueRgb.b})`;
      ctx.fillRect(0, 0, w, hCanvas);

      // White gradient left-to-right
      const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
      whiteGrad.addColorStop(0, "rgba(255,255,255,1)");
      whiteGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = whiteGrad;
      ctx.fillRect(0, 0, w, hCanvas);

      // Black gradient top-to-bottom
      const blackGrad = ctx.createLinearGradient(0, 0, 0, hCanvas);
      blackGrad.addColorStop(0, "rgba(0,0,0,0)");
      blackGrad.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = blackGrad;
      ctx.fillRect(0, 0, w, hCanvas);
    },
    [],
  );

  useEffect(() => {
    drawCanvas(hue);
  }, [hue, drawCanvas]);

  // ─── Sync hex input with HSB state ────────────────────────────

  useEffect(() => {
    setHexInput(currentHex.toUpperCase());
  }, [currentHex]);

  // ─── Drag helpers ─────────────────────────────────────────────

  const startDrag = useCallback(
    (
      onMove: (clientX: number, clientY: number) => void,
      e: React.MouseEvent,
    ) => {
      isDraggingRef.current = true;
      onMove(e.clientX, e.clientY);
      const move = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY);
      const up = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    },
    [],
  );

  // ─── Canvas (saturation/brightness) interaction ───────────────

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      startDrag((clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        const s = Math.max(
          0,
          Math.min(1, (clientX - rect.left) / rect.width),
        );
        const b = Math.max(
          0,
          Math.min(1, 1 - (clientY - rect.top) / rect.height),
        );
        setSat(s);
        setBri(b);
        emitChange(hue, s, b, alpha);
      }, e);
    },
    [hue, alpha, startDrag, emitChange],
  );

  // ─── Hue slider interaction ───────────────────────────────────

  const handleHueMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      startDrag((clientX) => {
        const rect = target.getBoundingClientRect();
        const h = Math.max(
          0,
          Math.min(360, ((clientX - rect.left) / rect.width) * 360),
        );
        setHue(h);
        emitChange(h, sat, bri, alpha);
      }, e);
    },
    [sat, bri, alpha, startDrag, emitChange],
  );

  // ─── Opacity slider interaction ───────────────────────────────

  const handleOpacityMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      startDrag((clientX) => {
        const rect = target.getBoundingClientRect();
        const a = Math.max(
          0,
          Math.min(1, (clientX - rect.left) / rect.width),
        );
        setAlpha(a);
        emitChange(hue, sat, bri, a);
      }, e);
    },
    [hue, sat, bri, startDrag, emitChange],
  );

  // ─── Hex input handler ────────────────────────────────────────

  const applyHexInput = useCallback(() => {
    let val = hexInput.trim();
    if (!val.startsWith("#")) val = "#" + val;
    if (isValidHex(val)) {
      const rgb = hexToRgb(val);
      const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
      setHue(hsb.h);
      setSat(hsb.s);
      setBri(hsb.b);
      emitChange(hsb.h, hsb.s, hsb.b, alpha);
    } else {
      // Revert to current valid hex
      setHexInput(currentHex.toUpperCase());
    }
  }, [hexInput, alpha, currentHex, emitChange]);

  // ─── Render ───────────────────────────────────────────────────

  // Canvas handle position
  const handleX = sat * CANVAS_W;
  const handleY = (1 - bri) * CANVAS_H;

  // Hue handle position
  const hueX = (hue / 360) * CANVAS_W;

  // Opacity handle position
  const opacityX = alpha * CANVAS_W;

  const handleStyle: React.CSSProperties = {
    position: "absolute",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 2px rgba(0,0,0,0.6)",
    pointerEvents: "none",
    transform: "translate(-50%, -50%)",
  };

  const sliderHandleStyle: React.CSSProperties = {
    ...handleStyle,
    top: "50%",
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        zIndex: 99999,
        width: 240,
        background: "#2a2a2a",
        borderRadius: 8,
        padding: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        userSelect: "none",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ── 2D Saturation / Brightness Canvas ──────────────── */}
      <div
        style={{
          position: "relative",
          width: CANVAS_W,
          height: CANVAS_H,
          borderRadius: 4,
          overflow: "hidden",
          cursor: "crosshair",
        }}
        onMouseDown={handleCanvasMouseDown}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: "block", width: CANVAS_W, height: CANVAS_H }}
        />
        {/* Handle */}
        <div
          style={{
            ...handleStyle,
            left: handleX,
            top: handleY,
            background: currentHex,
          }}
        />
      </div>

      {/* ── Hue Slider ─────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: CANVAS_W,
          height: SLIDER_H,
          borderRadius: 6,
          background:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          cursor: "pointer",
        }}
        onMouseDown={handleHueMouseDown}
      >
        <div
          style={{
            ...sliderHandleStyle,
            left: hueX,
            background: `hsl(${hue}, 100%, 50%)`,
          }}
        />
      </div>

      {/* ── Opacity Slider ─────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: CANVAS_W,
          height: SLIDER_H,
          borderRadius: 6,
          background: CHECKER,
          cursor: "pointer",
          overflow: "hidden",
        }}
        onMouseDown={handleOpacityMouseDown}
      >
        {/* Color gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 6,
            background: `linear-gradient(to right, transparent, ${currentHex})`,
          }}
        />
        <div
          style={{
            ...sliderHandleStyle,
            left: opacityX,
            background: currentHex,
          }}
        />
      </div>

      {/* ── Hex Input + Opacity ────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Hex input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flex: 1,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
            }}
          >
            HEX
          </span>
          <input
            type="text"
            value={hexInput}
            maxLength={7}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={applyHexInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyHexInput();
            }}
            style={{
              flex: 1,
              background: "#1e1e1e",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 4,
              padding: "3px 6px",
              fontSize: 11,
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: "rgba(255,255,255,0.8)",
              outline: "none",
              minWidth: 0,
            }}
          />
        </div>

        {/* Opacity display */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
            }}
          >
            A
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              color: "rgba(255,255,255,0.7)",
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {Math.round(alpha * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
