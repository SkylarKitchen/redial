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
