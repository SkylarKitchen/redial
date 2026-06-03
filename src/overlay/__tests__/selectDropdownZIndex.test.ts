/**
 * Test: SelectRow's plain (non-searchable) dropdown must render above the panel.
 *
 * History: the old shadcn-Select path passed `z-[200]` to <SelectContent>, which
 * tailwind-merge deduplicated against the Shadcn default `z-[2147483647]`,
 * dropping the dropdown behind the panel. That path is gone — SelectRow now
 * renders an inline portaled listbox styled with theme tokens.
 *
 * The intent survives: the dropdown portal must sit at zIndex.max
 * (2147483647), never behind the panel, and must not hardcode any lower
 * z-index value.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const OVERLAY_DIR = join(__dirname, "..");

function readSrc(path: string) {
  return readFileSync(path, "utf-8");
}

describe("SelectRow inline dropdown z-index must not render behind the panel", () => {
  const src = readSrc(join(OVERLAY_DIR, "controls", "SelectRow.tsx"));

  it("uses zIndex.max for the portaled dropdown", () => {
    const matches = src.match(/zIndex:\s*zIndex\.max/g) || [];
    // Both the plain listbox portal and the searchable portal use zIndex.max.
    expect(matches.length).toBeGreaterThan(0);
  });

  it("does not lower the dropdown z-index below the panel", () => {
    // The old bug used a literal `200`. There must be no hardcoded numeric
    // zIndex on the dropdown portals.
    expect(src).not.toContain("zIndex: 200");
    expect(src).not.toMatch(/zIndex:\s*\d+/);
  });
});
