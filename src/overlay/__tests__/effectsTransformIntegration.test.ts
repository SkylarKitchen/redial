/**
 * effectsTransformIntegration.test.ts — EffectsSection + TransformEditor
 * integration tests.
 *
 * Verifies wiring between EffectsSection and TransformEditor via source
 * analysis and renderToString smoke tests.
 */

// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// ─── Source text ──────────────────────────────────────────────────────

const effectsSrc = readFileSync(
  join(__dirname, "..", "sections", "EffectsSection.tsx"),
  "utf-8",
);

// ─── Mock SectionCtx ─────────────────────────────────────────────────

function makeMockCtx(): SectionCtx {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: vi.fn(),
    ind: () => "none",
    sectionInd: () => "none",
    cs,
    parentCs: null,
    getConversionCtx: (): UnitConversionContext => ({
      computedFontSize: 16,
      rootFontSize: 16,
      parentWidth: 800,
      parentHeight: 600,
      viewportWidth: 1280,
      viewportHeight: 720,
    }),
    ctxMenu: () => vi.fn(),
  };
}

// ─── P8-1/2: Initial state parsing ──────────────────────────────────

describe("EffectsSection transform initial state", () => {
  it("initializes transforms via parseTransform(cs.transform)", () => {
    expect(effectsSrc).toMatch(/useState<TransformValue\[\]>\(\(\) => parseTransform\(cs\.transform\)\)/);
  });

  it("initializes selfPerspective via parseSelfPerspective(cs.transform)", () => {
    expect(effectsSrc).toMatch(/useState\(\(\) => parseSelfPerspective\(cs\.transform\)\)/);
  });
});

// ─── P8-3/4: Apply wiring ──────────────────────────────────────────

describe("EffectsSection transform apply wiring", () => {
  it("handleTransformsChange calls apply with transformToCSSWithPerspective", () => {
    expect(effectsSrc).toMatch(
      /apply\("transform",\s*transformToCSSWithPerspective\(t,\s*selfPerspectiveRef\.current\)\)/
    );
  });

  it("handleSelfPerspectiveChange calls apply with transformToCSSWithPerspective", () => {
    expect(effectsSrc).toMatch(
      /apply\("transform",\s*transformToCSSWithPerspective\(transformsRef\.current,\s*v\)\)/
    );
  });

  it("uses refs to break circular dependency between transform and perspective handlers", () => {
    expect(effectsSrc).toMatch(/selfPerspectiveRef\s*=\s*useRef\(selfPerspective\)/);
    expect(effectsSrc).toMatch(/transformsRef\s*=\s*useRef\(transforms\)/);
  });
});

// ─── P8-5/6: SubSectionHeader wiring ────────────────────────────────

describe("EffectsSection transform SubSectionHeader", () => {
  it('onMenu toggles transformSettingsOpen', () => {
    expect(effectsSrc).toMatch(/onMenu=\{?\(\)\s*=>\s*setTransformSettingsOpen\(\(o\)\s*=>\s*!o\)/);
  });

  it('onAdd calls handleAddTransform', () => {
    expect(effectsSrc).toMatch(/onAdd=\{handleAddTransform\}/);
  });

  it("handleAddTransform adds default translate {type: 'translate', x: 0, y: 0, z: 0}", () => {
    expect(effectsSrc).toMatch(/handleTransformsChange\(\[\.\.\.transforms,\s*\{\s*type:\s*"translate",\s*x:\s*0,\s*y:\s*0,\s*z:\s*0\s*\}\]/);
  });
});

// ─── P8-7: Reset clears transform-related properties ────────────────

describe("EffectsSection transform reset", () => {
  it("resets all 5 transform-related CSS properties", () => {
    const resetCalls = effectsSrc.match(/resetProp\(element,\s*"[^"]+"\)/g) ?? [];
    const resetProps = resetCalls.map((c) => c.match(/"([^"]+)"/)![1]);
    expect(resetProps).toContain("transform");
    expect(resetProps).toContain("transform-origin");
    expect(resetProps).toContain("perspective");
    expect(resetProps).toContain("backface-visibility");
    expect(resetProps).toContain("perspective-origin");
  });
});

// ─── P8-8/9: TransformEditor visibility conditions ──────────────────

describe("EffectsSection TransformEditor visibility", () => {
  it("shows TransformEditor when transforms.length > 0 OR settingsOpen", () => {
    expect(effectsSrc).toMatch(/transforms\.length\s*>\s*0\s*\|\|\s*transformSettingsOpen/);
  });

  it("passes settingsOpen prop to TransformEditor", () => {
    expect(effectsSrc).toMatch(/settingsOpen=\{transformSettingsOpen\}/);
  });
});

// ─── P8-10: No standalone backface/perspective rows ─────────────────

describe("EffectsSection standalone rows removed", () => {
  it("does NOT render standalone backface-visibility SelectRow", () => {
    // After the redesign, backface-visibility is inside TransformEditor/TransformSettings,
    // not as a top-level SelectRow in EffectsSection
    const selectRows = effectsSrc.match(/<SelectRow[^>]*label="[^"]*"[^>]*\/>/g) ?? [];
    const labels = selectRows.map((r) => r.match(/label="([^"]+)"/)![1]);
    expect(labels).not.toContain("Backface");
    expect(labels).not.toContain("Backface Visibility");
  });

  it("does NOT render standalone perspective NumberRow", () => {
    // Perspective is now inside TransformSettings, not a top-level row
    const numberRows = effectsSrc.match(/<NumberRow[^>]*label="[^"]*"[^>]*\/>/g) ?? [];
    const labels = numberRows.map((r) => r.match(/label="([^"]+)"/)![1]);
    expect(labels).not.toContain("Perspective");
  });
});

// ─── Render smoke test ───────────────────────────────────────────────

describe("EffectsSection renders with transform state", () => {
  it("renders without throwing", async () => {
    const { EffectsSection } = await import("../sections/EffectsSection");
    const ctx = makeMockCtx();
    expect(() => {
      renderToString(createElement(EffectsSection, { ctx }));
    }).not.toThrow();
  });
});
