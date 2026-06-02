/**
 * themeCompliance.test.ts — Enforce that overlay components use theme tokens
 * instead of hardcoded Tailwind color classes.
 *
 * This test catches the "light colors" bug: components use text-black/30
 * (30% opacity) instead of theme.ts text.label (60% opacity), making
 * the UI washed out and disconnected from the token system.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const overlayDir = join(__dirname, "..");

// Files that define tokens (not consumers) — exempt from the check
const EXEMPT_FILES = new Set(["theme.ts", "timing.ts"]);

// Pattern: text-black/XX, bg-black/XX, border-black/XX with any opacity
// These Tailwind patterns hardcode colors instead of using theme tokens.
const HARDCODED_TAILWIND_COLOR =
  /\b(?:text|bg|border)-black\/\[?[\d.]+\]?/g;

// Key component files that render the panel UI the user sees
const KEY_COMPONENT_FILES = [
  "WebflowPanel.tsx",
  "Header.tsx",
  "Footer.tsx",
  "Overlay.tsx",
  "sections/LayoutSection.tsx",
  "sections/SpacingSection.tsx",
  "sections/SizeSection.tsx",
  "sections/PositionSection.tsx",
  "sections/TypographySection.tsx",
  "sections/BackgroundsSection.tsx",
  "sections/BordersSection.tsx",
  "sections/EffectsSection.tsx",
  "sections/SizeInputCell.tsx",
  "UnitSelector.tsx",
  "controls/helpers.tsx",
  "controls/Section.tsx",
  "controls/ValueInput.tsx",
  "controls/SliderRow.tsx",
  "controls/SelectRow.tsx",
  "controls/ColorRow.tsx",
  "controls/TextRow.tsx",
  "controls/NumberRow.tsx",
  "controls/SubSectionHeader.tsx",
  "controls/EditorRemoveButton.tsx",
  "controls/VisibilityToggle.tsx",
  "sections/layoutControls.tsx",
  "PromptPanel.tsx",
  "sections/BackgroundLayerList.tsx",
];

describe("theme token compliance", () => {
  for (const file of KEY_COMPONENT_FILES) {
    const filePath = join(overlayDir, file);
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      // Skip files that don't exist
      continue;
    }

    it(`${file} should not use hardcoded Tailwind color classes`, () => {
      const matches = content.match(HARDCODED_TAILWIND_COLOR) || [];
      expect(
        matches,
        `Found ${matches.length} hardcoded Tailwind color classes in ${file}:\n` +
          matches.slice(0, 10).map((m) => `  - ${m}`).join("\n") +
          (matches.length > 10 ? `\n  ... and ${matches.length - 10} more` : ""),
      ).toEqual([]);
    });
  }
});
