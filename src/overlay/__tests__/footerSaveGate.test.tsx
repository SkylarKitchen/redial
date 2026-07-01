// @vitest-environment happy-dom
/**
 * footerSaveGate.test.tsx — Issue #70 (remaining requirement): the Save
 * button's disabled gate must match its label.
 *
 * The label counts element changes PLUS mode overrides (`totalCount = count +
 * getModeOverrideCount()`), but the disabled gate only checked element changes
 * (`count`). So a mode-override-only session rendered an enabled-looking
 * "Save (1)" button that was actually disabled — even though `handleSave`
 * explicitly supports mode-only saves (it serializes mode overrides to the
 * clipboard when nothing is file-bound).
 *
 * RED before the fix: with zero element changes and one mode override, the
 * Save button reads "Save (1)" but `disabled` is true.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Footer } from "../shell/Footer";
import { styleEngine } from "../core/engine";
import { applyModeOverride, resetAllModeOverrides } from "../core/modeOverrides";

function makeEl(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  styleEngine.resetAll();
  resetAllModeOverrides();
});

function findSaveButton(): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim().startsWith("Save"),
  );
  expect(btn, "Save button should be rendered").toBeTruthy();
  return btn as HTMLButtonElement;
}

describe("Footer Save gate — label and gate must agree (#70)", () => {
  it("enables Save when there are zero element changes but ≥1 mode override", async () => {
    const el = makeEl("gate-el");
    applyModeOverride('[data-theme="dark"]', "--brand", "red");

    await act(async () => {
      root.render(<Footer element={el} onReset={() => {}} />);
    });

    const save = findSaveButton();
    // The label already counts the mode override...
    expect(save.textContent).toContain("Save (1)");
    // ...so the gate must too. THE BUG: pre-fix this button is disabled.
    expect(
      save.disabled,
      "Save must not be disabled when a mode override is pending",
    ).toBe(false);
  });

  it("keeps Save disabled when there are no changes at all", async () => {
    const el = makeEl("gate-el-empty");

    await act(async () => {
      root.render(<Footer element={el} onReset={() => {}} />);
    });

    const save = findSaveButton();
    expect(save.textContent?.trim()).toBe("Save");
    expect(save.disabled).toBe(true);
  });
});
