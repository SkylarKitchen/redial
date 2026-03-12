// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import {
  parseLength,
  detectVarType,
  LENGTH_RE,
  walkRules,
  discoverVariables,
  discoverLengthVariables,
} from "../discoverVariables";

// ─── parseLength ────────────────────────────────────────────────────

describe("parseLength", () => {
  it("parses integer px", () => {
    expect(parseLength("16px")).toEqual({ num: 16, unit: "px" });
  });

  it("parses decimal em", () => {
    expect(parseLength("1.5em")).toEqual({ num: 1.5, unit: "em" });
  });

  it("parses percentage", () => {
    expect(parseLength("100%")).toEqual({ num: 100, unit: "%" });
  });

  it("parses negative values", () => {
    expect(parseLength("-10px")).toEqual({ num: -10, unit: "px" });
  });

  it("parses zero", () => {
    expect(parseLength("0px")).toEqual({ num: 0, unit: "px" });
  });

  it("parses vw", () => {
    expect(parseLength("12vw")).toEqual({ num: 12, unit: "vw" });
  });

  it("parses rem", () => {
    expect(parseLength("2.5rem")).toEqual({ num: 2.5, unit: "rem" });
  });

  it("parses vh", () => {
    expect(parseLength("50vh")).toEqual({ num: 50, unit: "vh" });
  });

  it("parses vmin", () => {
    expect(parseLength("10vmin")).toEqual({ num: 10, unit: "vmin" });
  });

  it("parses vmax", () => {
    expect(parseLength("10vmax")).toEqual({ num: 10, unit: "vmax" });
  });

  it("parses ch", () => {
    expect(parseLength("3ch")).toEqual({ num: 3, unit: "ch" });
  });

  it("parses ex", () => {
    expect(parseLength("2ex")).toEqual({ num: 2, unit: "ex" });
  });

  it("parses lh", () => {
    expect(parseLength("1.2lh")).toEqual({ num: 1.2, unit: "lh" });
  });

  it("parses cm", () => {
    expect(parseLength("5cm")).toEqual({ num: 5, unit: "cm" });
  });

  it("parses pt", () => {
    expect(parseLength("12pt")).toEqual({ num: 12, unit: "pt" });
  });

  it("trims whitespace", () => {
    expect(parseLength(" 16px ")).toEqual({ num: 16, unit: "px" });
  });

  it("returns null for keyword 'auto'", () => {
    expect(parseLength("auto")).toBeNull();
  });

  it("returns null for color name", () => {
    expect(parseLength("red")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseLength("")).toBeNull();
  });

  it("returns null for bare number without unit", () => {
    expect(parseLength("42")).toBeNull();
  });

  it("returns null for unit without number", () => {
    expect(parseLength("px")).toBeNull();
  });
});

// ─── LENGTH_RE ──────────────────────────────────────────────────────

describe("LENGTH_RE", () => {
  it("matches standard units", () => {
    for (const unit of ["px", "em", "rem", "%", "vw", "vh", "ch", "ex"]) {
      expect(`10${unit}`).toMatch(LENGTH_RE);
    }
  });

  it("matches dynamic viewport units", () => {
    for (const unit of ["svw", "svh", "lvw", "lvh", "dvw", "dvh"]) {
      expect(`5${unit}`).toMatch(LENGTH_RE);
    }
  });

  it("matches absolute length units", () => {
    for (const unit of ["cm", "mm", "in", "pt", "pc", "Q"]) {
      expect(`1${unit}`).toMatch(LENGTH_RE);
    }
  });

  it("matches negative values", () => {
    expect("-3.5px").toMatch(LENGTH_RE);
  });

  it("rejects bare numbers", () => {
    expect("42").not.toMatch(LENGTH_RE);
  });

  it("rejects keywords", () => {
    expect("auto").not.toMatch(LENGTH_RE);
  });

  it("rejects color values", () => {
    expect("#fff").not.toMatch(LENGTH_RE);
  });

  it("rejects invalid unit", () => {
    expect("10xyz").not.toMatch(LENGTH_RE);
  });
});

// ─── detectVarType ──────────────────────────────────────────────────

describe("detectVarType", () => {
  it("detects hex color (short)", () => {
    expect(detectVarType("#fff")).toEqual({ type: "color" });
  });

  it("detects hex color (6-digit)", () => {
    expect(detectVarType("#ff0000")).toEqual({ type: "color" });
  });

  it("detects hex color (8-digit alpha)", () => {
    expect(detectVarType("#ff000080")).toEqual({ type: "color" });
  });

  it("detects rgb()", () => {
    expect(detectVarType("rgb(255, 0, 0)")).toEqual({ type: "color" });
  });

  it("detects rgba()", () => {
    expect(detectVarType("rgba(255, 0, 0, 0.5)")).toEqual({ type: "color" });
  });

  it("detects hsl()", () => {
    expect(detectVarType("hsl(120, 50%, 50%)")).toEqual({ type: "color" });
  });

  it("detects oklch()", () => {
    expect(detectVarType("oklch(0.7 0.15 180)")).toEqual({ type: "color" });
  });

  it("detects 'transparent' keyword", () => {
    expect(detectVarType("transparent")).toEqual({ type: "color" });
  });

  it("detects 'currentColor' keyword (case-insensitive)", () => {
    expect(detectVarType("currentColor")).toEqual({ type: "color" });
  });

  it("detects named colors (black, white, red, etc.)", () => {
    for (const name of ["black", "white", "red", "blue", "green"]) {
      expect(detectVarType(name)).toEqual({ type: "color" });
    }
  });

  it("detects px length with numericValue and unit", () => {
    expect(detectVarType("16px")).toEqual({ type: "length", numericValue: 16, unit: "px" });
  });

  it("detects em length", () => {
    expect(detectVarType("1.5em")).toEqual({ type: "length", numericValue: 1.5, unit: "em" });
  });

  it("detects rem length", () => {
    expect(detectVarType("2rem")).toEqual({ type: "length", numericValue: 2, unit: "rem" });
  });

  it("detects bare integer as number", () => {
    expect(detectVarType("42")).toEqual({ type: "number", numericValue: 42 });
  });

  it("detects negative decimal as number", () => {
    expect(detectVarType("-3.14")).toEqual({ type: "number", numericValue: -3.14 });
  });

  it("detects zero as number", () => {
    expect(detectVarType("0")).toEqual({ type: "number", numericValue: 0 });
  });

  it("classifies 'auto' as string", () => {
    expect(detectVarType("auto")).toEqual({ type: "string" });
  });

  it("classifies 'none' as string", () => {
    expect(detectVarType("none")).toEqual({ type: "string" });
  });

  it("classifies arbitrary text as string", () => {
    expect(detectVarType("sans-serif")).toEqual({ type: "string" });
  });
});

// ─── walkRules ──────────────────────────────────────────────────────

describe("walkRules", () => {
  it("invokes callback for each CSSStyleRule", () => {
    const style = document.createElement("style");
    style.textContent = ".a { color: red; } .b { color: blue; }";
    document.head.appendChild(style);

    const collected: string[] = [];
    const sheet = style.sheet!;
    walkRules(sheet.cssRules, (rule) => {
      collected.push(rule.selectorText);
    });

    expect(collected).toContain(".a");
    expect(collected).toContain(".b");

    document.head.removeChild(style);
  });
});

// ─── discoverVariables (DOM) ────────────────────────────────────────

describe("discoverVariables", () => {
  it("returns empty array for element with no custom properties", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const vars = discoverVariables(el);
    expect(vars).toEqual([]);

    document.body.removeChild(el);
  });

  it("discovers inline custom property as 'element' source", () => {
    const el = document.createElement("div");
    el.style.setProperty("--my-size", "24px");
    document.body.appendChild(el);

    const vars = discoverVariables(el);
    const found = vars.find((v) => v.name === "--my-size");
    expect(found).toBeDefined();
    expect(found!.source).toBe("element");
    expect(found!.type).toBe("length");
    expect(found!.numericValue).toBe(24);
    expect(found!.unit).toBe("px");

    document.body.removeChild(el);
  });

  it("discovers inherited custom property from ancestor", () => {
    const parent = document.createElement("div");
    parent.style.setProperty("--parent-spacing", "8px");
    const child = document.createElement("span");
    parent.appendChild(child);
    document.body.appendChild(parent);

    // happy-dom doesn't cascade custom properties through getComputedStyle,
    // so we stub it to return the ancestor's value for the child element.
    const realGetCS = window.getComputedStyle;
    const childCS = realGetCS(child);
    const fakeChildCS = new Proxy(childCS, {
      get(target, prop) {
        if (prop === "getPropertyValue") {
          return (name: string) => {
            if (name === "--parent-spacing") return "8px";
            return target.getPropertyValue(name);
          };
        }
        return (target as any)[prop];
      },
    });
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      if (el === child) return fakeChildCS as CSSStyleDeclaration;
      return realGetCS(el);
    });

    const vars = discoverVariables(child);
    const found = vars.find((v) => v.name === "--parent-spacing");
    expect(found).toBeDefined();
    expect(found!.source).toBe("inherited");
    expect(found!.type).toBe("length");
    expect(found!.numericValue).toBe(8);
    expect(found!.unit).toBe("px");

    vi.restoreAllMocks();
    document.body.removeChild(parent);
  });

  it("returns results sorted by name", () => {
    const el = document.createElement("div");
    el.style.setProperty("--z-var", "10px");
    el.style.setProperty("--a-var", "20px");
    el.style.setProperty("--m-var", "30px");
    document.body.appendChild(el);

    const vars = discoverVariables(el);
    const names = vars.map((v) => v.name);
    expect(names).toEqual([...names].sort());

    document.body.removeChild(el);
  });

  it("element inline var overrides ancestor var with same name", () => {
    const parent = document.createElement("div");
    parent.style.setProperty("--shared", "10px");
    const child = document.createElement("div");
    child.style.setProperty("--shared", "99px");
    parent.appendChild(child);
    document.body.appendChild(parent);

    const vars = discoverVariables(child);
    const found = vars.find((v) => v.name === "--shared");
    expect(found).toBeDefined();
    expect(found!.source).toBe("element");
    expect(found!.value).toBe("99px");

    document.body.removeChild(parent);
  });
});

// ─── discoverLengthVariables ────────────────────────────────────────

describe("discoverLengthVariables", () => {
  it("returns only length-type variables", () => {
    const el = document.createElement("div");
    el.style.setProperty("--size", "16px");
    el.style.setProperty("--count", "5");
    el.style.setProperty("--bg", "#ff0000");
    el.style.setProperty("--label", "auto");
    document.body.appendChild(el);

    const vars = discoverLengthVariables(el);
    expect(vars.length).toBe(1);
    expect(vars[0].name).toBe("--size");
    expect(vars[0].type).toBe("length");

    document.body.removeChild(el);
  });

  it("returns empty array when no length vars exist", () => {
    const el = document.createElement("div");
    el.style.setProperty("--name", "hello");
    document.body.appendChild(el);

    const vars = discoverLengthVariables(el);
    expect(vars).toEqual([]);

    document.body.removeChild(el);
  });
});
