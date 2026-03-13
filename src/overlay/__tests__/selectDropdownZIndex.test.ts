// @vitest-environment happy-dom
/**
 * Test: SelectRow dropdown z-index must not be lowered by caller classNames.
 *
 * Bug: controls.tsx passes `z-[200]` to SelectContent. Because cn() (tailwind-merge)
 * deduplicates z-index utilities and keeps the last one, `z-[200]` replaces the
 * Shadcn default `z-[2147483647]`. With Tailwind `important: true`, this compiles to
 * `z-index: 200 !important`, overriding the inline `zIndex: 2147483647`.
 * The dropdown portal renders behind the panel (z-index: 2147483647 !important)
 * and appears completely broken.
 *
 * Fix: Remove z-index classes from SelectContent callers — the Shadcn component
 * already provides the correct z-index.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PANEL_Z = 2147483647;
const OVERLAY_DIR = join(__dirname, "..");

function readSrc(path: string) {
  return readFileSync(path, "utf-8");
}

describe("Bug: SelectContent z-index override by caller className", () => {
  it("controls.tsx SelectContent className must not contain a z-index utility lower than the panel", () => {
    const src = readSrc(join(OVERLAY_DIR, "controls.tsx"));

    // Find all SelectContent className attributes
    // Pattern: <SelectContent followed by className="..." on the same or next line
    const selectContentBlocks = src.split("<SelectContent");
    // Skip the first split chunk (before the first <SelectContent)
    const callerClassNames: string[] = [];
    for (let i = 1; i < selectContentBlocks.length; i++) {
      const block = selectContentBlocks[i];
      const classMatch = block.match(/className="([^"]+)"/);
      if (classMatch) {
        callerClassNames.push(classMatch[1]);
      }
    }

    expect(callerClassNames.length).toBeGreaterThan(0);

    for (const cls of callerClassNames) {
      // Check for z-[N] where N < PANEL_Z — these override the Shadcn default
      const zMatches = cls.match(/z-\[(\d+)\]/g) || [];
      for (const zMatch of zMatches) {
        const zValue = parseInt(zMatch.match(/z-\[(\d+)\]/)![1], 10);
        expect(
          zValue,
          `SelectContent className has ${zMatch} which overrides the Shadcn z-[${PANEL_Z}] via tailwind-merge. ` +
          `With important: true, this makes the dropdown render behind the panel. Remove the z-index class.`
        ).toBeGreaterThanOrEqual(PANEL_Z);
      }
    }
  });

  it("no overlay file passes a z-index class to SelectContent that is lower than the panel z-index", () => {
    const files = ["controls.tsx", "StateSelector.tsx"];

    for (const file of files) {
      const src = readSrc(join(OVERLAY_DIR, file));
      const selectContentBlocks = src.split("<SelectContent");

      for (let i = 1; i < selectContentBlocks.length; i++) {
        const block = selectContentBlocks[i];
        const classMatch = block.match(/className="([^"]+)"/);
        if (!classMatch) continue;

        const cls = classMatch[1];
        const zMatches = cls.match(/z-\[(\d+)\]/g) || [];
        for (const zMatch of zMatches) {
          const zValue = parseInt(zMatch.match(/z-\[(\d+)\]/)![1], 10);
          expect(
            zValue,
            `${file}: SelectContent has ${zMatch} — with important: true + twMerge, this overrides the panel-level z-index`
          ).toBeGreaterThanOrEqual(PANEL_Z);
        }
      }
    }
  });
});
