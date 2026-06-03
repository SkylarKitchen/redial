// @vitest-environment happy-dom
/**
 * transformSettings.test.ts — TransformSettings sub-panel tests
 *
 * TransformSettings is an internal component of TransformEditor.tsx.
 * It renders origin picker, backface visibility toggle, self/children
 * perspective sliders, and children perspective origin picker.
 *
 * Tests use renderToString via TransformEditor (settingsOpen=true)
 * and source analysis for wiring verification.
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

// ─── Helper: render TransformEditor with settings open ───────────────

async function renderWithSettings(overrides: Record<string, unknown> = {}) {
  const { TransformEditor } = await import("../sections/TransformEditor");
  const props = {
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
    settingsOpen: true,
    ...overrides,
  };
  return renderToString(createElement(TransformEditor, props as any));
}

// ─── P6-1: Renders "Transform settings" header ──────────────────────

describe("TransformSettings header", () => {
  it("renders 'Transform settings' text", async () => {
    const html = await renderWithSettings();
    expect(html).toContain("Transform settings");
  });
});

// ─── P6-2: Renders Origin picker with showInputs ────────────────────

describe("TransformSettings origin picker", () => {
  it("passes showInputs to TransformOriginPicker", () => {
    // Source: <TransformOriginPicker value={origin} onChange={onOriginChange} showInputs elementSize={elementSize} />
    const settingsBlock = editorSrc.match(
      /function TransformSettings[\s\S]*?^\}/m,
    );
    expect(settingsBlock).toBeTruthy();
    expect(editorSrc).toMatch(
      /<TransformOriginPicker\s+value=\{origin\}\s+onChange=\{onOriginChange\}\s+showInputs(\s+[^>]*?)?\s*\/>/,
    );
    // The picker is also handed the element's box size so it can convert
    // getComputedStyle's px-resolved origin into the correct grid cell / %.
    expect(editorSrc).toMatch(
      /<TransformOriginPicker\s+value=\{origin\}[\s\S]*?elementSize=\{elementSize\}/,
    );
  });

  it("renders Left and Top inputs in settings panel", async () => {
    const html = await renderWithSettings();
    // showInputs renders OriginInput with "Left" and "Top" labels
    expect(html).toContain("Left");
    expect(html).toContain("Top");
  });
});

// ─── P6-3 / P6-4: Backface Visible/Hidden options ───────────────────

describe("TransformSettings backface visibility", () => {
  it("renders Visible and Hidden segment options", async () => {
    const html = await renderWithSettings();
    expect(html).toContain("Visible");
    expect(html).toContain("Hidden");
  });

  it("backface SegmentedControl wired to onBackfaceChange", () => {
    // Source: <SegmentedControl options={BACKFACE_OPTIONS} value={backfaceVisibility} onChange={onBackfaceChange} />
    expect(editorSrc).toMatch(
      /options=\{BACKFACE_OPTIONS\}[\s\S]*?onChange=\{onBackfaceChange\}/,
    );
  });

  it("BACKFACE_OPTIONS imported from panelConstants", () => {
    expect(editorSrc).toMatch(
      /import\s*\{[\s\S]*?BACKFACE_OPTIONS[\s\S]*?\}\s*from\s*["']\.\.\/panelConstants["']/,
    );
  });
});

// ─── P6-5 / P6-6: Self perspective slider ───────────────────────────

describe("TransformSettings self perspective", () => {
  it("renders Self perspective header", async () => {
    const html = await renderWithSettings();
    expect(html).toContain("Self perspective");
  });

  it("self perspective SliderRow has min=0 max=2000", () => {
    // Find the self perspective SliderRow block
    const selfBlock = editorSrc.match(
      /Self perspective[\s\S]*?<SliderRow[\s\S]*?\/>/,
    );
    expect(selfBlock, "Could not find self perspective SliderRow").toBeTruthy();
    expect(selfBlock![0]).toContain("min={0}");
    expect(selfBlock![0]).toContain("max={2000}");
  });

  it("self perspective SliderRow wired to onSelfPerspectiveChange", () => {
    const selfBlock = editorSrc.match(
      /Self perspective[\s\S]*?<SliderRow[\s\S]*?\/>/,
    );
    expect(selfBlock![0]).toContain("onChange={onSelfPerspectiveChange}");
  });
});

// ─── P6-7 / P6-8: Children perspective slider ───────────────────────

describe("TransformSettings children perspective", () => {
  it("renders Children perspective header", async () => {
    const html = await renderWithSettings();
    expect(html).toContain("Children perspective");
  });

  it("children perspective SliderRow has min=0 max=2000", () => {
    const childBlock = editorSrc.match(
      /Children perspective[\s\S]*?<SliderRow[\s\S]*?\/>/,
    );
    expect(
      childBlock,
      "Could not find children perspective SliderRow",
    ).toBeTruthy();
    expect(childBlock![0]).toContain("min={0}");
    expect(childBlock![0]).toContain("max={2000}");
  });

  it("children perspective SliderRow wired to onChildrenPerspectiveChange", () => {
    const childBlock = editorSrc.match(
      /Children perspective[\s\S]*?<SliderRow[\s\S]*?\/>/,
    );
    expect(childBlock![0]).toContain(
      "onChange={onChildrenPerspectiveChange}",
    );
  });
});

// ─── P6-9 / P6-10: Children perspective origin picker ───────────────

describe("TransformSettings children perspective origin", () => {
  it("children perspective origin picker has showInputs", () => {
    // Source: second TransformOriginPicker in TransformSettings
    // <TransformOriginPicker value={perspectiveOrigin} onChange={onPerspectiveOriginChange} showInputs elementSize={elementSize} />
    expect(editorSrc).toMatch(
      /<TransformOriginPicker\s+value=\{perspectiveOrigin\}\s+onChange=\{onPerspectiveOriginChange\}\s+showInputs(\s+[^>]*?)?\s*\/>/,
    );
    // Perspective-origin also resolves to px under getComputedStyle, so the
    // picker needs the box size to convert px → % here too.
    expect(editorSrc).toMatch(
      /<TransformOriginPicker\s+value=\{perspectiveOrigin\}[\s\S]*?elementSize=\{elementSize\}/,
    );
  });

  it("perspective origin change wired to onPerspectiveOriginChange", () => {
    expect(editorSrc).toMatch(
      /onChange=\{onPerspectiveOriginChange\}/,
    );
  });
});
