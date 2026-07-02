// @vitest-environment happy-dom
/**
 * typographyLabelScrub.test.ts — Webflow label-scrub fidelity for Typography
 *
 * Bug: Typography's numeric property labels (Size, Height, and the advanced
 * Letter spacing / Text indent / Columns / Column gap / Word spacing / Stroke)
 * render as plain <span>s, so they do NOT support Webflow's signature
 * click-and-drag-on-label scrubbing — unlike SizeInputCell, SliderRow, NumberRow
 * and BordersSection, which route their labels through <LabelScrub>.
 *
 * Observable signature of the bug: the "Size"/"Height" labels render with
 * cursor:default/pointer instead of cursor:ew-resize, and the section never
 * mounts the shared <ScrubLabel> wrapper.
 *
 * Fix: a shared <ScrubLabel> (LabelScrub + indicator + reset popover) used at
 * every TypoValueCell call site.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

const typoSrc = readFileSync(
  join(__dirname, "../sections/TypographySection.tsx"),
  "utf-8",
);

// ─── Mock ctx (mirrors typographySection.test.ts) ─────────────────────

function makeMockCtx(): SectionCtx {
  const element = document.createElement("div");
  element.style.fontSize = "16px";
  element.style.fontWeight = "400";
  element.style.lineHeight = "1.4";
  element.style.letterSpacing = "0px";
  element.style.color = "rgb(0, 0, 0)";
  element.style.fontFamily = "sans-serif";
  element.textContent = "Hello world";
  document.body.appendChild(element);

  return {
    element,
    apply: vi.fn(),
    reset: vi.fn(),
    resetRead: () => 0,
    resetReadStr: () => "",
    ind: () => "none",
    sectionInd: () => "none",
    cs: getComputedStyle(element),
    parentCs: null,
    getConversionCtx: (): UnitConversionContext => ({
      computedFontSize: 16,
      rootFontSize: 16,
      parentWidth: 800,
      parentHeight: 600,
      viewportWidth: 1280,
      viewportHeight: 720,
    }),
    ctxMenu: () => vi.fn(),
    isTailwind: false,
  };
}

async function renderTypography(): Promise<string> {
  const { TypographySection } = await import("../sections/TypographySection");
  return renderToString(
    createElement(TypographySection, {
      ctx: makeMockCtx(),
      columnGap: 0,
      columnGapUnit: "px",
      onColumnGapChange: vi.fn(),
      onColumnGapUnitChange: vi.fn(),
    }),
  );
}

/** True if some <span> with exactly `labelText` carries cursor:ew-resize. */
function isScrubHandle(html: string, labelText: string): boolean {
  const root = document.createElement("div");
  root.innerHTML = html;
  return [...root.querySelectorAll("span")].some(
    (s) =>
      s.textContent?.trim() === labelText &&
      /ew-resize/.test(s.getAttribute("style") ?? ""),
  );
}

// ─── Behavioral: the always-visible numeric labels scrub ──────────────

describe("Typography numeric labels are Webflow-style scrub handles", () => {
  it('the "Size" label renders as a drag-scrub handle (cursor:ew-resize)', async () => {
    const html = await renderTypography();
    expect(isScrubHandle(html, "Size")).toBe(true);
  });

  it('the "Height" label renders as a drag-scrub handle (cursor:ew-resize)', async () => {
    const html = await renderTypography();
    expect(isScrubHandle(html, "Height")).toBe(true);
  });
});

// ─── Structural: every numeric label routes through ScrubLabel ────────

describe("Typography wires all numeric labels through ScrubLabel", () => {
  it("imports the shared ScrubLabel control", () => {
    expect(typoSrc).toMatch(/import\s*\{[^}]*\bScrubLabel\b[^}]*\}\s*from/);
  });

  it("uses ScrubLabel for every numeric TypoValueCell label (>= 8 sites)", () => {
    const count = (typoSrc.match(/<ScrubLabel/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it("scrubs each advanced numeric caption", () => {
    for (const label of [
      "Letter spacing",
      "Text indent",
      "Columns",
      "Column gap",
      "Word spacing",
    ]) {
      expect(
        new RegExp(`<ScrubLabel[\\s\\S]*?>${label}<`).test(typoSrc),
        `"${label}" caption should be wrapped in <ScrubLabel>`,
      ).toBe(true);
    }
  });
});
