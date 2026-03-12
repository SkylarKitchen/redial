/**
 * TransitionEditor.tsx — CSS transition property editor
 *
 * Add/remove transitions with property, duration, easing, and delay.
 * Includes a small inline bezier curve preview canvas.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { BezierEditor } from "./BezierEditor";
import { useDragReorder } from "./useDragReorder";
import { DragHandle } from "./DragHandle";

export interface TransitionValue {
  property: string;
  duration: number;
  easing: string;
  delay: number;
  visible: boolean;
}

export interface TransitionEditorProps {
  transitions: TransitionValue[];
  onChange: (transitions: TransitionValue[]) => void;
  /** The DOM element to preview transitions on */
  element?: Element;
}

const PROPERTY_OPTIONS = [
  "all",
  "opacity",
  "transform",
  "background-color",
  "background",
  "color",
  "border",
  "border-color",
  "border-radius",
  "box-shadow",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "margin",
  "padding",
  "top",
  "right",
  "bottom",
  "left",
  "font-size",
  "letter-spacing",
  "line-height",
  "filter",
  "backdrop-filter",
  "visibility",
] as const;

const EASING_OPTIONS = [
  "ease",
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "cubic-bezier(...)",
] as const;

/** Named easing curves as cubic-bezier control points for the preview */
const EASING_CURVES: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  linear: [0, 0, 1, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

function parseCubicBezier(easing: string): [number, number, number, number] | null {
  const match = easing.match(/cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (match) {
    return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])];
  }
  return EASING_CURVES[easing] ?? null;
}

function isCubicBezierCustom(easing: string): boolean {
  return easing.startsWith("cubic-bezier(") || easing === "cubic-bezier(...)";
}

const DEFAULT_TRANSITION: TransitionValue = {
  property: "all",
  duration: 300,
  easing: "ease",
  delay: 0,
  visible: true,
};

export function TransitionEditor({ transitions, onChange, element }: TransitionEditorProps) {
  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(transitions, onChange);

  const handleAdd = useCallback(() => {
    onChange([...transitions, { ...DEFAULT_TRANSITION }]);
  }, [transitions, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(transitions.filter((_, i) => i !== index));
    },
    [transitions, onChange]
  );

  const handleUpdate = useCallback(
    (index: number, updates: Partial<TransitionValue>) => {
      const next = transitions.map((t, i) => {
        if (i !== index) return t;
        return { ...t, ...updates };
      });
      onChange(next);
    },
    [transitions, onChange]
  );

  const handleToggleVisible = useCallback(
    (index: number) => {
      const next = [...transitions];
      next[index] = { ...next[index], visible: next[index].visible === false ? true : false };
      onChange(next);
    },
    [transitions, onChange]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", position: "relative" }}>
      {/* Transition cards */}
      {transitions.map((t, index) => {
        const dragProps = handleProps(index);
        return (
          <div key={index} ref={registerRef(index)} style={itemStyle(index)}>
            <TransitionCard
              transition={t}
              onUpdate={(updates) => handleUpdate(index, updates)}
              onRemove={() => handleRemove(index)}
              onToggleVisible={() => handleToggleVisible(index)}
              dragHandleProps={dragProps}
              isDragging={isDragging}
              element={element}
            />
          </div>
        );
      })}

      {/* Drop indicator line */}
      {(() => {
        const style = dropLineStyle();
        return style ? <div style={style} /> : null;
      })()}

      {/* Add button */}
      <button
        onClick={handleAdd}
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "3px",
          color: "rgba(255,255,255,0.5)",
          fontSize: "10px",
          fontFamily: "system-ui, sans-serif",
          padding: "3px 8px",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        + Add transition
      </button>
    </div>
  );
}

function TransitionCard({
  transition,
  onUpdate,
  onRemove,
  dragHandleProps,
  isDragging,
  element,
}: {
  transition: TransitionValue;
  onUpdate: (updates: Partial<TransitionValue>) => void;
  onRemove: () => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
  element?: Element;
}) {
  const [playing, setPlaying] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const isCustomBezier = isCubicBezierCustom(transition.easing);
  const bezierPoints = parseCubicBezier(transition.easing);

  // Parse custom bezier values for inputs
  const [cx1, cy1, cx2, cy2] = bezierPoints ?? [0.25, 0.1, 0.25, 1];

  const handlePlay = useCallback(() => {
    if (!element || playing) return;
    const el = element as HTMLElement;
    setPlaying(true);

    // Clear any pending timer
    if (playTimerRef.current) clearTimeout(playTimerRef.current);

    const prop = transition.property;
    const durationMs = transition.duration;
    const delayMs = transition.delay;
    const easing = transition.easing;

    // The easing value is already valid CSS (named or cubic-bezier(...))
    const cssEasing = easing;

    // Determine a "from" value for the property to create a visible animation
    const fromValues: Record<string, string> = {
      opacity: "0",
      transform: "translateY(20px)",
      "background-color": "rgba(99,102,241,0.3)",
      background: "rgba(99,102,241,0.3)",
      color: "rgba(99,102,241,0.8)",
      "border-color": "rgba(99,102,241,0.5)",
      "border-radius": "0px",
      "box-shadow": "0 0 0 4px rgba(99,102,241,0.3)",
      width: "50%",
      height: "50%",
      "font-size": "50%",
      filter: "blur(4px)",
      "backdrop-filter": "blur(4px)",
      visibility: "hidden",
    };

    // For "all" or unknown properties, do an opacity flash
    const targetProp = prop === "all" ? "opacity" : prop;
    const fromValue = fromValues[targetProp] ?? null;

    if (!fromValue) {
      // For truly unknown properties, just flash opacity
      const savedTransition = el.style.transition;
      const savedOpacity = el.style.opacity;

      el.style.transition = "none";
      el.style.opacity = "0.3";
      // Force reflow
      void el.offsetHeight;
      el.style.transition = `opacity ${durationMs}ms ${cssEasing} ${delayMs}ms`;
      el.style.opacity = savedOpacity || "";
      playTimerRef.current = setTimeout(() => {
        el.style.transition = savedTransition;
        setPlaying(false);
      }, durationMs + delayMs + 50);
      return;
    }

    // Save the current inline values
    const savedTransition = el.style.transition;
    const savedValue = el.style.getPropertyValue(targetProp);

    // Step 1: Disable transitions, snap to "from" state
    el.style.transition = "none";
    el.style.setProperty(targetProp, fromValue);
    // Force reflow so browser registers the "from" state
    void el.offsetHeight;

    // Step 2: Enable the transition and restore original value
    el.style.transition = `${targetProp} ${durationMs}ms ${cssEasing} ${delayMs}ms`;
    el.style.setProperty(targetProp, savedValue || "");

    // Step 3: After animation completes, restore original transition
    playTimerRef.current = setTimeout(() => {
      el.style.transition = savedTransition;
      setPlaying(false);
    }, durationMs + delayMs + 50);
  }, [element, playing, transition]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, []);

  const handleBezierChange = useCallback(
    (pts: [number, number, number, number]) => {
      onUpdate({ easing: `cubic-bezier(${pts[0]}, ${pts[1]}, ${pts[2]}, ${pts[3]})` });
    },
    [onUpdate]
  );

  const handleEasingChange = useCallback(
    (easing: string) => {
      if (easing === "cubic-bezier(...)") {
        onUpdate({ easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" });
      } else {
        onUpdate({ easing });
      }
    },
    [onUpdate]
  );

  const durationPct = (transition.duration / 5000) * 100;
  const delayPct = (transition.delay / 5000) * 100;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "3px",
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        position: "relative",
      }}
    >
      {/* Drag handle */}
      {dragHandleProps && (
        <DragHandle
          isDragging={isDragging}
          onPointerDown={dragHandleProps.onPointerDown}
          style={{ position: "absolute", top: "4px", left: "4px" }}
        />
      )}

      {/* Play preview button */}
      {element && (
        <button
          onClick={handlePlay}
          disabled={playing}
          title={playing ? "Playing..." : "Preview transition"}
          style={{
            position: "absolute",
            top: "4px",
            right: "22px",
            width: "14px",
            height: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: playing ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.3)",
            cursor: playing ? "default" : "pointer",
            padding: 0,
            borderRadius: "2px",
            lineHeight: 1,
            opacity: playing ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!playing) {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
              (e.currentTarget as HTMLElement).style.color = "rgba(99,102,241,0.8)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = playing ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.3)";
          }}
        >
          <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 0.5v8l6.5-4L1 0.5z" />
          </svg>
        </button>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        style={{
          position: "absolute",
          top: "4px",
          right: "4px",
          width: "14px",
          height: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.3)",
          cursor: "pointer",
          fontSize: "11px",
          fontFamily: "system-ui, sans-serif",
          padding: 0,
          borderRadius: "2px",
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)";
        }}
      >
        ×
      </button>

      {/* Property */}
      <Row label="Property">
        <SelectDropdown
          value={transition.property}
          options={[...PROPERTY_OPTIONS]}
          onChange={(v) => onUpdate({ property: v })}
        />
      </Row>

      {/* Duration */}
      <Row label="Duration">
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ flex: 1, position: "relative", height: "14px", display: "flex", alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={5000}
              step={50}
              value={transition.duration}
              onChange={(e) => onUpdate({ duration: parseInt(e.target.value) })}
              style={{
                width: "100%",
                height: "3px",
                appearance: "none",
                WebkitAppearance: "none",
                background: `linear-gradient(to right, #6366f1 ${durationPct}%, rgba(255,255,255,0.15) ${durationPct}%)`,
                borderRadius: "2px",
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>
          <MsInput value={transition.duration} onChange={(v) => onUpdate({ duration: v })} />
          <span style={{ fontSize: "9px", fontFamily: "ui-monospace, 'SF Mono', monospace", color: "rgba(255,255,255,0.3)", width: "14px", flexShrink: 0 }}>
            ms
          </span>
        </div>
      </Row>

      {/* Easing */}
      <Row label="Easing">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <SelectDropdown
            value={isCustomBezier ? "cubic-bezier(...)" : transition.easing}
            options={[...EASING_OPTIONS]}
            onChange={handleEasingChange}
          />
          <BezierPreview points={bezierPoints} />
        </div>
      </Row>

      {/* Visual bezier curve editor */}
      {isCustomBezier && (
        <BezierEditor
          value={[cx1, cy1, cx2, cy2]}
          onChange={handleBezierChange}
        />
      )}

      {/* Delay */}
      <Row label="Delay">
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ flex: 1, position: "relative", height: "14px", display: "flex", alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={5000}
              step={50}
              value={transition.delay}
              onChange={(e) => onUpdate({ delay: parseInt(e.target.value) })}
              style={{
                width: "100%",
                height: "3px",
                appearance: "none",
                WebkitAppearance: "none",
                background: `linear-gradient(to right, #6366f1 ${delayPct}%, rgba(255,255,255,0.15) ${delayPct}%)`,
                borderRadius: "2px",
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>
          <MsInput value={transition.delay} onChange={(v) => onUpdate({ delay: v })} />
          <span style={{ fontSize: "9px", fontFamily: "ui-monospace, 'SF Mono', monospace", color: "rgba(255,255,255,0.3)", width: "14px", flexShrink: 0 }}>
            ms
          </span>
        </div>
      </Row>
    </div>
  );
}

/** Label + content row */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", minHeight: "22px" }}>
      <span
        style={{
          width: "46px",
          fontSize: "10px",
          fontFamily: "system-ui, sans-serif",
          color: "rgba(255,255,255,0.5)",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** Small select-like dropdown */
function SelectDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "2px",
        color: "rgba(255,255,255,0.8)",
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        padding: "2px 4px",
        outline: "none",
        cursor: "pointer",
        appearance: "none",
        WebkitAppearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='6' height='4' viewBox='0 0 6 4' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 4L0 0h6L3 4z' fill='rgba(255,255,255,0.4)'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 4px center",
        paddingRight: "14px",
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

/** Millisecond number input */
function MsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = useCallback(() => {
    setFocused(false);
    const parsed = parseInt(draft);
    if (!isNaN(parsed)) {
      onChange(Math.max(0, Math.min(5000, parsed)));
    }
  }, [draft, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.shiftKey ? 500 : 50;
        onChange(Math.min(5000, value + step));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 500 : 50;
        onChange(Math.max(0, value - step));
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
        width: "36px",
        background: "rgba(255,255,255,0.06)",
        border: focused ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: "2px",
        color: "rgba(255,255,255,0.8)",
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        textAlign: "center",
        padding: "2px 2px",
        outline: "none",
        flexShrink: 0,
      }}
    />
  );
}

/** Small 40x40 bezier curve preview (non-interactive) */
function BezierPreview({ points }: { points: [number, number, number, number] | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 40;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const pad = 4;
    const w = size - pad * 2;
    const h = size - pad * 2;

    // Map bezier coords (0-1) to canvas coords (y is flipped)
    const toX = (v: number) => pad + v * w;
    const toY = (v: number) => pad + (1 - v) * h;

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, 0, size, size);

    // Grid line (diagonal baseline)
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.lineTo(toX(1), toY(1));
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const [x1, y1, x2, y2] = points;

    // Control point lines
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.lineTo(toX(x1), toY(y1));
    ctx.strokeStyle = "rgba(99,102,241,0.4)";
    ctx.lineWidth = 0.75;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX(1), toY(1));
    ctx.lineTo(toX(x2), toY(y2));
    ctx.strokeStyle = "rgba(99,102,241,0.4)";
    ctx.lineWidth = 0.75;
    ctx.stroke();

    // Bezier curve
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.bezierCurveTo(toX(x1), toY(y1), toX(x2), toY(y2), toX(1), toY(1));
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Control point dots
    for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
      ctx.beginPath();
      ctx.arc(toX(px), toY(py), 2, 0, Math.PI * 2);
      ctx.fillStyle = "#6366f1";
      ctx.fill();
    }
  }, [points]);

  if (!points) return null;

  return (
    <canvas
      ref={canvasRef}
      width={40}
      height={40}
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "3px",
        border: "1px solid rgba(255,255,255,0.1)",
        flexShrink: 0,
      }}
    />
  );
}
