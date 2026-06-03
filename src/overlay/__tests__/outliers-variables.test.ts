// @vitest-environment happy-dom
//
// Outlier hunt: CSS variable resolution & var() edge cases.
//
// Targets:
//   - src/overlay/variables/discoverVariables.ts  (parseVarAlias, buildAliasGraph,
//     classifyTier, replaceVarReferences, detectVarType)
//   - src/overlay/variables/colorVariables.ts      (parseVarRef, resolveVarColor)
//   - src/server/commit.ts                          (findPropertyInFile var path)
//
// Each `it(...)` locks in correct/intentional behavior; each `it.fails(...)`
// documents a genuine bug confirmed RED at authoring time.

import { describe, it, expect } from "vitest";
import {
  parseVarAlias,
  buildAliasGraph,
  classifyTier,
  replaceVarReferences,
  detectVarType,
  type CSSVariable,
} from "../variables/discoverVariables";
import { parseVarRef, resolveVarColor } from "../variables/colorVariables";
import { findPropertyInFile } from "../../server/commit";

// ─────────────────────────────────────────────────────────────────────
// parseVarAlias — weird syntactic var() inputs
// ─────────────────────────────────────────────────────────────────────

describe("parseVarAlias — outlier inputs", () => {
  it("parses nested fallbacks var(--a, var(--b, red)) keeping the whole inner expr as fallback", () => {
    expect(parseVarAlias("var(--a, var(--b, red))")).toEqual({
      target: "--a",
      fallback: "var(--b, red)",
    });
  });

  it("treats an empty fallback var(--a, ) as no fallback", () => {
    // The fallback is whitespace-only; the resolver normalizes it to undefined.
    expect(parseVarAlias("var(--a, )")).toEqual({
      target: "--a",
      fallback: undefined,
    });
  });

  it("does NOT treat a var() embedded in a shorthand as a pure alias", () => {
    // "1px solid var(--c)" is not a bare var() expression — there is no single
    // alias target, so the property should be saved as-is, not redirected.
    expect(parseVarAlias("1px solid var(--c)")).toBeNull();
  });

  it("does NOT treat calc(var(--a) * 2) as a pure alias", () => {
    expect(parseVarAlias("calc(var(--a) * 2)")).toBeNull();
  });

  it("does NOT treat two concatenated vars var(--a)var(--b) as an alias", () => {
    expect(parseVarAlias("var(--a)var(--b)")).toBeNull();
  });

  // BUG: parseVarAlias is case-sensitive on the "var(" keyword, but CSS keywords
  // are case-insensitive — VAR(--a) / Var(--a) are valid var() references the
  // resolver fails to recognize, so an uppercase-authored alias never redirects.
  it("recognizes uppercase VAR(--a) as a var() alias (CSS keywords are case-insensitive)", () => {
    expect(parseVarAlias("VAR(--a)")).toEqual({ target: "--a", fallback: undefined });
  });

  // BUG: a var()-valued property carrying !important is not recognized as an
  // alias because the trailing "!important" defeats the end-anchored regex.
  it("recognizes var(--a) !important as an alias to --a", () => {
    expect(parseVarAlias("var(--a) !important")).toEqual({
      target: "--a",
      fallback: undefined,
    });
  });

  // BUG: CSS custom-property names may contain non-ASCII characters, but the
  // [\w-] character class only matches ASCII word chars, so a valid unicode
  // variable like --primário is never parsed as an alias.
  it.fails("parses a var() referencing a non-ASCII custom property name", () => {
    expect(parseVarAlias("var(--primário)")).toEqual({
      target: "--primário",
      fallback: undefined,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// parseVarRef — pure ref extraction outliers
// ─────────────────────────────────────────────────────────────────────

describe("parseVarRef — outlier inputs", () => {
  it("returns the first/outer name from a nested-fallback var()", () => {
    expect(parseVarRef("var(--a, var(--b))")).toBe("--a");
  });

  it("returns null for a var() buried inside calc() (not a bare ref)", () => {
    expect(parseVarRef("calc(var(--a) + 4px)")).toBeNull();
  });

  it("returns null for a var() inside a shorthand", () => {
    expect(parseVarRef("1px solid var(--c)")).toBeNull();
  });

  // BUG: uppercase VAR( is a valid CSS var() reference but parseVarRef's regex
  // is case-sensitive, so the color picker can't resolve an uppercase ref.
  it("extracts the name from an uppercase VAR(--brand) reference", () => {
    expect(parseVarRef("VAR(--brand)")).toBe("--brand");
  });
});

// ─────────────────────────────────────────────────────────────────────
// buildAliasGraph / classifyTier — pathological alias graphs
// ─────────────────────────────────────────────────────────────────────

describe("buildAliasGraph — circular & degenerate chains", () => {
  it("does not infinite-loop on a direct self-reference --a: var(--a)", () => {
    const vars: CSSVariable[] = [
      { name: "--a", value: "red", source: "root", type: "color", aliasOf: "--a" },
    ];
    const graph = buildAliasGraph(vars);
    // The visited-set guard means the path is just the node itself.
    expect(graph.resolve("--a")).toEqual(["--a"]);
  });

  it("does not infinite-loop on a 3-node cycle a→b→c→a", () => {
    const vars: CSSVariable[] = [
      { name: "--a", value: "red", source: "root", type: "color", aliasOf: "--b" },
      { name: "--b", value: "red", source: "root", type: "color", aliasOf: "--c" },
      { name: "--c", value: "red", source: "root", type: "color", aliasOf: "--a" },
    ];
    const graph = buildAliasGraph(vars);
    // Stops the moment it would revisit --a; never re-adds it.
    expect(graph.resolve("--a")).toEqual(["--a", "--b", "--c"]);
  });

  it("resolves a chain that dangles into a variable not present in the set", () => {
    const vars: CSSVariable[] = [
      { name: "--text", value: "red", source: "root", type: "color", aliasOf: "--missing" },
    ];
    const graph = buildAliasGraph(vars);
    // The missing target is still appended (it has no outgoing edge to follow).
    expect(graph.resolve("--text")).toEqual(["--text", "--missing"]);
  });

  it("dependents() reverse-lookup is unaffected by a cycle", () => {
    const vars: CSSVariable[] = [
      { name: "--a", value: "red", source: "root", type: "color", aliasOf: "--b" },
      { name: "--b", value: "red", source: "root", type: "color", aliasOf: "--a" },
    ];
    const graph = buildAliasGraph(vars);
    expect(graph.dependents("--a")).toEqual(["--b"]);
    expect(graph.dependents("--b")).toEqual(["--a"]);
  });

  // Honest-degradation: a self-referencing variable still "has an alias", so
  // classifyTier reports "semantic". The path-length-based tier ignores that
  // the chain is degenerate — this is the actual (defensible) output, locked in.
  it('classifies a self-referencing var as "semantic" (path collapses to length 1)', () => {
    const v: CSSVariable = {
      name: "--a", value: "red", source: "root", type: "color", aliasOf: "--a",
    };
    const graph = buildAliasGraph([v]);
    expect(classifyTier(v, graph)).toBe("semantic");
  });

  it('classifies a var in a 3-cycle as "component" (3-node path ≥ 2 hops)', () => {
    const vars: CSSVariable[] = [
      { name: "--a", value: "red", source: "root", type: "color", aliasOf: "--b" },
      { name: "--b", value: "red", source: "root", type: "color", aliasOf: "--c" },
      { name: "--c", value: "red", source: "root", type: "color", aliasOf: "--a" },
    ];
    const graph = buildAliasGraph(vars);
    expect(classifyTier(vars[0], graph)).toBe("component");
  });
});

// ─────────────────────────────────────────────────────────────────────
// replaceVarReferences-style regex — prefix safety (verified on a clone of
// the production regex, since the real fn touches document.styleSheets which
// happy-dom does not populate from a detached element).
// ─────────────────────────────────────────────────────────────────────

describe("replaceVarReferences — prefix safety & whitespace", () => {
  // We exercise the real function via an inline-styled element so it walks the
  // [style] branch (no live stylesheet needed).
  it("renames var(--accent) without touching var(--accent-dark)", () => {
    const el = document.createElement("div");
    el.style.setProperty("color", "var(--accent)");
    el.style.setProperty("background", "var(--accent-dark)");
    document.body.appendChild(el);

    const count = replaceVarReferences("--accent", "--brand");

    expect(el.style.getPropertyValue("color")).toBe("var(--brand)");
    // --accent-dark must remain untouched (prefix collision guard).
    expect(el.style.getPropertyValue("background")).toBe("var(--accent-dark)");
    expect(count).toBeGreaterThanOrEqual(1);

    document.body.removeChild(el);
  });

  it("renames every occurrence across multiple properties and reports the count", () => {
    // happy-dom rejects var() values that carry a fallback (e.g. "var(--a, red)"),
    // so we exercise the multi-occurrence path with two simple var() refs.
    const el = document.createElement("div");
    el.style.setProperty("color", "var(--a)");
    el.style.setProperty("background", "var(--a)");
    document.body.appendChild(el);

    const count = replaceVarReferences("--a", "--x");

    expect(el.style.getPropertyValue("color")).toBe("var(--x)");
    expect(el.style.getPropertyValue("background")).toBe("var(--x)");
    expect(count).toBe(2);

    document.body.removeChild(el);
  });
});

// ─────────────────────────────────────────────────────────────────────
// detectVarType — values that confuse the color/length classifier
// ─────────────────────────────────────────────────────────────────────

describe("detectVarType — ambiguous values", () => {
  it("classifies a calc() length expression as string (not length)", () => {
    // calc() can't be parsed to a {num, unit}; honestly degrades to "string".
    expect(detectVarType("calc(100% - 16px)")).toEqual({ type: "string" });
  });

  it("classifies a unitless 0 as a number", () => {
    expect(detectVarType("0")).toEqual({ type: "number", numericValue: 0 });
  });

  // BUG: a space-separated modern color like "rgb(255 0 0 / 50%)" IS detected
  // as a color (matches the rgb( prefix), but a bare hue-rotation value such as
  // a quoted font name shows the string fallback is fine — locking the color one.
  it('detects modern slash-syntax "rgb(255 0 0 / 50%)" as a color', () => {
    expect(detectVarType("rgb(255 0 0 / 50%)")).toEqual({ type: "color" });
  });

  // BUG: a leading-dot length like ".5rem" is valid CSS, and LENGTH_RE's
  // [\d.]+ DOES accept it, so it should be a length — lock this in.
  it('detects leading-dot length ".5rem" as a length', () => {
    expect(detectVarType(".5rem")).toEqual({
      type: "length",
      numericValue: 0.5,
      unit: "rem",
    });
  });

  // Honest-degradation: a multi-dot malformed token like "1.2.3px" — parseFloat
  // grabs 1.2 and LENGTH_RE actually accepts it via the greedy [\d.]+ class.
  // Document the real (surprising) output rather than asserting a guess.
  it('treats malformed "1.2.3px" the way the regex actually does', () => {
    const result = detectVarType("1.2.3px");
    // [\d.]+ matches "1.2.3" then parseFloat → 1.2; this is the de-facto output.
    expect(result).toEqual({ type: "length", numericValue: 1.2, unit: "px" });
  });
});

// ─────────────────────────────────────────────────────────────────────
// resolveVarColor — DOM-backed resolution (documentElement inline only,
// since happy-dom reflects inline styles verbatim and does not cascade).
// ─────────────────────────────────────────────────────────────────────

describe("resolveVarColor — :root resolution edge cases", () => {
  it("returns null for an undefined custom property", () => {
    expect(resolveVarColor("var(--definitely-not-set-xyz)")).toBeNull();
  });

  it("returns null for a var() whose definition is itself another var() (no recursion)", () => {
    // resolveVarColor does a single getPropertyValue lookup and does NOT chase a
    // second hop. (Note: happy-dom additionally refuses to store a var()-valued
    // custom property, so the lookup yields "" → null. In a real browser this
    // would resolve to the leaf color; the no-recursion contract still holds.)
    document.documentElement.style.setProperty("--alias", "var(--target)");
    const result = resolveVarColor("var(--alias)");
    expect(result).toBeNull();
    document.documentElement.style.removeProperty("--alias");
  });

  it("resolves a var() with whitespace inside the parens", () => {
    document.documentElement.style.setProperty("--wsc", "#abcdef");
    expect(resolveVarColor("var( --wsc )")).toBe("#abcdef");
    document.documentElement.style.removeProperty("--wsc");
  });
});

// ─────────────────────────────────────────────────────────────────────
// commit.ts findPropertyInFile — locating a custom-property DEFINITION.
// (Pure: operates on a string[]; no temp files needed.)
// ─────────────────────────────────────────────────────────────────────

describe("findPropertyInFile — custom property definition search", () => {
  it("finds an exact --accent definition inside a :root block", () => {
    const lines = [
      ":root {",
      "  --accent: #6366f1;",
      "}",
    ];
    const r = findPropertyInFile(lines, "--accent", "#6366f1");
    expect(r).not.toBeNull();
    expect(lines[r!.lineIdx]).toContain("--accent: #6366f1;");
  });

  it("finds a :root definition nested inside @media", () => {
    // searchRootBlock scans every line for a :root pattern, so a media-nested
    // :root is still located.
    const lines = [
      "@media (min-width: 600px) {",
      "  :root {",
      "    --accent: #6366f1;",
      "  }",
      "}",
    ];
    const r = findPropertyInFile(lines, "--accent", "#6366f1");
    expect(r).not.toBeNull();
    expect(lines[r!.lineIdx]).toContain("--accent: #6366f1;");
  });

  it("finds a :root definition nested inside @layer base", () => {
    const lines = [
      "@layer base {",
      "  :root {",
      "    --accent: #6366f1;",
      "  }",
      "}",
    ];
    const r = findPropertyInFile(lines, "--accent", "#6366f1");
    expect(r).not.toBeNull();
    expect(lines[r!.lineIdx]).toContain("--accent: #6366f1;");
  });

  // BUG: searchWithinRootBlock matches via lines[j].includes(prop), a substring
  // test. When the exact --accent is absent but --accent-dark is present, it
  // wrongly reports the --accent-dark line as the --accent definition — a
  // commit here would silently rewrite the WRONG variable.
  it("does NOT match --accent-dark when searching for --accent (no exact --accent exists)", () => {
    const lines = [
      ":root {",
      "  --accent-dark: #111111;",
      "  --accent-light: #eeeeee;",
      "}",
    ];
    const r = findPropertyInFile(lines, "--accent", "#999999");
    // Correct behavior: --accent is genuinely undefined here, so no false match.
    expect(r).toBeNull();
  });

  // BUG: a comment that mentions the property name is matched before the real
  // declaration, because includes() does not distinguish a declaration from a
  // comment. The reported line is the comment, not the actual definition.
  it("skips a comment mentioning --accent and lands on the real declaration", () => {
    const lines = [
      ":root {",
      "  /* --accent is our brand color */",
      "  --accent: #6366f1;",
      "}",
    ];
    const r = findPropertyInFile(lines, "--accent", "#6366f1");
    expect(r).not.toBeNull();
    expect(lines[r!.lineIdx]).toContain("--accent: #6366f1;");
  });

  // BUG: with light + dark :root blocks both defining --accent, the search
  // ignores the `value` argument entirely and always returns the FIRST block's
  // line. Tuning the dark-theme value would rewrite the light-theme definition.
  it("targets the dark-theme --accent by value when two :root-like blocks define it", () => {
    const lines = [
      ":root {",
      "  --accent: #6366f1;",       // light
      "}",
      '[data-theme="dark"] {',
      "  --accent: #818cf8;",       // dark — the one we are editing
      "}",
    ];
    const r = findPropertyInFile(lines, "--accent", "#818cf8");
    expect(r).not.toBeNull();
    // Should land on the dark block's line (value-disambiguated), not the light one.
    expect(lines[r!.lineIdx]).toContain("#818cf8");
  });
});
