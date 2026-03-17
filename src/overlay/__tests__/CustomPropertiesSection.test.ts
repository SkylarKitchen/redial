import { describe, it, expect } from "vitest";

describe("CustomPropertiesSection", () => {
  it("module exports CustomPropertiesSection component", async () => {
    const mod = await import("../sections/CustomPropertiesSection");
    expect(mod.CustomPropertiesSection).toBeDefined();
    // React.memo wraps in an object with $$typeof and a .type function
    expect(typeof mod.CustomPropertiesSection).toBe("object");
    expect(typeof (mod.CustomPropertiesSection as any).type).toBe("function");
  });
});
