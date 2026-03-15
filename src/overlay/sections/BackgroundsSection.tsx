/**
 * BackgroundsSection.tsx — Backgrounds panel section extracted from WebflowPanel.
 *
 * Manages background color, gradient/image layers, and background-clip.
 * Layout matches Figma: sub-section header "Image & gradient" with "+" button,
 * always-visible Color row, and Clipping dropdown.
 */

import { useState, useCallback, memo } from "react";
import { Section, SelectRow, ColorRow, SubSectionHeader } from "../controls";
import { BackgroundLayerList, type BackgroundLayer } from "./BackgroundLayerList";
import { buildGradientCSS } from "./GradientEditor";
import { cssColorToHex as rgbToHex } from "../colorUtils";
import { resetProp, resetAndReadStr } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import { BG_CLIP_OPTIONS, BG_SIZE_OPTIONS, BG_POSITION_OPTIONS, BG_REPEAT_OPTIONS, BG_ATTACHMENT_OPTIONS } from "../panelConstants";
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

  const resetCssStr = (prop: string, setter: (v: string) => void) => setter(resetAndReadStr(element, prop));

  // ── State ──
  const [bgColor, setBgColor] = useState(() => rgbToHex(cs.backgroundColor));
  const [bgLayers, setBgLayers] = useState<BackgroundLayer[]>(() => {
    // Only seed gradient/image layers (color is handled separately)
    return [];
  });
  const [bgClip, setBgClip] = useState(() => {
    const val = cs.getPropertyValue("background-clip") || "border-box";
    // Map default border-box to "none" for display
    return val === "border-box" ? "none" : val;
  });
  const [bgSize, setBgSize] = useState(() => cs.backgroundSize);
  const [bgPosition, setBgPosition] = useState(() => cs.backgroundPosition);
  const [bgRepeat, setBgRepeat] = useState(() => cs.backgroundRepeat);
  const [bgAttachment, setBgAttachment] = useState(() => cs.backgroundAttachment);

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
      for (const layer of layers) {
        if (layer.visible === false) continue;
        if (layer.type === "gradient" && layer.gradient) {
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
      // CSS background: gradients/images first, color handled by separate row
      if (bgParts.length > 0) {
        apply("background", bgParts.join(", "));
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
        apply("background-attachment", "");
        apply("background-blend-mode", "");
      }
    },
    [apply],
  );

  const handleBgClipChange = useCallback(
    (v: string) => {
      setBgClip(v);
      const cssValue = v === "none" ? "border-box" : v;
      apply("background-clip", cssValue);
      if (v === "text") {
        apply("-webkit-background-clip", "text");
      }
    },
    [apply],
  );

  const handleAddLayer = useCallback(() => {
    const newLayer: BackgroundLayer = {
      id: `gradient_${Date.now()}`,
      type: "gradient",
      gradient: {
        type: "linear",
        angle: 180,
        stops: [
          { color: "#ffffff", position: 0 },
          { color: "#000000", position: 100 },
        ],
      },
      opacity: 1,
      blendMode: "normal",
      visible: true,
    };
    handleBgLayersChange([...bgLayers, newLayer]);
  }, [bgLayers, handleBgLayersChange]);

  const handleBgSizeChange = useCallback(
    (v: string) => { setBgSize(v); apply("background-size", v); },
    [apply],
  );
  const handleBgPositionChange = useCallback(
    (v: string) => { setBgPosition(v); apply("background-position", v); },
    [apply],
  );
  const handleBgRepeatChange = useCallback(
    (v: string) => { setBgRepeat(v); apply("background-repeat", v); },
    [apply],
  );
  const handleBgAttachmentChange = useCallback(
    (v: string) => { setBgAttachment(v); apply("background-attachment", v); },
    [apply],
  );

  // Detect whether element has a background-image with url()
  const hasBgImage = cs.backgroundImage && cs.backgroundImage !== "none" && cs.backgroundImage.includes("url(");

  // Clipping options: "None" maps to default border-box
  const clippingOptions = [
    { value: "none", label: "None" },
    ...BG_CLIP_OPTIONS,
  ];

  // ── JSX ──
  return (
    <Section
      title="Backgrounds"
      indicator={sectionInd(["background-color", "background-image", "background-clip", "background-blend-mode", "background-size", "background-position", "background-repeat", "background-attachment"])}
      forceOpen={forceOpen}
      focusOpen={focusOpen}
      onToggle={onToggle}
    >
      {/* 1. Image & gradient sub-section */}
      <SubSectionHeader label="Image & gradient" onAdd={handleAddLayer} />
      {bgLayers.length > 0 && (
        <div style={{ padding: "0 12px" }}>
          <BackgroundLayerList layers={bgLayers} onChange={handleBgLayersChange} />
        </div>
      )}

      {/* 2. Color (always visible) */}
      <ColorRow
        label="Color"
        value={bgColor}
        onChange={handleBgColorChange}
        indicator={ind("background-color")}
        onContextMenu={ctxMenu("background-color", bgColor)}
        computedProp="background-color"
        computedElement={element}
        onReset={() => {
          resetProp(element, "background-color");
          setBgColor(rgbToHex(getComputedStyle(element).backgroundColor));
        }}
      />

      {/* 3. Clipping */}
      <SelectRow
        label="Clipping"
        value={bgClip}
        options={clippingOptions}
        onChange={handleBgClipChange}
        indicator={ind("background-clip")}
        onContextMenu={ctxMenu("background-clip", bgClip)}
        computedProp="background-clip"
        computedElement={element}
        onReset={() => resetCssStr("background-clip", (v) => setBgClip(v === "border-box" ? "none" : v))}
      />

      {/* 4. Background image controls (visible only when element has background-image url()) */}
      {hasBgImage && (
        <>
          <SelectRow
            label="Size"
            value={bgSize}
            options={BG_SIZE_OPTIONS}
            onChange={handleBgSizeChange}
            onReset={() => resetCssStr("background-size", setBgSize)}
            indicator={ind("background-size")}
            onContextMenu={ctxMenu("background-size", bgSize)}
            computedProp="background-size"
            computedElement={element}
          />
          <SelectRow
            label="Position"
            value={bgPosition}
            options={BG_POSITION_OPTIONS}
            onChange={handleBgPositionChange}
            onReset={() => resetCssStr("background-position", setBgPosition)}
            indicator={ind("background-position")}
            onContextMenu={ctxMenu("background-position", bgPosition)}
            computedProp="background-position"
            computedElement={element}
          />
          <SelectRow
            label="Repeat"
            value={bgRepeat}
            options={BG_REPEAT_OPTIONS}
            onChange={handleBgRepeatChange}
            onReset={() => resetCssStr("background-repeat", setBgRepeat)}
            indicator={ind("background-repeat")}
            onContextMenu={ctxMenu("background-repeat", bgRepeat)}
            computedProp="background-repeat"
            computedElement={element}
          />
          <SelectRow
            label="Attachment"
            value={bgAttachment}
            options={BG_ATTACHMENT_OPTIONS}
            onChange={handleBgAttachmentChange}
            onReset={() => resetCssStr("background-attachment", setBgAttachment)}
            indicator={ind("background-attachment")}
            onContextMenu={ctxMenu("background-attachment", bgAttachment)}
            computedProp="background-attachment"
            computedElement={element}
          />
        </>
      )}
    </Section>
  );
});
