import { describe, it, expect } from "vitest";
import { parseCSSText } from "../cssImport";

// ─── parseCSSText ───────────────────────────────────────────────────

describe("parseCSSText", () => {
  it("parses a single declaration", () => {
    expect(parseCSSText("color: red;")).toEqual([
      { prop: "color", value: "red" },
    ]);
  });

  it("parses multiple declarations", () => {
    const result = parseCSSText("color: red; font-size: 16px; margin: 0 auto;");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ prop: "color", value: "red" });
    expect(result[1]).toEqual({ prop: "font-size", value: "16px" });
    expect(result[2]).toEqual({ prop: "margin", value: "0 auto" });
  });

  it("parses declarations without trailing semicolons", () => {
    expect(parseCSSText("color: red")).toEqual([
      { prop: "color", value: "red" },
    ]);
  });

  it("strips selectors and braces from full rules", () => {
    const css = ".hero { color: red; font-size: 16px; }";
    const result = parseCSSText(css);
    expect(result).toHaveLength(2);
    expect(result[0].prop).toBe("color");
  });

  it("handles multiple rule blocks", () => {
    const css = ".a { color: red; } .b { font-size: 16px; }";
    const result = parseCSSText(css);
    expect(result).toHaveLength(2);
  });

  it("strips CSS comments", () => {
    const css =
      "/* heading styles */ color: red; /* inline */ font-size: 16px;";
    const result = parseCSSText(css);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for invalid input", () => {
    expect(parseCSSText("")).toEqual([]);
    expect(parseCSSText("not css at all")).toEqual([]);
    expect(parseCSSText("just some random text")).toEqual([]);
  });

  it("handles values with colons (like URLs)", () => {
    const result = parseCSSText(
      "background: url(https://example.com/img.png);"
    );
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("url(https://example.com/img.png)");
  });

  it("handles CSS custom properties", () => {
    const result = parseCSSText("--primary-color: #6366f1;");
    expect(result).toHaveLength(1);
    expect(result[0].prop).toBe("--primary-color");
  });

  it("handles whitespace variations", () => {
    const css = "  color :  red  ;  font-size:16px  ";
    const result = parseCSSText(css);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ prop: "color", value: "red" });
    expect(result[1]).toEqual({ prop: "font-size", value: "16px" });
  });

  it("rejects invalid property names", () => {
    expect(parseCSSText("123: red;")).toEqual([]);
    expect(parseCSSText(": red;")).toEqual([]);
  });
});
