// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  applyCustomProperty,
  resetAll,
  isCustomPropertyDirty,
} from "../core/apply";

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

describe("resetAll clears customPropertyOverrides (Bug #21)", () => {
  it("isCustomPropertyDirty is true immediately after applyCustomProperty (baseline)", () => {
    applyCustomProperty(document.documentElement, "--my-token", "red");
    expect(isCustomPropertyDirty("--my-token")).toBe(true);
  });

  it("isCustomPropertyDirty is false after resetAll", () => {
    applyCustomProperty(document.documentElement, "--my-token", "red");
    expect(isCustomPropertyDirty("--my-token")).toBe(true);

    resetAll();

    expect(isCustomPropertyDirty("--my-token")).toBe(false);
  });
});
