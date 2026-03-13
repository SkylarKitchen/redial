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

/**
 * Extracts HoverButton usages and returns paired (style, hoverStyle) raw strings.
 * Detects cross-prop shorthand/longhand conflicts that cause React warnings
 * when the two style objects are merged at runtime.
 */
function extractHoverButtonPairs(
  source: string
): Array<{ lineNumber: number; styleRaw: string; hoverStyleRaw: string }> {
  const pairs: Array<{
    lineNumber: number;
    styleRaw: string;
    hoverStyleRaw: string;
  }> = [];
  // Match <HoverButton ... style={...} ... hoverStyle={...} ...>
  const hoverBtnRegex =
    /<HoverButton[^>]*\bstyle=\{(\{[^}]*\})\}[^>]*\bhoverStyle=\{(\{[^}]*\})\}/g;
  let match: RegExpExecArray | null;
  while ((match = hoverBtnRegex.exec(source)) !== null) {
    const upToMatch = source.slice(0, match.index);
    const lineNumber = upToMatch.split("\n").length;
    pairs.push({
      lineNumber,
      styleRaw: match[1],
      hoverStyleRaw: match[2],
    });
  }
  return pairs;
}

/**
 * Checks whether a base style block and a hover style block conflict
 * on shorthand vs longhand CSS properties (cross-prop merge).
 */
function findCrossPropConflicts(
  baseRaw: string,
  hoverRaw: string
): Array<{ shorthand: string; longhand: string; direction: string }> {
  const conflicts: Array<{
    shorthand: string;
    longhand: string;
    direction: string;
  }> = [];

  for (const [shorthand, longhands] of Object.entries(SHORTHAND_LONGHAND_MAP)) {
    const shorthandKeyRegex = new RegExp(
      `(?:^|[{,\\s])${shorthand}\\s*[:?]`,
      "m"
    );
    for (const longhand of longhands) {
      const longhandKeyRegex = new RegExp(
        `(?:^|[{,\\s])${longhand}\\s*:`,
        "m"
      );

      // base has shorthand, hover has longhand
      if (shorthandKeyRegex.test(baseRaw) && longhandKeyRegex.test(hoverRaw)) {
        conflicts.push({
          shorthand,
          longhand,
          direction: "style has shorthand, hoverStyle has longhand",
        });
      }
      // base has longhand, hover has shorthand
      if (longhandKeyRegex.test(baseRaw) && shorthandKeyRegex.test(hoverRaw)) {
        conflicts.push({
          shorthand,
          longhand,
          direction: "style has longhand, hoverStyle has shorthand",
        });
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
    "controls.tsx",
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

describe("no cross-prop shorthand/longhand conflicts in HoverButton usages", () => {
  const showcasePath = join(
    __dirname,
    "..",
    "..",
    "..",
    "test-app",
    "app",
    "showcase",
    "page.tsx"
  );

  it("showcase page: HoverButton style + hoverStyle should not mix shorthand with longhand", () => {
    let source: string;
    try {
      source = readFileSync(showcasePath, "utf-8");
    } catch {
      return; // file not found — skip
    }

    const pairs = extractHoverButtonPairs(source);
    const violations: string[] = [];

    for (const { lineNumber, styleRaw, hoverStyleRaw } of pairs) {
      const conflicts = findCrossPropConflicts(styleRaw, hoverStyleRaw);
      for (const { shorthand, longhand, direction } of conflicts) {
        violations.push(
          `Line ~${lineNumber}: "${shorthand}" vs "${longhand}" — ${direction}`
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
