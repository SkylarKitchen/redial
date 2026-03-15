// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { inferAutoCollections, type AutoCollection } from "../variables/autoCollections";
import type { CSSVariable, VarType } from "../variables/discoverVariables";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeVar(name: string, type: VarType = "color"): CSSVariable {
  return { name, value: "#000", source: "root", type };
}

/** Convenience: find a collection by name */
function findByName(
  collections: AutoCollection[],
  name: string,
): AutoCollection | undefined {
  return collections.find((c) => c.name === name);
}

/** All variable names across all collections */
function allNames(collections: AutoCollection[]): string[] {
  return collections.flatMap((c) => c.variableNames).sort();
}

// ─── Tailwind-style (common namespace `tw`) ──────────────────────────

describe("Tailwind-style vars (namespace tw)", () => {
  const vars = [
    makeVar("--tw-color-red-500"),
    makeVar("--tw-color-blue-500"),
    makeVar("--tw-color-green-500"),
    makeVar("--tw-ring-offset-color"),
    makeVar("--tw-ring-offset-width", "length"),
    makeVar("--tw-ring-color"),
    makeVar("--tw-shadow-color"),
    makeVar("--tw-blur", "string"),
    makeVar("--tw-brightness", "string"),
    makeVar("--tw-gradient-from"),
  ];

  it("detects tw as namespace", () => {
    const result = inferAutoCollections(vars, new Set());
    // All collections should exist (no tw namespace as a collection name)
    expect(result.every((c) => c.name !== "Tw")).toBe(true);
  });

  it("groups Color vars together", () => {
    const result = inferAutoCollections(vars, new Set());
    const color = findByName(result, "Color");
    expect(color).toBeDefined();
    expect(color!.variableNames).toContain("--tw-color-red-500");
    expect(color!.variableNames).toContain("--tw-color-blue-500");
    expect(color!.variableNames).toContain("--tw-color-green-500");
  });

  it("groups Ring vars together", () => {
    const result = inferAutoCollections(vars, new Set());
    const ring = findByName(result, "Ring");
    expect(ring).toBeDefined();
    expect(ring!.variableNames).toHaveLength(3);
  });

  it("collapses Shadow (1 var) into Other", () => {
    const result = inferAutoCollections(vars, new Set());
    const shadow = findByName(result, "Shadow");
    expect(shadow).toBeUndefined();
    const other = findByName(result, "Other");
    expect(other).toBeDefined();
    expect(other!.variableNames).toContain("--tw-shadow-color");
  });

  it("groups Gradient (1 var) into Other", () => {
    const result = inferAutoCollections(vars, new Set());
    const other = findByName(result, "Other");
    expect(other!.variableNames).toContain("--tw-gradient-from");
  });

  it("uses auto: prefixed ids", () => {
    const result = inferAutoCollections(vars, new Set());
    for (const c of result) {
      expect(c.id).toMatch(/^auto:/);
    }
  });

  it("is sorted alphabetically by name", () => {
    const result = inferAutoCollections(vars, new Set());
    const names = result.map((c) => c.name);
    expect(names).toEqual([...names].sort());
  });
});

// ─── Chakra-style vars ───────────────────────────────────────────────

describe("Chakra-style vars (namespace chakra)", () => {
  const vars = [
    makeVar("--chakra-colors-blue-500"),
    makeVar("--chakra-colors-red-500"),
    makeVar("--chakra-colors-green-500"),
    makeVar("--chakra-space-1", "length"),
    makeVar("--chakra-space-2", "length"),
    makeVar("--chakra-space-4", "length"),
    makeVar("--chakra-radii-sm", "length"),
    makeVar("--chakra-radii-md", "length"),
    makeVar("--chakra-fonts-body", "string"),
    makeVar("--chakra-fonts-heading", "string"),
  ];

  it("detects chakra as namespace", () => {
    const result = inferAutoCollections(vars, new Set());
    expect(result.every((c) => c.name !== "Chakra")).toBe(true);
  });

  it("creates Colors, Space, Radii, Fonts collections", () => {
    const result = inferAutoCollections(vars, new Set());
    expect(findByName(result, "Colors")).toBeDefined();
    expect(findByName(result, "Space")).toBeDefined();
    expect(findByName(result, "Radii")).toBeDefined();
    expect(findByName(result, "Fonts")).toBeDefined();
  });

  it("assigns correct vars to Colors", () => {
    const result = inferAutoCollections(vars, new Set());
    const colors = findByName(result, "Colors")!;
    expect(colors.variableNames).toHaveLength(3);
    expect(colors.variableNames).toContain("--chakra-colors-blue-500");
  });

  it("assigns correct vars to Space", () => {
    const result = inferAutoCollections(vars, new Set());
    const space = findByName(result, "Space")!;
    expect(space.variableNames).toHaveLength(3);
  });
});

// ─── No common prefix (Shadcn/Radix style) ──────────────────────────

describe("No common prefix (Shadcn/Radix style)", () => {
  const vars = [
    makeVar("--background"),
    makeVar("--foreground"),
    makeVar("--primary"),
    makeVar("--primary-foreground"),
    makeVar("--muted"),
    makeVar("--muted-foreground"),
    makeVar("--radius", "length"),
    makeVar("--ring"),
  ];

  it("does not detect a namespace", () => {
    const result = inferAutoCollections(vars, new Set());
    // With no namespace, single-segment vars go to their own group
    // primary group = --primary, --primary-foreground
    const primary = findByName(result, "Primary");
    expect(primary).toBeDefined();
    expect(primary!.variableNames).toContain("--primary");
    expect(primary!.variableNames).toContain("--primary-foreground");
  });

  it("groups Muted vars", () => {
    const result = inferAutoCollections(vars, new Set());
    const muted = findByName(result, "Muted");
    expect(muted).toBeDefined();
    expect(muted!.variableNames).toHaveLength(2);
  });

  it("collapses singletons into Other", () => {
    const result = inferAutoCollections(vars, new Set());
    const other = findByName(result, "Other");
    expect(other).toBeDefined();
    // Single-segment vars like --background, --foreground, --radius, --ring
    // each form a group of 1 → collapsed into Other
    expect(other!.variableNames).toContain("--background");
    expect(other!.variableNames).toContain("--foreground");
    expect(other!.variableNames).toContain("--radius");
    expect(other!.variableNames).toContain("--ring");
  });
});

// ─── Open Props style ────────────────────────────────────────────────

describe("Open Props style", () => {
  const vars = [
    makeVar("--size-1", "length"),
    makeVar("--size-2", "length"),
    makeVar("--color-red"),
    makeVar("--color-blue"),
    makeVar("--font-sans", "string"),
    makeVar("--font-mono", "string"),
  ];

  it("creates Size, Color, Font collections", () => {
    const result = inferAutoCollections(vars, new Set());
    expect(findByName(result, "Size")).toBeDefined();
    expect(findByName(result, "Color")).toBeDefined();
    expect(findByName(result, "Font")).toBeDefined();
  });

  it("each collection has 2 vars", () => {
    const result = inferAutoCollections(vars, new Set());
    expect(findByName(result, "Size")!.variableNames).toHaveLength(2);
    expect(findByName(result, "Color")!.variableNames).toHaveLength(2);
    expect(findByName(result, "Font")!.variableNames).toHaveLength(2);
  });

  it("no Other collection needed", () => {
    const result = inferAutoCollections(vars, new Set());
    expect(findByName(result, "Other")).toBeUndefined();
  });
});

// ─── Manual exclusion ────────────────────────────────────────────────

describe("manual exclusion", () => {
  const vars = [
    makeVar("--tw-color-red"),
    makeVar("--tw-color-blue"),
    makeVar("--tw-color-green"),
    makeVar("--tw-ring-offset-color"),
    makeVar("--tw-ring-color"),
    makeVar("--tw-blur", "string"),
    makeVar("--tw-brightness", "string"),
    makeVar("--tw-gradient-from"),
    makeVar("--tw-gradient-to"),
    makeVar("--tw-shadow", "string"),
  ];

  it("excludes manually assigned variables", () => {
    const assigned = new Set(["--tw-color-red"]);
    const result = inferAutoCollections(vars, assigned);
    const allVarNames = allNames(result);
    expect(allVarNames).not.toContain("--tw-color-red");
  });

  it("still includes unassigned variables", () => {
    const assigned = new Set(["--tw-color-red"]);
    const result = inferAutoCollections(vars, assigned);
    const allVarNames = allNames(result);
    expect(allVarNames).toContain("--tw-color-blue");
    expect(allVarNames).toContain("--tw-color-green");
  });
});

// ─── Small group collapse ────────────────────────────────────────────

describe("small group collapse", () => {
  it("merges groups with <2 variables into Other", () => {
    const vars = [
      makeVar("--alpha-one"),
      makeVar("--beta-one"),
      makeVar("--beta-two"),
      makeVar("--gamma-one"),
    ];
    const result = inferAutoCollections(vars, new Set());
    // Alpha (1 var) and Gamma (1 var) should go to Other
    const other = findByName(result, "Other");
    expect(other).toBeDefined();
    expect(other!.variableNames).toContain("--alpha-one");
    expect(other!.variableNames).toContain("--gamma-one");
    // Beta (2 vars) should be its own collection
    const beta = findByName(result, "Beta");
    expect(beta).toBeDefined();
    expect(beta!.variableNames).toHaveLength(2);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────

describe("edge cases", () => {
  it("empty input returns empty array", () => {
    expect(inferAutoCollections([], new Set())).toEqual([]);
  });

  it("single variable goes to Other", () => {
    const vars = [makeVar("--solo-var")];
    const result = inferAutoCollections(vars, new Set());
    // 1-var group collapsed into Other
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Other");
    expect(result[0].variableNames).toEqual(["--solo-var"]);
  });

  it("all variables manually assigned returns empty", () => {
    const vars = [makeVar("--a-one"), makeVar("--a-two")];
    const assigned = new Set(["--a-one", "--a-two"]);
    expect(inferAutoCollections(vars, assigned)).toEqual([]);
  });

  it("stable id generation", () => {
    const vars = [
      makeVar("--color-red"),
      makeVar("--color-blue"),
    ];
    const result = inferAutoCollections(vars, new Set());
    expect(result[0].id).toBe("auto:color");
  });

  it("collections sorted alphabetically", () => {
    const vars = [
      makeVar("--zebra-one"),
      makeVar("--zebra-two"),
      makeVar("--alpha-one"),
      makeVar("--alpha-two"),
    ];
    const result = inferAutoCollections(vars, new Set());
    const names = result.map((c) => c.name);
    expect(names).toEqual(["Alpha", "Zebra"]);
  });
});

// ─── Type-based splitting for large groups ──────────────────────────

describe("type-based splitting for large groups (no namespace)", () => {
  it("splits groups >20 vars into type subgroups", () => {
    // Build 25 vars in "big" group + 2 unrelated vars to prevent namespace detection
    // (namespace requires 60%+ — 25/27 = 92% would trigger it, so we need enough
    // non-big vars to drop below 60%)
    const vars: CSSVariable[] = [];
    for (let i = 0; i < 15; i++) {
      vars.push(makeVar(`--big-color-${i}`, "color"));
    }
    for (let i = 0; i < 10; i++) {
      vars.push(makeVar(`--big-size-${i}`, "length"));
    }
    // Add enough non-big vars so "big" is below 60% threshold
    for (let i = 0; i < 20; i++) {
      vars.push(makeVar(`--other${i}-val`, "string"));
    }
    // 25 big + 20 otherN = 45 total, big = 55% < 60% → no namespace
    const result = inferAutoCollections(vars, new Set());
    const big = findByName(result, "Big");
    expect(big).toBeDefined();
    expect(big!.variableNames).toHaveLength(25);
    // Should have type-based subgroups
    expect(big!.subgroups.length).toBeGreaterThanOrEqual(2);
    const subNames = big!.subgroups.map((s) => s.name).sort();
    expect(subNames).toContain("Color");
    expect(subNames).toContain("Length");
  });

  it("does NOT split groups <=20 vars into subgroups", () => {
    // 10 vars in "small" group + enough others to prevent namespace detection
    const vars: CSSVariable[] = [];
    for (let i = 0; i < 5; i++) {
      vars.push(makeVar(`--small-color-${i}`, "color"));
    }
    for (let i = 0; i < 5; i++) {
      vars.push(makeVar(`--small-size-${i}`, "length"));
    }
    // Add non-small vars so "small" isn't a namespace
    for (let i = 0; i < 10; i++) {
      vars.push(makeVar(`--misc${i}-val`, "string"));
    }
    const result = inferAutoCollections(vars, new Set());
    const small = findByName(result, "Small");
    expect(small).toBeDefined();
    expect(small!.subgroups).toHaveLength(0);
  });
});
