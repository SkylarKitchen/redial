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
  let h = hex.replace("#", "");
  // Expand 3/4-digit shorthand (each nibble doubled: f → ff) before slicing,
  // otherwise blind 2-char windows yield NaN channels (#fff → r:255 g:15 b:NaN).
  // 4 and 8-digit forms carry an alpha pair we ignore — only the first 3 channels.
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Alpha channel (0–1) of a CSS color string, supporting BOTH the legacy comma
 * syntax (rgba(r, g, b, a)) and CSS Color 4 space/slash syntax (rgb(r g b / a)).
 *
 *   "" / "transparent"        → 0
 *   named / hex / opaque rgb  → 1
 *   "rgb(0 0 0 / 0.5)"        → 0.5   (slash alpha)
 *   "rgba(0, 0, 0, 0.5)"      → 0.5   (4th comma component)
 *   "rgb(0 0 0 / 50%)"        → 0.5   (percentage alpha)
 *
 * Returns 1 for anything whose alpha can't be located (treated as opaque).
 */
export function parseColorAlpha(color: string): number {
  if (!color || color === "transparent") return 0;

  const m = color.match(/rgba?\(([^)]+)\)/i);
  if (!m) return 1; // named colors / hex / non-rgb → opaque

  const body = m[1];
  // CSS Color 4 slash-alpha: "r g b / a" — the alpha is after the slash.
  const slash = body.indexOf("/");
  const raw =
    slash !== -1
      ? body.slice(slash + 1).trim()
      : (() => {
          const parts = body.split(",").map((s) => s.trim());
          return parts.length === 4 ? parts[3] : null;
        })();

  if (raw == null) return 1; // no alpha component present → opaque

  const a = raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
  return Number.isNaN(a) ? 1 : a;
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
