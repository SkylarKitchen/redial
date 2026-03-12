/**
 * BackgroundLayerList.tsx — Stackable background layer manager
 *
 * Supports color, gradient, and image layers with opacity, blend mode,
 * reordering (top = frontmost), and inline editing for image properties.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { GradientEditor, buildGradientCSS } from "./GradientEditor";
import type { GradientStop } from "./GradientEditor";
import { BLEND_MODE_OPTIONS } from "./panelConstants";
import { X, Eye, EyeOff } from "lucide-react";
import { useDragReorder } from "./useDragReorder";
import { DragHandle } from "./DragHandle";

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
  return "repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50%/8px 8px";
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
      className="h-6 bg-[var(--input)] border border-[var(--border)] rounded-[3px] text-[rgba(0,0,0,0.8)] text-[11px] font-mono px-1 cursor-pointer"
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
    <div className="flex flex-col gap-1">
      {/* Add button */}
      <div ref={addRef} className="relative">
        <button
          onClick={() => setAddOpen((o) => !o)}
          className="w-full h-7 bg-[var(--input)] border border-dashed border-[rgba(0,0,0,0.12)] rounded text-[var(--muted-foreground)] text-[11px] font-[system-ui,sans-serif] cursor-pointer transition-colors hover:bg-[var(--muted)]"
        >
          + Add background
        </button>

        {addOpen && (
          <div className="absolute top-[calc(100%+2px)] left-0 right-0 bg-[#eae5df] border border-[rgba(0,0,0,0.08)] rounded shadow-[0_4px_12px_rgba(0,0,0,0.12)] z-[100] py-0.5 overflow-hidden">
            {(["color", "gradient", "image"] as BackgroundLayerType[]).map((t) => (
              <div
                key={t}
                onClick={() => addLayer(t)}
                className="py-1.5 px-2.5 text-[11px] font-[system-ui,sans-serif] text-[rgba(0,0,0,0.7)] cursor-pointer capitalize transition-colors hover:bg-[var(--muted)]"
              >
                {t}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Layer rows */}
      <div className="relative">
      {layers.map((layer, index) => {
        const isExpanded = expandedId === layer.id;
        const typeLabel = layer.type === "color" ? "Color" : layer.type === "gradient" ? "Gradient" : "Image";
        const dragProps = handleProps(index);

        return (
          <div
            key={layer.id}
            ref={registerRef(index)}
            className={cn(
              "rounded border border-[rgba(0,0,0,0.06)] mb-1 transition-opacity group",
              isExpanded ? "bg-[rgba(0,0,0,0.03)]" : "bg-transparent",
            )}
            style={{
              ...itemStyle(index),
              opacity: layer.visible === false ? 0.4 : 1,
            }}
          >
            {/* Collapsed row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : layer.id)}
              className="flex items-center gap-2 p-1 pl-1.5 cursor-pointer"
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
                className="w-6 h-6 rounded border border-[rgba(0,0,0,0.08)] shrink-0"
                style={{ background: layerPreviewBg(layer) }}
              />

              {/* Label */}
              <span className="flex-1 text-[11px] font-[system-ui,sans-serif] text-[rgba(0,0,0,0.7)]">
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
                className="w-12 accent-[#c17a50]"
              />

              {/* Eye visibility toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisible(layer.id);
                }}
                className={cn(
                  "bg-transparent border-none cursor-pointer p-0.5",
                  layer.visible !== false ? "text-[var(--muted-foreground)]" : "text-[rgba(0,0,0,0.2)]",
                )}
                style={{ pointerEvents: isDragging ? "none" : "auto" }}
                title={layer.visible !== false ? "Hide layer" : "Show layer"}
              >
                {layer.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>

              {/* Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeLayer(layer.id);
                }}
                className="flex items-center justify-center w-5 h-5 bg-transparent border-none rounded-[3px] text-[rgba(0,0,0,0.4)] text-sm cursor-pointer font-[system-ui,sans-serif] hover:text-[var(--destructive)]"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* Expanded controls */}
            {isExpanded && (
              <div className="flex flex-col gap-1.5 px-1.5 pt-1.5 pb-2 border-t border-[rgba(0,0,0,0.06)]">
                {/* Color layer */}
                {layer.type === "color" && (
                  <div
                    onClick={() => onEditColor?.(layer.id)}
                    className={cn("flex items-center gap-2", onEditColor ? "cursor-pointer" : "cursor-default")}
                  >
                    <div
                      className="w-8 h-6 rounded border border-[rgba(0,0,0,0.08)]"
                      style={{ background: layer.color ?? "#ffffff" }}
                    />
                    <span className="text-[11px] font-mono text-[rgba(0,0,0,0.6)]">
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
                  <div className="flex flex-col gap-1">
                    {/* URL */}
                    <input
                      type="text"
                      placeholder="Image URL"
                      value={layer.image.url}
                      onChange={(e) => updateImage(layer.id, { url: e.target.value })}
                      className="w-full h-6 bg-[var(--input)] border border-[var(--border)] rounded-[3px] text-[rgba(0,0,0,0.8)] text-[11px] font-mono px-1.5 box-border"
                    />
                    <div className="flex gap-1">
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-[system-ui,sans-serif] text-[rgba(0,0,0,0.4)]">
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
                            <div className="flex gap-0.5 mt-0.5">
                              <input
                                value={w}
                                placeholder="W"
                                onChange={(e) => updateImage(layer.id, { size: `${e.target.value} ${h}` })}
                                className="flex-1 h-[22px] bg-[var(--input)] border border-[var(--border)] rounded-[3px] text-[rgba(0,0,0,0.85)] text-[10px] px-1 font-mono"
                              />
                              <input
                                value={h}
                                placeholder="H"
                                onChange={(e) => updateImage(layer.id, { size: `${w} ${e.target.value}` })}
                                className="flex-1 h-[22px] bg-[var(--input)] border border-[var(--border)] rounded-[3px] text-[rgba(0,0,0,0.85)] text-[10px] px-1 font-mono"
                              />
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-[system-ui,sans-serif] text-[rgba(0,0,0,0.4)]">
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
                            <div className="flex gap-0.5 mt-0.5">
                              <input
                                value={x}
                                placeholder="X"
                                onChange={(e) => updateImage(layer.id, { position: `${e.target.value} ${y}` })}
                                className="flex-1 h-[22px] bg-[var(--input)] border border-[var(--border)] rounded-[3px] text-[rgba(0,0,0,0.85)] text-[10px] px-1 font-mono"
                              />
                              <input
                                value={y}
                                placeholder="Y"
                                onChange={(e) => updateImage(layer.id, { position: `${x} ${e.target.value}` })}
                                className="flex-1 h-[22px] bg-[var(--input)] border border-[var(--border)] rounded-[3px] text-[rgba(0,0,0,0.85)] text-[10px] px-1 font-mono"
                              />
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-[system-ui,sans-serif] text-[rgba(0,0,0,0.4)]">
                          Repeat
                        </span>
                        <Select
                          value={layer.image.repeat}
                          options={REPEAT_OPTIONS}
                          onChange={(v) => updateImage(layer.id, { repeat: v })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-[system-ui,sans-serif] text-[rgba(0,0,0,0.4)]">
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
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-[system-ui,sans-serif] text-[rgba(0,0,0,0.4)] min-w-9">
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
