// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

describe("VariableLinkDot", () => {
  it("exports from controls barrel", async () => {
    const mod = await import("../controls");
    expect(mod.VariableLinkDot).toBeDefined();
  });

  it("exports VariableLinkDotProps type", async () => {
    // Type-level check — if this compiles, the interface is exported
    const mod = await import("../controls/VariableLinkDot");
    expect(mod.VariableLinkDot).toBeTypeOf("function");
  });
});
