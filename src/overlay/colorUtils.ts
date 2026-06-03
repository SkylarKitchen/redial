/**
 * colorUtils.ts — Shared color conversion functions.
 *
 * Extracted from infer.ts, WebflowPanel.tsx, and ColorPickerEnhanced.tsx
 * to eliminate duplication. Pure functions only — no DOM access.
 */

/** Convert a CSS rgb()/rgba() string to hex. Returns "transparent" for fully transparent. */
export function cssColorToHex(rgb: string): string {
  if (rgb === "rgba(0, 0, 0, 0)" || rgb === "transparent") return "transparent";

  const match = rgb.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
  );
  if (!match) return rgb;

  const [, r, g, b] = match;
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        parseInt(c)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

/** Convert individual RGB components (0-255) to hex string. */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        Math.round(Math.max(0, Math.min(255, c)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** Parse a hex color string into RGB components. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Validate a 6-digit hex color format (with # prefix). */
export function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

/** Convert hex + opacity to an rgba() string. */
export function hexToRgba(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

type RGB = { r: number; g: number; b: number };

/**
 * WCAG 2.x relative luminance (0–1) of an sRGB color.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio (1–21) between two sRGB colors. Order-independent. */
export function contrastRatio(colorA: RGB, colorB: RGB): number {
  const la = relativeLuminance(colorA);
  const lb = relativeLuminance(colorB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Map a contrast ratio to its WCAG conformance level.
 * Large text (≥24px, or ≥18.66px bold) gets relaxed thresholds.
 */
export function wcagAssessment(
  ratio: number,
  largeText: boolean,
): "AAA" | "AA" | "fail" {
  const aa = largeText ? 3.0 : 4.5;
  const aaa = largeText ? 4.5 : 7.0;
  if (ratio >= aaa) return "AAA";
  if (ratio >= aa) return "AA";
  return "fail";
}
