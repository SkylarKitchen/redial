/**
 * cssHelpers.ts — Pure CSS value parsing and serialization functions
 *
 * Zero React dependency. Extracted from WebflowPanel.tsx.
 */

import type { ShadowValue } from "./ShadowEditor";
import type { FilterValues } from "./FilterSliders";
import type { TransformValue } from "./TransformEditor";
import type { TransitionValue } from "./TransitionEditor";

export function rgbToHex(rgb: string): string {
  if (rgb === "rgba(0, 0, 0, 0)" || rgb === "transparent") return "transparent";
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  return (
    "#" +
    [match[1], match[2], match[3]]
      .map((c) => parseInt(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function parseNum(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

export function parseBoxShadow(raw: string): ShadowValue[] {
  if (!raw || raw === "none") return [];
  const shadows: ShadowValue[] = [];
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
    const colorStartMatch = cleaned.match(/^(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})\s+/i);
    const colorEndMatch = cleaned.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|\b(?!(?:\d|inset\b))[a-z]{3,}\b)$/i);
    const color = (colorStartMatch?.[1] ?? colorEndMatch?.[1]) || "rgba(0,0,0,0.1)";
    let numStr = cleaned;
    if (colorStartMatch) {
      numStr = numStr.slice(colorStartMatch[0].length);
    } else if (colorEndMatch) {
      numStr = numStr.slice(0, colorEndMatch.index).trim();
    }
    numStr = numStr.replace(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/g, "").trim();
    const nums = numStr.split(/\s+/).map(parseFloat).filter((n) => !isNaN(n));
    shadows.push({
      x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0, spread: nums[3] ?? 0, color, inset,
    });
  }
  return shadows;
}

export function parseFilter(raw: string): Partial<FilterValues> {
  if (!raw || raw === "none") return {};
  const result: Partial<FilterValues> = {};
  const regex = /(blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia)\(([^)]+)\)/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    const key = m[1] as keyof FilterValues;
    let val = parseFloat(m[2]);
    if (key === "brightness" || key === "contrast" || key === "saturate") val = Math.round(val * 100);
    else if (key === "grayscale" || key === "invert" || key === "sepia") val = Math.round(val * 100);
    result[key] = val;
  }
  return result;
}

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

export function shadowToCSS(shadows: ShadowValue[]): string {
  if (shadows.length === 0) return "none";
  return shadows
    .map((s) => {
      const inset = s.inset ? "inset " : "";
      return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`;
    })
    .join(", ");
}

export function filterToCSS(values: Partial<FilterValues>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(values)) {
    if (val === undefined) continue;
    const k = key as keyof FilterValues;
    if (k === "blur") parts.push(`blur(${val}px)`);
    else if (k === "hue-rotate") parts.push(`hue-rotate(${val}deg)`);
    else if (k === "brightness" || k === "contrast" || k === "saturate") parts.push(`${k}(${val / 100})`);
    else parts.push(`${k}(${val / 100})`);
  }
  return parts.length > 0 ? parts.join(" ") : "none";
}

export function transformToCSS(transforms: TransformValue[]): string {
  if (transforms.length === 0) return "none";
  return transforms
    .map((t) => {
      switch (t.type) {
        case "translate":
          return t.z ? `translate3d(${t.x}px, ${t.y}px, ${t.z}px)` : `translate(${t.x}px, ${t.y}px)`;
        case "scale": return `scale(${t.x}, ${t.y})`;
        case "rotate": return `rotate(${t.x}deg)`;
        case "skew": return `skew(${t.x}deg, ${t.y}deg)`;
      }
    })
    .join(" ");
}

export function parseTransitions(cs: Record<string, string>): TransitionValue[] {
  const props = cs.transitionProperty;
  if (!props || props === "none") return [];
  const properties = props.split(",").map((s) => s.trim());
  const durations = cs.transitionDuration.split(",").map((s) => parseFloat(s.trim()) * 1000);
  const easings = cs.transitionTimingFunction.split(",").map((s) => s.trim());
  const delays = cs.transitionDelay.split(",").map((s) => parseFloat(s.trim()) * 1000);
  return properties.map((p, i) => ({
    property: p,
    duration: durations[i % durations.length] ?? 300,
    easing: easings[i % easings.length] ?? "ease",
    delay: delays[i % delays.length] ?? 0,
  }));
}

export function transitionsToCSS(transitions: TransitionValue[]): string {
  if (transitions.length === 0) return "none";
  return transitions
    .map((t) => `${t.property} ${t.duration}ms ${t.easing} ${t.delay}ms`)
    .join(", ");
}
