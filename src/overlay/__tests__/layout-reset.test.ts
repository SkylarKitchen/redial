// @vitest-environment happy-dom
/**
 * layout-reset.test.ts — Regression test for Option+Click reset in Layout section
 *
 * Bug: LayoutSection never passes onReset/onAltClick to many controls, so
 * alt+click (Option+Click) to reset style changes silently does nothing for:
 * - DisplayTabs (display)
 * - DirectionRow (flex-direction, flex-wrap)
 * - Align X/Y MiniDropdown (justify-content, align-items)
 * - Flex Grow/Shrink ValueInput + LabelScrub
 * - Flex Basis ValueInput + LabelScrub
 * - Align Self SelectRow
 * - Order ValueInput
 */

import { describe, it, expect } from "vitest";
import { applyInlineStyle, isDirty, resetProp, resetAll } from "../apply";

// ── Unit test: resetProp works for layout properties ──────────────────

describe("resetProp works for layout CSS properties", () => {
  const layoutProps = [
    { prop: "display", value: "flex", initial: "block" },
    { prop: "flex-direction", value: "column", initial: "row" },
    { prop: "flex-wrap", value: "wrap", initial: "nowrap" },
    { prop: "justify-content", value: "center", initial: "normal" },
    { prop: "align-items", value: "center", initial: "normal" },
    { prop: "flex-grow", value: "2", initial: "0" },
    { prop: "flex-shrink", value: "0", initial: "1" },
    { prop: "flex-basis", value: "100px", initial: "auto" },
    { prop: "align-self", value: "center", initial: "auto" },
    { prop: "order", value: "5", initial: "0" },
  ];

  for (const { prop, value } of layoutProps) {
    it(`resetProp("${prop}") clears the dirty flag`, () => {
      const el = document.createElement("div");
      document.body.appendChild(el);

      applyInlineStyle(el, prop, value);
      expect(isDirty(el, prop)).toBe(true);

      resetProp(el, prop);
      expect(isDirty(el, prop)).toBe(false);

      document.body.removeChild(el);
      resetAll();
    });
  }
});

// ── Source-level test: every Layout control must wire up reset ─────────

describe("LayoutSection wires onReset/onAltClick for all controls", () => {
  let layoutSrc: string;

  it("can read LayoutSection source", async () => {
    const fs = await import("fs");
    const path = await import("path");
    layoutSrc = fs.readFileSync(
      path.resolve(__dirname, "../LayoutSection.tsx"),
      "utf-8"
    );
    expect(layoutSrc).toBeTruthy();
  });

  // ── Flex Child: Grow / Shrink ValueInputs must have onAltClick ──

  it("Flex Grow ValueInput has onAltClick", () => {
    // Find the Grow section: the div containing "Grow" label and its ValueInput
    const growMatch = layoutSrc.match(
      />\s*Grow\s*<\/span>[\s\S]*?<ValueInput[^>]*?\/>/
    );
    expect(growMatch, "Could not find Grow ValueInput block").toBeTruthy();
    expect(
      growMatch![0],
      "Grow ValueInput must have onAltClick prop for Option+Click reset"
    ).toContain("onAltClick");
  });

  it("Flex Shrink ValueInput has onAltClick", () => {
    const shrinkMatch = layoutSrc.match(
      />\s*Shrink\s*<\/span>[\s\S]*?<ValueInput[^>]*?\/>/
    );
    expect(shrinkMatch, "Could not find Shrink ValueInput block").toBeTruthy();
    expect(
      shrinkMatch![0],
      "Shrink ValueInput must have onAltClick prop for Option+Click reset"
    ).toContain("onAltClick");
  });

  // ── Flex Child: Grow / Shrink LabelScrubs must have onAltClick ──

  it("Flex Grow LabelScrub has onAltClick", () => {
    const growScrub = layoutSrc.match(
      /<LabelScrub[^>]*flexGrow[^>]*>/
    );
    expect(growScrub, "Could not find Grow LabelScrub").toBeTruthy();
    expect(
      growScrub![0],
      "Grow LabelScrub must have onAltClick prop for Option+Click reset"
    ).toContain("onAltClick");
  });

  it("Flex Shrink LabelScrub has onAltClick", () => {
    const shrinkScrub = layoutSrc.match(
      /<LabelScrub[^>]*flexShrink[^>]*>/
    );
    expect(shrinkScrub, "Could not find Shrink LabelScrub").toBeTruthy();
    expect(
      shrinkScrub![0],
      "Shrink LabelScrub must have onAltClick prop for Option+Click reset"
    ).toContain("onAltClick");
  });

  // ── Flex Basis ValueInput + LabelScrub must have onAltClick ──

  it("Flex Basis ValueInput has onAltClick", () => {
    const basisMatch = layoutSrc.match(
      />\s*Basis\s*<\/span>[\s\S]*?<ValueInput[^>]*?\/>/
    );
    expect(basisMatch, "Could not find Basis ValueInput block").toBeTruthy();
    expect(
      basisMatch![0],
      "Basis ValueInput must have onAltClick prop for Option+Click reset"
    ).toContain("onAltClick");
  });

  it("Flex Basis LabelScrub has onAltClick", () => {
    const basisScrub = layoutSrc.match(
      /<LabelScrub[^>]*flexBasis[^>]*>/
    );
    expect(basisScrub, "Could not find Basis LabelScrub").toBeTruthy();
    expect(
      basisScrub![0],
      "Basis LabelScrub must have onAltClick prop for Option+Click reset"
    ).toContain("onAltClick");
  });

  // ── Align Self SelectRow must have onReset ──

  it("Align Self SelectRow has onReset", () => {
    const alignSelfMatch = layoutSrc.match(
      /<SelectRow[\s\S]*?label="Align Self"[\s\S]*?\/>/
    );
    expect(alignSelfMatch, "Could not find Align Self SelectRow").toBeTruthy();
    expect(
      alignSelfMatch![0],
      "Align Self SelectRow must have onReset prop for Option+Click reset"
    ).toContain("onReset");
  });

  // ── Order ValueInput must have onAltClick ──

  it("Order ValueInput has onAltClick", () => {
    const orderMatch = layoutSrc.match(
      /Order[\s\S]*?<ValueInput[^>]*?\/>/
    );
    expect(orderMatch, "Could not find Order ValueInput block").toBeTruthy();
    expect(
      orderMatch![0],
      "Order ValueInput must have onAltClick prop for Option+Click reset"
    ).toContain("onAltClick");
  });

  // ── DisplayTabs must accept and use onReset ──

  it("DisplayTabs is passed an onReset callback", () => {
    const displayTabsUsage = layoutSrc.match(/<DisplayTabs[^>]*\/>/);
    expect(displayTabsUsage, "Could not find DisplayTabs usage").toBeTruthy();
    expect(
      displayTabsUsage![0],
      "DisplayTabs must receive onReset prop for Option+Click reset"
    ).toContain("onReset");
  });

  // ── DirectionRow must accept and use onReset ──

  it("DirectionRow is passed an onReset callback", () => {
    const dirRowUsage = layoutSrc.match(/<DirectionRow[\s\S]*?\/>/);
    expect(dirRowUsage, "Could not find DirectionRow usage").toBeTruthy();
    expect(
      dirRowUsage![0],
      "DirectionRow must receive onReset prop for Option+Click reset"
    ).toContain("onReset");
  });
});
