// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  parseVarAlias,
  buildAliasGraph,
  classifyTier,
  type CSSVariable,
} from "../variables/discoverVariables";

// ─── parseVarAlias ──────────────────────────────────────────────────

describe("parseVarAlias", () => {
  it("parses basic var() reference", () => {
    expect(parseVarAlias("var(--gray-900)")).toEqual({
      target: "--gray-900",
      fallback: undefined,
    });
  });

  it("parses var() with fallback value", () => {
    expect(parseVarAlias("var(--gray-900, #111827)")).toEqual({
      target: "--gray-900",
      fallback: "#111827",
    });
  });

  it("parses nested var() as fallback", () => {
    expect(parseVarAlias("var(--a, var(--b))")).toEqual({
      target: "--a",
      fallback: "var(--b)",
    });
  });

  it("handles extra whitespace", () => {
    expect(parseVarAlias(" var( --gray-900 ) ")).toEqual({
      target: "--gray-900",
      fallback: undefined,
    });
  });

  it("returns null for hex color", () => {
    expect(parseVarAlias("#ff0000")).toBeNull();
  });

  it("returns null for length value", () => {
    expect(parseVarAlias("16px")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseVarAlias("")).toBeNull();
  });

  it("returns null for bare custom property name", () => {
    expect(parseVarAlias("--gray-900")).toBeNull();
  });
});

// ─── buildAliasGraph ────────────────────────────────────────────────

describe("buildAliasGraph", () => {
  it("resolves a simple alias chain", () => {
    const vars: CSSVariable[] = [
      { name: "--base", value: "#000", source: "root", type: "color" },
      { name: "--text", value: "#000", source: "root", type: "color", aliasOf: "--base" },
      { name: "--heading", value: "#000", source: "root", type: "color", aliasOf: "--text" },
    ];
    const graph = buildAliasGraph(vars);
    expect(graph.resolve("--heading")).toEqual(["--heading", "--text", "--base"]);
  });

  it("detects cycles and stops", () => {
    const vars: CSSVariable[] = [
      { name: "--a", value: "#000", source: "root", type: "color", aliasOf: "--b" },
      { name: "--b", value: "#000", source: "root", type: "color", aliasOf: "--a" },
    ];
    const graph = buildAliasGraph(vars);
    const path = graph.resolve("--a");
    // Should stop when it hits --a again: ["--a", "--b"]
    expect(path).toEqual(["--a", "--b"]);
  });

  it("returns dependents (reverse lookup)", () => {
    const vars: CSSVariable[] = [
      { name: "--base", value: "#000", source: "root", type: "color" },
      { name: "--text", value: "#000", source: "root", type: "color", aliasOf: "--base" },
      { name: "--link", value: "#000", source: "root", type: "color", aliasOf: "--base" },
    ];
    const graph = buildAliasGraph(vars);
    expect(graph.dependents("--base")).toEqual(["--link", "--text"]);
  });

  it("returns empty edges map when no aliases exist", () => {
    const vars: CSSVariable[] = [
      { name: "--a", value: "#000", source: "root", type: "color" },
      { name: "--b", value: "16px", source: "root", type: "length" },
    ];
    const graph = buildAliasGraph(vars);
    expect(graph.edges.size).toBe(0);
  });
});

// ─── classifyTier ───────────────────────────────────────────────────

describe("classifyTier", () => {
  const vars: CSSVariable[] = [
    { name: "--base", value: "#000", source: "root", type: "color" },
    { name: "--text", value: "#000", source: "root", type: "color", aliasOf: "--base" },
    { name: "--heading", value: "#000", source: "root", type: "color", aliasOf: "--text" },
  ];
  const graph = buildAliasGraph(vars);

  it('classifies variable with no alias as "primitive"', () => {
    expect(classifyTier(vars[0], graph)).toBe("primitive");
  });

  it('classifies variable aliasing a primitive as "semantic"', () => {
    expect(classifyTier(vars[1], graph)).toBe("semantic");
  });

  it('classifies variable with 2+ hop alias chain as "component"', () => {
    expect(classifyTier(vars[2], graph)).toBe("component");
  });
});
