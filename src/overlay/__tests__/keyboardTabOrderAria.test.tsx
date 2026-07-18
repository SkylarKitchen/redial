// @vitest-environment happy-dom
/**
 * keyboardTabOrderAria.test.tsx — QA_CHECKLIST "Keyboard → Tab Order" and
 * "Keyboard → ARIA", locked in as behavioral regression tests (issue #105
 * style: mounted components + fired events, no source-text assertions).
 *
 * Only the coverage GAPS live here — the rest of the two checklist scopes is
 * already behavioral elsewhere:
 *   - SegmentedControl arrow keys → segmentedControlKeyboard.test.tsx
 *   - Section aria-expanded → sectionToggle / transitionsIndicators / hoverStates
 *   - Toolbar aria-label + aria-pressed → toolbar.test.tsx, shellSweepA11y.test.tsx
 *   - SelectRow option navigation (Enter/arrows/Home/End/type-ahead) →
 *     dropdownAccessibility.test.tsx (via the shared useDropdownKeyboard hook)
 *   - .tuner-focusable:focus-visible ring injection → keyboardEscapeFocus.test.tsx
 *
 * Gaps covered here:
 *   1. Section header: Enter AND Space toggle collapse (the handler existed,
 *      only the click path was tested), Space is preventDefault-ed so the page
 *      doesn't scroll, and the header is a real tab stop (tabIndex=0).
 *   2. SegmentedControl container: role="radiogroup" + aria-label (radios were
 *      asserted implicitly via getAllByRole, the group role never directly),
 *      plus roving tabIndex — exactly one tab stop per group.
 *   3. SliderRow: the range input is a labeled slider (explicit role +
 *      aria-label with value and unit) carrying tuner-focusable for the focus
 *      ring. Native range inputs expose aria-valuemin/max/now implicitly from
 *      min/max/value, so those attributes are the testable contract.
 *   4. Plain (non-searchable) SelectRow: ArrowDown on the combobox trigger
 *      opens the listbox portal and drives aria-expanded/aria-activedescendant.
 *      Only the searchable variant's open-keys were directly tested before.
 *   5. Footer: the status live region (role="status" aria-live="polite") is
 *      mounted BEFORE the first message so announcements aren't dropped, and
 *      every footer button is a native tab-reachable <button>.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Section } from "../controls/Section";
import { SegmentedControl } from "../controls/SegmentedControl";
import { SliderRow } from "../controls/SliderRow";
import { SelectRow } from "../controls/SelectRow";
import { Footer } from "../shell/Footer";
import { styleEngine } from "../core/engine";

afterEach(() => {
  cleanup();
  styleEngine.resetAll();
  document.body.innerHTML = "";
});

describe("Section header keyboard toggle (checklist: Tab Order 1–2)", () => {
  it("is a tab stop and toggles on Enter and Space (Space default prevented)", () => {
    const { container } = render(
      <Section title="Probe" collapsed>
        <div data-probe-content>content</div>
      </Section>
    );
    const header = container.querySelector('[role="button"]') as HTMLElement;

    // Focusability contract behind "Tab reaches section headers": a div can
    // only join the tab order with an explicit tabIndex=0.
    expect(header.tabIndex).toBe(0);
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-probe-content]")).toBeNull();

    fireEvent.keyDown(header, { key: "Enter" });
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("[data-probe-content]")).not.toBeNull();

    // fireEvent returns false when preventDefault() ran — Space must not
    // scroll the panel while toggling.
    const spaceNotPrevented = fireEvent.keyDown(header, { key: " " });
    expect(spaceNotPrevented).toBe(false);
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-probe-content]")).toBeNull();
  });
});

describe("SegmentedControl group semantics (checklist: ARIA 1, Tab Order 3)", () => {
  const OPTIONS = [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
    { value: "c", label: "C" },
  ];

  it("renders a labeled radiogroup of radios with a single roving tab stop", () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="b" onChange={vi.fn()} aria-label="Display mode" />
    );
    const group = container.querySelector('[role="radiogroup"]') as HTMLElement;
    expect(group, "container must be a radiogroup").not.toBeNull();
    expect(group.getAttribute("aria-label")).toBe("Display mode");

    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    // Roving tabIndex: Tab lands on the checked option only; arrows (covered
    // by segmentedControlKeyboard.test.tsx) move within the group.
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    radios.forEach((r) => expect(r.tagName).toBe("BUTTON"));
  });
});

describe("SliderRow slider semantics (checklist: Tab Order 4, ARIA 4)", () => {
  it("range input is an explicitly-labeled slider with min/max/value and the focus-ring class", () => {
    const { container } = render(
      <SliderRow label="Opacity" value={50} min={0} max={100} step={1} unit="%" onChange={vi.fn()} />
    );
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider, "numeric mode must render the range input").not.toBeNull();

    expect(slider.getAttribute("role")).toBe("slider");
    expect(slider.getAttribute("aria-label")).toBe("Opacity: 50%");
    // Native range inputs derive aria-valuemin/max/now from these — asserting
    // the source attributes is the happy-dom-stable form of the ARIA contract.
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("100");
    expect(slider.value).toBe("50");
    // Focus ring: WebflowPanel injects `.tuner-focusable:focus-visible` with
    // the theme focusRing (asserted in keyboardEscapeFocus.test.tsx); the
    // slider opts in via the class.
    expect(slider.classList.contains("tuner-focusable")).toBe(true);
    expect(slider.disabled).toBe(false);
  });
});

describe("Plain SelectRow combobox keyboard open (checklist: Tab Order 5)", () => {
  const OPTIONS = [
    { value: "alpha", label: "Alpha" },
    { value: "beta", label: "Beta" },
    { value: "gamma", label: "Gamma" },
  ];

  it("ArrowDown on the trigger opens the listbox and drives aria state", () => {
    const { container } = render(
      <SelectRow label="Kind" value="alpha" options={OPTIONS} onChange={vi.fn()} />
    );
    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("[data-select-portal]")).toBeNull();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("[data-select-portal]"), "listbox portal must open").not.toBeNull();

    // Once a highlight exists the trigger must point at it for screen readers.
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-activedescendant")).toMatch(/-opt-\d+$/);
  });
});

describe("Footer live region and tab-reachable buttons (checklist: Tab Order 6, ARIA 5)", () => {
  function mountFooter() {
    const el = document.createElement("div");
    document.body.appendChild(el);
    // One pending change so Save is enabled (disabled buttons legitimately
    // leave the tab order).
    styleEngine.apply({ scope: "element", el }, "color", "red");
    return render(
      <Footer
        element={el}
        onReset={() => {}}
        scopeCtx={{ scope: "element", activeClassName: null, activeState: "none" }}
      />
    );
  }

  it("status live region is mounted before any message appears", () => {
    const { container } = mountFooter();
    const status = container.querySelector('[role="status"]') as HTMLElement;
    expect(status, "live region must exist while idle").not.toBeNull();
    expect(status.getAttribute("aria-live")).toBe("polite");
    // Empty at rest — the region pre-exists its first announcement.
    expect((status.textContent ?? "").trim()).toBe("");
  });

  it("Clipboard, Reset, and Save are native buttons with no tabIndex=-1", () => {
    const { container } = mountFooter();
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));

    const byText = (t: string) => buttons.find((b) => (b.textContent ?? "").includes(t));
    const clipboard = byText("Clipboard");
    const reset = byText("Reset");
    const save = byText("Save");
    expect(clipboard, "Clipboard button").toBeTruthy();
    expect(reset, "Reset button").toBeTruthy();
    expect(save, "Save button").toBeTruthy();

    expect(save!.disabled).toBe(false);
    for (const b of buttons) {
      expect(b.getAttribute("tabindex"), `${(b.textContent ?? "").trim()} must stay tab-reachable`).not.toBe("-1");
    }
  });
});
