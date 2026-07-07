// @vitest-environment happy-dom
/**
 * dropdownAccessibility.test.tsx — Behavioral keyboard-accessibility tests for
 * the dropdown components (issue #105 exemplar migration).
 *
 * Formerly a readFileSync + string-assertion audit over UnitSelector.tsx,
 * SelectRow.tsx, PortalListboxSelect.tsx and useDropdownKeyboard.ts. Now the
 * real components are mounted in happy-dom and driven with real keyboard
 * events; every old source-text guarantee maps to an equal-or-stronger DOM
 * assertion here:
 *
 *   - Enter/Space open: components with explicit key handlers (SelectRowCustom)
 *     are exercised with real keydowns. Components that rely on native
 *     <button> activation for Enter/Space (UnitSelector, PortalListboxSelect)
 *     are asserted to be real <button> elements AND to open on activation
 *     (click), which is what Enter/Space produce on a native button.
 *   - ArrowUp/ArrowDown open the closed dropdown and move the highlight
 *     (observed via aria-activedescendant) when open.
 *   - Enter selects the highlighted option (onChange fires) and closes.
 *   - Escape closes without selecting.
 *   - Tab is not intercepted, so focus can move out.
 *   - ARIA: role=combobox trigger with aria-expanded/aria-haspopup/
 *     aria-controls, role=listbox popup, role=option items with aria-selected
 *     — all read from the rendered DOM and asserted to change with state.
 *
 * Dropdowns render through data-tuner-portal portals into document.body, so
 * queries go against the whole document, not the render container.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UnitSelector } from "../controls/UnitSelector";
import { SelectRow } from "../controls/SelectRow";
import { StateSelector } from "../shell/StateSelector";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** The portal listbox, wherever it was portaled to. */
function getListbox(): HTMLElement | null {
  return document.querySelector('[role="listbox"]');
}

function getOptions(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role="option"]'));
}

/** Resolve the option the trigger's aria-activedescendant points at. */
function activeDescendant(trigger: HTMLElement): HTMLElement | null {
  const id = trigger.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
}

// ─── UnitSelector — ARIA contract ─────────────────────────────────────

describe("UnitSelector — ARIA contract", () => {
  function renderUnits(onChange = vi.fn()) {
    render(<UnitSelector value="px" onChange={onChange} />);
    return { trigger: screen.getByRole("combobox"), onChange };
  }

  it("closed trigger: native <button> combobox with aria-haspopup=listbox, aria-expanded=false, no listbox rendered", () => {
    const { trigger } = renderUnits();
    // Native button ⇒ Enter/Space activate it (browser semantics).
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("role")).toBe("combobox");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(getListbox()).toBeNull();
  });

  it("activation (click, i.e. Enter/Space on a native button) opens: aria-expanded=true, portaled listbox, aria-controls points at it", () => {
    const { trigger } = renderUnits();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const listbox = getListbox();
    expect(listbox).not.toBeNull();
    expect(trigger.getAttribute("aria-controls")).toBe(listbox!.id);
    // Portal convention: dropdown escapes overflow via a data-tuner-portal portal.
    expect(listbox!.closest("[data-tuner-portal]")).not.toBeNull();
  });

  it("options have role=option and aria-selected marks exactly the current value", () => {
    const { trigger } = renderUnits();
    fireEvent.click(trigger);
    const options = getOptions();
    expect(options.map((o) => o.textContent)).toEqual(["px", "%", "em", "rem", "vw", "vh"]);
    for (const opt of options) {
      expect(opt.getAttribute("aria-selected")).toBe(opt.textContent === "px" ? "true" : "false");
    }
  });

  it("aria-activedescendant appears on open and tracks the highlighted option", () => {
    const { trigger } = renderUnits();
    expect(trigger.getAttribute("aria-activedescendant")).toBeNull();
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // opens, highlight = selected ("px")
    expect(activeDescendant(trigger)?.textContent).toBe("px");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeDescendant(trigger)?.textContent).toBe("%");
    expect(activeDescendant(trigger)?.getAttribute("role")).toBe("option");
  });
});

// ─── UnitSelector + useDropdownKeyboard — keyboard behavior ───────────
// These exercise useDropdownKeyboard through a real consumer, replacing the
// old string assertions over the hook's source (case "Escape": etc.).

describe("UnitSelector + useDropdownKeyboard — keyboard behavior", () => {
  function renderUnits(onChange = vi.fn()) {
    render(<UnitSelector value="px" onChange={onChange} />);
    return { trigger: screen.getByRole("combobox"), onChange };
  }

  it("ArrowDown on the closed trigger opens the dropdown", () => {
    const { trigger } = renderUnits();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(getListbox()).not.toBeNull();
  });

  it("ArrowUp on the closed trigger also opens the dropdown", () => {
    const { trigger } = renderUnits();
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(getListbox()).not.toBeNull();
  });

  it("ArrowDown/ArrowUp navigate the highlight through options", () => {
    const { trigger } = renderUnits();
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // open at "px"
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeDescendant(trigger)?.textContent).toBe("%");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeDescendant(trigger)?.textContent).toBe("em");
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(activeDescendant(trigger)?.textContent).toBe("%");
  });

  it("navigation wraps: ArrowUp from first goes to last, ArrowDown from last goes to first", () => {
    const { trigger } = renderUnits();
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // open at "px" (first)
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(activeDescendant(trigger)?.textContent).toBe("vh"); // wrapped to last
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeDescendant(trigger)?.textContent).toBe("px"); // wrapped back
  });

  it("Home jumps to the first option, End to the last", () => {
    const { trigger } = renderUnits();
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // open
    fireEvent.keyDown(trigger, { key: "End" });
    expect(activeDescendant(trigger)?.textContent).toBe("vh");
    fireEvent.keyDown(trigger, { key: "Home" });
    expect(activeDescendant(trigger)?.textContent).toBe("px");
  });

  it("Enter selects the highlighted option: onChange fires with it and the dropdown closes", () => {
    const { trigger, onChange } = renderUnits();
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // open at "px"
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // highlight "%"
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("%");
    expect(getListbox()).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("Escape closes the dropdown without selecting", () => {
    const { trigger, onChange } = renderUnits();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(getListbox()).not.toBeNull();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(getListbox()).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("navigation keys are preventDefault'ed (no page scroll), but Tab is not intercepted so focus can move out", () => {
    const { trigger } = renderUnits();
    // fireEvent returns false when preventDefault was called on the event.
    expect(fireEvent.keyDown(trigger, { key: "ArrowDown" })).toBe(false); // open
    expect(fireEvent.keyDown(trigger, { key: "ArrowDown" })).toBe(false);
    expect(fireEvent.keyDown(trigger, { key: "ArrowUp" })).toBe(false);
    expect(fireEvent.keyDown(trigger, { key: "Home" })).toBe(false);
    expect(fireEvent.keyDown(trigger, { key: "End" })).toBe(false);
    // Tab must NOT be swallowed — default (focus move) proceeds.
    expect(fireEvent.keyDown(trigger, { key: "Tab" })).toBe(true);
  });

  it("type-ahead: typing letters highlights the first matching option", () => {
    const { trigger } = renderUnits();
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // open at "px"
    fireEvent.keyDown(trigger, { key: "v" });
    expect(activeDescendant(trigger)?.textContent).toBe("vw");
    fireEvent.keyDown(trigger, { key: "h" }); // buffer "vh"
    expect(activeDescendant(trigger)?.textContent).toBe("vh");
  });

  it("clicking an option selects it and closes the dropdown", () => {
    const { trigger, onChange } = renderUnits();
    fireEvent.click(trigger);
    const em = getOptions().find((o) => o.textContent === "em")!;
    fireEvent.click(em);
    expect(onChange).toHaveBeenCalledWith("em");
    expect(getListbox()).toBeNull();
  });
});

// ─── SelectRow (searchable custom mode / SelectRowCustom) ─────────────

describe("SelectRow (searchable custom mode) — keyboard accessibility", () => {
  const OPTIONS = [
    { value: "alpha", label: "Alpha" },
    { value: "beta", label: "Beta" },
    { value: "gamma", label: "Gamma" },
  ];

  function renderSearchable(onChange = vi.fn()) {
    const { container } = render(
      <SelectRow label="Kind" value="alpha" options={OPTIONS} onChange={onChange} searchable />,
    );
    const trigger = container.querySelector("button") as HTMLElement;
    return { trigger, onChange };
  }

  function getCustomPortal(): HTMLElement | null {
    return document.querySelector("[data-select-custom-portal]");
  }

  it("trigger is focusable (tabIndex=0) with aria-expanded=false when closed", () => {
    const { trigger } = renderSearchable();
    expect(trigger.tabIndex).toBe(0);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(getCustomPortal()).toBeNull();
  });

  it("Enter on the trigger opens the dropdown (aria-expanded=true, portaled menu with listbox)", () => {
    const { trigger } = renderSearchable();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const portal = getCustomPortal();
    expect(portal).not.toBeNull();
    expect(portal!.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it("Space on the trigger opens the dropdown", () => {
    const { trigger } = renderSearchable();
    fireEvent.keyDown(trigger, { key: " " });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(getCustomPortal()).not.toBeNull();
  });

  it("ArrowDown on the trigger opens the dropdown", () => {
    const { trigger } = renderSearchable();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(getCustomPortal()).not.toBeNull();
  });

  it("the search input autofocuses when the dropdown opens", () => {
    const { trigger } = renderSearchable();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const input = getCustomPortal()!.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it("Escape in the search input closes the dropdown", () => {
    const { trigger, onChange } = renderSearchable();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const input = getCustomPortal()!.querySelector("input") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Escape" });
    expect(getCustomPortal()).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("options render as role=option and selecting one fires onChange and closes", () => {
    const { trigger, onChange } = renderSearchable();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const beta = getOptions().find((o) => o.textContent === "Beta")!;
    // SearchableMenu selects on mousedown (so the search input isn't blurred first).
    fireEvent.mouseDown(beta);
    expect(onChange).toHaveBeenCalledWith("beta");
    expect(getCustomPortal()).toBeNull();
  });
});

// ─── StateSelector (via PortalListboxSelect) ──────────────────────────
// StateSelector is a thin declaration; the ARIA/keyboard implementation lives
// in PortalListboxSelect. Mounting StateSelector tests both: the shared
// portal-listbox behavior AND the state options wiring.

describe("StateSelector — keyboard accessibility (via PortalListboxSelect)", () => {
  const ALL_STATE_LABELS = [
    "None — base styles",
    "Hover",
    "Focus",
    "Active",
    "Focus Within",
    "Focus Visible",
  ];

  it("trigger is a native <button> combobox with aria-haspopup/aria-expanded", () => {
    render(<StateSelector value="none" onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.tagName).toBe("BUTTON"); // Enter/Space activate natively
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(getListbox()).toBeNull();
  });

  it("ArrowDown on the closed trigger opens the portaled listbox; aria-controls points at it", () => {
    render(<StateSelector value="none" onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const listbox = getListbox();
    expect(listbox).not.toBeNull();
    expect(trigger.getAttribute("aria-controls")).toBe(listbox!.id);
    expect(listbox!.closest("[data-tuner-portal]")).not.toBeNull();
  });

  it("renders all state options (role=option), including hover and focus", () => {
    render(<StateSelector value="none" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(getOptions().map((o) => o.textContent)).toEqual(ALL_STATE_LABELS);
  });

  it("aria-selected marks exactly the currently-applied state", () => {
    render(<StateSelector value="hover" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    for (const opt of getOptions()) {
      expect(opt.getAttribute("aria-selected")).toBe(opt.textContent === "Hover" ? "true" : "false");
    }
  });

  it("ArrowDown/ArrowUp move the highlight (aria-activedescendant) through options", () => {
    render(<StateSelector value="hover" onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // open, highlight = "Hover"
    expect(activeDescendant(trigger)?.textContent).toBe("Hover");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeDescendant(trigger)?.textContent).toBe("Focus");
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(activeDescendant(trigger)?.textContent).toBe("Hover");
  });

  it("Enter selects the highlighted state: onChange receives the option id and the dropdown closes", () => {
    const onChange = vi.fn();
    render(<StateSelector value="none" onChange={onChange} />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // open at "None — base styles"
    fireEvent.keyDown(trigger, { key: "ArrowDown" }); // highlight "Hover"
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("hover");
    expect(getListbox()).toBeNull();
  });

  it("is controlled: clicking an option routes its id through onChange but does not change the trigger by itself", () => {
    const onChange = vi.fn();
    render(<StateSelector value="none" onChange={onChange} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.textContent).toContain("State"); // base label for value="none"
    fireEvent.click(trigger);
    fireEvent.click(getOptions().find((o) => o.textContent === "Active")!);
    expect(onChange).toHaveBeenCalledWith("active");
    // Parent did not re-render with a new value ⇒ trigger still shows the base
    // label. Selection state lives in the value prop, not internal state.
    expect(trigger.textContent).toContain("State");
    expect(getListbox()).toBeNull();
  });

  it("Escape closes without selecting; Tab is not intercepted", () => {
    const onChange = vi.fn();
    render(<StateSelector value="none" onChange={onChange} />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(getListbox()).not.toBeNull();
    expect(fireEvent.keyDown(trigger, { key: "Tab" })).toBe(true); // not swallowed
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(getListbox()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
