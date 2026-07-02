// @vitest-environment happy-dom
/**
 * Real project breakpoints — config override + stylesheet auto-detection.
 *
 * The breakpoint set must not be welded to the Tailwind defaults
 * (640/768/1024/1280). Two mechanisms replace it:
 *
 *   1. Config: `configure({ breakpoints: [{ label?, minWidth }] })` (also the
 *      <Tuner breakpoints={...}> prop) replaces the set everywhere — selector
 *      options, preview/export media queries.
 *   2. Detection: with no config, the project's stylesheets are scanned for
 *      `@media (min-width: …)` rules at panel-open; a coherent set (2–6
 *      distinct min-widths) becomes the selectable set.
 *
 * With neither, the current defaults stay exactly 640/768/1024/1280.
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { configure } from "../core/config";
import {
  BREAKPOINTS,
  BASE_BREAKPOINT_ID,
  getBreakpoints,
  detectBreakpointsFromStyleSheets,
  invalidateBreakpointDetection,
  serializeBreakpointCSS,
} from "../breakpoints";
import { BreakpointSelector } from "../shell/BreakpointSelector";
import type { DiffEntry } from "../core/apply";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const styles: HTMLStyleElement[] = [];

function addStyle(css: string): void {
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
  styles.push(el);
}

const ch = (over: Partial<DiffEntry>): DiffEntry => ({
  prop: "color",
  from: "black",
  to: "red",
  ...over,
});

beforeEach(() => {
  configure({ breakpoints: undefined });
  invalidateBreakpointDetection();
});

afterEach(() => {
  cleanup();
  for (const el of styles) el.remove();
  styles.length = 0;
  configure({ breakpoints: undefined });
  invalidateBreakpointDetection();
});

// ─── 1. Config override ───────────────────────────────────────────────────────

describe("config-provided breakpoints replace the default set", () => {
  it("getBreakpoints() returns the configured set: Base first, ascending, labels honored", () => {
    configure({
      breakpoints: [
        { label: "Desktop", minWidth: 960 },
        { minWidth: 480 },
      ],
    });

    const set = getBreakpoints();
    expect(set.map((b) => b.id)).toEqual([BASE_BREAKPOINT_ID, "480", "960"]);
    expect(set[0].minWidth).toBeUndefined();
    expect(set[1].label).toBe("≥ 480"); // default label from minWidth
    expect(set[2].label).toBe("Desktop"); // custom label honored
    expect(set[2].minWidth).toBe(960);
  });

  it("the selector lists the configured breakpoints instead of the defaults", () => {
    configure({ breakpoints: [{ minWidth: 480 }, { label: "Desktop", minWidth: 960 }] });

    let chosen: string | null = null;
    render(<BreakpointSelector value="base" onChange={(v) => (chosen = v)} />);
    fireEvent.click(screen.getByRole("combobox"));

    const portal = document.querySelector("[data-tuner-portal]")!;
    const labels = Array.from(portal.querySelectorAll('[role="option"]')).map(
      (o) => o.textContent,
    );
    expect(labels).toEqual(["Base", "≥ 480", "Desktop"]);
    // The Tailwind defaults must be gone.
    expect(labels).not.toContain("≥ 768");

    fireEvent.click(screen.getByText("≥ 480"));
    expect(chosen).toBe("480");
  });

  it("serializeBreakpointCSS emits @media blocks for configured breakpoints, ascending", () => {
    configure({ breakpoints: [{ minWidth: 480 }, { minWidth: 960 }] });

    const css = serializeBreakpointCSS([
      {
        selector: '[data-redial-bp="1"]',
        changes: [
          ch({ prop: "gap", to: "24px", breakpoint: "960" }),
          ch({ prop: "color", to: "red", breakpoint: "480" }),
        ],
      },
    ]);
    expect(css).toContain("@media (min-width: 480px)");
    expect(css).toContain("@media (min-width: 960px)");
    expect(css.indexOf("min-width: 480px")).toBeLessThan(
      css.indexOf("min-width: 960px"),
    );
  });

  it("config wins over stylesheet detection", () => {
    addStyle("@media (min-width: 700px) { .a { color: red } } @media (min-width: 1100px) { .b { color: blue } }");
    configure({ breakpoints: [{ minWidth: 480 }, { minWidth: 960 }] });

    expect(getBreakpoints().map((b) => b.id)).toEqual([
      BASE_BREAKPOINT_ID,
      "480",
      "960",
    ]);
  });

  it("ignores invalid entries; an all-invalid config falls through to the defaults", () => {
    configure({ breakpoints: [{ minWidth: 0 }, { minWidth: -5 }, { minWidth: NaN }] });
    expect(getBreakpoints().map((b) => b.id)).toEqual(
      BREAKPOINTS.map((b) => b.id),
    );
  });
});

// ─── 2. Stylesheet auto-detection ─────────────────────────────────────────────

describe("stylesheet @media min-width auto-detection", () => {
  it("detects the project's min-width breakpoints from @media rules", () => {
    addStyle(`
      @media (min-width: 480px) { .a { color: red } }
      @media (min-width: 960px) { .b { color: blue } }
    `);
    expect(detectBreakpointsFromStyleSheets(document)).toEqual([480, 960]);

    // …and the active set is built from them (Base + detected, ascending).
    const set = getBreakpoints();
    expect(set.map((b) => b.id)).toEqual([BASE_BREAKPOINT_ID, "480", "960"]);
    expect(set[1].label).toBe("≥ 480");
  });

  it("dedupes repeated min-widths and sorts ascending across sheets", () => {
    addStyle("@media (min-width: 960px) { .a { color: red } }");
    addStyle(`
      @media (min-width: 480px) { .b { color: blue } }
      @media screen and (min-width: 480px) { .c { color: green } }
    `);
    expect(detectBreakpointsFromStyleSheets(document)).toEqual([480, 960]);
  });

  it("falls back to the default set when nothing is detectable (pins 640/768/1024/1280)", () => {
    // No config, no project @media rules.
    const set = getBreakpoints();
    expect(set.map((b) => b.id)).toEqual(["base", "640", "768", "1024", "1280"]);
    expect(set).toEqual(BREAKPOINTS);
  });

  it("falls back to the defaults when the detected set is incoherent (<2 distinct widths)", () => {
    addStyle("@media (min-width: 900px) { .a { color: red } }"); // only one tier
    expect(getBreakpoints().map((b) => b.id)).toEqual(
      BREAKPOINTS.map((b) => b.id),
    );
  });

  it("falls back to the defaults when the detected set is incoherent (>6 distinct widths)", () => {
    addStyle(
      [400, 500, 600, 700, 800, 900, 1000]
        .map((w) => `@media (min-width: ${w}px) { .a { color: red } }`)
        .join("\n"),
    );
    expect(getBreakpoints().map((b) => b.id)).toEqual(
      BREAKPOINTS.map((b) => b.id),
    );
  });

  it("a cross-origin sheet throwing on cssRules access does not break detection", () => {
    addStyle(`
      @media (min-width: 480px) { .a { color: red } }
      @media (min-width: 960px) { .b { color: blue } }
    `);
    const realSheets = Array.from(document.styleSheets);
    const crossOrigin = {
      get cssRules(): CSSRuleList {
        throw new DOMException("SecurityError: cross-origin stylesheet");
      },
    } as unknown as CSSStyleSheet;

    const doc = { styleSheets: [crossOrigin, ...realSheets] };
    expect(() => detectBreakpointsFromStyleSheets(doc)).not.toThrow();
    expect(detectBreakpointsFromStyleSheets(doc)).toEqual([480, 960]);
  });
});
