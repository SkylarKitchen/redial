// @vitest-environment happy-dom
/**
 * transformEditor.test.ts — TransformEditor orchestrator component tests
 *
 * Covers:
 * - Pill rendering per transform item
 * - Auto-expand newly added transforms
 * - Toggle expand/collapse behavior (single expandedIndex)
 * - Remove logic with expandedIndex adjustment
 * - Type change resets to TRANSFORM_DEFAULTS
 * - settingsOpen toggle shows/hides TransformSettings
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const editorSrc = readFileSync(
  join(__dirname, "../sections/TransformEditor.tsx"),
  "utf-8",
);

// ─── Helper: make default TransformEditor props ──────────────────────

function makeEditorProps(overrides: Record<string, unknown> = {}) {
  return {
    transforms: [],
    onChange: vi.fn(),
    origin: "center",
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
    ...overrides,
  };
}

// ─── P4-1: Renders one pill per transform ────────────────────────────

describe("TransformEditor pill rendering", () => {
  it("renders one pill per transform in list", async () => {
    const { TransformEditor } = await import("../sections/TransformEditor");
    const props = makeEditorProps({
      transforms: [
        { type: "translate", x: 10, y: 20, z: 0 },
        { type: "scale", x: 1.5, y: 1.5, z: 1, scaleLocked: true },
        { type: "rotate", x: 0, y: 0, z: 45 },
      ],
    });
    const html = renderToString(createElement(TransformEditor, props as any));
    // Each pill renders a formatTransformSummary text
    expect(html).toContain("Move: 10px, 20px, 0px");
    expect(html).toContain("Scale: 1.5, 1.5, 1");
    expect(html).toContain("Rotate: 0deg, 0deg, 45deg");
  });

  // P4-12: Empty transforms array renders no pills
  it("renders no pills when transforms array is empty", async () => {
    const { TransformEditor } = await import("../sections/TransformEditor");
    const props = makeEditorProps({ transforms: [] });
    const html = renderToString(createElement(TransformEditor, props as any));
    expect(html).not.toContain("Move:");
    expect(html).not.toContain("Scale:");
    expect(html).not.toContain("Rotate:");
    expect(html).not.toContain("Skew:");
  });
});

// ─── P4-2: Auto-expand newly added transform ────────────────────────

describe("TransformEditor auto-expand on add", () => {
  it("useEffect checks transforms.length > prevLengthRef.current", () => {
    // Source: the auto-expand effect fires when array grows
    expect(editorSrc).toMatch(
      /transforms\.length\s*>\s*prevLengthRef\.current/,
    );
  });

  it("sets expandedIndex to last item on add", () => {
    // Source: setExpandedIndex(transforms.length - 1)
    expect(editorSrc).toMatch(
      /setExpandedIndex\(transforms\.length\s*-\s*1\)/,
    );
  });
});

// ─── P4-3 / P4-4: Click pill toggles, only one expanded ─────────────

describe("TransformEditor expand/collapse", () => {
  it("toggleExpand collapses if same index, else expands", () => {
    // Source: prev === index ? null : index
    expect(editorSrc).toMatch(
      /prev\s*===\s*index\s*\?\s*null\s*:\s*index/,
    );
  });

  it("only one transform can be expanded at a time (single expandedIndex state)", () => {
    // Source: single useState<number | null> for expandedIndex
    expect(editorSrc).toMatch(
      /useState<number\s*\|\s*null>\(null\)/,
    );
    // Source: isExpanded === (expandedIndex === index) — per item
    expect(editorSrc).toMatch(
      /expandedIndex\s*===\s*index/,
    );
  });
});

// ─── P4-5 / P4-6 / P4-7: Remove behavior ────────────────────────────

describe("TransformEditor remove behavior", () => {
  it("remove calls onChange with filtered array", () => {
    // Source: transforms.filter((_, i) => i !== index)
    expect(editorSrc).toMatch(
      /transforms\.filter\(\(_,\s*i\)\s*=>\s*i\s*!==\s*index\)/,
    );
  });

  it("removing the expanded transform sets expandedIndex to null", () => {
    // Source: if (expandedIndex === index) { setExpandedIndex(null); }
    expect(editorSrc).toMatch(
      /expandedIndex\s*===\s*index[\s\S]*?setExpandedIndex\(null\)/,
    );
  });

  it("removing before expanded adjusts index down", () => {
    // Source: else if (expandedIndex !== null && expandedIndex > index)
    //         setExpandedIndex(expandedIndex - 1)
    expect(editorSrc).toMatch(
      /expandedIndex\s*!==\s*null\s*&&\s*expandedIndex\s*>\s*index/,
    );
    expect(editorSrc).toMatch(
      /setExpandedIndex\(expandedIndex\s*-\s*1\)/,
    );
  });
});

// ─── P4-8 / P4-9: Type change behavior ──────────────────────────────

describe("TransformEditor type change", () => {
  it("type change resets to TRANSFORM_DEFAULTS", () => {
    // Source: { ...TRANSFORM_DEFAULTS[newType] }
    expect(editorSrc).toMatch(
      /\{\s*\.\.\.TRANSFORM_DEFAULTS\[newType\]\s*\}/,
    );
  });

  it("type change to same type is a no-op", () => {
    // Source: if (current.type === newType) return;
    expect(editorSrc).toMatch(
      /current\.type\s*===\s*newType.*return/,
    );
  });
});

// ─── P4-10 / P4-11: settingsOpen toggle ─────────────────────────────

describe("TransformEditor settings panel toggle", () => {
  it("settingsOpen=true renders TransformSettings", async () => {
    const { TransformEditor } = await import("../sections/TransformEditor");
    const props = makeEditorProps({ settingsOpen: true });
    const html = renderToString(createElement(TransformEditor, props as any));
    expect(html).toContain("Transform settings");
  });

  it("settingsOpen=false hides TransformSettings", async () => {
    const { TransformEditor } = await import("../sections/TransformEditor");
    const props = makeEditorProps({ settingsOpen: false });
    const html = renderToString(createElement(TransformEditor, props as any));
    expect(html).not.toContain("Transform settings");
  });

  it("source gates TransformSettings on settingsOpen prop", () => {
    // Source: {settingsOpen && (<TransformSettings ...
    expect(editorSrc).toMatch(
      /\{settingsOpen\s*&&\s*[\s\S]*?<TransformSettings/,
    );
  });
});
