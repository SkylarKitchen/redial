// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { BordersSection } from "/Users/skylar/code/redial/src/overlay/sections/BordersSection";

function makeCtx() {
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
  return {
    element, apply: vi.fn(), ind: () => "none", sectionInd: () => "none",
    cs: getComputedStyle(element), parentCs: null,
    getConversionCtx: () => ({ computedFontSize: 16, rootFontSize: 16, parentWidth: 800, parentHeight: 600, viewportWidth: 1280, viewportHeight: 720 }),
    ctxMenu: () => vi.fn(), isTailwind: false,
  } as any;
}

describe("probe2 - isolate apply sources", () => {
  it("apply calls just from clicking top (no edit at all)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const ctx = makeCtx();
    act(() => { root.render(createElement(BordersSection, { ctx, forceOpen: true } as any)); });
    console.log("AFTER RENDER:", JSON.stringify(ctx.apply.mock.calls));
    act(() => { (container.querySelector('[data-side="top"]') as HTMLElement).click(); });
    console.log("AFTER CLICK TOP (no edit):", JSON.stringify(ctx.apply.mock.calls));
    expect(true).toBe(true);
  });

  it("does editing to 5 with PROPER react value setter commit 5px?", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const ctx = makeCtx();
    act(() => { root.render(createElement(BordersSection, { ctx, forceOpen: true } as any)); });
    act(() => { (container.querySelector('[data-side="top"]') as HTMLElement).click(); });
    ctx.apply.mockClear();
    const inputs = container.querySelectorAll("input");
    const widthInput = inputs[1] as HTMLInputElement;
    // Use the native value setter so React's onChange picks up the new value
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      widthInput.focus();
      nativeSetter.call(widthInput, "5");
      widthInput.dispatchEvent(new Event("input", { bubbles: true }));
      widthInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    console.log("AFTER PROPER EDIT TO 5:", JSON.stringify(ctx.apply.mock.calls));
    expect(true).toBe(true);
  });
});
