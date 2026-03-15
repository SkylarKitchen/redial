/**
 * cssParsers.ts — Pure CSS value parsing and serialization functions.
 *
 * Extracted from WebflowPanel.tsx for independent testability.
 * All functions are pure — no DOM access, no side effects.
 */

import type { ShadowValue } from "./sections/ShadowEditor";
import type { FilterValues } from "./sections/FilterSliders";
import type { TransformValue } from "./sections/TransformEditor";
import type { TransitionValue } from "./sections/TransitionEditor";

/** Parse a numeric CSS value, returning 0 for non-numeric inputs. */
export function parseNum(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

/** Extract the CSS unit suffix from a value string (e.g., "16px" → "px", "50%" → "%"). */
export function extractUnit(value: string, fallback: string = "px"): string {
  const match = value.trim().match(/^-?[\d.]+([a-zA-Z]+|%)$/);
  return match?.[1] ?? fallback;
}

// ─── Box Shadow ──────────────────────────────────────────────────────

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
    const nums = numStr.split(/\s+/).map(parseFloat).filter((n) => !isNaN(n));
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

export function parseFilter(raw: string): Partial<FilterValues> {
  if (!raw || raw === "none") return {};
  const result: Partial<FilterValues> = {};
  const regex = /(blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)\(([^)]+)\)/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    const key = m[1] as keyof FilterValues;
    let val = parseFloat(m[2]);
    // Most filter functions come as decimals from computed style, need * 100
    // (blur uses px and hue-rotate uses deg — those stay as-is from parseFloat)
    if (key !== "blur" && key !== "hue-rotate") {
      val = Math.round(val * 100);
    }
    result[key] = val;
  }
  return result;
}

const FILTER_DEFAULTS: Record<string, number> = {
  blur: 0,
  brightness: 100,
  contrast: 100,
  grayscale: 0,
  "hue-rotate": 0,
  invert: 0,
  saturate: 100,
  sepia: 0,
};

export function filterToCSS(values: Partial<FilterValues>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(values)) {
    if (val === undefined) continue;
    if (val === FILTER_DEFAULTS[key]) continue;
    const k = key as keyof FilterValues;
    if (k === "blur") parts.push(`blur(${val}px)`);
    else if (k === "hue-rotate") parts.push(`hue-rotate(${val}deg)`);
    else parts.push(`${k}(${val / 100})`);
  }
  return parts.length > 0 ? parts.join(" ") : "none";
}

// ─── Transform ───────────────────────────────────────────────────────

export function parseTransform(raw: string): TransformValue[] {
  if (!raw || raw === "none") return [];
  const transforms: TransformValue[] = [];
  const regex = /(translate3d|translate|scale|rotate|skew)\(([^)]+)\)/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    const fn = m[1];
    const args = m[2].split(",").map((s) => parseFloat(s.trim()));
    if (fn === "translate3d" || fn === "translate") {
      transforms.push({ type: "translate", x: args[0] ?? 0, y: args[1] ?? 0, z: args[2] ?? 0 });
    } else if (fn === "scale") {
      transforms.push({ type: "scale", x: args[0] ?? 1, y: args[1] ?? args[0] ?? 1 });
    } else if (fn === "rotate") {
      transforms.push({ type: "rotate", x: args[0] ?? 0, y: 0 });
    } else if (fn === "skew") {
      transforms.push({ type: "skew", x: args[0] ?? 0, y: args[1] ?? 0 });
    }
  }
  // Also handle matrix() — extract rough rotation from a 2D matrix
  if (transforms.length === 0 && raw.startsWith("matrix(")) {
    const nums = raw.match(/matrix\(([^)]+)\)/)?.[1]?.split(",").map(Number);
    if (nums && nums.length >= 6) {
      const angle = Math.round(Math.atan2(nums[1], nums[0]) * (180 / Math.PI));
      const scaleX = Math.sqrt(nums[0] * nums[0] + nums[1] * nums[1]);
      const scaleY = Math.sqrt(nums[2] * nums[2] + nums[3] * nums[3]);
      if (Math.abs(angle) > 0.5) transforms.push({ type: "rotate", x: angle, y: 0 });
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
          return `scale(${t.x}, ${t.y})`;
        case "rotate":
          return `rotate(${t.x}deg)`;
        case "skew":
          return `skew(${t.x}deg, ${t.y}deg)`;
      }
    })
    .join(" ");
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
