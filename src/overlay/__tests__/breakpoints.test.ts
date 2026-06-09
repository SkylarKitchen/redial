// @vitest-environment happy-dom
/**
 * breakpoints.ts — canonical responsive breakpoints + @media serialization (#35).
 *
 * The engine already keys edits by breakpoint (ADR-0005). #35 adds the missing
 * layers: a selectable breakpoint set, the min-width media condition for each,
 * and a serializer that turns breakpoint-tagged DiffEntry[] into @media CSS
 * (used by both the live preview <style> and the clipboard export).
 */
import { describe, it, expect } from "vitest";
import type { DiffEntry } from "../core/apply";
import {
  BREAKPOINTS,
  BASE_BREAKPOINT_ID,
  mediaConditionFor,
  serializeBreakpointCSS,
} from "../breakpoints";

describe("breakpoint set (#35)", () => {
  it("starts with the base breakpoint and only base has no min-width", () => {
    expect(BREAKPOINTS[0].id).toBe(BASE_BREAKPOINT_ID);
    expect(BREAKPOINTS[0].minWidth).toBeUndefined();
    for (const bp of BREAKPOINTS.slice(1)) {
      expect(bp.minWidth).toBeGreaterThan(0);
    }
  });

  it("min-widths are strictly ascending (mobile-first cascade)", () => {
    const mins = BREAKPOINTS.slice(1).map((b) => b.minWidth!);
    const sorted = [...mins].sort((a, b) => a - b);
    expect(mins).toEqual(sorted);
  });
});

describe("mediaConditionFor (#35)", () => {
  it("returns null for the base breakpoint (un-mediated)", () => {
    expect(mediaConditionFor(BASE_BREAKPOINT_ID)).toBeNull();
  });

  it("returns a min-width condition for a known breakpoint", () => {
    expect(mediaConditionFor("768")).toBe("(min-width: 768px)");
  });

  it("falls back to parsing an arbitrary numeric breakpoint id", () => {
    // The engine allows any breakpoint string; serialization must not choke.
    expect(mediaConditionFor("900")).toBe("(min-width: 900px)");
  });
});

describe("serializeBreakpointCSS (#35)", () => {
  const ch = (over: Partial<DiffEntry>): DiffEntry => ({
    prop: "color",
    from: "black",
    to: "red",
    ...over,
  });

  it("emits an @media block per breakpoint, ascending", () => {
    const css = serializeBreakpointCSS([
      {
        selector: '[data-redial-bp="1"]',
        changes: [
          ch({ prop: "width", to: "100px", breakpoint: "1024" }),
          ch({ prop: "color", to: "red", breakpoint: "768" }),
        ],
      },
    ]);
    // 768 block precedes 1024 block.
    expect(css.indexOf("min-width: 768px")).toBeLessThan(
      css.indexOf("min-width: 1024px"),
    );
    expect(css).toContain("@media (min-width: 768px)");
    expect(css).toContain("color: red");
    expect(css).toContain("@media (min-width: 1024px)");
    expect(css).toContain("width: 100px");
  });

  it("composes a pseudo-state into the selector (breakpoint outer, state inner)", () => {
    const css = serializeBreakpointCSS([
      {
        selector: '[data-redial-bp="2"]',
        changes: [ch({ prop: "color", to: "blue", state: "hover", breakpoint: "768" })],
      },
    ]);
    expect(css).toMatch(/@media \(min-width: 768px\)\s*\{[\s\S]*\[data-redial-bp="2"\]:hover\s*\{/);
    expect(css).toContain("color: blue");
  });

  it("ignores base-breakpoint changes (those are inline, not media-gated)", () => {
    const css = serializeBreakpointCSS([
      { selector: '[data-redial-bp="3"]', changes: [ch({ prop: "color", to: "red" })] },
    ]);
    expect(css).toBe("");
  });

  it("returns empty string when there is nothing to serialize", () => {
    expect(serializeBreakpointCSS([])).toBe("");
  });
});
