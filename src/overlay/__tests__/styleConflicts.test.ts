import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * CSS shorthand properties and their corresponding longhand properties.
 * Mixing these on the same React element causes warnings during re-render
 * when React tries to remove one while the other is still set.
 */
const SHORTHAND_LONGHAND_MAP: Record<string, string[]> = {
  border: [
    "borderColor",
    "borderWidth",
    "borderStyle",
    "borderTop",
    "borderRight",
    "borderBottom",
    "borderLeft",
  ],
  margin: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
  padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  background: [
    "backgroundColor",
    "backgroundImage",
    "backgroundSize",
    "backgroundPosition",
    "backgroundRepeat",
  ],
  font: ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight"],
  outline: ["outlineColor", "outlineWidth", "outlineStyle"],
};

/**
 * Extracts inline style objects from a TSX source string.
 * Returns an array of { startLine, raw } for each `style={{ ... }}` or `style={...}` block.
 */
function extractStyleBlocks(
  source: string
): Array<{ lineNumber: number; raw: string }> {
  const blocks: Array<{ lineNumber: number; raw: string }> = [];
  // Match style={{ ... }} blocks including conditional spreads
  const styleRegex = /style=\{(\{[\s\S]*?\})\}/g;
  let match: RegExpExecArray | null;
  while ((match = styleRegex.exec(source)) !== null) {
    const upToMatch = source.slice(0, match.index);
    const lineNumber = upToMatch.split("\n").length;
    blocks.push({ lineNumber, raw: match[1] });
  }
  return blocks;
}

/**
 * Checks a style block string for shorthand + non-shorthand property conflicts.
 * Accounts for conditional spreads like `...(cond ? { borderColor: "..." } : {})`.
 */
function findConflicts(
  raw: string
): Array<{ shorthand: string; longhand: string }> {
  const conflicts: Array<{ shorthand: string; longhand: string }> = [];

  for (const [shorthand, longhands] of Object.entries(SHORTHAND_LONGHAND_MAP)) {
    // Check if shorthand is present as a property key (not inside a string value)
    // Match `border:` or `border,` (as an object key) — but not `borderRadius:` etc.
    const shorthandRegex = new RegExp(
      `(?:^|[{,\\s])${shorthand}\\s*[:?]`,
      "m"
    );
    if (!shorthandRegex.test(raw)) continue;

    for (const longhand of longhands) {
      const longhandRegex = new RegExp(
        `(?:^|[{,\\s])${longhand}\\s*:`,
        "m"
      );
      if (longhandRegex.test(raw)) {
        conflicts.push({ shorthand, longhand });
      }
    }
  }

  return conflicts;
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe("no shorthand/non-shorthand CSS conflicts in inline styles", () => {
  const overlayDir = join(__dirname, "..");
  const tsxFiles = [
    "Overlay.tsx",
    "WebflowPanel.tsx",
    "Header.tsx",
    "Footer.tsx",
    "Panel.tsx",
    "SizeSection.tsx",
  ];

  for (const file of tsxFiles) {
    it(`${file} should not mix CSS shorthand with longhand properties`, () => {
      let source: string;
      try {
        source = readFileSync(join(overlayDir, file), "utf-8");
      } catch {
        // File doesn't exist — skip
        return;
      }

      const styleBlocks = extractStyleBlocks(source);
      const violations: string[] = [];

      for (const block of styleBlocks) {
        const conflicts = findConflicts(block.raw);
        for (const { shorthand, longhand } of conflicts) {
          violations.push(
            `Line ~${block.lineNumber}: "${shorthand}" (shorthand) conflicts with "${longhand}" (longhand)`
          );
        }
      }

      expect(violations).toEqual([]);
    });
  }
});
