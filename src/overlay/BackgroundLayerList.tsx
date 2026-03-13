/**
 * BackgroundLayerList.tsx — Stackable background layer manager
 *
 * Supports color, gradient, and image layers with opacity, blend mode,
 * reordering (top = frontmost), and inline editing for image properties.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { GradientEditor, buildGradientCSS } from "./GradientEditor";
import type { GradientStop } from "./GradientEditor";
import { BLEND_MODE_OPTIONS } from "./panelConstants";
import { X } from "lucide-react";
import { useDragReorder } from "./useDragReorder";
import { DragHandle } from "./DragHandle";
import { VisibilityToggle } from "./controls";
import { color, blackAlpha, border, surface, shadow, font, zIndex, checkerboard } from "./theme";
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
  visible: boolean;
}

export type BackgroundLayerType = "color" | "gradient" | "image";

export interface BackgroundLayerListProps {
  layers: BackgroundLayer[];
  onChange: (layers: BackgroundLayer[]) => void;
  onEditColor?: (layerId: string) => void;
}

const BLEND_MODES = BLEND_MODE_OPTIONS.map(o => o.value);

const SIZE_KEYWORDS = ["auto", "cover", "contain"];
const SIZE_OPTIONS = [...SIZE_KEYWORDS, "custom"];
const POSITION_KEYWORDS = [
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
const POSITION_OPTIONS = [...POSITION_KEYWORDS, "custom"];
const REPEAT_OPTIONS = ["no-repeat", "repeat", "repeat-x", "repeat-y"];
const ATTACHMENT_OPTIONS = ["scroll", "fixed", "local"];

let _idCounter = 0;
function uid() {
  return `bg_${Date.now()}_${++_idCounter}`;
}

function makeDefault(type: BackgroundLayerType): BackgroundLayer {
  const base = { id: uid(), type, opacity: 1, blendMode: "normal", visible: true } as BackgroundLayer;
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

function layerPreviewBg(layer: BackgroundLayer): string {
  if (layer.type === "color") return layer.color ?? "#ffffff";
  if (layer.type === "gradient" && layer.gradient) {
    const g = layer.gradient;
    return buildGradientCSS(g.type as "linear" | "radial" | "conic", g.angle, g.stops);
  }
  return checkerboard;
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
        height: 24,
        borderRadius: 3,
        fontSize: 11,
        fontFamily: font.mono,
        paddingLeft: 4,
        paddingRight: 4,
        cursor: "pointer",
        background: color.input,
        border: `1px solid ${color.border}`,
        color: blackAlpha(0.7),
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

  const toggleVisible = useCallback(
    (id: string) => {
      onChange(
        layers.map((l) => (l.id === id ? { ...l, visible: l.visible === false ? true : false } : l))
      );
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
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Add button */}
      <div ref={addRef} style={{ position: "relative" }}>
        <button
          onClick={() => setAddOpen((o) => !o)}
          style={{
            width: "100%",
            height: 28,
            borderRadius: 4,
            fontSize: 11,
            fontFamily: font.sans,
            cursor: "pointer",
            transition: `background-color ${ms("fast")}`,
            background: color.input,
            border: `1px dashed ${blackAlpha(0.15)}`,
            color: color.mutedForeground,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = surface.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = color.input)}
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
              borderRadius: 4,
              zIndex: zIndex.dropdown,
              paddingTop: 2,
              paddingBottom: 2,
              overflow: "hidden",
              background: color.popover,
              border: `1px solid ${blackAlpha(0.12)}`,
              boxShadow: shadow.dropdown,
            }}
          >
            {(["color", "gradient", "image"] as BackgroundLayerType[]).map((t) => (
              <div
                key={t}
                onClick={() => addLayer(t)}
                style={{
                  paddingTop: 6,
                  paddingBottom: 6,
                  paddingLeft: 10,
                  paddingRight: 10,
                  fontSize: 11,
                  fontFamily: font.sans,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: `background-color ${ms("fast")}`,
                  color: blackAlpha(0.6),
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = surface.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
              borderRadius: 4,
              marginBottom: 4,
              transition: `opacity ${ms("fast")}`,
              border: `1px solid ${blackAlpha(0.05)}`,
              background: isExpanded ? blackAlpha(0.03) : "transparent",
              opacity: layer.visible === false ? 0.4 : 1,
            }}
          >
            {/* Collapsed row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : layer.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: 4,
                paddingLeft: 6,
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
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  flexShrink: 0,
                  background: layerPreviewBg(layer),
                  border: `1px solid ${blackAlpha(0.12)}`,
                }}
              />

              {/* Label */}
              <span style={{ flex: 1, fontSize: 11, fontFamily: font.sans, color: blackAlpha(0.6) }}>
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
                style={{ width: 48, accentColor: color.primary }}
              />

              {/* Eye visibility toggle */}
              <span onClick={(e) => e.stopPropagation()} style={{ pointerEvents: isDragging ? "none" : "auto" }}>
                <VisibilityToggle
                  visible={layer.visible !== false}
                  onToggle={() => toggleVisible(layer.id)}
                />
              </span>

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
                  width: 20,
                  height: 20,
                  background: "transparent",
                  border: "none",
                  borderRadius: 3,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: font.sans,
                  color: blackAlpha(0.35),
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = color.destructive)}
                onMouseLeave={(e) => (e.currentTarget.style.color = blackAlpha(0.35))}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Expanded controls */}
            {isExpanded && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 6,
                paddingBottom: 8,
                borderTop: `1px solid ${blackAlpha(0.04)}`,
              }}>
                {/* Color layer */}
                {layer.type === "color" && (
                  <div
                    onClick={() => onEditColor?.(layer.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: onEditColor ? "pointer" : "default",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 24,
                        borderRadius: 4,
                        background: layer.color ?? "#ffffff",
                        border: `1px solid ${blackAlpha(0.12)}`,
                      }}
                    />
                    <span style={{ fontSize: 11, fontFamily: font.mono, color: blackAlpha(0.5) }}>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {/* URL */}
                    <input
                      type="text"
                      placeholder="Image URL"
                      value={layer.image.url}
                      onChange={(e) => updateImage(layer.id, { url: e.target.value })}
                      style={{
                        width: "100%",
                        height: 24,
                        borderRadius: 3,
                        fontSize: 11,
                        fontFamily: font.mono,
                        paddingLeft: 6,
                        paddingRight: 6,
                        boxSizing: "border-box",
                        background: color.input,
                        border: `1px solid ${color.border}`,
                        color: blackAlpha(0.7),
                      }}
                    />
                    <div style={{ display: "flex", gap: 4 }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 10, fontFamily: font.sans, color: blackAlpha(0.35) }}>
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
                          return (
                            <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                              <input
                                value={w}
                                placeholder="W"
                                onChange={(e) => updateImage(layer.id, { size: `${e.target.value} ${h}` })}
                                style={{
                                  flex: 1,
                                  height: 22,
                                  borderRadius: 3,
                                  fontSize: 10,
                                  paddingLeft: 4,
                                  paddingRight: 4,
                                  fontFamily: font.mono,
                                  background: color.input,
                                  border: `1px solid ${color.border}`,
                                  color: blackAlpha(0.75),
                                }}
                              />
                              <input
                                value={h}
                                placeholder="H"
                                onChange={(e) => updateImage(layer.id, { size: `${w} ${e.target.value}` })}
                                style={{
                                  flex: 1,
                                  height: 22,
                                  borderRadius: 3,
                                  fontSize: 10,
                                  paddingLeft: 4,
                                  paddingRight: 4,
                                  fontFamily: font.mono,
                                  background: color.input,
                                  border: `1px solid ${color.border}`,
                                  color: blackAlpha(0.75),
                                }}
                              />
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 10, fontFamily: font.sans, color: blackAlpha(0.35) }}>
                          Position
                        </span>
                        <Select
                          value={POSITION_KEYWORDS.includes(layer.image.position) ? layer.image.position : "custom"}
                          options={POSITION_OPTIONS}
                          onChange={(v) => updateImage(layer.id, { position: v === "custom" ? "50% 50%" : v })}
                        />
                        {!POSITION_KEYWORDS.includes(layer.image.position) && (() => {
                          const parts = layer.image.position.split(/\s+/);
                          const x = parts[0] || "50%";
                          const y = parts[1] || "50%";
                          return (
                            <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                              <input
                                value={x}
                                placeholder="X"
                                onChange={(e) => updateImage(layer.id, { position: `${e.target.value} ${y}` })}
                                style={{
                                  flex: 1,
                                  height: 22,
                                  borderRadius: 3,
                                  fontSize: 10,
                                  paddingLeft: 4,
                                  paddingRight: 4,
                                  fontFamily: font.mono,
                                  background: color.input,
                                  border: `1px solid ${color.border}`,
                                  color: blackAlpha(0.75),
                                }}
                              />
                              <input
                                value={y}
                                placeholder="Y"
                                onChange={(e) => updateImage(layer.id, { position: `${x} ${e.target.value}` })}
                                style={{
                                  flex: 1,
                                  height: 22,
                                  borderRadius: 3,
                                  fontSize: 10,
                                  paddingLeft: 4,
                                  paddingRight: 4,
                                  fontFamily: font.mono,
                                  background: color.input,
                                  border: `1px solid ${color.border}`,
                                  color: blackAlpha(0.75),
                                }}
                              />
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 10, fontFamily: font.sans, color: blackAlpha(0.35) }}>
                          Repeat
                        </span>
                        <Select
                          value={layer.image.repeat}
                          options={REPEAT_OPTIONS}
                          onChange={(v) => updateImage(layer.id, { repeat: v })}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 10, fontFamily: font.sans, color: blackAlpha(0.35) }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, fontFamily: font.sans, minWidth: 36, color: blackAlpha(0.35) }}>
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
