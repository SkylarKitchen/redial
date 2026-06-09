/**
 * cssParsers.ts — Pure CSS value parsing and serialization functions.
 *
 * Extracted from WebflowPanel.tsx for independent testability.
 * All functions are pure — no DOM access, no side effects.
 */

import type { ShadowValue } from "./sections/ShadowEditor";
import type { FilterItem, FilterType } from "./sections/FilterSliders";
import type { TransformValue } from "./sections/TransformEditor";
import type { TransitionValue } from "./sections/TransitionEditor";
import { CSS_NAME_CHARS } from "../lib/css";

// CSS keywords are case-insensitive, so the `var(` keyword may be authored as
// VAR(/Var( — match it case-insensitively. The custom-property name uses the
// shared Unicode-aware name-char class so i18n names like --primário parse
// (issue #50).
const VAR_RE = new RegExp(`^var\\(\\s*(--[${CSS_NAME_CHARS}]+)\\s*(?:,.*)?\\)$`, "iu");

/** Extract the custom property name from a `var(--foo)` expression. */
export function parseVarRef(value: string): string | null {
  const m = value.match(VAR_RE);
  return m ? m[1] : null;
}

/** Parse a numeric CSS value, returning 0 for non-numeric or non-finite inputs. */
export function parseNum(val: string): number {
  const n = parseFloat(val);
  // Guard both NaN and ±Infinity (parseFloat("Infinity") → Infinity), so a CSS
  // value can never become a non-finite number a serializer would emit verbatim.
  return Number.isFinite(n) ? n : 0;
}

/**
 * Convert a computed line-height + font-size into a unitless multiplier.
 * getComputedStyle returns "normal" (not px) for the default line-height, which
 * has no numeric ratio — return the CSS-`normal` approximation (~1.2) rather
 * than 0 (which would imply collapsed lines). Also guards fs<=0.
 */
export function lineHeightToMultiplier(lineHeightRaw: string, fontSizeRaw: string): number {
  if (lineHeightRaw.trim() === "normal") return 1.2;
  const lh = parseNum(lineHeightRaw);
  const fs = parseNum(fontSizeRaw);
  return fs > 0 ? Math.round((lh / fs) * 100) / 100 : 1.2;
}

/** Extract the CSS unit suffix from a value string (e.g., "16px" → "px", "50%" → "%"). */
export function extractUnit(value: string, fallback: string = "px"): string {
  // Numeric portion allows an optional exponent (1e2rem) and trimmed inner
  // whitespace between the number and unit (50 %); genuinely non-numeric tokens
  // like calc() still fall through to the fallback.
  const match = value.trim().match(/^-?[\d.]+(?:[eE][+-]?\d+)?\s*([a-zA-Z]+|%)$/);
  return match?.[1] ?? fallback;
}

// ─── Box Shadow ──────────────────────────────────────────────────────

/**
 * Parse a shadow length token to px. The ShadowValue model stores offsets,
 * blur, and spread in px (getComputedStyle already returns px), so authored
 * em/rem values must be normalized rather than silently truncated to a bare
 * number that the serializer re-emits as px (issue #48). em/rem are converted
 * at the CSS root font size (16px); other units and bare numbers pass through
 * via parseFloat, matching the prior behavior (e.g. "1e1px" → 10).
 */
function shadowLengthToPx(token: string): number {
  const n = parseFloat(token);
  if (isNaN(n)) return NaN;
  // Trailing em/rem (e.g. "0.5em", "1.5rem") → ×16. The "px"/numeric forms and
  // any other unit fall through unchanged.
  if (/r?em\s*$/i.test(token)) return n * 16;
  return n;
}

export function parseBoxShadow(raw: string): ShadowValue[] {
  if (!raw || raw === "none") return [];
  const shadows: ShadowValue[] = [];
  // Split on commas that are NOT inside parentheses (for rgba colors)
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const inset = part.includes("inset");
    const cleaned = part.replace("inset", "").trim();
    // Extract color (rgb/rgba/hex/named) — browsers may place color first or last
    const colorStartMatch = cleaned.match(/^(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})\s+/i);
    const colorEndMatch = cleaned.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|\b(?!(?:\d|inset\b))[a-z]{3,}\b)$/i);
    const color = (colorStartMatch?.[1] ?? colorEndMatch?.[1]) || "rgba(0,0,0,0.1)";
    // Strip the matched color from the string before parsing numbers
    let numStr = cleaned;
    if (colorStartMatch) {
      numStr = numStr.slice(colorStartMatch[0].length);
    } else if (colorEndMatch) {
      numStr = numStr.slice(0, colorEndMatch.index).trim();
    }
    numStr = numStr.replace(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/g, "").trim();
    const nums = numStr.split(/\s+/).map(shadowLengthToPx).filter((n) => !isNaN(n));
    shadows.push({
      x: nums[0] ?? 0,
      y: nums[1] ?? 0,
      blur: nums[2] ?? 0,
      spread: nums[3] ?? 0,
      color,
      inset,
      visible: true,
    });
  }
  return shadows;
}

export function shadowToCSS(shadows: ShadowValue[]): string {
  const visible = shadows.filter((s) => s.visible !== false);
  if (visible.length === 0) return "none";
  return visible
    .map((s) => {
      const inset = s.inset ? "inset " : "";
      return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
    })
    .join(", ");
}

// ─── Filter ──────────────────────────────────────────────────────────

export function parseFilterItems(raw: string): FilterItem[] {
  if (!raw || raw === "none") return [];
  const matches: { index: number; item: FilterItem }[] = [];

  // Extract drop-shadow manually (handles nested parens in color functions)
  let searchStart = 0;
  while (true) {
    const dsIdx = raw.indexOf("drop-shadow(", searchStart);
    if (dsIdx === -1) break;
    const argsStart = dsIdx + "drop-shadow(".length;
    // Walk to the matching closing paren
    let depth = 1;
    let i = argsStart;
    while (i < raw.length && depth > 0) {
      if (raw[i] === "(") depth++;
      else if (raw[i] === ")") depth--;
      i++;
    }
    const inner = raw.slice(argsStart, i - 1).trim();
    // Extract color (rgba/hsla/hex) from the end
    const colorMatch = inner.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*$/i);
    const color = colorMatch?.[1];
    const numStr = color ? inner.slice(0, colorMatch!.index).trim() : inner;
    const nums = numStr.split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
    matches.push({
      index: dsIdx,
      item: {
        type: "drop-shadow",
        values: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0],
        color: color || undefined,
        visible: true,
        expanded: false,
      },
    });
    searchStart = i;
  }

  // Match simple filter functions
  const simpleRegex = /(blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = simpleRegex.exec(raw)) !== null) {
    const type = m[1] as FilterType;
    const arg = m[2];
    let val = parseFloat(arg);
    if (type !== "blur" && type !== "hue-rotate") {
      // CSS filter amounts accept equivalent decimal (0.8) and percent (80%)
      // forms. Only the decimal form needs scaling into our 0-100 model; a
      // percent value is already in that range. (blur=px / hue-rotate=deg
      // are excluded above and keep their raw units.)
      const isPct = /%\s*$/.test(arg);
      val = isPct ? val : Math.round(val * 100);
    }
    matches.push({
      index: m.index,
      item: { type, values: [val], visible: true, expanded: false },
    });
  }

  // Sort by position in original string to preserve order
  matches.sort((a, b) => a.index - b.index);
  return matches.map(m => m.item);
}

export function filterItemsToCSS(items: FilterItem[]): string {
  const visible = items.filter(i => i.visible);
  if (visible.length === 0) return "none";
  return visible.map(item => {
    if (item.type === "blur") return `blur(${item.values[0]}px)`;
    if (item.type === "hue-rotate") return `hue-rotate(${item.values[0]}deg)`;
    if (item.type === "drop-shadow") {
      const [x, y, blur] = item.values;
      const c = item.color || "rgba(0,0,0,0.25)";
      return `drop-shadow(${x}px ${y}px ${blur}px ${c})`;
    }
    // percentage-based: brightness, contrast, grayscale, invert, saturate, sepia
    return `${item.type}(${item.values[0] / 100})`;
  }).join(" ");
}

// ─── Transform ───────────────────────────────────────────────────────

export function parseTransform(raw: string): TransformValue[] {
  if (!raw || raw === "none") return [];
  const transforms: TransformValue[] = [];
  const regex = /(perspective|translate3d|translate|scale3d|scale|rotateX|rotateY|rotateZ|rotate|skew)\(([^)]+)\)/g;
  let m;
  // Accumulator for rotateX/Y/Z merging
  let rotate: TransformValue | null = null;
  while ((m = regex.exec(raw)) !== null) {
    const fn = m[1];
    const args = m[2].split(",").map((s) => parseFloat(s.trim()));
    if (fn === "perspective") {
      // Skip — handled by parseSelfPerspective
      continue;
    } else if (fn === "translate3d" || fn === "translate") {
      transforms.push({ type: "translate", x: args[0] ?? 0, y: args[1] ?? 0, z: args[2] ?? 0 });
    } else if (fn === "scale3d") {
      transforms.push({ type: "scale", x: args[0] ?? 1, y: args[1] ?? args[0] ?? 1, z: args[2] ?? 1 });
    } else if (fn === "scale") {
      transforms.push({ type: "scale", x: args[0] ?? 1, y: args[1] ?? args[0] ?? 1 });
    } else if (fn === "rotateX") {
      if (!rotate) rotate = { type: "rotate", x: 0, y: 0, z: 0 };
      rotate.x = args[0] ?? 0;
    } else if (fn === "rotateY") {
      if (!rotate) rotate = { type: "rotate", x: 0, y: 0, z: 0 };
      rotate.y = args[0] ?? 0;
    } else if (fn === "rotateZ") {
      if (!rotate) rotate = { type: "rotate", x: 0, y: 0, z: 0 };
      rotate.z = args[0] ?? 0;
    } else if (fn === "rotate") {
      // Legacy rotate(Xdeg) is a Z-rotation
      if (!rotate) rotate = { type: "rotate", x: 0, y: 0, z: 0 };
      rotate.z = args[0] ?? 0;
    } else if (fn === "skew") {
      transforms.push({ type: "skew", x: args[0] ?? 0, y: args[1] ?? 0 });
    }
  }
  if (rotate) transforms.push(rotate);
  // Also handle matrix() — extract rough rotation from a 2D matrix
  if (transforms.length === 0 && raw.startsWith("matrix(")) {
    const nums = raw.match(/matrix\(([^)]+)\)/)?.[1]?.split(",").map(Number);
    if (nums && nums.length >= 6) {
      const angle = Math.round(Math.atan2(nums[1], nums[0]) * (180 / Math.PI));
      const scaleX = Math.sqrt(nums[0] * nums[0] + nums[1] * nums[1]);
      const scaleY = Math.sqrt(nums[2] * nums[2] + nums[3] * nums[3]);
      if (Math.abs(angle) > 0.5) transforms.push({ type: "rotate", x: 0, y: 0, z: angle });
      if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
        transforms.push({ type: "scale", x: Math.round(scaleX * 100) / 100, y: Math.round(scaleY * 100) / 100 });
      }
      if (Math.abs(nums[4]) > 0.5 || Math.abs(nums[5]) > 0.5) {
        transforms.push({ type: "translate", x: Math.round(nums[4]), y: Math.round(nums[5]) });
      }
    }
  }
  return transforms;
}

export function transformToCSS(transforms: TransformValue[]): string {
  if (transforms.length === 0) return "none";
  return transforms
    .map((t) => {
      switch (t.type) {
        case "translate":
          return t.z ? `translate3d(${t.x}px, ${t.y}px, ${t.z}px)` : `translate(${t.x}px, ${t.y}px)`;
        case "scale":
          return t.z !== undefined && t.z !== 1
            ? `scale3d(${t.x}, ${t.y}, ${t.z})`
            : `scale(${t.x}, ${t.y})`;
        case "rotate": {
          const rx = t.x || 0;
          const ry = t.y || 0;
          const rz = t.z ?? 0;
          const parts: string[] = [];
          if (rx) parts.push(`rotateX(${rx}deg)`);
          if (ry) parts.push(`rotateY(${ry}deg)`);
          if (rz) parts.push(`rotateZ(${rz}deg)`);
          if (parts.length === 0) parts.push(`rotateX(0deg)`);
          return parts.join(" ");
        }
        case "skew":
          return `skew(${t.x}deg, ${t.y}deg)`;
      }
    })
    .join(" ");
}

export function parseSelfPerspective(raw: string): number {
  const match = raw.match(/perspective\(([^)]+)\)/);
  if (!match) return 0;
  return parseFloat(match[1]) || 0;
}

export function transformToCSSWithPerspective(
  transforms: TransformValue[],
  selfPerspective: number
): string {
  const css = transformToCSS(transforms);
  if (selfPerspective > 0) {
    return `perspective(${selfPerspective}px) ${css}`;
  }
  return css;
}

// ─── Transitions ─────────────────────────────────────────────────────

export function parseTransitions(cs: CSSStyleDeclaration): TransitionValue[] {
  const props = cs.transitionProperty;
  if (!props || props === "none") return [];
  const properties = props.split(",").map((s) => s.trim());
  const durations = cs.transitionDuration.split(",").map((s) => parseFloat(s.trim()) * 1000);
  const easings = cs.transitionTimingFunction.split(",").map((s) => s.trim());
  const delays = cs.transitionDelay.split(",").map((s) => parseFloat(s.trim()) * 1000);
  const entries = properties.map((p, i) => ({
    property: p,
    duration: durations[i % durations.length] ?? 300,
    easing: easings[i % easings.length] ?? "ease",
    delay: delays[i % delays.length] ?? 0,
    visible: true,
  }));
  // Filter out browser-default phantom entries: "all" with zero duration/delay
  // is what getComputedStyle returns for elements with no explicit transition.
  return entries.filter((t) => t.duration > 0 || t.delay > 0);
}

export function transitionsToCSS(transitions: TransitionValue[]): string {
  const visible = transitions.filter((t) => (t as TransitionValue & { visible?: boolean }).visible !== false);
  if (visible.length === 0) return "none";
  return visible
    .map((t) => `${t.property} ${t.duration}ms ${t.easing} ${t.delay}ms`)
    .join(", ");
}
