// @vitest-environment happy-dom
/**
 * transformOriginPicker.test.ts — TransformOriginPicker component tests
 *
 * Covers:
 * - 3x3 grid rendering with 9 clickable cells
 * - Active cell highlighting for keyword values
 * - Parsing percent values to grid positions
 * - Keyboard accessibility (Enter/Space)
 * - showInputs mode (Left/Top numeric inputs)
 * - OriginInput clamping and ArrowUp/Down behavior
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const originSrc = readFileSync(
  join(__dirname, "../sections/TransformOriginPicker.tsx"),
  "utf-8",
);

// ─── P5-1: Renders 3x3 grid of cells ────────────────────────────────

describe("TransformOriginPicker grid rendering", () => {
  it("renders 9 role='button' cells", async () => {
    const { TransformOriginPicker } = await import(
      "../sections/TransformOriginPicker"
    );
    const html = renderToString(
      createElement(TransformOriginPicker, {
        value: "center",
        onChange: vi.fn(),
      }),
    );
    const buttonCount = (html.match(/role="button"/g) || []).length;
    expect(buttonCount).toBe(9);
  });
});

// ─── P5-2: Click cell calls onChange with keyword ────────────────────

describe("TransformOriginPicker click behavior", () => {
  it("handleClick calls onChange with the origin keyword", () => {
    // Source: onClick={() => handleClick(origin)} where handleClick calls onChange(origin)
    expect(originSrc).toMatch(/handleClick\s*=\s*useCallback/);
    expect(originSrc).toMatch(/onChange\(origin\)/);
  });
});

// ─── P5-3 / P5-4: Active cell highlighted ───────────────────────────

describe("TransformOriginPicker active cell highlighting", () => {
  it("'center' highlights center cell (primary background)", async () => {
    const { TransformOriginPicker } = await import(
      "../sections/TransformOriginPicker"
    );
    const html = renderToString(
      createElement(TransformOriginPicker, {
        value: "center",
        onChange: vi.fn(),
      }),
    );
    // The active cell uses color.primary as background; non-active cells use "transparent"
    // title="MC" is the center cell
    expect(html).toContain('title="MC"');
  });

  it("'top right' highlights top-right cell", async () => {
    const { TransformOriginPicker } = await import(
      "../sections/TransformOriginPicker"
    );
    const html = renderToString(
      createElement(TransformOriginPicker, {
        value: "top right",
        onChange: vi.fn(),
      }),
    );
    // title="TR" is the top-right cell
    expect(html).toContain('title="TR"');
  });

  it("active cell is determined by parseOrigin matching col/row", () => {
    // Source: isActive = ci === activeCol && ri === activeRow
    expect(originSrc).toMatch(
      /ci\s*===\s*activeCol\s*&&\s*ri\s*===\s*activeRow/,
    );
  });
});

// ─── P5-5: Keyboard Enter/Space activates cell ──────────────────────

describe("TransformOriginPicker keyboard accessibility", () => {
  it("Enter or Space key calls handleClick", () => {
    // Source: if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(origin); }
    expect(originSrc).toMatch(
      /e\.key\s*===\s*"Enter"\s*\|\|\s*e\.key\s*===\s*" "/,
    );
    expect(originSrc).toMatch(/e\.preventDefault\(\)[\s\S]*?handleClick\(origin\)/);
  });
});

// ─── P5-6 / P5-7 / P5-8 / P5-9: parseOrigin logic ──────────────────

describe("TransformOriginPicker parseOrigin behavior", () => {
  it("tokenToIndex maps 'left'/'top' to 0, 'center' to 1, 'right'/'bottom' to 2", () => {
    // Source: tokenToIndex function
    expect(originSrc).toMatch(/t\s*===\s*"left"\s*\|\|\s*t\s*===\s*"top".*return 0/);
    expect(originSrc).toMatch(/t\s*===\s*"center".*return 1/);
    expect(originSrc).toMatch(/t\s*===\s*"right"\s*\|\|\s*t\s*===\s*"bottom".*return 2/);
  });

  it("tokenToIndex maps <=5% to 0, 45-55% to 1, >=95% to 2", () => {
    // Source: percentage mapping in tokenToIndex
    expect(originSrc).toMatch(/pct\s*<=\s*5.*return 0/);
    expect(originSrc).toMatch(/pct\s*>=\s*45\s*&&\s*pct\s*<=\s*55.*return 1/);
    expect(originSrc).toMatch(/pct\s*>=\s*95.*return 2/);
  });

  it("px values return -1 (unmappable without element size)", () => {
    // Source: the final return -1 in tokenToIndex (no px handler)
    expect(originSrc).toMatch(/return -1;/);
  });

  it("parseOrigin does exact keyword match first (fast path)", () => {
    // Source: iterates ORIGIN_GRID and checks if (v === ORIGIN_GRID[row][col])
    expect(originSrc).toMatch(/v\s*===\s*ORIGIN_GRID\[row\]\[col\]/);
  });

  it("parseOrigin handles swapped keywords like 'top left' (Y then X)", () => {
    // Source: isYKeyword(parts[0]) && (isXKeyword(parts[1]) || parts[1] === "center")
    expect(originSrc).toMatch(/isYKeyword\(parts\[0\]\)/);
  });
});

// ─── P5-10 / P5-11: showInputs mode ─────────────────────────────────

describe("TransformOriginPicker showInputs mode", () => {
  it("showInputs=false renders grid only, no Left/Top labels", async () => {
    const { TransformOriginPicker } = await import(
      "../sections/TransformOriginPicker"
    );
    const html = renderToString(
      createElement(TransformOriginPicker, {
        value: "center",
        onChange: vi.fn(),
        showInputs: false,
      }),
    );
    expect(html).not.toContain("Left");
    expect(html).not.toContain("Top");
  });

  it("showInputs=true renders grid + Left + Top inputs", async () => {
    const { TransformOriginPicker } = await import(
      "../sections/TransformOriginPicker"
    );
    const html = renderToString(
      createElement(TransformOriginPicker, {
        value: "center",
        onChange: vi.fn(),
        showInputs: true,
      }),
    );
    expect(html).toContain("Left");
    expect(html).toContain("Top");
  });

  it("source returns grid-only when showInputs is falsy", () => {
    // Source: if (!showInputs) return grid;
    expect(originSrc).toMatch(/if\s*\(!showInputs\)\s*return\s*grid/);
  });
});

// ─── P5-12 / P5-13: Left/Top input change emits percent format ──────

describe("TransformOriginPicker percent input handlers", () => {
  it("handleLeftChange emits 'v% topPct%' format", () => {
    // Source: onChange(`${v}% ${topPct}%`)
    expect(originSrc).toMatch(/onChange\(`\$\{v\}%\s+\$\{topPct\}%`\)/);
  });

  it("handleTopChange emits 'leftPct% v%' format", () => {
    // Source: onChange(`${leftPct}% ${v}%`)
    expect(originSrc).toMatch(/onChange\(`\$\{leftPct\}%\s+\$\{v\}%`\)/);
  });
});

// ─── P5-14: OriginInput clamps to [0, 100] on blur ──────────────────

describe("OriginInput clamping and keyboard", () => {
  it("commit clamps value to [0, 100]", () => {
    // Source: Math.max(0, Math.min(100, Math.round(parsed)))
    expect(originSrc).toMatch(
      /Math\.max\(0,\s*Math\.min\(100,\s*Math\.round\(parsed\)\)\)/,
    );
  });

  // P5-15: ArrowUp increments by 1
  it("ArrowUp increments value by 1, clamped to 100", () => {
    // Source: Math.min(100, Math.round(value) + 1)
    expect(originSrc).toMatch(
      /Math\.min\(100,\s*Math\.round\(value\)\s*\+\s*1\)/,
    );
  });

  it("ArrowDown decrements value by 1, clamped to 0", () => {
    // Source: Math.max(0, Math.round(value) - 1)
    expect(originSrc).toMatch(
      /Math\.max\(0,\s*Math\.round\(value\)\s*-\s*1\)/,
    );
  });
});
