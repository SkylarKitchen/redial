// @vitest-environment happy-dom
/**
 * footerReset.test.tsx — Footer's "Reset" button behaviour (RFC #14 Phase 3)
 *
 * FIRED-BEHAVIOUR tests: render the real Footer, drive its Reset button, and
 * assert on engine state — not on source strings. These survive the migration
 * of Footer onto `styleEngine.resetScope` and lock two contracts:
 *
 *  1. Reset clears the selected element's overrides for the active scope/state.
 *  2. Reset does NOT touch GLOBAL mode overrides (the over-clear bug). A mode
 *     override is a separate dimension created in the Variables panel; it is not
 *     attached to the selected element, so resetting that element must leave it
 *     intact. (It stays clearable via undo.)
 *
 * Assertions use the underlying core primitives directly (not the new engine
 * surface) so the "mode survives" case is a genuine reproduction: it is RED on
 * the pre-fix Footer (which calls resetAllModeOverrides) and GREEN after.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Footer } from "../shell/Footer";
import { styleEngine } from "../core/engine";
import { diffState } from "../core/statePreview";
import {
  getModeOverrideCount,
  isModeOverrideDirty,
  resetAllModeOverrides,
} from "../core/modeOverrides";

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

describe("Footer Reset — over-clear fix", () => {
  it("clears the element's overrides but LEAVES global mode overrides intact", () => {
    const el = makeEl();
    // An element edit on the selected element...
    styleEngine.apply({ scope: "element", el }, "color", "red");
    // ...and an UNRELATED global theme-mode override (made in the Variables panel).
    styleEngine.apply(
      { scope: "mode", selector: ".dark", varName: "--brand" },
      "",
      "#000",
    );
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(getModeOverrideCount()).toBe(1);

    render(
      <Footer
        element={el}
        scopeCtx={{ scope: "element", activeClassName: null, activeState: "none" }}
        onReset={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Reset$/ }));

    // Element override is gone...
    expect(el.style.getPropertyValue("color")).toBe("");
    // ...but the global mode override SURVIVES (this is the fix).
    expect(getModeOverrideCount()).toBe(1);
    expect(isModeOverrideDirty(".dark", "--brand")).toBe(true);
  });

  it("resets only the active pseudo-state, leaving base + modes intact", () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red"); // base
    styleEngine.apply({ scope: "state", el, state: "hover" }, "color", "blue"); // hover
    styleEngine.apply(
      { scope: "mode", selector: ".dark", varName: "--brand" },
      "",
      "#000",
    );

    render(
      <Footer
        element={el}
        scopeCtx={{ scope: "element", activeClassName: null, activeState: "hover" }}
        onReset={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Reset$/ }));

    // hover gone, base survives, mode survives
    expect(diffState(el, "hover")).toHaveLength(0);
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(getModeOverrideCount()).toBe(1);
  });
});
