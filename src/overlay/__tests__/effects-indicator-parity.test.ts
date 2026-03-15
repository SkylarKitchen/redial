// @vitest-environment happy-dom
/**
 * effects-indicator-parity.test.ts
 *
 * Bug: The Effects section header shows a blue "modified" dot, but some
 * properties tracked by sectionInd have no per-row indicator — so the user
 * sees the dot but can't find which control to reset.
 *
 * Also: secondary controls (perspective, backface-visibility, pointer-events,
 * visibility, user-select) have per-row indicators but are MISSING from
 * sectionInd, so editing them won't light up the section header.
 *
 * This test enforces: every property in sectionInd must have a row-level
 * indicator, and every property with a row-level indicator must be in
 * sectionInd.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "../sections/EffectsSection.tsx"),
  "utf-8",
);

// ── Extract the sectionInd array from the source ──────────────────────

function extractSectionIndProps(source: string): string[] {
  // Match: sectionInd(["prop1", "prop2", ...])
  const m = source.match(/sectionInd\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error("Could not find sectionInd call in EffectsSection");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((r) => r[1]);
}

// ── Extract all ind("prop") calls (row-level indicators) ─────────────

function extractRowIndicatorProps(source: string): string[] {
  return [...source.matchAll(/\bind\("([^"]+)"\)/g)].map((r) => r[1]);
}

const sectionProps = extractSectionIndProps(src);
const rowProps = extractRowIndicatorProps(src);

describe("Effects section indicator parity", () => {
  it("every sectionInd property has a matching row-level ind() call", () => {
    const missing = sectionProps.filter((p) => !rowProps.includes(p));
    expect(
      missing,
      `These properties are in sectionInd but have NO row indicator — ` +
        `the user sees the blue dot but can't find which row to reset: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every row-level ind() property is included in sectionInd", () => {
    const missing = rowProps.filter((p) => !sectionProps.includes(p));
    expect(
      missing,
      `These properties have row indicators but are NOT in sectionInd — ` +
        `editing them won't light up the section header: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
