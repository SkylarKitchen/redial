import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Bug: UnitSelector dropdown is clipped by the panel scroll container.
 *
 * The panel's scroll area (Overlay.tsx) uses `overflowY: "auto"`, which clips
 * absolutely-positioned descendants. Every other dropdown in the codebase
 * (TextStyleRow, SpacingValuePopover, ContextMenu, PropertyContextMenu) uses
 * `createPortal` to render to document.body, escaping the overflow constraint.
 *
 * UnitSelector instead uses `position: absolute` within its own DOM subtree,
 * so when the trigger is near the bottom of the visible scroll area the
 * dropdown gets cut off (only top items visible, bottom items clipped).
 *
 * Fix: UnitSelector must portal its dropdown to document.body, matching the
 * pattern used by all other overlay dropdowns.
 */

const unitSelectorPath = join(__dirname, "..", "controls", "UnitSelector.tsx");

describe("UnitSelector dropdown must use a portal to escape scroll overflow", () => {
  const source = readFileSync(unitSelectorPath, "utf-8");

  it("imports createPortal from react-dom", () => {
    expect(source).toMatch(/import\s+\{[^}]*createPortal[^}]*\}\s+from\s+["']react-dom["']/);
  });

  it("renders the dropdown listbox via createPortal", () => {
    // The dropdown (role="listbox") must be rendered through createPortal,
    // not as a direct child of the component's DOM tree.
    expect(source).toContain("createPortal");
  });

  it("uses fixed positioning for the portaled dropdown", () => {
    // Portal dropdowns need position: fixed (not absolute) since they render
    // at document.body level and need to be placed relative to the viewport.
    expect(source).toMatch(/position:\s*["']fixed["']/);
  });

  it("marks the portal with data-tuner-portal for click-through handling", () => {
    // All portaled overlays in this codebase use data-tuner-portal so that
    // Overlay.tsx's handlePageClick doesn't intercept clicks on them.
    expect(source).toContain("data-tuner-portal");
  });
});
