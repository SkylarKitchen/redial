// @vitest-environment happy-dom
/**
 * modeDiscovery.test.ts — Test CSS variable mode detection across
 * the 4 real-world patterns: class toggle, data-attribute, media query,
 * and breakpoint media query.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  type ModeDeclaration,
  type InferredMode,
  discoverModeDeclarations,
  inferModes,
  parseModeSelector,
} from "../variables/modeDiscovery";

// ─── Helpers ──────────────────────────────────────────────────────────

const styles: HTMLStyleElement[] = [];

function addStyle(css: string): void {
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
  styles.push(el);
}

afterEach(() => {
  for (const el of styles) el.remove();
  styles.length = 0;
});

// ─── parseModeSelector ───────────────────────────────────────────────

describe("parseModeSelector", () => {
  it("returns 'base' for :root", () => {
    expect(parseModeSelector(":root")).toBe("base");
  });

  it("returns 'base' for html", () => {
    expect(parseModeSelector("html")).toBe("base");
  });

  it("extracts class name from :root.dark", () => {
    expect(parseModeSelector(":root.dark")).toBe("dark");
  });

  it("extracts class name from .dark", () => {
    expect(parseModeSelector(".dark")).toBe("dark");
  });

  it("extracts class name from html.theme-brand", () => {
    expect(parseModeSelector("html.theme-brand")).toBe("theme-brand");
  });

  it("extracts data-attribute value from [data-theme=dark]", () => {
    expect(parseModeSelector('[data-theme="dark"]')).toBe("dark");
  });

  it("extracts data-attribute value from :root[data-mode=compact]", () => {
    expect(parseModeSelector(':root[data-mode="compact"]')).toBe("compact");
  });

  it("extracts data-attribute without quotes", () => {
    expect(parseModeSelector("[data-theme=light]")).toBe("light");
  });

  it("returns null for non-mode selectors like .card", () => {
    expect(parseModeSelector(".card")).toBeNull();
  });

  it("returns null for complex selectors like .card > .header", () => {
    expect(parseModeSelector(".card > .header")).toBeNull();
  });
});

// ─── discoverModeDeclarations ────────────────────────────────────────

describe("discoverModeDeclarations", () => {
  it("finds declarations from :root", () => {
    addStyle(":root { --bg: #fff; --text: #000; }");

    const decls = discoverModeDeclarations();
    expect(decls.length).toBeGreaterThanOrEqual(2);

    const bg = decls.find((d) => d.name === "--bg");
    expect(bg).toBeDefined();
    expect(bg!.rawValue).toBe("#fff");
    expect(bg!.selector).toBe(":root");
    expect(bg!.mediaCondition).toBeUndefined();
  });

  it("finds declarations from multiple selectors for the same variable", () => {
    addStyle(`
      :root { --bg: #fff; }
      .dark { --bg: #111; }
    `);

    const decls = discoverModeDeclarations();
    const bgDecls = decls.filter((d) => d.name === "--bg");
    expect(bgDecls.length).toBe(2);

    const rootDecl = bgDecls.find((d) => d.selector === ":root");
    const darkDecl = bgDecls.find((d) => d.selector === ".dark");
    expect(rootDecl!.rawValue).toBe("#fff");
    expect(darkDecl!.rawValue).toBe("#111");
  });

  it("captures media condition for @media rules", () => {
    addStyle(`
      :root { --bg: #fff; }
      @media (prefers-color-scheme: dark) {
        :root { --bg: #111; }
      }
    `);

    const decls = discoverModeDeclarations();
    const bgDecls = decls.filter((d) => d.name === "--bg");
    expect(bgDecls.length).toBe(2);

    const mediaDecl = bgDecls.find((d) => d.mediaCondition);
    expect(mediaDecl).toBeDefined();
    expect(mediaDecl!.mediaCondition).toContain("prefers-color-scheme");
    expect(mediaDecl!.rawValue).toBe("#111");
  });

  it("captures data-attribute selectors", () => {
    addStyle(`
      [data-theme="light"] { --bg: #fff; }
      [data-theme="dark"]  { --bg: #111; }
    `);

    const decls = discoverModeDeclarations();
    const bgDecls = decls.filter((d) => d.name === "--bg");
    expect(bgDecls.length).toBe(2);

    const lightDecl = bgDecls.find((d) => d.selector.includes("light"));
    const darkDecl = bgDecls.find((d) => d.selector.includes("dark"));
    expect(lightDecl!.rawValue).toBe("#fff");
    expect(darkDecl!.rawValue).toBe("#111");
  });

  it("captures breakpoint media queries", () => {
    addStyle(`
      :root { --cols: 1; }
      @media (min-width: 768px) { :root { --cols: 2; } }
      @media (min-width: 1024px) { :root { --cols: 3; } }
    `);

    const decls = discoverModeDeclarations();
    const colDecls = decls.filter((d) => d.name === "--cols");
    expect(colDecls.length).toBe(3);

    const breakpoints = colDecls
      .filter((d) => d.mediaCondition)
      .map((d) => d.mediaCondition);
    expect(breakpoints).toContain("(min-width: 768px)");
    expect(breakpoints).toContain("(min-width: 1024px)");
  });

  it("ignores non-variable properties", () => {
    addStyle(":root { --bg: #fff; color: red; font-size: 16px; }");

    const decls = discoverModeDeclarations();
    expect(decls.every((d) => d.name.startsWith("--"))).toBe(true);
  });

  it("returns empty array when no stylesheets have variables", () => {
    addStyle("body { color: red; }");

    const decls = discoverModeDeclarations();
    expect(decls).toEqual([]);
  });
});

// ─── inferModes ──────────────────────────────────────────────────────

describe("inferModes", () => {
  it("returns single 'Base' mode when only :root declarations exist", () => {
    const decls: ModeDeclaration[] = [
      { name: "--bg", rawValue: "#fff", selector: ":root" },
      { name: "--text", rawValue: "#000", selector: ":root" },
    ];

    const modes = inferModes(decls);
    expect(modes.length).toBe(1);
    expect(modes[0].name).toBe("Base");
    expect(modes[0].source).toBe("base");
  });

  it("infers class-based modes from :root + .dark", () => {
    const decls: ModeDeclaration[] = [
      { name: "--bg", rawValue: "#fff", selector: ":root" },
      { name: "--bg", rawValue: "#111", selector: ".dark" },
      { name: "--text", rawValue: "#000", selector: ":root" },
      { name: "--text", rawValue: "#fff", selector: ".dark" },
    ];

    const modes = inferModes(decls);
    expect(modes.length).toBe(2);
    expect(modes.map((m) => m.name).sort()).toEqual(["Base", "Dark"]);

    const darkMode = modes.find((m) => m.name === "Dark")!;
    expect(darkMode.source).toBe("class");
    expect(darkMode.selector).toBe(".dark");
  });

  it("infers data-attribute modes", () => {
    const decls: ModeDeclaration[] = [
      { name: "--bg", rawValue: "#fff", selector: '[data-theme="light"]' },
      { name: "--bg", rawValue: "#111", selector: '[data-theme="dark"]' },
    ];

    const modes = inferModes(decls);
    expect(modes.length).toBe(2);
    const names = modes.map((m) => m.name).sort();
    expect(names).toEqual(["Dark", "Light"]);
  });

  it("infers prefers-color-scheme media query mode", () => {
    const decls: ModeDeclaration[] = [
      { name: "--bg", rawValue: "#fff", selector: ":root" },
      {
        name: "--bg",
        rawValue: "#111",
        selector: ":root",
        mediaCondition: "(prefers-color-scheme: dark)",
      },
    ];

    const modes = inferModes(decls);
    expect(modes.length).toBe(2);
    expect(modes.map((m) => m.name)).toContain("Dark (system)");

    const sysMode = modes.find((m) => m.name === "Dark (system)")!;
    expect(sysMode.source).toBe("media");
  });

  it("infers breakpoint modes", () => {
    const decls: ModeDeclaration[] = [
      { name: "--cols", rawValue: "1", selector: ":root" },
      { name: "--cols", rawValue: "2", selector: ":root", mediaCondition: "(min-width: 768px)" },
      { name: "--cols", rawValue: "3", selector: ":root", mediaCondition: "(min-width: 1024px)" },
    ];

    const modes = inferModes(decls);
    expect(modes.length).toBe(3);
    expect(modes.map((m) => m.name)).toContain("Base");
    // Breakpoints should produce descriptive names
    const bpModes = modes.filter((m) => m.source === "media");
    expect(bpModes.length).toBe(2);
  });

  it("provides variable values per mode", () => {
    const decls: ModeDeclaration[] = [
      { name: "--bg", rawValue: "#fff", selector: ":root" },
      { name: "--bg", rawValue: "#111", selector: ".dark" },
      { name: "--text", rawValue: "#000", selector: ":root" },
      { name: "--text", rawValue: "#eee", selector: ".dark" },
      { name: "--radius", rawValue: "8px", selector: ":root" },
      // radius not overridden in dark → inherits base value
    ];

    const modes = inferModes(decls);
    const base = modes.find((m) => m.name === "Base")!;
    const dark = modes.find((m) => m.name === "Dark")!;

    expect(base.values["--bg"]).toBe("#fff");
    expect(base.values["--text"]).toBe("#000");
    expect(base.values["--radius"]).toBe("8px");

    expect(dark.values["--bg"]).toBe("#111");
    expect(dark.values["--text"]).toBe("#eee");
    // radius not in dark mode declarations → undefined (inherits from base)
    expect(dark.values["--radius"]).toBeUndefined();
  });

  it("deduplicates prefers-color-scheme media mode when class mode exists", () => {
    const decls: ModeDeclaration[] = [
      { name: "--bg", rawValue: "#fff", selector: ":root" },
      { name: "--bg", rawValue: "#111", selector: ".dark" },
      { name: "--bg", rawValue: "#222", selector: ":root", mediaCondition: "(prefers-color-scheme: dark)" },
    ];

    const modes = inferModes(decls);
    // "Dark (system)" should be dropped because "Dark" class mode covers it
    expect(modes.length).toBe(2);
    expect(modes.map((m) => m.name).sort()).toEqual(["Base", "Dark"]);
  });

  it("keeps prefers-color-scheme media mode when no class mode exists", () => {
    const decls: ModeDeclaration[] = [
      { name: "--bg", rawValue: "#fff", selector: ":root" },
      { name: "--bg", rawValue: "#111", selector: ":root", mediaCondition: "(prefers-color-scheme: dark)" },
    ];

    const modes = inferModes(decls);
    expect(modes.length).toBe(2);
    expect(modes.map((m) => m.name)).toContain("Dark (system)");
  });

  it("skips component-scoped selectors (not modes)", () => {
    const decls: ModeDeclaration[] = [
      { name: "--radius", rawValue: "8px", selector: ":root" },
      { name: "--radius", rawValue: "12px", selector: ".card" },
      { name: "--radius", rawValue: "4px", selector: ".btn-sm" },
    ];

    const modes = inferModes(decls);
    // .card and .btn-sm are component selectors, not mode selectors
    // Only base mode should be inferred
    expect(modes.length).toBe(1);
    expect(modes[0].name).toBe("Base");
  });
});
