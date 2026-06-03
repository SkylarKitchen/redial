// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { BordersSection } from "/Users/skylar/code/redial/src/overlay/sections/BordersSection";
import type { SectionCtx } from "/Users/skylar/code/redial/src/overlay/panelUtils";
import type { UnitConversionContext } from "/Users/skylar/code/redial/src/overlay/unitConversion";

function makeMixedBorderCtx(): SectionCtx {
  const element = document.createElement("div");
  element.style.borderTopWidth = "2px";
  element.style.borderTopStyle = "solid";
  element.style.borderTopColor = "rgb(255, 0, 0)";
  element.style.borderBottomWidth = "1px";
  element.style.borderBottomStyle = "dashed";
  element.style.borderBottomColor = "rgb(0, 0, 255)";
  element.style.borderRightWidth = "3px";
  element.style.borderRightStyle = "dotted";
  element.style.borderRightColor = "rgb(0, 255, 0)";
  element.style.borderLeftWidth = "0px";
  element.style.borderLeftStyle = "none";
  element.style.borderLeftColor = "rgb(0, 0, 0)";
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element, apply: vi.fn(), ind: () => "none" as const, sectionInd: () => "none" as const,
    cs, parentCs: null,
    getConversionCtx: (): UnitConversionContext => ({ computedFontSize: 16, rootFontSize: 16, parentWidth: 800, parentHeight: 600, viewportWidth: 1280, viewportHeight: 720 }),
    ctxMenu: () => vi.fn(), isTailwind: false,
  } as any;
}

function getBorderWidthInput(container: HTMLElement): HTMLInputElement {
  const inputs = container.querySelectorAll("input");
  return inputs[1] as HTMLInputElement;
}

describe("probe", () => {
  it("does apply() actually fire on the dispatched event sequence?", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const ctx = makeMixedBorderCtx();
    act(() => { root.render(createElement(BordersSection, { ctx, forceOpen: true } as any)); });
    act(() => { (container.querySelector('[data-side="top"]') as HTMLElement).click(); });
    const widthInput = getBorderWidthInput(container);
    act(() => {
      widthInput.focus();
      (widthInput as any).value = "5";
      widthInput.dispatchEvent(new Event("input", { bubbles: true }));
      widthInput.dispatchEvent(new Event("change", { bubbles: true }));
      widthInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const applyCalls = (ctx.apply as ReturnType<typeof vi.fn>).mock.calls;
    console.log("ALL APPLY CALLS:", JSON.stringify(applyCalls));
    const widthCall = applyCalls.find(([prop]: [string]) => prop.includes("width"));
    console.log("WIDTH CALL FOUND:", JSON.stringify(widthCall));
    // PROVE: if guard is vacuous, widthCall will be undefined
    expect(widthCall, "width apply() must actually fire — else the test's if-guard is vacuous").toBeDefined();
    expect(widthCall![0]).toBe("border-top-width");
  });
});
