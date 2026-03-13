import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * tailwindImportantConflict.test.ts
 *
 * Tailwind is configured with `important: true`, making all utility classes
 * use `!important`. This means inline React styles CANNOT override Shadcn
 * base variant classes (e.g. h-9, min-w-9, px-2, gap-1).
 *
 * When using Shadcn primitives (ToggleGroupItem, SelectTrigger, etc.),
 * size/spacing overrides MUST be passed via className (so twMerge can
 * resolve them), not via inline style props.
 *
 * This test catches cases where inline style sets properties that conflict
 * with known Shadcn base classes — those inline styles will be silently
 * ignored at runtime due to !important.
 */

const overlayDir = join(__dirname, "..");

// Properties that Shadcn base variants set via Tailwind classes.
// These CANNOT be overridden via inline style when important: true.
const SHADCN_CONFLICTING_PROPS: Record<string, string[]> = {
  ToggleGroupItem: ["height", "minWidth", "padding", "paddingLeft", "paddingRight"],
  ToggleGroup: ["display", "gap", "alignItems", "justifyContent"],
  SelectTrigger: ["height", "padding", "paddingLeft", "paddingRight", "borderRadius"],
  SelectContent: ["maxHeight"],
  CommandInput: ["height"],
  CommandList: ["maxHeight"],
};

// Map from React camelCase to regex patterns that match in style objects
const STYLE_PROP_PATTERNS: Record<string, RegExp> = {
  height: /\bheight\s*:/,
  minWidth: /\bminWidth\s*:/,
  padding: /\bpadding\s*:/,
  paddingLeft: /\bpaddingLeft\s*:/,
  paddingRight: /\bpaddingRight\s*:/,
  display: /\bdisplay\s*:/,
  gap: /\bgap\s*:/,
  alignItems: /\balignItems\s*:/,
  justifyContent: /\bjustifyContent\s*:/,
  borderRadius: /\bborderRadius\s*:/,
  maxHeight: /\bmaxHeight\s*:/,
};

/**
 * Find JSX elements by tag name and extract their className and style props.
 * Returns elements where className is empty/missing but style sets conflicting props.
 */
function findConflictingInlineStyles(
  source: string,
  componentName: string,
  conflictingProps: string[],
): Array<{ line: number; prop: string; snippet: string }> {
  const violations: Array<{ line: number; prop: string; snippet: string }> = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(`<${componentName}`)) continue;

    // Collect the full JSX element (may span multiple lines)
    let block = line;
    for (let j = i + 1; j < lines.length && j < i + 40; j++) {
      block += "\n" + lines[j];
      if (lines[j].includes(">")) break;
    }

    // Check if className is empty or absent (no Tailwind overrides)
    const hasEmptyClassName = /className\s*=\s*["'](?:\s*)["']/.test(block);
    const hasNoClassName = !block.includes("className");
    const needsClassOverride = hasEmptyClassName || hasNoClassName;

    if (!needsClassOverride) continue;

    // Check if style prop sets any conflicting properties
    const styleMatch = block.match(/style\s*=\s*\{\{([\s\S]*?)\}\}/);
    if (!styleMatch) continue;

    const styleContent = styleMatch[1];
    for (const prop of conflictingProps) {
      const pattern = STYLE_PROP_PATTERNS[prop];
      if (pattern && pattern.test(styleContent)) {
        violations.push({
          line: i + 1,
          prop,
          snippet: `<${componentName} at line ${i + 1}: inline style sets "${prop}" which is overridden by Tailwind !important base class`,
        });
      }
    }
  }

  return violations;
}

describe("No inline style conflicts with Tailwind !important on Shadcn components", () => {
  // Verify the precondition: Tailwind important is enabled
  it("tailwind.config.ts has important: true (precondition)", () => {
    const configPath = join(__dirname, "../../../tailwind.config.ts");
    const config = readFileSync(configPath, "utf-8");
    expect(config).toContain("important: true");
  });

  const files = readdirSync(overlayDir).filter(
    (f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"),
  );

  for (const [component, props] of Object.entries(SHADCN_CONFLICTING_PROPS)) {
    const filesUsingComponent = files.filter((f) => {
      const source = readFileSync(join(overlayDir, f), "utf-8");
      return source.includes(`<${component}`);
    });

    for (const file of filesUsingComponent) {
      it(`${file}: no inline style conflicts on <${component}>`, () => {
        const source = readFileSync(join(overlayDir, file), "utf-8");
        const violations = findConflictingInlineStyles(source, component, props);
        const messages = violations.map((v) => v.snippet);
        expect(messages).toEqual([]);
      });
    }
  }
});
