// @vitest-environment happy-dom
/**
 * Regression for issue #57: enrichChangesForCommit must preserve each entry's
 * OWN pseudo-state. diff()/diffAll() legitimately return state-keyed entries
 * (e.g. state:"hover"), and the server targets `.class:hover { }` blocks off
 * that field — but both CSS return paths used to end with
 * `state: isStateActive ? opts.activeState : undefined`, overwriting the
 * spread entry's state. Saving while the panel is on "None" therefore
 * flattened hover edits into the BASE rule.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enrichChangesForCommit } from "../core/commitUtils";
import type { DiffEntry } from "../core/apply";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeEl(className = ""): HTMLElement {
  const el = document.createElement("div");
  // Avoid Tailwind-looking utility classes so isTailwindElement stays false.
  if (className) el.className = className;
  document.body.appendChild(el);
  return el;
}

const entry = (over: Partial<DiffEntry> = {}): DiffEntry => ({
  prop: "color",
  from: "blue",
  to: "red",
  ...over,
});

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ─── Tests ────────────────────────────────────────────────────────────

describe("enrichChangesForCommit — pseudo-state preservation (issue #57)", () => {
  it("leaves state undefined for a stateless entry when the panel state is inactive", () => {
    const el = makeEl();
    const [c] = enrichChangesForCommit(el, [entry()], {
      scope: "element",
      activeState: "none",
    });
    expect(c.state).toBeUndefined();
  });

  it("keeps an entry's own state:'hover' when the panel state is 'none' (the bug)", () => {
    const el = makeEl();
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.state).toBe("hover");
  });

  it("applies an active panel state to stateless entries without overwriting an entry's own state", () => {
    const el = makeEl();
    const [plain, hovered] = enrichChangesForCommit(
      el,
      [entry(), entry({ prop: "background-color", state: "hover" })],
      { scope: "element", activeState: "focus" },
    );
    expect(plain.state).toBe("focus");
    expect(hovered.state).toBe("hover");
  });

  it("still populates className in class scope, preserving per-entry state", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "class",
      activeClassName: "Button_btn__a1b2c",
      activeState: "none",
    });
    expect(c.className).toBe("btn");
    expect(c.state).toBe("hover");
  });

  it("preserves per-entry state on the custom-property (var redirect) path", () => {
    const el = makeEl();
    // Inline style is the getAuthoredValue shortcut — no stylesheet needed.
    el.style.setProperty("color", "var(--brand)");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], {
      scope: "element",
      activeState: "none",
    });
    expect(c.prop).toBe("--brand");
    // happy-dom resolves the unset var to "" so `from` falls back to the entry's.
    expect(c.from).toBe("blue");
    expect(c.state).toBe("hover");
  });
});
