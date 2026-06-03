/**
 * unitConversion.ts — Pure unit conversion logic for CSS values.
 *
 * All conversions pivot through px as the intermediate unit.
 * DOM access is isolated to buildConversionContext().
 */

export interface UnitConversionContext {
  computedFontSize: number;
  rootFontSize: number;
  parentWidth: number;
  parentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

/** Read all dimensions needed for unit conversions from the DOM. */
export function buildConversionContext(el: Element): UnitConversionContext {
  const cs = getComputedStyle(el);
  const rootCs = getComputedStyle(document.documentElement);
  const parent = el.parentElement;
  const parentCs = parent ? getComputedStyle(parent) : null;

  return {
    computedFontSize: parseFloat(cs.fontSize) || 16,
    rootFontSize: parseFloat(rootCs.fontSize) || 16,
    parentWidth: parentCs ? parseFloat(parentCs.width) || 0 : 0,
    parentHeight: parentCs ? parseFloat(parentCs.height) || 0 : 0,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

/** Convert value → px using the given source unit. */
function toPx(
  value: number,
  unit: string,
  ctx: UnitConversionContext,
  axis: "width" | "height" = "width"
): number {
  switch (unit) {
    case "px":
      return value;
    case "em":
      return value * ctx.computedFontSize;
    case "rem":
      return value * ctx.rootFontSize;
    case "%": {
      const base = axis === "height" ? ctx.parentHeight : ctx.parentWidth;
      return base === 0 ? 0 : (value / 100) * base;
    }
    case "vw":
      return (value / 100) * ctx.viewportWidth;
    case "vh":
      return (value / 100) * ctx.viewportHeight;
    case "vmin":
      // vmin is relative to the smaller of the two viewport dimensions
      return (value / 100) * Math.min(ctx.viewportWidth, ctx.viewportHeight);
    case "vmax":
      // vmax is relative to the larger of the two viewport dimensions
      return (value / 100) * Math.max(ctx.viewportWidth, ctx.viewportHeight);
    case "ch":
      // Approximate ch as 0.5em
      return value * ctx.computedFontSize * 0.5;
    default:
      return value;
  }
}

/** Convert px → target unit. */
function fromPx(
  px: number,
  unit: string,
  ctx: UnitConversionContext,
  axis: "width" | "height" = "width"
): number {
  switch (unit) {
    case "px":
      return px;
    case "em":
      return ctx.computedFontSize === 0 ? 0 : px / ctx.computedFontSize;
    case "rem":
      return ctx.rootFontSize === 0 ? 0 : px / ctx.rootFontSize;
    case "%": {
      const base = axis === "height" ? ctx.parentHeight : ctx.parentWidth;
      return base === 0 ? 0 : (px / base) * 100;
    }
    case "vw":
      return ctx.viewportWidth === 0 ? 0 : (px / ctx.viewportWidth) * 100;
    case "vh":
      return ctx.viewportHeight === 0 ? 0 : (px / ctx.viewportHeight) * 100;
    case "vmin": {
      const base = Math.min(ctx.viewportWidth, ctx.viewportHeight);
      return base === 0 ? 0 : (px / base) * 100;
    }
    case "vmax": {
      const base = Math.max(ctx.viewportWidth, ctx.viewportHeight);
      return base === 0 ? 0 : (px / base) * 100;
    }
    case "ch":
      return ctx.computedFontSize === 0 ? 0 : px / (ctx.computedFontSize * 0.5);
    default:
      return px;
  }
}

/**
 * Convert a numeric value from one CSS unit to another.
 *
 * Pivots through px as an intermediate:  fromUnit → px → toUnit.
 * Rounds to 2 decimal places.
 */
export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string,
  ctx: UnitConversionContext,
  axis: "width" | "height" = "width"
): number {
  if (fromUnit === toUnit) return value;
  const px = toPx(value, fromUnit, ctx, axis);
  const result = fromPx(px, toUnit, ctx, axis);
  return Math.round(result * 100) / 100;
}

/**
 * Return a human-readable description of the conversion basis for a target unit.
 * E.g. "em" → "base: 16px", "%" → "parent: 400px", "vw" → "viewport: 1280px"
 */
export function conversionBasis(
  toUnit: string,
  ctx: UnitConversionContext,
  axis: "width" | "height" = "width"
): string | undefined {
  switch (toUnit) {
    case "em":
      return `base: ${ctx.computedFontSize}px`;
    case "rem":
      return `root: ${ctx.rootFontSize}px`;
    case "%": {
      const base = axis === "height" ? ctx.parentHeight : ctx.parentWidth;
      return `parent: ${Math.round(base)}px`;
    }
    case "vw":
      return `viewport: ${ctx.viewportWidth}px`;
    case "vh":
      return `viewport: ${ctx.viewportHeight}px`;
    case "vmin":
      return `viewport: ${Math.min(ctx.viewportWidth, ctx.viewportHeight)}px`;
    case "vmax":
      return `viewport: ${Math.max(ctx.viewportWidth, ctx.viewportHeight)}px`;
    case "ch":
      return `base: ${Math.round(ctx.computedFontSize * 0.5)}px`;
    default:
      return undefined;
  }
}
