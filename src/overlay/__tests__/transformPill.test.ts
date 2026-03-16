// @vitest-environment happy-dom
/**
 * transformPill.test.ts — Verify TransformPill rendering and formatTransformSummary
 *
 * Covers:
 * - formatTransformSummary produces correct text for each transform type
 * - TransformPill renders summary text via TransformEditor (renderToString)
 * - Interaction structure: remove button opacity, stopPropagation wrappers
 * - Expanded pill uses blackAlpha(0.05) background and border.hover border
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "../sections/TransformEditor.tsx"),
  "utf-8",
);

// ─── formatTransformSummary logic (source analysis) ─────────────────

describe("formatTransformSummary produces correct text", () => {
  // Extract the function body to verify each case
  const fnMatch = src.match(
    /function formatTransformSummary[\s\S]*?^}/m,
  );

  it("formatTransformSummary function exists", () => {
    expect(fnMatch, "Could not find formatTransformSummary").toBeTruthy();
  });

  it("P1-1: translate produces 'Move: Xpx, Ypx, Zpx'", () => {
    const fn = fnMatch![0];
    // Template: `Move: ${x}px, ${y}px, ${z ?? 0}px`
    expect(fn).toContain("Move: ${x}px, ${y}px, ${z ?? 0}px");
  });

  it("P1-2: scale produces 'Scale: X, Y, Z' (or without Z)", () => {
    const fn = fnMatch![0];
    // z !== undefined branch: `Scale: ${x}, ${y}, ${z}`
    expect(fn).toContain("Scale: ${x}, ${y}, ${z}");
    // z === undefined branch: `Scale: ${x}, ${y}`
    expect(fn).toContain("Scale: ${x}, ${y}`");
  });

  it("P1-3: rotate produces 'Rotate: Xdeg, Ydeg, Zdeg'", () => {
    const fn = fnMatch![0];
    expect(fn).toContain("Rotate: ${x}deg, ${y}deg, ${z ?? 0}deg");
  });

  it("P1-4: skew produces 'Skew: Xdeg, Ydeg'", () => {
    const fn = fnMatch![0];
    expect(fn).toContain("Skew: ${x}deg, ${y}deg");
  });
});

// ─── TransformPill renders summary via TransformEditor (renderToString) ─

describe("TransformPill renders summary text", () => {
  it("P1-1 render: translate pill shows 'Move: 10px, 20px, 0px'", async () => {
    const { createElement } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { TransformEditor } = await import("../sections/TransformEditor");

    const html = renderToString(
      createElement(TransformEditor, {
        transforms: [{ type: "translate", x: 10, y: 20, z: 0 }],
        onChange: vi.fn(),
        origin: "50% 50%",
        onOriginChange: vi.fn(),
        backfaceVisibility: "visible",
        onBackfaceChange: vi.fn(),
        selfPerspective: 0,
        onSelfPerspectiveChange: vi.fn(),
        childrenPerspective: 0,
        onChildrenPerspectiveChange: vi.fn(),
        perspectiveOrigin: "50% 50%",
        onPerspectiveOriginChange: vi.fn(),
        settingsOpen: false,
      }),
    );
    expect(html).toContain("Move: 10px, 20px, 0px");
  });

  it("P1-2 render: scale pill shows 'Scale: 1.5, 2, 1'", async () => {
    const { createElement } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { TransformEditor } = await import("../sections/TransformEditor");

    const html = renderToString(
      createElement(TransformEditor, {
        transforms: [{ type: "scale", x: 1.5, y: 2, z: 1 }],
        onChange: vi.fn(),
        origin: "50% 50%",
        onOriginChange: vi.fn(),
        backfaceVisibility: "visible",
        onBackfaceChange: vi.fn(),
        selfPerspective: 0,
        onSelfPerspectiveChange: vi.fn(),
        childrenPerspective: 0,
        onChildrenPerspectiveChange: vi.fn(),
        perspectiveOrigin: "50% 50%",
        onPerspectiveOriginChange: vi.fn(),
        settingsOpen: false,
      }),
    );
    expect(html).toContain("Scale: 1.5, 2, 1");
  });

  it("P1-3 render: rotate pill shows 'Rotate: 45deg, 0deg, 0deg'", async () => {
    const { createElement } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { TransformEditor } = await import("../sections/TransformEditor");

    const html = renderToString(
      createElement(TransformEditor, {
        transforms: [{ type: "rotate", x: 45, y: 0, z: 0 }],
        onChange: vi.fn(),
        origin: "50% 50%",
        onOriginChange: vi.fn(),
        backfaceVisibility: "visible",
        onBackfaceChange: vi.fn(),
        selfPerspective: 0,
        onSelfPerspectiveChange: vi.fn(),
        childrenPerspective: 0,
        onChildrenPerspectiveChange: vi.fn(),
        perspectiveOrigin: "50% 50%",
        onPerspectiveOriginChange: vi.fn(),
        settingsOpen: false,
      }),
    );
    expect(html).toContain("Rotate: 45deg, 0deg, 0deg");
  });

  it("P1-4 render: skew pill shows 'Skew: 10deg, 5deg'", async () => {
    const { createElement } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { TransformEditor } = await import("../sections/TransformEditor");

    const html = renderToString(
      createElement(TransformEditor, {
        transforms: [{ type: "skew", x: 10, y: 5 }],
        onChange: vi.fn(),
        origin: "50% 50%",
        onOriginChange: vi.fn(),
        backfaceVisibility: "visible",
        onBackfaceChange: vi.fn(),
        selfPerspective: 0,
        onSelfPerspectiveChange: vi.fn(),
        childrenPerspective: 0,
        onChildrenPerspectiveChange: vi.fn(),
        perspectiveOrigin: "50% 50%",
        onPerspectiveOriginChange: vi.fn(),
        settingsOpen: false,
      }),
    );
    expect(html).toContain("Skew: 10deg, 5deg");
  });
});

// ─── Interaction structure (source analysis) ────────────────────────

describe("TransformPill interaction structure", () => {
  // Extract the TransformPill function body
  const pillMatch = src.match(
    /function TransformPill\([\s\S]*?^}$/m,
  );

  it("TransformPill function exists", () => {
    expect(pillMatch, "Could not find TransformPill").toBeTruthy();
  });

  it("P1-5: pill onClick handler calls the onClick prop", () => {
    // The outer div has onClick={onClick}
    expect(pillMatch![0]).toMatch(/onClick=\{onClick\}/);
  });

  it("P1-6: remove button has opacity:0 when not hovered and not expanded", () => {
    // opacity: hovered || isExpanded ? 1 : 0
    expect(pillMatch![0]).toMatch(/opacity:\s*hovered\s*\|\|\s*isExpanded\s*\?\s*1\s*:\s*0/);
  });

  it("P1-7: remove button has opacity:1 when isExpanded=true", () => {
    // Same line: hovered || isExpanded ? 1 : 0 — when isExpanded is true, result is 1
    expect(pillMatch![0]).toContain("hovered || isExpanded ? 1 : 0");
  });

  it("P1-8: remove button parent span calls stopPropagation onClick", () => {
    // The span wrapping EditorRemoveButton has onClick={(e) => e.stopPropagation()}
    // Find the remove button area (near EditorRemoveButton)
    const removeArea = pillMatch![0].match(
      /EditorRemoveButton[\s\S]{0,200}/,
    );
    expect(removeArea).toBeTruthy();
    // The wrapping span before it has stopPropagation
    const removeWrapper = pillMatch![0].match(
      /<span[\s\S]*?stopPropagation[\s\S]*?EditorRemoveButton/,
    );
    expect(
      removeWrapper,
      "Remove button wrapper should call stopPropagation",
    ).toBeTruthy();
  });

  it("P1-9: drag handle wrapper span calls stopPropagation onClick", () => {
    // The span wrapping DragHandle has onClick={(e) => e.stopPropagation()}
    const dragWrapper = pillMatch![0].match(
      /<span[\s\S]*?stopPropagation[\s\S]*?DragHandle/,
    );
    expect(
      dragWrapper,
      "Drag handle wrapper should call stopPropagation",
    ).toBeTruthy();
  });

  it("P1-10: expanded pill uses blackAlpha(0.05) background and border.hover border", () => {
    // isExpanded ? blackAlpha(0.05) for background
    expect(pillMatch![0]).toMatch(/isExpanded[\s\S]*?blackAlpha\(0\.05\)/);
    // isExpanded ? border.hover for border color
    expect(pillMatch![0]).toMatch(/isExpanded\s*\?\s*border\.hover/);
  });
});
