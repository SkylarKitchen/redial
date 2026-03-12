/**
 * ColorPickerEnhanced.tsx — Custom color picker matching Webflow Designer
 *
 * Features:
 * - 2D saturation/brightness canvas (click/drag)
 * - Hue slider (0-360)
 * - Opacity slider (0-100%)
 * - HSB/RGB/Hex mode toggle
 * - Saved color swatches (localStorage-persisted, max 16)
 * - Popover with click-outside dismissal
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { hexToRgb, rgbToHex, isValidHex } from "./colorUtils";
import { ms } from "./timing";

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

// ─── EyeDropper API availability ─────────────────────────────────

const hasEyeDropper =
  typeof window !== "undefined" && "EyeDropper" in window;

// ─── Constants ───────────────────────────────────────────────────

const CANVAS_W = 216;
const CANVAS_H = 150;
const SLIDER_H = 12;
const HANDLE_SIZE = 14;
const SWATCHES_KEY = "__tuner-color-swatches";
const MAX_SWATCHES = 16;

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
  const [colorMode, setColorMode] = useState<"hex" | "rgb" | "hsb">("hex");

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

  // ─── Swatches (persisted via localStorage) ──────────────────
  const [swatches, setSwatches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(SWATCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const saveSwatches = useCallback((next: string[]) => {
    setSwatches(next);
    try { localStorage.setItem(SWATCHES_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const addSwatch = useCallback(() => {
    const hex = currentHex.toUpperCase();
    if (swatches.includes(hex)) return;
    const next = [hex, ...swatches].slice(0, MAX_SWATCHES);
    saveSwatches(next);
  }, [currentHex, swatches, saveSwatches]);

  const removeSwatch = useCallback((idx: number) => {
    const next = swatches.filter((_, i) => i !== idx);
    saveSwatches(next);
  }, [swatches, saveSwatches]);

  const applySwatch = useCallback((hex: string) => {
    const rgb = hexToRgb(hex);
    const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
    setHue(hsb.h);
    setSat(hsb.s);
    setBri(hsb.b);
    emitChange(hsb.h, hsb.s, hsb.b, alpha);
  }, [alpha, emitChange]);

  // ─── Eyedropper (native color picker from page) ───────────────

  const eyedropperAbortRef = useRef<AbortController | null>(null);

  const handleEyedropper = useCallback(async () => {
    if (!hasEyeDropper) return;
    try {
      isEyedroppingRef.current = true;
      const controller = new AbortController();
      eyedropperAbortRef.current = controller;
      // @ts-expect-error EyeDropper API not in all TS libs
      const dropper = new EyeDropper();
      const result = await dropper.open({ signal: controller.signal });
      const hex: string = result.sRGBHex;
      const rgb = hexToRgb(hex);
      const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
      setHue(hsb.h);
      setSat(hsb.s);
      setBri(hsb.b);
      setHexInput(hex.toUpperCase());
      emitChange(hsb.h, hsb.s, hsb.b, alpha);
    } catch (err) {
      // Ignore AbortError (unmount) and user cancellation
      if (err instanceof DOMException && err.name === "AbortError") return;
    } finally {
      eyedropperAbortRef.current = null;
      isEyedroppingRef.current = false;
    }
  }, [alpha, emitChange]);

  // Abort eyedropper on unmount
  useEffect(() => {
    return () => {
      eyedropperAbortRef.current?.abort();
    };
  }, []);

  // ─── Drag state (suppresses click-outside during drag) ──────
  const isDraggingRef = useRef(false);

  // ─── Eyedropper state (suppresses click-outside during pick) ──
  const isEyedroppingRef = useRef(false);

  // ─── Click-outside dismissal ─────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isDraggingRef.current || isEyedroppingRef.current) return;
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

  const cycleMode = useCallback(() => {
    setColorMode((m) => (m === "hex" ? "hsb" : m === "hsb" ? "rgb" : "hex"));
  }, []);

  const applyRgbChannel = useCallback(
    (channel: "r" | "g" | "b", raw: string) => {
      const v = Math.max(0, Math.min(255, parseInt(raw) || 0));
      const rgb = { ...currentRgb, [channel]: v };
      const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
      setHue(hsb.h);
      setSat(hsb.s);
      setBri(hsb.b);
      emitChange(hsb.h, hsb.s, hsb.b, alpha);
    },
    [currentRgb, alpha, emitChange],
  );

  const applyHsbChannel = useCallback(
    (channel: "h" | "s" | "b", raw: string) => {
      const num = parseFloat(raw) || 0;
      let h = hue, s = sat, b = bri;
      if (channel === "h") h = Math.max(0, Math.min(360, num));
      else if (channel === "s") s = Math.max(0, Math.min(100, num)) / 100;
      else b = Math.max(0, Math.min(100, num)) / 100;
      setHue(h);
      setSat(s);
      setBri(b);
      emitChange(h, s, b, alpha);
    },
    [hue, sat, bri, alpha, emitChange],
  );

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

      {/* ── Color Mode Inputs ────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Mode toggle + inputs */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Clickable mode label */}
          <span
            onClick={cycleMode}
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              cursor: "pointer",
              userSelect: "none",
              minWidth: 22,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              transition: `color ${ms("normal")}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
            title="Click to switch color mode"
          >
            {colorMode}
          </span>

          {colorMode === "hex" ? (
            <input
              type="text"
              value={hexInput}
              maxLength={7}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={applyHexInput}
              onKeyDown={(e) => { if (e.key === "Enter") applyHexInput(); }}
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
          ) : colorMode === "rgb" ? (
            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {(["r", "g", "b"] as const).map((ch) => (
                <div key={ch} style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "ui-monospace, 'SF Mono', monospace", textTransform: "uppercase" }}>{ch}</span>
                  <input
                    type="text"
                    value={currentRgb[ch]}
                    onChange={(e) => applyRgbChannel(ch, e.target.value)}
                    style={{
                      width: 0, flex: 1,
                      background: "#1e1e1e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      padding: "3px 4px",
                      fontSize: 11,
                      fontFamily: "ui-monospace, 'SF Mono', monospace",
                      color: "rgba(255,255,255,0.8)",
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {([
                { key: "h" as const, val: Math.round(hue) },
                { key: "s" as const, val: Math.round(sat * 100) },
                { key: "b" as const, val: Math.round(bri * 100) },
              ]).map(({ key, val }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "ui-monospace, 'SF Mono', monospace", textTransform: "uppercase" }}>{key}</span>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => applyHsbChannel(key, e.target.value)}
                    style={{
                      width: 0, flex: 1,
                      background: "#1e1e1e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      padding: "3px 4px",
                      fontSize: 11,
                      fontFamily: "ui-monospace, 'SF Mono', monospace",
                      color: "rgba(255,255,255,0.8)",
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Opacity display */}
          <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "ui-monospace, 'SF Mono', monospace" }}>A</span>
            <span style={{ fontSize: 11, fontFamily: "ui-monospace, 'SF Mono', monospace", color: "rgba(255,255,255,0.7)", minWidth: 26, textAlign: "right" }}>
              {Math.round(alpha * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Swatches ──────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Swatches
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {hasEyeDropper && (
              <button
                type="button"
                onClick={handleEyedropper}
                title="Pick color from page"
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 3,
                  color: "rgba(255,255,255,0.5)",
                  width: 18,
                  height: 18,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  transition: `border-color ${ms("fast")}, color ${ms("fast")}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.3)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 22 1-1h3l9-9"/>
                  <path d="M3 21v-3l9-9"/>
                  <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={addSwatch}
              title="Save current color"
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 3,
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                lineHeight: 1,
                width: 18,
                height: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: `border-color ${ms("fast")}, color ${ms("fast")}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.3)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
              }}
            >
              +
            </button>
          </div>
        </div>
        {swatches.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {swatches.map((swatch, i) => (
              <button
                type="button"
                key={`${swatch}-${i}`}
                onClick={() => applySwatch(swatch)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  removeSwatch(i);
                }}
                title={`${swatch}\nRight-click to remove`}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 3,
                  border: swatch.toUpperCase() === currentHex.toUpperCase()
                    ? "2px solid rgba(255,255,255,0.7)"
                    : "1px solid rgba(255,255,255,0.15)",
                  background: swatch,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  transition: `border-color ${ms("fast")}, transform ${ms("fast")}`,
                }}
                onMouseEnter={(e) => {
                  if (swatch.toUpperCase() !== currentHex.toUpperCase()) {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.4)";
                  }
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  if (swatch.toUpperCase() !== currentHex.toUpperCase()) {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                  }
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
            Click + to save colors
          </div>
        )}
      </div>
    </div>
  );
}
