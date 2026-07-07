// eslint.config.js — two lint layers (see issue #109):
//
//  A. Base hygiene — typescript-eslint recommended over src/** and scripts/**,
//     EXCLUDING src/overlay/**. The 40k-LOC overlay predates base linting and
//     would surface ~160 legacy errors under recommended, so extending it there
//     is tracked debt (same ratchet philosophy as the old shadcn grandfather
//     list): everything outside the overlay is held to recommended today.
//
//  B. Overlay style conventions — src/overlay/** only (unchanged scope). These
//     encode the three project-specific "hard rules" from CLAUDE.md:
//       1. No hardcoded hex colors — use a token from theme.ts (color.*).
//       2. No CSS/SCSS imports in the overlay — styling is inline via tokens.
//       3. No shadcn/Radix (components/ui) imports in the overlay.
//     See the allowlist (color-domain files) below for deliberate exceptions.
//
//  Plus: real react-hooks rules across all of src/ (rules-of-hooks: error,
//  exhaustive-deps: warn), replacing the former no-op stubs. The overlay
//  carries ~48 preexisting exhaustive-deps warnings — visible debt, does not
//  fail the run.

import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Layer A scope: everything we lint with the recommended base. The overlay is
// excluded here (it gets layer B + react-hooks instead — see header comment).
const BASE_FILES = ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}"];
const BASE_IGNORES = ["src/overlay/**"];

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
  // ── Layer A: typescript-eslint recommended for src (minus overlay) + scripts ──
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: BASE_FILES,
    ignores: BASE_IGNORES,
  })),
  {
    files: BASE_FILES,
    ignores: BASE_IGNORES,
    rules: {
      // Underscore prefix = intentionally unused (e.g. a param kept for API
      // shape, like sourceMapCache.getSourceMap's `_projectRoot`).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // `interface TunerProps extends Partial<TunerConfig> {}` is the public
      // API alias pattern (consumers can augment an interface; a type alias
      // they cannot). Allow the single-extends form.
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "with-single-extends" },
      ],
    },
  },

  // Ambient declaration files mirror untyped third-party surfaces (bundler HMR
  // APIs use untyped varargs) — `any` is the accurate type there.
  {
    files: ["src/**/*.d.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  // ── react-hooks: real rules for all of src (overlay included) ──
  // rules-of-hooks is a correctness rule → error. exhaustive-deps is warn:
  // several overlay effects intentionally use partial dep arrays (documented
  // at each site), and blind "fixes" would change runtime behavior.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // ── Layer B: overlay style conventions ──
  {
    files: ["src/overlay/**/*.{ts,tsx}"],
    ignores: ["src/overlay/**/__tests__/**"],
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
