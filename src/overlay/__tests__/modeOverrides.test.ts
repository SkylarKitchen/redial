// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import {
  applyModeOverride,
  getModeOverrides,
  removeModeOverride,
  resetAllModeOverrides,
  serializeModeOverrides,
  subscribeModeOverrides,
  getModeOverrideSnapshot,
} from "../variables/modeOverrides";

afterEach(() => {
  resetAllModeOverrides();
});

describe("applyModeOverride", () => {
  it("stores an override for a selector + variable", () => {
    applyModeOverride(".dark", "--bg-primary", "#111");
    expect(getModeOverrides(".dark")).toEqual({ "--bg-primary": "#111" });
  });

  it("injects a <style> tag with the override", () => {
    applyModeOverride(".dark", "--bg-primary", "#111");
    const styleEl = document.getElementById("redial-mode-overrides");
    expect(styleEl).toBeTruthy();
    expect(styleEl!.textContent).toContain(".dark");
    expect(styleEl!.textContent).toContain("--bg-primary: #111");
  });

  it("multiple overrides in the same selector share one rule block", () => {
    applyModeOverride(".dark", "--bg-primary", "#111");
    applyModeOverride(".dark", "--text", "#fff");
    const styleEl = document.getElementById("redial-mode-overrides");
    const text = styleEl!.textContent!;
    expect(text.match(/\.dark\s*\{/g)?.length).toBe(1);
    expect(text).toContain("--bg-primary: #111");
    expect(text).toContain("--text: #fff");
  });

  it("overrides in different selectors get separate rule blocks", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".light", "--bg", "#fff");
    const text = document.getElementById("redial-mode-overrides")!.textContent!;
    expect(text).toContain(".dark");
    expect(text).toContain(".light");
  });
});

describe("removeModeOverride", () => {
  it("removes a single variable from a selector", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".dark", "--text", "#fff");
    removeModeOverride(".dark", "--bg");
    expect(getModeOverrides(".dark")).toEqual({ "--text": "#fff" });
  });

  it("removes the selector entirely when last variable is removed", () => {
    applyModeOverride(".dark", "--bg", "#111");
    removeModeOverride(".dark", "--bg");
    expect(getModeOverrides(".dark")).toBeUndefined();
  });
});

describe("resetAllModeOverrides", () => {
  it("clears all overrides and empties the style tag", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".light", "--bg", "#fff");
    resetAllModeOverrides();
    expect(getModeOverrides(".dark")).toBeUndefined();
    const styleEl = document.getElementById("redial-mode-overrides");
    expect(!styleEl || styleEl.textContent === "").toBe(true);
  });
});

describe("serializeModeOverrides", () => {
  it("returns CSS text with one rule block per selector", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".dark", "--text", "#fff");
    applyModeOverride('[data-theme="blue"]', "--accent", "blue");
    const css = serializeModeOverrides();
    expect(css).toContain('.dark {\n  --bg: #111;\n  --text: #fff;\n}');
    expect(css).toContain('[data-theme="blue"] {\n  --accent: blue;\n}');
  });

  it("returns empty string when no overrides", () => {
    expect(serializeModeOverrides()).toBe("");
  });
});

describe("subscription", () => {
  it("notifies listeners on apply", () => {
    let called = 0;
    const unsub = subscribeModeOverrides(() => { called++; });
    applyModeOverride(".dark", "--bg", "#111");
    expect(called).toBe(1);
    unsub();
  });

  it("snapshot increments on each change", () => {
    const s1 = getModeOverrideSnapshot();
    applyModeOverride(".dark", "--bg", "#111");
    const s2 = getModeOverrideSnapshot();
    expect(s2).toBeGreaterThan(s1);
  });
});
