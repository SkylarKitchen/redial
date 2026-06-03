// eslint.config.js — enforces the overlay style conventions documented in
// CLAUDE.md / .claude/CLAUDE.md so they fail CI instead of relying on memory.
//
// Scope: src/overlay/** only. This is intentionally NOT a general-purpose lint
// pass — it encodes three project-specific "hard rules" and nothing else, so it
// stays green on the existing 40k-LOC codebase and only fires on real drift.
//
//   1. No hardcoded hex colors — use a token from theme.ts (color.*).
//   2. No CSS/SCSS imports in the overlay — styling is inline via tokens.
//   3. No shadcn/Radix (components/ui) imports in the overlay — inline controls.
//
// See the allowlist (color-domain files) and the grandfather list (legacy
// shadcn imports) below for the deliberate exceptions.

import tseslint from "typescript-eslint";

// No-op stub for the `react-hooks` namespace. We do NOT enforce react-hooks here
// (out of scope for this convention pass), but a few legacy files carry
// `// eslint-disable-next-line react-hooks/exhaustive-deps` directives left over
// from a prior Next.js lint setup. ESLint hard-errors on directives that name an
// unknown rule, so we register the rule as a defined-but-off no-op to keep them valid.
const reactHooksStub = {
  rules: {
    "exhaustive-deps": { create: () => ({}) },
    "rules-of-hooks": { create: () => ({}) },
  },
};

// Hex literals as string values, e.g. "#fff" or "2px solid #ff0000".
const HEX_LITERAL = {
  selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
  message:
    "Hardcoded hex color — reference a token from theme.ts (color.*) instead. " +
    "Color-domain files (pickers, gradient/background editors) are allowlisted in eslint.config.js.",
};

// Hex literals inside template strings, e.g. `border: 2px solid #fff;`.
const HEX_TEMPLATE = {
  selector: "TemplateElement[value.cooked=/#[0-9a-fA-F]{3,8}/]",
  message:
    "Hardcoded hex color in a template string — reference a token from theme.ts (color.*) instead.",
};

const NO_CSS_IMPORT = {
  group: ["*.css", "*.scss", "**/*.css", "**/*.scss"],
  message:
    "No CSS/SCSS imports in the overlay — all panel styling is inline via theme.ts tokens.",
};

const NO_SHADCN_IMPORT = {
  group: ["@/components/ui/*", "**/components/ui/*"],
  message:
    "No shadcn/Radix in the overlay — use inline-styled controls (see CLAUDE.md style rules).",
};

export default [
  // ── Base rules: apply to the whole overlay ──
  {
    files: ["src/overlay/**/*.{ts,tsx}"],
    ignores: ["src/overlay/**/__tests__/**"],
    plugins: { "react-hooks": reactHooksStub },
    // We don't enforce react-hooks, so the legacy directives above are "unused"
    // by our ruleset. Don't flag them — they encode deliberate developer intent
    // (intentional partial dep arrays) and aren't ours to remove.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-syntax": ["error", HEX_LITERAL, HEX_TEMPLATE],
      "no-restricted-imports": [
        "error",
        { patterns: [NO_CSS_IMPORT, NO_SHADCN_IMPORT] },
      ],
    },
  },

  // ── Allowlist: color-domain files + the token source itself ──
  // Here a hex literal IS the subject matter (a hue bar, a user's default fill,
  // a color-resolution fallback), not a hardcoded chrome color.
  {
    files: [
      "src/overlay/theme.ts",
      "src/overlay/colorUtils.ts",
      "src/overlay/core/resolveBackdrop.ts",
      "src/overlay/controls/ColorRow.tsx",
      "src/overlay/controls/SwatchColorPicker.tsx",
      "src/overlay/controls/ColorPickerEnhanced.tsx",
      "src/overlay/sections/GradientEditor.tsx",
      "src/overlay/sections/BackgroundLayerList.tsx",
      "src/overlay/sections/BackgroundsSection.tsx",
      "src/overlay/sections/FilterSliders.tsx",
      "src/overlay/variables/ModeValueCell.tsx",
    ],
    rules: { "no-restricted-syntax": "off" },
  },

  // ── No shadcn grandfather list ──
  // The 9 files that once imported shadcn/Radix (@/components/ui/*) were all
  // migrated to inline-styled controls on 2026-06-03, so the ratchet is fully
  // paid down: the NO_SHADCN_IMPORT ban in the base config now applies to the
  // entire overlay with zero exemptions. Do not re-introduce a grandfather list —
  // migrate any new control to an inline implementation instead.
];
