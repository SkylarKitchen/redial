// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import type { CSSVariable } from "../discoverVariables";
import { groupByPrefix } from "../discoverVariables";

/** Helper to create a minimal CSSVariable for testing */
function makeVar(name: string): CSSVariable {
  return { name, value: "0", source: "root", type: "string" };
}

// ─── groupByPrefix ──────────────────────────────────────────────────

describe("groupByPrefix", () => {
  it("puts single-segment vars into ungrouped", () => {
    const vars = [makeVar("--foo"), makeVar("--bar")];
    const { groups, ungrouped } = groupByPrefix(vars);
    expect(ungrouped).toHaveLength(2);
    expect(groups).toHaveLength(0);
    expect(ungrouped.map((v) => v.name)).toEqual(["--bar", "--foo"]);
  });

  it("groups two-segment vars by first segment", () => {
    const vars = [makeVar("--cards-gap"), makeVar("--cards-radius")];
    const { groups, ungrouped } = groupByPrefix(vars);
    expect(ungrouped).toHaveLength(0);
    expect(groups).toHaveLength(1);
    expect(groups[0].prefix).toBe("cards");
    expect(groups[0].variables.map((v) => v.name)).toEqual([
      "--cards-gap",
      "--cards-radius",
    ]);
    expect(groups[0].subgroups.size).toBe(0);
  });

  it("creates subgroups for three-segment vars", () => {
    const vars = [
      makeVar("--cards-header-bg"),
      makeVar("--cards-header-color"),
      makeVar("--cards-footer-bg"),
    ];
    const { groups } = groupByPrefix(vars);
    expect(groups).toHaveLength(1);
    expect(groups[0].prefix).toBe("cards");
    expect(groups[0].variables).toHaveLength(0);
    expect(groups[0].subgroups.size).toBe(2);

    const header = groups[0].subgroups.get("header");
    expect(header).toBeDefined();
    expect(header!.variables.map((v) => v.name)).toEqual([
      "--cards-header-bg",
      "--cards-header-color",
    ]);

    const footer = groups[0].subgroups.get("footer");
    expect(footer).toBeDefined();
    expect(footer!.variables.map((v) => v.name)).toEqual([
      "--cards-footer-bg",
    ]);
  });

  it("sorts groups alphabetically by prefix", () => {
    const vars = [
      makeVar("--zeta-size"),
      makeVar("--alpha-gap"),
      makeVar("--mid-color"),
    ];
    const { groups } = groupByPrefix(vars);
    expect(groups.map((g) => g.prefix)).toEqual(["alpha", "mid", "zeta"]);
  });

  it("capitalizes labels", () => {
    const vars = [makeVar("--cards-header-bg"), makeVar("--nav-width")];
    const { groups } = groupByPrefix(vars);
    expect(groups[0].label).toBe("Cards");
    expect(groups[1].label).toBe("Nav");

    const headerSub = groups[0].subgroups.get("header");
    expect(headerSub!.label).toBe("Header");
  });

  it("returns empty groups and ungrouped for empty input", () => {
    const { groups, ungrouped } = groupByPrefix([]);
    expect(groups).toHaveLength(0);
    expect(ungrouped).toHaveLength(0);
  });

  it("handles mixed segment lengths correctly", () => {
    const vars = [
      makeVar("--solo"),
      makeVar("--cards-gap"),
      makeVar("--cards-header-bg"),
      makeVar("--nav-width"),
      makeVar("--another"),
    ];
    const { groups, ungrouped } = groupByPrefix(vars);

    // Ungrouped: single-segment
    expect(ungrouped.map((v) => v.name)).toEqual(["--another", "--solo"]);

    // Groups: cards (with 1 direct var + 1 subgroup) and nav (1 direct var)
    expect(groups).toHaveLength(2);
    expect(groups[0].prefix).toBe("cards");
    expect(groups[0].variables).toHaveLength(1);
    expect(groups[0].variables[0].name).toBe("--cards-gap");
    expect(groups[0].subgroups.size).toBe(1);
    expect(groups[0].subgroups.get("header")!.variables).toHaveLength(1);

    expect(groups[1].prefix).toBe("nav");
    expect(groups[1].variables).toHaveLength(1);
    expect(groups[1].variables[0].name).toBe("--nav-width");
  });
});
