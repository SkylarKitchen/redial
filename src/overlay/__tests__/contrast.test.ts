// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { evaluateContrast } from "../core/contrast";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.style.colorScheme = "";
});

function textEl(styles: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = document.createElement("p");
  Object.assign(el.style, { fontSize: "16px", ...styles });
  document.body.appendChild(el);
  return el;
}

describe("evaluateContrast", () => {
  it("rates black text on the white canvas as passing AAA", () => {
    const el = textEl({ color: "rgb(0, 0, 0)" });
    const result = evaluateContrast(el, "#000000");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.level).toBe("AAA");
      expect(result.ratio).toBeCloseTo(21, 0);
    }
  });

  it("rates light-gray text on white as failing (normal size)", () => {
    const el = textEl({ color: "rgb(153, 153, 153)" });
    const result = evaluateContrast(el, "#999999");
    expect(result.kind).toBe("fail");
  });

  it("relaxes thresholds for large text (#888 fails normal, passes AA large)", () => {
    const small = textEl({ color: "rgb(136, 136, 136)", fontSize: "16px" });
    expect(evaluateContrast(small, "#888888").kind).toBe("fail");

    const large = textEl({ color: "rgb(136, 136, 136)", fontSize: "28px" });
    const result = evaluateContrast(large, "#888888");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.level).toBe("AA");
  });

  it("is unknown when the text color is translucent", () => {
    const el = textEl({ color: "rgba(0, 0, 0, 0.5)" });
    expect(evaluateContrast(el, "#000000").kind).toBe("unknown");
  });

  it("propagates an unknown backdrop (gradient behind text)", () => {
    const el = textEl({
      color: "rgb(0, 0, 0)",
      backgroundImage: "linear-gradient(#fff, #000)",
    });
    expect(evaluateContrast(el, "#000000").kind).toBe("unknown");
  });
});
