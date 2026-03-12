import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * UnitSelector renders an absolutely-positioned dropdown via `position: absolute`.
 * If any ancestor element has `overflow: hidden` (Tailwind `overflow-hidden` or
 * inline `overflow: "hidden"`), the dropdown gets clipped and is invisible.
 *
 * Detection: for each <UnitSelector, walk backward through source lines collecting
 * element blocks that are at lower indentation (ancestors). Check the full element
 * block (opening tag including continuation lines) for overflow-hidden.
 */

const overlayDir = join(__dirname, "..");

function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function hasOverflowHidden(text: string): boolean {
  // Tailwind class — but not text-overflow/text-ellipsis patterns
  if (/overflow-hidden/.test(text) && !/text-ellipsis/.test(text) && !/text-overflow/.test(text)) {
    return true;
  }
  // Inline style
  if (/overflow:\s*["']hidden["']/.test(text)) {
    return true;
  }
  return false;
}

/**
 * Collects the full opening tag starting at line `start`.
 * In JSX, a tag often spans multiple lines:
 *   <div
 *     className="..."
 *     style={{ ... }}
 *   >
 * Returns all lines from `<tag` until the line containing `>`.
 */
function collectElementBlock(lines: string[], start: number): string {
  let block = lines[start];
  // If the line already contains a `>`, return it
  if (/>/.test(block)) return block;
  for (let k = start + 1; k < lines.length && k < start + 20; k++) {
    block += "\n" + lines[k];
    if (/>/.test(lines[k])) break;
  }
  return block;
}

function findClippedUnitSelectors(
  source: string
): Array<{ unitLine: number; ancestorLine: number; snippet: string }> {
  const violations: Array<{
    unitLine: number;
    ancestorLine: number;
    snippet: string;
  }> = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("<UnitSelector")) continue;

    const unitIndent = getIndent(lines[i]);

    // Walk backward looking for ancestor element openings
    for (let j = i - 1; j >= 0; j--) {
      const line = lines[j];
      const lineIndent = getIndent(line);

      // Must be at strictly lower indentation (ancestor)
      if (lineIndent >= unitIndent) continue;

      // Must open an element
      if (!/^\s*<\w/.test(line)) continue;

      // Collect the full element block (may span multiple lines)
      const block = collectElementBlock(lines, j);

      if (hasOverflowHidden(block)) {
        violations.push({
          unitLine: i + 1,
          ancestorLine: j + 1,
          snippet: line.trim(),
        });
      }

      // Stop at component/function boundary
      if (/^\s*(function|const|export)\s/.test(line)) break;
    }
  }

  return violations;
}

describe("UnitSelector dropdown not clipped by overflow-hidden ancestors", () => {
  const files = readdirSync(overlayDir).filter(
    (f) => f.endsWith(".tsx") && f !== "UnitSelector.tsx"
  );

  const filesWithUnitSelector = files.filter((f) => {
    const source = readFileSync(join(overlayDir, f), "utf-8");
    return source.includes("<UnitSelector");
  });

  for (const file of filesWithUnitSelector) {
    it(`${file}: no overflow-hidden ancestor wrapping UnitSelector`, () => {
      const source = readFileSync(join(overlayDir, file), "utf-8");
      const violations = findClippedUnitSelectors(source);

      const messages = violations.map(
        (v) =>
          `<UnitSelector at line ${v.unitLine} clipped by overflow-hidden at line ${v.ancestorLine}: ${v.snippet}`
      );

      expect(messages).toEqual([]);
    });
  }
});
