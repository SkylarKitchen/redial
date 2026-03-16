// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

describe("VariableField", () => {
  it("exports from controls barrel", async () => {
    const mod = await import("../controls");
    expect(mod.VariableField).toBeDefined();
  });

  it("exports VariableFieldProps type", async () => {
    const mod = await import("../controls/VariableField");
    expect(mod.VariableField).toBeTypeOf("function");
  });
});
