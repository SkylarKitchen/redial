/**
 * BackgroundLayerList.tsx — Stackable background layer manager
 *
 * Supports color, gradient, and image layers with opacity, blend mode,
 * reordering (top = frontmost), and inline editing for image properties.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { GradientEditor } from "./GradientEditor";
import type { GradientStop } from "./GradientEditor";
import { X } from "lucide-react";
import { useDragReorder } from "./useDragReorder";
import { DragHandle } from "./DragHandle";
import { ms } from "./timing";

export interface BackgroundLayer {
  id: string;
  type: "color" | "gradient" | "image";
  color?: string;
  gradient?: {
    type: "linear" | "radial" | "conic";
    angle: number;
    stops: Array<{ color: string; position: number }>;
  };
  image?: {
    url: string;
    size: string;
    position: string;
    repeat: string;
    attachment: string;
  };
  opacity: number;
  blendMode: string;
}

export type BackgroundLayerType = "color" | "gradient" | "image";

export interface BackgroundLayerListProps {
  layers: BackgroundLayer[];
  onChange: (layers: BackgroundLayer[]) => void;
  onEditColor?: (layerId: string) => void;
}

const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

const SIZE_KEYWORDS = ["auto", "cover", "contain"];
const SIZE_OPTIONS = [...SIZE_KEYWORDS, "custom"];
const POSITION_OPTIONS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
];
const REPEAT_OPTIONS = ["no-repeat", "repeat", "repeat-x", "repeat-y"];
const ATTACHMENT_OPTIONS = ["scroll", "fixed", "local"];

let _idCounter = 0;
function uid() {
  return `bg_${Date.now()}_${++_idCounter}`;
}

function makeDefault(type: BackgroundLayerType): BackgroundLayer {
  const base = { id: uid(), type, opacity: 1, blendMode: "normal" } as BackgroundLayer;
  if (type === "color") {
    base.color = "#ffffff";
  } else if (type === "gradient") {
    base.gradient = {
      type: "linear",
      angle: 180,
      stops: [
        { color: "#000000", position: 0 },
        { color: "#ffffff", position: 100 },
      ],
    };
  } else {
    base.image = { url: "", size: "cover", position: "center", repeat: "no-repeat", attachment: "scroll" };
  }
  return base;
}

function gradientCSS(g: NonNullable<BackgroundLayer["gradient"]>) {
  const sorted = [...g.stops].sort((a, b) => a.position - b.position);
  const s = sorted.map((st) => `${st.color} ${st.position}%`).join(", ");
  if (g.type === "linear") return `linear-gradient(${g.angle}deg, ${s})`;
  if (g.type === "radial") return `radial-gradient(circle, ${s})`;
  return `conic-gradient(from ${g.angle}deg, ${s})`;
}

function layerPreviewBg(layer: BackgroundLayer): string {
  if (layer.type === "color") return layer.color ?? "#ffffff";
  if (layer.type === "gradient" && layer.gradient) return gradientCSS(layer.gradient);
  return "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/8px 8px";
}

// Small inline dropdown
function Select({
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
        height: "24px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "3px",
        color: "rgba(255,255,255,0.8)",
        fontSize: "11px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        padding: "0 4px",
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function BackgroundLayerList({
  layers,
  onChange,
  onEditColor,
}: BackgroundLayerListProps) {
  const { registerRef, handleProps, itemStyle, dropLineStyle, isDragging } = useDragReorder(layers, onChange);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  // Close add dropdown on outside click
  useEffect(() => {
    if (!addOpen) return;
    function handleDown(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown, true);
    return () => document.removeEventListener("mousedown", handleDown, true);
  }, [addOpen]);

  const addLayer = useCallback(
    (type: BackgroundLayerType) => {
      const layer = makeDefault(type);
      onChange([layer, ...layers]);
      setExpandedId(layer.id);
      setAddOpen(false);
    },
    [layers, onChange]
  );

  const removeLayer = useCallback(
    (id: string) => {
      onChange(layers.filter((l) => l.id !== id));
      if (expandedId === id) setExpandedId(null);
    },
    [layers, onChange, expandedId]
  );

  const updateLayer = useCallback(
    (id: string, patch: Partial<BackgroundLayer>) => {
      onChange(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    },
    [layers, onChange]
  );

  const updateImage = useCallback(
    (id: string, patch: Partial<NonNullable<BackgroundLayer["image"]>>) => {
      onChange(
        layers.map((l) => {
          if (l.id !== id) return l;
          return { ...l, image: { ...l.image!, ...patch } };
        })
      );
    },
    [layers, onChange]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {/* Add button */}
      <div ref={addRef} style={{ position: "relative" }}>
        <button
          onClick={() => setAddOpen((o) => !o)}
          style={{
            width: "100%",
            height: "28px",
            background: "rgba(255,255,255,0.06)",
            border: "1px dashed rgba(255,255,255,0.2)",
            borderRadius: "4px",
            color: "rgba(255,255,255,0.5)",
            fontSize: "11px",
            fontFamily: "system-ui, sans-serif",
            cursor: "pointer",
            transition: `background ${ms("fast")}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
          }}
        >
          + Add background
        </button>

        {addOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 2px)",
              left: 0,
              right: 0,
              background: "#2a2a2a",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "4px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              zIndex: 100,
              padding: "2px 0",
              overflow: "hidden",
            }}
          >
            {(["color", "gradient", "image"] as BackgroundLayerType[]).map((t) => (
              <div
                key={t}
                onClick={() => addLayer(t)}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontFamily: "system-ui, sans-serif",
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: `background ${ms("micro")}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {t}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Layer rows */}
      <div style={{ position: "relative" }}>
      {layers.map((layer, index) => {
        const isExpanded = expandedId === layer.id;
        const typeLabel = layer.type === "color" ? "Color" : layer.type === "gradient" ? "Gradient" : "Image";
        const dragProps = handleProps(index);

        return (
          <div
            key={layer.id}
            ref={registerRef(index)}
            style={{
              ...itemStyle(index),
              background: isExpanded ? "rgba(255,255,255,0.04)" : "transparent",
              borderRadius: "4px",
              border: "1px solid rgba(255,255,255,0.08)",
              marginBottom: "4px",
            }}
          >
            {/* Collapsed row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : layer.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 6px",
                cursor: "pointer",
              }}
            >
              {/* Drag handle */}
              <DragHandle
                isDragging={isDragging}
                onPointerDown={(e) => {
                  e.stopPropagation(); // Don't toggle expand on drag
                  dragProps.onPointerDown(e);
                }}
              />

              {/* Preview swatch */}
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "4px",
                  background: layerPreviewBg(layer),
                  border: "1px solid rgba(255,255,255,0.15)",
                  flexShrink: 0,
                }}
              />

              {/* Label */}
              <span
                style={{
                  flex: 1,
                  fontSize: "11px",
                  fontFamily: "system-ui, sans-serif",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {typeLabel}
              </span>

              {/* Opacity slider */}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={layer.opacity}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateLayer(layer.id, { opacity: Number(e.target.value) })}
                style={{ width: "48px", accentColor: "#6366f1" }}
              />

              {/* Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeLayer(layer.id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "20px",
                  height: "20px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "3px",
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Expanded controls */}
            {isExpanded && (
              <div
                style={{
                  padding: "6px 6px 8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Color layer */}
                {layer.type === "color" && (
                  <div
                    onClick={() => onEditColor?.(layer.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: onEditColor ? "pointer" : "default",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "24px",
                        borderRadius: "4px",
                        background: layer.color ?? "#ffffff",
                        border: "1px solid rgba(255,255,255,0.15)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "ui-monospace, 'SF Mono', monospace",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      {layer.color}
                    </span>
                  </div>
                )}

                {/* Gradient layer — full inline editor */}
                {layer.type === "gradient" && layer.gradient && (
                  <GradientEditor
                    type={layer.gradient.type}
                    angle={layer.gradient.angle}
                    stops={layer.gradient.stops as GradientStop[]}
                    onChange={(g) =>
                      updateLayer(layer.id, {
                        gradient: {
                          type: g.type as "linear" | "radial" | "conic",
                          angle: g.angle,
                          stops: g.stops,
                        },
                      })
                    }
                  />
                )}

                {/* Image layer */}
                {layer.type === "image" && layer.image && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {/* URL */}
                    <input
                      type="text"
                      placeholder="Image URL"
                      value={layer.image.url}
                      onChange={(e) => updateImage(layer.id, { url: e.target.value })}
                      style={{
                        width: "100%",
                        height: "24px",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "3px",
                        color: "rgba(255,255,255,0.8)",
                        fontSize: "11px",
                        fontFamily: "ui-monospace, 'SF Mono', monospace",
                        padding: "0 6px",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", gap: "4px" }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontFamily: "system-ui, sans-serif",
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          Size
                        </span>
                        <Select
                          value={SIZE_KEYWORDS.includes(layer.image.size) ? layer.image.size : "custom"}
                          options={SIZE_OPTIONS}
                          onChange={(v) => updateImage(layer.id, { size: v === "custom" ? "100% auto" : v })}
                        />
                        {!SIZE_KEYWORDS.includes(layer.image.size) && (() => {
                          const parts = layer.image.size.split(/\s+/);
                          const w = parts[0] || "100%";
                          const h = parts[1] || "auto";
                          const inputStyle: React.CSSProperties = {
                            flex: 1, height: "22px", background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.12)", borderRadius: "3px",
                            color: "rgba(255,255,255,0.85)", fontSize: "10px", padding: "0 4px",
                            fontFamily: "ui-monospace, 'SF Mono', monospace",
                          };
                          return (
                            <div style={{ display: "flex", gap: "2px", marginTop: "2px" }}>
                              <input
                                value={w}
                                placeholder="W"
                                onChange={(e) => updateImage(layer.id, { size: `${e.target.value} ${h}` })}
                                style={inputStyle}
                              />
                              <input
                                value={h}
                                placeholder="H"
                                onChange={(e) => updateImage(layer.id, { size: `${w} ${e.target.value}` })}
                                style={inputStyle}
                              />
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontFamily: "system-ui, sans-serif",
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          Position
                        </span>
                        <Select
                          value={layer.image.position}
                          options={POSITION_OPTIONS}
                          onChange={(v) => updateImage(layer.id, { position: v })}
                        />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontFamily: "system-ui, sans-serif",
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          Repeat
                        </span>
                        <Select
                          value={layer.image.repeat}
                          options={REPEAT_OPTIONS}
                          onChange={(v) => updateImage(layer.id, { repeat: v })}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontFamily: "system-ui, sans-serif",
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          Attachment
                        </span>
                        <Select
                          value={layer.image.attachment}
                          options={ATTACHMENT_OPTIONS}
                          onChange={(v) => updateImage(layer.id, { attachment: v })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Blend mode */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "system-ui, sans-serif",
                      color: "rgba(255,255,255,0.4)",
                      minWidth: "36px",
                    }}
                  >
                    Blend
                  </span>
                  <Select
                    value={layer.blendMode}
                    options={BLEND_MODES}
                    onChange={(v) => updateLayer(layer.id, { blendMode: v })}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Drop indicator line */}
      {(() => {
        const style = dropLineStyle();
        return style ? <div style={style} /> : null;
      })()}
      </div>
    </div>
  );
}
