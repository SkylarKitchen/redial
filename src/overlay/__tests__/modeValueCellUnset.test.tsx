// @vitest-environment happy-dom
/**
 * modeValueCellUnset.test.tsx — Mode-override reset affordance (issue #52).
 *
 * A per-cell "revert to inherited" control appears only when the cell is
 * actually overridden (isModeOverrideDirty). Clicking it removes the override:
 * getModeOverrideCount() returns to 0 and the <style id="redial-mode-overrides">
 * rule is cleared. The affordance is absent when the cell is not dirty.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { ModeValueCell } from "../variables/ModeValueCell";
import type { InferredMode } from "../variables/modeDiscovery";
import {
  applyModeOverride,
  getModeOverrideCount,
  resetAllModeOverrides,
} from "../core/modeOverrides";

function darkMode(): InferredMode {
  return {
    name: "Dark",
    source: "class",
    selector: ".dark",
    values: { "--bg": "#111" },
  };
}

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return { container, root: createRoot(container) };
}

function unsetButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector('button[aria-label="Reset mode override"]');
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetAllModeOverrides();
  ({ container, root } = setup());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetAllModeOverrides();
  document.getElementById("redial-mode-overrides")?.remove();
});

describe("ModeValueCell — unset affordance (issue #52)", () => {
  it("hides the affordance when the cell is not overridden", () => {
    act(() => {
      root.render(
        createElement(ModeValueCell, {
          varName: "--bg",
          mode: darkMode(),
          value: "#111",
          varType: "color",
        }),
      );
    });
    expect(unsetButton(container)).toBeNull();
  });

  it("shows the affordance once the cell is overridden", () => {
    applyModeOverride(".dark", "--bg", "#222");
    act(() => {
      root.render(
        createElement(ModeValueCell, {
          varName: "--bg",
          mode: darkMode(),
          value: "#222",
          varType: "color",
        }),
      );
    });
    expect(unsetButton(container)).not.toBeNull();
  });

  it("clicking the affordance clears the override and empties the <style> rule", () => {
    applyModeOverride(".dark", "--bg", "#222");
    expect(getModeOverrideCount()).toBe(1);

    act(() => {
      root.render(
        createElement(ModeValueCell, {
          varName: "--bg",
          mode: darkMode(),
          value: "#222",
          varType: "color",
        }),
      );
    });

    const btn = unsetButton(container);
    expect(btn).not.toBeNull();
    act(() => { btn!.click(); });

    expect(getModeOverrideCount()).toBe(0);
    const styleEl = document.getElementById("redial-mode-overrides");
    expect(!styleEl || !styleEl.textContent?.includes("--bg")).toBe(true);
  });
});
