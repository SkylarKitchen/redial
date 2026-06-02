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
  undoModeOverride,
  redoModeOverride,
  isModeOverrideDirty,
} from "../core/modeOverrides";

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

describe("undo/redo", () => {
  it("undo reverts the last applyModeOverride", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".dark", "--bg", "#222");
    undoModeOverride();
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111" });
  });

  it("undo removes variable if it was newly added", () => {
    applyModeOverride(".dark", "--bg", "#111");
    undoModeOverride();
    expect(getModeOverrides(".dark")).toBeUndefined();
  });

  it("redo re-applies after undo", () => {
    applyModeOverride(".dark", "--bg", "#111");
    undoModeOverride();
    redoModeOverride();
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111" });
  });

  it("new apply after undo clears redo stack", () => {
    applyModeOverride(".dark", "--bg", "#111");
    undoModeOverride();
    applyModeOverride(".dark", "--bg", "#333");
    redoModeOverride(); // no-op
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#333" });
  });

  it("undo past the beginning is a no-op", () => {
    undoModeOverride();
    expect(getModeOverrides(".dark")).toBeUndefined();
  });
});

describe("isModeOverrideDirty", () => {
  it("returns false when no override for that selector+var", () => {
    expect(isModeOverrideDirty(".dark", "--bg")).toBe(false);
  });

  it("returns true after applying override", () => {
    applyModeOverride(".dark", "--bg", "#111");
    expect(isModeOverrideDirty(".dark", "--bg")).toBe(true);
  });

  it("returns false after undo", () => {
    applyModeOverride(".dark", "--bg", "#111");
    undoModeOverride();
    expect(isModeOverrideDirty(".dark", "--bg")).toBe(false);
  });
});

describe("serializeModeOverrides formatting", () => {
  it("produces pasteable CSS with proper indentation", () => {
    applyModeOverride(":root.dark", "--bg-primary", "#1a1a1a");
    applyModeOverride(":root.dark", "--text-primary", "#f5f5f5");
    applyModeOverride('[data-theme="ocean"]', "--accent", "#0066cc");
    const css = serializeModeOverrides();
    expect(css).toBe(
      ':root.dark {\n  --bg-primary: #1a1a1a;\n  --text-primary: #f5f5f5;\n}\n\n[data-theme="ocean"] {\n  --accent: #0066cc;\n}'
    );
  });
});

describe("full editing flow", () => {
  it("apply → serialize → undo → serialize roundtrip", () => {
    applyModeOverride(".dark", "--bg", "#111");
    applyModeOverride(".dark", "--text", "#eee");
    applyModeOverride(".light", "--bg", "#fff");

    const css1 = serializeModeOverrides();
    expect(css1).toContain("--bg: #111");
    expect(css1).toContain("--text: #eee");
    expect(css1).toContain(".light");

    undoModeOverride(); // undo .light --bg
    expect(serializeModeOverrides()).not.toContain(".light");

    undoModeOverride(); // undo .dark --text
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111" });

    redoModeOverride(); // redo .dark --text
    expect(getModeOverrides(".dark")).toEqual({ "--bg": "#111", "--text": "#eee" });
  });
});
