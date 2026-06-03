// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { resolveBackdropColor } from "../core/resolveBackdrop";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.style.colorScheme = "";
});

function add(parent: Element, styles: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = document.createElement("div");
  Object.assign(el.style, styles);
  parent.appendChild(el);
  return el;
}

describe("resolveBackdropColor", () => {
  it("returns the element's own opaque background", () => {
    const el = add(document.body, { backgroundColor: "rgb(255, 255, 255)" });
    expect(resolveBackdropColor(el)).toEqual({ hex: "#ffffff" });
  });

  it("walks to the first opaque ancestor when the element is transparent", () => {
    const parent = add(document.body, { backgroundColor: "rgb(0, 0, 0)" });
    const child = add(parent, {});
    expect(resolveBackdropColor(child)).toEqual({ hex: "#000000" });
  });

  it("is unknown over a gradient / background image", () => {
    const el = add(document.body, {
      backgroundColor: "rgb(255, 255, 255)",
      backgroundImage: "linear-gradient(#fff, #000)",
    });
    const result = resolveBackdropColor(el);
    expect(result).toHaveProperty("unknown", true);
  });

  it("is unknown over a translucent background (needs compositing)", () => {
    const el = add(document.body, { backgroundColor: "rgba(0, 0, 0, 0.4)" });
    expect(resolveBackdropColor(el)).toHaveProperty("unknown", true);
  });

  it("is unknown under a backdrop-filter", () => {
    const el = add(document.body, {
      backgroundColor: "rgb(255, 255, 255)",
      backdropFilter: "blur(4px)",
    });
    expect(resolveBackdropColor(el)).toHaveProperty("unknown", true);
  });

  it("is unknown under a filter", () => {
    const el = add(document.body, {
      backgroundColor: "rgb(255, 255, 255)",
      filter: "contrast(0.5)",
    });
    expect(resolveBackdropColor(el)).toHaveProperty("unknown", true);
  });

  it("is unknown under a non-normal blend mode", () => {
    const el = add(document.body, {
      backgroundColor: "rgb(255, 255, 255)",
      mixBlendMode: "multiply",
    });
    expect(resolveBackdropColor(el)).toHaveProperty("unknown", true);
  });

  it("is unknown when an ancestor has opacity < 1", () => {
    const parent = add(document.body, { backgroundColor: "rgb(255,255,255)", opacity: "0.5" });
    const child = add(parent, {});
    expect(resolveBackdropColor(child)).toHaveProperty("unknown", true);
  });

  it("falls back to the white canvas when nothing opaque is found (light scheme)", () => {
    const el = add(document.body, {});
    expect(resolveBackdropColor(el)).toEqual({ hex: "#ffffff" });
  });

  it("is unknown when nothing opaque is found under a dark color-scheme", () => {
    document.documentElement.style.colorScheme = "dark";
    const el = add(document.body, {});
    expect(resolveBackdropColor(el)).toHaveProperty("unknown", true);
  });
});
