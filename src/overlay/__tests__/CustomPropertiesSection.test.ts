import { describe, it, expect } from "vitest";

describe("CustomPropertiesSection", () => {
  it("module exports CustomPropertiesSection component", async () => {
    const mod = await import("../sections/CustomPropertiesSection");
    expect(mod.CustomPropertiesSection).toBeDefined();
    expect(typeof mod.CustomPropertiesSection).toBe("function");
  });
});
