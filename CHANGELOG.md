# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Breakpoint awareness (#35): breakpoint selector in the header, live media-gated preview, `@media` clipboard export, and a `breakpoints` prop on `<Tuner />` with auto-detection from the project's stylesheets.
- Cascade-provenance style indicators per ADR-0007 (#46): blue = authored here, orange = inherited, pink = element-inline, green = state, plus the amber "modified this session" cue.
- Styling-system capability notice: elements styled by systems with no save path (styled-components, Emotion, styled-jsx, runtime style tags) warn upfront that edits preview live but can't be saved to source.
- React 19 source detection (#67): parses dev-fiber `_debugStack` alongside the React ≤18 `_debugSource` path.

### Changed
- Context-aware hotkeys: `Cmd+F`/`Cmd+K` are only claimed while focus is inside the panel; `Cmd+C` passes through with a text selection; `Cmd+Z`/`Cmd+Shift+Z` pass through in host text fields and only claim on the page when the overlay has a step to revert/replay.
- Published stylesheet fully scoped under `.__tuner-root` — no preflight reset, `:root` variables, or global utility classes.
- Requirements raised: Node.js ≥ 20, Next.js ≥ 13.2.

### Fixed
- Large bug-fix wave landing 2026-07-02 (PRs #110–#120 and follow-ups): shadow/transition parsing, Turbopack source-map resolution, SSR hydration of `<Tuner />`, commit-server path-safety hardening, and dozens of panel-behavior fixes locked with regression tests.

### Removed
- Dead shadcn/Radix component library removed from the published bundle.

## [1.0.0] - 2026-05-15

First stable release (tagged `v1.0`).

### Added
- Floating Webflow-style panel with 8 context-aware style sections (Layout, Spacing, Size, Position, Typography, Backgrounds, Borders, Effects) plus a Custom properties escape hatch with full-property autocomplete.
- Save to source: CSS Modules (`.module.css`/`.module.scss`), plain project CSS, and Tailwind (utility-class rewriting), traced via CSS source maps with a tiered fallback search.
- Element/class scoping and pseudo-state editing (`hover`, `focus`, `active`, `visited`, `focus-within`, `focus-visible`).
- Unified undo/redo with batching; session persistence in `localStorage` (survives refresh and HMR).
- CSS variables: discovery, variable linking (purple pill), and a master-detail variables panel with collections and multi-mode editing.
- Navigator panel: DOM tree view plus a DevTools-like CSS editor tab.
- Visual overlays: box model, CSS grid, flex gap, spacing guides.
- Copy/export: CSS rule block, CSS custom properties, Tailwind classes, and a before/after diff view.
- Keyboard-first workflow with in-app shortcuts help (`?`).

[Unreleased]: https://github.com/SkylarKitchen/redial/compare/v1.0...HEAD
[1.0.0]: https://github.com/SkylarKitchen/redial/releases/tag/v1.0
