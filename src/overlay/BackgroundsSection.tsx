/**
 * BackgroundsSection.tsx — Backgrounds panel section extracted from WebflowPanel.
 *
 * Manages background color, gradient/image layers, and background-clip.
 */

import { useState, useCallback, memo } from "react";
import { Section, SelectRow, ColorRow } from "./controls";
import { BackgroundLayerList, type BackgroundLayer } from "./BackgroundLayerList";
import { buildGradientCSS } from "./GradientEditor";
import { cssColorToHex as rgbToHex } from "./colorUtils";
import type { SectionCtx } from "./panelUtils";
import { BG_CLIP_OPTIONS } from "./panelConstants";

// ─── Props ────────────────────────────────────────────────────────────

export interface BackgroundsSectionProps {
  ctx: SectionCtx;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────

export const BackgroundsSection = memo(function BackgroundsSection({ ctx, forceOpen, focusOpen, onToggle }: BackgroundsSectionProps) {
  const { cs, apply, ind, sectionInd, element, ctxMenu } = ctx;

  // ── State ──
  const [bgColor, setBgColor] = useState(() => rgbToHex(cs.backgroundColor));
  const [bgLayers, setBgLayers] = useState<BackgroundLayer[]>(() => {
    const bg = rgbToHex(cs.backgroundColor);
    if (bg !== "transparent") {
      return [{ id: "initial_color", type: "color", color: bg, opacity: 1, blendMode: "normal", visible: true }];
    }
    return [];
  });
  const [bgClip, setBgClip] = useState(() => cs.getPropertyValue("background-clip") || "border-box");

  // ── Handlers ──
  const handleBgColorChange = useCallback(
    (v: string) => { setBgColor(v); apply("background-color", v); },
    [apply],
  );

  const handleBgLayersChange = useCallback(
    (layers: BackgroundLayer[]) => {
      setBgLayers(layers);
      // Build background parts from visible layers only
      const bgParts: string[] = [];
      const attachments: string[] = [];
      const blendModes: string[] = [];
      let effectiveBgColor = "transparent";
      for (const layer of layers) {
        if (layer.visible === false) continue;
        if (layer.type === "color") {
          effectiveBgColor = layer.color || "transparent";
        } else if (layer.type === "gradient" && layer.gradient) {
          const g = layer.gradient;
          bgParts.push(buildGradientCSS(g.type as "linear" | "radial" | "conic", g.angle, g.stops));
          blendModes.push(layer.blendMode || "normal");
        } else if (layer.type === "image" && layer.image) {
          const img = layer.image;
          bgParts.push(
            `url(${img.url}) ${img.position} / ${img.size} ${img.repeat}`,
          );
          attachments.push(img.attachment || "scroll");
          blendModes.push(layer.blendMode || "normal");
        }
      }
      // CSS background: gradients/images first, then color as the last layer
      if (bgParts.length > 0) {
        apply("background", bgParts.join(", "));
        apply("background-color", effectiveBgColor);
        if (attachments.some((a) => a !== "scroll")) {
          apply("background-attachment", attachments.join(", "));
        }
        if (blendModes.some((m) => m !== "normal")) {
          apply("background-blend-mode", blendModes.join(", "));
        } else {
          apply("background-blend-mode", "");
        }
      } else {
        apply("background", "none");
        apply("background-color", effectiveBgColor);
        apply("background-attachment", "");
        apply("background-blend-mode", "");
      }
    },
    [apply],
  );

  const handleBgClipChange = useCallback(
    (v: string) => {
      setBgClip(v);
      apply("background-clip", v);
      if (v === "text") {
        apply("-webkit-background-clip", "text");
      }
    },
    [apply],
  );

  // ── JSX ──
  return (
    <Section
      title="Backgrounds"
      indicator={sectionInd(["background-color", "background-image", "background-clip", "background-blend-mode"])}
      forceOpen={forceOpen}
      focusOpen={focusOpen}
      onToggle={onToggle}
    >
      {bgLayers.length > 0 ? (
        <div className="px-3">
          <BackgroundLayerList layers={bgLayers} onChange={handleBgLayersChange} />
        </div>
      ) : (
        <ColorRow label="Color" value={bgColor} onChange={handleBgColorChange} indicator={ind("background-color")} onContextMenu={ctxMenu("background-color", bgColor)} computedProp="background-color" computedElement={element} />
      )}
      <SelectRow label="Clip" value={bgClip} options={BG_CLIP_OPTIONS} onChange={handleBgClipChange} indicator={ind("background-clip")} onContextMenu={ctxMenu("background-clip", bgClip)} computedProp="background-clip" computedElement={element} />
    </Section>
  );
});
