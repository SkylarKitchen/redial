// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  parseVarRef,
  resolveVarColor,
  discoverColorVariables,
} from "../colorVariables";

// ─── parseVarRef (pure) ──────────────────────────────────────────────

describe("parseVarRef", () => {
  it("extracts name from var(--foo)", () => {
    expect(parseVarRef("var(--foo)")).toBe("--foo");
  });

  it("trims whitespace inside parens", () => {
    expect(parseVarRef("var( --foo )")).toBe("--foo");
  });

  it("handles hyphenated names", () => {
    expect(parseVarRef("var(--foo-bar)")).toBe("--foo-bar");
  });

  it("handles underscored names", () => {
    expect(parseVarRef("var(--foo_bar)")).toBe("--foo_bar");
  });

  it("ignores fallback after comma", () => {
    expect(parseVarRef("var(--foo, red)")).toBe("--foo");
  });

  it("ignores nested var fallback", () => {
    expect(parseVarRef("var(--foo, var(--bar))")).toBe("--foo");
  });

  it("returns null for plain color value", () => {
    expect(parseVarRef("red")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseVarRef("")).toBeNull();
  });

  it("returns null for empty var()", () => {
    expect(parseVarRef("var()")).toBeNull();
  });

  it("returns null when name has no -- prefix", () => {
    expect(parseVarRef("var(foo)")).toBeNull();
  });

  it("returns null for hex value", () => {
    expect(parseVarRef("#ff6600")).toBeNull();
  });

  it("returns null for rgb() function", () => {
    expect(parseVarRef("rgb(255, 0, 0)")).toBeNull();
  });

  it("handles long variable names", () => {
    expect(parseVarRef("var(--color-brand-primary-500)")).toBe(
      "--color-brand-primary-500",
    );
  });
});

// ─── resolveVarColor (DOM-dependent) ─────────────────────────────────

describe("resolveVarColor", () => {
  it("returns null for non-var values", () => {
    expect(resolveVarColor("red")).toBeNull();
    expect(resolveVarColor("#fff")).toBeNull();
    expect(resolveVarColor("rgb(0,0,0)")).toBeNull();
    expect(resolveVarColor("")).toBeNull();
  });

  it("returns null for var() with no -- prefix", () => {
    expect(resolveVarColor("var(foo)")).toBeNull();
  });

  it("returns null when custom property is not set on :root", () => {
    // happy-dom won't have --nonexistent set
    expect(resolveVarColor("var(--nonexistent-test-prop)")).toBeNull();
  });

  it("resolves a custom property set on documentElement", () => {
    document.documentElement.style.setProperty("--test-color", "#ff0000");
    const result = resolveVarColor("var(--test-color)");
    expect(result).toBe("#ff0000");
    // cleanup
    document.documentElement.style.removeProperty("--test-color");
  });
});

// ─── discoverColorVariables (DOM-dependent) ──────────────────────────

describe("discoverColorVariables", () => {
  it("returns empty array when no stylesheets exist", () => {
    const result = discoverColorVariables();
    expect(result).toEqual([]);
  });

  it("returns an array", () => {
    const result = discoverColorVariables();
    expect(Array.isArray(result)).toBe(true);
  });

  it("result items have name and resolvedValue properties", () => {
    // Even with no results, validate the shape contract holds
    const result = discoverColorVariables();
    for (const item of result) {
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("resolvedValue");
    }
  });
});
