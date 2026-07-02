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
import { buildGradientCSS, parseGradientCSS } from "./GradientEditor";
import { cssColorToHex as rgbToHex, hexToRgb, parseColorAlpha } from "../colorUtils";
import { splitCSSList } from "../cssParsers";
import type { SectionCtx } from "../panelUtils";
import { BG_CLIP_OPTIONS, BG_SIZE_OPTIONS, BG_POSITION_OPTIONS, BG_REPEAT_OPTIONS, BG_ATTACHMENT_OPTIONS } from "../panelConstants";

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Multiply a CSS color's alpha by `opacity` (used to bake per-layer opacity
 * into gradient stop colors, #75). Handles hex and rgb()/rgba(); anything
 * else (var(), named colors) is returned unchanged rather than mangled.
 */
function colorWithOpacity(raw: string, opacity: number): string {
  if (opacity >= 1) return raw;
  const hex = rgbToHex(raw); // rgb()/rgba() → "#rrggbb"; hex/other pass through
  if (!/^#[0-9a-fA-F]{3,8}$/.test(hex)) return raw;
  const { r, g, b } = hexToRgb(hex);
  const alpha = Math.round(parseColorAlpha(raw) * opacity * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

let seedCounter = 0;

/**
 * Seed the layer list from the element's computed background-image so
 * backgrounds authored in source show up in the panel instead of being
 * silently overwritten by the first layer edit (#75). Gradients the editor
 * can model become editable layers; everything else is kept as a raw
 * pass-through layer.
 */
function seedLayersFromComputed(cs: CSSStyleDeclaration): BackgroundLayer[] {
  const raw = cs.backgroundImage;
  if (!raw || raw === "none") return [];
  const positions = splitCSSList(cs.backgroundPosition || "");
  const sizes = splitCSSList(cs.backgroundSize || "");
  const repeats = splitCSSList(cs.backgroundRepeat || "");
  const attachments = splitCSSList(cs.backgroundAttachment || "");
  const blends = splitCSSList(cs.getPropertyValue("background-blend-mode") || "");
  const layers: BackgroundLayer[] = [];
  splitCSSList(raw).forEach((part, i) => {
    if (part === "none") return;
    const base = {
      id: `seed_${Date.now()}_${++seedCounter}`,
      opacity: 1,
      blendMode: blends[i] || "normal",
      visible: true,
    };
    const urlMatch = part.match(/^url\(\s*(['"]?)(.*?)\1\s*\)$/);
    if (urlMatch) {
      layers.push({
        ...base,
        type: "image",
        image: {
          url: urlMatch[2],
          size: sizes[i] || "auto",
          position: positions[i] || "0% 0%",
          repeat: repeats[i] || "repeat",
          attachment: attachments[i] || "scroll",
        },
      });
      return;
    }
    const gradient = parseGradientCSS(part);
    if (gradient) layers.push({ ...base, type: "gradient", gradient });
    else layers.push({ ...base, type: "gradient", css: part });
  });
  return layers;
}

// ─── Props ────────────────────────────────────────────────────────────

export interface BackgroundsSectionProps {
  ctx: SectionCtx;
  forceOpen?: boolean;
  focusOpen?: boolean;
  onToggle?: (title: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────

export const BackgroundsSection = memo(function BackgroundsSection({ ctx, forceOpen, focusOpen, onToggle }: BackgroundsSectionProps) {
  const { cs, apply, ind, sectionInd, element, ctxMenu, reset, resetReadStr } = ctx;

  const resetCssStr = (prop: string, setter: (v: string) => void) => setter(resetReadStr(prop));

  // ── State ──
  const [bgColor, setBgColor] = useState(() => rgbToHex(cs.backgroundColor));
  const [bgLayers, setBgLayers] = useState<BackgroundLayer[]>(() => {
    // Seed gradient/image layers from source (color is handled separately)
    return seedLayersFromComputed(cs);
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
      // Build per-layer longhand lists from visible layers only. Longhands —
      // never the `background` shorthand, which would reset every other
      // background longhand including the Color row's background-color (#75).
      const images: string[] = [];
      const positions: string[] = [];
      const sizes: string[] = [];
      const repeats: string[] = [];
      const attachments: string[] = [];
      const blendModes: string[] = [];
      let hasImageLayer = false;
      for (const layer of layers) {
        if (layer.visible === false) continue;
        const opacity = layer.opacity ?? 1;
        if (layer.type === "gradient" && layer.gradient) {
          const g = layer.gradient;
          const stops = g.stops.map((s) => ({ ...s, color: colorWithOpacity(s.color, opacity) }));
          images.push(buildGradientCSS(g.type as "linear" | "radial" | "conic", g.angle, stops));
          positions.push("0% 0%"); sizes.push("auto"); repeats.push("repeat"); attachments.push("scroll");
        } else if (layer.type === "color" && layer.color) {
          // A solid layer in a stack is expressed as a two-stop gradient
          const c = colorWithOpacity(layer.color, opacity);
          images.push(`linear-gradient(${c}, ${c})`);
          positions.push("0% 0%"); sizes.push("auto"); repeats.push("repeat"); attachments.push("scroll");
        } else if (layer.type === "image" && layer.image) {
          const img = layer.image;
          hasImageLayer = true;
          images.push(`url(${img.url})`);
          positions.push(img.position); sizes.push(img.size); repeats.push(img.repeat);
          attachments.push(img.attachment || "scroll");
        } else if (layer.css) {
          // Raw pass-through layer seeded from source — keep it verbatim
          images.push(layer.css);
          positions.push("0% 0%"); sizes.push("auto"); repeats.push("repeat"); attachments.push("scroll");
        } else {
          continue;
        }
        blendModes.push(layer.blendMode || "normal");
      }
      if (images.length > 0) {
        apply("background-image", images.join(", "));
        // Position/size/repeat lists only matter when an image layer carries
        // them; for gradient-only stacks leave authored values untouched.
        if (hasImageLayer) {
          apply("background-position", positions.join(", "));
          apply("background-size", sizes.join(", "));
          apply("background-repeat", repeats.join(", "));
        }
        if (attachments.some((a) => a !== "scroll")) {
          apply("background-attachment", attachments.join(", "));
        } else {
          apply("background-attachment", "");
        }
        if (blendModes.some((m) => m !== "normal")) {
          apply("background-blend-mode", blendModes.join(", "));
        } else {
          apply("background-blend-mode", "");
        }
      } else {
        apply("background-image", "none");
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
          reset("background-color");
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
