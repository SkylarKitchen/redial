/**
 * TransitionEditor.tsx — CSS transition property editor
 *
 * Add/remove transitions with property, duration, easing, and delay.
 * Includes a small inline bezier curve preview canvas.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useDraftNumber } from "../hooks/useDraftNumber";
import { BezierEditor } from "./BezierEditor";
import { useDragReorder } from "../hooks/useDragReorder";
import { DragHandle } from "../shell/DragHandle";
import { EditorRemoveButton, VisibilityToggle, AnimatedListItem, MiniSelect } from "../controls";
import { color, text, border, surface, font, primaryAlpha, blackAlpha, filledTrackBg, focusBorder } from "../theme";
import { ms } from "../timing";

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

interface EasingPreset {
  label: string;
  css: string;
}

interface EasingGroup {
  label: string;
  options: EasingPreset[];
}

const EASING_GROUPS: EasingGroup[] = [
  {
    label: "Standard",
    options: [
      { label: "ease", css: "ease" },
      { label: "linear", css: "linear" },
      { label: "ease-in", css: "ease-in" },
      { label: "ease-out", css: "ease-out" },
      { label: "ease-in-out", css: "ease-in-out" },
    ],
  },
  {
    label: "Sine",
    options: [
      { label: "In Sine", css: "cubic-bezier(0.12, 0, 0.39, 0)" },
      { label: "Out Sine", css: "cubic-bezier(0.61, 1, 0.88, 1)" },
      { label: "In Out Sine", css: "cubic-bezier(0.37, 0, 0.63, 1)" },
    ],
  },
  {
    label: "Quad",
    options: [
      { label: "In Quad", css: "cubic-bezier(0.11, 0, 0.5, 0)" },
      { label: "Out Quad", css: "cubic-bezier(0.5, 1, 0.89, 1)" },
      { label: "In Out Quad", css: "cubic-bezier(0.45, 0, 0.55, 1)" },
    ],
  },
  {
    label: "Cubic",
    options: [
      { label: "In Cubic", css: "cubic-bezier(0.32, 0, 0.67, 0)" },
      { label: "Out Cubic", css: "cubic-bezier(0.33, 1, 0.68, 1)" },
      { label: "In Out Cubic", css: "cubic-bezier(0.65, 0, 0.35, 1)" },
    ],
  },
  {
    label: "Quart",
    options: [
      { label: "In Quart", css: "cubic-bezier(0.5, 0, 0.75, 0)" },
      { label: "Out Quart", css: "cubic-bezier(0.25, 1, 0.5, 1)" },
      { label: "In Out Quart", css: "cubic-bezier(0.76, 0, 0.24, 1)" },
    ],
  },
  {
    label: "Quint",
    options: [
      { label: "In Quint", css: "cubic-bezier(0.64, 0, 0.78, 0)" },
      { label: "Out Quint", css: "cubic-bezier(0.22, 1, 0.36, 1)" },
      { label: "In Out Quint", css: "cubic-bezier(0.83, 0, 0.17, 1)" },
    ],
  },
  {
    label: "Expo",
    options: [
      { label: "In Expo", css: "cubic-bezier(0.7, 0, 0.84, 0)" },
      { label: "Out Expo", css: "cubic-bezier(0.16, 1, 0.3, 1)" },
      { label: "In Out Expo", css: "cubic-bezier(0.87, 0, 0.13, 1)" },
    ],
  },
  {
    label: "Circ",
    options: [
      { label: "In Circ", css: "cubic-bezier(0.55, 0, 1, 0.45)" },
      { label: "Out Circ", css: "cubic-bezier(0, 0.55, 0.45, 1)" },
      { label: "In Out Circ", css: "cubic-bezier(0.85, 0, 0.15, 1)" },
    ],
  },
  {
    label: "Back",
    options: [
      { label: "In Back", css: "cubic-bezier(0.36, 0, 0.66, -0.56)" },
      { label: "Out Back", css: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      { label: "In Out Back", css: "cubic-bezier(0.68, -0.6, 0.32, 1.6)" },
    ],
  },
];

/** Set of all known preset CSS values for quick lookup */
const KNOWN_PRESET_CSS = new Set(
  EASING_GROUPS.flatMap((g) => g.options.map((o) => o.css))
);

/** Named easing curves as cubic-bezier control points for the preview */
const EASING_CURVES: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  linear: [0, 0, 1, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

function parseCubicBezier(easing: string): [number, number, number, number] | null {
  const match = easing.match(/cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
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
  const { registerRef, handleProps, itemStyle, dropLine, isDragging } = useDragReorder(transitions, onChange);

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
            <AnimatedListItem>
              <TransitionCard
                transition={t}
                onUpdate={(updates) => handleUpdate(index, updates)}
                onRemove={() => handleRemove(index)}
                onToggleVisible={() => handleToggleVisible(index)}
                dragHandleProps={dragProps}
                isDragging={isDragging}
                element={element}
              />
            </AnimatedListItem>
          </div>
        );
      })}

      {/* Drop indicator line */}
      {dropLine}

      {/* Add button */}
      <button
        onClick={handleAdd}
        style={{
          background: "transparent",
          border: `1px solid ${surface.active}`,
          borderRadius: "3px",
          color: text.label,
          fontSize: "10px",
          fontFamily: font.sans,
          padding: "3px 8px",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = color.input;
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
  onToggleVisible,
  dragHandleProps,
  isDragging,
  element,
}: {
  transition: TransitionValue;
  onUpdate: (updates: Partial<TransitionValue>) => void;
  onRemove: () => void;
  onToggleVisible: () => void;
  dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties };
  isDragging?: boolean;
  element?: Element;
}) {
  const [playing, setPlaying] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  /** Saved inline styles so we can restore if unmounted mid-animation */
  const savedStylesRef = useRef<{ prop: string; transition: string; value: string } | null>(null);

  const isCustomBezier = isCubicBezierCustom(transition.easing) && !KNOWN_PRESET_CSS.has(transition.easing);
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
      "background-color": primaryAlpha(0.3),
      background: primaryAlpha(0.3),
      color: primaryAlpha(0.8),
      "border-color": primaryAlpha(0.5),
      "border-radius": "0px",
      "box-shadow": `0 0 0 4px ${primaryAlpha(0.3)}`,
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

      savedStylesRef.current = { prop: "opacity", transition: savedTransition, value: savedOpacity };

      el.style.transition = "none";
      el.style.opacity = "0.3";
      // Force reflow
      void el.offsetHeight;
      el.style.transition = `opacity ${durationMs}ms ${cssEasing} ${delayMs}ms`;
      el.style.opacity = savedOpacity || "";
      playTimerRef.current = setTimeout(() => {
        el.style.transition = savedTransition;
        savedStylesRef.current = null;
        setPlaying(false);
      }, durationMs + delayMs + 50);
      return;
    }

    // Save the current inline values
    const savedTransition = el.style.transition;
    const savedValue = el.style.getPropertyValue(targetProp);

    savedStylesRef.current = { prop: targetProp, transition: savedTransition, value: savedValue };

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
      savedStylesRef.current = null;
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
    (css: string) => {
      onUpdate({ easing: css });
    },
    [onUpdate]
  );

  const durationPct = (transition.duration / 5000) * 100;
  const delayPct = (transition.delay / 5000) * 100;

  return (
    <div
      style={{
        background: blackAlpha(0.02),
        border: `1px solid ${surface.hover}`,
        borderRadius: "3px",
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        position: "relative",
        opacity: transition.visible === false ? 0.4 : 1,
        transition: `opacity ${ms("normal")}`,
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

      {/* Eye visibility toggle */}
      <div style={{ position: "absolute", top: "4px", right: "40px", pointerEvents: isDragging ? "none" : "auto" }}>
        <VisibilityToggle
          visible={transition.visible !== false}
          onToggle={onToggleVisible}
          title={transition.visible !== false ? "Hide transition" : "Show transition"}
        />
      </div>

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
            color: playing ? primaryAlpha(0.7) : text.disabled,
            cursor: playing ? "default" : "pointer",
            padding: 0,
            borderRadius: "2px",
            lineHeight: 1,
            opacity: playing ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!playing) {
              (e.currentTarget as HTMLElement).style.background = surface.hover;
              (e.currentTarget as HTMLElement).style.color = primaryAlpha(0.8);
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = playing ? primaryAlpha(0.7) : text.disabled;
          }}
        >
          <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 0.5v8l6.5-4L1 0.5z" />
          </svg>
        </button>
      )}

      {/* Remove button */}
      <div style={{ position: "absolute", top: "4px", right: "4px" }}>
        <EditorRemoveButton onClick={onRemove} />
      </div>

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
                background: filledTrackBg(durationPct),
                borderRadius: "2px",
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>
          <MsInput value={transition.duration} onChange={(v) => onUpdate({ duration: v })} />
          <span style={{ fontSize: "9px", fontFamily: font.mono, color: text.disabled, width: "14px", flexShrink: 0 }}>
            ms
          </span>
        </div>
      </Row>

      {/* Easing */}
      <Row label="Easing">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <EasingSelect
            value={transition.easing}
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
                background: filledTrackBg(delayPct),
                borderRadius: "2px",
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>
          <MsInput value={transition.delay} onChange={(v) => onUpdate({ delay: v })} />
          <span style={{ fontSize: "9px", fontFamily: font.mono, color: text.disabled, width: "14px", flexShrink: 0 }}>
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
          fontFamily: font.sans,
          color: text.label,
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
  return <MiniSelect value={value} onChange={onChange} options={options} />;
}

/** Grouped easing select with presets + custom option */
function EasingSelect({ value, onChange }: { value: string; onChange: (css: string) => void }) {
  const isKnown = KNOWN_PRESET_CSS.has(value);
  const selectValue = isKnown ? value : "custom";

  return (
    <MiniSelect
      value={selectValue}
      onChange={(v) => {
        if (v === "custom") {
          onChange("cubic-bezier(0.25, 0.1, 0.25, 1)");
        } else {
          onChange(v);
        }
      }}
    >
      {EASING_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((opt) => (
            <option key={opt.css} value={opt.css}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      ))}
      <optgroup label="Custom">
        <option value="custom">cubic-bezier(...)</option>
      </optgroup>
    </MiniSelect>
  );
}

/** Millisecond number input */
function MsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [focused, setFocused] = useState(false);
  const { draft, inputProps } = useDraftNumber({
    value,
    resync: !focused,
    step: 50,
    min: 0,
    max: 5000,
    blurOnEnter: true,
    stepUpdatesDraft: true,
    onCommit: (d) => {
      setFocused(false);
      const parsed = parseInt(d);
      if (!isNaN(parsed)) onChange(Math.max(0, Math.min(5000, parsed)));
    },
    onStep: (next) => onChange(next),
  });
  return (
    <input
      value={focused ? draft : String(value)}
      {...inputProps}
      onFocus={() => setFocused(true)}
      style={{
        width: "36px",
        background: color.input,
        border: focusBorder(focused),
        borderRadius: "2px",
        color: text.secondary,
        fontSize: "10px",
        fontFamily: font.mono,
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
    ctx.fillStyle = blackAlpha(0.03);
    ctx.fillRect(0, 0, size, size);

    // Grid line (diagonal baseline)
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.lineTo(toX(1), toY(1));
    ctx.strokeStyle = blackAlpha(0.07);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const [x1, y1, x2, y2] = points;

    // Control point lines
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.lineTo(toX(x1), toY(y1));
    ctx.strokeStyle = primaryAlpha(0.4);
    ctx.lineWidth = 0.75;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX(1), toY(1));
    ctx.lineTo(toX(x2), toY(y2));
    ctx.strokeStyle = primaryAlpha(0.4);
    ctx.lineWidth = 0.75;
    ctx.stroke();

    // Bezier curve
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.bezierCurveTo(toX(x1), toY(y1), toX(x2), toY(y2), toX(1), toY(1));
    ctx.strokeStyle = color.primary;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Control point dots
    for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
      ctx.beginPath();
      ctx.arc(toX(px), toY(py), 2, 0, Math.PI * 2);
      ctx.fillStyle = color.primary;
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
        border: `1px solid ${border.input}`,
        flexShrink: 0,
      }}
    />
  );
}
