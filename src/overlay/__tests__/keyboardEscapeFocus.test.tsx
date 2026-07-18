// @vitest-environment happy-dom
/**
 * keyboardEscapeFocus.test.tsx — QA_CHECKLIST "Keyboard → Escape Key" and
 * "Keyboard → Focus Management", locked in as behavioral regression tests
 * (issue #105 style: mounted components + fired events).
 *
 * Only the GAPS are tested here — existing coverage is not duplicated:
 *   - UnitSelector Escape-close: dropdownAccessibility.test.tsx
 *   - SelectRow (searchable) Escape-close: dropdownAccessibility.test.tsx
 *   - SwatchColorPicker Escape-close: swatchColorPickerPortal.test.tsx
 *   - Footer clipboard Escape-close + focus-return: footerClipboardA11y.test.tsx
 *
 * New coverage:
 *   1. SelectRow (plain, non-searchable) — Escape on the trigger closes the
 *      listbox; focus stays on the trigger.
 *   2. ColorRow-opened ColorPickerEnhanced — Escape closes the picker.
 *      (BUG found by this QA pass: ColorRow had no Escape handling at all —
 *      only outside-click closed it. Same for ModeValueCell.)
 *   3. ModeValueCell-opened ColorPickerEnhanced — Escape closes the picker.
 *   4. TransitionOptionsMenu — Escape closes the menu AND focus returns to
 *      the menu button (useFocusTrap restore).
 *   5. Focus-ring contract — mounting the panel injects the
 *      `.tuner-focusable:focus-visible` rule with the theme focusRing.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { SelectRow } from "../controls/SelectRow";
import { ColorRow } from "../controls/ColorRow";
import { ModeValueCell } from "../variables/ModeValueCell";
import type { InferredMode } from "../variables/modeDiscovery";
import { resetAllModeOverrides } from "../core/modeOverrides";
import { EffectsSection } from "../sections/EffectsSection";
import { resetAll } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";
import { WebflowPanel } from "../shell/WebflowPanel";
import type { SpacingValues } from "../core/infer";
import { _readManagedSheetCss } from "../core/managedSheet";
import { focusRing } from "../theme";

// Keep the WebflowPanel mount light — sections aren't under test here.
vi.mock("../sections/LayoutSection", () => ({ LayoutSection: () => null }));
vi.mock("../sections/SpacingSection", () => ({ SpacingSection: () => null }));
vi.mock("../sections/SizeSection", () => ({ SizeSection: () => null }));
vi.mock("../sections/PositionSection", () => ({ PositionSection: () => null }));
vi.mock("../sections/TypographySection", () => ({ TypographySection: () => null }));
vi.mock("../sections/BackgroundsSection", () => ({ BackgroundsSection: () => null }));
vi.mock("../sections/BordersSection", () => ({ BordersSection: () => null }));
vi.mock("../sections/CustomPropertiesSection", () => ({ CustomPropertiesSection: () => null }));

afterEach(() => {
  cleanup();
  resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

describe("SelectRow (plain) Escape (checklist: Escape Key 1)", () => {
  const OPTIONS = [
    { value: "alpha", label: "Alpha" },
    { value: "beta", label: "Beta" },
  ];

  it("Escape on the focused trigger closes the listbox; focus stays on the trigger", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SelectRow label="Kind" value="alpha" options={OPTIONS} onChange={onChange} />
    );
    const trigger = container.querySelector('[role="combobox"]') as HTMLElement;
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.querySelector("[data-select-portal]")).not.toBeNull();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(document.querySelector("[data-select-portal]")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ColorRow picker Escape (checklist: Escape Key 2)", () => {
  it("Escape closes a picker opened from a ColorRow swatch", () => {
    const { container } = render(
      <ColorRow label="Color" value="#3b82f6" onChange={vi.fn()} />
    );
    const swatch = container.querySelector('[role="button"]') as HTMLElement;
    fireEvent.click(swatch);
    expect(document.querySelector("[data-tuner-portal]"), "picker should open").not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      document.querySelector("[data-tuner-portal]"),
      "Escape must close the ColorRow picker"
    ).toBeNull();
  });
});

describe("ModeValueCell picker Escape (checklist: Escape Key 2)", () => {
  const DARK: InferredMode = {
    name: "Dark",
    source: "class",
    selector: ".dark",
    values: { "--bg": "#111" },
  };

  it("Escape closes a picker opened from a mode cell color dot", () => {
    const { container } = render(
      <ModeValueCell varName="--bg" mode={DARK} value="#111111" varType="color" />
    );
    const dot = Array.from(container.querySelectorAll("div")).find((d) =>
      (d.getAttribute("style") ?? "").includes("width: 12px")
    ) as HTMLElement;
    expect(dot, "color dot should render").toBeTruthy();
    fireEvent.click(dot);
    expect(document.querySelector("[data-tuner-portal]"), "picker should open").not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      document.querySelector("[data-tuner-portal]"),
      "Escape must close the ModeValueCell picker"
    ).toBeNull();
  });
});

describe("TransitionOptionsMenu Escape + focus return (checklist: Escape Key 5, Focus Mgmt 2)", () => {
  function makeCtx(): SectionCtx {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const cs = getComputedStyle(element);
    return {
      element,
      apply: () => {},
      reset: () => {},
      resetRead: () => 0,
      resetReadStr: () => "",
      ind: () => "none" as const,
      sectionInd: () => "none" as const,
      cs,
      parentCs: null,
      getConversionCtx: (): UnitConversionContext => ({
        computedFontSize: 16,
        rootFontSize: 16,
        parentWidth: 800,
        parentHeight: 600,
        viewportWidth: 1280,
        viewportHeight: 720,
      }),
      ctxMenu: () => () => {},
      isTailwind: false,
    };
  }

  function menuPortal(): HTMLElement | null {
    const portals = Array.from(document.querySelectorAll("[data-tuner-portal]"));
    return (portals.find((p) => p.textContent?.includes("Copy CSS")) as HTMLElement) ?? null;
  }

  it("Escape closes the menu and focus returns to the menu button", () => {
    render(<EffectsSection ctx={makeCtx()} forceOpen />);
    const row = screen.getByText("Transitions").closest("div") as HTMLElement;
    const menuBtn = row.querySelector("button") as HTMLElement;
    menuBtn.focus();

    fireEvent.click(menuBtn);
    const portal = menuPortal();
    expect(portal, "options menu should open").not.toBeNull();
    // useFocusTrap moves focus into the menu on open…
    expect(portal!.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(menuPortal(), "Escape must close the menu").toBeNull();
    // …and restores it to the trigger on close.
    expect(document.activeElement).toBe(menuBtn);
  });
});

describe("Focus-ring contract (checklist: Focus Management 1)", () => {
  const SPACING: SpacingValues = {
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  };

  it("mounting the panel injects the .tuner-focusable:focus-visible ring", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    render(<WebflowPanel element={el} spacing={SPACING} onSpacingChange={() => {}} />);

    const css = _readManagedSheetCss("tuner-focus-styles");
    expect(css, "tuner-focus-styles sheet must be injected").toBeTruthy();
    expect(css).toContain(".tuner-focusable:focus-visible");
    expect(css).toContain(`box-shadow: ${focusRing}`);
  });
});
